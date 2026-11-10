#!/bin/sh
# 编译并运行 Mac 版的引擎测试工具（与手机 App 共用 LlamaEngine.swift）。
#   SHUXING_MODELS_DIR=<目录，里面是 <模型名>/model.gguf> sh run.sh request.json
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
FW="$HERE/../ios/Frameworks/llama.xcframework/macos-arm64_x86_64"
OUT="$HERE/build"
mkdir -p "$OUT"
if [ ! -x "$OUT/llm-cli" ] || [ "$HERE/main.swift" -nt "$OUT/llm-cli" ] || [ "$HERE/../ios/Sources/LocalModelPlugin/LlamaEngine.swift" -nt "$OUT/llm-cli" ]; then
  xcrun swiftc -O -o "$OUT/llm-cli" -F "$FW" -framework llama -Xlinker -rpath -Xlinker "$FW" \
    "$HERE/main.swift" "$HERE/../ios/Sources/LocalModelPlugin/LlamaEngine.swift"
fi
exec "$OUT/llm-cli" "$@"
