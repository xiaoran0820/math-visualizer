// 几何条件检验：判断画出来的图形是否满足题目中的数量关系。
// 评测（eval/）和“核对题目条件”（constraints.js）共用。每条检验是一个普通对象：
//   dist      两点距离：{ type: 'dist', a, b, value }
//   equal     若干线段等长：{ type: 'equal', segs: [[a, b], ...] }
//   angle     角度（顶点在中间）：{ type: 'angle', pts: [a, vertex, c], deg }
//   perp      两条线垂直：{ type: 'perp', l1: [a, b], l2: [c, d] }
//   parallel  两条线平行：{ type: 'parallel', l1: [a, b], l2: [c, d] }
//   collinear 三点共线：{ type: 'collinear', pts: [a, b, c] }（核对题目条件时，中间的点在另外两点所在的直线上）
//   midpoint  中点：{ type: 'midpoint', m, of: [a, b] }
//   at        点的坐标：{ type: 'at', p, x, y, z? }
//   circle    以某点为圆心、给定半径的圆：{ type: 'circle', center?, r }
//   onCircle  点在以某点为圆心的圆上：{ type: 'onCircle', p, center }
//   solid     立体：{ type: 'solid', kind: 'cylinder' | 'cone' | 'sphere', r?, h? }
//   moving    动点：点存在，并且有滑块控制它：{ type: 'moving', p }
//   curve     画出了这条方程的曲线：{ type: 'curve', src, vars?, params? }
//             src 是作图命令写法（如 "x^2/4 + y^2/3 = 1"、"f(x) = x^2 - 2a x + 3"）；
//             vars 是方程里的参数，取值优先用图里同名的滑块或数，其次用 params 里题目给出的值
//   region    画出了这组不等式表示的区域：{ type: 'region', src }（如 "x + y <= 4, x >= 0, y >= 0"）
//   fn        存在一个函数（或直线）经过这些点：{ type: 'fn', at: [[x, y], ...] }
//   through   至少 count 条曲线（函数/直线/圆/方程曲线）都经过这些点：{ type: 'through', pts: [[x, y], ...], count }
//   cells     表格里出现了这些数（单元格可以写成小数或分数，如 0.5、1/2、9/13）：{ type: 'cells', values: [...] }
//   kind      至少 min 个某类对象：{ type: 'kind', kind: 'slider' | 'function' | 'implicit' | 'region' | 'brace' | ..., min }
//   mode      2d / 3d：{ type: 'mode', value }
import * as G from './geom.js';
import { buildScene } from './scene.js';

export const REL = 0.02; // 长度允许 2% 误差
export const DEG = 1.5; // 角度允许 1.5° 误差

// 点名的几种常见写法：A1 / A_1 / A₁
export function findPoint(scene, name) {
  const alts = [name, name.replace(/(\D)(\d+)$/, '$1_$2'), name.replace(/_/g, '')];
  for (const n of alts) {
    const v = scene.values[n];
    if (v && v.T === 'point') return v;
  }
  return null;
}

const P3 = (p) => G.pt(p.x, p.y, p.z || 0);
const len = (a, b) => G.dist(P3(a), P3(b));
const fmt = (x, d = 2) => (Number.isInteger(x) ? String(x) : Number(x.toFixed(d)).toString());
const seg = (pair) => pair.join('');

function curveDistance(v, P, scale) {
  const tol = 0.02 * (1 + scale);
  switch (v.T) {
    case 'function': return Math.abs(v.f(P.x) - P.y) < tol * (1 + Math.abs(P.y));
    case 'line': case 'circle': case 'implicit': case 'curve': case 'arc': case 'polyline': case 'polygon': {
      const Q = G.project(v, P, { x0: -50, x1: 50, y0: -50, y1: 50, span: 100 });
      return !!Q && G.dist(P, Q) < tol;
    }
    default: return false;
  }
}

