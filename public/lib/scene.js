// 作图命令引擎：把一行行 GeoGebra 风格的命令解析成可计算的对象。
// 例：A = (0, 4)、D = Midpoint(B, C)、f(x) = x^2 - 2a x、E: x^2/4 + y^2/3 = 1、Segment(A, D) #aux
// 引擎只负责计算，渲染交给 render2d.js / render3d.js。

import { parseExpression, collectVars, ParseError, toLatex, restoreEscapes } from './expr.js';
import * as G from './geom.js';

const { pt, isPt, okPt, finite, EPS } = G;
export { ParseError };

// ---------------- 值的辅助函数 ----------------
export function toNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v && v.T === 'angle') return v.deg;
  if (v && v.T === 'integral') return v.value;
  return NaN;
}
const toRad = (v) => (v && v.T === 'angle' ? (v.deg * Math.PI) / 180 : toNum(v));
const truthy = (v) => (typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 && !Number.isNaN(v) : !!v);
const isNumLike = (v) => typeof v === 'number' || typeof v === 'boolean' || (v && (v.T === 'angle' || v.T === 'integral'));

function add(a, b) { return isPt(a) && isPt(b) ? G.vadd(a, b) : toNum(a) + toNum(b); }
function sub(a, b) { return isPt(a) && isPt(b) ? G.vsub(a, b) : toNum(a) - toNum(b); }
function mul(a, b) {
  if (isPt(a) && isPt(b)) return G.vdot(a, b);
  if (isPt(a)) return G.vscale(a, toNum(b));
  if (isPt(b)) return G.vscale(b, toNum(a));
  return toNum(a) * toNum(b);
}
function div(a, b) { return isPt(a) ? G.vscale(a, 1 / toNum(b)) : toNum(a) / toNum(b); }
function neg(a) { return isPt(a) ? G.vscale(a, -1) : -toNum(a); }

export function fmtNum(x) {
  if (!finite(x)) return '—';
  const r = Math.round(x * 100) / 100;
  if (Math.abs(r) < 1e-12) return '0';
  return String(r);
}
// 表格里的数：整数、有限小数照常显示（0.18）；1/3、9/13 这类显示成分数；其余保留三位小数。
// preferFraction：算式里写了除号（1/8、0.18/0.26）时优先显示分数
export function fmtCell(x, preferFraction = false) {
  if (!finite(x)) return '—';
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  const frac = () => {
    for (let q = 2; q <= 1000; q++) {
      const n = Math.round(x * q);
      if (Math.abs(x * q - n) < 1e-7 * q) return `${n}/${q}`;
    }
    return null;
  };
  if (preferFraction) { const f = frac(); if (f) return f; }
  for (const d of [10, 100, 1000, 10000]) {
    const r = Math.round(x * d);
    if (Math.abs(x * d - r) < 1e-7) return String(r / d);
  }
  return frac() || `≈${Math.round(x * 1000) / 1000}`;
}

// 表格命令的参数按顶层逗号切开（括号、引号里的逗号不算）
function splitCells(s) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of s) {
    if (quote) { cur += ch; if (ch === quote || (quote === '“' && ch === '”')) quote = null; continue; }
    if (ch === '"' || ch === '“') { quote = ch === '“' ? '“' : '"'; cur += ch; continue; }
    if ('([{（'.includes(ch)) depth++;
    if (')]}）'.includes(ch)) depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === '，') && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

// 数值经过四舍五入显示时，视为近似值（界面上用“≈”代替“=”）
export function isApprox(v) {
  const off = (x) => finite(x) && Math.abs(x - Math.round(x * 100) / 100) > 1e-9 * (1 + Math.abs(x));
  if (typeof v === 'number') return off(v);
  if (v && (v.T === 'angle')) return off(v.deg);
  if (v && (v.T === 'integral')) return off(v.value);
  if (v && v.T === 'point') return off(v.x) || off(v.y) || (v.z !== undefined && off(v.z));
  return false;
}

export function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return fmtNum(v);
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'string') return v;
  if (v.T === 'point') return v.z === undefined ? `(${fmtNum(v.x)}, ${fmtNum(v.y)})` : `(${fmtNum(v.x)}, ${fmtNum(v.y)}, ${fmtNum(v.z)})`;
  if (v.T === 'angle') return `${fmtNum(v.deg)}°`;
  if (v.T === 'integral') return fmtNum(v.value);
  return '';
}

// ---------------- 内置数学函数 ----------------
const trig = (f) => (v) => f(toRad(v));
const num1 = (f) => (v) => f(toNum(v));
const MATH1 = {
  sin: trig(Math.sin), cos: trig(Math.cos), tan: trig(Math.tan),
  cot: trig((x) => 1 / Math.tan(x)), sec: trig((x) => 1 / Math.cos(x)), csc: trig((x) => 1 / Math.sin(x)),
  asin: num1(Math.asin), acos: num1(Math.acos), atan: num1(Math.atan),
  arcsin: num1(Math.asin), arccos: num1(Math.acos), arctan: num1(Math.atan),
  sinh: num1(Math.sinh), cosh: num1(Math.cosh), tanh: num1(Math.tanh),
  sqrt: num1(Math.sqrt), cbrt: num1(Math.cbrt),
  abs: (v) => (isPt(v) ? G.vlen(v) : Math.abs(toNum(v))),
  ln: num1(Math.log), lg: num1(Math.log10), log10: num1(Math.log10), log2: num1(Math.log2),
  exp: num1(Math.exp), floor: num1(Math.floor), ceil: num1(Math.ceil), round: num1(Math.round),
  sign: num1(Math.sign), sgn: num1(Math.sign),
};
const MATHN = {
  log: (a) => (a.length === 1 ? Math.log(toNum(a[0])) : Math.log(toNum(a[1])) / Math.log(toNum(a[0]))),
  atan2: (a) => Math.atan2(toNum(a[0]), toNum(a[1])),
  min: (a) => Math.min(...a.map(toNum)),
  max: (a) => Math.max(...a.map(toNum)),
  nroot: (a) => G.realPow(toNum(a[0]), 1 / toNum(a[1])),
  mod: (a) => { const x = toNum(a[0]), m = toNum(a[1]); return ((x % m) + m) % m; },
};
const PREFIX_FUNCS = new Set([...Object.keys(MATH1), 'log']);
const CONSTANTS = { pi: Math.PI, e: Math.E, Infinity, inf: Infinity, true: true, false: false };

// ---------------- 几何命令 ----------------
const nil = (...vs) => vs.some((v) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)));
const asLine = (v) => (v && v.T === 'line' ? v : null);
const dirOf = (l) => G.vsub(l.q, l.p);

function regularPolygon(A, B, n) {
  n = Math.round(n);
  if (n < 3 || n > 60) return null;
  const pts = [A, B];
  const step = (2 * Math.PI) / n;
  for (let i = 2; i < n; i++) {
    const P = pts[i - 1], Q = pts[i - 2];
    const d = G.vsub(P, Q);
    const c = Math.cos(step), s = Math.sin(step);
    pts.push(G.vadd(P, pt(d.x * c - d.y * s, d.x * s + d.y * c)));
  }
  return { T: 'polygon', pts };
}

function transform(v, f) {
  if (!v) return null;
  switch (v.T) {
    case 'point': return f(v);
    case 'line': return { ...v, p: f(v.p), q: f(v.q) };
    case 'circle': { const c = f(v.c); const e = f(G.vadd(v.c, pt(v.r, 0))); return { T: 'circle', c, r: G.dist(c, e) }; }
    case 'polygon': case 'polyline': return { ...v, pts: v.pts.map(f) };
    case 'brace': return { ...v, p: f(v.p), q: f(v.q) };
    default: throw new ParseError('该类型的图形暂不支持变换');
  }
}
function vecOf(v) {
  if (isPt(v)) return v;
  if (v && v.T === 'line') return dirOf(v);
  return null;
}
function rotFn(theta, O) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return (P) => { const d = G.vsub(P, O); return pt(O.x + d.x * c - d.y * s, O.y + d.x * s + d.y * c); };
}
function planeOf(poly) {
  const [A, B, C] = poly.pts;
  const n = G.vnorm(G.vcross(G.vsub(B, A), G.vsub(C, A)));
  return n ? { n, A } : null;
}

const ORIGIN2 = pt(0, 0);

