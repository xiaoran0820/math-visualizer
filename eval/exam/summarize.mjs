// 过去问集评测结果的汇总：总数，以及按识别结果（ocr-review.md 的 ✓ / △ / ✗）、大学、题型分开的完全正确数。
// 只输出汇总，不列逐题结果（过去问集只用来衡量）。
//   node eval/exam/summarize.mjs eval/results/<时间>.json [更多结果文件…] [--review eval/exam/ocr-review-v3.md]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAM } from '../exam.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// --review 文件：按哪一份识别核对结果分组（默认 ocr-review.md，原 2B 的识别结果）
const ri = process.argv.indexOf('--review');
const reviewFile = ri > 0 ? path.resolve(process.argv[ri + 1]) : path.join(HERE, 'ocr-review.md');
const review = Object.fromEntries([...fs.readFileSync(reviewFile, 'utf8').matchAll(/^\| ([a-z]+-20\d\d-\d) \| ([✓△✗]) \|/gm)].map((m) => [m[1], m[2]]));
const byId = Object.fromEntries(EXAM.map((p) => [p.id, p]));
const firstCorrect = (r) => !!r.firstChecks && r.firstChecks.every((c) => c.ok);
const frac = (rs, f) => `${rs.filter(f).length}/${rs.length}`;
const pct = (rs, f) => (rs.length ? `${Math.round((rs.filter(f).length / rs.length) * 100)}%` : '—');
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

const files = process.argv.slice(2).filter((a, i, all) => a !== '--review' && all[i - 1] !== '--review');
if (!files.length) { console.error('用法：node eval/exam/summarize.mjs eval/results/<时间>.json …'); process.exit(2); }
const groups = (rows, key) => {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.entries()];
};
for (const file of files) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const res of J.results) {
    const rows = res.rows.filter((r) => byId[r.id]);
    const ok = rows.filter((r) => !r.error);
    console.log(`\n## ${res.model}（${path.basename(file)}，${rows.length} 题次）\n`);
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
