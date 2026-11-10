# iPhone App（模型在手机上运行）

结构：Capacitor 把网页（`dist/`）装进 iOS App；原生插件 `native/local-model` 用 llama.cpp 在手机上运行 Qwen3.5 小模型，接口见 [docs/ios-plugin.md](../docs/ios-plugin.md)。网页里的识别、分析、核对题目条件、作图全部原样复用。

```
native/local-model/
  package.json          npm 包 @shuxing/local-model（Capacitor 插件）
  Package.swift         Swift 包 ShuxingLocalModel：插件代码 + llama.xcframework
  fetch-llama.sh        下载 llama.cpp 官方 iOS 框架并生成模拟器副本
  ios/Sources/LocalModelPlugin/
    LocalModelPlugin.swift   Capacitor 插件：status / generate / cancel / token 事件
    LlamaEngine.swift        加载模型、提示格式、采样（含输出格式语法）、看图、逐字输出
ios/App/                Xcode 工程（npx cap add ios 生成，Swift Package Manager）
```

## 第一次准备

```bash
npm install
```

```bash
sh native/local-model/fetch-llama.sh
```

```bash
npm run build:mobile && npx cap sync ios
```

## 模型文件放在哪里

App 在“文稿”目录里找 `models/<模型名>/model.gguf`（文字模型）和同一文件夹里的 `mmproj.gguf`（看图用，没有就只能输入文字）。可以直接用 Ollama 已经下载的文件（`~/.ollama/models/manifests/registry.ollama.ai/library/qwen3.5/2b-q4_K_M` 里的 model 层和 projector 层）。

- **模拟器**：复制到 `xcrun simctl get_app_container <设备> com.shuxing.mathviz data` 下的 `Documents/models/qwen3.5-2b-q4_K_M/`（用 `cp -c` 不占额外空间）。
- **真机**：用数据线连接后，`xcrun devicectl device copy to --device <设备> --domain-type appDataContainer --domain-identifier com.shuxing.mathviz --source <文件> --destination Documents/models/qwen3.5-2b-q4_K_M/model.gguf`；也可以在 Finder 里选中 iPhone →“文件”→ 数形，把文件夹拖进去。

## 运行

模拟器（模型用 CPU 运行，比真机慢很多，只用来验证流程）：

```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath ../build build
```

真机（需要在 Xcode 里登录 Apple ID；免费账号签名的 App 7 天后要重新安装）：

```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -derivedDataPath ../build -allowProvisioningUpdates DEVELOPMENT_TEAM=<你的 Team ID> build
```

也可以直接 `npx cap open ios`，在 Xcode 里选择设备后点运行。

## 在 Mac 上测试引擎

`tools/` 把同一份 `LlamaEngine.swift` 编译成 Mac 命令行工具（用 llama.cpp 的 macOS 版本、Metal），调试提示格式、思考、语法约束和速度时不用每次装到手机上：

```bash
cd native/local-model/tools && node make-request.mjs solve "已知二次函数 y = x² - 2x - 3，求它与 x 轴的交点坐标和顶点坐标。" > /tmp/req.json
```

```bash
cd native/local-model/tools && SHUXING_MODELS_DIR=../../../ios/iphone-install/models sh run.sh /tmp/req.json
```

## 说明

- 提示格式和采样参数与 Ollama 里这个模型的默认值一致（ChatML，不思考时写入空的 `<think></think>`；top_k 20、top_p 0.95），电脑上的评测结果可以代表手机上的效果。
- 输出格式用 GBNF 语法约束（由 `public/lib/gbnf.js` 从 JSON Schema 生成）：先不加语法抽样，不符合再加上语法重抽，省掉大部分语法计算。
- 真机用 Metal（GPU）；模拟器的 Metal 功能不全，用 CPU。
