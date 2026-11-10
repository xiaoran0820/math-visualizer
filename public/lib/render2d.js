// 二维渲染：用 JSXGraph 画出 scene 中的对象。所有曲线的数据都在每次更新时从 scene 的当前值重新计算，
// 因此拖动点、调节滑块时整张图会同步变化。

/* global JXG */
import * as G from './geom.js';
import { labelHtml, nameHtml } from './labels.js';
import { readTheme } from './theme.js';
import { layoutLabels } from './labelLayout.js';

const { finite } = G;

export function render2d(container, scene, opts = {}) {
  const theme = readTheme();
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'board2d';
  container.appendChild(div);

  const view = scene.computeView();
  const width = container.clientWidth || 600;
  const aspect = (view.y1 - view.y0) / (view.x1 - view.x0);
  const maxH = Math.max(300, Math.min(600, window.innerHeight * 0.68));
  const height = Math.round(Math.max(280, Math.min(maxH, view.keepAspect ? width * aspect : width * 0.72)));
  div.style.height = `${height}px`;

  const axes = scene.axesShown();
  const grid = scene.gridShown();
  const tickLabel = { fontSize: 12, strokeColor: theme.muted, cssClass: 'jxg-tick', highlightCssClass: 'jxg-tick' };
  const axisAttr = (name) => ({
    name, withLabel: true, strokeColor: theme.axis, highlightStrokeColor: theme.axis, strokeWidth: 1.2,
    lastArrow: { type: 2, size: 7 },
    label: { position: name === 'x' ? 'rt' : 'rt', offset: name === 'x' ? [-12, 14] : [10, -6], fontSize: 14, strokeColor: theme.muted, cssClass: 'jxg-axisname', highlightCssClass: 'jxg-axisname' },
    ticks: { strokeColor: theme.axis, strokeOpacity: 0.6, majorHeight: 6, minorTicks: 0, insertTicks: true, minTicksDistance: 30, label: tickLabel, drawZero: false },
  });

  const board = JXG.JSXGraph.initBoard(div, {
    boundingbox: [view.x0, view.y1, view.x1, view.y0],
    keepaspectratio: view.keepAspect,
    axis: axes,
    defaultAxes: { x: axisAttr('x'), y: axisAttr('y') },
    grid: grid ? { majorStep: 'auto', minorElements: 0, strokeColor: theme.grid, strokeOpacity: 1, strokeWidth: 1, highlight: false } : false,
    showCopyright: false, showNavigation: false, showFullscreen: false, showScreenshot: false, showInfobox: false,
    pan: { enabled: true, needShift: false, needTwoFingers: true },
    browserPan: true, // 手机上：手指按在图形空白处可以滚动页面，按在点上才是拖动
    zoom: { enabled: true, wheel: true, needShift: false, pinch: true, min: 0.05, max: 60, factorX: 1.15, factorY: 1.15 },
    resize: { enabled: false },
    renderer: 'svg',
  });

  if (axes && usesTrig(scene)) setPiTicks(board);
  // 所有标签（点的名字、曲线的名字、文字），画完后统一做避让，见 layoutLabels
  const labelEntries = [];
  if (axes) for (const ax of [board.defaultAxes?.x, board.defaultAxes?.y]) if (ax?.label) labelEntries.push({ kind: 'fixed', node: () => ax.label.rendNode });
  // 课本式的坐标系：原点标 O（图里已经有一个叫 O 的点时不标：在原点就重复了，不在原点会出现两个 O）
  const oPoint = scene.values.O;
  if (axes && !(oPoint && oPoint.T === 'point')) {
    const oText = board.create('text', [() => -5 / board.unitX, () => -5 / board.unitY, 'O'], {
      anchorX: 'right', anchorY: 'top', fixed: true, highlight: false, fontSize: 14, strokeColor: theme.muted,
      cssClass: 'jxg-axisname', highlightCssClass: 'jxg-axisname', layer: 9,
    });
    labelEntries.push({ kind: 'fixed', node: () => oText.rendNode });
  }

  const els = [];
  const dynamicLabels = [];
  const draggables = [];
  const val = (o) => scene.values[o.name];

  // ---------- 样式 ----------
  const fnColors = theme.functions;
  let fnIndex = 0;
  function styleOf(o) {
    const t = o.tags;
    let color = theme.ink, width = 2, dash = 0;
    if (o.kind === 'function' || o.kind === 'curve' || o.kind === 'implicit') { color = fnColors[fnIndex++ % fnColors.length]; width = 2.4; }
    if (t.has('aux')) { color = theme.aux; width = 1.6; dash = 2; }
    if (t.has('hl')) { color = theme.accent; width = 3; }
    if (t.has('result')) { color = theme.result; width = 3; }
    return { color, width, dash };
  }

  // ---------- 点 ----------
  function makePoint(o) {
    const draggable = (o.role === 'free' || o.role === 'glider') && !o.tags.has('fixed');
    const st = styleOf(o);
    const t = o.tags;
    const color = t.has('hl') ? theme.accent : t.has('result') ? theme.result : t.has('aux') ? theme.aux : draggable ? theme.free : theme.ink;
    const label = pointLabel(o);
    const attrs = {
      name: label.html, withLabel: !!label.html,
      size: draggable ? 4.2 : 3, face: 'o',
      strokeColor: color, fillColor: t.has('open') ? theme.bg : color,
      highlightStrokeColor: color, highlightFillColor: t.has('open') ? theme.bg : color,
      strokeWidth: t.has('open') ? 2 : draggable ? 2 : 1,
      showInfobox: false, layer: 9,
      label: { offset: [7, 9], autoPosition: false, fontSize: 16, strokeColor: theme.ink, cssClass: label.cls, highlightCssClass: label.cls, layer: 9 },
    };
    let p;
    if (draggable) {
      const v = val(o) || { x: 0, y: 0 };
      p = board.create('point', [v.x, v.y], attrs);
      p.on('drag', () => {
        scene.state[o.name] = { x: p.X(), y: p.Y() };
        scene.recompute();
        if (o.role === 'glider') {
          const nv = val(o);
          if (nv) p.setPositionDirectly(JXG.COORDS_BY_USER, [nv.x, nv.y]);
        }
        refresh();
        opts.onChange?.();
      });
      p.on('up', () => opts.onCommit?.());
      draggables.push({ o, p });
      div.classList.add('has-drag');
    } else {
      p = board.create('point', [() => val(o)?.x ?? NaN, () => val(o)?.y ?? NaN], { ...attrs, fixed: true });
    }
    if (o.labelFn) dynamicLabels.push({ o, el: p, last: label.html, point: true });
    if (attrs.withLabel || o.labelFn) labelEntries.push({ kind: 'point', node: () => p.label?.rendNode });
    void st;
    els.push(p);
  }

  function pointLabel(o) {
    if (o.tags.has('nolabel')) return { html: '', cls: 'jxg-label' };
    if (o.labelText) return labelHtml(o.labelText);
    if (o.auto || o.name.startsWith('_')) return { html: '', cls: 'jxg-label' };
    return { html: nameHtml(o.name), cls: 'jxg-label math-name' };
  }

  // ---------- 曲线类对象 ----------
  function makeCurveLike(o) {
    const st = styleOf(o);
    const filled = ['polygon', 'sector', 'region', 'integral'].includes(o.kind);
    const isFillOnly = o.kind === 'region' || o.kind === 'integral';
    const fillColor = o.tags.has('hl') ? theme.accent : o.tags.has('result') ? theme.result : o.kind === 'region' || o.kind === 'integral' ? fnColors[0] : theme.accent2;
    const fillOpacity = o.kind === 'region' || o.kind === 'integral' ? 0.2 : o.tags.has('hl') || o.tags.has('result') ? 0.16 : 0.07;
    const c = board.create('curve', [[], []], {
      strokeColor: isFillOnly ? 'none' : st.color, strokeWidth: isFillOnly ? 0 : st.width, dash: st.dash, dashScale: true,
      fillColor: filled ? fillColor : 'none', fillOpacity: filled ? fillOpacity : 0,
      highlight: false, layer: filled ? 3 : 5, lineCap: 'round',
    });
    c.updateDataArray = function updateData() {
      const d = curveData(val(o), board, scene);
      this.dataX = d.xs;
      this.dataY = d.ys;
    };
    els.push(c);

    // 向量箭头
    if (o.kind === 'line') {
      const head = board.create('curve', [[], []], { strokeColor: st.color, strokeWidth: 1, fillColor: st.color, fillOpacity: 1, highlight: false, layer: 6 });
      head.updateDataArray = function updateHead() {
        const v = val(o);
        const d = v && v.T === 'line' && v.kind === 'vector' ? arrowHead(v.p, v.q, board) : { xs: [], ys: [] };
        this.dataX = d.xs;
        this.dataY = d.ys;
      };
      els.push(head);
    }
    // 等长记号
    const eq = o.tags.has('eq1') ? 1 : o.tags.has('eq2') ? 2 : o.tags.has('eq3') ? 3 : 0;
    if (eq && o.kind === 'line') {
      const ticks = board.create('curve', [[], []], { strokeColor: st.color === theme.aux ? theme.aux : theme.ink, strokeWidth: 1.6, highlight: false, layer: 6 });
      ticks.updateDataArray = function updateTicks() {
        const v = val(o);
        const d = v && v.T === 'line' ? tickMarks(v.p, v.q, eq, board) : { xs: [], ys: [] };
        this.dataX = d.xs;
        this.dataY = d.ys;
      };
      els.push(ticks);
    }
    // 标签（函数默认显示名字，其它对象只有写了 "标签" 才显示）
    const showName = o.kind === 'function' && !o.auto && !o.tags.has('nolabel');
    if (o.labelText || showName || o.kind === 'brace') {
      const content = () => {
        const v = val(o);
        if (o.kind === 'brace') return v && v.text ? labelHtml(v.text).html : '';
        return o.labelText ? labelHtml(o.labelText).html : `<i>${nameHtml(o.name)}</i>(<i>x</i>)`;
      };
      const txt = board.create('text', [() => anchorOf(val(o), board).x, () => anchorOf(val(o), board).y, content], {
        fixed: true, anchorX: 'middle', anchorY: 'middle', fontSize: 15, strokeColor: o.kind === 'brace' ? theme.ink : st.color,
        cssClass: 'jxg-curve-label', highlightCssClass: 'jxg-curve-label', highlight: false, layer: 9, display: 'html',
        visible: true,
      });
      els.push(txt);
      labelEntries.push({ kind: 'curve', node: () => txt.rendNode });
    }
  }

  // ---------- 角 ----------
  function makeAngle(o) {
    const st = styleOf(o);
    const color = o.tags.has('hl') ? theme.accent : o.tags.has('result') ? theme.result : o.tags.has('aux') ? theme.aux : theme.ink;
    const n = o.tags.has('eq2') ? 2 : o.tags.has('eq3') ? 3 : 1;
    const c = board.create('curve', [[], []], { strokeColor: color, strokeWidth: 1.5, highlight: false, layer: 6, fillColor: 'none' });
    c.updateDataArray = function updateAngle() {
      const d = angleMark(val(o), board, n);
      this.dataX = d.xs;
      this.dataY = d.ys;
    };
    els.push(c);
    if (o.labelText) {
      const txt = board.create('text', [() => angleLabelPos(val(o), board).x, () => angleLabelPos(val(o), board).y, () => labelHtml(o.labelText).html], {
        fixed: true, anchorX: 'middle', anchorY: 'middle', fontSize: 14, strokeColor: color, highlight: false, layer: 9, cssClass: 'jxg-curve-label', highlightCssClass: 'jxg-curve-label',
      });
      els.push(txt);
    }
    void st;
  }

  // ---------- 文字 ----------
  function makeText(o) {
    const pos = () => {
      const v = val(o);
      if (v && v.pos) return v.pos;
      const bb = board.getBoundingBox();
      const w = bb[2] - bb[0], h = bb[1] - bb[3];
      return { x: bb[0] + w * 0.03, y: bb[1] - h * 0.06 };
    };
    const t = board.create('text', [() => pos().x, () => pos().y, () => { const v = val(o); return v ? labelHtml(v.text).html : ''; }], {
      fixed: true, anchorX: 'left', anchorY: 'middle', fontSize: 15, strokeColor: o.tags.has('hl') ? theme.accent : o.tags.has('result') ? theme.result : theme.ink,
      cssClass: 'jxg-text-box', highlightCssClass: 'jxg-text-box', highlight: false, layer: 9,
    });
    els.push(t);
    labelEntries.push({ kind: 'text', node: () => t.rendNode });
  }

  // 按图层顺序创建：填充 → 线 → 角 → 点 → 文字
  const order = { region: 0, integral: 0, polygon: 1, sector: 1, circle: 2, arc: 2, line: 2, function: 2, curve: 2, implicit: 2, polyline: 2, brace: 2, angle: 3, point: 4, text: 5 };
  const objs = scene.objects.filter((o) => !o.tags.has('hidden') && order[o.kind] !== undefined);
  objs.sort((a, b) => order[a.kind] - order[b.kind]);
  for (const o of objs) {
    if (o.kind === 'point') makePoint(o);
    else if (o.kind === 'angle') makeAngle(o);
    else if (o.kind === 'text') makeText(o);
    else makeCurveLike(o);
  }

  function refresh() {
    for (const d of dynamicLabels) {
      const html = d.point ? pointLabel(d.o).html : '';
      if (html !== d.last) { d.el.setLabel(html); d.last = html; }
    }
    board.update();
  }

  board.on('boundingbox', () => {
    const bb = board.getBoundingBox();
    scene.setRange({ x0: bb[0], x1: bb[2], y0: bb[3], y1: bb[1] });
  });
  // 标签避让：每次图形更新（拖动、滑块、缩放）后，量出各标签在屏幕上的位置，把重叠的标签错开。
  // 用 CSS 的 translate 属性偏移，不影响 JSXGraph 自己设置的 left / top。
  const applied = new Map();
  function layout() {
    const host = div.getBoundingClientRect();
    if (!host.width) return;
    const entries = labelEntries.map((e) => ({ kind: e.kind, node: e.node() })).filter((e) => e.node && e.node.isConnected);
    const items = entries.map(({ kind, node }) => {
      const r = node.getBoundingClientRect();
      const off = applied.get(node) || { dx: 0, dy: 0 };
      const visible = r.width > 0 && r.height > 0 && node.textContent.trim() && getComputedStyle(node).visibility !== 'hidden';
      return visible ? { x: r.left - host.left - off.dx, y: r.top - host.top - off.dy, w: r.width, h: r.height, kind } : { x: 0, y: 0, w: 0, h: 0, kind };
    });
    const offs = layoutLabels(items, { w: host.width, h: host.height });
    entries.forEach(({ node }, i) => {
      const { dx, dy } = offs[i];
      const prev = applied.get(node) || { dx: 0, dy: 0 };
      if (prev.dx === dx && prev.dy === dy) return;
      node.style.translate = dx || dy ? `${dx}px ${dy}px` : '';
      applied.set(node, { dx, dy });
    });
  }
  let layoutQueued = false;
  const scheduleLayout = () => {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; try { layout(); } catch { /* 避让失败不影响作图 */ } });
  };
  board.on('update', scheduleLayout);

  // 曲线的 updateDataArray 是在创建之后才挂上的，需要整体刷新一次
  board.fullUpdate();
  scheduleLayout();

  return {
    board,
    update() {
      scene.recompute();
      for (const { o, p } of draggables) {
        const v = val(o);
        if (v && (Math.abs(v.x - p.X()) > 1e-12 || Math.abs(v.y - p.Y()) > 1e-12)) p.setPositionDirectly(JXG.COORDS_BY_USER, [v.x, v.y]);
      }
      refresh();
    },
    resetView() {
      board.setBoundingBox([view.x0, view.y1, view.x1, view.y0], view.keepAspect);
    },
    zoom(f) {
      if (f > 1) board.zoomIn(); else board.zoomOut();
    },
    svg() { return div.querySelector('svg'); },
    destroy() {
      try { JXG.JSXGraph.freeBoard(board); } catch { /* 忽略 */ }
      container.innerHTML = '';
    },
  };
}

