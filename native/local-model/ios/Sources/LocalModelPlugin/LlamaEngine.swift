// 在手机上运行本地模型：llama.cpp（真机用 Metal，模拟器用 CPU）+ mtmd（看图）。
// 提示格式与 Ollama 一致：Qwen3.5 的 ChatML；不思考时在助手开头写入空的 <think></think>。
// 采样参数也与 Ollama 中这个模型的默认值一致（top_k 20、top_p 0.95，温度由每次请求决定），
// 这样电脑上的评测结果（docs/model-eval.md）可以直接代表手机上的效果。
import Foundation
import llama

// MARK: - 请求、结果、错误

struct ChatMessage {
    let role: String
    let content: String
    let image: Data?
}

struct GenerateRequest {
    let requestId: String
    let model: String?
    let messages: [ChatMessage]
    let grammar: String?
    let maxTokens: Int
    let temperature: Float
    let think: Bool
    /// 出现过的 token 再次出现时的惩罚（Qwen 建议思考模式用 1.5，防止反复说同一句话）；有语法约束时不用
    var presencePenalty: Float = 0
    /// 思考最多多少个 token；超过、或者发现在原地打转时，结束思考，让模型直接给出解答（0 = 不限制）
    var thinkBudget: Int = 0
    /// 这次请求启用模型文件夹里的哪个 LoRA：分析题意、修正命令用 adapter.gguf，识别题目用 adapter-ocr.gguf；
    /// 解题、以及文件夹里没有对应文件时用原模型
    var lora: LoraKind = .none
}

enum LoraKind: String { case none, analysis, ocr }

struct GenerateStats {
    var promptTokens = 0
    var outputTokens = 0
    var loadSeconds = 0.0
    var promptSeconds = 0.0
    var generateSeconds = 0.0
    var forcedAnswer = false // 思考被提前结束
    var cachedTokens = 0 // 系统提示直接从缓存恢复、没有重新计算的 token 数

    var dictionary: [String: Any] {
        [
            "promptTokens": promptTokens,
            "outputTokens": outputTokens,
            "loadSeconds": loadSeconds,
            "promptSeconds": promptSeconds,
            "generateSeconds": generateSeconds,
            "tokensPerSecond": generateSeconds > 0 ? Double(outputTokens) / generateSeconds : 0,
            "promptTokensPerSecond": promptSeconds > 0 ? Double(promptTokens) / promptSeconds : 0,
            "forcedAnswer": forcedAnswer,
            "cachedTokens": cachedTokens,
        ]
    }
}

enum EngineError: Error {
    case modelMissing(String)
    case loadFailed(String)
    case badRequest(String)
    case imageFailed(String)
    case decodeFailed(String)
    case cancelled

    var code: String {
        switch self {
        case .modelMissing: return "model_missing"
        case .loadFailed: return "load_failed"
        case .badRequest: return "bad_request"
        case .imageFailed: return "image_failed"
        case .decodeFailed: return "decode_failed"
        case .cancelled: return "cancelled"
        }
    }

    var message: String {
        switch self {
        case .modelMissing(let s), .loadFailed(let s), .badRequest(let s), .imageFailed(let s), .decodeFailed(let s): return s
        case .cancelled: return "已取消"
        }
    }
}

// MARK: - 模型文件

/// 模型放在 App 的“文稿”目录（可以通过 Finder 或“文件”App 拷进去）或安装包里：
///   models/<模型名>/model.gguf    文字模型
///   models/<模型名>/mmproj.gguf   看图用的视觉投影（可选，没有就不能拍照识别）
///   models/<模型名>/adapter.gguf  数形自己训练的作图 LoRA（可选，加在 model.gguf 上；见 train/）
///   models/<模型名>/adapter-ocr.gguf  数形自己训练的识别 LoRA（可选）
enum ModelStore {
    struct Entry {
        let name: String
        let model: URL
        let mmproj: URL?
        var adapter: URL? = nil
        var ocrAdapter: URL? = nil
    }

