"""核对：换进 mlx_vlm 的分块算法，和 mlx_vlm 自带的逐 token 参考算法（gated_delta_ops）结果相同。
输出、最终状态、对 q/k/v/g/β/初始状态的梯度；包括带填充掩码、遗忘门很小（1e-12）的情况。

    .venv/bin/python test_chunked_vlm.py          （默认在 CPU 上跑，不占 GPU）
"""
import sys

import mlx.core as mx

import chunked_delta

if "--gpu" not in sys.argv:
    mx.set_default_device(mx.cpu)
vgd = chunked_delta.install_vlm()
ref = vgd.gated_delta_ops


def rel(a, b):
    return (mx.abs(a - b).max() / (mx.abs(b).max() + 1e-12)).item()


def case(name, T, tiny=False, masked=False, seed=0):
    mx.random.seed(seed)
    B, Hk, Hv, Dk, Dv = 2, 2, 4, 16, 8
    q = mx.random.normal((B, T, Hk, Dk)) * 0.3
    k = mx.random.normal((B, T, Hk, Dk)) * 0.3
    v = mx.random.normal((B, T, Hv, Dv))
    g = mx.random.uniform(0.5, 0.999, (B, T, Hv))
    if tiny:
        g = mx.where(mx.random.uniform(shape=(B, T, Hv)) < 0.2, mx.array(1e-12), g)
    beta = mx.random.uniform(0.1, 0.9, (B, T, Hv))
    s0 = mx.random.normal((B, Hv, Dv, Dk)) * 0.1
    mask = None
    if masked:
        mask = mx.ones((B, T), dtype=mx.bool_)
        mask = mx.concatenate([mask[:, : T - 7], mx.zeros((B, 7), dtype=mx.bool_)], axis=1)

    def loss(fn, q, k, v, g, beta, s0):
        y, s = fn(q, k, v, g, beta, s0, mask)
        if mask is not None:
            y = y * mask[..., None, None]
        return (y * y).sum() + (s * s).sum() * 0.1, (y, s)

    outs = {}
    for label, fn in (("ref", ref), ("new", vgd.gated_delta_chunked)):
        (l, (y, s)), grads = mx.value_and_grad(lambda *a: loss(fn, *a), argnums=(0, 1, 2, 3, 4, 5))(q, k, v, g, beta, s0)
        outs[label] = (y, s, grads)
    y0, s0r, g0 = outs["ref"]
    y1, s1, g1 = outs["new"]
    if mask is not None:
        y0, y1 = y0 * mask[..., None, None], y1 * mask[..., None, None]
    errs = [rel(y1, y0), rel(s1, s0r)] + [rel(a, b) for a, b in zip(g1, g0)]
    ok = max(errs) < 1e-4
    print(f"{'✓' if ok else '✗'} {name}：输出 {errs[0]:.1e}，状态 {errs[1]:.1e}，梯度（q k v g β s0）" + " ".join(f"{e:.1e}" for e in errs[2:]))
    return ok


results = [
    case("T=50（不足一块）", 50),
    case("T=200（多块，最后一块不满）", 200, seed=1),
    case("T=200，遗忘门有 1e-12", 200, tiny=True, seed=2),
    case("T=130，末尾 7 个填充位置", 130, masked=True, seed=3),
]
print("全部一致" if all(results) else "有不一致")
sys.exit(0 if all(results) else 1)