const CMD = {
  Midpoint(a, b) {
    if (a && a.T === 'line') return G.lerp(a.p, a.q, 0.5);
    return okPt(a) && okPt(b) ? G.lerp(a, b, 0.5) : null;
  },
  Segment(a, b, c, d) {
    if ([a, b, c, d].every((v) => typeof v === 'number')) return G.lineThrough(pt(a, b), pt(c, d), 'segment'); // Segment(x1, y1, x2, y2)
    return G.lineThrough(a, b, 'segment');
  },
  Line(a, b, c, d) {
    if ([a, b, c, d].every((v) => typeof v === 'number')) return G.lineThrough(pt(a, b), pt(c, d), 'line'); // Line(x1, y1, x2, y2)
    if (okPt(a) && okPt(b)) return G.lineThrough(a, b, 'line');
    if (okPt(a) && asLine(b)) return G.lineThrough(a, G.vadd(a, dirOf(b)), 'line');
    return null;
  },
  Ray: (a, b) => G.lineThrough(a, b, 'ray'),
  Vector(a, b) {
    if (b === undefined) return okPt(a) ? G.lineThrough(a.z === undefined ? ORIGIN2 : pt(0, 0, 0), a, 'vector') : null;
    return G.lineThrough(a, b, 'vector');
  },
  Perpendicular(P, l) {
    if (!okPt(P) || !asLine(l)) return null;
    const d = dirOf(l);
    return G.lineThrough(P, G.vadd(P, pt(-d.y, d.x)), 'line');
  },
  Parallel(P, l) {
    if (!okPt(P) || !asLine(l)) return null;
    return G.lineThrough(P, G.vadd(P, dirOf(l)), 'line');
  },
  PerpendicularBisector(a, b) {
    if (a && a.T === 'line') { b = a.q; a = a.p; }
    if (!okPt(a) || !okPt(b)) return null;
    const M = G.lerp(a, b, 0.5), d = G.vsub(b, a);
    return G.lineThrough(M, G.vadd(M, pt(-d.y, d.x)), 'line');
  },
  AngleBisector(A, B, C) {
    if (!okPt(A) || !okPt(B) || !okPt(C)) return null;
    const u = G.vnorm(G.vsub(A, B)), v = G.vnorm(G.vsub(C, B));
    if (!u || !v) return null;
    let w = G.vadd(u, v);
    if (G.vlen(w) < 1e-9) w = pt(-u.y, u.x);
    return G.lineThrough(B, G.vadd(B, w), 'ray');
  },
  Foot(P, l) {
    if (!okPt(P) || !l) return null;
    if (l.T === 'polygon') {
      const pl = planeOf(l);
      if (!pl) return null;
      return G.vsub(P, G.vscale(pl.n, G.vdot(G.vsub(P, pl.A), pl.n)));
    }
    return asLine(l) ? G.footOnLine(P, l) : null;
  },
  ClosestPoint(a, b, ctx) {
    if (okPt(a) && b && !isPt(b)) [a, b] = [b, a];
    return okPt(b) ? G.project(a, b, ctx.range) : null;
  },
  Intersect(a, b, sel, ctx) {
    if (nil(a, b)) return null;
    const list = G.intersections(a, b, ctx.range);
    if (!list.length) return null;
    if (sel === undefined) return list[0];
    if (okPt(sel)) {
      let best = list[0];
      for (const P of list) if (G.dist(P, sel) < G.dist(best, sel)) best = P;
      return best;
    }
    const k = Math.round(toNum(sel));
    return list[k - 1] || null;
  },
  Point(obj, hint, ctx) {
    // Point(1, 2) / Point(1, 2, 3)：直接给坐标的写法
    if (typeof obj === 'number' && typeof hint === 'number') return pt(obj, hint, typeof ctx === 'number' ? ctx : undefined);
    if (!obj) return null;
    if (okPt(obj) && hint === undefined) return obj;
    return G.project(obj, okPt(hint) ? hint : defaultOn(obj, ctx.range), ctx.range);
  },
  // 函数的关键点：由程序计算，不需要模型自己算坐标
  Root(f, n, ctx) {
    if (!f || f.T !== 'function') return null;
    const roots = G.findRoots(f.f, Math.max(f.a, -100), Math.min(f.b, 100), 4000);
    const k = n === undefined ? 1 : Math.round(toNum(n));
    const x = roots[k - 1];
    return x === undefined ? null : pt(x, 0);
  },
  Extremum(f, n, ctx) {
    if (!f || f.T !== 'function') return null;
    const ex = G.findExtrema(f.f, Math.max(f.a, -100), Math.min(f.b, 100), 4000);
    const k = n === undefined ? 1 : Math.round(toNum(n));
    const e = ex[k - 1];
    return e ? pt(e.x, e.y) : null;
  },
  Vertex(f, ctx) {
    // 抛物线的顶点（取离 y 轴最近的极值点）
    if (!f || f.T !== 'function') return null;
    const ex = G.findExtrema(f.f, Math.max(f.a, -100), Math.min(f.b, 100), 4000).sort((p, q) => Math.abs(p.x) - Math.abs(q.x));
    return ex.length ? pt(ex[0].x, ex[0].y) : null;
  },
  Circle(a, b, c) {
    if ([a, b, c].every((v) => typeof v === 'number')) return { T: 'circle', c: pt(a, b), r: Math.abs(c) }; // Circle(x, y, r)
    if (c !== undefined) {
      if (!okPt(a) || !okPt(b) || !okPt(c)) return null;
      const O = G.circumcenter(a, b, c);
      return O ? { T: 'circle', c: O, r: G.dist(O, a) } : null;
    }
    if (!okPt(a)) return null;
    if (okPt(b)) return { T: 'circle', c: a, r: G.dist(a, b) };
    const r = Math.abs(toNum(b));
    return finite(r) ? { T: 'circle', c: a, r } : null;
  },
  Incircle(A, B, C) {
    if (!okPt(A) || !okPt(B) || !okPt(C)) return null;
    const I = G.incenter(A, B, C);
    const per = G.dist(A, B) + G.dist(B, C) + G.dist(C, A);
    return I ? { T: 'circle', c: I, r: (2 * G.polygonArea([A, B, C])) / per } : null;
  },
  Arc(O, A, B) {
    if (!okPt(O) || !okPt(A) || !okPt(B)) return null;
    return { T: 'arc', c: O, r: G.dist(O, A), a0: Math.atan2(A.y - O.y, A.x - O.x), a1: Math.atan2(B.y - O.y, B.x - O.x) };
  },
  Semicircle(A, B) {
    if (!okPt(A) || !okPt(B)) return null;
    const M = G.lerp(A, B, 0.5);
    const a0 = Math.atan2(B.y - M.y, B.x - M.x);
    return { T: 'arc', c: M, r: G.dist(A, B) / 2, a0, a1: a0 + Math.PI };
  },
  Sector(O, A, B) {
    const arc = CMD.Arc(O, A, B);
    return arc ? { ...arc, T: 'sector' } : null;
  },
  Polygon(...pts) {
    if (pts.length === 3 && okPt(pts[0]) && okPt(pts[1]) && isNumLike(pts[2])) return regularPolygon(pts[0], pts[1], toNum(pts[2]));
    if (pts.length < 3 || !pts.every(okPt)) return null;
    return { T: 'polygon', pts };
  },
  Polyline(...pts) {
    if (pts.length < 2 || !pts.every(okPt)) return null;
    return { T: 'polyline', pts };
  },
  Center: (c) => (isPt(c) ? c : c && (c.T === 'circle' || c.T === 'arc' || c.T === 'sector' || c.T === 'sphere') ? c.c : null),
  Radius: (c) => (c && c.r !== undefined ? c.r : NaN),
  Centroid(...pts) {
    if (pts.length === 1 && pts[0] && pts[0].T === 'polygon') pts = pts[0].pts;
    if (!pts.length || !pts.every(okPt)) return null;
    let s = pts[0];
    for (let i = 1; i < pts.length; i++) s = G.vadd(s, pts[i]);
    return G.vscale(s, 1 / pts.length);
  },
  Circumcenter: (A, B, C) => (okPt(A) && okPt(B) && okPt(C) ? G.circumcenter(A, B, C) : null),
  Incenter: (A, B, C) => (okPt(A) && okPt(B) && okPt(C) ? G.incenter(A, B, C) : null),
  Orthocenter(A, B, C) {
    if (!okPt(A) || !okPt(B) || !okPt(C)) return null;
    const O = G.circumcenter(A, B, C);
    return O ? G.vsub(G.vadd(G.vadd(A, B), C), G.vscale(O, 2)) : null;
  },
  Rotate(obj, ang, O) {
    let t = toRad(ang);
    if (!finite(t)) return null;
    if (!(ang && ang.T === 'angle') && Math.abs(t) > 2 * Math.PI + 1e-6) t = (t * Math.PI) / 180; // 忘写 ° 时按角度处理
    return transform(obj, rotFn(t, okPt(O) ? O : ORIGIN2));
  },
  Reflect(obj, m) {
    if (!m) return null;
    if (isPt(m)) return transform(obj, (P) => G.vsub(G.vscale(m, 2), P));
    if (m.T === 'line') return transform(obj, (P) => G.vsub(G.vscale(G.footOnLine(P, m), 2), P));
    return null;
  },
  Translate(obj, v) {
    const d = vecOf(v);
    return d ? transform(obj, (P) => G.vadd(P, d)) : null;
  },
  Dilate(obj, k, O) {
    const kk = toNum(k);
    const C = okPt(O) ? O : ORIGIN2;
    return transform(obj, (P) => G.vadd(C, G.vscale(G.vsub(P, C), kk)));
  },
  Tangent(a, b, n, ctx) {
    if (nil(a, b)) return null;
    if (b.T === 'function') {
      const x0 = isPt(a) ? a.x : toNum(a);
      const y0 = b.f(x0);
      const h = 1e-5 * (1 + Math.abs(x0));
      const m = (b.f(x0 + h) - b.f(x0 - h)) / (2 * h);
      if (!finite(y0) || !finite(m)) return null;
      return G.lineThrough(pt(x0, y0), pt(x0 + 1, y0 + m), 'line');
    }
    if (isPt(a) && b.T === 'circle') {
      const d = G.dist(a, b.c);
      if (d < b.r - 1e-9) return null;
      if (Math.abs(d - b.r) < 1e-9 * (1 + b.r)) {
        const u = G.vsub(a, b.c);
        return G.lineThrough(a, G.vadd(a, pt(-u.y, u.x)), 'line');
      }
      const base = Math.atan2(a.y - b.c.y, a.x - b.c.x), off = Math.acos(b.r / d);
      const k = n === undefined ? 1 : Math.round(toNum(n));
      const ang = base + (k === 2 ? -off : off);
      return G.lineThrough(a, pt(b.c.x + b.r * Math.cos(ang), b.c.y + b.r * Math.sin(ang)), 'line');
    }
    if (isPt(a) && b.T === 'implicit') {
      const P = G.project(b, a, ctx.range);
      if (!P) return null;
      const h = 1e-6;
      const gx = (b.F(P.x + h, P.y) - b.F(P.x - h, P.y)) / (2 * h), gy = (b.F(P.x, P.y + h) - b.F(P.x, P.y - h)) / (2 * h);
      return G.lineThrough(P, pt(P.x - gy, P.y + gx), 'line');
    }
    return null;
  },
  Distance(a, b) {
    if (nil(a, b)) return NaN;
    if (!isPt(a) && isPt(b)) [a, b] = [b, a];
    if (!isPt(a)) return NaN;
    if (isPt(b)) return G.dist(a, b);
    if (b.T === 'line') return G.dist(a, b.kind === 'line' ? G.footOnLine(a, b) : G.project(b, a));
    if (b.T === 'polygon') { const pl = planeOf(b); return pl ? Math.abs(G.vdot(G.vsub(a, pl.A), pl.n)) : NaN; }
    if (b.T === 'circle') return Math.abs(G.dist(a, b.c) - b.r);
    return NaN;
  },
  Length(a, b) {
    if (!a) return NaN;
    if (isPt(a) && isPt(b)) return G.dist(a, b);
    if (a.T === 'line') return G.dist(a.p, a.q);
    if (isPt(a)) return G.vlen(a);
    if (a.T === 'polygon' || a.T === 'polyline') return G.polygonEdges(a).reduce((s, e) => s + G.dist(e.p, e.q), 0);
    if (a.T === 'circle') return 2 * Math.PI * a.r;
    if (a.T === 'arc') return a.r * G.arcSpan(a.a0, a.a1);
    return NaN;
  },
  Area(a) {
    if (!a) return NaN;
    if (a.T === 'polygon') return G.polygonArea(a.pts);
    if (a.T === 'circle') return Math.PI * a.r * a.r;
    if (a.T === 'sector') return 0.5 * a.r * a.r * G.arcSpan(a.a0, a.a1);
    if (a.T === 'integral') return Math.abs(a.value);
    return NaN;
  },
  Slope(l) {
    if (!asLine(l)) return NaN;
    const d = dirOf(l);
    return Math.abs(d.x) < EPS ? NaN : d.y / d.x;
  },
  Angle(A, B, C) {
    if (!okPt(A) || !okPt(B) || !okPt(C)) return null;
    return { T: 'angle', A, B, C, deg: G.angleDeg(A, B, C) };
  },
  Text(s, P) {
    if (isPt(s) && typeof P === 'string') [s, P] = [P, s];
    return { T: 'text', text: typeof s === 'string' ? s : formatValue(s), pos: okPt(P) ? P : null };
  },
  // 表格（概率、统计题）：Table("标题") 开始一个表格；Row(…) 每行一条，第一行是表头。
  // 数值单元格由程序计算（能化成分数的显示分数），含滑块参数时随滑块变化
  Table(title) {
    return { T: 'table', title: title === undefined ? '' : typeof title === 'string' ? title : formatValue(title) };
  },
  Row(...cells) {
    return { T: 'row', cells: cells.map((c) => (typeof c === 'number' ? fmtCell(c) : c === undefined || c === null ? '' : typeof c === 'string' ? c : formatValue(c))) };
  },
  Brace(A, B, s) {
    if (typeof A === 'number' && typeof B === 'number') { A = pt(A, 0); B = pt(B, 0); } // Brace(0, 360, "…")：x 轴上的一段
    if (!okPt(A) || !okPt(B)) return null;
    return { T: 'brace', p: A, q: B, text: s === undefined ? '' : typeof s === 'string' ? s : formatValue(s) };
  },
  Integral(f, a, b) {
    if (!f || f.T !== 'function') return null;
    const lo = toNum(a), hi = toNum(b);
    return { T: 'integral', f, g: null, a: lo, b: hi, value: G.integrate(f.f, lo, hi) };
  },
  IntegralBetween(f, g, a, b) {
    if (!f || !g || f.T !== 'function' || g.T !== 'function') return null;
    const lo = toNum(a), hi = toNum(b);
    return { T: 'integral', f, g, a: lo, b: hi, value: G.integrate((x) => f.f(x) - g.f(x), lo, hi) };
  },
  Derivative(f) {
    if (!f || f.T !== 'function') return null;
    return derivativeOf(f);
  },
  Sphere(O, r) {
    if (!okPt(O)) return null;
    const rr = okPt(r) ? G.dist(O, r) : Math.abs(toNum(r));
    return finite(rr) ? { T: 'sphere', c: as3(O), r: rr } : null;
  },
  Cylinder(A, B, r) {
    if (!okPt(A) || !okPt(B) || !finite(toNum(r))) return null;
    return { T: 'cylinder', a: as3(A), b: as3(B), r: Math.abs(toNum(r)) };
  },
  Cone(A, B, r) {
    if (!okPt(A) || !okPt(B) || !finite(toNum(r))) return null;
    return { T: 'cone', a: as3(A), b: as3(B), r: Math.abs(toNum(r)) };
  },
  Pyramid(...pts) {
    if (pts.length < 4 || !pts.every(okPt)) return null;
    const base = pts.slice(0, -1).map(as3), apex = as3(pts[pts.length - 1]);
    const edges = [];
    base.forEach((p, i) => { edges.push([p, base[(i + 1) % base.length]]); edges.push([p, apex]); });
    return { T: 'solid', edges, faces: [base, ...base.map((p, i) => [p, base[(i + 1) % base.length], apex])] };
  },
  Prism(...pts) {
    if (pts.length < 6 || pts.length % 2 || !pts.every(okPt)) return null;
    const n = pts.length / 2;
    const bot = pts.slice(0, n).map(as3), top = pts.slice(n).map(as3);
    const edges = [];
    for (let i = 0; i < n; i++) {
      edges.push([bot[i], bot[(i + 1) % n]], [top[i], top[(i + 1) % n]], [bot[i], top[i]]);
    }
    return { T: 'solid', edges, faces: [bot, top] };
  },
};
const as3 = (p) => (p.z === undefined ? pt(p.x, p.y, 0) : p);
// 别名：GeoGebra 的其它写法，以及小模型常“发明”的命令名
const ALIASES = {
  PerpendicularLine: 'Perpendicular', OrthogonalLine: 'Perpendicular', Perp: 'Perpendicular', PerpLine: 'Perpendicular',
  ParallelLine: 'Parallel',
  LineBisector: 'PerpendicularBisector', PerpBisector: 'PerpendicularBisector', MidPerpendicular: 'PerpendicularBisector',
  AngularBisector: 'AngleBisector', Bisector: 'AngleBisector',
  CircularArc: 'Arc', CircularSector: 'Sector', Mirror: 'Reflect', Reflection: 'Reflect', Symmetric: 'Reflect',
  Intersection: 'Intersect', IntersectionPoint: 'Intersect', Intersections: 'Intersect',
  MidPoint: 'Midpoint', Mid: 'Midpoint', MiddlePoint: 'Midpoint',
  PerpendicularPoint: 'Foot', PerpendicularFoot: 'Foot', FootOfPerpendicular: 'Foot', FootPoint: 'Foot',
  Projection: 'Foot', OrthogonalProjection: 'Foot',
  LineSegment: 'Segment', Seg: 'Segment', Edge: 'Segment',
  Triangle: 'Polygon', Quadrilateral: 'Polygon', Rectangle: 'Polygon', Parallelogram: 'Polygon', Trapezoid: 'Polygon', Pentagon: 'Polygon', Face: 'Polygon',
  RightAngle: 'Angle', AngleMark: 'Angle', MarkAngle: 'Angle',
  Circumcircle: 'Circle', Dist: 'Distance', Vec: 'Vector', Rotation: 'Rotate', Translation: 'Translate', Scale: 'Dilate',
  Label: 'Text', TextLabel: 'Text', Caption: 'Text',
  Roots: 'Root', Zero: 'Root', Zeros: 'Root', ZeroPoint: 'Root', Extrema: 'Extremum', TurningPoint: 'Extremum', Apex: 'Vertex',
};
const CTX_CMDS = new Set(['ClosestPoint', 'Intersect', 'Point', 'Tangent', 'Root', 'Extremum', 'Vertex']); // 需要额外的上下文参数

