#!/bin/sh
# 第三版：识别训练结束后的全部步骤（在 train/ 目录下运行；每一步结束在标准输出打一行，供进度提醒用）。
#   1. 识别 LoRA → out/ocr-v1/adapter-ocr.gguf，评测识别（手机引擎；原模型和第三版，生成的评测图 150 张、过去问 73 题）
#   2. 训练作图 LoRA（第三版），转成 out/shuxing-2b-v3/（adapter.gguf + 合并后的 model.gguf）
#   3. Ollama 评测作图：开发集、新题型集、保留题、过去问集（用原 2B 的识别结果；再用第三版的识别结果跑一遍完整流程）
#   4. 手机引擎核对作图 LoRA（开发集，第一次生成）
#   5. 用现在的代码补跑原 2B 的过去问集（之前那一轮是修复“日文立体题”之前跑的）
# 识别评测放在作图训练之前：作图训练的那一个小时里，可以逐题核对识别结果。
set -u
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
say() { echo "$(date +%H:%M) $*"; }
row() { grep -E "^\| (qwen|shuxing)" "$1" | grep -v "字元/秒" | head -1; }
BASE=$T/../ios/iphone-install/models/qwen3.5-2b-q4_K_M
D=out/models-cli/qwen3.5-2b-v3

until grep -q "训练结束" logs/ocr-v1.log 2>/dev/null; do sleep 20; done
grep -q "退出码 0" logs/ocr-v1.log || { say "识别训练失败，停止"; exit 1; }
say "识别训练结束"
mkdir -p out/ocr-v1 "$D"
.venv/bin/python adapter_to_gguf.py adapters/ocr-v1 "$BASE/model.gguf" out/ocr-v1/adapter-ocr.gguf > logs/make-ocr-v1.log 2>&1 || { say "识别 LoRA 转换失败，见 logs/make-ocr-v1.log"; exit 1; }
ln -sf "$BASE/model.gguf" "$D/model.gguf"; ln -sf "$BASE/mmproj.gguf" "$D/mmproj.gguf"; ln -sf "$T/out/ocr-v1/adapter-ocr.gguf" "$D/adapter-ocr.gguf"
say "识别 LoRA：$(tail -1 logs/make-ocr-v1.log)"

cd "$T/.."
node train/ocr/eval_ocr.mjs train/out/models-cli qwen3.5-2b test --name phone-base > train/logs/ocr-eval-base-test.log 2>&1; say "$(tail -1 train/logs/ocr-eval-base-test.log)"
node train/ocr/eval_ocr.mjs train/out/models-cli qwen3.5-2b-v3 test --lora --name shuxing-ocr-v1 > train/logs/ocr-eval-v1-test.log 2>&1; say "$(tail -1 train/logs/ocr-eval-v1-test.log)"
node train/ocr/eval_ocr.mjs train/out/models-cli qwen3.5-2b exam --name phone-base > train/logs/ocr-eval-base-exam.log 2>&1; say "$(tail -1 train/logs/ocr-eval-base-exam.log)"
node train/ocr/eval_ocr.mjs train/out/models-cli qwen3.5-2b-v3 exam --lora --name shuxing-ocr-v1 > train/logs/ocr-eval-v1-exam.log 2>&1; say "$(tail -1 train/logs/ocr-eval-v1-exam.log)"
cd "$T"

say "开始训练作图（第三版）"
{ echo "开始 $(date +%T)"; caffeinate -i .venv/bin/python train_lora.py -c lora-2b-v3.yaml; echo "训练结束，退出码 $?"; echo "结束 $(date +%T)"; } > logs/2b-v3.log 2>&1
grep -q "退出码 0" logs/2b-v3.log || { say "作图训练失败，停止"; exit 1; }
say "作图训练结束：验证损失 $(sed 's/\x1b\[[0-9;]*m//g' logs/2b-v3.log | awk '$2=="val"{printf "%s→", $3}')"
sh make_model.sh adapters/2b-v3 shuxing-2b-v3 > logs/make-2b-v3.log 2>&1 || { say "作图模型转换失败，见 logs/make-2b-v3.log"; exit 1; }
ln -sf "$T/out/shuxing-2b-v3/adapter.gguf" "$D/adapter.gguf"
say "作图模型做好了：$(ls -la out/shuxing-2b-v3 | awk '/gguf/ {printf "%s %.0f MB  ", $NF, $5/1048576}')"

for SET in dev fresh holdout exam; do
  sh eval_model.sh shuxing-2b-v3 $SET 2 > logs/eval-2b-v3-$SET.log 2>&1
  say "第三版作图 · $SET：$(row logs/eval-2b-v3-$SET.log)"
done
sh eval_model.sh shuxing-2b-v3 exam 2 --ocr-model shuxing-ocr-v1 > logs/eval-2b-v3-exam-ocrv1.log 2>&1
say "第三版完整流程 · 过去问集（第三版识别）：$(row logs/eval-2b-v3-exam-ocrv1.log)"

cd "$T/.."
node train/cli_eval.mjs train/out/models-cli qwen3.5-2b-v3 dev --lora > train/logs/cli-qwen3.5-2b-v3-dev.log 2>&1
say "手机引擎 · $(tail -1 train/logs/cli-qwen3.5-2b-v3-dev.log)"
cd "$T"

sh eval_model.sh qwen3.5:2b-q4_K_M exam 2 > logs/eval-base-exam-newcode.log 2>&1
say "原 2B · 过去问集（现在的代码）：$(row logs/eval-base-exam-newcode.log)"
say "全部完成；残留进程：$(ps -axo comm | grep -ciE 'ollama|llm-cli') 个"
