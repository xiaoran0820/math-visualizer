// 生成训练数据：按题型随机出题，参考答案（作图命令）由程序算出，再用 App 自己的引擎逐条校验。
//   node train/gen/build.js [每种写法每个题型的题数，默认 40] [随机种子，默认 1]
// 只收这样的题：命令全部能执行；从题目文字里提取出的条件全部满足；程序不需要再补画。
// 和开发集、保留题太像的题（字的三元组重合超过一半）自动去掉——评测时才能看出真实的泛化能力。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScene } from '../../public/lib/scene.js';
import { extractFacts, verifyFacts, completeFigure } from '../../public/lib/constraints.js';
import { PROBLEMS } from '../../eval/problems.js';
import { HOLDOUT } from '../../eval/holdout.js';
import { rng, style, chance } from './util.js';
import * as F from './functions.js';
import * as G from './geometry.js';
import * as O from './others.js';
import * as X from './more.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FAMILIES = {
  quadratic: F.quadratic, quadraticParam: F.quadraticParam, cubic: F.cubic, expLog: F.expLog, trig: F.trig, lineCurve: F.lineCurve,
  triangle: G.triangle, quadrilateral: G.quadrilateral, circleGeom: G.circleGeom, circleLine: G.circleLine, conic: G.conic, solid: G.solid,
  linearProgram: O.linearProgram, probability: O.probability, movingPoint: O.movingPoint, travel: O.travel,
  solveTriangle: X.solveTriangle, vectors: X.vectors, piecewise: X.piecewise, circleMore: X.circleMore, movingTriangle: X.movingTriangle,
};
// 有日文写法的题型（日本考题里常见的）
const JA = new Set(['quadratic', 'quadraticParam', 'cubic', 'trig', 'lineCurve', 'circleLine', 'linearProgram', 'solveTriangle']);

const grams = (s) => { const t = String(s).replace(/\s+/g, ''); const g = new Set(); for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3)); return g; };
const jaccard = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };
const EVAL = [...PROBLEMS, ...HOLDOUT].map((p) => grams(p.text));

export function validate(ex) {
  const scene = buildScene(ex.out.commands, {});
  if (scene.errors.length) return `命令出错：${scene.errors.map((e) => `第 ${e.line + 1} 行 ${e.src}：${e.message}`).join('；')}`;
  const drawable = scene.objects.some((o) => !['number', 'boolean', 'string'].includes(o.kind));
  if (!drawable) return '没有可画的东西';
  const extracted = extractFacts(ex.text);
  const v = verifyFacts(scene, extracted.facts);
  if (v.sat < v.total) return `条件 ${v.sat}/${v.total}：${v.results.filter((x) => x.ok === false).map((x) => `${x.fact.desc}（${x.detail}）`).join('；')}`;
  const done = completeFigure(ex.out.commands, extracted);
  if (done.added.length) return `程序还要补画：${done.added.map((a) => a.src).join('；')}`;
  ex.facts = v.total;
  return null;
}

export function generate(perStyle = 40, seed = 1, { log = console.log } = {}) {
  const r = rng(seed);
  const kept = [], seen = new Set(), stats = {};
  for (const [name, fn] of Object.entries(FAMILIES)) {
    const st = (stats[name] = { kept: 0, invalid: 0, dup: 0, nearEval: 0, skipped: 0, reasons: {} });
    for (const kind of ['plain', 'latex', ...(JA.has(name) ? ['ja'] : [])]) {
      const want = kind === 'ja' ? Math.ceil(perStyle / 2) : perStyle;
      for (let tries = 0, got = 0; got < want && tries < want * 6; tries++) {
        let ex;
        try { ex = fn(r, style(kind)); } catch (e) { st.invalid++; st.reasons[`异常：${e.message}`] = (st.reasons[`异常：${e.message}`] || 0) + 1; continue; }
        if (!ex) { st.skipped++; continue; }
        if (seen.has(ex.text)) { st.dup++; continue; }
        const g = grams(ex.text);
        if (EVAL.some((e) => jaccard(g, e) > 0.5)) { st.nearEval++; continue; }
        const why = validate(ex);
        if (why) { st.invalid++; const k = why.slice(0, 120); st.reasons[k] = (st.reasons[k] || 0) + 1; continue; }
        seen.add(ex.text);
        kept.push({ family: name, style: kind, ...ex });
        st.kept++; got++;
      }
    }
  }
  for (const [name, st] of Object.entries(stats)) {
    log(`${name.padEnd(15)} 收 ${String(st.kept).padStart(4)}  不合格 ${st.invalid}  重复 ${st.dup}  像评测题 ${st.nearEval}  跳过 ${st.skipped}`);
    for (const [k, n] of Object.entries(st.reasons).sort((a, b) => b[1] - a[1]).slice(0, 3)) log(`    ${n} × ${k}`);
  }
  return kept;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const per = Number(process.argv[2]) || 40, seed = Number(process.argv[3]) || 1;
  const list = generate(per, seed);
  const file = path.join(HERE, '..', 'data', `problems-${per}-${seed}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, list.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(`共 ${list.length} 题 → ${path.relative(process.cwd(), file)}`);
  void chance;
}
