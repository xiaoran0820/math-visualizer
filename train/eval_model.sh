#!/bin/sh
# 评测训练出的模型（Ollama 只在评测期间运行）。
#   sh train/eval_model.sh <名字（train/out/ 下的文件夹，必须带 shuxing，App 才会用短系统提示）> <dev|holdout|fresh> [轮数] [其他 eval.js 参数…]
# 例：sh train/eval_model.sh shuxing-2b-v1 dev 1
# 环境变量 BASE_OLLAMA：沿用哪个原模型的 Modelfile（对话模板、停止词），默认 qwen3.5:2b-q4_K_M；0.8B 用 qwen3.5:0.8b-q8_0。
# 名字也可以是 Ollama 里已有的模型（如 qwen3.5:2b-q4_K_M），这时直接评测原模型。
set -eu
T=$(cd "$(dirname "$0")" && pwd)
NAME=$1; SET=$2; RUNS=${3:-1}
shift 3 2>/dev/null || shift $#
BASE_OLLAMA=${BASE_OLLAMA:-qwen3.5:2b-q4_K_M}
O=/Applications/Ollama.app/Contents/Resources/ollama
STARTED=
if ! curl -s 127.0.0.1:11434/api/version >/dev/null; then
  OLLAMA_HOST=127.0.0.1:11434 "$O" serve > "$T/logs/ollama.log" 2>&1 &
  STARTED=$!
  trap 'kill $STARTED 2>/dev/null' EXIT
  for i in $(seq 60); do curl -s 127.0.0.1:11434/api/version >/dev/null && break; sleep 1; done
fi
if ! "$O" list | grep -q "^$NAME"; then
  { echo "FROM $T/out/$NAME/model.gguf"; "$O" show --modelfile "$BASE_OLLAMA" | grep -v "^#\|^FROM"; } > "$T/out/$NAME/Modelfile"
  "$O" create "$NAME" -f "$T/out/$NAME/Modelfile" 2>&1 | tail -1
fi
cd "$T/.."
node scripts/eval.js --models "$NAME" --pipelines best3 --set "$SET" --runs "$RUNS" --no-ocr "$@"
if [ -n "$STARTED" ]; then kill $STARTED; sleep 1; pgrep -fl "ollama serve" || echo "ollama stopped"; fi
