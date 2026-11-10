#!/bin/sh
# 准备本地训练环境（只需运行一次）：Python 虚拟环境 + MLX、Qwen3.5 原始权重、llama.cpp 的 gguf-py。
#   sh train/setup.sh
set -eu
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
mkdir -p base llama.cpp
[ -x .venv/bin/python ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q mlx-lm
.venv/bin/python -c "import mlx_lm, mlx.core as mx; print('mlx-lm', mlx_lm.__version__, '/ mlx', mx.__version__)"
HF=.venv/bin/hf; [ -x "$HF" ] || HF=.venv/bin/huggingface-cli
for m in Qwen3.5-2B Qwen3.5-0.8B; do
  echo "下载 $m …"
  "$HF" download "Qwen/$m" --local-dir "base/$m" >/dev/null
done
# llama.cpp（与 App 里的 b12110 同一版本）的 gguf-py，用来读写 GGUF
REF=b12110
mkdir -p llama.cpp/gguf-py/gguf
curl -sf "https://api.github.com/repos/ggml-org/llama.cpp/contents/gguf-py/gguf?ref=$REF" |
  .venv/bin/python -c "import json,sys; [print(f['name'], f['download_url']) for f in json.load(sys.stdin) if f['type']=='file']" |
  while read -r name url; do curl -sf -o "llama.cpp/gguf-py/gguf/$name" "$url"; done
for f in convert_hf_to_gguf.py convert_lora_to_gguf.py; do
  curl -sf -o "llama.cpp/$f" "https://raw.githubusercontent.com/ggml-org/llama.cpp/$REF/$f"
done
du -sh base/* .venv llama.cpp
echo "准备完成"