// 推断命令的结果类型（初值为空时，渲染器仍需要知道该画什么）
const KIND_OF_CMD = {
  point: ['Midpoint', 'Intersect', 'Foot', 'ClosestPoint', 'Point', 'Center', 'Centroid', 'Circumcenter', 'Incenter', 'Orthocenter', 'Root', 'Extremum', 'Vertex'],
  line: ['Segment', 'Line', 'Ray', 'Vector', 'Perpendicular', 'Parallel', 'PerpendicularBisector', 'AngleBisector', 'Tangent'],
  circle: ['Circle', 'Incircle'], arc: ['Arc', 'Semicircle'], sector: ['Sector'],
  polygon: ['Polygon'], polyline: ['Polyline'], angle: ['Angle'], text: ['Text'], brace: ['Brace'], table: ['Table'], row: ['Row'],
  integral: ['Integral', 'IntegralBetween'], function: ['Function', 'Derivative'], curve: ['Curve'],
  sphere: ['Sphere'], cylinder: ['Cylinder'], cone: ['Cone'], solid: ['Pyramid', 'Prism'], region: ['Region'],
};
const CMD_KIND = {};
for (const [k, list] of Object.entries(KIND_OF_CMD)) list.forEach((c) => { CMD_KIND[c] = k; });

const SETTINGS = new Set(['ShowAxes', 'ShowGrid', 'ZoomIn', 'SetView']);
const SPECIAL = new Set(['If', 'Function', 'Curve', 'Region', 'Slider', ...SETTINGS]);