// ================= 几何数据计算（用户坐标） =================
function bbox(board) {
  const [x0, y1, x1, y0] = board.getBoundingBox();
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}
const px = (board) => ({ ux: board.unitX, uy: board.unitY });

function clipLine(p, q, kind, B) {
  // Liang–Barsky：把直线/射线/线段裁剪到（稍大一点的）视窗
  const padX = B.w * 0.05, padY = B.h * 0.05;
  const xmin = B.x0 - padX, xmax = B.x1 + padX, ymin = B.y0 - padY, ymax = B.y1 + padY;
  const dx = q.x - p.x, dy = q.y - p.y;
  let t0 = kind === 'line' ? -Infinity : 0, t1 = kind === 'line' || kind === 'ray' ? Infinity : 1;
  const tests = [[-dx, p.x - xmin], [dx, xmax - p.x], [-dy, p.y - ymin], [dy, ymax - p.y]];
  for (const [pp, qq] of tests) {
    if (Math.abs(pp) < 1e-15) { if (qq < 0) return null; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  if (!finite(t0) || !finite(t1)) return null;
  return [{ x: p.x + t0 * dx, y: p.y + t0 * dy }, { x: p.x + t1 * dx, y: p.y + t1 * dy }];
}

function jump(f, x0, y0, x1, y1, thr) {
  for (let k = 0; k < 16; k++) {
    const xm = (x0 + x1) / 2, ym = f(xm);
    if (!finite(ym)) return true;
    if (Math.abs(ym - y0) > Math.abs(y1 - ym)) { x1 = xm; y1 = ym; } else { x0 = xm; y0 = ym; }
    if (Math.abs(y1 - y0) < thr) return false;
  }
  return true;
}

export function sampleFunction(fv, B, nPix) {
  const xs = [], ys = [];
  const a = Math.max(fv.a, B.x0 - B.w * 0.02), b = Math.min(fv.b, B.x1 + B.w * 0.02);
  if (!(b > a)) return { xs, ys };
  const n = Math.max(240, Math.min(2400, Math.round(nPix * 1.5)));
  const lim = B.h * 20;
  const thr = B.h * 0.004;
  let px0 = null, py0 = null;
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = fv.f(x);
    if (!finite(y)) { xs.push(NaN); ys.push(NaN); px0 = null; continue; }
    if (px0 !== null && Math.abs(y - py0) > B.h * 0.02 && jump(fv.f, px0, py0, x, y, thr)) { xs.push(NaN); ys.push(NaN); }
    xs.push(x);
    ys.push(Math.max(B.y0 - lim, Math.min(B.y1 + lim, y)));
    px0 = x; py0 = y;
  }
  return { xs, ys };
}

function sampleParam(fx, fy, t0, t1, n, B) {
  const xs = [], ys = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const x = fx(t), y = fy(t);
    if (!finite(x) || !finite(y)) { xs.push(NaN); ys.push(NaN); prev = null; continue; }
    if (prev && (Math.abs(x - prev.x) > B.w * 0.5 || Math.abs(y - prev.y) > B.h * 0.5)) { xs.push(NaN); ys.push(NaN); }
    xs.push(x); ys.push(y);
    prev = { x, y };
  }
  return { xs, ys };
}