    static var documentsDir: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("models", isDirectory: true)
    }

    static func prepareDocuments() {
        let fm = FileManager.default
        try? fm.createDirectory(at: documentsDir, withIntermediateDirectories: true)
        let readme = documentsDir.appendingPathComponent("说明.txt")
        if !fm.fileExists(atPath: readme.path) {
            let text = "把模型放在这里：models/<模型名>/model.gguf，看图用的视觉投影放在同一个文件夹，命名为 mmproj.gguf。\n例如 models/qwen3.5-2b-q4_K_M/model.gguf\n"
            try? text.write(to: readme, atomically: true, encoding: .utf8)
        }
    }

    static func list() -> [Entry] {
        var roots = [documentsDir]
        if let res = Bundle.main.resourceURL { roots.append(res.appendingPathComponent("models", isDirectory: true)) }
        // 在 Mac 上用命令行工具测试时（native/local-model/tools），由环境变量指定模型目录
        if let dir = ProcessInfo.processInfo.environment["SHUXING_MODELS_DIR"] { roots.insert(URL(fileURLWithPath: dir, isDirectory: true), at: 0) }
        var out: [Entry] = []
        let fm = FileManager.default
        for root in roots {
            guard let names = try? fm.contentsOfDirectory(atPath: root.path) else { continue }
            for name in names.sorted() where !out.contains(where: { $0.name == name }) {
                let dir = root.appendingPathComponent(name, isDirectory: true)
                let model = dir.appendingPathComponent("model.gguf")
                guard fm.fileExists(atPath: model.path) else { continue }
                let mm = dir.appendingPathComponent("mmproj.gguf")
                let lora = dir.appendingPathComponent("adapter.gguf"), ocr = dir.appendingPathComponent("adapter-ocr.gguf")
                out.append(Entry(name: name, model: model, mmproj: fm.fileExists(atPath: mm.path) ? mm : nil,
                                 adapter: fm.fileExists(atPath: lora.path) ? lora : nil,
                                 ocrAdapter: fm.fileExists(atPath: ocr.path) ? ocr : nil))
            }
        }
        return out
    }

    /// 网页传来的模型名可能是 Ollama 的写法（qwen3.5:2b-q4_K_M），统一成文件夹名再找；找不到就用第一个
    static func resolve(_ requested: String?) -> Entry? {
        let all = list()
        let key = (requested ?? "").replacingOccurrences(of: ":", with: "-").lowercased()
        return all.first(where: { $0.name.lowercased() == key }) ?? all.first
    }
}

// MARK: - 引擎

private let logCallback: ggml_log_callback = { level, text, _ in
    // 只保留警告和错误，避免控制台被加载信息刷屏
    guard let text, level == GGML_LOG_LEVEL_WARN || level == GGML_LOG_LEVEL_ERROR else { return }
    print("[llama]", String(cString: text), terminator: "")
}

final class LlamaEngine {
    private let queue = DispatchQueue(label: "shuxing.llama", qos: .userInitiated)
    private let lock = NSLock()
    private var cancelled = Set<String>()

    private var model: OpaquePointer?
    private var ctx: OpaquePointer?
    private var vision: OpaquePointer?
    private var loraAnalysis: OpaquePointer?
    private var loraOcr: OpaquePointer?
    private var loraOn: LoraKind = .none
    private var loaded: ModelStore.Entry?
    private var nCtx: Int32 = 0
    // 线程数：SHUXING_THREADS 只在 Mac 上的测试工具里用，模拟低配设备
    private let threads = Int32(ProcessInfo.processInfo.environment["SHUXING_THREADS"].flatMap { Int($0) }
        ?? max(2, min(8, ProcessInfo.processInfo.activeProcessorCount - 2)))
    private static var backendReady = false

    static let lowMemory = ProcessInfo.processInfo.physicalMemory < 6 * 1024 * 1024 * 1024

    #if targetEnvironment(simulator)
    static let useGPU = false // 模拟器的 Metal 功能不全，用 CPU（速度不代表真机）
    #else
    // SHUXING_CPU=1 只在 Mac 上的测试工具里用：不用 GPU，模拟没有 GPU 加速的情况
    static let useGPU = ProcessInfo.processInfo.environment["SHUXING_CPU"] == nil
    #endif

    func cancel(_ id: String) {
        lock.lock(); cancelled.insert(id); lock.unlock()
    }

