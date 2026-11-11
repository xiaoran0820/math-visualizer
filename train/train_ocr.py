"""训练“看图识别”的 LoRA：先把 mlx_vlm 里 Qwen3.5 循环层的分块算法换成核对过的版本（chunked_delta.install_vlm），
图片处理器换成不依赖 PyTorch 的版本（vlm_processor.install），再调用 mlx_vlm 的训练入口。用法和 python -m mlx_vlm.train 相同：
    .venv/bin/python train_ocr.py -c lora-ocr.yaml
"""
import sys

import chunked_delta
import vlm_processor

chunked_delta.install_vlm()
vlm_processor.install()  # 没装 PyTorch：图片处理器换成不依赖 PyTorch 的版本

from mlx_vlm.train import main  # noqa: E402

sys.exit(main())
