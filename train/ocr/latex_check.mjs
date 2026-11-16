// 过去问集：识别结果里的公式能不能在 App 里正常显示。
// 和 App 的预览用同一套渲染（public/lib/markdown.js 的 renderMarkdown + KaTeX，throwOnError: false），
// 显示成红字报错（katex-error）的公式算“显示出错”；另外数一下没有配对的 $。
//   node train/ocr/latex_check.mjs <结果名1> <结果名2> … [--list] [--set exam|exam2]（默认 exam）
// --list：列出出错的题号和 KaTeX 的报错（核对用）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EXAM_SETS } from '../../eval/exam-sets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
globalThis.katex = createRequire(import.meta.url)('katex');
const { renderMarkdown } = await import('../../public/lib/markdown.js');

const args = process.argv.slice(2);
const list = args.includes('--list');
const EXAM = EXAM_SETS[args.includes('--set') ? args[args.indexOf('--set') + 1] : 'exam'];
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--set');
if (!names.length) { console.error('用法：node train/ocr/latex_check.mjs <结果名> … [--list]'); process.exit(2); }

// 去掉成对的 $$…$$ 和 $…$ 之后还剩下的 $（App 会把它当普通文字显示出来）
const strayDollar = (t) => (t.replace(/\\\$/g, '').replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$]*\$/g, '').match(/\$/g) || []).length;

for (const name of names) {
  let bad = 0, stray = 0, missing = 0;
  const detail = [];
  for (const p of EXAM) {
    const f = path.join(ROOT, 'eval', 'exam', 'ocr', name, `${p.id}.json`);
    if (!fs.existsSync(f)) { missing++; continue; }
    const text = JSON.parse(fs.readFileSync(f, 'utf8')).text;
    const html = renderMarkdown(text);
    const errs = [...html.matchAll(/class="katex-error" title="([^"]*)"/g)].map((m) => m[1].replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    const s = strayDollar(text);
    if (errs.length) bad++;
    if (s) stray++;
    if (list && (errs.length || s)) detail.push(`  ${p.id}：${errs.length ? `显示出错 ${errs.length} 处（${errs.map((e) => e.slice(0, 80)).join('；')}）` : ''}${s ? ` 没配对的 $ ${s} 个` : ''}`);
  }
  console.log(`${name}：${EXAM.length - missing} 题里，有公式显示出错的 ${bad} 题，有没配对的 $ 的 ${stray} 题${missing ? `（缺 ${missing} 题的结果）` : ''}`);
  if (detail.length) console.log(detail.join('\n'));
}
