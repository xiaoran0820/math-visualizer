"""启动 mlx_lm 的 LoRA 训练，循环层换成分块并行算法（chunked_delta.py），其余和 `python -m mlx_lm lora` 完全一样。

    .venv/bin/python train_lora.py -c lora-2b.yaml
"""
import sys

import chunked_delta

chunked_delta.install()

from mlx_lm import lora  # noqa: E402

if __name__ == '__main__':
    sys.argv = ['mlx_lm.lora', *sys.argv[1:]]
    lora.main()
