"""Qwen3.5 循环层（gated delta rule）的“分块并行”算法，训练时代替 MLX 自带的逐 token 循环。

为什么需要：MLX 推理时用的 Metal 内核不支持求导，训练时退回到 Python 循环——每个 token、每一层
都要读写一个 [B, H, Dv, Dk] 的状态矩阵，反向传播还要把每一步的状态都留着。2B 上实测每步训练约 20 秒。
这里把序列切成每块 C 个 token：块内的关系用矩阵运算一次算完，只有“块与块之间”的状态是顺序传递的。
结果和逐 token 的算法在数学上相同（test_chunked_delta.py 里核对数值和梯度）。

逐 token 的定义（MLX 的 _gated_delta_step_ops）：
    Ŝ = g_t · S_{t-1}
    u_t = β_t · (v_t − Ŝ k_t)
    S_t = Ŝ + u_t k_tᵀ
    y_t = S_t q_t

块内展开（γ_t = g_1 … g_t，S_0 是进入这一块时的状态）：
    S_t = γ_t S_0 + Σ_{i≤t} (γ_t/γ_i) u_i k_iᵀ
    u_t = β_t ( v_t − γ_t S_0 k_t − Σ_{i<t} (γ_t/γ_i)(k_tᵀk_i) u_i )
写成矩阵：(I + L) U = diag(β) V − diag(βγ) K S_0ᵀ，其中 L_{ti} = β_t (γ_t/γ_i)(k_tᵀk_i)（i < t，严格下三角）。
M = (I + L)^{-1} 和状态无关，所有块可以同时算；它是单位下三角矩阵的逆，用分块递归求（log₂C 层矩阵乘法）。
"""
import mlx.core as mx

from mlx_lm.models import gated_delta as _gd

_naive_ops = _gd.gated_delta_ops  # 原来的逐 token 实现（有 mask、向量门控时仍然用它）
CHUNK = 64  # 必须是 2 的幂


def _chunk_matrices(k, lg, beta):
    """块内两个和状态无关的矩阵。k: [..., C, Dk]，lg: [..., C]（log g），beta: [..., C]

    返回 M = (I + L)^{-1} 和 R，R_{ti} = γ_t/γ_i = g_{i+1}…g_t（i ≤ t，对角线为 1，上三角为 0），都是 [..., C, C]。

    分块递归，块的大小 1 → 2 → 4 → … → C：已知两个相邻对角块的结果和它们之间的非对角块 B，
    [[A, 0], [B, D]]⁻¹ = [[A⁻¹, 0], [−D⁻¹ B A⁻¹, D⁻¹]]。

    衰减比例 R 不能写成“前缀和相减”exp(c_t − c_i)：求导时 c_t 和 c_i 里公共的那些项要靠两个大数相减来抵消，
    留下的舍入误差再除以很小的 g（遗忘门，实测可以小到 1e-13）会放大几十万倍。
    这里每一层只累加“跨过中点”的那些 log g：后半块用前缀和，前半块用后缀和，没有相减。
    """
    C, Dk = k.shape[-2], k.shape[-1]
    lead = k.shape[:-2]
    inv = mx.ones((*lead, C, 1, 1), dtype=k.dtype)
    R = mx.ones((*lead, C, 1, 1), dtype=k.dtype)
    s = 1
    while s < C:
        P = C // (2 * s)
        kk = k.reshape(*lead, P, 2, s, Dk)
        ll = lg.reshape(*lead, P, 2, s)
        bb = beta.reshape(*lead, P, 2, s)
        k1, k2 = kk[..., 0, :, :], kk[..., 1, :, :]
        prefix2 = mx.cumsum(ll[..., 1, :], axis=-1)  # 后半块：log(g_{mid+1}…g_t)，含 t
        suffix1 = mx.cumsum(ll[..., 0, :], axis=-1, reverse=True, inclusive=False)  # 前半块：log(g_{i+1}…g_mid)，不含 i
        ratio = mx.exp(prefix2[..., :, None] + suffix1[..., None, :])  # 行 t 在后半块、列 i 在前半块  [..., P, s, s]
        off = bb[..., 1, :][..., :, None] * ratio * (k2 @ k1.swapaxes(-1, -2))
        iv = inv.reshape(*lead, P, 2, s, s)
        a_inv, d_inv = iv[..., 0, :, :], iv[..., 1, :, :]
        zeros = mx.zeros_like(a_inv)
        inv = mx.concatenate([mx.concatenate([a_inv, zeros], axis=-1),
                              mx.concatenate([-(d_inv @ off @ a_inv), d_inv], axis=-1)], axis=-2)  # [..., P, 2s, 2s]
        rr = R.reshape(*lead, P, 2, s, s)
        R = mx.concatenate([mx.concatenate([rr[..., 0, :, :], zeros], axis=-1),
                            mx.concatenate([ratio, rr[..., 1, :, :]], axis=-1)], axis=-2)
        s *= 2
    return inv.reshape(*lead, C, C), R.reshape(*lead, C, C)


