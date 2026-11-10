// 模型评测：用固定题集，按 App 的真实流程（public/lib/pipeline.js，经过本项目的接口）测试本地模型。
// 指标：完全符合题意（几何检验全部满足）、几何条件满足率、命令是否出错、调用模型的次数与总耗时、OCR 准确率、内存。
//
//   npm run eval                                        # 默认：VISION_MODEL，开发题集，当前流程（best3）
//   node scripts/eval.js --models qwen3.5:4b-q4_K_M,qwen3.5:2b-q4_K_M --pipelines baseline,best3 --set all
//   node scripts/eval.js --only isosceles,cube --no-ocr --runs 3
//
// --set        dev（eval/problems.js，默认）| holdout（eval/holdout.js）| all
// --pipelines  baseline（改进前：生成一次，出错时修正一次）| verified（核对 + 补全 + 针对性修正）| best3（再加最多两次重新生成）
// 需要 Ollama 正在运行。结果写入 eval/results/。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { config } from '../src/llm.js';
import { createApi } from '../public/lib/api.js';
import { buildScene } from '../public/lib/scene.js';
import { runPipeline, PIPELINE_PRESETS } from '../public/lib/pipeline.js';
import { describeViolations } from '../public/lib/constraints.js';
import { PROBLEMS } from '../eval/problems.js';
import { HOLDOUT } from '../eval/holdout.js';
import { runChecks } from '../eval/checks.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, d) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const models = arg('models', config.visionModel).split(',').map((s) => s.trim()).filter(Boolean);
const pipelines = arg('pipelines', 'best3').split(',').map((s) => s.trim()).filter(Boolean);
for (const p of pipelines) if (!PIPELINE_PRESETS[p]) { console.error(`未知的流程：${p}（可选 ${Object.keys(PIPELINE_PRESETS).join('、')}）`); process.exit(1); }
const only = arg('only', '') ? arg('only', '').split(',') : null;
const withOcr = !process.argv.includes('--no-ocr');
const runsN = Math.max(1, Number(arg('runs', 1)) || 1);
const setName = arg('set', 'dev');
const SETS = { dev: PROBLEMS.map((p) => ({ ...p, set: 'dev' })), holdout: HOLDOUT.map((p) => ({ ...p, set: 'holdout' })) };
const problems = (setName === 'all' ? [...SETS.dev, ...SETS.holdout] : SETS[setName] || []).filter((p) => !only || only.includes(p.id));
if (!problems.length) { console.error('没有要评测的题目'); process.exit(1); }

