// 在 Mac 上直接运行手机 App 用的同一份引擎代码（LlamaEngine.swift），方便调试提示格式、思考过程、语法约束和速度。
// 用法见 run.sh：输入是插件 generate 的参数（JSON），输出逐字打印；思考过程用灰色显示，最后打印统计。
import Foundation

let args = CommandLine.arguments
guard args.count >= 2, let data = FileManager.default.contents(atPath: args[1]),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
    FileHandle.standardError.write("用法：llm-cli request.json\n".data(using: .utf8)!)
    exit(2)
}
let messages: [ChatMessage] = (obj["messages"] as? [[String: Any]] ?? []).map {
    ChatMessage(role: $0["role"] as? String ?? "user", content: $0["content"] as? String ?? "",
                image: ($0["image"] as? String).flatMap { Data(base64Encoded: $0) })
}
var req = GenerateRequest(
    requestId: "cli",
    model: obj["model"] as? String,
    messages: messages,
    grammar: obj["grammar"] as? String,
    maxTokens: obj["maxTokens"] as? Int ?? 2048,
    temperature: Float(obj["temperature"] as? Double ?? 0.2),
    think: obj["think"] as? Bool ?? false
)
req.presencePenalty = Float(obj["presencePenalty"] as? Double ?? 0)
req.thinkBudget = obj["thinkBudget"] as? Int ?? 0
let out = FileHandle.standardOutput
var thinkingChars = 0, contentChars = 0
let done = DispatchSemaphore(value: 0)
LlamaEngine().generate(req, onText: { text, thinking in
    if thinking { thinkingChars += text.count } else { contentChars += text.count }
    out.write((thinking ? "\u{1b}[2m\(text)\u{1b}[0m" : text).data(using: .utf8)!)
}, completion: { result in
    switch result {
    case .success(let s):
        let d = s.dictionary
        print("\n\n—— 统计：提示 \(s.promptTokens) token / \(String(format: "%.1f", s.promptSeconds)) 秒，输出 \(s.outputTokens) token / \(String(format: "%.1f", s.generateSeconds)) 秒（\(String(format: "%.1f", d["tokensPerSecond"] as? Double ?? 0)) token/秒），加载 \(String(format: "%.1f", s.loadSeconds)) 秒，系统提示从缓存恢复 \(s.cachedTokens) token；思考 \(thinkingChars) 字，正文 \(contentChars) 字\(s.forcedAnswer ? "；思考被提前结束" : "")")
    case .failure(let e):
        print("\n\n—— 出错（\(e.code)）：\(e.message)")
    }
    done.signal()
})
done.wait()
// 直接退出：跳过 C++ 静态析构（ggml 的 Metal 资源在进程退出时清理会崩溃，App 里不会这样退出）
fflush(stdout)
_exit(0)