// 两个函数在几个点上的值是否一致（核对模型写的导函数用；没有可比较的点时当作一致，不改动）
function sameFunctionValues(a, b) {
  if (!a || !b || a.T !== 'function' || b.T !== 'function') return true;
  for (const x of [-2.3, -1.1, -0.4, 0.3, 0.9, 1.7, 2.6, 3.4]) {
    const u = callFn(a, x), v = callFn(b, x);
    if (!finite(u) || !finite(v)) continue;
    if (Math.abs(u - v) > 1e-3 * (1 + Math.abs(v))) return false;
  }
  return true;
}

function derivativeOf(fv) {
  const f = fv.f;
  return {
    T: 'function',
    f: (x) => { const h = 1e-5 * (1 + Math.abs(x)); return (f(x + h) - f(x - h)) / (2 * h); },
    a: fv.a, b: fv.b,
  };
}

function defaultOn(obj, R) {
  switch (obj.T) {
    case 'line': return G.lerp(obj.p, obj.q, obj.kind === 'line' ? 0 : 0.5);
    case 'circle': case 'sphere': return G.vadd(obj.c, pt(obj.r * Math.SQRT1_2, obj.r * Math.SQRT1_2, obj.c.z === undefined ? undefined : 0));
    case 'arc': { const t = obj.a0 + G.arcSpan(obj.a0, obj.a1) / 2; return pt(obj.c.x + obj.r * Math.cos(t), obj.c.y + obj.r * Math.sin(t)); }
    case 'polygon': case 'polyline': return G.lerp(obj.pts[0], obj.pts[1], 0.5);
    case 'function': { const x = Math.min(Math.max(0, obj.a), obj.b); return pt(x, obj.f(x)); }
    case 'curve': { const t = (obj.t0 + obj.t1) / 2; return pt(obj.fx(t), obj.fy(t)); }
    default: return pt((R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2);
  }
}

// ---------------- 标记 ----------------
const TAG_ALIASES = {
  aux: 'aux', auxiliary: 'aux', dash: 'aux', dashed: 'aux', 辅助线: 'aux',
  hl: 'hl', highlight: 'hl', emph: 'hl', key: 'hl',
  result: 'result', ans: 'result', answer: 'result',
  eq: 'eq1', eq1: 'eq1', eq2: 'eq2', eq3: 'eq3',
  open: 'open', hollow: 'open', fixed: 'fixed', lock: 'fixed',
  nolabel: 'nolabel', hidden: 'hidden', hide: 'hidden', label: 'label',
};
function extractTags(src, tags) {
  // 只识别引号之外、位于末尾的 #tag
  let inStr = false;
  let cut = -1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === '“' || c === '”') inStr = !inStr;
    if (c === '#' && !inStr) { cut = i; break; }
  }
  if (cut === -1) return src;
  const tail = src.slice(cut);
  for (const m of tail.matchAll(/#\s*([A-Za-z0-9_一-龥]+)/g)) {
    const t = TAG_ALIASES[m[1].toLowerCase()] || TAG_ALIASES[m[1]];
    if (t) tags.add(t);
  }
  return src.slice(0, cut).trim();
}

