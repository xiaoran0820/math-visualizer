import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScene, toNum } from '../public/lib/scene.js';
import { parseExpression } from '../public/lib/expr.js';
import { EXAMPLES } from '../public/examples.js';

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} ≈ ${b}`);
const ex = (id) => EXAMPLES.find((e) => e.id === id).analysis.commands;

test('所有示例都能无错误构建', () => {
  for (const e of EXAMPLES) {
    const s = buildScene(e.analysis.commands);
    assert.deepEqual(s.errors, [], `${e.id}: ${JSON.stringify(s.errors)}`);
  }
});

test('表达式：隐式乘法、Unicode、LaTeX', () => {
  const s = buildScene(['a = 2', 'f(x) = 2x^2 - 3x + 1', 'g(x) = a x² + √4', 'h(x) = \\frac{1}{2}x + sin x', 'k(x) = (x+1)(x-1)']);
  assert.deepEqual(s.errors, []);
  close(s.values.f.f(2), 3);
  close(s.values.g.f(3), 2 * 9 + 2);
  close(s.values.h.f(1), 0.5 + Math.sin(1));
  close(s.values.k.f(3), 8);
  assert.equal(parseExpression('-x^2').ast.type, 'neg');
});

test('等腰三角形：DE = 12/5', () => {
  const s = buildScene(ex('isosceles'));
  const { D, E } = s.values;
  close(Math.hypot(D.x - E.x, D.y - E.y), 2.4);
  const text = s.objects.find((o) => o.value && o.value.T === 'text');
  assert.equal(text.value.text, 'DE = 2.4');
});

test('动点 A 沿垂直平分线移动后仍保持等腰', () => {
  const state = { A: { x: 1.5, y: 6 } };
  const s = buildScene(ex('isosceles'), state);
  close(s.values.A.x, 0);
  close(s.values.A.y, 6);
});

test('椭圆与直线：m=1 时弦长 24/7', () => {
  const s = buildScene(ex('ellipse'));
  const { A, B } = s.values;
  assert.ok(A && B);
  close(Math.hypot(A.x - B.x, A.y - B.y), 24 / 7, 1e-6);
  assert.ok(A.x < B.x);
  assert.equal(s.objects.find((o) => o.name === 'l').kind, 'line');
});

test('椭圆与直线：|m| > √7 时没有交点', () => {
  const s = buildScene(ex('ellipse'), { m: 2.9 });
  assert.equal(s.values.A, null);
});

test('含参二次函数：最小值随 a 分段变化', () => {
  for (const [a, g] of [[-1, 3], [1, 2], [3, -5]]) {
    const s = buildScene(ex('quadratic'), { a });
    close(s.values.P.y, g);
  }
});

test('动点问题：面积分段', () => {
  for (const [x, y] of [[2, 4], [4, 8], [6, 8]]) {
    const s = buildScene(ex('moving-point'), { s: x });
    const tri = s.objects.filter((o) => o.value && o.value.T === 'polygon')[1];
    const pts = tri.value.pts;
    const area = Math.abs((pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[2].x - pts[0].x) * (pts[1].y - pts[0].y)) / 2;
    close(area, y);
  }
});

test('相遇问题：t=3 时相遇，文字插值正确', () => {
  const s = buildScene(ex('meeting'), { t: 3 });
  close(s.values.P.x, s.values.Q.x);
  const text = s.objects.find((o) => o.value && o.value.T === 'text');
  assert.equal(text.value.text, '经过 3 小时，两车相距 0 千米');
  const brace = s.objects.filter((o) => o.value && o.value.T === 'brace')[1];
  assert.equal(brace.value.text, '甲车行 210 千米');
});

test('立体几何：进入 3D 模式，余弦值 √10/10', () => {
  const s = buildScene(ex('cube'));
  assert.equal(s.mode, '3d');
  const ang = s.objects.find((o) => o.value && o.value.T === 'angle').value;
  close(Math.cos((ang.deg * Math.PI) / 180), Math.sqrt(10) / 10);
});

test('外接球半径 √3', () => {
  const s = buildScene(ex('sphere'));
  const sp = s.objects.find((o) => o.value && o.value.T === 'sphere').value;
  close(sp.r, Math.sqrt(3));
});

test('常用命令：交点、切线、垂线、旋转、导数', () => {
  const s = buildScene([
    'f(x) = x^2', 'g(x) = f\'(x)', 'T = Tangent(1, f)', 'P = Intersect(T, xAxis)',
    'c = Circle((0, 0), 2)', 'l: y = 1', 'Q = Intersect(c, l, (5, 0))',
    'A = (1, 0)', "A' = Rotate(A, 90°, (0, 0))", 'k = Perpendicular(A, l)', 'R = Intersect(k, l)',
    'A1(3, 4)', 'H = Foot(A1, Line((0, 0), (1, 0)))',
  ]);
  assert.deepEqual(s.errors, []);
  close(s.values.g.f(3), 6, 1e-4);
  close(s.values.P.x, 0.5, 1e-6);
  close(s.values.Q.x, Math.sqrt(3), 1e-9);
  close(s.values["A'"].x, 0, 1e-12);
  close(s.values["A'"].y, 1, 1e-12);
  close(s.values.R.x, 1);
  close(s.values.R.y, 1);
  close(s.values.H.x, 3);
  close(s.values.H.y, 0);
});

test('错误会带行号报告，其他行照常绘制', () => {
  const s = buildScene(['A = (0, 0)', 'Foo(A)', 'B = (1, 1)', 'Segment(A, C)']);
  assert.equal(s.errors.length, 2);
  assert.equal(s.errors[0].line, 1);
  assert.match(s.errors[0].message, /未知命令/);
  assert.match(s.errors[1].message, /未定义/);
  assert.ok(s.values.B);
});

test('线性规划可行域与视窗', () => {
  const s = buildScene(['Region(x + y <= 4, x >= 0, y >= 0)', 'x + y = 4']);
  assert.deepEqual(s.errors, []);
  const v = s.computeView();
  assert.ok(v.x0 < 0 && v.x1 > 4 && v.y0 < 0 && v.y1 > 4, JSON.stringify(v));
});

test('自动视窗包含函数的零点和极值', () => {
  const s = buildScene(['f(x) = x^3 - 3x']);
  const v = s.computeView();
  assert.ok(v.x0 < -Math.sqrt(3) && v.x1 > Math.sqrt(3));
  assert.ok(v.y0 < -2 && v.y1 > 2);
  assert.ok(toNum(true) === 1);
});

test('小模型常见写法：别名、Point(x, y)、Label 参数顺序', () => {
  const s = buildScene([
    'A = Point(0, 8)', 'B = (0, 0)', 'E = (2, 0)', 'D = (6, 8)',
    'l_perp = Line(D, PerpendicularPoint(D, Line(A, E)))',
    'F = Intersect(Line(A, E), l_perp)',
    'Triangle(A, B, E)', 'RightAngle(D, F, A)', 'Label(A, "顶点")',
  ]);
  assert.deepEqual(s.errors, []);
  assert.equal(s.objects.find((o) => o.name === 'A').role, 'free');
  close(Math.hypot(s.values.F.x - 6, s.values.F.y - 8), 24 / Math.sqrt(17), 1e-9);
});
