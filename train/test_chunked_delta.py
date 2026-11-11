"""核对分块算法和 MLX 原来的逐 token 算法：输出、最终状态、梯度都应该一致。

    .venv/bin/python test_chunked_delta.py
"""
import time

import mlx.core as mx

import chunked_delta as cd


def rand_inputs(B, T, H, Dk, Dv, seed):
    mx.random.seed(seed)
    q = mx.random.normal((B, T, H, Dk))
    k = mx.random.normal((B, T, H, Dk))
    # 与模型里一样：k 归一化成单位长度，q 的长度是 Dk^-0.5
    k = k / mx.sqrt((k * k).sum(-1, keepdims=True))
    q = q / mx.sqrt((q * q).sum(-1, keepdims=True)) * Dk ** -0.5
    v = mx.random.normal((B, T, H, Dv))
    g = mx.exp(-mx.exp(mx.random.normal((B, T, H)) * 1.5 - 1.0))  # 0～1，有的很接近 0
    beta = mx.sigmoid(mx.random.normal((B, T, H)) * 2)
    state = mx.random.normal((B, H, Dv, Dk)) * 0.3
    return q, k, v, g, beta, state


def rel(a, b):
    return float(mx.abs(a - b).max() / (mx.abs(b).max() + 1e-12))


def main():
    worst = 0.0
    for B, T, H, Dk, Dv, C in [(2, 150, 3, 32, 24, 64), (1, 64, 2, 16, 16, 64), (2, 97, 2, 32, 32, 32), (1, 7, 2, 16, 8, 64), (2, 256, 4, 128, 128, 64)]:
        q, k, v, g, beta, state = rand_inputs(B, T, H, Dk, Dv, seed=T)
        for st in (state, None):
            y0, s0 = cd._naive_ops(q, k, v, g, beta, st, None)
            y1, s1 = cd.gated_delta_chunked(q, k, v, g, beta, st, None, chunk=C)
            ey, es = rel(y1, y0), rel(s1, s0)
            worst = max(worst, ey, es)
            print(f'B={B} T={T} H={H} Dk={Dk} Dv={Dv} 块长={C} 初始状态={"有" if st is not None else "无"}：输出相对误差 {ey:.2e}，状态相对误差 {es:.2e}')

    # 梯度：对 k、v、g、beta、初始状态分别求导，两种算法应该一致
    q, k, v, g, beta, state = rand_inputs(2, 100, 2, 32, 32, seed=5)
    w = mx.random.normal((2, 100, 2, 32))

    def loss(fn):
        def f(q, k, v, g, beta, state):
            y, s = fn(q, k, v, g, beta, state, None)
            return (y * w).sum() + (s * s).sum() * 0.01
        return f

    # 故意放几个极小的门控值（遗忘门）：第一版在这里对 g 的梯度差了几十万倍
    g = mx.where(mx.random.uniform(shape=g.shape) < 0.05, g * 1e-12, g)
    print(f'g 的最小值 {float(g.min()):.1e}')
    g0 = mx.grad(loss(cd._naive_ops), argnums=[0, 1, 2, 3, 4, 5])(q, k, v, g, beta, state)
    g1 = mx.grad(loss(cd.gated_delta_chunked), argnums=[0, 1, 2, 3, 4, 5])(q, k, v, g, beta, state)
    for name, a, b in zip(['q', 'k', 'v', 'g', 'beta', 'state'], g1, g0):
        e = rel(a, b)
        worst = max(worst, e)
        print(f'对 {name} 的梯度：相对误差 {e:.2e}')

    # 速度：模型里的实际大小（批 4、600 个 token、16 个头、128 维）
    q, k, v, g, beta, _ = rand_inputs(4, 600, 16, 128, 128, seed=9)
    w = mx.random.normal((4, 600, 16, 128))
    for name, fn in [('逐 token', cd._naive_ops), ('分块', cd.gated_delta_chunked)]:
        f = mx.grad(lambda k, v: (fn(q, k, v, g, beta, None, None)[0] * w).sum(), argnums=[0, 1])
        mx.eval(f(k, v))
        t0 = time.time()
        for _ in range(3):
            mx.eval(f(k, v))
        print(f'{name}：一层前向 + 反向 {(time.time() - t0) / 3:.3f} 秒')
    print('通过' if worst < 2e-3 else f'不一致（最大相对误差 {worst:.2e}）')


if __name__ == '__main__':
    main()