// ---------- 通过本项目的接口调用模型（与 App 相同） ----------
const server = await new Promise((r) => { const s = createApp({ maxConcurrent: 4 }).listen(0, '127.0.0.1', () => r(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const api = createApi({ baseUrl: base });

async function recognizeText(image, model) {
  const t0 = Date.now();
  let text = '';
  await api.recognize({ image, model }, undefined, (ev) => { if (ev.t === 'delta') text += ev.v; });
  return { text, seconds: (Date.now() - t0) / 1000 };
}

// ---------- OCR 准确率：把 LaTeX 记号还原成符号后，比较“有内容的字符”的编辑距离 ----------
const TEX = { '\\triangle': '△', '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥', '\\odot': '⊙', '\\pi': 'π', '\\sqrt': '√', '\\le': '≤', '\\leq': '≤', '\\ge': '≥', '\\geq': '≥', '\\circ': '°', '\\cdot': '·', '\\times': '×', '\\to': '→', '\\rightarrow': '→' };
function contentChars(s) {
  let t = String(s).replace(/【图形】[\s\S]*$/, '');
  t = t.replace(/\\(?:d|t)?frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2').replace(/\^\{?2\}?/g, '²').replace(/_\{?(\d)\}?/g, '$1');
  for (const [k, v] of Object.entries(TEX)) t = t.split(k).join(v);
  t = t.replace(/\\[a-zA-Z]+/g, '');
  return [...t].filter((c) => /[一-龥A-Za-z0-9²√π△∠⊥∥°≤≥]/.test(c) || '₀₁₂₃₄₅₆₇₈₉'.includes(c)).map((c) => ('₀₁₂₃₄₅₆₇₈₉'.includes(c) ? String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)) : c));
}
function levenshtein(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const ocrAccuracy = (truth, got) => { const a = contentChars(truth), b = contentChars(got); return a.length ? Math.max(0, 1 - levenshtein(a, b) / a.length) : 0; };

const drawable = (s) => s.objects.some((o) => !['number', 'boolean', 'string'].includes(o.kind));

// ---------- 单题评测 ----------
async function evalProblem(model, pipeline, p, doOcr) {
  const r = { id: p.id, category: p.category, set: p.set, pipeline };
  if (withOcr && doOcr && p.image) {
    try {
      const img = fs.readFileSync(path.join(root, 'eval', 'images', `${p.id}.png`)).toString('base64');
      const o = await recognizeText(`data:image/png;base64,${img}`, model);
      r.ocr = { accuracy: ocrAccuracy(p.text, o.text), seconds: o.seconds, text: o.text };
    } catch (e) { r.ocr = { accuracy: 0, error: e.message }; }
  }
  // 分析一律使用题目原文，让“识别”和“作图”两项能力分开衡量
  let firstCommands = null;
  const t0 = Date.now();
  let out;
  try {
    out = await runPipeline({
      text: p.text, model, api, options: PIPELINE_PRESETS[pipeline],
      onEvent: (ev) => { if (ev.type === 'analyze-done' && ev.attempt === 1 && ev.candidate) firstCommands = ev.candidate.modelCommands; },
    });
  } catch (e) {
    r.error = e.message;
    return r;
  }
  r.seconds = (Date.now() - t0) / 1000;
  r.calls = out.calls;
  r.attempts = out.attempts;
  const first = out.attempts.find((a) => a.kind === 'analyze');
  r.json = first?.invalid ? 'bad' : 'ok';
  r.analyzeSeconds = first?.seconds;
  r.tokensPerSecond = first?.tokensPerSecond;
  if (firstCommands) {
    const fs0 = buildScene(firstCommands, {});
    r.firstErrors = fs0.errors.length;
    r.firstOk = fs0.errors.length === 0 && drawable(fs0);
    r.firstChecks = runChecks(fs0, p.checks);
  }
  const rep = out.attempts.find((a) => a.kind === 'repair');
  if (rep) r.repair = { accepted: rep.accepted, reason: rep.reason, seconds: rep.seconds };
  const best = out.best;
  r.source = best.source;
  r.commands = firstCommands;
  r.finalCommands = best.commands;
  r.finalErrors = best.errors.length;
  r.finalOk = best.errors.length === 0 && best.drawable;
  r.checks = runChecks(best.scene, p.checks);
  r.correct = r.checks.every((c) => c.ok);
  if (out.extracted) r.facts = { sat: best.sat, total: best.total, added: best.added.map((a) => a.src), violated: describeViolations(best.results) };
  return r;
}

async function loadedMemory(model) {
  try {
    const ps = await fetch(`${config.ollamaHost}/api/ps`).then((x) => x.json());
    const m = (ps.models || []).find((x) => x.name === model || x.model === model);
    return m ? m.size : null;
  } catch { return null; }
}

// ---------- 主流程 ----------
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
function summarize(rows) {
  const ok = rows.filter((r) => !r.error);
  const allChecks = ok.flatMap((r) => r.checks);
  const facts = ok.filter((r) => r.facts);
  return {
    problems: rows.length,
    errors: rows.length - ok.length,
    jsonValid: ok.filter((r) => r.json !== 'bad').length / rows.length,
    firstPassRate: ok.filter((r) => r.firstOk).length / rows.length,
    repairTried: ok.filter((r) => r.repair).length,
    repairAccepted: ok.filter((r) => r.repair?.accepted).length,
    finalRunnableRate: ok.filter((r) => r.finalOk).length / rows.length,
    checkPassRate: allChecks.filter((c) => c.ok).length / (allChecks.length || 1),
    fullyCorrectRate: ok.filter((r) => r.correct).length / rows.length,
    calls: avg(ok.map((r) => r.calls)),
    seconds: avg(ok.map((r) => r.seconds)),
    factsSatRate: facts.length ? facts.reduce((s, r) => s + r.facts.sat, 0) / (facts.reduce((s, r) => s + r.facts.total, 0) || 1) : NaN,
    completed: facts.filter((r) => r.facts.added.length).length,
  };
}

const results = [];
for (const model of models) {
  process.stdout.write(`\n== ${model}\n  预热（加载模型）…`);
  try { await api.analyze({ text: '求 1 + 1 的值。', model }, undefined, () => {}); } catch (e) { console.log(` 失败：${e.message}`); continue; }
  console.log(' 完成');
  const rows = [];
  for (const pipeline of pipelines) {
    console.log(`  -- 流程 ${pipeline}`);
    for (const p of problems) for (let k = 1; k <= runsN; k++) {
      const r = await evalProblem(model, pipeline, p, k === 1 && pipeline === pipelines[0]); // 识别结果几乎是确定的，只评测一次 OCR
      r.run = k;
      rows.push(r);
      const mark = r.error ? `出错 ${r.error}` : [
        r.firstOk ? '首次成功' : `首次 ${r.firstErrors ?? '?'} 处错误`,
        r.repair ? (r.repair.accepted ? '修正已采用' : `修正未采用（${r.repair.reason}）`) : '',
        r.calls > 1 ? `共 ${r.calls} 次调用` : '',
        r.facts ? `题目条件 ${r.facts.sat}/${r.facts.total}${r.facts.added.length ? `，补 ${r.facts.added.length} 处` : ''}` : '',
        `检验 ${r.checks.filter((c) => c.ok).length}/${r.checks.length}${r.correct ? ' ✓' : ''}`,
      ].filter(Boolean).join(' · ');
      console.log(`    ${(runsN > 1 ? `${p.id}#${k}` : p.id).padEnd(15)} ${mark}${r.ocr ? ` · OCR ${pct(r.ocr.accuracy)}` : ''} · ${(r.seconds || 0).toFixed(1)}s`);
    }
  }
  const ocrRows = rows.filter((r) => r.ocr && r.ocr.accuracy !== undefined);
  results.push({
    model,
    ocrAccuracy: avg(ocrRows.map((r) => r.ocr.accuracy)),
    tokensPerSecond: avg(rows.filter((r) => r.tokensPerSecond).map((r) => r.tokensPerSecond)),
    memoryBytes: await loadedMemory(model),
    byPipeline: pipelines.map((pipeline) => {
      const prs = rows.filter((r) => r.pipeline === pipeline);
      const sets = setName === 'all' ? ['dev', 'holdout'] : [setName];
      return { pipeline, all: summarize(prs), bySet: Object.fromEntries(sets.map((s) => [s, summarize(prs.filter((r) => r.set === s))])) };
    }),
    rows,
  });
}
server.close();

// ---------- 报告 ----------
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, 'eval', 'results');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify({ date: new Date().toISOString(), set: setName, problems: problems.map((p) => p.id), pipelines, withOcr, runs: runsN, results }, null, 2));
const gb = (b) => (b ? `${(b / 1e9).toFixed(1)} GB` : '—');
const SET_NAME = { dev: '开发集', holdout: '保留集' };
let md = `# 模型评测 ${new Date().toLocaleString('zh-CN')}\n\n题集：${setName === 'all' ? '开发集 + 保留集' : SET_NAME[setName]}，共 ${problems.length} 道${runsN > 1 ? `，每题重复 ${runsN} 次` : ''}；流程：${pipelines.join('、')}\n\n`;
md += '| 模型 | 流程 | 题集 | 完全符合题意 | 几何条件满足 | 最终无错误 | 首次作图成功 | 修正采用 | 题目条件满足 | 程序补全 | 平均调用次数 | 平均耗时 |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const res of results) for (const bp of res.byPipeline) {
  for (const [set, s] of Object.entries(bp.bySet)) {
    md += `| ${res.model} | ${bp.pipeline} | ${SET_NAME[set]} | ${pct(s.fullyCorrectRate)} | ${pct(s.checkPassRate)} | ${pct(s.finalRunnableRate)} | ${pct(s.firstPassRate)} | ${s.repairAccepted}/${s.repairTried} | ${pct(s.factsSatRate)} | ${s.completed} 题 | ${Number.isFinite(s.calls) ? s.calls.toFixed(1) : '—'} | ${Number.isFinite(s.seconds) ? `${s.seconds.toFixed(1)} 秒` : '—'} |\n`;
  }
}
md += '\n| 模型 | OCR 准确率 | 生成速度 | 内存 |\n|---|---|---|---|\n';
for (const res of results) md += `| ${res.model} | ${pct(res.ocrAccuracy)} | ${Number.isFinite(res.tokensPerSecond) ? `${Math.round(res.tokensPerSecond)} 字元/秒` : '—'} | ${gb(res.memoryBytes)} |\n`;
const cols = results.flatMap((res) => pipelines.map((pl) => ({ model: res.model, pipeline: pl, rows: res.rows.filter((r) => r.pipeline === pl) })));
md += `\n## 每道题\n\n| 题目 | ${cols.map((c) => `${c.model} · ${c.pipeline}`).join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|\n`;
for (const p of problems) {
  md += `| ${p.id}（${p.category}${setName === 'all' ? `，${SET_NAME[p.set]}` : ''}） | ` + cols.map(({ rows }) => {
    const rs = rows.filter((x) => x.id === p.id);
    if (!rs.length || rs.every((r) => r.error)) return '出错';
    if (runsN > 1) return `${rs.filter((r) => r.correct).length}/${rs.length} 次完全正确`;
    const r = rs[0];
    const notes = [r.finalErrors ? `${r.finalErrors} 处错误` : '', r.facts?.added.length ? '补全' : '', r.calls > 1 ? `${r.calls} 次` : ''].filter(Boolean).join('，');
    return `${r.correct ? '✓' : '✗'} ${r.checks.filter((c) => c.ok).length}/${r.checks.length}${notes ? `（${notes}）` : ''}`;
  }).join(' | ') + ' |\n';
}
fs.writeFileSync(path.join(outDir, `${stamp}.md`), md);
console.log(`\n${md}\n结果已写入 eval/results/${stamp}.md 和 .json`);
