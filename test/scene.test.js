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

test('函数关键点与小模型的常见写法：x-axis、Vertex、Root、四个数的 Line', () => {
  const s = buildScene([
    'f(x) = x^2 - 2x - 3', 'A = Intersect(f, x-axis, 1)', 'B = Intersect(f, x轴, 2)', 'C = Vertex(f)',
    'R2 = Root(f, 2)', 'E = Extremum(f)', 'l = Line(-1, 0, 1, 0)', 'P = Intersect(f, l, 1)', 'Segment(0, 0, 1, 1)',
  ]);
  assert.deepEqual(s.errors, []);
  close(s.values.A.x, -1);
  close(s.values.B.x, 3);
  close(s.values.C.x, 1);
  close(s.values.C.y, -4);
  close(s.values.R2.x, 3);
  close(s.values.E.y, -4);
  close(s.values.P.x, -1);
});

test('多元函数：线性规划的目标函数 f(x, y) 可以代入点求值', () => {
  const s = buildScene([
    'Region(x + y <= 4, x >= 0, y >= 0)', 'l1: x + y = 4', 'B = Intersect(l1, xAxis)',
    'f(x, y) = 2x + y', 'z = 3x - y', 'zmax = f(B)', 'Text("z 最大值 = {f(B)}，{z(1, 2)}", (1, 5))',
  ]);
  assert.deepEqual(s.errors, []);
  close(s.values.zmax, 8);
  assert.equal(s.objects.find((o) => o.kind === 'text').value.text, 'z 最大值 = 8，1');
  assert.equal(s.objects.find((o) => o.name === 'f').tex, 'f(x, y) = 2x + y');
});

test('小模型写法：f(x) 作为函数参数、O.x 取坐标', () => {
  const s = buildScene(['f(x) = x^2 - 1', 'l: y = x + 1', 'A = Intersect(l, f(x), 2)', 'S = Integral(f(x), 1, 2)', 'O = (3, 4)', 'P = (O.x, O.y + 1)', 'g(t) = 2t', 'B = Intersect(g(t), xAxis, 1)']);
  assert.deepEqual(s.errors, []);
  close(s.values.A.x, 2);
  close(s.values.S.value, 4 / 3);
  close(s.values.P.y, 5);
  close(s.values.B.x, 0);
});

test('小模型写法：先用后定义、标签前多余的逗号、未定义的 O、Center(点)、Circle(x, y, r)', () => {
  const s = buildScene([
    'a = Slider(-1, 3, 1)', 'f(x) = x^2 - 2a x + 3', 'P = (m, f(m)) "最小值点"', 'm = If(a < 0, 0, If(a > 2, 2, a))',
    'g(x) = x + 3', 'Q = Intersect(f, g, 1), "交点"', 'c = Circle(O, 2)', 'K = Center((1, -2))', 'k = Circle(0, 1, 2)',
  ]);
  assert.deepEqual(s.errors, []);
  close(s.values.P.x, 1);
  close(s.values.P.y, 2);
  assert.equal(s.objects.find((o) => o.name === 'Q').labelText, '交点');
  close(s.values.c.r, 2);
  assert.equal(s.notes.length, 1);
  close(s.values.K.y, -2);
  close(s.values.k.c.y, 1);
});

test('重复的命令只执行一次；Brace 可以写两个数；JSON 吃掉反斜杠的 LaTeX 能还原', () => {
  const s = buildScene(['a = Slider(0, 4, 1)', 'P = (a, 1)', 'a = Slider(0, 4, 1)', 'P = (a, 1)', 'Brace(0, 360, "360 千米")',
    'D = (4cos(60^\bullet), 4sin(60^\bullet))', 'h = \frac{1}{2}', 'k = 2 \times 3', 'T = Text("\frac{1}{2}", (0, 0))']);
  assert.deepEqual(s.errors, []);
  assert.equal(s.notes.length, 1);
  const brace = s.objects.find((o) => o.value?.T === 'brace').value;
  close(brace.q.x, 360);
  close(s.values.D.x, 2);
  close(s.values.h, 0.5);
  close(s.values.k, 6);
});

test('具名的 Region、Function、Curve 不会被当成二元函数', () => {
  const s = buildScene(['R = Region(x + y <= 3, x >= 0, y >= 0)', 'g = Function(x^2, 0, 2)', 'c = Curve(cos(t), sin(t), t, 0, 2pi)'], {});
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.objects.map((o) => o.value.T), ['region', 'function', 'curve']);
});