    private func isCancelled(_ id: String) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return cancelled.contains(id)
    }

    private func forget(_ id: String) {
        lock.lock(); cancelled.remove(id); lock.unlock()
    }

    /// 在后台队列里生成；onText(文字, 是否思考过程) 会被多次调用；结束后调用 completion
    func generate(_ req: GenerateRequest, onText: @escaping (String, Bool) -> Void, completion: @escaping (Result<GenerateStats, EngineError>) -> Void) {
        queue.async {
            defer { self.forget(req.requestId) }
            do {
                completion(.success(try self.run(req, onText: onText)))
            } catch let e as EngineError {
                completion(.failure(e))
            } catch {
                completion(.failure(.decodeFailed(error.localizedDescription)))
            }
        }
    }

    // MARK: 加载

    private func load(_ entry: ModelStore.Entry) throws -> Double {
        if let l = loaded, l.model == entry.model, l.adapter == entry.adapter, l.ocrAdapter == entry.ocrAdapter, model != nil, ctx != nil { return 0 }
        unload()
        let t0 = Date()
        if !Self.backendReady {
            llama_log_set(logCallback, nil)
            mtmd_helper_log_set(logCallback, nil)
            llama_backend_init()
            Self.backendReady = true
        }
        var mp = llama_model_default_params()
        mp.n_gpu_layers = Self.useGPU ? 999 : 0
        guard let m = llama_model_load_from_file(entry.model.path, mp) else {
            throw EngineError.loadFailed("模型文件无法加载（\(entry.name)），可能文件不完整或内存不足")
        }
        var cp = llama_context_default_params()
        // 分析题意不再附原图后，最长的请求是解题（提示约 500 token + 输出最多 6144）、分析（提示约 3000 + 输出最多 4096），8192 够用。
        // 比原来的 12288 少占约 50 MB，低配手机上更不容易因为内存不足被系统关掉。
        cp.n_ctx = 8192
        cp.n_batch = 512
        cp.n_ubatch = 512
        cp.n_seq_max = 1
        cp.n_threads = threads
        cp.n_threads_batch = threads
        guard let c = llama_init_from_model(m, cp) else {
            llama_model_free(m)
            throw EngineError.loadFailed("模型上下文创建失败，可能内存不足")
        }
        // 训练出的 LoRA：先加载好（文件很小，不到 1 秒），每次请求再决定用哪个（见 run 里的 useLora）
        for (url, file) in [(entry.adapter, "adapter.gguf"), (entry.ocrAdapter, "adapter-ocr.gguf")] {
            guard let path = url?.path else { continue }
            guard let a = llama_adapter_lora_init(m, path) else {
                if let x = loraAnalysis { llama_adapter_lora_free(x) }
                loraAnalysis = nil
                llama_free(c); llama_model_free(m)
                throw EngineError.loadFailed("LoRA 文件 \(file) 无法加载（可能和模型不匹配）")
            }
            if file == "adapter.gguf" { loraAnalysis = a } else { loraOcr = a }
        }
        loraOn = .none
        model = m
        ctx = c
        loaded = entry
        nCtx = Int32(llama_n_ctx(c))
        return Date().timeIntervalSince(t0)
    }

    private func unload() {
        if let v = vision { mtmd_free(v) }
        if let c = ctx { llama_free(c) }
        if let a = loraAnalysis { llama_adapter_lora_free(a) }
        if let a = loraOcr { llama_adapter_lora_free(a) }
        if let m = model { llama_model_free(m) }
        vision = nil; ctx = nil; loraAnalysis = nil; loraOcr = nil; model = nil; loaded = nil; loraOn = .none
    }

    /// 换成这次要用的 LoRA，或者关掉（切换不需要重新加载模型）；文件夹里没有对应文件时用原模型
    private func useLora(_ kind: LoraKind, ctx: OpaquePointer) {
        let adapter: OpaquePointer? = kind == .analysis ? loraAnalysis : kind == .ocr ? loraOcr : nil
        let want: LoraKind = adapter == nil ? .none : kind
        guard want != loraOn else { return }
        if let a = adapter {
            var adapters: [OpaquePointer?] = [a]
            var scales: [Float] = [1]
            _ = adapters.withUnsafeMutableBufferPointer { ab in scales.withUnsafeMutableBufferPointer { llama_set_adapters_lora(ctx, ab.baseAddress, 1, $0.baseAddress) } }
        } else {
            _ = llama_set_adapters_lora(ctx, nil, 0, nil)
        }
        loraOn = want
    }

    // 看图模块按需加载：只输入文字时不占这部分内存
    private func visionContext() throws -> OpaquePointer {
        if let v = vision { return v }
        guard let entry = loaded, let mm = entry.mmproj else {
            throw EngineError.modelMissing("没有找到看图用的视觉投影文件 mmproj.gguf，暂时只能输入文字题目")
        }
        var p = mtmd_context_params_default()
        p.use_gpu = Self.useGPU
        p.print_timings = false
        p.n_threads = threads
        p.warmup = false
        p.image_max_tokens = 1024 // 约 100 万像素；更大的照片会被缩小，避免手机上处理太久
        guard let v = mtmd_init_from_file(mm.path, model, p) else {
            throw EngineError.loadFailed("视觉投影文件无法加载")
        }
        vision = v
        return v
    }

    // MARK: 生成

    private func run(_ req: GenerateRequest, onText: @escaping (String, Bool) -> Void) throws -> GenerateStats {
        if isCancelled(req.requestId) { throw EngineError.cancelled }
        guard let entry = ModelStore.resolve(req.model) else {
            throw EngineError.modelMissing("手机上还没有模型文件。请把模型放进 App 的文稿目录：\(ModelStore.documentsDir.path)")
        }
        var stats = GenerateStats()
        stats.loadSeconds = try load(entry)
        guard let ctx, let model, let vocab = llama_model_get_vocab(model) else { throw EngineError.loadFailed("模型没有加载") }
        // 内存小的设备（6 GB 以下）：这次不看图时，先把看图模块（约 0.67 GB）释放掉，下次识别时再加载（约 1 秒）
        if let v = vision, Self.lowMemory, !req.messages.contains(where: { $0.image != nil }) {
            mtmd_free(v)
            vision = nil
        }
        useLora(req.lora, ctx: ctx)
        llama_memory_clear(llama_get_memory(ctx), true)

        // 提示：Qwen3.5 的 ChatML；图片放在用户消息的文字之前。
        // 开头的系统消息单独处理：分析、修正、重新生成用的是同一份系统提示（约 2700 token），
        // 它的计算结果缓存起来（见 restorePrefix），之后的请求直接恢复，只计算新增的用户消息。
        let image = req.messages.first(where: { $0.image != nil })?.image
        let marker = image != nil ? String(cString: mtmd_default_marker()) : ""
        var prefix = ""
        var prompt = ""
        var placed = false
        for (i, m) in req.messages.enumerated() {
            var content = m.content.trimmingCharacters(in: .whitespacesAndNewlines)
            if m.image != nil, !placed { content = marker + content; placed = true }
            let block = "<|im_start|>\(m.role)\n\(content)<|im_end|>\n"
            if i == 0 && m.role == "system" && m.image == nil { prefix = block } else { prompt += block }
        }
        prompt += "<|im_start|>assistant\n"
        prompt += req.think ? "<think>\n" : "<think>\n\n</think>\n\n"

        var batch = llama_batch_init(512, 0, 1)
        defer { llama_batch_free(batch) }
        let tPrompt = Date()
        var nPast: Int32 = 0
        if !prefix.isEmpty {
            nPast = try restorePrefix(prefix, entry: entry, ctx: ctx, vocab: vocab, batch: &batch, requestId: req.requestId, stats: &stats)
        }
        let addSpecial = prefix.isEmpty

        if let image {
            let v = try visionContext()
            let wrapper = image.withUnsafeBytes { raw -> mtmd_helper_bitmap_wrapper in
                mtmd_helper_bitmap_init_from_buf(v, raw.bindMemory(to: UInt8.self).baseAddress, raw.count, false, mtmd_helper_init_opt_default())
            }
            guard let bitmap = wrapper.bitmap else { throw EngineError.imageFailed("图片无法读取（支持 JPG、PNG）") }
            defer { mtmd_bitmap_free(bitmap) }
            guard let chunks = mtmd_input_chunks_init() else { throw EngineError.imageFailed("图片处理失败") }
            defer { mtmd_input_chunks_free(chunks) }
            let rc: Int32 = prompt.withCString { cstr in
                var text = mtmd_input_text(text: cstr, text_len: strlen(cstr), add_special: addSpecial, parse_special: true)
                let bitmaps: [OpaquePointer?] = [bitmap]
                return bitmaps.withUnsafeBufferPointer { mtmd_tokenize(v, chunks, &text, $0.baseAddress, 1) }
            }
            guard rc == 0 else { throw EngineError.imageFailed("图片处理失败（\(rc)）") }
            stats.promptTokens = Int(nPast) + Int(mtmd_helper_get_n_tokens(chunks))
            guard stats.promptTokens < Int(nCtx) - 64 else { throw EngineError.badRequest("题目或图片太大，超出了模型的上下文长度") }
            var newPast: llama_pos = 0
            guard mtmd_helper_eval_chunks(v, ctx, chunks, nPast, 0, 512, true, &newPast) == 0 else {
                throw EngineError.decodeFailed("处理图片和题目时出错")
            }
            nPast = newPast
        } else {
            let tokens = tokenize(vocab, prompt, addSpecial: addSpecial)
            stats.promptTokens = Int(nPast) + tokens.count
            guard stats.promptTokens < Int(nCtx) - 64 else { throw EngineError.badRequest("题目太长，超出了模型的上下文长度") }
            var i = 0
            while i < tokens.count {
                if isCancelled(req.requestId) { throw EngineError.cancelled }
                let part = Array(tokens[i..<min(i + 512, tokens.count)])
                let last = i + part.count == tokens.count
                guard decode(part, at: nPast, batch: &batch, logitsLast: last) else { throw EngineError.decodeFailed("处理题目时出错") }
                nPast += Int32(part.count)
                i += part.count
            }
        }
        stats.promptSeconds = Date().timeIntervalSince(tPrompt)

        // 逐个生成 token
        let sampler = try Sampler(vocab: vocab, grammar: req.grammar, temperature: req.temperature,
                                  presencePenalty: req.grammar == nil ? req.presencePenalty : 0)
        let emitter = TextEmitter(think: req.think, send: onText)
        var bytes: [UInt8] = []
        var thinkTokens = 0
        let tGen = Date()
        while stats.outputTokens < req.maxTokens {
            if isCancelled(req.requestId) { throw EngineError.cancelled }
            // 思考太久或在原地打转：写入结束思考的提示，让模型直接作答（Qwen 官方给出的做法）
            if emitter.isThinking {
                thinkTokens += 1
                let over = req.thinkBudget > 0 && thinkTokens > req.thinkBudget
                if over || (thinkTokens % 32 == 0 && emitter.isLooping) {
                    if !bytes.isEmpty { emitter.add(String(decoding: bytes, as: UTF8.self)); bytes = [] }
                    let close = "\n\nConsidering the limited time by the user, I have to give the solution based on the thinking directly now.\n</think>\n\n"
                    let forced = tokenize(vocab, close, addSpecial: false)
                    guard Int(nPast) + forced.count + 16 < Int(nCtx) else { break }
                    guard decode(forced, at: nPast, batch: &batch, logitsLast: true) else { throw EngineError.decodeFailed("生成时出错") }
                    nPast += Int32(forced.count)
                    forced.forEach { sampler.acceptForced($0) }
                    emitter.add(close)
                    stats.forcedAnswer = true
                    continue
                }
            }
            guard let token = sampler.sample(ctx) else { break }
            if llama_vocab_is_eog(vocab, token) { break }
            sampler.accept(token)
            stats.outputTokens += 1
            bytes += piece(vocab, token)
            let (text, rest) = splitUTF8(bytes)
            bytes = rest
            if !text.isEmpty { emitter.add(text) }
            if nPast + 1 >= nCtx { break }
            guard decode([token], at: nPast, batch: &batch, logitsLast: true) else { throw EngineError.decodeFailed("生成时出错") }
            nPast += 1
        }
        if !bytes.isEmpty { emitter.add(String(decoding: bytes, as: UTF8.self)) }
        emitter.finish()
        stats.generateSeconds = Date().timeIntervalSince(tGen)
        return stats
    }

    // MARK: 系统提示的缓存

    private struct PrefixState {
        let tokens: Int32
        let state: [UInt8]
    }
    private var prefixCache: [UInt64: PrefixState] = [:]
    private var prefixOrder: [UInt64] = []
    private static let stateVersion = "b12110-1" // llama.cpp 版本变了，旧的缓存文件就不再使用

    private static var prefixDir: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("shuxing-prefix", isDirectory: true)
    }

    // 稳定的哈希（Swift 自带的 hashValue 每次启动都会变，不能用来命名文件）
    private static func fnv1a(_ s: String) -> UInt64 {
        var h: UInt64 = 0xcbf29ce484222325
        for b in s.utf8 { h ^= UInt64(b); h = h &* 0x100000001b3 }
        return h
    }

    private func remember(_ key: UInt64, _ p: PrefixState) {
        prefixCache[key] = p
        prefixOrder.removeAll { $0 == key }
        prefixOrder.append(key)
        // 识别、分析、解题各一份（每份 20～55 MB）；内存小的设备只留最近一份，其余从磁盘读（几十毫秒）
        let limit = Self.lowMemory ? 1 : 3
        while prefixOrder.count > limit { prefixCache[prefixOrder.removeFirst()] = nil }
    }

    // 磁盘上只留最近用过的几份；提示词或模型换了以后，旧文件不会再被读到
    private static func pruneCacheFiles(keep: Int = 6) {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: prefixDir, includingPropertiesForKeys: [.contentModificationDateKey]) else { return }
        let date = { (u: URL) in (try? u.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast }
        for f in files.filter({ $0.pathExtension == "bin" }).sorted(by: { date($0) > date($1) }).dropFirst(keep) {
            try? fm.removeItem(at: f)
        }
    }

    /// 恢复系统提示的计算结果；没有缓存时计算一次，存进内存和磁盘。返回系统提示占用的位置数。
    private func restorePrefix(_ prefix: String, entry: ModelStore.Entry, ctx: OpaquePointer, vocab: OpaquePointer,
                               batch: inout llama_batch, requestId: String, stats: inout GenerateStats) throws -> Int32 {
        // 键里要有模型文件的修改时间：微调后的模型和原来的大小完全一样，只看名字和大小会恢复出旧模型的计算结果
        // LoRA 也会改变计算结果，一起算进键里
        let stamp = { (url: URL?) -> String in
            guard let url, let a = try? FileManager.default.attributesOfItem(atPath: url.path) else { return "-" }
            return "\((a[.size] as? NSNumber)?.int64Value ?? 0)@\(Int64((a[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0))"
        }
        let loraStamp = loraOn == .analysis ? stamp(entry.adapter) : loraOn == .ocr ? "ocr:" + stamp(entry.ocrAdapter) : "-"
        let key = Self.fnv1a("\(entry.name)|\(stamp(entry.model))|\(loraStamp)|\(Self.stateVersion)|\(prefix)")
        let file = Self.prefixDir.appendingPathComponent(String(format: "%016llx.bin", key))
        var cached = prefixCache[key]
        if cached == nil, let data = try? Data(contentsOf: file), data.count > 4 {
            let n = data.prefix(4).withUnsafeBytes { $0.loadUnaligned(as: Int32.self) }
            cached = PrefixState(tokens: Int32(littleEndian: n), state: [UInt8](data.dropFirst(4)))
        }
        if let p = cached {
            let ok = p.state.withUnsafeBufferPointer { llama_state_seq_set_data(ctx, $0.baseAddress, $0.count, 0) } > 0
            if ok {
                remember(key, p)
                try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: file.path) // 记下最近用过
                stats.cachedTokens = Int(p.tokens)
                return p.tokens
            }
            llama_memory_clear(llama_get_memory(ctx), true) // 缓存对不上（例如模型换了）：重新计算
            try? FileManager.default.removeItem(at: file)
        }
        let tokens = tokenize(vocab, prefix, addSpecial: true)
        var i = 0
        while i < tokens.count {
            if isCancelled(requestId) { throw EngineError.cancelled }
            let part = Array(tokens[i..<min(i + 512, tokens.count)])
            guard decode(part, at: Int32(i), batch: &batch, logitsLast: false) else { throw EngineError.decodeFailed("处理系统提示时出错") }
            i += part.count
        }
        let n = Int32(tokens.count)
        let need = llama_state_seq_get_size(ctx, 0)
        if need > 0 {
            var buf = [UInt8](repeating: 0, count: need)
            let written = buf.withUnsafeMutableBufferPointer { llama_state_seq_get_data(ctx, $0.baseAddress, need, 0) }
            if written > 0 {
                let p = PrefixState(tokens: n, state: Array(buf[0..<written]))
                remember(key, p)
                var data = Data()
                withUnsafeBytes(of: n.littleEndian) { data.append(contentsOf: $0) }
                data.append(contentsOf: p.state)
                try? FileManager.default.createDirectory(at: Self.prefixDir, withIntermediateDirectories: true)
                try? data.write(to: file, options: .atomic)
                Self.pruneCacheFiles()
            }
        }
        return n
    }

    private func tokenize(_ vocab: OpaquePointer, _ text: String, addSpecial: Bool = true) -> [llama_token] {
        let utf8 = Array(text.utf8CString)
        let len = Int32(utf8.count - 1)
        let need = utf8.withUnsafeBufferPointer { llama_tokenize(vocab, $0.baseAddress, len, nil, 0, addSpecial, true) }
        var tokens = [llama_token](repeating: 0, count: Int(abs(need)) + 8)
        let n = utf8.withUnsafeBufferPointer { src in
            tokens.withUnsafeMutableBufferPointer { llama_tokenize(vocab, src.baseAddress, len, $0.baseAddress, Int32($0.count), addSpecial, true) }
        }
        return Array(tokens.prefix(max(0, Int(n))))
    }

    // 用显式位置解码（与 llama.cpp 的 mtmd-cli 相同，M-RoPE 模型也适用）
    private func decode(_ tokens: [llama_token], at start: Int32, batch: inout llama_batch, logitsLast: Bool) -> Bool {
        batch.n_tokens = Int32(tokens.count)
        for (i, t) in tokens.enumerated() {
            batch.token[i] = t
            batch.pos[i] = start + Int32(i)
            batch.n_seq_id[i] = 1
            batch.seq_id[i]![0] = 0
            batch.logits[i] = (logitsLast && i == tokens.count - 1) ? 1 : 0
        }
        return llama_decode(ctx, batch) == 0
    }

    private func piece(_ vocab: OpaquePointer, _ token: llama_token) -> [UInt8] {
        var buf = [CChar](repeating: 0, count: 64)
        var n = llama_token_to_piece(vocab, token, &buf, Int32(buf.count), 0, true)
        if n < 0 {
            buf = [CChar](repeating: 0, count: Int(-n))
            n = llama_token_to_piece(vocab, token, &buf, Int32(buf.count), 0, true)
        }
        return buf.prefix(Int(max(0, n))).map { UInt8(bitPattern: $0) }
    }
}

