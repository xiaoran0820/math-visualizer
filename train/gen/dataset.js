// 把生成的题目整理成 MLX 微调用的对话数据（train.jsonl / valid.jsonl）。
//   node train/gen/dataset.js [每种写法每个题型的题数，默认 30] [随机种子，默认 7]
// 两类样本，提示词与 App 实际发出的一字不差（public/lib/prompts.js）：
//   1. 分析：系统提示（微调模型用的短提示）+ 题目 → 分析 JSON
//   2. 修正：把正确的命令故意改错（坐标、函数式、命令名），附上引擎报的错误和核对出的问题 → 正确的命令
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene } from '../../public/lib/scene.js';
import { extractFacts, verifyFacts, describeViolations } from '../../public/lib/constraints.js';
import { ANALYZE_SYSTEM_TUNED, analyzeUserText, repairUserText } from '../../public/lib/prompts.js';
import { generate, validate } from './build.js';
import { rng, pick, shuffle } from './util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// 把一条命令改错：返回改错后的命令列表，或 null（这道题没有合适的改法）
const RENAMES = [['Foot(', 'PerpFoot('], ['Midpoint(', 'MidPoint('], ['Intersect(', 'Intersection('], ['Polygon(', 'Triangle('], ['Segment(', 'Line Segment('], ['Vertex(', 'Top(']];
function corrupt(r, cmds) {
  const out = cmds.slice();
  const kinds = shuffle(r, ['coord', 'rename', 'formula', 'drop']);
  for (const kind of kinds) {
    if (kind === 'coord') {
      // 给定坐标的点挪一下（题目里的长度、垂直关系就不成立了）
      const idx = out.map((c, i) => (/^[A-Z]\d?'? = \(-?[\d.]+, -?[\d.]+(, -?[\d.]+)?\)/.test(c) ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      const i = pick(r, idx);
      out[i] = out[i].replace(/\((-?[\d.]+), (-?[\d.]+)/, (_, x, y) => `(${Math.round((Number(x) + pick(r, [1, -1, 0.5])) * 10) / 10}, ${Math.round((Number(y) + pick(r, [-1, 1, 2])) * 10) / 10}`);
      return out;
    }
    if (kind === 'rename') {
      const opts = RENAMES.filter(([a]) => out.some((c) => c.includes(a)));
      if (!opts.length) continue;
      const [a, b] = pick(r, opts);
      const i = out.findIndex((c) => c.includes(a));
      out[i] = out[i].replace(a, b);
      return out;
    }
    if (kind === 'formula') {
      // 函数、方程里的一个系数写错
      const i = out.findIndex((c) => /^(?:[a-z]\(x\) = |[A-Za-z]\d?: )/.test(c) && /\d/.test(c) && !/Slider|Function\(|If\(/.test(c));
      if (i < 0) continue;
      const m = [...out[i].matchAll(/(?<![\^.\d])(\d+)(?![.\d])/g)].filter((x) => x.index > out[i].indexOf('=') + 1);
      if (!m.length) continue;
      const t = pick(r, m);
      const v = Number(t[1]), nv = v + pick(r, [1, 2, -1].filter((d) => v + d > 0));
      out[i] = out[i].slice(0, t.index) + String(nv) + out[i].slice(t.index + t[1].length);
      return out;
    }
    if (kind === 'drop') {
      // 删掉一条定义（后面引用它的命令就会报错）
      const idx = out.map((c, i) => (/^[A-Z]\d? = (Midpoint|Foot|Intersect|Centroid)\(/.test(c) ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      out.splice(pick(r, idx), 1);
      return out;
    }
  }
  return null;
}

export function repairExample(r, ex) {
  const bad = corrupt(r, ex.out.commands);
  if (!bad) return null;
  const scene = buildScene(bad, {});
  const errors = scene.errors.map((e) => ({ line: e.line, src: e.src, message: e.message }));
  const issues = describeViolations(verifyFacts(scene, extractFacts(ex.text).facts).results);
  if (!errors.length && !issues.length) return null; // 改了也看不出来：不当作修正样本
  return {
    messages: [
      { role: 'system', content: ANALYZE_SYSTEM_TUNED },
      { role: 'user', content: repairUserText(ex.text, bad, errors, issues) },
      { role: 'assistant', content: JSON.stringify({ commands: ex.out.commands }) },
    ],
  };
}

export const analysisExample = (ex) => ({
  messages: [
    { role: 'system', content: ANALYZE_SYSTEM_TUNED },
    { role: 'user', content: analyzeUserText(ex.text, '', false) },
    { role: 'assistant', content: JSON.stringify(ex.out) },
  ],
});

// 第三版：把一部分题目写成“识别结果”的样子——加上题号（日本考题的 [3]、第 2 問、〔1〕（配点 50 点），中文的 1. 等），
// 把最后的问句拆成小问 (1)，偶尔带上识别时多出来的说明。作图的答案不变；包装后重新用引擎校验，不通过就用原文。
export function examWrap(r, ex) {
  if (ex.style === 'plain') return null;
  const ja = ex.style === 'ja', n = 1 + Math.floor(r() * 6);
  const head = pick(r, ja ? [`[${n}]`, `[${n}]（30 点）`, `第 ${n} 問`, `〔${n}〕（配点 50 点）`, `問 ${n}`, null] : [`${n}.`, `${n}．（本小题满分 12 分）`, `第 ${n} 题`, null]);
  let body = ex.text;
  const m = ja ? /^(.*。)([^。]*(?:求めよ|示せ)。)$/.exec(body) : /^(.*?)，(求[^，。]*。)$/.exec(body);
  if (m && r() < 0.7) body = ja ? `${m[1]}\n(1) ${m[2]}` : `${m[1]}。\n(1) ${m[2]}`;
  let text = [head, body].filter(Boolean).join('\n');
  const noise = r();
  if (noise < 0.06) text = `根据图片内容，以下是完整的数学题：\n\n${text}`;
  else if (noise < 0.12) text = `${text}\n\n【图形】\n没有图形。`;
  return text === ex.text ? null : text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const per = Number(process.argv[2]) || 30, seed = Number(process.argv[3]) || 7;
  const problems = generate(per, seed);
  const r = rng(seed * 101 + 1);
  let wrapped = 0;
  const items = problems.map((ex) => {
    if (r() < 0.3) {
      const text = examWrap(r, ex);
      if (text && !validate({ ...ex, text })) { wrapped++; return { kind: 'analyze', family: ex.family, ...analysisExample({ ...ex, text }) }; }
    }
    return { kind: 'analyze', family: ex.family, ...analysisExample(ex) };
  });
  let repairs = 0;
  for (const ex of problems) {
    if (r() > 0.2) continue; // 约两成的题再做一个修正样本
    const rep = repairExample(r, ex);
    if (rep) { items.push({ kind: 'repair', family: ex.family, ...rep }); repairs++; }
  }
  const all = shuffle(r, items);
  const nValid = Math.max(20, Math.round(all.length * 0.05));
  const dir = path.join(HERE, '..', 'data', 'mlx');
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, list) => fs.writeFileSync(path.join(dir, name), list.map(({ messages }) => JSON.stringify({ messages })).join('\n') + '\n');
  write('valid.jsonl', all.slice(0, nValid));
  write('train.jsonl', all.slice(nValid));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ per, seed, problems: problems.length, repairs, train: all.length - nValid, valid: nValid,
    families: Object.fromEntries(Object.entries(problems.reduce((m, x) => ((m[x.family] = (m[x.family] || 0) + 1), m), {}))) }, null, 2));
  console.log(`题目 ${problems.length}（其中 ${wrapped} 道写成识别结果的样子），修正样本 ${repairs}；训练 ${all.length - nValid}，验证 ${nValid} → ${path.relative(process.cwd(), dir)}`);

  // 每个命令在多少道题里出现过：出现太少的命令模型学不会写法（第一版里 Cylinder 只有 4 道题，开发集的圆柱题就写错了）
  const listed = /可用的命令：\n([\s\S]*?)，标记/.exec(ANALYZE_SYSTEM_TUNED)?.[1].split(/\s+/).filter(Boolean) || [];
  const count = Object.fromEntries(listed.map((c) => [c, 0]));
  for (const ex of problems) {
    const text = ex.out.commands.join('\n');
    for (const c of listed) if (new RegExp(`(?<![A-Za-z])${c}(?![A-Za-z])`).test(text)) count[c]++;
  }
  const rare = Object.entries(count).filter(([, n]) => n < 30).sort((a, b) => a[1] - b[1]);
  console.log(`命令覆盖：${listed.length} 个命令里，出现不到 30 道题的有 ${rare.length} 个${rare.length ? `：${rare.map(([c, n]) => `${c} ${n}`).join('、')}` : ''}`);
}
