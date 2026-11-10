#!/bin/sh
# 下载 llama.cpp 官方 iOS 框架（v0.9.0 = b12110），校验 SHA-256，并生成模拟器用的副本。
# 官方框架只有真机（ios-arm64）版本；Apple 芯片的 Mac 上模拟器也是 arm64，
# 所以把真机版本复制一份、用 vtool 改成“模拟器平台”，再和真机版本合成一个 xcframework。
#
#   sh native/local-model/fetch-llama.sh
set -eu
TAG=b12110
SHA=fca702506b04cba11c7f1226056371d16ddfa80e1248da979166a1eec36c415f
HERE=$(cd "$(dirname "$0")" && pwd)
DEST="$HERE/ios/Frameworks"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "下载 llama-$TAG-xcframework.zip（约 75 MB）…"
curl -fsSL -o "$WORK/llama.zip" "https://github.com/ggml-org/llama.cpp/releases/download/$TAG/llama-$TAG-xcframework.zip"
echo "$SHA  $WORK/llama.zip" | shasum -a 256 -c -
(cd "$WORK" && unzip -q llama.zip)
SRC="$WORK/build-apple/llama.xcframework/ios-arm64/llama.framework"

mkdir -p "$WORK/ios" "$WORK/sim"
cp -R "$SRC" "$WORK/ios/"
cp -R "$SRC" "$WORK/sim/"
SIM="$WORK/sim/llama.framework"
xcrun vtool -arch arm64 -set-build-version iossim 16.4 "$(xcrun --sdk iphonesimulator --show-sdk-version)" -replace -output "$SIM/llama.tmp" "$SIM/llama"
mv "$SIM/llama.tmp" "$SIM/llama"
plutil -replace CFBundleSupportedPlatforms -json '["iPhoneSimulator"]' "$SIM/Info.plist"
plutil -replace DTPlatformName -string iphonesimulator "$SIM/Info.plist"
rm -rf "$SIM/_CodeSignature"
codesign -f -s - "$SIM"

mkdir -p "$DEST"
rm -rf "$DEST/llama.xcframework"
# 另外保留官方的 macOS 版本：tools/ 里的命令行工具用它在 Mac 上直接测试同一份引擎代码
xcodebuild -create-xcframework -framework "$WORK/ios/llama.framework" -framework "$SIM" \
  -framework "$WORK/build-apple/llama.xcframework/macos-arm64_x86_64/llama.framework" -output "$DEST/llama.xcframework"
echo "完成：$DEST/llama.xcframework（真机 + 模拟器 + macOS）"