def gated_delta_chunked(q, k, v, g, beta, state=None, mask=None, chunk=None):
    """与 mlx_lm.models.gated_delta.gated_delta_ops 相同的输入输出。

    q, k: [B, T, Hk, Dk]；v: [B, T, Hv, Dv]；g, beta: [B, T, Hv]；state: [B, Hv, Dv, Dk]
    返回 y: [B, T, Hv, Dv]（dtype 同 q）和新的 state（float32）。
    """
    if g.ndim != 3:
        return _naive_ops(q, k, v, g, beta, state, mask)
    if mask is not None:
        # 填充位置（mask 为 False）：不衰减、不更新（g = 1、β = 0），状态原样传下去；这些位置的输出不计入损失
        g = mx.where(mask[..., None], g, 1.0)
        beta = mx.where(mask[..., None], beta, 0.0)
    C = chunk or CHUNK
    B, T, Hk, Dk = q.shape
    Hv, Dv = v.shape[-2:]
    out_dtype = q.dtype
    if state is None:
        state = mx.zeros((B, Hv, Dv, Dk), dtype=mx.float32)
    if (rep := Hv // Hk) > 1:
        q = mx.repeat(q, rep, -2)
        k = mx.repeat(k, rep, -2)

    f32 = mx.float32
    q = q.astype(f32).transpose(0, 2, 1, 3)  # [B, H, T, Dk]
    k = k.astype(f32).transpose(0, 2, 1, 3)
    v = v.astype(f32).transpose(0, 2, 1, 3)  # [B, H, T, Dv]
    g = g.astype(f32).transpose(0, 2, 1)  # [B, H, T]
    beta = beta.astype(f32).transpose(0, 2, 1)

    # 补齐到块长的整数倍：补的位置 k = v = 0、β = 0、g = 1，对状态没有影响
    pad = (-T) % C
    if pad:
        zk = mx.zeros((B, Hv, pad, Dk), dtype=f32)
        q = mx.concatenate([q, zk], axis=2)
        k = mx.concatenate([k, zk], axis=2)
        v = mx.concatenate([v, mx.zeros((B, Hv, pad, Dv), dtype=f32)], axis=2)
        g = mx.concatenate([g, mx.ones((B, Hv, pad), dtype=f32)], axis=2)
        beta = mx.concatenate([beta, mx.zeros((B, Hv, pad), dtype=f32)], axis=2)
    N = (T + pad) // C
    q = q.reshape(B, Hv, N, C, Dk)
    k = k.reshape(B, Hv, N, C, Dk)
    v = v.reshape(B, Hv, N, C, Dv)
    g = g.reshape(B, Hv, N, C)
    beta = beta.reshape(B, Hv, N, C)

    lg = mx.log(mx.maximum(g, 1e-30))
    gamma = mx.exp(mx.cumsum(lg, axis=-1))  # γ_t = g_1…g_t
    tail = mx.exp(mx.cumsum(lg, axis=-1, reverse=True, inclusive=False))  # γ_C/γ_i = g_{i+1}…g_C

    # 和状态无关的部分：所有块一起算
    M, R = _chunk_matrices(k, lg, beta)  # [B, H, N, C, C]
    W = M @ (beta[..., None] * v)  # M diag(β) V          [.., C, Dv]
    Kd = M @ ((beta * gamma)[..., None] * k)  # M diag(βγ) K  [.., C, Dk]
    Bq = R * (q @ k.swapaxes(-1, -2))  # (γ_t/γ_i)(q_tᵀk_i)，含对角线  [.., C, C]
    gq = gamma[..., None] * q  # γ_t q_t
    k_end = tail[..., None] * k  # (γ_C/γ_i) k_i
    g_end = gamma[..., -1]  # γ_C  [B, H, N]

    # 块与块之间：状态顺序传递
    ys = []
    S = state.astype(f32)
    for n in range(N):
        St = S.swapaxes(-1, -2)  # [B, H, Dk, Dv]
        U = W[:, :, n] - Kd[:, :, n] @ St  # [B, H, C, Dv]
        ys.append(gq[:, :, n] @ St + Bq[:, :, n] @ U)
        S = g_end[:, :, n][..., None, None] * S + U.swapaxes(-1, -2) @ k_end[:, :, n]
    y = mx.concatenate(ys, axis=2)[:, :, :T].transpose(0, 2, 1, 3)  # [B, T, H, Dv]
    return y.astype(out_dtype), S


def install():
    """让 mlx_lm 在训练时（不能用 Metal 内核时）使用分块算法"""
    _gd.gated_delta_ops = gated_delta_chunked


def install_vlm():
    """让 mlx_vlm 的 Qwen3.5 在训练时用这里的分块算法。

    mlx_vlm 自带的分块版本用“对数前缀和相减”算衰减比例，还把门的值截到 1e-6 以上：遗忘门有 1e-12 时，
    对门的梯度相对误差 16%（2026-11-11 实测；这里的版本 1e-7 量级，见 test_chunked_vlm.py）。"""
    from mlx_vlm.models.qwen3_5 import gated_delta as vgd

    def chunked(q, k, v, g, beta, state, mask=None, C=None):
        return gated_delta_chunked(q, k, v, g, beta, state, mask)

    vgd.gated_delta_chunked = chunked
    return vgd