// 点 P 是否在曲线 v 上（核对方程用，误差按坐标大小放宽）
function onCurve(v, P) {
  const tol = 0.01 * (1 + Math.hypot(P.x, P.y));
  if (v.T === 'function') {
    if (P.x < v.a - 1e-9 || P.x > v.b + 1e-9) return false;
    const y = v.f(P.x);
    return Number.isFinite(y) && Math.abs(y - P.y) <= tol;
  }
  const span = Math.max(20, 2 * Math.hypot(P.x, P.y));
  const Q = G.project(v, P, { x0: P.x - span, x1: P.x + span, y0: P.y - span, y1: P.y + span, span: 2 * span });
  return !!Q && G.finite(Q.x) && G.finite(Q.y) && Math.hypot(P.x - Q.x, P.y - Q.y) <= tol;
}

// 在一条已知曲线上取若干个分散的点
export function samplePoints(v, max = 7) {
  const pts = [];
  if (!v) return pts;
  if (v.T === 'function') {
    for (const x of [-3.3, -2.2, -1.1, -0.35, 0.45, 1.3, 2.15, 3.2]) {
      if (x < v.a || x > v.b) continue;
      const y = v.f(x);
      if (Number.isFinite(y) && Math.abs(y) < 1e4) pts.push(G.pt(x, y));
    }
    if (pts.length < 3 && Number.isFinite(v.a) && Number.isFinite(v.b)) {
      for (let i = 1; i <= 5; i++) { const x = v.a + ((v.b - v.a) * i) / 6; const y = v.f(x); if (Number.isFinite(y)) pts.push(G.pt(x, y)); }
    }
  } else if (v.T === 'line') {
    for (const t of [-1.5, 0, 1, 2.5]) pts.push(G.lerp(v.p, v.q, t));
  } else if (v.T === 'circle') {
    for (let i = 0; i < 6; i++) { const a = 0.3 + (i * Math.PI) / 3; pts.push(G.pt(v.c.x + v.r * Math.cos(a), v.c.y + v.r * Math.sin(a))); }
  } else if (v.T === 'implicit') {
    for (const R of [10, 60]) {
      for (let i = 0; i <= 40; i++) {
        const x = -R + (2 * R * i) / 40 + R * 0.0123;
        for (const y of G.findRoots((yy) => v.F(x, yy), -R, R, 400)) if (Math.abs(v.F(x, y)) < 1e-6 * (1 + Math.abs(x) + Math.abs(y))) pts.push(G.pt(x, y));
      }
      if (pts.length >= 4) break;
    }
  }
  if (pts.length <= max) return pts;
  return Array.from({ length: max }, (_, i) => pts[Math.round((i * (pts.length - 1)) / (max - 1))]);
}

// 把一条命令单独画出来，取它的值（方程、区域）
function referenceValue(lines) {
  const s = buildScene(lines, {});
  if (s.errors.length) return null;
  const last = s.objects[s.objects.length - 1];
  return last ? last.value : null;
}

const CURVE_TYPES = ['function', 'line', 'circle', 'implicit', 'curve', 'arc', 'polyline'];

function checkCurve(scene, c) {
  const defs = [];
  for (const name of c.vars || []) {
    const v = scene.values[name];
    if (typeof v === 'number' && Number.isFinite(v)) defs.push(`${name} = ${v}`);
    else if (c.params && c.params[name] !== undefined) defs.push(`${name} = ${c.params[name]}`);
    else return { ok: false, detail: `图中没有参数 ${name}` };
  }
  const ref = referenceValue([...defs, c.src]);
  const pts = samplePoints(ref);
  if (pts.length < 2) return { ok: false, detail: '这条方程画不出图像' };
  const curves = scene.objects.map((o) => o.value).filter((v) => v && CURVE_TYPES.includes(v.T));
  const ok = curves.some((v) => pts.every((P) => onCurve(v, P)));
  return { ok, detail: ok ? '已画出' : '图中没有这条曲线' };
}