// 等值线（marching squares），并把小线段连成折线
function implicitData(F, B, board) {
  const nx = Math.max(60, Math.min(220, Math.round(board.canvasWidth / 5)));
  const ny = Math.max(40, Math.min(220, Math.round(board.canvasHeight / 5)));
  const dx = B.w / nx, dy = B.h / ny;
  const vals = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) vals[j * (nx + 1) + i] = F(B.x0 + i * dx, B.y0 + j * dy);
  const V = (i, j) => vals[j * (nx + 1) + i];
  const pts = new Map();
  const cross = (key, xa, ya, va, xb, yb, vb) => {
    if (pts.has(key)) return key;
    const t = va / (va - vb);
    const x = xa + (xb - xa) * t, y = ya + (yb - ya) * t;
    const fm = F(x, y);
    if (!finite(fm) || Math.abs(fm) > 0.25 * (Math.abs(va) + Math.abs(vb)) + 1e-12) return null; // 跨越间断点的伪交点
    pts.set(key, { x, y });
    return key;
  };
  const segs = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v0 = V(i, j), v1 = V(i + 1, j), v2 = V(i + 1, j + 1), v3 = V(i, j + 1);
      if (!finite(v0) || !finite(v1) || !finite(v2) || !finite(v3)) continue;
      const idx = (v0 > 0 ? 1 : 0) | (v1 > 0 ? 2 : 0) | (v2 > 0 ? 4 : 0) | (v3 > 0 ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const x0 = B.x0 + i * dx, y0 = B.y0 + j * dy, x1 = x0 + dx, y1 = y0 + dy;
      const eB = () => cross(`h${i},${j}`, x0, y0, v0, x1, y0, v1);
      const eR = () => cross(`v${i + 1},${j}`, x1, y0, v1, x1, y1, v2);
      const eT = () => cross(`h${i},${j + 1}`, x0, y1, v3, x1, y1, v2);
      const eL = () => cross(`v${i},${j}`, x0, y0, v0, x0, y1, v3);
      const add = (a, b) => { const ka = a(), kb = b(); if (ka && kb) segs.push([ka, kb]); };
      switch (idx) {
        case 1: case 14: add(eL, eB); break;
        case 2: case 13: add(eB, eR); break;
        case 3: case 12: add(eL, eR); break;
        case 4: case 11: add(eR, eT); break;
        case 6: case 9: add(eB, eT); break;
        case 7: case 8: add(eL, eT); break;
        case 5: case 10: {
          const center = F(x0 + dx / 2, y0 + dy / 2);
          if ((center > 0) === (idx === 5)) { add(eL, eT); add(eB, eR); } else { add(eL, eB); add(eR, eT); }
          break;
        }
      }
    }
  }
  // 连接
  const adj = new Map();
  segs.forEach(([a, b], k) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(k);
    adj.get(b).push(k);
  });
  const used = new Uint8Array(segs.length);
  const xs = [], ys = [];
  const walk = (start, k0) => {
    const chain = [start];
    let cur = start, k = k0;
    while (k !== undefined && !used[k]) {
      used[k] = 1;
      const [a, b] = segs[k];
      const nxt = a === cur ? b : a;
      chain.push(nxt);
      cur = nxt;
      k = (adj.get(cur) || []).find((kk) => !used[kk]);
    }
    return chain;
  };
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    const [a] = segs[k];
    let chain = walk(a, k);
    const other = (adj.get(a) || []).find((kk) => !used[kk]);
    if (other !== undefined) chain = walk(a, other).reverse().concat(chain.slice(1));
    for (const key of chain) { const p = pts.get(key); xs.push(p.x); ys.push(p.y); }
    xs.push(NaN); ys.push(NaN);
  }
  return { xs, ys };
}

