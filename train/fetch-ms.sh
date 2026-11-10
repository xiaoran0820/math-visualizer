#!/bin/sh
# 从 ModelScope（通义千问的官方发布平台）下载 Qwen3.5 原始权重：可续传，卡住 60 秒自动重连；
# 下完用 ModelScope 和 Hugging Face 两边公布的 SHA-256 校验（两边是同一份文件）。
#   sh train/fetch-ms.sh
set -u
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
get() {
  for i in $(seq 40); do
    curl -sfL -C - --retry 3 --retry-delay 3 --speed-limit 20000 --speed-time 60 -o "$1" "$2" && return 0
    echo "  重试 $i：$(basename "$1")（已下载 $(stat -f %z "$1" 2>/dev/null || echo 0) 字节）"
    sleep 3
  done
  return 1
}
for m in Qwen3.5-2B Qwen3.5-0.8B; do
  mkdir -p "base/$m"
  curl -sf "https://modelscope.cn/api/v1/models/Qwen/$m/repo/files?Revision=master&Recursive=true" |
    .venv/bin/python -c "import json,sys; [print(f['Path'], f['Size'], f.get('Sha256') or '-') for f in json.load(sys.stdin)['Data']['Files'] if f.get('Type') != 'tree']" > "base/$m.files"
  while read -r name size sha; do
    out="base/$m/$name"
    mkdir -p "$(dirname "$out")"
    [ -f "$out" ] && [ "$(stat -f %z "$out")" = "$size" ] && continue
    # 已经从 Hugging Face 下好的小文件（说明、配置、分词表）保留；只有权重文件需要续传
    case "$name" in *.safetensors) ;; *) [ -f "$out" ] && continue ;; esac
    echo "下载 $m/$name（$size 字节，已有 $(stat -f %z "$out" 2>/dev/null || echo 0)）"
    get "$out" "https://modelscope.cn/models/Qwen/$m/resolve/master/$name" || { echo "失败：$name"; exit 1; }
  done < "base/$m.files"
  # 校验大文件
  while read -r name size sha; do
    case "$name" in *.safetensors) ;; *) continue ;; esac
    got=$(shasum -a 256 "base/$m/$name" | cut -d' ' -f1)
    hf=$(curl -sf --max-time 30 "https://huggingface.co/api/models/Qwen/$m/tree/main" | .venv/bin/python -c "import json,sys; print(next(((f.get('lfs') or {}).get('oid', '-') for f in json.load(sys.stdin) if f['path'] == '$name'), '-'))" 2>/dev/null || echo "-")
    [ "$got" = "$sha" ] && echo "✓ $m/$name 与 ModelScope 的 SHA-256 一致" || echo "✗ $m/$name 与 ModelScope 的 SHA-256 不一致（$got）"
    [ "$hf" = "-" ] && echo "  （没能读取 Hugging Face 的 SHA-256）" || { [ "$got" = "$hf" ] && echo "✓ $m/$name 与 Hugging Face 的 SHA-256 一致" || echo "✗ 与 Hugging Face 的 SHA-256 不一致"; }
  done < "base/$m.files"
done
du -sh base/*
echo "下载完成"