function checkRegion(scene, c) {
  const regions = scene.objects.map((o) => o.value).filter((v) => v && v.T === 'region');
  if (!regions.length) return { ok: false, detail: '图中没有画出区域' };
  const ref = referenceValue([`Region(${c.src})`]);
  if (!ref || ref.T !== 'region') return { ok: false, detail: '不等式无法解析' };
  // 在网格上比较“是否在区域内”：交集 / 并集 ≥ 95%（网格错开整数，避免点正好落在边界上）
  const iou = (v, R, n) => {
    let inter = 0, uni = 0, inRef = 0;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = -R + (2 * R * i) / n + 0.0137 * R / 10, y = -R + (2 * R * j) / n + 0.0071 * R / 10;
      const a = !!ref.test(x, y), b = !!v.test(x, y);
      if (a) inRef++;
      if (a && b) inter++;
      if (a || b) uni++;
    }
    return { iou: uni ? inter / uni : 1, inRef };
  };
  let best = 0;
  for (const v of regions) {
    let r = iou(v, 12, 60);
    if (r.inRef < 30) r = iou(v, 60, 60);
    best = Math.max(best, r.iou);
  }
  return { ok: best >= 0.95, detail: best >= 0.95 ? '已画出' : `图中的区域与不等式组不一致（重合 ${Math.round(best * 100)}%）` };
}

// 表格单元格里的数：0.18、9/13、≈0.402、-1/3
function cellNumber(s) {
  const t = String(s).trim().replace(/^≈/, '');
  let m = /^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return Number(m[1]) / Number(m[2]);
  m = /^-?\d+(?:\.\d+)?$/.exec(t);
  return m ? Number(t) : null;
}

