// 为评测题集生成“题目照片”（带配图的题目图片），用于评测拍照识别。
// 用 macOS 自带的 Quick Look（qlmanage）把 SVG 渲染成 PNG。用法：node scripts/make-eval-images.js
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PROBLEMS } from '../eval/problems.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'eval', 'images');
fs.mkdirSync(dir, { recursive: true });

const W = 1000, PAD = 48, FS = 30, LH = 46;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const charW = (ch) => (/[\u0000-ÿ]/.test(ch) ? FS * 0.56 : FS);

function wrap(text, width) {
  const lines = [];
  let cur = '', w = 0;
  for (const ch of text) {
    const cw = charW(ch);
    if (w + cw > width && cur) { lines.push(cur); cur = ''; w = 0; }
    cur += ch;
    w += cw;
  }
  if (cur) lines.push(cur);
  return lines;
}

// 几道几何题配上示意图（教材风格：黑线、斜体字母）
const FIGURES = {
  isosceles: { pts: { A: [300, 60], B: [120, 300], C: [480, 300], D: [300, 300], E: [415, 213] }, segs: ['AB', 'AC', 'BC', 'AD', 'DE'], h: 360 },
  'right-median': { pts: { A: [140, 50], C: [140, 300], B: [473, 300], D: [306.5, 175] }, segs: ['AC', 'CB', 'AB', 'CD'], h: 360 },
  rectangle: { pts: { A: [180, 40], D: [360, 40], B: [180, 280], C: [360, 280], E: [240, 280], F: [190.6, 82.3] }, segs: ['AB', 'BC', 'CD', 'DA', 'AE', 'DF'], h: 340 },
  cube: { pts: { A: [130, 330], B: [380, 330], C: [470, 250], D: [220, 250], A1: [130, 90], B1: [380, 90], C1: [470, 10], D1: [220, 10], E: [380, 210] }, segs: ['AB', 'BC', 'AA1', 'BB1', 'CC1', 'A1B1', 'B1C1', 'C1D1', 'D1A1', 'AE', 'B1C'], dashed: ['AD', 'DC', 'DD1'], h: 380 },
};
const seg = (name, pts) => {
  const m = /^([A-Z]\d?)([A-Z]\d?)$/.exec(name);
  return [pts[m[1]], pts[m[2]]];
};

for (const p of PROBLEMS.filter((x) => x.image)) {
  const lines = wrap(`${PROBLEMS.indexOf(p) + 1}. ${p.text}`, W - 2 * PAD);
  const fig = FIGURES[p.id];
  const textH = PAD + lines.length * LH;
  const H = W; // 画布必须是正方形：Quick Look 生成的缩略图是正方形，非正方形会被放大裁切
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#fdfcf8"/>`;
  lines.forEach((l, i) => { svg += `<text x="${PAD}" y="${PAD + i * LH + FS * 0.4}" font-family="PingFang SC, Songti SC, sans-serif" font-size="${FS}" fill="#1b1b1b">${esc(l)}</text>`; });
  if (fig) {
    const ox = (W - 600) / 2, oy = textH + 10;
    const T = ([x, y]) => [x + ox, y + oy];
    for (const s of fig.segs) { const [a, b] = seg(s, fig.pts).map(T); svg += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#1b1b1b" stroke-width="2.5"/>`; }
    for (const s of fig.dashed || []) { const [a, b] = seg(s, fig.pts).map(T); svg += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#1b1b1b" stroke-width="2" stroke-dasharray="8 6"/>`; }
    for (const [n, xy] of Object.entries(fig.pts)) {
      const [x, y] = T(xy);
      const label = n.length > 1 ? `${n[0]}<tspan font-size="18" dy="6">${n.slice(1)}</tspan>` : n;
      svg += `<text x="${x + 8}" y="${y - 8}" font-family="Times New Roman, serif" font-style="italic" font-size="28" fill="#1b1b1b">${label}</text>`;
    }
  }
  svg += '</svg>';
  const svgPath = path.join(dir, `${p.id}.svg`);
  fs.writeFileSync(svgPath, svg);
  execFileSync('qlmanage', ['-t', '-s', String(W), '-o', dir, svgPath], { stdio: 'ignore' });
  fs.renameSync(path.join(dir, `${p.id}.svg.png`), path.join(dir, `${p.id}.png`));
  fs.unlinkSync(svgPath);
  console.log(`生成 eval/images/${p.id}.png`);
}
