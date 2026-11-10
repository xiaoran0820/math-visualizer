// 判断模型“自动修正”后的作图命令是否真的更好。
// 规则（全部满足才采用）：
//   1. 错误数严格减少；
//   2. 成功创建的对象数不减少；
//   3. 修正前已经正确的具名对象必须全部保留，且数值不变（修正不能“顺手”改坏正确的部分）。
// 注意：通过这些检查只说明“没有变差”，不代表图形一定符合题意。
import { buildScene } from './scene.js';

const SAMPLE_X = [-2.3, -0.7, 0.4, 1.9, 3.1];

// 把一个对象的值压成一组数，用于比较“是否被改动”
export function fingerprint(v) {
  if (v === null || v === undefined) return [];
  if (typeof v === 'number') return [v];
  if (typeof v === 'boolean') return [v ? 1 : 0];
  if (typeof v === 'string') return [];
  const P = (p) => [p.x, p.y, p.z ?? 0];
  switch (v.T) {
    case 'point': return P(v);
    case 'line': return [...P(v.p), ...P(v.q)];
    case 'circle': case 'sphere': return [...P(v.c), v.r];
    case 'arc': case 'sector': return [...P(v.c), v.r, v.a0, v.a1];
    case 'polygon': case 'polyline': return v.pts.flatMap(P);
    case 'angle': return [v.deg];
    case 'function': return SAMPLE_X.map((x) => (x >= v.a && x <= v.b ? v.f(x) : NaN));
    case 'cylinder': case 'cone': return [...P(v.a), ...P(v.b), v.r];
    case 'integral': return [v.a, v.b, v.value];
    default: return [];
  }
}

function sameNumbers(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (Number.isNaN(x) && Number.isNaN(y)) continue;
    if (!(Math.abs(x - y) <= 1e-7 * (1 + Math.abs(x) + Math.abs(y)))) return false;
  }
  return true;
}

export function sameValue(a, b) {
  const ka = a && typeof a === 'object' ? a.T : typeof a;
  const kb = b && typeof b === 'object' ? b.T : typeof b;
  if (ka !== kb) return false;
  return sameNumbers(fingerprint(a), fingerprint(b));
}

/**
 * @param {string[]} beforeCommands 修正前的命令
 * @param {string[]} afterCommands  模型给出的修正后命令
 * @returns {{ok: boolean, reason: string, before: object, after: object|null}}
 */
export function judgeRepair(beforeCommands, afterCommands) {
  const before = buildScene(beforeCommands, {});
  const summary = (s) => ({ errors: s.errors.length, objects: s.objects.length });
  if (!Array.isArray(afterCommands) || !afterCommands.length) {
    return { ok: false, reason: '模型没有给出新的命令', before: summary(before), after: null };
  }
  const after = buildScene(afterCommands, {});
  const res = (ok, reason) => ({ ok, reason, before: summary(before), after: summary(after) });
  if (after.errors.length >= before.errors.length) return res(false, '错误没有减少');
  if (after.objects.length < before.objects.length) return res(false, '修正后图形对象变少了');
  for (const o of before.objects) {
    if (o.auto) continue;
    const n = after.byName.get(o.name);
    if (!n) return res(false, `修正时删掉了原本正确的「${o.name}」`);
    if (!sameValue(o.value, n.value)) return res(false, `修正时改动了原本正确的「${o.name}」`);
  }
  return res(true, after.errors.length ? `还有 ${after.errors.length} 处错误` : '已修正');
}
