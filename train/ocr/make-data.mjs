// 生成“看图识别”的训练数据：题目文字 → 排版成 HTML → 渲染成图片（render.swift）→ 做成拍照/扫描的样子（augment.py）
// → mlx-vlm 的训练数据（train/data/ocr/train.jsonl、valid.jsonl）和识别评测集（train/data/ocr-test.jsonl，带标准答案）。
//   node train/ocr/make-data.mjs [训练条数，默认 2000]
// 提示词与 App 识别时发出的一字不差（public/lib/prompts.js 的 OCR_SYSTEM、ocrUserText）。
// 和开发集、保留集、新题型集、过去问集（用识别出的文字）太像的题自动去掉。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rng, pick } from '../gen/util.js';
import { sample, generatorProblems, fromText } from './texts.mjs';
import { OCR_SYSTEM, OCR_RETRY_HINT, ocrUserText } from '../../public/lib/prompts.js';
import { PROBLEMS } from '../../eval/problems.js';
import { HOLDOUT } from '../../eval/holdout.js';
import { FRESH } from '../../eval/fresh.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BUILD = path.join(HERE, 'build');
const DATA = path.join(HERE, '..', 'data', 'ocr');
const katexCss = `file://${path.join(ROOT, 'node_modules', 'katex', 'dist', 'katex.min.css')}`;
const N = Number(process.argv[2]) || 2000;
const SPLITS = { train: { n: N, seed: 101 }, valid: { n: Math.max(60, Math.round(N / 20)), seed: 202 }, test: { n: 150, seed: 303 } };

// 和评测题太像的去掉（字的三元组重合超过一半）
const grams = (s) => { const t = String(s).replace(/\s+/g, ''); const g = new Set(); for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3)); return g; };
const jaccard = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
const examOcr = path.join(ROOT, 'eval', 'exam', 'ocr', 'qwen3.5_2b-q4_K_M');
const EVAL = [...PROBLEMS, ...HOLDOUT, ...FRESH].map((p) => p.text)
  .concat(fs.existsSync(examOcr) ? fs.readdirSync(examOcr).map((f) => JSON.parse(fs.readFileSync(path.join(examOcr, f), 'utf8')).text) : [])
  .map(grams);

const gen = generatorProblems(7);
const seenText = new Set();
let nearEval = 0;
for (const [split, { n, seed }] of Object.entries(SPLITS)) {
  const r = rng(seed);
  const htmlDir = path.join(BUILD, 'html', split), pngDir = path.join(BUILD, 'png', split), imgDir = path.join(DATA, 'images', split);
  for (const d of [htmlDir, pngDir, imgDir]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
  const items = [];
  while (items.length < n) {
    const ja = r() < 0.55;
    let s;
    if (r() < 0.65) s = sample(r, 'exam', ja, katexCss);
    else {
      const pool = gen.filter((g) => g.ja === ja);
      const g = pick(r, pool);
      s = sample(r, fromText(r, g.text, ja), ja, katexCss);
    }
    if (split !== 'train' && seenText.has(s.text)) continue; // 评测、验证用的题不和训练题完全相同
    const g = grams(s.text);
    if (EVAL.some((e) => jaccard(g, e) > 0.5)) { nearEval++; continue; }
    const id = `${split}-${String(items.length).padStart(5, '0')}`;
    fs.writeFileSync(path.join(htmlDir, `${id}.html`), s.html);
    items.push({ id, ...s, html: undefined });
    if (split === 'train') seenText.add(s.text);
  }
  const jobs = path.join(BUILD, `jobs-${split}.jsonl`);
  fs.writeFileSync(jobs, items.map((it) => JSON.stringify({ id: it.id, file: path.join(htmlDir, `${it.id}.html`), width: it.width })).join('\n') + '\n');
  execFileSync(path.join(BUILD, 'render'), [jobs, pngDir, ROOT], { stdio: 'inherit' });
  const list = path.join(BUILD, `list-${split}.txt`);
  fs.writeFileSync(list, items.map((it) => it.id).join('\n') + '\n');
  execFileSync(path.join(HERE, '..', '.venv', 'bin', 'python'), ['-I', path.join(HERE, 'augment.py'), pngDir, imgDir, list], { stdio: 'inherit' });

  const out = items.map((it) => {
    const image = path.join(imgDir, `${it.id}.jpg`);
    if (split === 'test') return { id: it.id, image, text: it.text, lang: it.lang, figure: it.figure };
    const retry = r() < 0.05; // 少量样本用 App“文字太少，重新识别”时的说法
    return { images: [image], messages: [{ role: 'system', content: OCR_SYSTEM }, { role: 'user', content: ocrUserText(retry ? OCR_RETRY_HINT : '') }, { role: 'assistant', content: it.text }] };
  });
  // 评测集放在训练数据文件夹外面（mlx-vlm 会把文件夹里的 test.jsonl 当成一个数据集）
  fs.writeFileSync(split === 'test' ? path.join(DATA, '..', 'ocr-test.jsonl') : path.join(DATA, `${split}.jsonl`), out.map((x) => JSON.stringify(x)).join('\n') + '\n');
  const ja = items.filter((x) => x.lang === 'ja').length, fig = items.filter((x) => x.figure).length;
  console.log(`${split}：${items.length} 张（日文 ${ja}、中文 ${items.length - ja}，带图 ${fig}）`);
}
console.log(`和评测题太像而去掉 ${nearEval} 道；数据在 ${path.relative(ROOT, DATA)}/`);
