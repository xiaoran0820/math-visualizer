// 立体几何渲染：正交投影到 SVG，拖动旋转、滚轮缩放。
// 被立体遮挡的棱按教材习惯画成虚线：用所有顶点的凸包作为“不透明的立体”，逐段判断可见性。
import * as G from './geom.js';
import { nameSvg } from './labels.js';
import { layoutLabels } from './labelLayout.js';
import { esc } from './markdown.js';
import { readTheme } from './theme.js';

const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
export const VIEWS = {
  default: { yaw: 28 * DEG, pitch: 21 * DEG },
  front: { yaw: 0, pitch: 0 }, // 正视图：从 x 轴正方向看
  side: { yaw: -90 * DEG, pitch: 0 }, // 侧视图（左视图）：从左侧看
  top: { yaw: 0, pitch: 89.9 * DEG }, // 俯视图
};

const { pt, vadd, vsub, vscale, vdot, vcross, vlen, vnorm, finite } = G;
const P3 = (p) => pt(p.x, p.y, p.z || 0);

export function render3d(container, scene, opts = {}) {
  const theme = readTheme();
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'board3d';
  container.appendChild(wrap);
  const W = container.clientWidth || 600;
  const H = Math.round(Math.max(300, Math.min(560, W * 0.8, window.innerHeight * 0.68)));
  wrap.style.height = `${H}px`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(H));
  svg.setAttribute('class', 'svg3d');
  wrap.appendChild(svg);

  let yaw = VIEWS.default.yaw, pitch = VIEWS.default.pitch, zoom = 1;
  let spinning = false, raf = 0, tween = null;
  let hullCache = { key: '', faces: [] };
  const showAxes = scene.settings.axes === true;

  const styleOf = (o) => (o.tags.has('hl') ? 'hl' : o.tags.has('result') ? 'result' : o.tags.has('aux') ? 'aux' : 'given');
  const rank = { given: 0, aux: 1, result: 2, hl: 3 };
  const colorOf = (s) => ({ hl: theme.accent, result: theme.result, aux: theme.aux, given: theme.ink, axis: theme.axis }[s] || theme.ink);

  function collect() {
    const points = [], edges = [], faces = [], solids = [], angles = [], texts = [], curves = [];
    const edgeMap = new Map();
    const key = (p) => `${p.x.toFixed(6)},${p.y.toFixed(6)},${(p.z || 0).toFixed(6)}`;
    const addEdge = (a, b, style, ext = 0) => {
      if (!G.okPt(a) || !G.okPt(b)) return;
      let A = P3(a), B = P3(b);
      if (ext) { const d = vsub(B, A); A = vsub(A, vscale(d, ext)); B = vadd(B, vscale(d, ext)); }
      const k = [key(A), key(B)].sort().join('|');
      const prev = edgeMap.get(k);
      if (!prev || rank[style] > rank[prev.style]) edgeMap.set(k, { a: A, b: B, style });
    };
    for (const o of scene.objects) {
      if (o.tags.has('hidden')) continue;
      const v = scene.values[o.name];
      if (!v || typeof v !== 'object') continue;
      const st = styleOf(o);
      switch (v.T) {
        case 'point': points.push({ o, p: P3(v), style: st }); break;
        case 'line': addEdge(v.p, v.q, st, v.kind === 'line' ? 0.6 : 0); if (v.kind === 'ray') addEdge(v.q, vadd(v.q, vscale(vsub(v.q, v.p), 0.6)), st); break;
        case 'polygon': faces.push({ pts: v.pts.map(P3), style: st }); v.pts.forEach((p, i) => addEdge(p, v.pts[(i + 1) % v.pts.length], st)); break;
        case 'polyline': v.pts.slice(1).forEach((p, i) => addEdge(v.pts[i], p, st)); break;
        case 'solid': v.edges.forEach(([a, b]) => addEdge(a, b, st)); break;
        case 'sphere': case 'cylinder': case 'cone': solids.push({ v, style: st }); break;
        case 'angle': angles.push({ v, style: st, o }); break;
        case 'text': if (v.pos) texts.push({ v, style: st }); break;
        case 'circle': { const pts = []; for (let i = 0; i <= 96; i++) { const t = (i / 96) * Math.PI * 2; pts.push(pt(v.c.x + v.r * Math.cos(t), v.c.y + v.r * Math.sin(t), v.c.z || 0)); } curves.push({ pts, style: st }); break; }
        case 'curve': if (v.fz) { const pts = []; for (let i = 0; i <= 200; i++) { const t = v.t0 + ((v.t1 - v.t0) * i) / 200; pts.push(pt(v.fx(t), v.fy(t), v.fz(t))); } curves.push({ pts: pts.filter(G.okPt), style: st }); } break;
      }
    }
    edges.push(...edgeMap.values());
    return { points, edges, faces, solids, angles, texts, curves };
  }

  function extents(c) {
    const all = [];
    c.points.forEach((p) => all.push(p.p));
    c.edges.forEach((e) => all.push(e.a, e.b));
    c.solids.forEach(({ v }) => {
      if (v.T === 'sphere') { for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) all.push(vadd(v.c, vscale(pt(...d), v.r))); }
      else { all.push(v.a, v.b); for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) all.push(vadd(v.a, vscale(pt(...d), v.r))); }
    });
    c.curves.forEach((cv) => all.push(...cv.pts));
    if (showAxes) all.push(pt(0, 0, 0));
    if (!all.length) return { c: pt(0, 0, 0), R: 1 };
    const lo = pt(Math.min(...all.map((p) => p.x)), Math.min(...all.map((p) => p.y)), Math.min(...all.map((p) => p.z)));
    const hi = pt(Math.max(...all.map((p) => p.x)), Math.max(...all.map((p) => p.y)), Math.max(...all.map((p) => p.z)));
    const ctr = vscale(vadd(lo, hi), 0.5);
    const R = Math.max(0.5, ...all.map((p) => vlen(vsub(p, ctr))));
    return { c: ctr, R };
  }

  function camera() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    return { d: pt(cp * cy, cp * sy, sp), right: pt(-sy, cy, 0), up: pt(-sp * cy, -sp * sy, cp) };
  }

  function hullFaces(c) {
    const pts = [...c.points.map((p) => p.p), ...c.edges.flatMap((e) => (e.style === 'axis' ? [] : [e.a, e.b])), ...c.faces.flatMap((f) => f.pts)];
    const k = pts.map((p) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`).sort().join(';');
    if (k !== hullCache.key) hullCache = { key: k, faces: G.convexHullFaces(pts) };
    return hullCache.faces;
  }

  function draw() {
    const c = collect();
    const { c: ctr, R } = extents(c);
    const cam = camera();
    const s = (Math.min(W, H) * 0.4 * zoom) / R;
    const proj = (p) => {
      const q = vsub(p, ctr);
      return { x: W / 2 + s * vdot(q, cam.right), y: H / 2 - s * vdot(q, cam.up), z: vdot(q, cam.d) };
    };
    const tol = 1e-6 * R;
    const hull = hullFaces(c).filter((f) => vdot(f.n, cam.d) > 1e-9);
    const occluded = (q) => {
      for (const f of hull) {
        const nd = vdot(f.n, cam.d);
        const t = (f.d - vdot(f.n, q)) / nd;
        if (t <= tol * 10) continue;
        const X = vadd(q, vscale(cam.d, t));
        let inside = true;
        for (let i = 0; i < f.pts.length; i++) {
          const a = f.pts[i], b = f.pts[(i + 1) % f.pts.length];
          if (vdot(vcross(vsub(b, a), vsub(X, a)), f.n) < tol * R * 4) { inside = false; break; }
        }
        if (inside) return true;
      }
      return false;
    };

    const parts = { fills: [], hidden: [], visible: [], marks: [], points: [], labels: [] };
    const line = (a, b, color, width, dashed, bucket) => {
      const A = proj(a), B = proj(b);
      parts[bucket].push(`<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" stroke="${color}" stroke-width="${width}"${dashed ? ' stroke-dasharray="5 4"' : ''} stroke-linecap="round"/>`);
    };
    const polyPath = (pts3, color, width, dashed, bucket) => {
      if (pts3.length < 2) return;
      const d = pts3.map((p, i) => { const P = proj(p); return `${i ? 'L' : 'M'}${P.x.toFixed(1)} ${P.y.toFixed(1)}`; }).join('');
      parts[bucket].push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${dashed ? ' stroke-dasharray="5 4"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`);
    };
    // 按可见性把一条折线拆成实线段和虚线段
    const drawRuns = (sample, n, vis, color, width) => {
      let run = [sample(0)], runVis = vis(0, sample(0.5 / n));
      for (let i = 1; i <= n; i++) {
        const p = sample(i / n);
        const v = i < n ? vis(i, sample((i + 0.5) / n)) : runVis;
        run.push(p);
        if (v !== runVis || i === n) {
          polyPath(run, runVis ? color : theme.hidden, runVis ? width : Math.max(1, width - 0.6), !runVis, runVis ? 'visible' : 'hidden');
          run = [p];
          runVis = v;
        }
      }
    };

    // 面（截面等）：半透明填充，从远到近
    c.faces
      .map((f) => ({ f, z: f.pts.reduce((a, p) => a + proj(p).z, 0) / f.pts.length }))
      .sort((a, b) => a.z - b.z)
      .forEach(({ f }) => {
        const d = f.pts.map((p, i) => { const P = proj(p); return `${i ? 'L' : 'M'}${P.x.toFixed(1)} ${P.y.toFixed(1)}`; }).join('') + 'Z';
        const col = f.style === 'hl' ? theme.accent : f.style === 'result' ? theme.result : theme.face;
        parts.fills.push(`<path d="${d}" fill="${col}" fill-opacity="${f.style === 'given' || f.style === 'aux' ? 0.07 : 0.2}" stroke="none"/>`);
      });

    // 旋转体
    for (const { v, style } of c.solids) drawSolid(v, style, cam, proj, s, parts, polyPath, drawRuns);

    // 棱：遮挡部分画虚线
    for (const e of c.edges) {
      const color = colorOf(e.style);
      const width = e.style === 'hl' || e.style === 'result' ? 2.6 : e.style === 'aux' ? 1.4 : 1.8;
      const dir = vsub(e.b, e.a);
      const n = 48;
      // 立体图中辅助线也遵循“看得见画实线、被挡住画虚线”的规则，只是颜色不同
      drawRuns((t) => vadd(e.a, vscale(dir, t)), n, (i, q) => !occluded(q), color, width);
    }
    for (const cv of c.curves) {
      const color = colorOf(cv.style);
      const n = cv.pts.length - 1;
      drawRuns((t) => cv.pts[Math.round(t * n)], n, (i, q) => !occluded(q), color, 1.8);
    }

    // 坐标轴
    if (showAxes) {
      const L = R * 1.15 + vlen(ctr) * 0.5;
      [['x', pt(L, 0, 0)], ['y', pt(0, L, 0)], ['z', pt(0, 0, L)]].forEach(([nm, end]) => {
        const O = pt(0, 0, 0);
        drawRuns((t) => vscale(end, t), 40, (i, q) => !occluded(q), theme.axis, 1.2);
        const A = proj(O), B = proj(end);
        const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
        const ux = dx / l, uy = dy / l;
        parts.marks.push(`<path d="M${B.x} ${B.y}L${B.x - ux * 10 - uy * 4} ${B.y - uy * 10 + ux * 4}L${B.x - ux * 10 + uy * 4} ${B.y - uy * 10 - ux * 4}Z" fill="${theme.axis}"/>`);
        parts.labels.push(`<text data-k="fixed" x="${B.x + ux * 12}" y="${B.y + uy * 12 + 5}" class="lbl3d math" text-anchor="middle" fill="${theme.muted}">${nm}</text>`);
      });
    }

    // 角的记号
    for (const { v, style, o } of c.angles) {
      const B = P3(v.B), uA = vnorm(vsub(P3(v.A), B)), uC = vnorm(vsub(P3(v.C), B));
      if (!uA || !uC) continue;
      const rho = Math.min(vlen(vsub(P3(v.A), B)), vlen(vsub(P3(v.C), B)), R) * 0.2;
      const color = colorOf(style === 'given' ? 'given' : style);
      if (Math.abs(v.deg - 90) < 0.5) {
        const k = rho * 0.75;
        polyPath([vadd(B, vscale(uA, k)), vadd(B, vadd(vscale(uA, k), vscale(uC, k))), vadd(B, vscale(uC, k))], color, 1.3, false, 'marks');
      } else {
        const th = Math.acos(Math.max(-1, Math.min(1, vdot(uA, uC))));
        const arc = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const w1 = Math.sin((1 - t) * th) / Math.sin(th), w2 = Math.sin(t * th) / Math.sin(th);
          arc.push(vadd(B, vscale(vadd(vscale(uA, w1), vscale(uC, w2)), rho)));
        }
        polyPath(arc, color, 1.4, false, 'marks');
        if (o.labelText) {
          const mid = vadd(B, vscale(vnorm(vadd(uA, uC)) || uA, rho * 1.7));
          const P = proj(mid);
          parts.labels.push(`<text data-k="curve" x="${P.x.toFixed(1)}" y="${(P.y + 5).toFixed(1)}" class="lbl3d" text-anchor="middle" fill="${color}">${esc(o.labelText)}</text>`);
        }
      }
    }

    // 点与标签（标签朝远离整体中心的方向偏移）
    const center2 = proj(ctr);
    for (const { o, p, style } of c.points) {
      const P = proj(p);
      const hid = occluded(p);
      const color = style === 'given' ? theme.ink : colorOf(style);
      parts.points.push(`<circle cx="${P.x.toFixed(1)}" cy="${P.y.toFixed(1)}" r="${hid ? 2.2 : 2.8}" fill="${hid ? theme.hidden : color}"/>`);
      if (o.tags.has('nolabel') || o.auto) continue;
      let dx = P.x - center2.x, dy = P.y - center2.y;
      const l = Math.hypot(dx, dy);
      if (l < 6) { dx = 0.7; dy = -0.7; } else { dx /= l; dy /= l; }
      const lx = P.x + dx * 15, ly = P.y + dy * 15 + 5;
      const label = o.labelText ? esc(o.labelText) : nameSvg(o.name);
      const cls = o.labelText && /[㐀-鿿]/.test(o.labelText) ? 'lbl3d' : 'lbl3d math';
      parts.labels.push(`<text data-k="point" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="${cls}" text-anchor="middle" fill="${style === 'given' ? theme.ink : color}">${label}</text>`);
    }
    for (const { v, style } of c.texts) {
      const P = proj(P3(v.pos));
      parts.labels.push(`<text data-k="text" x="${P.x.toFixed(1)}" y="${P.y.toFixed(1)}" class="lbl3d" fill="${colorOf(style)}">${esc(v.text.replace(/\$/g, ''))}</text>`);
    }

    svg.innerHTML = `<defs><radialGradient id="sph" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="${theme.face}" stop-opacity="0.04"/><stop offset="1" stop-color="${theme.face}" stop-opacity="0.14"/></radialGradient></defs>`
      + `<g>${parts.fills.join('')}</g><g>${parts.hidden.join('')}</g><g>${parts.visible.join('')}</g><g>${parts.marks.join('')}</g><g>${parts.points.join('')}</g><g>${parts.labels.join('')}</g>`;
    // 标签避让：点的名字、文字重叠时错开（与二维共用 layoutLabels）
    try {
      const nodes = [...svg.querySelectorAll('text[data-k]')];
      const items = nodes.map((n) => { const b = n.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height, kind: n.dataset.k }; });
      const offs = layoutLabels(items, { w: W, h: H });
      nodes.forEach((n, i) => { const { dx, dy } = offs[i]; if (dx || dy) n.setAttribute('transform', `translate(${dx.toFixed(1)} ${dy.toFixed(1)})`); });
    } catch { /* 避让失败不影响作图 */ }
  }

  // ---------- 交互：单指/鼠标拖动旋转，双指捏合或滚轮缩放 ----------
  const pointers = new Map();
  let drag = null, pinch = null;
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const beginDrag = () => { const p = [...pointers.values()][0]; drag = p ? { x: p.x, y: p.y, yaw, pitch } : null; };
  svg.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch { /* 个别 WebView 不支持，不影响旋转 */ }
    stopSpin();
    tween = null;
    if (pointers.size === 2) { drag = null; pinch = { d: spread(), zoom }; } else if (pointers.size === 1) beginDrag();
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      zoom = Math.max(0.3, Math.min(5, pinch.zoom * (spread() / pinch.d)));
      schedule();
    } else if (drag) {
      yaw = drag.yaw - (e.clientX - drag.x) * 0.01;
      pitch = Math.max(-89.9 * DEG, Math.min(89.9 * DEG, drag.pitch + (e.clientY - drag.y) * 0.01));
      schedule();
    }
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) beginDrag(); // 松开一根手指后，从剩下那根手指的位置继续旋转，避免跳动
    if (pointers.size === 0) drag = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(0.3, Math.min(5, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    schedule();
  }, { passive: false });
  svg.addEventListener('dblclick', () => setView('default'));

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; draw(); });
  }
  function loop() {
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.t0) / 450);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      yaw = tween.y0 + (tween.y1 - tween.y0) * e;
      pitch = tween.p0 + (tween.p1 - tween.p0) * e;
      if (t >= 1) tween = null;
    } else if (spinning) {
      yaw += 0.008;
    }
    draw();
    raf = tween || spinning ? requestAnimationFrame(loop) : 0;
  }
  function setView(name) {
    const v = VIEWS[name] || VIEWS.default;
    stopSpin();
    let dy = v.yaw - yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    tween = { t0: performance.now(), y0: yaw, y1: yaw + dy, p0: pitch, p1: v.pitch };
    if (name === 'default') zoom = 1;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function stopSpin() { spinning = false; }

  draw();
  return {
    update() { scene.recompute(); schedule(); },
    setView,
    toggleSpin() {
      spinning = !spinning;
      if (spinning && !raf) raf = requestAnimationFrame(loop);
      return spinning;
    },
    resetView() { setView('default'); },
    zoom(f) { zoom = Math.max(0.3, Math.min(5, zoom * f)); schedule(); },
    svg() { return svg; },
    destroy() { cancelAnimationFrame(raf); container.innerHTML = ''; void opts; },
  };
}