/// 一个汉字可能被拆在两个 token 里：只输出完整的 UTF-8 字符，末尾不完整的留到下一次
func splitUTF8(_ b: [UInt8]) -> (String, [UInt8]) {
    var cut = b.count
    var i = b.count - 1
    var back = 0
    while i >= 0 && back < 4 {
        let c = b[i]
        if c & 0xC0 == 0x80 { i -= 1; back += 1; continue }
        let need = c >= 0xF0 ? 4 : c >= 0xE0 ? 3 : c >= 0xC0 ? 2 : 1
        if need > b.count - i { cut = i }
        break
    }
    return (String(decoding: b[0..<cut], as: UTF8.self), Array(b[cut...]))
}

// MARK: - 采样

/// top_k 20 → top_p 0.95 → 温度 → 随机抽取；带输出格式语法时，先不加语法抽一个，
/// 不符合语法再对全部候选加上语法重新抽（与 llama.cpp 的 common_sampler 相同，省掉大部分语法计算）
final class Sampler {
    private let chain: UnsafeMutablePointer<llama_sampler>
    private let grammar: UnsafeMutablePointer<llama_sampler>?
    private var candidates: [llama_token_data]

    init(vocab: OpaquePointer, grammar text: String?, temperature: Float, presencePenalty: Float = 0) throws {
        let nVocab = llama_vocab_n_tokens(vocab)
        candidates = [llama_token_data](repeating: llama_token_data(id: 0, logit: 0, p: 0), count: Int(nVocab))
        chain = llama_sampler_chain_init(llama_sampler_chain_default_params())
        if presencePenalty > 0 {
            // 只在没有语法约束时使用（JSON 的引号、逗号本来就要反复出现）；惩罚最近 256 个 token 里出现过的
            llama_sampler_chain_add(chain, llama_sampler_init_penalties(nVocab, 256, 1.0, 0.0, presencePenalty))
        }
        llama_sampler_chain_add(chain, llama_sampler_init_top_k(20))
        llama_sampler_chain_add(chain, llama_sampler_init_top_p(0.95, 1))
        if temperature <= 0.001 {
            llama_sampler_chain_add(chain, llama_sampler_init_greedy())
        } else {
            llama_sampler_chain_add(chain, llama_sampler_init_temp(temperature))
            llama_sampler_chain_add(chain, llama_sampler_init_dist(UInt32.random(in: 1...UInt32.max - 1)))
        }
        if let text, !text.isEmpty {
            guard let g = llama_sampler_init_grammar(vocab, text, "root") else {
                llama_sampler_free(chain)
                throw EngineError.badRequest("输出格式的语法无效")
            }
            grammar = g
        } else {
            grammar = nil
        }
    }

