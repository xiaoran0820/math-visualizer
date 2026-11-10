// 标签避让：图形重叠时，名称不要叠在一起（用户 2026-11-10 的反馈：「如果有的图形重叠了但是他们的名称不要重叠」）。
// 输入一组已经画好的标签在屏幕上的矩形（默认位置），按优先级依次放置：
// 和已放好的标签重叠时，依次尝试锚点周围的几个位置，取第一个不重叠、且不出画面的；都不行就取重叠最少的。
// 二维（JSXGraph）和立体图（SVG）共用，纯计算，不依赖 DOM。

const PRIORITY = { fixed: 0, point: 1, curve: 2, text: 3 };

// 候选位置（相对默认位置的偏移，单位像素）
function candidates(item) {
  const { w, h } = item;
  const v = h * 1.05;
  if (item.kind === 'fixed') return [[0, 0]];
  if (item.kind === 'point') {
    // 点的名字默认在点的右上方：依次试右下、左上、左下、正上、正下，再往外一圈
    const left = -(w + 14);
    return [[0, 0], [0, v], [left, 0], [left, v], [-w / 2 - 7, -v * 0.8], [-w / 2 - 7, v * 1.6],
      [0, -v], [left, -v], [0, 2 * v], [left, 2 * v], [w * 0.6, 0], [0, -2 * v]];
  }
  // 曲线的名字、文字：先上下错开，再左右
  return [[0, 0], [0, -v], [0, v], [0, -2 * v], [0, 2 * v], [-(w * 0.6 + 6), 0], [w * 0.6 + 6, 0],
    [-(w * 0.6 + 6), -v], [w * 0.6 + 6, -v], [0, -3 * v], [0, 3 * v]];
}

function overlap(a, b, pad) {
  const x = Math.min(a.x + a.w + pad, b.x + b.w + pad) - Math.max(a.x - pad, b.x - pad);
  const y = Math.min(a.y + a.h + pad, b.y + b.h + pad) - Math.max(a.y - pad, b.y - pad);
  return x > 0 && y > 0 ? x * y : 0;
}

/**
 * @param {Array<{x: number, y: number, w: number, h: number, kind?: 'fixed'|'point'|'curve'|'text'}>} items 默认位置（左上角 + 宽高）
 * @param {{w: number, h: number}} [bounds] 画面大小（超出画面的位置尽量不用）
 * @returns {Array<{dx: number, dy: number}>} 每个标签的偏移，顺序与输入相同
 */
export function layoutLabels(items, bounds, pad = 2) {
  const order = items.map((it, i) => i).sort((a, b) => (PRIORITY[items[a].kind] ?? 3) - (PRIORITY[items[b].kind] ?? 3) || a - b);
  const placed = [];
  const out = items.map(() => ({ dx: 0, dy: 0 }));
  for (const i of order) {
    const it = items[i];
    if (!(it.w > 0 && it.h > 0)) continue;
    let best = null;
    for (const [dx, dy] of candidates(it)) {
      const r = { x: it.x + dx, y: it.y + dy, w: it.w, h: it.h };
      const outside = bounds && (dx || dy) && (r.x < 0 || r.y < 0 || r.x + r.w > bounds.w || r.y + r.h > bounds.h);
      const cost = placed.reduce((s, p) => s + overlap(r, p, pad), 0) + (outside ? 1e9 : 0);
      if (!best || cost < best.cost) best = { dx, dy, cost, r };
      if (cost === 0) break;
    }
    out[i] = { dx: best.dx, dy: best.dy };
    placed.push(best.r);
  }
  return out;
}
