// 把 HTML（题目文字 + KaTeX 公式）渲染成 PNG，用来做“看图识别”的训练图片。只用 macOS 自带的 WebKit。
//   render <任务.jsonl> <输出目录> <允许读取的根目录>
// 任务每行：{"id": "...", "file": "<HTML 文件的绝对路径>", "width": 1100}
// 输出 <输出目录>/<id>.png：宽度正好 width 像素，高度按内容（不按屏幕倍率放大）
import AppKit
import WebKit

struct Job: Decodable { let id: String; let file: String; let width: Int }

final class Renderer: NSObject, WKNavigationDelegate {
  let web: WKWebView
  let root: URL
  var pending: CheckedContinuation<Void, Error>?

  init(root: URL) {
    self.root = root
    web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1000, height: 800), configuration: WKWebViewConfiguration())
    super.init()
    web.navigationDelegate = self
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { pending?.resume(); pending = nil }
  func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { pending?.resume(throwing: error); pending = nil }
  func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { pending?.resume(throwing: error); pending = nil }

  @MainActor
  func render(_ job: Job, to url: URL) async throws {
    web.setFrameSize(NSSize(width: job.width, height: 800))
    try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
      pending = c
      web.loadFileURL(URL(fileURLWithPath: job.file), allowingReadAccessTo: root)
    }
    // 等字体加载完，再量内容高度
    let measured = try await web.callAsyncJavaScript("await document.fonts.ready; return Math.ceil(document.querySelector('.page').getBoundingClientRect().height);", contentWorld: .page) as? Double ?? 800
    let w = Double(job.width), h = max(40, measured)
    web.setFrameSize(NSSize(width: w, height: h))
    let conf = WKSnapshotConfiguration()
    conf.rect = NSRect(x: 0, y: 0, width: w, height: h)
    let img = try await web.takeSnapshot(configuration: conf)
    // 屏幕是 2 倍时快照也是 2 倍：画到一张正好 w×h 像素的图上
    var rect = NSRect(x: 0, y: 0, width: w, height: h)
    guard let cg = img.cgImage(forProposedRect: &rect, context: nil, hints: nil),
          let ctx = CGContext(data: nil, width: job.width, height: Int(h), bitsPerComponent: 8, bytesPerRow: 0,
                              space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
      throw NSError(domain: "render", code: 1)
    }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: job.width, height: Int(h)))
    ctx.interpolationQuality = .high
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: job.width, height: Int(h)))
    guard let out = ctx.makeImage(), let png = NSBitmapImageRep(cgImage: out).representation(using: .png, properties: [:]) else {
      throw NSError(domain: "render", code: 2)
    }
    try png.write(to: url)
  }
}

let args = CommandLine.arguments
guard args.count >= 4 else { print("用法：render <任务.jsonl> <输出目录> <允许读取的根目录>"); exit(2) }
let jobs = try String(contentsOfFile: args[1], encoding: .utf8).split(separator: "\n").map { try JSONDecoder().decode(Job.self, from: Data($0.utf8)) }
let outDir = URL(fileURLWithPath: args[2])
try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
let root = URL(fileURLWithPath: args[3], isDirectory: true)

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
Task { @MainActor in
  let r = Renderer(root: root)
  var done = 0, failed = 0
  for job in jobs {
    do {
      try await r.render(job, to: outDir.appendingPathComponent("\(job.id).png"))
      done += 1
    } catch {
      failed += 1
      FileHandle.standardError.write("失败 \(job.id)：\(error)\n".data(using: .utf8)!)
    }
    if (done + failed) % 200 == 0 { print("已渲染 \(done + failed)/\(jobs.count)") }
  }
  print("完成：成功 \(done)，失败 \(failed)")
  exit(failed > 0 && done == 0 ? 1 : 0)
}
app.run()
