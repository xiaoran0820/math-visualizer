// 几何与数值工具：向量运算、交点、投影、求根、变换等。与渲染无关，可在 Node 中测试。

export const EPS = 1e-9;
export const finite = (n) => typeof n === 'number' && Number.isFinite(n);

export function pt(x, y, z) {
  return z === undefined ? { T: 'point', x, y } : { T: 'point', x, y, z };
}
export const isPt = (v) => !!v && v.T === 'point';
export const okPt = (p) => isPt(p) && finite(p.x) && finite(p.y) && (p.z === undefined || finite(p.z));
const z3 = (a, b) => (a.z === undefined && b.z === undefined ? undefined : (a.z || 0) + (b.z || 0));

export const vadd = (a, b) => pt(a.x + b.x, a.y + b.y, z3(a, b));
export const vsub = (a, b) => pt(a.x - b.x, a.y - b.y, a.z === undefined && b.z === undefined ? undefined : (a.z || 0) - (b.z || 0));
export const vscale = (a, k) => pt(a.x * k, a.y * k, a.z === undefined ? undefined : a.z * k);
export const vdot = (a, b) => a.x * b.x + a.y * b.y + (a.z || 0) * (b.z || 0);
export const vlen = (a) => Math.sqrt(vdot(a, a));
export const dist = (a, b) => vlen(vsub(a, b));
export const vcross = (a, b) => pt(
  a.y * (b.z || 0) - (a.z || 0) * b.y,
  (a.z || 0) * b.x - a.x * (b.z || 0),
  a.x * b.y - a.y * b.x,
);
export const cross2 = (a, b) => a.x * b.y - a.y * b.x;
export function vnorm(a) {
  const l = vlen(a);
  return l < EPS ? null : vscale(a, 1 / l);
}
export const lerp = (a, b, t) => vadd(a, vscale(vsub(b, a), t));

// ---------- 实数幂（支持负数的奇次方根，如 (-8)^(1/3) = -2） ----------
export function realPow(x, y) {
  if (x >= 0 || Number.isInteger(y)) return Math.pow(x, y);
  for (let q = 3; q <= 15; q += 2) {
    const p = y * q;
    if (Math.abs(p - Math.round(p)) < 1e-9) {
      const r = Math.pow(-x, y);
      return Math.round(p) % 2 === 0 ? r : -r;
    }
  }
  return NaN;
}

// ---------- 一维求根：变号二分 + 相切（|g| 局部极小）检测 ----------
function bisect(g, a, b, ga) {
  let fa = ga;
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    const fm = g(m);
    if (!finite(fm)) return m;
    if (fm === 0) return m;
    if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
    if (Math.abs(b - a) < 1e-13 * (1 + Math.abs(a))) break;
  }
  return (a + b) / 2;
}

function goldenMin(h, a, b) {
  const r = (Math.sqrt(5) - 1) / 2;
  let c = b - r * (b - a), d = a + r * (b - a);
  let fc = h(c), fd = h(d);
  for (let i = 0; i < 90; i++) {
    if (fc < fd) { b = d; d = c; fd = fc; c = b - r * (b - a); fc = h(c); }
    else { a = c; c = d; fc = fd; d = a + r * (b - a); fd = h(d); }
    if (Math.abs(b - a) < 1e-12 * (1 + Math.abs(a))) break;
  }
  return (a + b) / 2;
}

