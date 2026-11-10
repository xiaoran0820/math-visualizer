# 移动端移植准备

## 已经完成的准备

| 方面 | 现状 |
|---|---|
| 前后端分离 | `public/` 是纯静态前端（没有构建步骤）。所有请求都经过 `public/lib/api.js`，服务地址可以在页面的“设置”里修改 |
| 接口协议 | 见 [api.md](api.md)：一个健康检查接口和四个 NDJSON 流式接口。原生客户端照着实现即可 |
| 跨域 | 服务端支持 `CORS_ORIGINS` 白名单，默认不开放 |
| 作图引擎 | `expr.js`、`geom.js`、`scene.js`、`repair.js`、`runs.js` 不依赖浏览器 DOM（测试都在 Node 里运行），可以在任何 JavaScript 环境里复用 |
| PWA | `manifest.webmanifest`、各尺寸图标、Service Worker（断网时仍能打开页面和示例题）、iOS 主屏标签 |
| 触屏适配 | 刘海屏安全区、触屏下按钮至少 40px、输入框 16px（避免 iOS 自动放大页面）；平面图在空白处可以滚动页面、按在点上拖动；立体图支持双指缩放 |
| 打包 | `npm run build:mobile` 生成 `dist/`：前端文件 + KaTeX + JSXGraph，可以直接作为 App 的网页目录 |
| 调试 | `npm run mock` 启动模拟模型，不装 Ollama 也能把手机上的完整流程走一遍 |

## 先要决定：模型在哪里运行

| 方案 | 做法 | 优点 | 代价 |
|---|---|---|---|
| A. 手机连电脑 | 电脑运行 Ollama + `npm run lan`，手机上的网页或 App 连接电脑 | 不用改代码；模型大小不受手机限制 | 手机要和电脑在同一个 Wi-Fi，电脑要开着 |
| **B. 手机本地运行模型（已选定）** | App 内嵌 llama.cpp / MLC LLM 等推理库，运行 0.8B～2B 的视觉模型 | 完全离线，真正“本机” | 需要原生开发；安装包或首次下载增加 1～3 GB；小模型作图更容易出错；发热、耗电 |
| C. 自己的服务器 | 把本项目部署到家里或学校的服务器 | 随时随地可用 | 需要服务器和 HTTPS；数据会离开手机，需要向用户说明 |

选定的是方案 B（iPhone 本地运行），方案 A 保留为备用：手机端的“设置”里仍然可以填写电脑上服务的地址。

## 已确定的方向：iPhone，模型在手机上运行（方案 B）

整体结构：Capacitor 把网页装进 iOS App；一个 Swift 原生插件用 llama.cpp（Metal 加速）在手机上运行小尺寸视觉模型；网页里新增一个“本机模型”客户端，提供和服务端完全相同的 `recognize / analyze / repair / solve` 接口，界面、作图引擎、自动修正的判定都不用改。

```
WKWebView（dist/ 里的网页）
  ├─ lib/api.js            连电脑上的服务（原有）
  └─ lib/api-device.js     本机模型客户端（新增）
        │  提示词：lib/prompts.js（与服务端共用一份）
        │  输出格式约束：lib/gbnf.js 把 JSON Schema 转成 llama.cpp 的 GBNF 语法
        ▼
LocalModel 插件（Swift） → llama.xcframework（Metal）→ Qwen3.5 小模型（GGUF + 视觉投影 mmproj）
```

已经完成的部分：
- 提示词移到 `public/lib/prompts.js`，服务端和手机端共用。
- `public/lib/gbnf.js`：把分析结果、修正结果的 JSON Schema 转成 GBNF，让手机上的小模型也只能输出合法 JSON。
- 评测工具 `npm run eval`：在电脑上用同样的模型文件，按真实流程比较 0.8B / 2B / 4B 的作图质量，决定手机上用哪个（结果见 [model-eval.md](model-eval.md)）。
- `public/lib/api-device.js`：本机模型客户端，接口和事件格式与连接服务端时完全相同，底层调用原生插件 `LocalModel`（`status / generate / cancel` 和 `token` 事件）。有对应的单元测试。
- “设置”里可以选“模型运行位置：连接服务 / 本机”（网址参数 `?engine=device` 也可以临时切换）。没有原生插件时（例如电脑浏览器），“本机”会由 Ollama 扮演插件，把这条路完整走通；打包成 App 后自动改用真正的原生插件。
- 输出格式加了长度上限（命令最多 60 条等），防止小模型陷入重复输出的循环；Ollama 和手机端的 GBNF 都会强制执行。
- 为小模型加了“核对题目条件”的流程（`public/lib/pipeline.js`、`constraints.js`）：程序从题目文字里提取长度、角度、垂直、中点、方程等条件，画完后逐条核对；题目写明的方程、不等式组由程序直接补画；不满足时把具体问题发给模型修正，必要时重新生成，保留最好的一版。这部分是纯 JavaScript，在手机的 WebView 里直接运行，原生插件不用做任何事。效果见 [model-eval.md](model-eval.md)。

