// 作图流程。App 和评测脚本共用这一份，保证评测的就是用户实际得到的结果：
//   1. 从题目文字提取可以核对的条件（constraints.js）；
//   2. 模型分析题意、生成作图命令；程序先补上题目里写明但没画对的方程、区域、顶点，再逐条核对；
//   3. 命令出错或条件不满足时：把具体问题发回模型修正一次；还不行就重新生成（温度高一些，换个思路），
//      每一版都核对，保留最好的一版；
//   4. 全部满足，或者用完次数就停止。题目里提取不到条件时，只按“命令是否出错”判断。
import { buildScene } from './scene.js';
import { parsePartialJSON, PARTIAL } from './partial-json.js';
import { restoreEscapes } from './expr.js';
import { judgeRepair } from './repair.js';
import { extractFacts, verifyFacts, completeFigure, describeViolations } from './constraints.js';

export const PIPELINE_DEFAULTS = {
  maxAnalyses: 3, // 最多生成几版（第一版之后的都是“重新生成”）
  repair: true, // 第一版不理想时，先把问题发回模型修正一次
  facts: true, // 提取题目条件、核对、补全（false 时等同于旧流程：只在命令出错时修正）
  temperatures: [0.2, 0.7, 0.7],
  // 已经用掉这么多时间，就不再修正、重新生成，直接用已有的最好一版。
  // 快的设备（电脑、新手机）几乎碰不到；慢的设备只生成一次，不让用户干等。
  timeBudgetMs: 45000,
};

// 评测用的几种流程
export const PIPELINE_PRESETS = {
  baseline: { facts: false, maxAnalyses: 1, repair: true }, // 改进前：生成一次，出错时修正一次
  verified: { facts: true, maxAnalyses: 1, repair: true }, // 核对 + 补全 + 针对性修正
  best3: { facts: true, maxAnalyses: 3, repair: true }, // 再加最多两次重新生成
};

// 小模型偶尔陷入重复：同一条（或同一组）命令反复写，直到写满长度上限。
// 2026-11-10 实测：R6-1 把同一行 Row 写了 50 多遍，多花 30 秒。发现重复就停止生成，用已经写出的部分。
export function repeatingTail(cmds) {
  for (let k = 1; k <= 4; k++) {
    if (cmds.length < 3 * k) continue;
    const a = cmds.slice(-k).join('\n');
    if (a === cmds.slice(-2 * k, -k).join('\n') && a === cmds.slice(-3 * k, -2 * k).join('\n')) return true;
  }
  return false;
}

// 文字原样重复：最后 50 个字在最近 2000 个字里出现了 3 次以上（模型在某个字段里绕圈子）
export function repeatingText(buf) {
  if (buf.length < 400) return false;
  const tail = buf.slice(-50), win = buf.slice(-2000);
  let n = 0, i = -1;
  while ((i = win.indexOf(tail, i + 1)) !== -1) if (++n >= 3) return true;
  return false;
}