function regionData(v, B) {
  if (v.linear) {
    let poly = [G.pt(B.x0 - B.w, B.y0 - B.h), G.pt(B.x1 + B.w, B.y0 - B.h), G.pt(B.x1 + B.w, B.y1 + B.h), G.pt(B.x0 - B.w, B.y1 + B.h)];
    for (const c of v.linear) poly = G.clipPolygon(poly, c.a, c.b, c.c, c.keepPositive);
    if (poly.length < 3) return { xs: [], ys: [] };
    return { xs: [...poly.map((p) => p.x), poly[0].x], ys: [...poly.map((p) => p.y), poly[0].y] };
  }
  // 非线性：按行合并的网格填充
  const nx = 160, ny = 110;
  const dx = B.w / nx, dy = B.h / ny;
  const xs = [], ys = [];
  for (let j = 0; j < ny; j++) {
    const y = B.y0 + (j + 0.5) * dy;
    let run = -1;
    for (let i = 0; i <= nx; i++) {
      const inside = i < nx && v.test(B.x0 + (i + 0.5) * dx, y);
      if (inside && run < 0) run = i;
      if (!inside && run >= 0) {
        const xa = B.x0 + run * dx, xb = B.x0 + i * dx, ya = y - dy / 2, yb = y + dy / 2 + dy * 0.02;
        xs.push(xa, xb, xb, xa, xa, NaN);
        ys.push(ya, ya, yb, yb, ya, NaN);
        run = -1;
      }
    }
  }
  return { xs, ys };
}