    deinit {
        llama_sampler_free(chain)
        if let g = grammar { llama_sampler_free(g) }
    }

    func sample(_ ctx: OpaquePointer) -> llama_token? {
        // llama_sampler_sample 会顺带 accept（惩罚采样器记住这个 token）；语法约束时链里没有惩罚采样器，不受影响
        var token = llama_sampler_sample(chain, ctx, -1)
        guard let g = grammar else { return token }
        var single = llama_token_data(id: token, logit: 1, p: 0)
        let ok = withUnsafeMutablePointer(to: &single) { p -> Bool in
            var arr = llama_token_data_array(data: p, size: 1, selected: -1, sorted: false)
            llama_sampler_apply(g, &arr)
            return p.pointee.logit.isFinite
        }
        if ok { return token }
        guard let logits = llama_get_logits_ith(ctx, -1) else { return nil }
        let n = candidates.count
        let picked: llama_token? = candidates.withUnsafeMutableBufferPointer { buf in
            for i in 0..<n { buf[i] = llama_token_data(id: llama_token(i), logit: logits[i], p: 0) }
            var arr = llama_token_data_array(data: buf.baseAddress, size: n, selected: -1, sorted: false)
            llama_sampler_apply(g, &arr)
            llama_sampler_apply(chain, &arr)
            guard arr.selected >= 0, Int(arr.selected) < arr.size, let d = arr.data else { return nil }
            let t = d[Int(arr.selected)]
            return t.logit.isFinite ? t.id : nil
        }
        guard let p = picked else { return nil }
        token = p
        return token
    }