export function findRoots(g, a, b, n = 800) {
  const roots = [];
  if (!(b > a)) return roots;
  const h = (b - a) / n;
  const xs = new Array(n + 1), ys = new Array(n + 1);
  for (let i = 0; i <= n; i++) { xs[i] = a + i * h; ys[i] = g(xs[i]); }
  const delta = h * 1e-6;
  for (let i = 0; i < n; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (!finite(y0) || !finite(y1)) continue;
    if (y0 === 0 || y1 === 0) {
      // 采样点恰好是根：它旁边可能还紧挨着另一个根（如 (x-1)(x-1.001) 在 x=1 处采样）
      if (y0 === 0) {
        roots.push(xs[i]);
        const ye = g(xs[i] + delta);
        if (y1 !== 0 && finite(ye) && ye * y1 < 0) roots.push(bisect(g, xs[i] + delta, xs[i + 1], ye));
      } else {
        const ye = g(xs[i + 1] - delta);
        if (finite(ye) && ye * y0 < 0) roots.push(bisect(g, xs[i], xs[i + 1] - delta, y0));
      }
      continue;
    }
    if (y0 * y1 < 0) {
      const r = bisect(g, xs[i], xs[i + 1], y0);
      const gr = Math.abs(g(r));
      if (gr < 1e-6 * (1 + Math.abs(y0) + Math.abs(y1))) roots.push(r); // 排除 tan 这类间断点
    }
  }
  if (finite(ys[n]) && ys[n] === 0) roots.push(xs[n]);
  // 两侧同号但 |g| 在中间有局部极小：可能是相切（重根），也可能是一对挨得很近、采样没分开的根。
  // 沿着“朝 0 的方向”找极值：极值越过 0 → 两个根；极值恰好接近 0 → 相切的重根。
  for (let i = 1; i < n; i++) {
    const y0 = ys[i - 1], y1 = ys[i], y2 = ys[i + 1];
    if (!finite(y0) || !finite(y1) || !finite(y2)) continue;
    if (y0 * y1 <= 0 || y1 * y2 <= 0) continue;
    if (Math.abs(y1) > Math.abs(y0) || Math.abs(y1) > Math.abs(y2)) continue;
    const s = y1 > 0 ? 1 : -1;
    const m = goldenMin((x) => { const v = g(x); return finite(v) ? s * v : Infinity; }, xs[i - 1], xs[i + 1]);
    const gm = g(m);
    if (!finite(gm)) continue;
    if (s * gm < 0) {
      roots.push(bisect(g, xs[i - 1], m, y0), bisect(g, m, xs[i + 1], gm));
    } else if (Math.abs(gm) < 1e-9 * (1 + Math.abs(y0) + Math.abs(y2))) {
      roots.push(m);
    }
  }
  roots.sort((u, v) => u - v);
  // 只合并真正重复的根（同一个根被两种方式找到），不能把相距很近的两个根合并
  const out = [];
  for (const r of roots) if (!out.length || Math.abs(r - out[out.length - 1]) > 1e-9 * (1 + Math.abs(r)) + (b - a) * 1e-12) out.push(r);
  return out;
}

// 极值点（导数变号），用于自动找关键点
export function findExtrema(f, a, b, n = 600) {
  const out = [];
  const h = (b - a) / n;
  let x0 = a, y0 = f(a), x1 = a + h, y1 = f(x1);
  for (let i = 2; i <= n; i++) {
    const x2 = a + i * h, y2 = f(x2);
    if (finite(y0) && finite(y1) && finite(y2)) {
      const d1 = y1 - y0, d2 = y2 - y1;
      if (d1 * d2 < 0 && Math.abs(d1) < 1e6 && Math.abs(d2) < 1e6) {
        const isMax = d1 > 0;
        const m = goldenMin((x) => (isMax ? -f(x) : f(x)), x0, x2);
        const fm = f(m);
        if (finite(fm)) out.push({ x: m, y: fm, kind: isMax ? 'max' : 'min' });
      }
    }
    x0 = x1; y0 = y1; x1 = x2; y1 = y2;
  }
  return out;
}

