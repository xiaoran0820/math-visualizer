// 把合并了 LoRA 的 GGUF 重新量化（用 App 里同一份 llama.cpp 的 llama_model_quantize，规则和原模型一样）。
//   sh quantize.sh 输入.gguf 输出.gguf [q4_K_M（默认）| q8_0]
import Foundation
import llama

let args = CommandLine.arguments
guard args.count == 3 || args.count == 4 else {
    FileHandle.standardError.write("用法：quantize 输入.gguf 输出.gguf [q4_K_M（默认）| q8_0]\n".data(using: .utf8)!)
    exit(2)
}
let kind = args.count == 4 ? args[3].lowercased() : "q4_k_m"
llama_backend_init()
var p = llama_model_quantize_default_params()
p.ftype = kind == "q8_0" ? LLAMA_FTYPE_MOSTLY_Q8_0 : LLAMA_FTYPE_MOSTLY_Q4_K_M
// 已经是目标类型的张量（合并时逐字节照抄的那些）llama.cpp 会原样保留；万一规则选了别的类型，允许从量化数据重新量化
p.allow_requantize = true
p.nthread = Int32(max(1, ProcessInfo.processInfo.activeProcessorCount - 2))
let t0 = Date()
let rc = llama_model_quantize(args[1], args[2], &p)
print(rc == 0 ? "量化完成，用时 \(String(format: "%.0f", Date().timeIntervalSince(t0))) 秒 → \(args[2])" : "量化失败（\(rc)）")
exit(rc == 0 ? 0 : 1)