const LHS_RE = /^([A-Za-z_Ͱ-Ͽ][A-Za-z0-9_Ͱ-Ͽ]*'*)\s*(?:\(\s*([a-z](?:\s*,\s*[a-z])*)\s*\))?\s*(=|:)(?!=)\s*/;

// ---------------- 场景 ----------------
export class Scene {
  constructor(state = {}) {
    this.objects = [];
    this.byName = new Map();
    this.errors = [];
    this.notes = [];
    this.settings = { axes: null, grid: null, view: null };
    this.state = state;
    this.values = Object.create(null);
    this.range = { x0: -20, x1: 20, y0: -20, y1: 20, span: 40 };
    this.autoId = 0;
    this.parseOpts = {
      isCallable: (name) => this.isCallable(name),
      isPrefixFunc: (name) => PREFIX_FUNCS.has(name) && !this.byName.has(name),
    };
  }

  isCallable(name) {
    if (CMD[name] || ALIASES[name] || MATH1[name] || MATHN[name] || SPECIAL.has(name)) return true;
    if (name === 'x' || name === 'y' || name === 'z') return true;
    const o = this.byName.get(name);
    if (o && (o.kind === 'function' || o.kind === 'function2')) return true;
    if (name.endsWith("'")) {
      const base = this.byName.get(name.replace(/'+$/, ''));
      return !!base && base.kind === 'function';
    }
    return false;
  }

  env() {
    return { values: this.values, state: this.state, locals: Object.create(null), scene: this };
  }

  // ---------- 编译 ----------
  compile(node, locals) {
    const c = (n) => this.compile(n, locals);
    switch (node.type) {
      case 'num': { const v = node.value; return () => v; }
      case 'str': return this.compileTemplate(node.value, locals);
      case 'group': return c(node.arg);
      case 'var': return this.compileVar(node.name, locals);
      case 'neg': { const a = c(node.arg); return (env) => neg(a(env)); }
      case 'not': { const a = c(node.arg); return (env) => !truthy(a(env)); }
      case 'deg': { const a = c(node.arg); return (env) => (toNum(a(env)) * Math.PI) / 180; }
      case 'bin': {
        const a = c(node.left), b = c(node.right);
        switch (node.op) {
          case '+': return (env) => add(a(env), b(env));
          case '-': return (env) => sub(a(env), b(env));
          case '*': return (env) => mul(a(env), b(env));
          case '/': return (env) => div(a(env), b(env));
          case '^': return (env) => G.realPow(toNum(a(env)), toNum(b(env)));
        }
        break;
      }
      case 'cmp': {
        const fs = node.args.map(c);
        const ops = node.ops;
        return (env) => {
          let prev = toNum(fs[0](env));
          for (let i = 0; i < ops.length; i++) {
            const cur = toNum(fs[i + 1](env));
            const tol = 1e-9 * (1 + Math.abs(prev) + Math.abs(cur));
            let ok;
            switch (ops[i]) {
              case '<': ok = prev < cur; break;
              case '<=': ok = prev <= cur + tol; break;
              case '>': ok = prev > cur; break;
              case '>=': ok = prev >= cur - tol; break;
              case '==': ok = Math.abs(prev - cur) <= tol; break;
              case '!=': ok = Math.abs(prev - cur) > tol; break;
            }
            if (!ok) return false;
            prev = cur;
          }
          return true;
        };
      }
      case 'logic': {
        const a = c(node.left), b = c(node.right);
        return node.op === '&&' ? (env) => truthy(a(env)) && truthy(b(env)) : (env) => truthy(a(env)) || truthy(b(env));
      }
      case 'tuple': {
        if (node.items.length > 3) throw new ParseError('点的坐标最多 3 个');
        const fs = node.items.map(c);
        return (env) => {
          const v = fs.map((f) => toNum(f(env)));
          return pt(v[0], v[1], v[2]);
        };
      }
      case 'eq': throw new ParseError('这里不能出现等号');
      case 'call': return this.compileCall(node, locals);
    }
    throw new ParseError('无法理解的表达式');
  }

  compileVar(name, locals) {
    if (locals && locals.has(name)) return (env) => env.locals[name];
    if (this.byName.has(name)) return (env) => env.values[name];
    if (name === 'O') { this.addImplicitOrigin(); return (env) => env.values.O; }
    if (name === 'y') {
      // 模型把 y = x^2 - 2x - 3 画出的曲线直接叫作 y（如 Intersect(l, y, 1)）：只有一条这样的曲线时就是它
      const curves = this.objects.filter((o) => o.auto && /^\s*y\s*=/.test(o.src) && (o.kind === 'function' || o.kind === 'line'));
      if (curves.length === 1) {
        const n = curves[0].name;
        if (!this.notes.some((t) => t.startsWith('命令里用 y 指代'))) this.notes.push(`命令里用 y 指代曲线「${curves[0].src}」，已按这条曲线处理`);
        return (env) => env.values[n];
      }
    }
    if (name in CONSTANTS) { const v = CONSTANTS[name]; return () => v; }
    if (name === 'xAxis') return () => G.lineThrough(pt(0, 0), pt(1, 0));
    if (name === 'yAxis') return () => G.lineThrough(pt(0, 0), pt(0, 1));
    // 尝试拆分成已知名字的乘积：ax → a·x，xy → x·y
    const parts = this.splitName(name, locals);
    if (parts) {
      const fs = parts.map((p) => this.compileVar(p, locals));
      return (env) => fs.reduce((acc, f) => mul(acc, f(env)), 1);
    }
    throw new ParseError(`未定义的名称「${name}」`);
  }

  // 解析时拆开省略乘号的名字：ax → a·x，xe → x·e，xlnx → x·ln x，sinxcosx → sin x·cos x。
  // 2026-11-11 发现：原来整个名字先当成一个量再拆，ax^2 被算成 (ax)²（a = 2 时差一倍），xe^x 被算成 (xe)^x。
  // 只在每一段都认识时才拆（变量、已定义的数、pi、e、函数名）；否则保持原样，由后面报“未定义的名称”。
  splitIdent(name, vars, beforeParen) {
    if (!/^[A-Za-z]{2,12}$/.test(name)) return null;
    if (vars.has(name) || this.byName.has(name) || name in CONSTANTS || name === 'xAxis' || name === 'yAxis' || this.isCallable(name) || PREFIX_FUNCS.has(name)) return null;
    const isFunc = (s) => PREFIX_FUNCS.has(s) && !this.byName.has(s);
    const isValue = (s) => vars.has(s) || s === 'pi' || s === 'e' || this.byName.get(s)?.kind === 'number';
    const memo = new Map();
    const go = (i) => {
      if (i === name.length) return [];
      if (memo.has(i)) return memo.get(i);
      let res = null;
      for (let j = name.length; j > i && !res; j--) {
        const s = name.slice(i, j);
        // 函数名后面必须还有自变量（xlnx），或者紧跟括号（xln(x)）
        if (isValue(s) || (isFunc(s) && (j < name.length || beforeParen))) {
          const rest = go(j);
          if (rest) res = [s, ...rest];
        }
      }
      memo.set(i, res);
      return res;
    };
    const parts = go(0);
    if (!parts || parts.length < 2) return null;
    // ax(x+1)：最后一段是变量又紧跟括号时不拆（x(…) 是取坐标的写法），仍按原来的方式当成 (a·x)·(…)
    if (beforeParen && !isFunc(parts[parts.length - 1])) return null;
    return parts;
  }

  splitName(name, locals) {
    if (!/^[A-Za-z]+$/.test(name) || name.length > 6) return null;
    const known = (s) => (locals && locals.has(s)) || this.byName.has(s) || s === 'pi' || s === 'e';
    const memo = new Map();
    const go = (i) => {
      if (i === name.length) return [];
      if (memo.has(i)) return memo.get(i);
      let res = null;
      for (let j = name.length; j > i && !res; j--) {
        const s = name.slice(i, j);
        if (known(s) && !(i === 0 && j === name.length)) {
          const rest = go(j);
          if (rest) res = [s, ...rest];
        }
      }
      memo.set(i, res);
      return res;
    };
    return go(0);
  }

  // 模型用了 O 却没定义时，按原点处理，并记一条提示（不算错误）
  addImplicitOrigin() {
    if (this.byName.has('O')) return;
    const o = {
      name: 'O', auto: false, src: 'O = (0, 0)', lineNo: -1, tags: new Set(['fixed']), role: 'fixed', slider: null,
      label: null, labelFn: null, labelText: null, compute: () => pt(0, 0), kind: 'point', value: pt(0, 0), tex: null,
    };
    this.objects.push(o);
    this.byName.set('O', o);
    this.values.O = o.value;
    this.notes.push('命令里用到了点 O 但没有定义，已按原点 (0, 0) 处理');
  }

  compileTemplate(s, locals) {
    const parts = [];
    let buf = '', inMath = false;
    for (let i = 0; i < s.length;) {
      const ch = s[i];
      if (ch === '$') { inMath = !inMath; buf += ch; i++; continue; }
      if (ch === '{' && !inMath) {
        let depth = 1, j = i + 1;
        while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
        if (depth) { buf += s.slice(i); break; }
        const inner = s.slice(i + 1, j - 1);
        try {
          const { ast } = parseExpression(inner, this.parseOpts);
          const f = this.compile(ast, locals);
          if (buf) parts.push(buf);
          buf = '';
          parts.push(f);
        } catch {
          buf += s.slice(i, j);
        }
        i = j;
        continue;
      }
      buf += ch;
      i++;
    }
    if (buf) parts.push(buf);
    if (parts.every((p) => typeof p === 'string')) { const str = parts.join(''); return () => str; }
    return (env) => {
      let out = '';
      for (const p of parts) {
        if (typeof p === 'string') { out += p; continue; }
        const v = p(env);
        if (isApprox(v)) out = /=\s*$/.test(out) ? out.replace(/=(\s*)$/, '≈$1') : `${out}≈`;
        out += formatValue(v);
      }
      return out;
    };
  }

  withLocals(locals, names) {
    const s = new Set(locals || []);
    names.forEach((n) => s.add(n));
    return s;
  }

  // 把表达式编译成单变量函数值 {T:'function', f, a, b}
  makeFunction(exprFn, varName, aFn, bFn) {
    return (env) => {
      const loc = Object.create(env.locals);
      const e2 = { values: env.values, state: env.state, locals: loc, scene: env.scene };
      const f = (x) => { loc[varName] = x; return toNum(exprFn(e2)); };
      const a = aFn ? toNum(aFn(env)) : -Infinity, b = bFn ? toNum(bFn(env)) : Infinity;
      return { T: 'function', f, a: finite(a) || a === -Infinity ? a : -Infinity, b: finite(b) || b === Infinity ? b : Infinity };
    };
  }

  // 收集“自由变量”：f(x)、g(t) 这种整体代表函数本身的写法里的 x、t 不算
  freeVars(ast, out = new Set()) {
    if (!ast || typeof ast !== 'object') return out;
    if (ast.type === 'var') out.add(ast.name);
    if (ast.type === 'call' && ast.args.length === 1 && ast.args[0].type === 'var' && /^[xt]$/.test(ast.args[0].name)
      && this.byName.get(ast.name)?.kind === 'function') return out;
    for (const k of ['arg', 'left', 'right']) if (ast[k]) this.freeVars(ast[k], out);
    for (const k of ['items', 'args']) if (ast[k]) ast[k].forEach((n) => this.freeVars(n, out));
    return out;
  }

  makeFunction2(exprFn, vars) {
    return (env) => {
      const loc = Object.create(env.locals);
      const e2 = { values: env.values, state: env.state, locals: loc, scene: env.scene };
      return { T: 'function2', vars, f: (...args) => { vars.forEach((v, i) => { loc[v] = args[i]; }); return toNum(exprFn(e2)); } };
    };
  }

  compileCall(node, locals) {
    let name = node.name;
    const args = node.args;
    const c = (n) => this.compile(n, locals);

    // 坐标分量 x(A)、y(A)、z(A)；x(x+1) 之类按乘法处理（已经把 z 定义成函数时，按函数调用）
    if ((name === 'x' || name === 'y' || name === 'z') && this.byName.get(name)?.kind !== 'function2') {
      const a0 = args[0];
      const isObj = args.length === 1 && a0.type === 'var' && !(locals && locals.has(a0.name)) && this.byName.has(a0.name);
      if (isObj || (args.length === 1 && a0.type === 'call')) {
        const f = c(a0);
        return (env) => { const v = f(env); return isPt(v) ? (v[name] ?? 0) : NaN; };
      }
      const left = this.compileVar(name, locals);
      const right = args.length === 1 ? c(args[0]) : this.compile({ type: 'tuple', items: args }, locals);
      return (env) => mul(left(env), right(env));
    }

    // 用户定义的函数 f(2)，以及导数 f'(x)
    const obj = this.byName.get(name);
    // 多元函数 f(x, y)：可以写 f(2, 3)，也可以直接代入一个点 f(B)
    if (obj && obj.kind === 'function2') {
      const fs = args.map(c);
      return (env) => {
        const fv = env.values[name];
        if (!fv || fv.T !== 'function2') return NaN;
        let vals = fs.map((g) => g(env));
        if (vals.length === 1 && isPt(vals[0])) vals = [vals[0].x, vals[0].y, vals[0].z ?? 0];
        return fv.f(...vals.map(toNum));
      };
    }
    if (obj && obj.kind === 'function') {
      // f(x) 写在需要“函数”的地方（如 Intersect(l, f(x))、Integral(f(x), 0, 1)）时，指的就是函数 f 本身
      const a0 = args[0];
      if (args.length === 1 && a0.type === 'var' && /^[xt]$/.test(a0.name) && !(locals && locals.has(a0.name)) && !this.byName.has(a0.name)) {
        return (env) => env.values[name];
      }
      const a = c(args[0]);
      return (env) => { const fv = env.values[name]; return fv && fv.T === 'function' ? callFn(fv, toNum(a(env))) : NaN; };
    }
    if (name.endsWith("'")) {
      const base = name.replace(/'+$/, '');
      const order = name.length - base.length;
      const bo = this.byName.get(base);
      if (bo && bo.kind === 'function') {
        const a = c(args[0]);
        return (env) => {
          let fv = env.values[base];
          if (!fv || fv.T !== 'function') return NaN;
          for (let i = 0; i < order; i++) fv = derivativeOf(fv);
          return callFn(fv, toNum(a(env)));
        };
      }
    }

    switch (name) {
      case 'If': {
        if (args.length < 2) throw new ParseError('If 至少需要 2 个参数');
        const fs = args.map(c);
        return (env) => {
          let i = 0;
          for (; i + 1 < fs.length; i += 2) if (truthy(fs[i](env))) return fs[i + 1](env);
          return i < fs.length ? fs[i](env) : NaN;
        };
      }
      case 'Function': {
        if (args.length < 1) throw new ParseError('Function 缺少表达式');
        const ef = this.compile(args[0], this.withLocals(locals, ['x']));
        return this.makeFunction(ef, 'x', args[1] && c(args[1]), args[2] && c(args[2]));
      }
      case 'Curve': {
        // Curve(x(t), y(t), t, a, b) 或三维 Curve(x(t), y(t), z(t), t, a, b)
        const is3 = args.length >= 6;
        const vi = is3 ? 3 : 2;
        if (args.length < vi + 3 || args[vi].type !== 'var') throw new ParseError('Curve 的格式应为 Curve(x(t), y(t), t, 起点, 终点)');
        const v = args[vi].name;
        const L = this.withLocals(locals, [v]);
        const fx = this.compile(args[0], L), fy = this.compile(args[1], L), fz = is3 ? this.compile(args[2], L) : null;
        const fa = c(args[vi + 1]), fb = c(args[vi + 2]);
        return (env) => {
          const loc = Object.create(env.locals);
          const e2 = { values: env.values, state: env.state, locals: loc, scene: env.scene };
          const at = (f) => (t) => { loc[v] = t; return toNum(f(e2)); };
          return { T: 'curve', fx: at(fx), fy: at(fy), fz: fz ? at(fz) : null, t0: toNum(fa(env)), t1: toNum(fb(env)) };
        };
      }
      case 'Region': return this.compileRegion(args, locals);
      case 'Slider': throw new ParseError('Slider 只能写成「名称 = Slider(最小值, 最大值, 初始值)」');
    }
    if (SETTINGS.has(name)) throw new ParseError(`${name} 需要单独写一行`);

    if (MATH1[name] && args.length === 1) { const f = MATH1[name], a = c(args[0]); return (env) => f(a(env)); }
    if (name === 'log' || MATHN[name]) { const f = MATHN[name], fs = args.map(c); return (env) => f(fs.map((g) => g(env))); }
    if (MATH1[name]) throw new ParseError(`${name} 只接受 1 个参数`);

    name = ALIASES[name] || name;
    const fn = CMD[name];
    if (!fn) throw new ParseError(`未知命令「${node.name}」`);
    const fs = args.map(c);
    const needCtx = CTX_CMDS.has(name);
    const arity = fn.length;
    return (env) => {
      const vals = fs.map((g) => g(env));
      if (needCtx) {
        // 多写的参数去掉，保证上下文总在最后一个参数的位置（Intersect(a, b, 1, 1) 不会把 1 当成上下文）
        if (vals.length > arity - 1) vals.length = arity - 1;
        while (vals.length < arity - 1) vals.push(undefined);
        vals.push({ range: env.scene.range });
      }
      return fn(...vals);
    };
  }

  compileRegion(args, locals) {
    const L = this.withLocals(locals, ['x', 'y']);
    const cons = args.map((a) => {
      if (a.type !== 'cmp' && a.type !== 'logic') throw new ParseError('Region 的参数应为不等式，如 x + y <= 4');
      const pred = this.compile(a, L);
      let lin = null;
      if (a.type === 'cmp' && a.ops.length === 1 && a.ops[0] !== '==' && a.ops[0] !== '!=') {
        const fl = this.compile(a.args[0], L), fr = this.compile(a.args[1], L);
        lin = { fl, fr, op: a.ops[0] };
      }
      return { pred, lin };
    });
    return (env) => {
      const loc = Object.create(env.locals);
      const e2 = { values: env.values, state: env.state, locals: loc, scene: env.scene };
      const preds = cons.map(({ pred }) => (x, y) => { loc.x = x; loc.y = y; return truthy(pred(e2)); });
      let linear = [];
      for (const { lin } of cons) {
        if (!lin) { linear = null; break; }
        const F = (x, y) => { loc.x = x; loc.y = y; return toNum(lin.fl(e2)) - toNum(lin.fr(e2)); };
        const c0 = F(0, 0), a = F(1, 0) - c0, b = F(0, 1) - c0;
        const ok = [[2.3, -1.7], [-3.1, 0.6]].every(([x, y]) => Math.abs(F(x, y) - (a * x + b * y + c0)) < 1e-9 * (1 + Math.abs(c0) + Math.abs(a * x) + Math.abs(b * y)));
        if (!ok || !finite(a) || !finite(b) || !finite(c0)) { linear = null; break; }
        linear.push({ a, b, c: c0, keepPositive: lin.op === '>' || lin.op === '>=' });
      }
      return { T: 'region', test: (x, y) => preds.every((p) => p(x, y)), linear };
    };
  }

  compileEquation(ast, locals) {
    const Lh = ast.left, Rh = ast.right;
    const varsR = collectVars(Rh);
    if (Lh.type === 'var' && Lh.name === 'y' && !varsR.has('y')) {
      const fe = this.compile(Rh, this.withLocals(locals, ['x']));
      const mk = this.makeFunction(fe, 'x');
      return (env) => {
        const fv = mk(env);
        // y = kx + b 视为直线，便于求垂线、平行线、交点
        const y0 = fv.f(0), k = fv.f(1) - y0;
        const linear = finite(y0) && finite(k) && [-1.3, 2.7, 6.1].every((x) => Math.abs(fv.f(x) - (y0 + k * x)) <= 1e-9 * (1 + Math.abs(y0) + Math.abs(k * x)));
        return linear ? G.lineThrough(pt(0, y0), pt(1, y0 + k)) : fv;
      };
    }
    if (Lh.type === 'var' && Lh.name === 'x' && !varsR.has('x') && !varsR.has('y')) {
      const ce = this.compile(Rh, locals);
      return (env) => { const k = toNum(ce(env)); return finite(k) ? G.lineThrough(pt(k, 0), pt(k, 1)) : null; };
    }
    const L2 = this.withLocals(locals, ['x', 'y']);
    const fl = this.compile(Lh, L2), fr = this.compile(Rh, L2);
    return (env) => {
      const loc = Object.create(env.locals);
      const e2 = { values: env.values, state: env.state, locals: loc, scene: env.scene };
      const F = (x, y) => { loc.x = x; loc.y = y; return toNum(fl(e2)) - toNum(fr(e2)); };
      const c0 = F(0, 0), a = F(1, 0) - c0, b = F(0, 1) - c0;
      const lin = finite(c0) && finite(a) && finite(b) && (Math.abs(a) > EPS || Math.abs(b) > EPS) &&
        [[1.7, -0.6], [-2.3, 3.1], [0.4, 5.2]].every(([x, y]) => Math.abs(F(x, y) - (a * x + b * y + c0)) <= 1e-9 * (1 + Math.abs(a * x) + Math.abs(b * y) + Math.abs(c0)));
      if (lin) {
        const n2 = a * a + b * b;
        const P = pt((-a * c0) / n2, (-b * c0) / n2);
        return G.lineThrough(P, pt(P.x - b, P.y + a));
      }
      return { T: 'implicit', F };
    };
  }

  // ---------- 添加一行命令 ----------
  addCommand(raw, lineNo = 0) {
    let src = restoreEscapes(String(raw)).trim();
    if (!src || src.startsWith('//') || src.startsWith('%')) return null;
    const tags = new Set();
    src = extractTags(src, tags);
    if (!src) return null;

    // 「A(2, 3)」这种教材写法 → A = (2, 3)
    const short = /^([A-Z][A-Za-z0-9_]*'*)\s*(\(.*\))\s*((["“].*)?)$/.exec(src);
    if (short && !this.isCallable(short[1]) && short[2].includes(',')) src = `${short[1]} = ${short[2]} ${short[3] || ''}`.trim();

    let name = null, fvar = null, sep = null, rhs = src;
    const m = LHS_RE.exec(src);
    if (m) {
      const coordEq = !m[2] && m[3] === '=' && /^[xy]$/.test(m[1]); // y = 2x + 1、x = 3 是方程；z = 2x + y 是二元函数
      if (!coordEq) { name = m[1]; fvar = m[2] ? m[2].replace(/\s+/g, '') : null; sep = m[3]; rhs = src.slice(m[0].length); }
    }
    if (name && this.byName.has(name)) throw new ParseError(`名称「${name}」已经定义过了`);
    if (name && (CMD[name] || MATH1[name] || name in CONSTANTS) && name !== 'e') throw new ParseError(`「${name}」是保留字，请换一个名字`);

    // 表格：单元格里的文字可以不加引号——小模型在 JSON 里写一串带引号的单元格时，常把转义写错
    const tm = /^(Row|Table)\s*\(([\s\S]*)\)\s*$/.exec(rhs.trim());
    if (tm) return this.addTableCommand(tm[1], tm[2], { name, raw, lineNo, tags });

    // 省略乘号的写法（ax^2、xe^x、xlnx）在解析时拆开；变量是函数的自变量，方程、区域里是 x、y
    const vars = new Set(fvar ? fvar.split(',') : ['x', 'y']);
    let { ast, label } = parseExpression(rhs, { ...this.parseOpts, splitIdent: (id, beforeParen) => this.splitIdent(id, vars, beforeParen) });
    let role = 'derived';
    let compute;
    let kindHint = null;
    let slider = null;

    let isCall = (n) => ast.type === 'call' && (ALIASES[ast.name] || ast.name) === n;
    if (isCall('Point') && (ast.args.length === 2 || ast.args.length === 3) && ast.args.every((a) => this.isConstant(a))) {
      ast = { type: 'tuple', items: ast.args };
      isCall = () => false;
    }

    if (ast.type === 'call' && SETTINGS.has(ast.name)) {
      const vals = ast.args.map((a) => this.compile(a, null)(this.env()));
      if (ast.name === 'ShowAxes') this.settings.axes = vals.length ? truthy(vals[0]) : true;
      if (ast.name === 'ShowGrid') this.settings.grid = vals.length ? truthy(vals[0]) : true;
      if (ast.name === 'ZoomIn' || ast.name === 'SetView') {
        const [x0, y0, x1, y1] = vals.map(toNum);
        if ([x0, y0, x1, y1].every(finite) && x1 > x0 && y1 > y0) this.settings.view = { x0, x1, y0, y1 };
        else throw new ParseError('ZoomIn 的格式为 ZoomIn(xmin, ymin, xmax, ymax)');
      }
      return null;
    }

    if (fvar && fvar.includes(',')) {
      // 多元函数，例如线性规划的目标函数 f(x, y) = 2x + y（不画图，可以被调用）
      kindHint = 'function2';
      compute = this.makeFunction2(this.compile(ast, this.withLocals(null, fvar.split(','))), fvar.split(','));
    } else if (fvar) {
      kindHint = 'function';
      const fe = this.compile(ast, this.withLocals(null, [fvar]));
      compute = isCall('Function') || isCall('Derivative') ? fe : this.makeFunction(fe, fvar);
      // f'(x)、f''(x) 就是 f 的导函数：和程序求出的导数核对，对不上就改用程序求的。
      // 2B 自己求导常出错（R7-1 把 log((eˣ+e⁻ˣ)/2) 的导数写成了 (eˣ+e⁻ˣ)/2）
      const base = name && /'$/.test(name) ? name.slice(0, -1) : null;
      if (base && this.byName.get(base)?.kind === 'function' && !isCall('Derivative')) {
        const exact = (env) => { const bv = env.values[base]; return bv && bv.T === 'function' ? derivativeOf(bv) : null; };
        if (!sameFunctionValues(compute(this.env()), exact(this.env()))) {
          compute = exact;
          ast = { type: 'call', name: 'Derivative', args: [{ type: 'var', name: base }] };
          this.notes.push(`${name}(x) 的式子和 ${base}(x) 的导数对不上，已改为由程序求导`);
        }
      }
    } else if (ast.type === 'eq') {
      compute = this.compileEquation(ast, null);
    } else if ((ast.type === 'cmp' || ast.type === 'logic') && (collectVars(ast).has('x') || collectVars(ast).has('y'))) {
      compute = this.compileRegion([ast], null);
      kindHint = 'region';
    } else if (isCall('Slider')) {
      if (!name) throw new ParseError('滑块需要名字，例如 a = Slider(-2, 4, 1)');
      const vals = ast.args.map((a) => toNum(this.compile(a, null)(this.env())));
      let [min, max, init, step] = vals;
      if (!finite(min) || !finite(max) || max <= min) throw new ParseError('Slider 的格式为 Slider(最小值, 最大值, 初始值)');
      if (!finite(init)) init = min;
      init = Math.min(max, Math.max(min, init));
      if (!finite(step) || step <= 0) step = niceStep((max - min) / 100);
      slider = { min, max, step, init };
      role = 'slider';
      const nm = name;
      compute = (env) => {
        const v = env.state[nm];
        return typeof v === 'number' && finite(v) ? Math.min(max, Math.max(min, v)) : init;
      };
    } else if (isCall('Point') && ast.args.length >= 1 && !(ast.args.length === 1 && this.isPointLike(ast.args[0]))) {
      role = 'glider';
      const tf = this.compile(ast.args[0], null);
      const hf = ast.args[1] ? this.compile(ast.args[1], null) : null;
      const key = name;
      compute = (env) => {
        const target = tf(env);
        if (!target || typeof target !== 'object') return null;
        const s = key && env.state[key];
        const hint = s ? pt(s.x, s.y, s.z) : hf ? hf(env) : defaultOn(target, env.scene.range);
        return G.project(target, okPt(hint) ? hint : defaultOn(target, env.scene.range), env.scene.range);
      };
      kindHint = 'point';
    } else if (ast.type === 'tuple' && this.isConstant(ast)) {
      const f = this.compile(ast, null);
      const init = f(this.env());
      role = init.z === undefined && !tags.has('fixed') ? 'free' : 'fixed';
      const key = name;
      compute = (env) => {
        const s = key && env.state[key];
        return s && role === 'free' ? pt(s.x, s.y) : init;
      };
      kindHint = 'point';
    } else {
      // Region、Function、Curve 自己会绑定 x、y、t，不能因为里面出现 x、y 就当成函数
      const binds = ast.type === 'call' && ['Region', 'Function', 'Curve'].includes(ALIASES[ast.name] || ast.name);
      const vars = binds ? new Set() : this.freeVars(ast);
      const freeX = vars.has('x') && !this.byName.has('x');
      if (name && freeX && vars.has('y') && !this.byName.has('y')) {
        // z = 2x + y 视为二元函数
        compute = this.makeFunction2(this.compile(ast, this.withLocals(null, ['x', 'y'])), ['x', 'y']);
        kindHint = 'function2';
      } else if (freeX && !vars.has('y') && name) {
        // g = 2x + 1 视为函数
        const fe = this.compile(ast, this.withLocals(null, ['x']));
        compute = this.makeFunction(fe, 'x');
        kindHint = 'function';
      } else {
        compute = this.compile(ast, null);
        if (ast.type === 'call') {
          const cn = ALIASES[ast.name] || ast.name;
          kindHint = CMD_KIND[cn] || null;
          if (['Rotate', 'Reflect', 'Translate', 'Dilate'].includes(cn) && ast.args[0]?.type === 'var') {
            kindHint = this.byName.get(ast.args[0].name)?.kind || null;
          }
        }
        if (ast.type === 'tuple') kindHint = 'point';
      }
    }

    const objName = name || `_${++this.autoId}`;
    const obj = {
      name: objName, auto: !name, src: String(raw).trim(), lineNo, tags, role, slider,
      label, labelFn: label !== null ? this.compileTemplate(label, null) : null, labelText: label,
      compute, kind: kindHint, value: null,
      tex: formulaTex(ast, name, fvar, kindHint),
    };
    const env = this.env();
    const v = compute(env);
    obj.value = normalizeValue(v);
    obj.kind = kindOf(obj.value) || kindHint;
    if (!obj.kind) throw new ParseError('无法确定这条命令要画什么');
    if (obj.labelFn) obj.labelText = obj.labelFn(env);
    this.values[objName] = obj.value;
    this.objects.push(obj);
    this.byName.set(objName, obj);
    return obj;
  }

  // 一个单元格：带引号的是文字（可以含 {实时表达式}）；能算出数的按数显示；其余（男生、近视、P(男生|近视)、X）当文字
  compileCell(raw) {
    const t = raw.trim();
    if (!t) return () => '';
    const q = /^["“]([\s\S]*)["”]$/.exec(t);
    if (q) return this.compileTemplate(q[1], null);
    if (/^[A-Za-zͰ-Ͽ][A-Za-z0-9_Ͱ-Ͽ]*'*$/.test(t)) {
      // 单独的名字：滑块、常数取它的值；X、P、点名等当作文字
      if (this.byName.get(t)?.kind === 'number') return (env) => fmtCell(toNum(env.values[t]));
      return () => t;
    }
    try {
      const { ast, label } = parseExpression(t, this.parseOpts);
      if (label !== null) return () => t;
      const f = this.compile(ast, null);
      const v0 = f(this.env());
      if (typeof v0 !== 'number' && !isPt(v0)) return () => t;
      const preferFraction = /\//.test(t);
      return (env) => { const v = f(env); return typeof v === 'number' ? fmtCell(v, preferFraction) : formatValue(v); };
    } catch {
      return () => t;
    }
  }

  addTableCommand(kind, inner, { name, raw, lineNo, tags }) {
    const cells = splitCells(inner).map((c) => this.compileCell(c));
    const compute = kind === 'Table'
      ? (env) => ({ T: 'table', title: cells.map((f) => f(env)).join(', ') })
      : (env) => ({ T: 'row', cells: cells.map((f) => f(env)) });
    const objName = name || `_${++this.autoId}`;
    const obj = {
      name: objName, auto: !name, src: String(raw).trim(), lineNo, tags, role: 'derived', slider: null,
      label: null, labelFn: null, labelText: null, compute, kind: kind === 'Table' ? 'table' : 'row', value: null, tex: null,
    };
    obj.value = compute(this.env());
    this.values[objName] = obj.value;
    this.objects.push(obj);
    this.byName.set(objName, obj);
    return obj;
  }

  isConstant(ast) {
    const vars = collectVars(ast);
    for (const v of vars) if (!(v in CONSTANTS)) return false;
    let ok = true;
    const walk = (n) => {
      if (!n || !ok) return;
      if (n.type === 'call' && !MATH1[n.name] && !MATHN[n.name]) ok = false;
      ['arg', 'left', 'right'].forEach((k) => n[k] && walk(n[k]));
      ['items', 'args'].forEach((k) => n[k] && n[k].forEach(walk));
    };
    walk(ast);
    return ok;
  }

  isPointLike(ast) {
    if (ast.type === 'tuple') return true;
    if (ast.type === 'var') return this.byName.get(ast.name)?.kind === 'point';
    return false;
  }

  recompute() {
    const env = this.env();
    for (const o of this.objects) {
      let v = null;
      try { v = normalizeValue(o.compute(env)); } catch { v = null; }
      o.value = v;
      this.values[o.name] = v;
      if (o.labelFn) { try { o.labelText = o.labelFn(env); } catch { /* 保留旧标签 */ } }
    }
  }

  get mode() {
    for (const o of this.objects) {
      const v = o.value;
      if (!v || typeof v !== 'object') continue;
      if (v.T === 'point' && v.z !== undefined && !o.tags.has('hidden')) return '3d';
      if (['sphere', 'cylinder', 'cone', 'solid'].includes(v.T)) return '3d';
      if (v.T === 'line' && v.p.z !== undefined) return '3d';
    }
    return '2d';
  }

  sliders() { return this.objects.filter((o) => o.role === 'slider'); }

  // ---------- 自动推算二维视窗 ----------
  computeView() {
    if (this.settings.view) {
      const v = this.settings.view;
      const plotty = this.objects.some((o) => o.value && ['function', 'curve', 'region', 'integral'].includes(o.value.T));
      return { ...v, keepAspect: !plotty || this.hasGeometry() };
    }
    const anchors = [];
    const funcs = [];
    const addA = (x, y) => { if (finite(x) && finite(y) && Math.abs(x) < 1e5 && Math.abs(y) < 1e5) anchors.push([x, y]); };
    const visit = () => {
      for (const o of this.objects) {
        if (o.tags.has('hidden')) continue;
        const v = o.value;
        if (!v || typeof v !== 'object') continue;
        switch (v.T) {
          case 'point': addA(v.x, v.y); break;
          case 'line': addA(v.p.x, v.p.y); addA(v.q.x, v.q.y); break;
          case 'circle': case 'arc': case 'sector': addA(v.c.x - v.r, v.c.y - v.r); addA(v.c.x + v.r, v.c.y + v.r); break;
          case 'polygon': case 'polyline': v.pts.forEach((p) => addA(p.x, p.y)); break;
          case 'text': if (v.pos) addA(v.pos.x, v.pos.y); break;
          case 'brace': addA(v.p.x, v.p.y); addA(v.q.x, v.q.y); break;
          case 'angle': addA(v.B.x, v.B.y); break;
          case 'integral': addA(v.a, 0); addA(v.b, 0); addA(v.a, v.f.f(v.a)); addA(v.b, v.f.f(v.b)); break;
          case 'function': funcs.push(v); functionAnchors(v, addA); break;
          case 'curve': for (let i = 0; i <= 60; i++) { const t = v.t0 + ((v.t1 - v.t0) * i) / 60; addA(v.fx(t), v.fy(t)); } break;
          case 'implicit': implicitAnchors(v, addA); break;
          case 'region': if (v.linear) regionAnchors(v, addA); break;
        }
      }
    };
    visit();
    const sl = this.sliders().slice(0, 3);
    if (sl.length) {
      const saved = { ...this.state };
      for (const s of sl) {
        for (const val of [s.slider.min, s.slider.max]) {
          this.state[s.name] = val;
          this.recompute();
          visit();
        }
        this.state[s.name] = saved[s.name];
        if (saved[s.name] === undefined) delete this.state[s.name];
      }
      this.recompute();
    }
    const axes = this.axesShown();
    if (axes) addA(0, 0);
    let x0, x1, y0, y1;
    if (!anchors.length) { x0 = -5; x1 = 5; y0 = -5; y1 = 5; }
    else {
      x0 = Math.min(...anchors.map((a) => a[0])); x1 = Math.max(...anchors.map((a) => a[0]));
      y0 = Math.min(...anchors.map((a) => a[1])); y1 = Math.max(...anchors.map((a) => a[1]));
    }
    const minSpan = funcs.length ? 4 : 2;
    if (x1 - x0 < minSpan) { const c = (x0 + x1) / 2; x0 = c - minSpan / 2; x1 = c + minSpan / 2; }
    if (funcs.length) {
      // 在当前 x 范围内采样函数值，取分位数，避免渐近线把 y 轴范围拉得过大
      const pad = (x1 - x0) * 0.15;
      const ys = [];
      for (const fv of funcs) {
        for (let i = 0; i <= 200; i++) {
          const x = x0 - pad + ((x1 - x0 + 2 * pad) * i) / 200;
          if (x < fv.a || x > fv.b) continue;
          const y = fv.f(x);
          if (finite(y)) ys.push(y);
        }
      }
      if (ys.length > 10) {
        ys.sort((a, b) => a - b);
        const lo = ys[Math.floor(ys.length * 0.08)], hi = ys[Math.floor(ys.length * 0.92)];
        y0 = Math.min(y0, lo); y1 = Math.max(y1, hi);
      }
    }
    if (y1 - y0 < minSpan) { const c = (y0 + y1) / 2; y0 = c - minSpan / 2; y1 = c + minSpan / 2; }
    const ratio = (y1 - y0) / (x1 - x0);
    const plotty = this.objects.some((o) => o.value && ['function', 'curve', 'region', 'integral'].includes(o.value.T));
    const keepAspect = !plotty || this.hasGeometry() || (ratio < 2.5 && ratio > 0.4);
    const big = Math.max(x1 - x0, y1 - y0);
    const px = keepAspect ? big * 0.14 : (x1 - x0) * 0.14;
    const py = keepAspect ? big * 0.14 : (y1 - y0) * 0.14;
    const view = { x0: x0 - px, x1: x1 + px, y0: y0 - py, y1: y1 + py, keepAspect };
    return view;
  }

  hasGeometry() {
    return this.objects.some((o) => o.value && ['circle', 'polygon', 'angle', 'arc', 'sector', 'implicit'].includes(o.value.T));
  }

  // 图里有函数图像、方程曲线、不等式区域、积分时，一律画标准坐标系：
  // 2B 常照抄提示词里三角形例题的第一行 ShowAxes(false)，连函数图像的坐标轴也关掉了（日本考题 R6-1、R6-4、R7-1）。
  // 纯几何图形、线段图仍按模型的设置。
  hasAnalytic() {
    return this.objects.some((o) => o.tex && !o.tags.has('hidden') && o.value
      && ['function', 'curve', 'implicit', 'region', 'integral', 'line'].includes(o.value.T));
  }

  axesShown() {
    if (this.mode === '2d' && this.hasAnalytic()) return true;
    if (this.settings.axes !== null) return this.settings.axes;
    return this.mode === '2d';
  }

  gridShown() {
    if (this.settings.grid !== null) return this.settings.grid;
    return this.axesShown() && this.mode === '2d';
  }

  setRange(v) {
    const w = v.x1 - v.x0, h = v.y1 - v.y0;
    this.range = { x0: v.x0 - w, x1: v.x1 + w, y0: v.y0 - h, y1: v.y1 + h, span: Math.max(w, h) * 3 };
  }
}

// 程序实际解析出的公式（只针对函数、方程、不等式这类“写公式”的命令），供界面核对
function formulaTex(ast, name, fvar, kindHint) {
  try {
    const nm = name ? toLatex({ type: 'var', name }) : '';
    if (fvar) return `${nm}(${fvar.split(',').join(', ')}) = ${toLatex(ast)}`;
    if (ast.type === 'eq') return `${name ? `${nm}:\\ ` : ''}${toLatex(ast)}`;
    if (ast.type === 'cmp' || ast.type === 'logic') return toLatex(ast);
    if (ast.type === 'call' && ['Function', 'Curve', 'Region', 'If', 'Derivative'].includes(ast.name)) return `${name ? `${nm} = ` : ''}${toLatex(ast)}`;
    if (kindHint === 'function' && name) return `${nm}(x) = ${toLatex(ast)}`;
    if (kindHint === 'function2' && name) return `${nm}(x, y) = ${toLatex(ast)}`;
  } catch { /* 打印失败不影响作图 */ }
  return null;
}

function callFn(fv, x) {
  if (x < fv.a - 1e-12 || x > fv.b + 1e-12) return NaN;
  return fv.f(x);
}

function normalizeValue(v) {
  if (v === undefined) return null;
  if (typeof v === 'number' && Number.isNaN(v)) return v;
  if (v && v.T === 'point' && !okPt(v)) return null;
  return v;
}
function kindOf(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'string') return 'string';
  return v.T || null;
}

export function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function functionAnchors(fv, addA) {
  const a = Math.max(fv.a, -10), b = Math.min(fv.b, 10);
  if (!(b > a)) return;
  if (finite(fv.a) && fv.a > -10) addA(fv.a, fv.f(fv.a));
  if (finite(fv.b) && fv.b < 10) addA(fv.b, fv.f(fv.b));
  if (a <= 0 && b >= 0) addA(0, fv.f(0));
  for (const r of G.findRoots(fv.f, a, b, 400)) addA(r, 0);
  for (const e of G.findExtrema(fv.f, a, b, 400)) addA(e.x, e.y);
}

function implicitAnchors(v, addA) {
  const N = 96, L = 12;
  const h = (2 * L) / N;
  const row = new Array(N + 1);
  let prev = null;
  for (let j = 0; j <= N; j++) {
    const y = -L + j * h;
    for (let i = 0; i <= N; i++) row[i] = v.F(-L + i * h, y);
    if (prev) {
      for (let i = 0; i < N; i++) {
        const vals = [prev[i], prev[i + 1], row[i], row[i + 1]];
        if (!vals.every(finite)) continue;
        if (Math.min(...vals) <= 0 && Math.max(...vals) >= 0) addA(-L + (i + 0.5) * h, y - h / 2);
      }
    }
    prev = row.slice();
  }
}

function regionAnchors(v, addA) {
  const B = 14;
  let poly = [pt(-B, -B), pt(B, -B), pt(B, B), pt(-B, B)];
  for (const c of v.linear) poly = G.clipPolygon(poly, c.a, c.b, c.c, c.keepPositive);
  for (const p of poly) if (Math.abs(p.x) < B - 1e-6 && Math.abs(p.y) < B - 1e-6) addA(p.x, p.y);
}

// ---------------- 对外接口 ----------------
export function buildScene(commands, state = {}) {
  const scene = new Scene(state);
  const lines = Array.isArray(commands) ? commands : String(commands).split(/\r?\n/);
  // 后面才定义的名字：先用后定义（小模型常见）的命令推迟到定义之后再执行
  const definedAt = new Map();
  lines.forEach((line, i) => {
    const m = LHS_RE.exec(String(line).trim());
    if (m && !definedAt.has(m[1])) definedAt.set(m[1], i);
  });
  const fail = (i, e) => scene.errors.push({ line: i, src: String(lines[i]).trim(), message: e instanceof ParseError ? e.message : `出错：${e.message}` });
  let deferred = [];
  // 小模型偶尔把整段命令重复输出好几遍：完全相同的行只执行一次
  const seen = new Set();
  let dup = 0;
  lines.forEach((line, i) => {
    const key = String(line).trim();
    if (key && seen.has(key)) { dup++; return; }
    seen.add(key);
    try {
      scene.addCommand(line, i);
    } catch (e) {
      const missing = /未定义的名称「(.+?)」/.exec(e.message)?.[1];
      if (missing && definedAt.get(missing) > i) deferred.push({ i, e });
      else fail(i, e);
    }
  });
  for (let pass = 0; pass < 3 && deferred.length; pass++) {
    const next = [];
    for (const d of deferred) {
      try { scene.addCommand(lines[d.i], d.i); } catch (e) { next.push({ i: d.i, e }); }
    }
    if (next.length === deferred.length) break;
    deferred = next;
  }
  deferred.forEach((d) => fail(d.i, d.e));
  if (dup) scene.notes.push(`跳过了 ${dup} 条重复的命令`);
  scene.errors.sort((a, b) => a.line - b.line);
  if (scene.mode === '2d') scene.setRange(scene.computeView());
  return scene;
}