// ---------- 直线 ----------
export function lineThrough(p, q, kind = 'line') {
  if (!okPt(p) || !okPt(q)) return null;
  return { T: 'line', kind, p, q };
}
function lineParamOk(kind, s) {
  if (kind === 'segment' || kind === 'vector') return s >= -1e-9 && s <= 1 + 1e-9;
  if (kind === 'ray') return s >= -1e-9;
  return true;
}
export function footOnLine(P, L) {
  const d = vsub(L.q, L.p);
  const dd = vdot(d, d);
  if (dd < EPS * EPS) return L.p;
  const s = vdot(vsub(P, L.p), d) / dd;
  return vadd(L.p, vscale(d, s));
}
function interLineLine(a, b) {
  const d1 = vsub(a.q, a.p), d2 = vsub(b.q, b.p);
  const den = cross2(d1, d2);
  if (Math.abs(den) < 1e-12 * (vlen(d1) * vlen(d2) + EPS)) return [];
  const w = vsub(b.p, a.p);
  const s = cross2(w, d2) / den, t = cross2(w, d1) / den;
  if (!lineParamOk(a.kind, s) || !lineParamOk(b.kind, t)) return [];
  return [vadd(a.p, vscale(d1, s))];
}
function interLineCircle(L, C) {
  const d = vsub(L.q, L.p), f = vsub(L.p, C.c);
  const A = vdot(d, d), B = 2 * vdot(f, d), K = vdot(f, f) - C.r * C.r;
  if (A < EPS * EPS) return [];
  let disc = B * B - 4 * A * K;
  const tol = 1e-10 * (B * B + Math.abs(4 * A * K) + 1);
  if (disc < -tol) return [];
  if (disc < tol) disc = 0;
  const sq = Math.sqrt(disc);
  const ss = disc === 0 ? [-B / (2 * A)] : [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
  return ss.filter((s) => lineParamOk(L.kind, s)).map((s) => vadd(L.p, vscale(d, s)));
}
function interCircleCircle(a, b) {
  const d = dist(a.c, b.c);
  if (d < EPS) return [];
  if (d > a.r + b.r + 1e-9 || d < Math.abs(a.r - b.r) - 1e-9) return [];
  const x = (d * d + a.r * a.r - b.r * b.r) / (2 * d);
  const h = Math.sqrt(Math.max(0, a.r * a.r - x * x));
  const e = vscale(vsub(b.c, a.c), 1 / d);
  const m = vadd(a.c, vscale(e, x));
  const n = pt(-e.y, e.x);
  if (h < 1e-9) return [m];
  const out = [vadd(m, vscale(n, h)), vsub(m, vscale(n, h))];
  out.sort((u, v) => u.x - v.x || u.y - v.y);
  return out;
}

// ---------- 参数形式 / 隐式形式（用于通用求交与投影） ----------
export function polygonEdges(v) {
  const pts = v.pts;
  const edges = [];
  const n = pts.length;
  const closed = v.T === 'polygon';
  for (let i = 0; i < (closed ? n : n - 1); i++) edges.push({ T: 'line', kind: 'segment', p: pts[i], q: pts[(i + 1) % n] });
  return edges;
}
const TAU = Math.PI * 2;
const normAngle = (t) => ((t % TAU) + TAU) % TAU;
// 从 a0 逆时针转到 a1 的弧度（0 视为整圆）
export function arcSpan(a0, a1) {
  return normAngle(a1 - a0) || TAU;
}
function angleIn(a, a0, a1) {
  return normAngle(a - a0) <= arcSpan(a0, a1) + 1e-9;
}

function paramForm(v, R) {
  switch (v.T) {
    case 'line': {
      const d = vsub(v.q, v.p);
      const dl = vlen(d);
      if (dl < EPS) return null;
      const S = (vlen(v.p) + 4 * R.span) / dl;
      const [s0, s1] = v.kind === 'segment' || v.kind === 'vector' ? [0, 1] : v.kind === 'ray' ? [0, S] : [-S, S];
      return { f: (s) => vadd(v.p, vscale(d, s)), s0, s1 };
    }
    case 'circle':
      return { f: (t) => pt(v.c.x + v.r * Math.cos(t), v.c.y + v.r * Math.sin(t)), s0: 0, s1: Math.PI * 2 };
    case 'arc':
      return { f: (t) => pt(v.c.x + v.r * Math.cos(t), v.c.y + v.r * Math.sin(t)), s0: v.a0, s1: v.a0 + arcSpan(v.a0, v.a1) };
    case 'function': {
      const a = Math.max(v.a, R.x0), b = Math.min(v.b, R.x1);
      if (!(b > a)) return null;
      return { f: (x) => pt(x, v.f(x)), s0: a, s1: b };
    }
    case 'curve':
      return { f: (t) => pt(v.fx(t), v.fy(t)), s0: v.t0, s1: v.t1 };
    default:
      return null;
  }
}
function implicitForm(v) {
  switch (v.T) {
    case 'line': {
      const d = vsub(v.q, v.p);
      return (P) => cross2(d, vsub(P, v.p));
    }
    case 'circle':
      return (P) => (P.x - v.c.x) ** 2 + (P.y - v.c.y) ** 2 - v.r * v.r;
    case 'function':
      return (P) => (P.x < v.a - 1e-12 || P.x > v.b + 1e-12 ? NaN : P.y - v.f(P.x));
    case 'implicit':
      return (P) => v.F(P.x, P.y);
    default:
      return null;
  }
}

export function intersections(a, b, R) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return [];
  const ta = a.T, tb = b.T;
  if (ta === 'polygon' || ta === 'polyline') return polygonEdges(a).flatMap((e) => intersections(e, b, R));
  if (tb === 'polygon' || tb === 'polyline') return polygonEdges(b).flatMap((e) => intersections(a, e, R));
  if (ta === 'arc' || tb === 'arc') {
    const A = ta === 'arc' ? { T: 'circle', c: a.c, r: a.r } : a;
    const B = tb === 'arc' ? { T: 'circle', c: b.c, r: b.r } : b;
    return intersections(A, B, R).filter((P) => {
      if (ta === 'arc' && !angleIn(Math.atan2(P.y - a.c.y, P.x - a.c.x), a.a0, a.a1)) return false;
      if (tb === 'arc' && !angleIn(Math.atan2(P.y - b.c.y, P.x - b.c.x), b.a0, b.a1)) return false;
      return true;
    });
  }
  if (ta === 'line' && tb === 'line') return interLineLine(a, b);
  if (ta === 'line' && tb === 'circle') return interLineCircle(a, b);
  if (ta === 'circle' && tb === 'line') return interLineCircle(b, a);
  if (ta === 'circle' && tb === 'circle') return interCircleCircle(a, b);
  const pa = paramForm(a, R), pb = paramForm(b, R);
  const ia = implicitForm(a), ib = implicitForm(b);
  const along = (pf, F) => findRoots((s) => F(pf.f(s)), pf.s0, pf.s1, 1200).map(pf.f).filter(okPt);
  if (pa && ib) return along(pa, ib);
  if (pb && ia) return along(pb, ia);
  return [];
}

