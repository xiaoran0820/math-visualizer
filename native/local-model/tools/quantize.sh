#!/bin/sh
# 编译并运行量化工具（与 App 共用 llama.xcframework 的 macOS 版本）
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
FW="$HERE/../ios/Frameworks/llama.xcframework/macos-arm64_x86_64"
OUT="$HERE/build"
mkdir -p "$OUT"
if [ ! -x "$OUT/quantize" ] || [ "$HERE/quantize.swift" -nt "$OUT/quantize" ]; then
  xcrun swiftc -O -o "$OUT/quantize" -F "$FW" -framework llama -Xlinker -rpath -Xlinker "$FW" "$HERE/quantize.swift"
fi
exec "$OUT/quantize" "$@"
