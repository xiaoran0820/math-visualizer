import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutLabels } from '../public/lib/labelLayout.js';

const rects = (items, offs) => items.map((it, i) => ({ x: it.x + offs[i].dx, y: it.y + offs[i].dy, w: it.w, h: it.h }));
const anyOverlap = (rs) => rs.some((a, i) => rs.some((b, j) => j > i && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));

test('不重叠的标签保持原位', () => {
  const items = [{ x: 10, y: 10, w: 20, h: 16, kind: 'point' }, { x: 100, y: 10, w: 20, h: 16, kind: 'point' }];
  assert.deepEqual(layoutLabels(items, { w: 400, h: 300 }), [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
});

test('两个点重合时，两个名字都看得见、不重叠（R6-2 的 A 和 D）', () => {
  const items = [{ x: 200, y: 100, w: 12, h: 18, kind: 'point' }, { x: 200, y: 100, w: 12, h: 18, kind: 'point' }];
  const offs = layoutLabels(items, { w: 400, h: 300 });
  assert.deepEqual(offs[0], { dx: 0, dy: 0 });
  assert.equal(anyOverlap(rects(items, offs)), false);
});

test('很多曲线的名字挤在同一处（R6-4、R7-1）时依次错开', () => {
  const items = Array.from({ length: 6 }, () => ({ x: 300, y: 120, w: 40, h: 18, kind: 'curve' }));
  const offs = layoutLabels(items, { w: 400, h: 300 });
  assert.equal(anyOverlap(rects(items, offs)), false);
});

test('点的名字优先，坐标轴的名字不动；文字绕开它们', () => {
  const items = [
    { x: 150, y: 150, w: 90, h: 18, kind: 'text' },
    { x: 150, y: 150, w: 12, h: 18, kind: 'point' },
    { x: 150, y: 150, w: 10, h: 16, kind: 'fixed' },
  ];
  const offs = layoutLabels(items, { w: 400, h: 300 });
  assert.deepEqual(offs[2], { dx: 0, dy: 0 });
  assert.equal(anyOverlap(rects(items, offs)), false);
});

test('尽量不把标签挪出画面', () => {
  const items = [{ x: 0, y: 0, w: 30, h: 18, kind: 'curve' }, { x: 0, y: 0, w: 30, h: 18, kind: 'curve' }];
  const offs = layoutLabels(items, { w: 200, h: 200 });
  const r = rects(items, offs)[1];
  assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 200 && r.y + r.h <= 200, JSON.stringify(r));
  assert.equal(anyOverlap(rects(items, offs)), false);
});

test('宽高为 0（空标签、隐藏的标签）不参与', () => {
  const items = [{ x: 10, y: 10, w: 0, h: 0, kind: 'point' }, { x: 10, y: 10, w: 20, h: 16, kind: 'point' }];
  assert.deepEqual(layoutLabels(items, { w: 400, h: 300 })[1], { dx: 0, dy: 0 });
});
