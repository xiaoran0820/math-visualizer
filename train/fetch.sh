#!/bin/sh
# 下载 Qwen3.5 原始权重（可续传；连接卡住 60 秒就断开重试），以及 llama.cpp b12110 的 gguf-py。
#   sh train/fetch.sh
set -u
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
get() { # 文件 URL：续传，最多重试 30 次
  for i in $(seq 30); do
    curl -sfL -C - --retry 3 --retry-delay 3 --speed-limit 20000 --speed-time 60 -o "$1" "$2" && return 0
    echo "  重试 $i：$(basename "$1")（已下载 $(stat -f %z "$1" 2>/dev/null || echo 0) 字节）"
    sleep 3
  done
  return 1
}
for m in Qwen3.5-2B Qwen3.5-0.8B; do
  mkdir -p "base/$m"
  # 之前 hf 下载到一半的文件接着用
  inc=$(ls "base/$m/.cache/huggingface/download/"*.incomplete 2>/dev/null | head -1)
  curl -sf "https://huggingface.co/api/models/Qwen/$m/tree/main" | .venv/bin/python -c "import json,sys; [print(f['path'], f.get('size', 0)) for f in json.load(sys.stdin) if f['type'] == 'file']" |
  while read -r name size; do
    out="base/$m/$name"
    [ -f "$out" ] && [ "$(stat -f %z "$out")" = "$size" ] && continue
    case "$name" in *.safetensors) [ -n "$inc" ] && [ ! -f "$out" ] && mv "$inc" "$out" ;; esac
    echo "下载 $m/$name（$size 字节）"
    get "$out" "https://huggingface.co/Qwen/$m/resolve/main/$name" || { echo "失败：$name"; exit 1; }
  done
done
REF=b12110
mkdir -p llama.cpp/gguf-py/gguf
curl -sf "https://api.github.com/repos/ggml-org/llama.cpp/contents/gguf-py/gguf?ref=$REF" |
  .venv/bin/python -c "import json,sys; [print(f['name'], f['download_url']) for f in json.load(sys.stdin) if f['type']=='file']" |
  while read -r name url; do curl -sf -o "llama.cpp/gguf-py/gguf/$name" "$url"; done
for f in convert_hf_to_gguf.py convert_lora_to_gguf.py; do curl -sf -o "llama.cpp/$f" "https://raw.githubusercontent.com/ggml-org/llama.cpp/$REF/$f"; done
du -sh base/* llama.cpp
echo "下载完成"