// ---------- 最近点（用于动点 Point(obj) 和 ClosestPoint） ----------
export function project(v, Q, R) {
  if (!v || !okPt(Q)) return null;
  switch (v.T) {
    case 'point': return v;
    case 'line': {
      const d = vsub(v.q, v.p);
      const dd = vdot(d, d);
      if (dd < EPS * EPS) return v.p;
      let s = vdot(vsub(Q, v.p), d) / dd;
      if (v.kind === 'segment' || v.kind === 'vector') s = Math.min(1, Math.max(0, s));
      if (v.kind === 'ray') s = Math.max(0, s);
      return vadd(v.p, vscale(d, s));
    }
    case 'circle': {
      const u = vnorm(vsub(Q, v.c)) || pt(1, 0, v.c.z === undefined ? undefined : 0);
      return vadd(v.c, vscale(u, v.r));
    }
    case 'arc': {
      let t = Math.atan2(Q.y - v.c.y, Q.x - v.c.x);
      if (!angleIn(t, v.a0, v.a1)) {
        const e0 = pt(v.c.x + v.r * Math.cos(v.a0), v.c.y + v.r * Math.sin(v.a0));
        const e1 = pt(v.c.x + v.r * Math.cos(v.a1), v.c.y + v.r * Math.sin(v.a1));
        return dist(Q, e0) < dist(Q, e1) ? e0 : e1;
      }
      return pt(v.c.x + v.r * Math.cos(t), v.c.y + v.r * Math.sin(t));
    }
    case 'polygon':
    case 'polyline': {
      let best = null, bd = Infinity;
      for (const e of polygonEdges(v)) {
        const P = project(e, Q, R);
        const d = dist(P, Q);
        if (d < bd) { bd = d; best = P; }
      }
      return best;
    }
    case 'function':
    case 'curve': {
      const pf = paramForm(v, R);
      if (!pf) return null;
      const n = 600;
      let bs = pf.s0, bd = Infinity;
      for (let i = 0; i <= n; i++) {
        const s = pf.s0 + (i / n) * (pf.s1 - pf.s0);
        const P = pf.f(s);
        if (!okPt(P)) continue;
        const d = dist(P, Q);
        if (d < bd) { bd = d; bs = s; }
      }
      const h = (pf.s1 - pf.s0) / n;
      const s = goldenMin((u) => { const P = pf.f(u); return okPt(P) ? dist(P, Q) : Infinity; }, Math.max(pf.s0, bs - h), Math.min(pf.s1, bs + h));
      const P = pf.f(s);
      return okPt(P) ? P : pf.f(bs);
    }
    case 'implicit': {
      let x = Q.x, y = Q.y;
      const hh = 1e-6;
      for (let i = 0; i < 40; i++) {
        const F = v.F(x, y);
        if (!finite(F)) return null;
        const gx = (v.F(x + hh, y) - v.F(x - hh, y)) / (2 * hh);
        const gy = (v.F(x, y + hh) - v.F(x, y - hh)) / (2 * hh);
        const g2 = gx * gx + gy * gy;
        if (g2 < 1e-18) break;
        x -= (F * gx) / g2;
        y -= (F * gy) / g2;
        if (Math.abs(F) < 1e-12) break;
      }
      return finite(x) && finite(y) ? pt(x, y) : null;
    }
    case 'sphere': {
      const u = vnorm(vsub(Q, v.c)) || pt(0, 0, 1);
      return vadd(v.c, vscale(u, v.r));
    }
    default:
      return null;
  }
}

