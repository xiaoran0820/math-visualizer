# 服务端接口（API v1）

前端（网页、PWA、打包后的 App）只通过这些接口与服务端通信，封装在 `public/lib/api.js`。原生客户端照着本文档实现即可。

- 地址：`http://<电脑的 IP>:3000`（`npm run lan` 启动时终端会显示）
- 请求体：JSON，最大 25 MB
- 跨域：默认不允许；打包成 App 时用环境变量 `CORS_ORIGINS` 列出 App 的来源，例如 `CORS_ORIGINS=capacitor://localhost,https://localhost`

## GET /api/health

检查服务与本地模型是否可用。

```json
{
  "apiVersion": 1,
  "provider": "ollama",
  "connected": true,
  "version": "0.40.15",
  "models": [{ "name": "qwen3.5:4b-q4_K_M", "vision": true, "thinking": true }],
  "defaultModel": "qwen3.5:4b-q4_K_M",
  "configuredModel": "qwen3.5:4b-q4_K_M",
  "local": true,
  "endpointHost": "127.0.0.1:11434",
  "busy": false
}
```

- `connected: false` 时会带 `error`（中文说明）。
- `local`：模型服务是否在运行本服务的电脑上。为 `false` 时，图片和题目会被发送到 `endpointHost`，客户端应当提示用户。
- `apiVersion` 比客户端支持的版本新时，客户端应提示更新。

## 流式接口

下面四个接口都返回 **NDJSON**（`Content-Type: application/x-ndjson`）：每行一个 JSON 事件，客户端按行解析。

| 事件 | 含义 |
|---|---|
| `{"t":"start","model":"..."}` | 开始，带实际使用的模型名 |
| `{"t":"delta","v":"..."}` | 模型输出的正文片段，按顺序拼接 |
| `{"t":"think","v":"..."}` | 思考过程片段（仅 `/api/solve` 开启思考时） |
| `{"t":"done","stats":{...}}` | 正常结束，`stats` 含 `outputTokens`、`tokensPerSecond`、`wallSeconds` 等 |
| `{"t":"error","message":"...","code":"..."}` | 出错，`message` 是可以直接展示给用户的中文说明 |

客户端断开连接时，服务端会立即中止对应的模型调用。

### POST /api/recognize — 拍照识别

```json
{ "image": "data:image/jpeg;base64,...", "hint": "只识别第 2 题", "model": "可选" }
```

`delta` 拼起来是题目的 Markdown + LaTeX 文本；如果图中有图形，末尾会有一段「【图形】」描述。建议客户端先把图片缩放到长边 ≤ 1600px 再上传。

识别结果去掉「【图形】」部分后不到 15 个字时（`tooLittleText`，见 `public/lib/prompts.js`），网页会用 `ocrRetryHint(hint)`（重新识别的说明在前，用户自己的补充说明在后）再请求一次，用题目文字多的那次结果；整段抄了两遍的结果只留一遍（`dedupeOcr`）。

### POST /api/analyze — 分析题意并生成作图命令

```json
{ "text": "题目文本", "image": "可选：原图，用于参考图形位置", "hint": "可选", "model": "可选", "temperature": "可选，0～1.2，默认 0.2" }
```

`temperature`：重新生成时客户端会用较高的温度（0.7），让模型换个思路。`delta` 拼起来是一个 JSON 对象（输出受 JSON Schema 约束）：

```json
{
  "title": "等腰三角形中的垂线段",
  "category": "平面几何",
  "knowns": ["$AB=AC=5$"],
  "goal": "求 $DE$ 的长",
  "layout": "作图推演……",
  "commands": ["A = (0, 4)", "B = (-3, 0)", "..."],
  "insight": "观察要点……"
}
```

生成过程中可以用容错的 JSON 解析（`public/lib/partial-json.js`）边收边画。`commands` 的语法见 README 和网页里的“命令说明”，由 `public/lib/scene.js` 执行。

客户端拿到结果后的完整流程（核对题目条件、补画、修正、重新生成、选出最好的一版）在 `public/lib/pipeline.js`，网页和评测脚本共用。原生客户端可以直接在 WebView 里复用这份代码，不需要重写。

### POST /api/repair — 修正作图命令

```json
{
  "text": "题目文本",
  "commands": ["..."],
  "errors": [{ "line": 7, "src": "E = Foo(D)", "message": "未知命令「Foo」" }],
  "issues": ["可选：图形不符合题目的地方，例如 DE ⊥ AC（图中夹角 84.3°）"],
  "model": "可选"
}
```

`errors` 是执行出错的命令，`issues` 是程序核对出的、不符合题目条件的地方（见 `public/lib/constraints.js`），两者可以只有一种。`delta` 拼起来是 `{"commands": [...]}`。是否采用由客户端判断（`public/lib/pipeline.js`）：能核对题目条件时，满足的条件更多（或一样多但错误更少）才采用；没有可核对的条件时，沿用 `public/lib/repair.js` 的严格规则（错误必须减少、对象不能变少、原本正确的对象不能被改动）。

### POST /api/solve — 解题思路

```json
{ "text": "题目文本", "commands": ["可选：已画出的作图命令"], "model": "可选" }
```

网页现在不再传 `commands`：模型作图时自己算错的坐标（例如画错的交点）会被照抄进解答，只按题目文字解题更可靠。

先输出若干 `think` 事件（模型的思考过程），再输出 Markdown 格式的解答。

## 错误码

| 场景 | HTTP 状态 / 事件 | `code` |
|---|---|---|
| 参数不完整、图片无效 | 400 | `bad_request` |
| 同时进行的模型任务超过上限（`MAX_CONCURRENT`，默认 2） | 429 | `busy` |
| 连不上本地模型服务 | error 事件 | `unreachable` |
| 本地没有这个模型 | error 事件 | `model_missing` |
| 模型不支持图片 | error 事件 | `no_vision` |
| 模型迟迟不开始响应 / 中途停顿 / 总时间过长 | error 事件 | `timeout` |
| 其他模型错误 | error 事件 | `llm_error` |

超时时间由环境变量控制：`LLM_FIRST_BYTE_TIMEOUT`（默认 180 秒，包含第一次加载模型）、`LLM_IDLE_TIMEOUT`（60 秒）、`LLM_TIMEOUT`（300 秒）、`SOLVE_TIMEOUT`（600 秒）。