export function runCheck(scene, c) {
  const pts = (names) => names.map((n) => findPoint(scene, n));
  const lack = (arr, names) => `缺少点 ${names.filter((n, i) => !arr[i]).join('、')}`;
  let ok = false, detail = '';
  try {
    switch (c.type) {
      case 'mode': ok = scene.mode === c.value; detail = scene.mode === '3d' ? '图是立体图' : '图是平面图'; break;
      case 'kind': {
        const n = scene.objects.filter((o) => (c.kind === 'slider' ? o.role === 'slider' : o.value && o.value.T === c.kind)).length;
        ok = n >= (c.min || 1); detail = c.kind === 'row' ? (n ? `表格有 ${n} 行` : '图中没有表格') : `${n}`;
        break;
      }
      case 'dist': {
        const ps = pts([c.a, c.b]);
        if (!ps[0] || !ps[1]) { detail = lack(ps, [c.a, c.b]); break; }
        const d = len(ps[0], ps[1]);
        ok = Math.abs(d - c.value) <= REL * c.value; detail = `图中 ${c.a}${c.b} = ${fmt(d)}`;
        break;
      }
      case 'equal': {
        const names = [...new Set(c.segs.flat())];
        const ps = pts(names);
        if (ps.some((p) => !p)) { detail = lack(ps, names); break; }
        const ls = c.segs.map(([x, y]) => len(findPoint(scene, x), findPoint(scene, y)));
        const m = ls.reduce((s, l) => s + l, 0) / ls.length;
        ok = m > 1e-9 && ls.every((l) => Math.abs(l - m) <= REL * m);
        detail = `图中 ${c.segs.map((s, i) => `${seg(s)} = ${fmt(ls[i])}`).join('，')}`;
        break;
      }
      case 'angle': {
        const ps = pts(c.pts);
        if (ps.some((p) => !p)) { detail = lack(ps, c.pts); break; }
        const d = G.angleDeg(P3(ps[0]), P3(ps[1]), P3(ps[2]));
        ok = Math.abs(d - c.deg) <= DEG; detail = `图中 ∠${c.pts.join('')} = ${fmt(d, 1)}°`;
        break;
      }
      case 'perp': case 'parallel': {
        const names = [...c.l1, ...c.l2];
        const ps = pts(names);
        if (ps.some((p) => !p)) { detail = lack(ps, names); break; }
        const u = G.vsub(P3(ps[1]), P3(ps[0])), w = G.vsub(P3(ps[3]), P3(ps[2]));
        const nn = G.vlen(u) * G.vlen(w) || 1;
        const cos = Math.abs(G.vdot(u, w)) / nn;
        const ang = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
        if (c.type === 'perp') ok = cos < 0.03;
        else ok = G.vlen(G.vcross(u, w)) / nn < 0.03;
        detail = `图中夹角 ${fmt(ang, 1)}°`;
        break;
      }
      case 'collinear': {
        const ps = pts(c.pts);
        if (ps.some((p) => !p)) { detail = lack(ps, c.pts); break; }
        const u = G.vsub(P3(ps[1]), P3(ps[0])), w = G.vsub(P3(ps[2]), P3(ps[0]));
        const s = G.vlen(G.vcross(u, w)) / ((G.vlen(u) * G.vlen(w)) || 1);
        ok = s < 0.03; detail = ok ? '在直线上' : `${c.pts[1]} 不在直线 ${c.pts[0]}${c.pts[2]} 上`;
        break;
      }
      case 'midpoint': {
        const names = [c.m, ...c.of];
        const ps = pts(names);
        if (ps.some((p) => !p)) { detail = lack(ps, names); break; }
        const mid = G.lerp(P3(ps[1]), P3(ps[2]), 0.5);
        const off = G.dist(P3(ps[0]), mid);
        ok = off <= REL * (len(ps[1], ps[2]) || 1); detail = ok ? '是中点' : `${c.m} 离 ${seg(c.of)} 的中点还差 ${fmt(off)}`;
        break;
      }
      case 'at': {
        const p = findPoint(scene, c.p);
        if (!p) { detail = `缺少点 ${c.p}`; break; }
        const target = G.pt(c.x, c.y, c.z || 0);
        const off = G.dist(P3(p), target);
        ok = off <= 0.02 * (1 + G.vlen(target)); detail = `图中 ${c.p}(${fmt(p.x)}, ${fmt(p.y)}${p.z !== undefined ? `, ${fmt(p.z)}` : ''})`;
        break;
      }
      case 'circle': {
        const O = c.center ? findPoint(scene, c.center) : null;
        if (c.center && !O) { detail = `缺少点 ${c.center}`; break; }
        const cs = scene.objects.map((o) => o.value).filter((v) => v && (v.T === 'circle' || v.T === 'arc' || v.T === 'sector'));
        const match = cs.filter((v) => !O || G.dist(P3(v.c), P3(O)) <= 0.02 * (1 + c.r));
        ok = match.some((v) => Math.abs(v.r - c.r) <= REL * c.r);
        detail = ok ? '已画出' : match.length ? `图中半径为 ${fmt(match[0].r)}` : (O ? `图中没有以 ${c.center} 为圆心的圆` : '图中没有这样的圆');
        break;
      }
      case 'onCircle': {
        const ps = pts([c.p, c.center]);
        if (!ps[0] || !ps[1]) { detail = lack(ps, [c.p, c.center]); break; }
        const cs = scene.objects.map((o) => o.value).filter((v) => v && (v.T === 'circle' || v.T === 'arc') && G.dist(P3(v.c), P3(ps[1])) <= 0.02 * (1 + v.r));
        if (!cs.length) { detail = `图中没有以 ${c.center} 为圆心的圆`; break; }
        ok = cs.some((v) => Math.abs(len(ps[0], ps[1]) - v.r) <= REL * v.r);
        detail = ok ? '在圆上' : `${c.p} 不在圆上`;
        break;
      }
      case 'solid': {
        const ss = scene.objects.map((o) => o.value).filter((v) => v && v.T === c.kind);
        if (!ss.length) { detail = `图中没有${{ cylinder: '圆柱', cone: '圆锥', sphere: '球' }[c.kind] || c.kind}`; break; }
        const h = (v) => (v.a && v.b ? G.dist(P3(v.a), P3(v.b)) : NaN);
        ok = ss.some((v) => (c.r === undefined || Math.abs(v.r - c.r) <= REL * c.r) && (c.h === undefined || Math.abs(h(v) - c.h) <= REL * c.h));
        detail = `图中半径 ${fmt(ss[0].r)}${c.kind !== 'sphere' ? `，高 ${fmt(h(ss[0]))}` : ''}`;
        break;
      }
      case 'moving': {
        const p = findPoint(scene, c.p);
        const sliders = scene.objects.filter((o) => o.role === 'slider').length;
        ok = !!p && sliders > 0;
        detail = !p ? `缺少点 ${c.p}` : sliders ? '有滑块' : '没有用滑块控制动点';
        break;
      }
      case 'cells': {
        const nums = scene.objects.filter((o) => o.value?.T === 'row').flatMap((o) => o.value.cells).map(cellNumber).filter((x) => x !== null);
        const missing = c.values.filter((v) => !nums.some((x) => Math.abs(x - v) <= 1e-3 * (1 + Math.abs(v))));
        ok = nums.length > 0 && missing.length === 0;
        detail = !nums.length ? '没有表格' : missing.length ? `表格里没有 ${missing.join('、')}` : '表格里的数对';
        break;
      }
      case 'curve': ({ ok, detail } = checkCurve(scene, c)); break;
      case 'region': ({ ok, detail } = checkRegion(scene, c)); break;
      case 'fn': {
        const fns = scene.objects.map((o) => o.value).filter((v) => v && (v.T === 'function' || v.T === 'line'));
        ok = fns.some((v) => c.at.every(([x, y]) => curveDistance(v, G.pt(x, y), Math.abs(y))));
        detail = `${fns.length} 个函数/直线`;
        break;
      }
      case 'through': {
        const curves = scene.objects.map((o) => o.value).filter((v) => v && ['function', 'line', 'circle', 'implicit', 'curve', 'arc'].includes(v.T));
        const n = curves.filter((v) => c.pts.every(([x, y]) => curveDistance(v, G.pt(x, y), 1))).length;
        ok = n >= (c.count || 1); detail = `${n}/${curves.length}`;
        break;
      }
      default: detail = '未知的检验类型';
    }
  } catch (e) {
    ok = false;
    detail = `检验出错：${e.message}`;
  }
  return { type: c.type, ok, detail };
}

