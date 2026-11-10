"""核对：Hugging Face 原始权重里的线性层，和 GGUF 量化模型里对应的张量是不是一一对应（没有重排）。
LoRA 只能加在一一对应的层上，否则转成 GGUF 后会加错位置。

    .venv/bin/python verify_mapping.py base/Qwen3.5-2B <model.gguf>
"""
import sys
from pathlib import Path

import numpy as np
import mlx.core as mx

sys.path.insert(0, str(Path(__file__).parent / 'llama.cpp' / 'gguf-py'))
import gguf  # noqa: E402
from adapter_to_gguf import MODULES  # noqa: E402


def main(hf_dir, gguf_path):
    hf = {}
    for f in sorted(Path(hf_dir).glob('*.safetensors')):
        hf.update(mx.load(str(f)))
    reader = gguf.GGUFReader(gguf_path)
    tensors = {t.name: t for t in reader.tensors}
    ok = True
    for layer in (0, 3, 13, 23):
        for module, gname in MODULES.items():
            key = f'model.language_model.layers.{layer}.{module}.weight'
            name = f'blk.{layer}.{gname}.weight'
            if key not in hf or name not in tensors:
                continue
            w = np.array(hf[key].astype(mx.float32))  # (输出, 输入)
            t = tensors[name]
            q = gguf.quants.dequantize(t.data, t.tensor_type).reshape(w.shape)
            corr = float(np.corrcoef(w.ravel(), q.ravel())[0, 1])
            rel = float(np.abs(w - q).mean() / (np.abs(w).mean() + 1e-12))
            good = corr > 0.98
            ok &= good
            print(f'{"✓" if good else "✗"} 第 {layer:2d} 层 {module:22s} ↔ {name:28s} 相关系数 {corr:.4f}，平均相对误差 {rel:.3f}（{t.tensor_type.name}）')
    print('全部一一对应' if ok else '有对不上的层：不要在这些层上训练 LoRA')


if __name__ == '__main__':
    main(*sys.argv[1:3])
