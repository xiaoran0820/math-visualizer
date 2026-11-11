// PDF / 图片小工具（只用 macOS 自带的 PDFKit、CoreGraphics）：
//   pdftool info   a.pdf                     页数、每页大小、旋转、能取出的文字数
//   pdftool render a.pdf 页码 dpi out.png      渲染整页（按页面的旋转摆正）
//   pdftool bands  a.png [最小空白行数]        有字的横条（像素行范围），用来找题与题之间的空白
//   pdftool crop   a.png y0 y1 out.png [x0 x1]  裁出像素行 y0～y1（可选列 x0～x1）
//   pdftool stack  out.png a.png b.png …      竖着拼接（宽度取最大，白底）
import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments
func fail(_ s: String) -> Never { FileHandle.standardError.write((s + "\n").data(using: .utf8)!); exit(1) }
func loadPNG(_ path: String) -> CGImage {
  guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
        let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fail("读不了 \(path)") }
  return img
}
func savePNG(_ img: CGImage, _ path: String) {
  let rep = NSBitmapImageRep(cgImage: img)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
  print("\(path)  \(img.width)×\(img.height)")
}
func canvas(_ w: Int, _ h: Int) -> CGContext {
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  return ctx
}
// 灰度像素（行优先，从上到下）
func gray(_ img: CGImage) -> [UInt8] {
  let w = img.width, h = img.height
  var buf = [UInt8](repeating: 255, count: w * h)
  let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                      space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
  return buf
}

switch args.count >= 2 ? args[1] : "" {
case "info":
  guard let doc = PDFDocument(url: URL(fileURLWithPath: args[2])) else { fail("读不了 PDF") }
  print("页数 \(doc.pageCount)")
  for i in 0..<doc.pageCount {
    let p = doc.page(at: i)!
    let b = p.bounds(for: .mediaBox)
    print("第 \(i + 1) 页  \(Int(b.width))×\(Int(b.height))  旋转 \(p.rotation)  文字 \((p.string ?? "").count) 字")
  }
case "render":
  guard let doc = PDFDocument(url: URL(fileURLWithPath: args[2])) else { fail("读不了 PDF") }
  let p = doc.page(at: Int(args[3])! - 1)!, scale = Double(args[4])! / 72.0
  let b = p.bounds(for: .mediaBox)
  let quarter = (p.rotation / 90) % 2 == 1
  let w = Int((quarter ? b.height : b.width) * scale), h = Int((quarter ? b.width : b.height) * scale)
  // thumbnail 会按页面的旋转摆正（和“预览”看到的一样）
  let thumb = p.thumbnail(of: NSSize(width: w, height: h), for: .mediaBox)
  var rect = CGRect(x: 0, y: 0, width: w, height: h)
  let cg = thumb.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
  let ctx = canvas(cg.width, cg.height)
  ctx.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
  savePNG(ctx.makeImage()!, args[5])
case "bands":
  let img = loadPNG(args[2]), w = img.width, h = img.height, px = gray(img)
  let minGap = args.count >= 4 ? Int(args[3])! : 12
  var ink = [Int](repeating: 0, count: h)
  for y in 0..<h { var n = 0; for x in 0..<w where px[y * w + x] < 160 { n += 1 }; ink[y] = n }
  var start = -1, gap = 0, bands: [(Int, Int, Int)] = []
  var sum = 0
  for y in 0..<h {
    if ink[y] > 0 {
      if start < 0 { start = y; sum = 0 }
      sum += ink[y]; gap = 0
    } else if start >= 0 {
      gap += 1
      if gap >= minGap { bands.append((start, y - gap, sum)); start = -1 }
    }
  }
  if start >= 0 { bands.append((start, h - 1 - gap, sum)) }
  print("\(w)×\(h)，有字的横条 \(bands.count) 段")
  for (a, b, s) in bands { print("  y \(a)–\(b)（高 \(b - a + 1)，墨量 \(s)）") }
case "crop":
  let img = loadPNG(args[2])
  let y0 = Int(args[3])!, y1 = Int(args[4])!
  let x0 = args.count >= 8 ? Int(args[6])! : 0, x1 = args.count >= 8 ? Int(args[7])! : img.width
  savePNG(img.cropping(to: CGRect(x: x0, y: y0, width: x1 - x0, height: y1 - y0))!, args[5])
case "stack":
  let imgs = args[3...].map(loadPNG)
  let w = imgs.map(\.width).max()!, h = imgs.map(\.height).reduce(0, +)
  let ctx = canvas(w, h)
  var top = h
  for img in imgs { top -= img.height; ctx.draw(img, in: CGRect(x: 0, y: top, width: img.width, height: img.height)) }
  savePNG(ctx.makeImage()!, args[2])
default:
  fail("用法见文件开头")
}