test('小模型写法：把 y = … 画出的曲线叫作 y；上下文参数前多写的参数', () => {
  const s = buildScene(['y = x^2 - 2x - 3', 'l1: y = 0 #aux', 'P1 = Intersect(l1, y, 1)', 'P2 = Intersect(l1, y, 2)', 'V = Vertex(y, 1, 1)', 'Q = Intersect(l1, y, 1, 1)'], {});
  assert.deepEqual(s.errors, []);
  const xs = [s.values.P1.x, s.values.P2.x].sort((a, b) => a - b);
  close(xs[0], -1, 1e-6);
  close(xs[1], 3, 1e-6);
  close(s.values.V.x, 1, 1e-4);
  close(s.values.V.y, -4, 1e-6);
  close(Math.min(Math.abs(s.values.Q.x + 1), Math.abs(s.values.Q.x - 3)), 0, 1e-6);
  assert.equal(s.notes.length, 1);
  // 有两条“y = …”曲线时不猜
  const s2 = buildScene(['y = x^2', 'y = x + 2', 'P = Intersect(y, xAxis, 1)'], {});
  assert.equal(s2.errors.length, 1);
});

test('有函数图像、方程曲线时一律画坐标系，忽略模型写的 ShowAxes(false)；纯几何图仍按模型的设置', () => {
  assert.equal(buildScene(['ShowAxes(false)', 'f(x) = log((e^x + e^(-x))/2)'], {}).axesShown(), true);
  assert.equal(buildScene(['ShowAxes(false)', 'l: y = 2x + 1'], {}).axesShown(), true);
  assert.equal(buildScene(['ShowAxes(false)', 'x^2/4 + y^2/3 = 1'], {}).axesShown(), true);
  assert.equal(buildScene(['ShowAxes(false)', 'Region(x + y <= 4, x >= 0, y >= 0)'], {}).axesShown(), true);
  assert.equal(buildScene(['ShowAxes(false)', 'A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'Line(A, B)', 'c = Circle(A, 2)'], {}).axesShown(), false);
  assert.equal(buildScene(['ShowAxes(false)', 'A = (0, 0)', 'B = (6, 0)', 'Brace(A, B, "360 千米")'], {}).axesShown(), false);
  assert.equal(buildScene(['A = (0, 0)', 'B = (6, 0)', 'Segment(A, B)'], {}).axesShown(), true);
  assert.equal(buildScene(['ShowAxes(false)', 'f(x) = x^2 #hidden', 'A = (0, 0)', 'B = (1, 1)', 'Segment(A, B)'], {}).axesShown(), false);
});

test('表格：Table 开始一个表格，Row 每行一条；数值由程序计算，能化成分数的显示分数，随滑块变化', () => {
  const s = buildScene(['Table("性别与是否近视")', 'Row("", "近视", "不近视")', 'Row("男生", 0.6*0.3, 0.6*0.7)',
    'Row("P(男生|近视)", 0.6*0.3/(0.6*0.3+0.4*0.2))', 'p = Slider(0, 1, 0.5)', 'Row("P(X=1)", 3p(1-p)^2, "{p^2}")'], {});
  assert.deepEqual(s.errors, []);
  const rows = s.objects.filter((o) => o.kind === 'row').map((o) => o.value.cells);
  assert.deepEqual(rows, [['', '近视', '不近视'], ['男生', '0.18', '0.42'], ['P(男生|近视)', '9/13'], ['P(X=1)', '0.375', '0.25']]);
  assert.equal(s.objects[0].value.title, '性别与是否近视');
  s.state.p = 0.2;
  s.recompute();
  assert.deepEqual(s.objects.find((o) => o.src.startsWith('Row("P(X=1)"')).value.cells, ['P(X=1)', '0.384', '0.04']);
  assert.equal(s.mode, '2d');
});

test('表格单元格可以不加引号：文字原样显示，算式由程序计算，写了除号的显示分数', () => {
  const s = buildScene(['Table(性别与是否近视的概率)', 'Row(性别, 近视, 不近视, 合计)', 'Row(男生, 0.6*0.3, 0.6*0.7, 0.6)',
    'Row(P(男生|近视), 0.6*0.3/(0.6*0.3+0.4*0.2))', 'Row(X, 0, 1, 2, 3)', 'Row(P, 1/8, 3/8, 3/8, 1/8)', 'p = Slider(0, 1, 0.3)',
    'Row(p 的值, p, 1-p)', 'Row(，近视，不近视)'], {});
  assert.deepEqual(s.errors, []);
  assert.equal(s.objects[0].value.title, '性别与是否近视的概率');
  const rows = s.objects.filter((o) => o.kind === 'row').map((o) => o.value.cells);
  assert.deepEqual(rows, [
    ['性别', '近视', '不近视', '合计'], ['男生', '0.18', '0.42', '0.6'], ['P(男生|近视)', '9/13'],
    ['X', '0', '1', '2', '3'], ['P', '1/8', '3/8', '3/8', '1/8'], ['p 的值', '0.3', '0.7'], ['', '近视', '不近视'],
  ]);
  s.state.p = 0.5;
  s.recompute();
  assert.deepEqual(s.objects.find((o) => o.src.startsWith('Row(p 的值')).value.cells, ['p 的值', '0.5', '0.5']);
});

test("导函数 f'(x) 写错时改由程序求导；写对时保留模型的式子（R7-1）", () => {
  const s = buildScene(['f(x) = log((e^x + e^(-x))/2)', "f'(x) = (e^x + e^(-x))/2", "f''(x) = (e^x - e^(-x))/2"], {});
  assert.deepEqual(s.errors, []);
  close(s.values["f'"].f(1), Math.tanh(1), 1e-6);
  close(s.values["f''"].f(1), 1 / Math.cosh(1) ** 2, 1e-4);
  assert.equal(s.notes.length, 2);
  assert.match(s.objects[1].tex, /Derivative/);
  const ok = buildScene(['f(x) = x^3 - 3x', "f'(x) = 3x^2 - 3"], {});
  assert.deepEqual(ok.notes, []);
  close(ok.values["f'"].f(2), 9);
  assert.doesNotMatch(ok.objects[1].tex, /Derivative/);
});

test('省略乘号时乘方只作用在最后一个因子上：ax^2 是 a·x²，xe^x 是 x·eˣ（2026-11-11 修正）', () => {
  const f = (cmds, x) => { const s = buildScene(cmds, {}); assert.deepEqual(s.errors, [], cmds.join('；')); return s.values.f.f(x); };
  close(f(['a = 2', 'f(x) = ax^2'], 3), 18); // 原来算成 (ax)² = 36
  close(f(['a = 2', 'b = 1', 'c = 1', 'f(x) = ax^2 + bx + c'], 3), 22);
  close(f(['a = 2', 'f(x) = x^2 - 2ax + 3'], 3), 0);
  close(f(['f(x) = xe^x'], 2), 2 * Math.E ** 2); // 原来算成 (xe)^x
  close(f(['f(x) = 2xe^(-x)'], 2), 4 / Math.E ** 2);
  close(f(['a = 2', 'f(x) = axe^x'], 1), 2 * Math.E);
  close(f(['a = 2', 'f(x) = xa^2'], 3), 12);
  // 函数名夹在中间：原来报“未定义的名称”
  close(f(['f(x) = xlnx'], 2), 2 * Math.log(2));
  close(f(['f(x) = xln(x)'], 2), 2 * Math.log(2));
  close(f(['f(x) = xsinx'], 2), 2 * Math.sin(2));
  close(f(['f(x) = e^xsinx'], 2), Math.E ** 2 * Math.sin(2));
  close(f(['f(x) = sinxcosx'], 2), Math.sin(2) * Math.cos(2));
  // 不受影响的写法
  close(f(['a = 2', 'f(x) = ax(x+1)'], 3), 24);
  close(f(['a = 2', 'f(x) = a(x-1)^2 + 3'], 3), 11);
  close(f(['f(x) = exp(x)'], 1), Math.E);
  close(f(['g(t) = te^t', 'f(x) = g(x)'], 2), 2 * Math.E ** 2);
  // 公式显示也跟着对了
  assert.match(buildScene(['a = 2', 'f(x) = ax^2'], {}).objects[1].tex, /a \\cdot \{x\}\^\{2\}/);
  // 参数没定义时仍然报整个名字（题目条件提取靠这个报错找出参数）
  assert.match(buildScene(['f(x) = ax^2'], {}).errors[0].message, /未定义的名称「ax」/);
});