function integralData(v, B) {
  const xs = [], ys = [];
  const a = Math.min(v.a, v.b), b = Math.max(v.a, v.b);
  if (!finite(a) || !finite(b)) return { xs, ys };
  const n = 240;
  for (let i = 0; i <= n; i++) { const x = a + ((b - a) * i) / n; xs.push(x); ys.push(clampY(v.f.f(x), B)); }
  for (let i = n; i >= 0; i--) { const x = a + ((b - a) * i) / n; xs.push(x); ys.push(v.g ? clampY(v.g.f(x), B) : 0); }
  xs.push(xs[0]); ys.push(ys[0]);
  return { xs, ys };
}
const clampY = (y, B) => (finite(y) ? Math.max(B.y0 - B.h * 5, Math.min(B.y1 + B.h * 5, y)) : 0);

function arcPoints(c, r, a0, span, n) {
  const xs = [], ys = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (span * i) / n; xs.push(c.x + r * Math.cos(t)); ys.push(c.y + r * Math.sin(t)); }
  return { xs, ys };
}

// 大括号（线段图），在 P→Q 方向的左侧
function braceGeometry(P, Q, board) {
  const { ux, uy } = px(board);
  const L = Math.hypot((Q.x - P.x) * ux, (Q.y - P.y) * uy);
  if (L < 4) return null;
  const u = { x: ((Q.x - P.x) * ux) / L, y: ((Q.y - P.y) * uy) / L };
  const nrm = { x: -u.y, y: u.x };
  const gap = 6, h = 9, tip = 16;
  const a = Math.min(10, L / 4);
  const toUser = (s, w) => ({ x: P.x + (u.x * s + nrm.x * (w + gap)) / ux, y: P.y + (u.y * s + nrm.y * (w + gap)) / uy });
  const quad = (p0, c, p1, out) => { for (let i = 1; i <= 8; i++) { const t = i / 8; out.push([(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]]); } };
  const pts = [[0, 0]];
  quad([0, 0], [0, h], [a, h], pts);
  pts.push([L / 2 - a, h]);
  quad([L / 2 - a, h], [L / 2, h], [L / 2, tip], pts);
  quad([L / 2, tip], [L / 2, h], [L / 2 + a, h], pts);
  pts.push([L - a, h]);
  quad([L - a, h], [L, h], [L, 0], pts);
  const user = pts.map(([s, w]) => toUser(s, w));
  return { xs: user.map((p) => p.x), ys: user.map((p) => p.y), label: toUser(L / 2, tip + 13) };
}

