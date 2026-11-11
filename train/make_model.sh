#!/bin/sh
# 把训练出的 LoRA 做成可以用的模型文件。
#   sh train/make_model.sh <adapter 目录> <名字> [中间版本的步数，如 260]
# 环境变量 BASE_GGUF：原来的量化模型（默认是手机上用的 2B，与 Ollama 的 qwen3.5:2b-q4_K_M 是同一个文件）；QUANT：q4_K_M（默认）或 q8_0
# 产物（train/out/<名字>/）：
#   adapter.gguf   手机上用：放进模型文件夹，加在原模型上（约 30 MB）
#   model.gguf     合并后重新量化的完整模型（Ollama 评测用；Ollama 0.40 起不能直接加载 LoRA）
set -eu
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
SRC=$1; NAME=$2; STEP=${3:-}
BASE_GGUF=${BASE_GGUF:-$T/../ios/iphone-install/models/qwen3.5-2b-q4_K_M/model.gguf}
OUT=out/$NAME
mkdir -p "$OUT"
AD=$SRC
if [ -n "$STEP" ]; then
  AD=$OUT/adapter-src
  mkdir -p "$AD"
  cp "$SRC/adapter_config.json" "$AD/"
  cp "$SRC/$(printf '%07d' "$STEP")_adapters.safetensors" "$AD/adapters.safetensors"
fi
.venv/bin/python adapter_to_gguf.py "$AD" "$BASE_GGUF" "$OUT/adapter.gguf" 2>&1 | grep -v "PyTorch was not found"
.venv/bin/python merge_lora.py "$AD" "$BASE_GGUF" "$OUT/merged.gguf" 2>&1 | grep -v "PyTorch was not found"
sh ../native/local-model/tools/quantize.sh "$OUT/merged.gguf" "$OUT/model.gguf" "${QUANT:-q4_K_M}" 2>&1 | grep -E "量化|失败" || true
rm -f "$OUT/merged.gguf"
rm -rf "$OUT/adapter-src"
ls -la "$OUT"