// ---------- 三角形的心 ----------
export function circumcenter(A, B, C) {
  if (A.z !== undefined || B.z !== undefined || C.z !== undefined) {
    // 空间三角形：在三角形所在平面内求外心
    const ab = vsub(B, A), ac = vsub(C, A);
    const n = vcross(ab, ac);
    const n2 = vdot(n, n);
    if (n2 < EPS) return null;
    const term = vadd(vscale(vcross(n, ab), vdot(ac, ac)), vscale(vcross(ac, n), vdot(ab, ab)));
    return vadd(A, vscale(term, 1 / (2 * n2)));
  }
  const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  if (Math.abs(d) < EPS) return null;
  const a2 = A.x * A.x + A.y * A.y, b2 = B.x * B.x + B.y * B.y, c2 = C.x * C.x + C.y * C.y;
  return pt((a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d, (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d);
}
export function incenter(A, B, C) {
  const a = dist(B, C), b = dist(A, C), c = dist(A, B);
  const s = a + b + c;
  if (s < EPS) return null;
  return vscale(vadd(vadd(vscale(A, a), vscale(B, b)), vscale(C, c)), 1 / s);
}
export function polygonArea(pts) {
  if (pts.length < 3) return 0;
  if (pts.some((p) => p.z !== undefined)) {
    let s = pt(0, 0, 0);
    for (let i = 0; i < pts.length; i++) s = vadd(s, vcross(pts[i], pts[(i + 1) % pts.length]));
    return vlen(s) / 2;
  }
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += cross2(pts[i], pts[(i + 1) % pts.length]);
  return Math.abs(s) / 2;
}

// 角 ∠ABC（B 为顶点）的度数，0~180
export function angleDeg(A, B, C) {
  const u = vsub(A, B), v = vsub(C, B);
  const lu = vlen(u), lv = vlen(v);
  if (lu < EPS || lv < EPS) return NaN;
  const c = Math.max(-1, Math.min(1, vdot(u, v) / (lu * lv)));
  return (Math.acos(c) * 180) / Math.PI;
}

// Simpson 数值积分
export function integrate(f, a, b, n = 400) {
  if (!(finite(a) && finite(b)) || a === b) return 0;
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const y = f(a + i * h);
    if (!finite(y)) return NaN;
    s += y * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return (s * h) / 3;
}

// 半平面裁剪：把视窗矩形依次用 a x + b y + c (op) 0 裁剪，得到线性规划可行域
export function clipPolygon(poly, a, b, c, keepPositive) {
  const out = [];
  const val = (P) => a * P.x + b * P.y + c;
  const inside = (P) => (keepPositive ? val(P) >= -1e-12 : val(P) <= 1e-12);
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const ip = inside(P), iq = inside(Q);
    if (ip) out.push(P);
    if (ip !== iq) {
      const vp = val(P), vq = val(Q);
      const t = vp / (vp - vq);
      out.push(pt(P.x + (Q.x - P.x) * t, P.y + (Q.y - P.y) * t));
    }
  }
  return out;
}

// 三维凸包（点数很少，暴力枚举平面即可），返回朝外的面（按逆时针排列的点）
export function convexHullFaces(points) {
  const P = points.filter(okPt).map((p) => pt(p.x, p.y, p.z || 0));
  const uniq = [];
  for (const p of P) if (!uniq.some((q) => dist(p, q) < 1e-7)) uniq.push(p);
  const n = uniq.length;
  if (n < 4) return [];
  let center = pt(0, 0, 0);
  uniq.forEach((p) => { center = vadd(center, p); });
  center = vscale(center, 1 / n);
  const scale = Math.max(...uniq.map((p) => dist(p, center))) || 1;
  const tol = 1e-7 * scale;
  const faces = [];
  const seen = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nrm = vcross(vsub(uniq[j], uniq[i]), vsub(uniq[k], uniq[i]));
    const len = vlen(nrm);
    if (len < 1e-10 * scale * scale) continue;
    nrm = vscale(nrm, 1 / len);
    let d = vdot(nrm, uniq[i]);
    let pos = 0, neg = 0;
    for (let m = 0; m < n; m++) {
      const s = vdot(nrm, uniq[m]) - d;
      if (s > tol) pos++; else if (s < -tol) neg++;
    }
    if (pos && neg) continue;
    if (pos) { nrm = vscale(nrm, -1); d = -d; }
    if (seen.some((f) => vdot(f.n, nrm) > 1 - 1e-9 && Math.abs(f.d - d) < tol)) continue;
    const on = uniq.filter((p) => Math.abs(vdot(nrm, p) - d) <= tol);
    // 面内按角度排序
    let c = pt(0, 0, 0);
    on.forEach((p) => { c = vadd(c, p); });
    c = vscale(c, 1 / on.length);
    const u = vnorm(vsub(on[0], c)) || pt(1, 0, 0);
    const w = vcross(nrm, u);
    on.sort((p, q) => Math.atan2(vdot(vsub(p, c), w), vdot(vsub(p, c), u)) - Math.atan2(vdot(vsub(q, c), w), vdot(vsub(q, c), u)));
    seen.push({ n: nrm, d });
    faces.push({ n: nrm, d, pts: on });
  }
  return faces;
}