function arrowHead(p, q, board) {
  const { ux, uy } = px(board);
  const dx = (q.x - p.x) * ux, dy = (q.y - p.y) * uy;
  const L = Math.hypot(dx, dy);
  if (L < 1) return { xs: [], ys: [] };
  const u = { x: dx / L, y: dy / L }, n = { x: -u.y, y: u.x };
  const len = 11, half = 4.5;
  const b = { x: q.x - (u.x * len) / ux, y: q.y - (u.y * len) / uy };
  return {
    xs: [q.x, b.x + (n.x * half) / ux, b.x - (n.x * half) / ux, q.x],
    ys: [q.y, b.y + (n.y * half) / uy, b.y - (n.y * half) / uy, q.y],
  };
}

function tickMarks(p, q, count, board) {
  const { ux, uy } = px(board);
  const dx = (q.x - p.x) * ux, dy = (q.y - p.y) * uy;
  const L = Math.hypot(dx, dy);
  if (L < 12) return { xs: [], ys: [] };
  const u = { x: dx / L, y: dy / L }, n = { x: -u.y, y: u.x };
  const m = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const xs = [], ys = [];
  for (let k = 0; k < count; k++) {
    const off = (k - (count - 1) / 2) * 4.5;
    const cx = m.x + (u.x * off) / ux, cy = m.y + (u.y * off) / uy;
    xs.push(cx + (n.x * 6) / ux, cx - (n.x * 6) / ux, NaN);
    ys.push(cy + (n.y * 6) / uy, cy - (n.y * 6) / uy, NaN);
  }
  return { xs, ys };
}

