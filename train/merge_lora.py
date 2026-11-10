"""把 MLX 训练出的 LoRA 合并进原来的 GGUF 模型（之后用 quantize 量化成 Q4_K_M）。

    .venv/bin/python merge_lora.py <adapter 目录> <原模型 model.gguf> <输出 merged.gguf>

为什么要合并：Ollama 0.40 起不再支持加载 LoRA（"LoRA adapters are no longer supported"），
评测又要通过 Ollama；合并成普通的模型文件后，Ollama 和手机上的引擎都能直接用。
不需要 PyTorch：只用 llama.cpp 自带的 gguf-py 和 numpy。

做法：有 LoRA 的张量先还原成浮点数（dequantize），加上 LoRA 的增量，存成 F32；
其余张量（包括量化过的）逐字节照抄。量化时 llama.cpp 只量化这些 F32 张量，类型已经对的张量原样保留——
第一次试的时候把全部张量都还原成 F16 再量化，没加 LoRA 的张量也被“还原再量化”，数值有微小变化，输出就和原模型不一样了。
元数据（分词表、对话模板、超参数）全部原样复制。
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import mlx.core as mx

sys.path.insert(0, str(Path(__file__).parent / 'llama.cpp' / 'gguf-py'))
import gguf  # noqa: E402
from gguf import GGUFValueType, GGMLQuantizationType  # noqa: E402
from adapter_to_gguf import MODULES  # noqa: E402

FLOAT_TYPES = {GGMLQuantizationType.F32, GGMLQuantizationType.F16, GGMLQuantizationType.BF16}


def lora_deltas(adapter_dir):
    """{GGUF 张量名: (out, in) 的增量}；MLX：y = x·Wᵀ + scale·(x·A)·B，所以 ΔW = scale·(A·B)ᵀ"""
    adapter_dir = Path(adapter_dir)
    lp = json.loads((adapter_dir / 'adapter_config.json').read_text())['lora_parameters']
    scale = float(lp['scale'])
    w = mx.load(str(adapter_dir / 'adapters.safetensors'))
    pairs = {}
    for key, val in w.items():
        m = re.match(r'(?:language_model\.)?model\.layers\.(\d+)\.(.+)\.lora_([ab])$', key)
        if not m:
            raise SystemExit(f'看不懂的 LoRA 权重名：{key}')
        layer, module, ab = m.groups()
        name = f'blk.{layer}.{MODULES[module]}.weight'
        pairs.setdefault(name, {})[ab] = np.array(val.astype(mx.float32))
    return {name: (scale * (p['a'] @ p['b'])).T for name, p in pairs.items()}


def copy_metadata(reader, writer):
    for key, field in reader.fields.items():
        if key.startswith('GGUF.') or key == gguf.Keys.General.ARCHITECTURE:
            continue
        vtype = field.types[0]
        if vtype == GGUFValueType.ARRAY:
            sub = field.types[-1]
            writer.add_key_value(key, field.contents(), vtype, sub_type=sub)
        else:
            writer.add_key_value(key, field.contents(), vtype)


def main(adapter_dir, base_gguf, out_path):
    deltas = lora_deltas(adapter_dir)
    reader = gguf.GGUFReader(base_gguf)
    arch = reader.fields[gguf.Keys.General.ARCHITECTURE].contents()
    writer = gguf.GGUFWriter(out_path, arch)
    copy_metadata(reader, writer)
    merged = 0
    for t in reader.tensors:
        shape = [int(x) for x in reversed(t.shape)]  # numpy 顺序：(输出, 输入)
        if t.name not in deltas:
            if t.tensor_type in FLOAT_TYPES:
                writer.add_tensor(t.name, np.array(t.data).reshape(shape), raw_dtype=t.tensor_type)
            else:
                writer.add_tensor(t.name, np.array(t.data), raw_dtype=t.tensor_type)  # 量化数据逐字节照抄
            continue
        arr = gguf.quants.dequantize(t.data, t.tensor_type).reshape(shape).astype(np.float32)
        d = deltas.pop(t.name)
        if d.shape != arr.shape:
            raise SystemExit(f'{t.name}：LoRA 增量形状 {d.shape} 和原张量 {arr.shape} 对不上')
        writer.add_tensor(t.name, arr + d)
        merged += 1
    if deltas:
        raise SystemExit(f'这些 LoRA 在原模型里找不到对应的张量：{list(deltas)[:5]}')
    writer.write_header_to_file()
    writer.write_kv_data_to_file()
    writer.write_tensors_to_file()
    writer.close()
    print(f'合并了 {merged} 个张量 → {out_path}')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