接下来的步骤：
1. 下载 llama.cpp 官方 iOS 框架（`llama-bXXXX-xcframework.zip`，约 65 MB），确认其中包含看图用的 mtmd 模块；不包含的话，用源码自行编译并打开对应的 CMake 开关。
2. 写 Swift 插件 `LocalModel`，实现 `api-device.js` 需要的接口（见 [ios-plugin.md](ios-plugin.md)）：加载模型、按 token 流式回传（Capacitor 事件）、支持取消、GBNF 语法约束和图片输入（mtmd）。
3. ~~在“设置”里增加“模型运行位置：本机 / 电脑”~~（已完成；也可以用网址参数 `?engine=device` 临时切换）。
4. 模型文件不打进安装包（App Store 对蜂窝网络下载有大小限制），首次打开时下载到手机，并校验文件完整性；需要提供国内可访问的下载源（例如 ModelScope）。
5. 在 Xcode 的 iOS 模拟器上跑通，再上真机测速度、内存和发热。iPhone 上一般需要申请“提高内存上限”的权限（`com.apple.developer.kernel.increased-memory-limit`）。

## 路线一：PWA（最快，不需要 Xcode / Android Studio）

1. 电脑上运行 `npm run lan`，手机浏览器打开终端里显示的“手机访问”地址。
2. Safari 里点“分享 → 添加到主屏幕”，Android Chrome 里点“添加到主屏幕”。

限制：局域网的 `http://192.168.x.x` 不是浏览器眼中的“安全环境”，所以 Service Worker（离线缓存）和网页内实时取景（`getUserMedia`）不可用；“拍照”按钮调用系统相机不受影响。要完整的 PWA，需要用 HTTPS 提供服务（例如用 mkcert 生成本地证书）。

## 路线二：用 Capacitor 打包成 iOS / Android App（推荐）

Capacitor 把 `dist/` 里的网页装进原生 App 壳，现有代码基本不用改。需要 Xcode（iOS，只能在 Mac 上）或 Android Studio。

```bash
npm run build:mobile
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init 数形 com.example.shuxing --web-dir dist
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios        # 或 npx cap open android
```

需要额外处理的地方：

1. **服务地址**：App 第一次打开时会自动弹出“设置”，填入电脑上 `npm run lan` 显示的地址。
2. **跨域**：电脑上启动服务时加上 App 的来源：
   `CORS_ORIGINS=capacitor://localhost,https://localhost npm run lan`
   （iOS 的来源是 `capacitor://localhost`；Android 默认是 `https://localhost`）
3. **明文 HTTP**：局域网服务是 `http://`，系统默认会拦截。
   - iOS：`Info.plist` 里加 `NSAppTransportSecurity → NSAllowsLocalNetworking = YES`，以及 `NSLocalNetworkUsageDescription`（访问局域网的说明文字）。
   - Android：在 `capacitor.config` 里设 `server.androidScheme = 'http'`，并在 `AndroidManifest.xml` 允许明文流量（`android:usesCleartextTraffic="true"`，正式版建议改用网络安全配置只放行局域网地址）。
   - 不建议改用 CapacitorHttp 插件转发请求：它对流式响应的支持有限，会失去“边生成边画图”。
4. **相机与相册权限**：iOS 在 `Info.plist` 加 `NSCameraUsageDescription`、`NSPhotoLibraryUsageDescription`；Android 需要相机权限。以后可以换成 `@capacitor/camera` 插件，体验更好。
5. **离线缓存**：App 里的网页本来就在本地，页面会自动跳过 Service Worker。

## 路线三：原生 App（Swift / Kotlin）

界面全部重写，按 [api.md](api.md) 调用服务端。作图部分可以把 `dist/` 放进 WKWebView / WebView 里显示，或者先只在原生界面里展示识别结果。工作量最大，建议在前两条路线验证需求之后再考虑。

## 待办清单

- [x] 接口抽象与可配置的服务地址
- [x] 跨域白名单
- [x] PWA（清单、图标、离线缓存）
- [x] 安全区、触屏尺寸、手势
- [x] 打包脚本 `npm run build:mobile`
- [x] 模拟模型，便于在手机上调试流程
- [x] 选定模型运行方式：B（iPhone 本地运行）
- [x] 提示词共用、GBNF 语法转换、模型评测工具
- [x] 根据评测选定手机上的模型：默认 2B，8 GB 内存的 iPhone 可选 4B（见 [model-eval.md](model-eval.md)）
- [x] 本机模型客户端 `api-device.js`（可用 `?engine=device` 在电脑上调试）
- [x] llama.cpp iOS 框架（v0.9.0 / b12110，含看图的 mtmd）+ Swift 插件 `LocalModel`（`native/local-model`，见 [native/README.md](../native/README.md)）
- [x] 初始化 Capacitor 工程（Swift Package Manager），配置相机、相册权限和“文件”共享（需要连接电脑时再配置明文 HTTP）
- [x] 在 iOS 模拟器上跑通：模型在模拟器里本地运行，文字题从分析、核对题目条件到作图全部完成（模拟器用 CPU，一次分析约 76 秒，不代表真机速度）
- [ ] 真机测试（iPhone 17 Pro）：速度、内存、发热、拍照识别、流式输出、横竖屏
- [ ] （可选）HTTPS，让 PWA 在手机上也能离线使用