function angleMark(v, board, arcs) {
  if (!v || v.T !== 'angle') return { xs: [], ys: [] };
  const { ux, uy } = px(board);
  const { A, B, C } = v;
  const a1 = Math.atan2((A.y - B.y) * uy, (A.x - B.x) * ux), a2 = Math.atan2((C.y - B.y) * uy, (C.x - B.x) * ux);
  const xs = [], ys = [];
  if (Math.abs(v.deg - 90) < 0.5) {
    const s = 11;
    const P1 = { x: Math.cos(a1) * s, y: Math.sin(a1) * s }, P2 = { x: Math.cos(a2) * s, y: Math.sin(a2) * s };
    const pts = [P1, { x: P1.x + P2.x, y: P1.y + P2.y }, P2];
    pts.forEach((p) => { xs.push(B.x + p.x / ux); ys.push(B.y + p.y / uy); });
    return { xs, ys };
  }
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  for (let k = 0; k < arcs; k++) {
    const r = 17 + k * 4;
    for (let i = 0; i <= 24; i++) { const t = a1 + (d * i) / 24; xs.push(B.x + (Math.cos(t) * r) / ux); ys.push(B.y + (Math.sin(t) * r) / uy); }
    xs.push(NaN); ys.push(NaN);
  }
  return { xs, ys };
}

function angleLabelPos(v, board) {
  if (!v || v.T !== 'angle') return { x: NaN, y: NaN };
  const { ux, uy } = px(board);
  const { A, B, C } = v;
  const a1 = Math.atan2((A.y - B.y) * uy, (A.x - B.x) * ux), a2 = Math.atan2((C.y - B.y) * uy, (C.x - B.x) * ux);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const t = a1 + d / 2, r = 32;
  return { x: B.x + (Math.cos(t) * r) / ux, y: B.y + (Math.sin(t) * r) / uy };
}

export function curveData(v, board, scene) {
  const empty = { xs: [], ys: [] };
  if (!v || typeof v !== 'object') return empty;
  const B = bbox(board);
  switch (v.T) {
    case 'line': {
      const seg = clipLine(v.p, v.q, v.kind === 'vector' ? 'segment' : v.kind, B);
      return seg ? { xs: [seg[0].x, seg[1].x], ys: [seg[0].y, seg[1].y] } : empty;
    }
    case 'circle': return arcPoints(v.c, v.r, 0, Math.PI * 2, Math.max(120, Math.min(720, Math.round(v.r * board.unitX))));
    case 'arc': return arcPoints(v.c, v.r, v.a0, G.arcSpan(v.a0, v.a1), 160);
    case 'sector': {
      const d = arcPoints(v.c, v.r, v.a0, G.arcSpan(v.a0, v.a1), 160);
      return { xs: [v.c.x, ...d.xs, v.c.x], ys: [v.c.y, ...d.ys, v.c.y] };
    }
    case 'polygon': return { xs: [...v.pts.map((p) => p.x), v.pts[0].x], ys: [...v.pts.map((p) => p.y), v.pts[0].y] };
    case 'polyline': return { xs: v.pts.map((p) => p.x), ys: v.pts.map((p) => p.y) };
    case 'function': return sampleFunction(v, B, board.canvasWidth);
    case 'curve': return sampleParam(v.fx, v.fy, v.t0, v.t1, 800, B);
    case 'implicit': return implicitData(v.F, B, board);
    case 'region': return regionData(v, B);
    case 'integral': return integralData(v, B);
    case 'brace': { const g = braceGeometry(v.p, v.q, board); return g ? { xs: g.xs, ys: g.ys } : empty; }
    default: return empty;
  }
  // scene 参数保留给以后需要上下文的对象
}

