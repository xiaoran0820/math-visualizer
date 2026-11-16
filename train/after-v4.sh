#!/bin/sh
# 第四版：训练作图 LoRA，转换，评测（在 train/ 目录下运行；每一步结束在标准输出打一行，供进度提醒用）。
#   sh after-v4.sh > logs/after-v4.progress 2>&1
#   sh after-v4.sh --eval-only > logs/after-v4-eval.progress 2>&1   # 已经训练、转换好，只跑评测
# 1. 训练（logs/2b-v4.log）→ out/shuxing-2b-v4/（adapter.gguf + 合并后的 model.gguf）
# 2. Ollama 评测作图：开发集、新题型集、保留集；过去问第二组、第一组（题目文字都用手机引擎原 2B 的识别结果）
# 3. 手机引擎核对（开发集，第一次生成）
# 评测日志里有逐题结果；第二组测试集只看汇总（eval/exam/summarize.mjs --split test）。
set -u
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
say() { echo "$(date +%H:%M) $*"; }
row() { grep -E "^\| (qwen|shuxing)" "$1" | grep -v "字元/秒" | head -1; }
BASE=$T/../ios/iphone-install/models/qwen3.5-2b-q4_K_M
D=out/models-cli/qwen3.5-2b-v4

if [ "${1:-}" != "--eval-only" ]; then
say "开始训练作图（第四版）"
{ echo "开始 $(date +%T)"; .venv/bin/python train_lora.py -c lora-2b-v4.yaml; echo "训练结束，退出码 $?"; echo "结束 $(date +%T)"; } > logs/2b-v4.log 2>&1
grep -q "退出码 0" logs/2b-v4.log || { say "作图训练失败，停止"; exit 1; }
say "作图训练结束：验证损失 $(sed 's/\x1b\[[0-9;]*m//g' logs/2b-v4.log | awk '$2=="val"{printf "%s→", $3}')"
sh make_model.sh adapters/2b-v4 shuxing-2b-v4 > logs/make-2b-v4.log 2>&1 || { say "作图模型转换失败，见 logs/make-2b-v4.log"; exit 1; }
mkdir -p "$D"
ln -sf "$BASE/model.gguf" "$D/model.gguf"; ln -sf "$BASE/mmproj.gguf" "$D/mmproj.gguf"; ln -sf "$T/out/shuxing-2b-v4/adapter.gguf" "$D/adapter.gguf"
say "作图模型做好了：$(ls -la out/shuxing-2b-v4 | awk '/gguf/ {printf "%s %.0f MB  ", $NF, $5/1048576}')"
fi

# 评测前先确认显卡能用：2026-11-13 模拟器占满了全系统的显卡命令队列（约 2048 个），
# Ollama、手机引擎都加载不了模型，评测几秒钟就“跑完”、结果全空。建不了命令队列就停下。
.venv/bin/python -c "import mlx.core as mx; (mx.ones((2, 2)) @ mx.ones((2, 2))).tolist()" > /dev/null 2>&1 || {
  say "显卡建不了命令队列，停止（看是不是模拟器等程序占满了：ioreg -r -c AGXDeviceUserClient -l | grep CommandQueueCount）"; exit 1; }

for SET in dev fresh holdout; do
  sh eval_model.sh shuxing-2b-v4 $SET 2 > logs/eval-2b-v4-$SET.log 2>&1
  say "第四版 · $SET：$(row logs/eval-2b-v4-$SET.log)"
done
for SET in exam2 exam; do
  sh eval_model.sh shuxing-2b-v4 $SET 2 --ocr-model phone-base > logs/eval-2b-v4-$SET.log 2>&1
  say "第四版 · $SET（手机原模型识别）：$(row logs/eval-2b-v4-$SET.log)"
done

cd "$T/.."
node train/cli_eval.mjs train/out/models-cli qwen3.5-2b-v4 dev --lora > train/logs/cli-qwen3.5-2b-v4-dev.log 2>&1
say "手机引擎 · $(tail -1 train/logs/cli-qwen3.5-2b-v4-dev.log)"
cd "$T"
say "全部完成；残留进程：$(ps -axo comm | grep -ciE 'ollama|llm-cli') 个"
