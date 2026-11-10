# 原生插件 LocalModel 接口约定

`public/lib/api-device.js` 通过 Capacitor 插件 `LocalModel` 在手机上运行模型。iOS 端用 Swift 实现（llama.cpp + Metal），接口如下。调试时 `createOllamaDevicePlugin()` 用 Ollama 实现了同样的接口，可以作为参考实现。

## 方法

### `status() → { ready, model, models, error? }`

- `ready`：模型文件已就绪、可以推理时为 `true`
- `model`：当前（或默认）模型名
- `models`：手机上已有的模型
- `error`：未就绪时给用户看的中文原因（例如“模型还没有下载”“内存不足”）

### `generate(options) → { stats }`

| 参数 | 说明 |
|---|---|
| `requestId` | 这次请求的编号，`token` 事件和 `cancel` 都用它对应 |
| `model` | 模型名 |
| `messages` | `[{ role: 'system' \| 'user', content: string, image?: base64 }]`，图片是不带 `data:` 前缀的 JPEG/PNG base64 |
| `grammar` | 可选，GBNF 语法字符串（由 `public/lib/gbnf.js` 生成），用 `llama_sampler_init_grammar` 约束输出 |
| `schema` | 可选，同一个格式的 JSON Schema（Ollama 替身用它；原生端可以忽略） |
| `maxTokens` | 最多生成多少个 token |
| `temperature` | 采样温度 |
| `think` | 是否允许模型先“思考”；思考内容通过 `token` 事件的 `thinking: true` 回传。手机上解题默认不思考（见下） |
| `presencePenalty` | 可选，出现过的 token 再出现时的惩罚（Qwen 建议思考时用 1.5）；有 `grammar` 时不使用 |
| `thinkBudget` | 可选，最多思考多少个 token。超过、或发现模型在重复同一段话时，程序写入结束思考的提示，让模型直接作答 |

生成结束（或被取消、出错）后才返回。返回值 `stats` 建议包含 `outputTokens`、`tokensPerSecond`、`promptTokens`；思考被提前结束时 `forcedAnswer: true`。出错时 reject，`message` 用中文说明原因，可以带 `code`（例如 `oom`、`model_missing`）。

### `cancel({ requestId })`

尽快停止对应的生成，`generate` 随后返回或 reject 都可以。

## 事件

### `token`：`{ requestId, text, thinking? }`

每生成一段文字就发一次（可以几个 token 合并成一次，减少跨桥开销）。`thinking: true` 表示思考过程。

## 实现要点

- **聊天模板**：Qwen3.5 使用 ChatML（`<|im_start|>system … <|im_end|>`）。分析、识别、修正时关闭思考（相当于 Ollama 的 `think: false`）。
- **图片**：用 llama.cpp 的 mtmd 模块和模型配套的视觉投影文件（mmproj）编码图片；图片放在用户消息里文字之前。
- **语法约束**：分析和修正必须带 `grammar`，否则小模型容易输出不合法的 JSON。
- **上下文长度**：8192（系统提示约 2700 token + 用户消息 + 输出最多 4096；解题最多 6144）。
- **内存**：2B 模型约 1.3 GB + 视觉投影 0.7 GB（F16；换成 Q8 约 0.35 GB）。在 iPhone 上建议申请 `com.apple.developer.kernel.increased-memory-limit`。 6 GB 以下内存的设备上，不看图的请求开始前会释放看图模块（约 0.67 GB），下次识别再加载（约 1 秒）。
- **线程**：推理放在后台线程，`token` 事件切回主线程再通知 JS。
- **系统提示缓存（已实现，`LlamaEngine.restorePrefix`）**：分析、修正、重新生成用同一份系统提示（约 2700 token）。第一次计算后用 `llama_state_seq_get_data` 保存整段序列状态（约 54 MB），放在内存（最多 3 份：识别、分析、解题）和 `Caches/shuxing-prefix/`；之后直接 `llama_state_seq_set_data` 恢复，只计算新增的用户消息。Qwen3.5 有循环层，不能只截取 KV 缓存，所以保存的是整段状态。缓存的键包含模型、提示内容和 llama.cpp 版本。实测：恢复后的输出和从头计算的完全相同；Mac GPU 上输入阶段 1.6 秒 → 0.0 秒，只能用 CPU 的设备上省得更多。
- **分析不附原图**：分析只用识别出的文字（附原图时 2B 的输出多一倍，还容易绕圈子）；识别结果几乎没有题目文字时，先换个说法重新识别一次（`OCR_RETRY_HINT`），还不行才在分析时附原图补救（`public/app.js` 的 `recognize`、`analysisImage`）。
- **温度**：重新生成时 `temperature` 是 0.7（第一次是 0.2），采样器要按每次请求的值设置，不能固定。
- **解题时不思考**：实测 2B 在思考模式下容易反复说同一句话（低温度时更明显），一直到输出上限都没有给出解答；直接作答反而又快又对（在 Mac 上 2.6 秒对 20 秒，答案都正确）。所以手机上的“生成解题思路”默认 `think: false`；需要思考时带上 `presencePenalty` 和 `thinkBudget`。
- **调试**：`native/local-model/tools/run.sh` 在 Mac 上用同一份 `LlamaEngine.swift` 运行任意请求（`make-request.mjs` 生成与 App 相同的提示），不用每次装到手机上。