    func accept(_ token: llama_token) {
        if let g = grammar { llama_sampler_accept(g, token) }
    }

    /// 由程序写入的 token（例如结束思考的提示）也要让惩罚采样器知道
    func acceptForced(_ token: llama_token) {
        llama_sampler_accept(chain, token)
    }
}

// MARK: - 输出

/// 把生成的文字攒一小段再发给网页（减少跨桥调用）；think 模式下把 </think> 之前的内容标成“思考过程”
final class TextEmitter {
    private var inThink: Bool
    private var recentThink = "" // 最近的思考内容，用来发现原地打转
    private var tail = ""
    private var pendingThink = ""
    private var pending = ""
    private var started = false
    private var last = Date()
    private let send: (String, Bool) -> Void

    init(think: Bool, send: @escaping (String, Bool) -> Void) {
        inThink = think
        self.send = send
    }

    var isThinking: Bool { inThink }

    /// 最近 40 个字在最近 3000 个字里出现了 3 次以上：模型在重复同一段话
    var isLooping: Bool {
        guard recentThink.count > 600 else { return false }
        let probe = String(recentThink.suffix(40))
        var count = 0
        var range = recentThink.startIndex..<recentThink.endIndex
        while let r = recentThink.range(of: probe, range: range) {
            count += 1
            if count >= 3 { return true }
            range = r.upperBound..<recentThink.endIndex
        }
        return false
    }

    func add(_ s: String) {
        if inThink {
            recentThink += s
            if recentThink.count > 3000 { recentThink = String(recentThink.suffix(3000)) }
            tail += s
            if let r = tail.range(of: "</think>") {
                pendingThink += String(tail[..<r.lowerBound])
                let after = String(tail[r.upperBound...])
                tail = ""
                inThink = false
                addContent(after)
            } else if tail.count > 8 {
                pendingThink += String(tail.dropLast(8))
                tail = String(tail.suffix(8))
            }
        } else {
            addContent(s)
        }
        if Date().timeIntervalSince(last) > 0.06 { flush() }
    }

    private func addContent(_ s: String) {
        var s = s
        if !started {
            s = String(s.drop(while: { $0 == "\n" }))
            if s.isEmpty { return }
            started = true
        }
        pending += s
    }

    func flush() {
        if !pendingThink.isEmpty { send(pendingThink, true); pendingThink = "" }
        if !pending.isEmpty { send(pending, false); pending = "" }
        last = Date()
    }

    func finish() {
        if inThink { pendingThink += tail; tail = "" }
        flush()
    }
}
