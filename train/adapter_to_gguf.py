"""把 MLX 训练出的 LoRA（adapters.safetensors）转成 llama.cpp / Ollama 能加载的 GGUF LoRA 文件。

    .venv/bin/python adapter_to_gguf.py <adapter 目录> <原模型 model.gguf> <输出 adapter.gguf>

不需要 PyTorch：只用 llama.cpp 自带的 gguf-py（llama.cpp/gguf-py）。
原来的量化模型保持不动，推理时由 llama.cpp 把 LoRA 加在上面。

两边的约定：
  MLX：      y = x·Wᵀ + scale·(x·A)·B，A 形如 (输入, r)，B 形如 (r, 输出)
  llama.cpp：y = W·x + (alpha/r)·B'·(A'·x)，GGUF 里 A' 形如 (r, 输入)、B' 形如 (输出, r)（numpy 的行列顺序）
所以 A' = Aᵀ，B' = Bᵀ，alpha = scale·r。
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import mlx.core as mx

sys.path.insert(0, str(Path(__file__).parent / 'llama.cpp' / 'gguf-py'))
import gguf  # noqa: E402

# MLX 里的模块名 → GGUF 里的张量名（只收两边一一对应、没有重排的线性层；见 verify_mapping.py）
MODULES = {
    'mlp.gate_proj': 'ffn_gate',
    'mlp.up_proj': 'ffn_up',
    'mlp.down_proj': 'ffn_down',
    'self_attn.q_proj': 'attn_q',
    'self_attn.k_proj': 'attn_k',
    'self_attn.v_proj': 'attn_v',
    'self_attn.o_proj': 'attn_output',
    'linear_attn.in_proj_qkv': 'attn_qkv',
    'linear_attn.in_proj_z': 'attn_gate',
    'linear_attn.out_proj': 'ssm_out',
}


def main(adapter_dir, base_gguf, out_path):
    adapter_dir = Path(adapter_dir)
    cfg = json.loads((adapter_dir / 'adapter_config.json').read_text())
    # mlx-lm：lora_parameters 里有 rank、scale；mlx-vlm：rank、alpha（scale = alpha / rank）
    lp = cfg.get('lora_parameters', cfg)
    rank = int(lp['rank'])
    scale = float(lp['scale']) if 'scale' in lp else float(lp['alpha']) / rank
    files = sorted(adapter_dir.glob('adapters.safetensors')) or sorted(adapter_dir.glob('*.safetensors'))
    weights = mx.load(str(files[0]))

    reader = gguf.GGUFReader(base_gguf)
    arch = reader.fields['general.architecture'].contents()
    base = {t.name: [int(x) for x in t.shape] for t in reader.tensors}  # GGUF 的 ne：[输入, 输出]

    writer = gguf.GGUFWriter(out_path, arch)
    writer.add_type(gguf.GGUFType.ADAPTER)
    writer.add_string(gguf.Keys.Adapter.TYPE, 'lora')
    writer.add_float32(gguf.Keys.Adapter.LORA_ALPHA, scale * rank)

    count = 0
    for key in sorted(weights):
        # mlx-lm 的名字是 ….lora_a / ….lora_b，mlx-vlm 是 ….A / ….B；两者的形状都是 A: (输入, r)、B: (r, 输出)
        m = re.match(r'(?:language_model\.)?model\.layers\.(\d+)\.(.+)\.(?:lora_([ab])|([AB]))$', key)
        if not m:
            raise SystemExit(f'看不懂的 LoRA 权重名：{key}')
        layer, module, ab = m.group(1), m.group(2), (m.group(3) or m.group(4).lower())
        if module not in MODULES:
            raise SystemExit(f'{module} 没有对应的 GGUF 张量（训练时只能用 MODULES 里的层）')
        name = f'blk.{layer}.{MODULES[module]}.weight'
        if name not in base:
            raise SystemExit(f'原模型里没有 {name}')
        n_in, n_out = base[name]
        arr = np.array(weights[key].astype(mx.float32)).T.copy()  # A: (r, 输入)；B: (输出, r)
        want = (rank, n_in) if ab == 'a' else (n_out, rank)
        if arr.shape != want:
            raise SystemExit(f'{key} 的形状 {arr.shape} 和原模型 {name} 对不上（应为 {want}）')
        writer.add_tensor(f'{name}.lora_{ab}', arr.astype(np.float16))
        count += 1

    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()
    print(f'{count} 个张量，rank {rank}，alpha {scale * rank:g} → {out_path}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