// “数数式”的重复：O' = Intersect(f, xAxis, 26)、P' = Intersect(f, yAxis, 26)、Q' = …, 27)……一直编下去。
// 把数字、点名都换成同一个符号后，同一种写法超过 16 条就算重复（正方体 12 条棱、正方形 4 条边都不会误判）。
// 直接写坐标的点（散点图的数据点 P1 = (1, 2)……）放宽到 40 个。
export function countingLoop(cmds) {
  const seen = new Map();
  for (const c of cmds) {
    const k = c.replace(/\d+(?:\.\d+)?/g, '#').replace(/\b[A-Z][A-Za-z]?\d*'*/g, 'P').replace(/\s+/g, '');
    const n = (seen.get(k) || 0) + 1;
    if (n > (/^P#*=\(-?#(?:,-?#){1,2}\)/.test(k) ? 40 : 16)) return true;
    seen.set(k, n);
  }
  return false;
}

export function looksLooping(buf) {
  if (repeatingText(buf)) return true;
  const a = parsePartialJSON(buf);
  const cmds = a && Array.isArray(a.commands) ? (a.commands[PARTIAL] ? a.commands.slice(0, -1) : a.commands).map(String) : [];
  return repeatingTail(cmds) || countingLoop(cmds);
}

// 调用模型并盯着输出：发现在重复就停下（不算出错），返回已经生成的文字
async function generateWatched(call, signal, onText) {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (signal?.aborted) ac.abort(); else signal?.addEventListener('abort', onAbort, { once: true });
  let buf = '', checkedAt = 0, looped = false, stats = null;
  try {
    await call(ac.signal, (ev) => {
      if (ev.t === 'delta') {
        buf += ev.v;
        onText?.(buf);
        if (!looped && buf.length - checkedAt >= 60) {
          checkedAt = buf.length;
          if (looksLooping(buf)) { looped = true; ac.abort(); }
        }
      }
      if (ev.t === 'done') stats = ev.stats;
    });
  } catch (e) {
    if (!looped || signal?.aborted) throw e;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
  return { text: buf, stats, looped };
}

export function cleanCommands(list) {
  if (!Array.isArray(list)) return [];
  return list.map((c) => restoreEscapes(String(c))).map((c) => c.replace(/^\s*\d+[.、)]\s*(?=[A-Za-z])/, '').trim()).filter(Boolean);
}

// 模型输出 → 分析结果（容忍被截断的 JSON；还原被 JSON 吃掉的反斜杠）
export function parseAnalysis(text) {
  let a = null;
  try { a = JSON.parse(text); } catch { a = parsePartialJSON(text); }
  if (!a || typeof a !== 'object' || !Array.isArray(a.commands)) return null;
  const fix = (v) => (typeof v === 'string' ? restoreEscapes(v) : Array.isArray(v) ? v.map(fix) : v);
  const out = {};
  for (const [k, v] of Object.entries(a)) out[k] = fix(v);
  out.commands = cleanCommands(a.commands);
  return out;
}

export function parseRepair(text) {
  let a = null;
  try { a = JSON.parse(text); } catch { a = parsePartialJSON(text); }
  return cleanCommands(a?.commands);
}

const isDrawable = (scene) => scene.objects.some((o) => !['number', 'boolean', 'string'].includes(o.kind));

// 评估一版作图命令：按题目补全 → 构建图形 → 核对条件
export function evaluateCommands(commands, extracted) {
  const done = extracted ? completeFigure(commands, extracted) : { commands, added: [] };
  const scene = buildScene(done.commands, {});
  const v = extracted ? verifyFacts(scene, extracted.facts) : { results: [], sat: 0, total: 0 };
  return { commands: done.commands, modelCommands: commands, added: done.added, scene, errors: scene.errors, results: v.results, sat: v.sat, total: v.total, drawable: isDrawable(scene) };
}

export const isPerfect = (c) => !!c && c.drawable && c.errors.length === 0 && c.sat === c.total;

// a 是否比 b 好：先看能不能画出图，再看满足的题目条件多少，最后看出错的命令多少
export function better(a, b) {
  if (!a) return false;
  if (!b) return true;
  if (a.drawable !== b.drawable) return a.drawable;
  if (a.sat !== b.sat) return a.sat > b.sat;
  return a.errors.length < b.errors.length;
}

const summarize = (c) => ({ errors: c.errors.length, sat: c.sat, total: c.total, added: c.added.length });

/**
 * @param {object} p
 * @param {string} p.text      题目文字
 * @param {object} p.api       createApi() 或 createDeviceApi() 的返回值
 * @param {(ev: object) => void} [p.onEvent]
 *   facts { facts } · analyze-start { attempt, temperature } · delta { attempt, text }（累计的输出）·
 *   analyze-done { attempt, candidate, seconds, stats } · repair-start { issues, errors } ·
 *   repair-done { accepted, reason, candidate, seconds } · best { candidate } · attempt-error { error }
 * @returns {Promise<{ best: object, extracted: object|null, attempts: object[], calls: number }>}
 */
export async function runPipeline({ text, image = null, hint = '', model, api, signal, options = {}, onEvent = () => {} }) {
  const opt = { ...PIPELINE_DEFAULTS, ...options };
  const extracted = opt.facts ? extractFacts(text) : null;
  const emit = (type, data = {}) => onEvent({ type, ...data });
  emit('facts', { facts: extracted?.facts || [] });
  const attempts = [];
  let best = null, calls = 0, repaired = false;
  const setBest = (c) => { if (better(c, best)) { best = c; emit('best', { candidate: c }); } };

  const analyzeOnce = async (k) => {
    const temperature = opt.temperatures[Math.min(k, opt.temperatures.length - 1)];
    emit('analyze-start', { attempt: k + 1, temperature });
    const t0 = Date.now();
    calls++;
    const { text: buf, stats, looped } = await generateWatched(
      (sig, onEvent) => api.analyze({ text, image, hint, model, temperature }, sig, onEvent),
      signal, (t) => emit('delta', { attempt: k + 1, text: t }));
    const seconds = (Date.now() - t0) / 1000;
    const analysis = parseAnalysis(buf);
    if (!analysis) {
      attempts.push({ kind: 'analyze', attempt: k + 1, temperature, seconds, invalid: true, looped });
      emit('analyze-done', { attempt: k + 1, candidate: null, seconds, stats });
      return null;
    }
    const cand = { ...evaluateCommands(analysis.commands, extracted), analysis, source: k === 0 ? 'first' : `retry${k}` };
    attempts.push({ kind: 'analyze', attempt: k + 1, temperature, seconds, tokensPerSecond: stats?.tokensPerSecond, looped, ...summarize(cand) });
    emit('analyze-done', { attempt: k + 1, candidate: cand, seconds, stats });
    return cand;
  };

  const repairOnce = async (cand) => {
    const issues = opt.facts ? describeViolations(cand.results) : [];
    const errors = cand.errors.map((e) => ({ line: e.line, src: e.src, message: e.message }));
    emit('repair-start', { issues, errors });
    const t0 = Date.now();
    calls++;
    const { text: buf } = await generateWatched(
      (sig, onEvent) => api.repair({ text, model, commands: cand.commands, errors, issues }, sig, onEvent), signal);
    const seconds = (Date.now() - t0) / 1000;
    const fixed = parseRepair(buf);
    let next = null, accepted = false, reason;
    if (!fixed.length) reason = '模型没有给出新的命令';
    else {
      next = { ...evaluateCommands(fixed, extracted), analysis: { ...cand.analysis, commands: fixed }, source: 'repair' };
      if (opt.facts && cand.total > 0) {
        accepted = better(next, cand);
        reason = accepted ? `题目条件 ${next.sat}/${next.total}${next.errors.length ? `，还有 ${next.errors.length} 处错误` : ''}` : '修正后没有变得更好';
      } else {
        // 没有可核对的条件时，沿用原来的严格判定：错误减少、对象不减少、原本正确的对象不能被改动
        const v = judgeRepair(cand.commands, fixed);
        accepted = v.ok;
        reason = v.reason;
      }
    }
    attempts.push({ kind: 'repair', seconds, accepted, reason, ...(next ? summarize(next) : {}) });
    emit('repair-done', { accepted, reason, candidate: next, seconds });
    return accepted ? next : null;
  };

  const tStart = Date.now();
  let budgetHit = false;
  const withinBudget = () => {
    if (Date.now() - tStart < opt.timeBudgetMs) return true;
    budgetHit = true;
    return false;
  };
  for (let k = 0; k < opt.maxAnalyses; k++) {
    if (k > 0 && !withinBudget()) break;
    let cand;
    try {
      cand = await analyzeOnce(k);
    } catch (e) {
      // 第一次失败（连不上、模型出错）直接报错；之后的失败只结束尝试，保留已有的最好结果
      if (k === 0 || signal?.aborted) throw e;
      emit('attempt-error', { error: e });
      break;
    }
    if (cand) setBest(cand);
    if (isPerfect(best)) break;
    if (opt.repair && !repaired && best && (best.errors.length || best.sat < best.total) && withinBudget()) {
      repaired = true;
      try {
        const r = await repairOnce(best);
        if (r) setBest(r);
      } catch (e) {
        if (signal?.aborted) throw e;
        emit('attempt-error', { error: e });
      }
      if (isPerfect(best)) break;
    }
  }
  if (!best) throw new Error('本地模型没有返回有效的分析结果，请重试，或换一个更大的模型。');
  return { best, extracted, attempts, calls, budgetHit: budgetHit && !isPerfect(best) };
}