export function runChecks(scene, checks) {
  return checks.map((c) => runCheck(scene, c));
}

// 给人看的条件写法
export function describeCheck(c) {
  switch (c.type) {
    case 'dist': return `${c.a}${c.b} = ${c.valueText || fmt(c.value)}`;
    case 'equal': return c.segs.map(seg).join(' = ');
    case 'angle': return `∠${c.pts.join('')} = ${fmt(c.deg)}°`;
    case 'perp': return `${seg(c.l1)} ⊥ ${seg(c.l2)}`;
    case 'parallel': return `${seg(c.l1)} ∥ ${seg(c.l2)}`;
    case 'collinear': return `点 ${c.pts[1]} 在直线 ${c.pts[0]}${c.pts[2]} 上`;
    case 'midpoint': return `${c.m} 是 ${seg(c.of)} 的中点`;
    case 'at': return `${c.p}(${[c.x, c.y, c.z].filter((v) => v !== undefined).map((v) => fmt(v)).join(', ')})`;
    case 'circle': return c.center ? `⊙${c.center} 的半径为 ${fmt(c.r)}` : `半径为 ${fmt(c.r)} 的圆`;
    case 'onCircle': return `点 ${c.p} 在⊙${c.center} 上`;
    case 'solid': {
      const name = { cylinder: '圆柱', cone: '圆锥', sphere: '球' }[c.kind] || c.kind;
      return `${name}${c.r !== undefined ? `：半径 ${fmt(c.r)}` : ''}${c.h !== undefined ? `，高 ${fmt(c.h)}` : ''}`;
    }
    case 'moving': return `动点 ${c.p}（用滑块控制）`;
    case 'curve': return c.desc || c.src;
    case 'region': return `不等式组 ${c.desc || c.src} 表示的区域`;
    case 'mode': return c.value === '3d' ? '画成立体图' : '画成平面图';
    case 'kind': return c.kind === 'slider' ? '用滑块表示变化的量' : c.kind === 'row' ? '列出表格' : `至少 ${c.min || 1} 个 ${c.kind}`;
    case 'cells': return `表格里有 ${c.values.join('、')}`;
    case 'fn': return `函数图像经过 ${c.at.map(([x, y]) => `(${fmt(x)}, ${fmt(y)})`).join('、')}`;
    case 'through': return `曲线经过 ${c.pts.map(([x, y]) => `(${fmt(x)}, ${fmt(y)})`).join('、')}`;
    default: return c.type;
  }
}
