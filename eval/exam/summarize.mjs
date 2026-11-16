// 过去问集评测结果的汇总：总数，以及按识别结果（ocr-review.md 的 ✓ / △ / ✗）、大学、题型分开的完全正确数。
// 只输出汇总，不列逐题结果（过去问集只用来衡量）。
//   node eval/exam/summarize.mjs eval/results/<时间>.json [更多结果文件…] [--review eval/exam/ocr-review-v3.md [--col 2]] [--split dev|test]
// --split：第二组只统计开发集或测试集
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_EXAM, EXAM_ID } from '../exam-sets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// --review 文件：按哪一份识别核对结果分组（默认 ocr-review.md，Ollama 原 2B 的识别结果）。
// --col n：用逐题表里第 n 个结论列（ocr-review-v3.md 第 1 列是手机引擎原模型，第 2 列是第三版识别）。
const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const reviewFile = opt('--review') ? path.resolve(opt('--review')) : path.join(HERE, 'ocr-review.md');
const col = Number(opt('--col') || 1);
const split = opt('--split');
const review = Object.fromEntries([...fs.readFileSync(reviewFile, 'utf8').matchAll(new RegExp(`^\\| (${EXAM_ID}) \\|(.*)$`, 'gm'))]
  .map((m) => [m[1], m[2].split('|').map((c) => c.trim()).filter((c) => /^[✓△✗]$/.test(c))[col - 1]])
  .filter(([, v]) => v));
console.log(`识别核对：${path.basename(reviewFile)} 第 ${col} 列（${Object.keys(review).length} 题）`);
const byId = Object.fromEntries(ALL_EXAM.map((p) => [p.id, p]));
const firstCorrect = (r) => !!r.firstChecks && r.firstChecks.every((c) => c.ok);
const frac = (rs, f) => `${rs.filter(f).length}/${rs.length}`;
const pct = (rs, f) => (rs.length ? `${Math.round((rs.filter(f).length / rs.length) * 100)}%` : '—');
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

const files = argv.filter((a, i) => !a.startsWith('--') && !['--review', '--col', '--split'].includes(argv[i - 1]));
if (!files.length) { console.error('用法：node eval/exam/summarize.mjs eval/results/<时间>.json …'); process.exit(2); }
const groups = (rows, key) => {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.entries()];
};
for (const file of files) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const res of J.results) {
    const rows = res.rows.filter((r) => byId[r.id] && (!split || byId[r.id].split === split));
    const ok = rows.filter((r) => !r.error);
    console.log(`\n## ${res.model}（${path.basename(file)}${split ? `，${split === 'dev' ? '开发集' : '测试集'}` : ''}，${rows.length} 题次）\n`);
    console.log('| | 完全正确 | 第一次生成就完全正确 | 平均调用 | 平均耗时 |\n|---|---|---|---|---|');
    const line = (name, rs) => console.log(`| ${name} | ${frac(rs, (r) => r.correct)}（${pct(rs, (r) => r.correct)}） | ${frac(rs, firstCorrect)} | ${avg(rs.filter((r) => !r.error).map((r) => r.calls)).toFixed(2)} | ${avg(rs.filter((r) => !r.error).map((r) => r.seconds)).toFixed(1)} 秒 |`);
    line('全部', rows);
    for (const v of ['✓', '△', '✗']) line(`识别 ${v}`, rows.filter((r) => review[r.id] === v));
    line('识别 ✓ 和 △（不影响题意）', rows.filter((r) => review[r.id] !== '✗'));
    line('需要图的题', rows.filter((r) => !JSON.stringify(byId[r.id].checks).includes('"plain"')));
    line('不需要图的题', rows.filter((r) => JSON.stringify(byId[r.id].checks).includes('"plain"')));
    console.log(`\n出错 ${rows.length - ok.length} 题次。`);
    console.log('\n| 大学 | 完全正确 |\n|---|---|');
    for (const [u, rs] of groups(rows, (r) => byId[r.id].univ)) console.log(`| ${u} | ${frac(rs, (r) => r.correct)} |`);
    console.log('\n| 题型 | 完全正确 |\n|---|---|');
    for (const [c, rs] of groups(rows, (r) => byId[r.id].category)) console.log(`| ${c} | ${frac(rs, (r) => r.correct)} |`);
  }
}