// 标签锚点
function anchorOf(v, board) {
  const B = bbox(board);
  const none = { x: NaN, y: NaN };
  if (!v || typeof v !== 'object') return none;
  const { ux, uy } = px(board);
  const off = (P, Q, d) => {
    const L = Math.hypot((Q.x - P.x) * ux, (Q.y - P.y) * uy) || 1;
    return { x: (-(Q.y - P.y) * uy / L) * d / ux, y: (((Q.x - P.x) * ux) / L) * d / uy };
  };
  switch (v.T) {
    case 'line': {
      const seg = clipLine(v.p, v.q, v.kind === 'vector' ? 'segment' : v.kind, B);
      if (!seg) return none;
      const t = v.kind === 'segment' || v.kind === 'vector' ? 0.5 : 0.88;
      const P = { x: seg[0].x + (seg[1].x - seg[0].x) * t, y: seg[0].y + (seg[1].y - seg[0].y) * t };
      const o = off(seg[0], seg[1], 13);
      return { x: P.x + o.x, y: P.y + o.y };
    }
    case 'circle': case 'arc': case 'sector': {
      const t = v.T === 'circle' ? Math.PI / 4 : v.a0 + G.arcSpan(v.a0, v.a1) / 2;
      return { x: v.c.x + Math.cos(t) * (v.r + 14 / ux), y: v.c.y + Math.sin(t) * (v.r + 14 / uy) };
    }
    case 'function': {
      for (const frac of [0.86, 0.74, 0.62, 0.5, 0.36, 0.2]) {
        const x = Math.min(v.b, B.x0 + B.w * frac);
        const y = v.f(x);
        if (finite(y) && y > B.y0 + B.h * 0.06 && y < B.y1 - B.h * 0.06) return { x, y: y + 16 / uy };
      }
      return none;
    }
    case 'implicit': {
      const d = implicitData(v.F, B, board);
      let best = null;
      d.xs.forEach((x, i) => { const y = d.ys[i]; if (finite(x) && (!best || x + y > best.x + best.y)) best = { x, y }; });
      return best ? { x: best.x + 12 / ux, y: best.y + 12 / uy } : none;
    }
    case 'curve': {
      const t = v.t0 + (v.t1 - v.t0) * 0.15;
      return { x: v.fx(t) + 12 / ux, y: v.fy(t) + 12 / uy };
    }
    case 'brace': { const g = braceGeometry(v.p, v.q, board); return g ? g.label : none; }
    case 'polygon': {
      const n = v.pts.length;
      return { x: v.pts.reduce((s, p) => s + p.x, 0) / n, y: v.pts.reduce((s, p) => s + p.y, 0) / n };
    }
    case 'region': {
      const d = regionData(v, B);
      const pts = d.xs.map((x, i) => ({ x, y: d.ys[i] })).filter((p) => finite(p.x) && p.x >= B.x0 && p.x <= B.x1 && p.y >= B.y0 && p.y <= B.y1);
      if (!pts.length) return none;
      return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    }
    case 'integral': return { x: (v.a + v.b) / 2, y: v.f.f((v.a + v.b) / 2) / 2 };
    default: return none;
  }
}

function usesTrig(scene) {
  return scene.objects.some((o) => (o.kind === 'function' || o.kind === 'curve') && /\b(sin|cos|tan)\b/.test(o.src));
}

function piLabel(v) {
  const k = Math.round((v / Math.PI) * 2); // 以 π/2 为单位
  if (k === 0) return '0';
  const g = k % 2 === 0 ? 2 : 1;
  const num = k / g, den = 2 / g;
  const sign = num < 0 ? '−' : '';
  const an = Math.abs(num);
  const head = an === 1 ? 'π' : `${an}π`;
  return den === 1 ? `${sign}${head}` : `${sign}${head}/${den}`;
}

function setPiTicks(board) {
  const ticks = board.defaultAxes?.x?.defaultTicks;
  if (!ticks) return;
  const bb = board.getBoundingBox();
  const span = bb[2] - bb[0];
  const step = span > 30 ? Math.PI * 2 : span > 12 ? Math.PI : Math.PI / 2;
  ticks.setAttribute({ insertTicks: false, ticksDistance: step, minorTicks: 0 });
  ticks.generateLabelText = (tick, zero, value) => {
    const x = typeof value === 'number' ? value : tick.usrCoords[1] - zero.usrCoords[1];
    return piLabel(x);
  };
  board.fullUpdate();
}
