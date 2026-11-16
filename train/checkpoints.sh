#!/bin/sh
# 中间版本评测：训练时每隔一段存下的 LoRA，逐个做成模型并评测，看训练到第几步就够了
# （在 train/ 目录下运行；每一步结束在标准输出打一行，供进度提醒用）。
#   sh checkpoints.sh <adapter 目录> <名字> "<步数…>" [题集…] > logs/<名字>-steps.progress 2>&1
# 例：sh checkpoints.sh adapters/2b-v3 shuxing-2b-v3 "195 390 585" exam2-dev dev
# - 每个步数做成 out/<名字>-s<步数>/（已经做好的跳过）。训练结束时的版本（out/<名字>/）也用现在的代码重跑一遍：
#   代码改过以后，旧的成绩不能直接拿来比。
# - 题集默认 exam2-dev。只用开发集：要根据结果决定以后训练多少步，用保留集、新题型集、测试集来定，就等于在它们上面调参数。
# - 过去问的题目文字用手机引擎原 2B 的识别结果（--ocr-model phone-base）；best3 流程，各跑 2 轮。
set -u
T=$(cd "$(dirname "$0")" && pwd)
cd "$T"
SRC=$1; NAME=$2; STEPS=$3; shift 3
SETS=${*:-exam2-dev}
say() { echo "$(date +%H:%M) $*"; }
row() { grep -E "^\| (qwen|shuxing)" "$1" | grep -v "字元/秒" | head -1; }

# 评测前先确认显卡能用（2026-11-13 模拟器占满过全系统的显卡命令队列，评测几秒钟就“跑完”、结果全空）
.venv/bin/python -c "import mlx.core as mx; (mx.ones((2, 2)) @ mx.ones((2, 2))).tolist()" > /dev/null 2>&1 || {
  say "显卡建不了命令队列，停止（看是不是模拟器等程序占满了：ioreg -r -c AGXDeviceUserClient -l | grep CommandQueueCount）"; exit 1; }

MODELS=
for S in $STEPS; do
  M=$NAME-s$S
  if [ ! -s "out/$M/model.gguf" ]; then
    sh make_model.sh "$SRC" "$M" "$S" > "logs/make-$M.log" 2>&1
    [ -s "out/$M/model.gguf" ] && [ -s "out/$M/adapter.gguf" ] || { say "$M 转换失败，见 logs/make-$M.log"; exit 1; }
    say "$M 做好了：$(ls -la "out/$M" | awk '/gguf/ {printf "%s %.0f MB  ", $NF, $5/1048576}')"
  fi
  MODELS="$MODELS $M"
done
MODELS="$MODELS $NAME"

for SET in $SETS; do
  OCR=; case $SET in exam*) OCR="--ocr-model phone-base";; esac
  for M in $MODELS; do
    sh eval_model.sh "$M" "$SET" 2 $OCR > "logs/steps-$M-$SET.log" 2>&1
    say "$M · $SET：$(row "logs/steps-$M-$SET.log")"
  done
done
say "全部完成；残留进程：$(ps -axo comm | grep -ciE 'ollama|llm-cli') 个"
