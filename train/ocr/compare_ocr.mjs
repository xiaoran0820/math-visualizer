// 过去问集：把同一道题的几份识别结果并排列出来，供逐题对照原图核对。
//   node train/ocr/compare_ocr.mjs <结果名1> <结果名2> … [--only id1,id2]
// 结果名是 eval/exam/ocr/ 下的文件夹（如 qwen3.5_2b-q4_K_M、phone-base、shuxing-ocr-v1）。
// 和第一份完全相同的结果只标“同上”，不重复打印。第一份若在 ocr-review.md 里核对过，一并列出当时的结论。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAM } from '../../eval/exam.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const names = args.filter((a, i) => a !== '--only' && args[i - 1] !== '--only');
const reviewed = Object.fromEntries([...fs.readFileSync(path.join(ROOT, 'eval', 'exam', 'ocr-review.md'), 'utf8').matchAll(/^\| ([a-z]+-20\d\d-\d) \| ([✓△✗]) \| ([^|]*)\|/gm)].map((m) => [m[1], `${m[2]} ${m[3].trim()}`]));
const read = (name, id) => { const f = path.join(ROOT, 'eval', 'exam', 'ocr', name, `${id}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };

for (const p of EXAM.filter((x) => !only || only.includes(x.id))) {
  console.log(`\n######## ${p.id}（${p.univ} ${p.year} 第 ${p.no} 题）  图片 eval/${p.image}`);
  let first = null;
  names.forEach((name, i) => {
    const r = read(name, p.id);
    if (!r) { console.log(`=== ${name}：没有结果`); return; }
    const note = i === 0 && name === 'qwen3.5_2b-q4_K_M' && reviewed[p.id] ? `  〔已核对：${reviewed[p.id]}〕` : '';
    if (first !== null && r.text === first) { console.log(`=== ${name}：和 ${names[0]} 完全相同（${r.seconds?.toFixed?.(1) ?? '?'} 秒）`); return; }
    console.log(`=== ${name}（${r.seconds?.toFixed?.(1) ?? '?'} 秒${r.retried ? '，重新识别过' : ''}）${note}`);
    console.log(r.text);
    if (i === 0) first = r.text;
  });
}