// 球、圆柱、圆锥：外轮廓实线，背面的圆弧画虚线
function drawSolid(v, style, cam, proj, s, parts, polyPath, drawRuns) {
  const theme = readTheme();
  const color = style === 'hl' ? theme.accent : style === 'result' ? theme.result : style === 'aux' ? theme.aux : theme.ink;
  const d = cam.d;
  if (v.T === 'sphere') {
    const C = proj(v.c);
    parts.fills.push(`<circle cx="${C.x.toFixed(1)}" cy="${C.y.toFixed(1)}" r="${(v.r * s).toFixed(1)}" fill="url(#sph)" stroke="${color}" stroke-width="1.6"/>`);
    const eq = (t) => vadd(v.c, pt(v.r * Math.cos(t * 2 * Math.PI), v.r * Math.sin(t * 2 * Math.PI), 0));
    drawRuns(eq, 120, (i, q) => vdot(vsub(q, v.c), d) >= 0, color, 1.2);
    return;
  }
  const k = vnorm(vsub(v.b, v.a));
  if (!k) return;
  const h = vlen(vsub(v.b, v.a));
  const ref = Math.abs(k.z) < 0.9 ? pt(0, 0, 1) : pt(1, 0, 0);
  const u = vnorm(vcross(k, ref)), w = vcross(k, u);
  const e = (t) => vadd(vscale(u, Math.cos(t)), vscale(w, Math.sin(t)));
  const A = vdot(u, d), B = vdot(w, d);
  const rim = (c) => (t) => vadd(c, vscale(e(t * 2 * Math.PI), v.r));
  // 外轮廓的浅色填充（投影后的凸包）
  const outline = [];
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * 2 * Math.PI;
    outline.push(proj(vadd(v.a, vscale(e(t), v.r))));
    if (v.T === 'cylinder') outline.push(proj(vadd(v.b, vscale(e(t), v.r))));
  }
  if (v.T === 'cone') outline.push(proj(v.b));
  const hull = hull2d(outline);
  parts.fills.push(`<path d="${hull.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')}Z" fill="${theme.face}" fill-opacity="0.08"/>`);

  if (v.T === 'cylinder') {
    const t1 = Math.atan2(-A, B);
    if (Math.hypot(A, B) > 1e-6) {
      for (const t of [t1, t1 + Math.PI]) polyPath([vadd(v.a, vscale(e(t), v.r)), vadd(v.b, vscale(e(t), v.r))], color, 1.8, false, 'visible');
    }
    const front = (q, c) => vdot(vsub(q, c), d) >= -1e-9;
    const capB = vdot(k, d) > 0, capA = vdot(vscale(k, -1), d) > 0;
    drawRuns(rim(v.b), 120, (i, q) => capB || front(q, v.b), color, 1.8);
    drawRuns(rim(v.a), 120, (i, q) => capA || front(q, v.a), color, 1.8);
    return;
  }
  // 圆锥：侧面外法向 ∝ h·e(t) + r·k
  const kd = vdot(k, d);
  const Cc = (-v.r * kd) / h, M = Math.hypot(A, B);
  if (M > 1e-9 && Math.abs(Cc) <= M) {
    const phi = Math.atan2(B, A), off = Math.acos(Cc / M);
    for (const t of [phi + off, phi - off]) polyPath([v.b, vadd(v.a, vscale(e(t), v.r))], color, 1.8, false, 'visible');
  }
  const baseFacing = -kd > 0;
  drawRuns(rim(v.a), 120, (i, q) => {
    if (baseFacing) return true;
    const ee = vnorm(vsub(q, v.a));
    return vdot(vadd(vscale(ee, h), vscale(k, v.r)), d) >= 0;
  }, color, 1.8);
}

function hull2d(points) {
  const p = points.filter((q) => finite(q.x) && finite(q.y)).sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
