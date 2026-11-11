// 把过去问的 PDF 裁成每题一张图片（eval/exam/images/<题号>.png），供评测时识别。
//   node eval/exam/make-images.mjs            # 全部
//   node eval/exam/make-images.mjs todai-2024-1,kyodai-2026-3
// 需要 macOS（用 PDFKit 渲染，tools/pdftool.swift，第一次运行时编译）。
// 裁剪位置写在 eval/exam.js 的 src 里：按 100 DPI 渲染时的像素行；这里按 150 DPI 渲染，坐标乘 1.5。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EXAM } from '../exam.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DPI = 150, K = DPI / 100;
const swift = path.join(HERE, 'tools', 'pdftool.swift');
const tool = path.join(HERE, 'tools', 'build', 'pdftool');
if (!fs.existsSync(tool) || fs.statSync(tool).mtimeMs < fs.statSync(swift).mtimeMs) {
  fs.mkdirSync(path.dirname(tool), { recursive: true });
  execFileSync('xcrun', ['swiftc', '-O', '-o', tool, swift], { stdio: 'inherit' });
}
const run = (...args) => execFileSync(tool, args.map(String), { encoding: 'utf8' });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-'));
const outDir = path.join(HERE, 'images');
fs.mkdirSync(outDir, { recursive: true });
const pages = new Map();
function page(pdf, n) {
  const key = `${pdf}#${n}`;
  if (!pages.has(key)) {
    const file = path.join(tmp, `${pdf.replace(/\.pdf$/, '')}-p${n}.png`);
    run('render', path.join(HERE, 'pdf', pdf), n, DPI, file);
    pages.set(key, file);
  }
  return pages.get(key);
}

// 整页去掉上下空白和页码：有字的横条里，去掉在页面下方 12% 以内的（页码），取第一条到最后一条
function autoRange(file) {
  const out = run('bands', file, 38).trim().split('\n');
  const h = Number(/×(\d+)/.exec(out[0])[1]);
  const bands = out.slice(1).map((l) => /y (\d+)–(\d+)/.exec(l)).filter(Boolean).map((m) => [Number(m[1]), Number(m[2])]).filter(([a]) => a <= h * 0.88);
  return [Math.max(0, bands[0][0] - 18), Math.min(h, bands[bands.length - 1][1] + 21)];
}

const only = process.argv[2] ? process.argv[2].split(',') : null;
for (const p of EXAM.filter((x) => !only || only.includes(x.id))) {
  const segs = p.src.map(([pdf, n, y0, y1], i) => {
    const file = page(pdf, n);
    const [a, b] = y0 === 'auto' ? autoRange(file) : [Math.round(y0 * K), Math.round(y1 * K)];
    const seg = path.join(tmp, `${p.id}-${i}.png`);
    run('crop', file, a, b, seg);
    return seg;
  });
  const out = path.join(outDir, `${p.id}.png`);
  if (segs.length > 1) run('stack', out, ...segs);
  else fs.copyFileSync(segs[0], out);
  console.log(`${p.id}  ${run('bands', out, 1000).split('\n')[0].split('，')[0]}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
