// 数值几何：边界情况 + 随机“性质测试”（用固定种子，结果可复现）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../public/lib/geom.js';
import { buildScene } from '../public/lib/scene.js';
import { sampleFunction } from '../public/lib/render2d.js';

const close = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}（容差 ${tol}）`);
const R = { x0: -20, x1: 20, y0: -20, y1: 20, span: 40 };

// 可复现的伪随机数
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- 求根的边界情况 ----------------
test('二重根 (x-1)^2：不变号也能找到', () => {
  const r = G.findRoots((x) => (x - 1) ** 2, -20, 20);
  assert.equal(r.length, 1);
  close(r[0], 1, 1e-6);
});

test('间断点 1/(x-1) 的变号不是零点', () => {
  assert.deepEqual(G.findRoots((x) => 1 / (x - 1), -20, 20), []);
  const tanRoots = G.findRoots(Math.tan, -5, 5);
  assert.equal(tanRoots.length, 3); // -π, 0, π，不含 ±π/2
  tanRoots.forEach((r) => close(Math.abs(Math.sin(r)), 0, 1e-9));
});

test('挨得很近的两个根 (x-1)(x-1.001) 都能找到', () => {
  const r = G.findRoots((x) => (x - 1) * (x - 1.001), -20, 20);
  assert.equal(r.length, 2);
  close(r[0], 1, 1e-9);
  close(r[1], 1.001, 1e-9);
});

test('三重根 x^3 与正好落在采样点上的根', () => {
  const r = G.findRoots((x) => x ** 3, -20, 20);
  assert.equal(r.length, 1);
  close(r[0], 0, 1e-6);
  assert.deepEqual(G.findRoots((x) => x - 5, -20, 20).length, 1);
});

test('无交点、相切、重合', () => {
  const c = { T: 'circle', c: G.pt(0, 0), r: 2 };
  const far = G.lineThrough(G.pt(-5, 3), G.pt(5, 3));
  const tangent = G.lineThrough(G.pt(-5, 2), G.pt(5, 2));
  assert.deepEqual(G.intersections(far, c, R), []);
  const t = G.intersections(tangent, c, R);
  assert.equal(t.length, 1);
  close(t[0].x, 0);
  close(t[0].y, 2);
  // 外切的两个圆只有一个交点；同心圆没有交点
  const c2 = { T: 'circle', c: G.pt(5, 0), r: 3 };
  assert.equal(G.intersections(c, c2, R).length, 1);
  assert.deepEqual(G.intersections(c, { T: 'circle', c: G.pt(0, 0), r: 1 }, R), []);
});

test('平行线没有交点；几乎平行的直线交点在远处但数值正确', () => {
  const l1 = G.lineThrough(G.pt(0, 0), G.pt(1, 1));
  assert.deepEqual(G.intersections(l1, G.lineThrough(G.pt(0, 1), G.pt(1, 2)), R), []);
  const l2 = G.lineThrough(G.pt(0, 1), G.pt(1, 2 + 1e-6));
  const [P] = G.intersections(l1, l2, R);
  close(P.x, -1e6, 1e-3);
  close(P.y, P.x, 1e-3);
});

test('退化几何：共线三点没有外接圆，零长度线段不报错', () => {
  const s = buildScene(['A = (0, 0)', 'B = (1, 1)', 'C = (2, 2)', 'c = Circle(A, B, C)', 'O = Circumcenter(A, B, C)', 's = Segment(A, A)', 'M = Midpoint(s)', 'P = Intersect(s, Line(B, C))']);
  assert.deepEqual(s.errors, []);
  assert.equal(s.values.c, null);
  assert.equal(s.values.O, null);
  assert.equal(s.values.M.x, 0);
});

test('函数图像在间断点处断开，连续的陡峭函数不会被误断开', () => {
  const B = { x0: -2, x1: 4, y0: -5, y1: 5, w: 6, h: 10 };
  const crossesAt = (d, x0) => d.xs.some((x, i) => i > 0 && Number.isFinite(x) && Number.isFinite(d.xs[i - 1]) && d.xs[i - 1] < x0 && x > x0);
  const pole = sampleFunction({ f: (x) => 1 / (x - 1), a: -Infinity, b: Infinity }, B, 600);
  assert.ok(!crossesAt(pole, 1), '1/(x-1) 不应把 x=1 两侧连起来');
  const step = sampleFunction({ f: (x) => (x < 1 ? 0 : 3), a: -Infinity, b: Infinity }, B, 600);
  assert.ok(!crossesAt(step, 1), '分段函数的跳跃处应断开');
  const steep = sampleFunction({ f: (x) => (x - 1) ** 9, a: -Infinity, b: Infinity }, B, 600);
  assert.equal(steep.xs.filter((x) => Number.isNaN(x)).length, 0, '连续函数不应断开');
});

// ---------------- 性质测试 ----------------
test('性质：外心到三个顶点的距离相等', () => {
  const r = rng(1);
  let checked = 0;
  for (let k = 0; k < 300; k++) {
    const A = G.pt(r() * 20 - 10, r() * 20 - 10), B = G.pt(r() * 20 - 10, r() * 20 - 10), C = G.pt(r() * 20 - 10, r() * 20 - 10);
    if (G.polygonArea([A, B, C]) < 0.5) continue; // 跳过接近退化的三角形
    const O = G.circumcenter(A, B, C);
    close(G.dist(O, A), G.dist(O, B), 1e-7);
    close(G.dist(O, A), G.dist(O, C), 1e-7);
    checked++;
  }
  assert.ok(checked > 200);
});

test('性质：垂足在直线上，且与原点连线垂直于直线', () => {
  const r = rng(2);
  for (let k = 0; k < 300; k++) {
    const L = G.lineThrough(G.pt(r() * 20 - 10, r() * 20 - 10), G.pt(r() * 20 - 10, r() * 20 - 10));
    const P = G.pt(r() * 20 - 10, r() * 20 - 10);
    const F = G.footOnLine(P, L);
    const d = G.vsub(L.q, L.p);
    close(G.cross2(d, G.vsub(F, L.p)) / G.vlen(d), 0, 1e-8);
    close(G.vdot(d, G.vsub(P, F)) / G.vlen(d), 0, 1e-8);
  }
});

test('性质：旋转保持距离，两次对称回到原处', () => {
  const r = rng(3);
  for (let k = 0; k < 200; k++) {
    const pts = [`A = (${r() * 10}, ${r() * 10})`, `B = (${r() * 10}, ${r() * 10})`, `O = (${r() * 10}, ${r() * 10})`, `l = Line((${r()}, ${r()}), (${r() + 2}, ${r() - 1}))`];
    const s = buildScene([...pts, `A' = Rotate(A, ${(r() * 360).toFixed(3)}°, O)`, `B' = Rotate(B, ${(r() * 0).toFixed(3) || 0}°, O)`, "A2 = Reflect(Reflect(A, l), l)"]);
    assert.deepEqual(s.errors, []);
    const { A, O, A2 } = s.values;
    close(G.dist(O, A), G.dist(O, s.values["A'"]), 1e-9);
    close(A.x, A2.x, 1e-9);
    close(A.y, A2.y, 1e-9);
  }
});

// 点 P 到图形的“偏差”：直接代入方程计算，不受采样范围限制
function offBy(obj, P) {
  if (obj.T === 'circle') return Math.abs(G.dist(P, obj.c) - obj.r);
  if (obj.T === 'line') { const d = G.vsub(obj.q, obj.p); return Math.abs(G.cross2(d, G.vsub(P, obj.p))) / G.vlen(d); }
  if (obj.T === 'function') return Math.abs(P.y - obj.f(P.x)) / (1 + Math.abs(P.y));
  throw new Error('unknown');
}

test('性质：求出的交点同时在两个图形上', () => {
  const r = rng(4);
  let found = 0;
  for (let k = 0; k < 200; k++) {
    const c = { T: 'circle', c: G.pt(r() * 6 - 3, r() * 6 - 3), r: 0.5 + r() * 4 };
    const c2 = { T: 'circle', c: G.pt(r() * 6 - 3, r() * 6 - 3), r: 0.5 + r() * 4 };
    const L = G.lineThrough(G.pt(r() * 6 - 3, r() * 6 - 3), G.pt(r() * 6 - 3, r() * 6 - 3));
    const fx = { T: 'function', f: (x) => 0.3 * x * x - 2, a: -Infinity, b: Infinity };
    for (const [a, b] of [[L, c], [c, c2], [L, fx], [c, fx]]) {
      for (const P of G.intersections(a, b, R)) {
        found++;
        for (const obj of [a, b]) close(offBy(obj, P), 0, 1e-6);
      }
    }
  }
  assert.ok(found > 300);
});

test('性质：随机三次多项式的根全部找到（根之间至少相距 0.05）', () => {
  const r = rng(5);
  for (let k = 0; k < 200; k++) {
    const roots = [r() * 30 - 15, r() * 30 - 15, r() * 30 - 15].sort((a, b) => a - b);
    if (roots[1] - roots[0] < 0.05 || roots[2] - roots[1] < 0.05) continue;
    const f = (x) => (x - roots[0]) * (x - roots[1]) * (x - roots[2]);
    const got = G.findRoots(f, -20, 20);
    assert.equal(got.length, 3, `roots ${roots} → ${got}`);
    got.forEach((g, i) => close(g, roots[i], 1e-7));
  }
});
