// Capacitor 插件 LocalModel：网页里的 public/lib/api-device.js 通过它在手机上运行模型。
// 接口约定见 docs/ios-plugin.md：status / generate / cancel，以及 token 事件。
// 注意：Capacitor 按 @objc(类名) 自动注册插件，这个目录里只有这一个文件可以写 @objc(...)。
import Foundation
import Capacitor

@objc(LocalModelPlugin)
public class LocalModelPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalModelPlugin"
    public let jsName = "LocalModel"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "generate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
    ]

    private let engine = LlamaEngine()

    override public func load() {
        ModelStore.prepareDocuments()
    }

    @objc func status(_ call: CAPPluginCall) {
        let models = ModelStore.list()
        var result: [String: Any] = [
            "ready": !models.isEmpty,
            "models": models.map { $0.name },
            "vision": models.first?.mmproj != nil,
            "gpu": LlamaEngine.useGPU,
            "dir": ModelStore.documentsDir.path,
        ]
        if let first = ModelStore.resolve(call.getString("model")) {
            result["model"] = first.name
            result["tuned"] = first.adapter != nil // 文件夹里有 adapter.gguf：分析题意时启用它，并改用短系统提示
            result["ocrTuned"] = first.ocrAdapter != nil // 文件夹里有 adapter-ocr.gguf：识别题目时启用它
        }
        if models.isEmpty { result["error"] = "手机上还没有模型文件，请按说明把模型放进 App 的文稿目录（models 文件夹）" }
        call.resolve(result)
    }

    @objc func generate(_ call: CAPPluginCall) {
        guard let requestId = call.getString("requestId"), let raw = call.getArray("messages", JSObject.self) else {
            call.reject("参数不完整", "bad_request")
            return
        }
        var messages: [ChatMessage] = []
        for m in raw {
            let role = m["role"] as? String ?? "user"
            let content = m["content"] as? String ?? ""
            var image: Data?
            if let b64 = m["image"] as? String, !b64.isEmpty {
                image = Data(base64Encoded: b64, options: .ignoreUnknownCharacters)
                if image == nil {
                    call.reject("图片数据无效", "image_failed")
                    return
                }
            }
            messages.append(ChatMessage(role: role, content: content, image: image))
        }
        var req = GenerateRequest(
            requestId: requestId,
            model: call.getString("model"),
            messages: messages,
            grammar: call.getString("grammar"),
            maxTokens: call.getInt("maxTokens") ?? 2048,
            temperature: call.getFloat("temperature") ?? 0.2,
            think: call.getBool("think") ?? false
        )
        req.presencePenalty = call.getFloat("presencePenalty") ?? 0
        req.thinkBudget = call.getInt("thinkBudget") ?? 0
        // lora："ocr"（识别）、"analysis" 或 true（分析、修正）；不传或 false 用原模型
        req.lora = call.getString("lora").flatMap(LoraKind.init(rawValue:)) ?? ((call.getBool("lora") ?? false) ? .analysis : .none)
        engine.generate(req, onText: { [weak self] text, thinking in
            var data: [String: Any] = ["requestId": requestId, "text": text]
            if thinking { data["thinking"] = true }
            DispatchQueue.main.async { self?.notifyListeners("token", data: data) }
        }, completion: { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let stats): call.resolve(["stats": stats.dictionary])
                case .failure(let e): call.reject(e.message, e.code)
                }
            }
        })
    }

    @objc func cancel(_ call: CAPPluginCall) {
        if let id = call.getString("requestId") { engine.cancel(id) }
        call.resolve()
    }
}
