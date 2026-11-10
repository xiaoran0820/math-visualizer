import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractFacts, verifyFacts, completeFigure, describeViolations, normalizeProblemText, parseNum } from '../public/lib/constraints.js';
import { runCheck } from '../public/lib/checks.js';
import { buildScene } from '../public/lib/scene.js';
import { EXAMPLES } from '../public/examples.js';

const descs = (text) => extractFacts(text).facts.map((f) => f.desc);
const has = (text, ...want) => { const d = descs(text); for (const w of want) assert.ok(d.includes(w), `应提取「${w}」，实际：${d.join(' | ')}`); };
const lacks = (text, ...bad) => { const d = descs(text); for (const b of bad) assert.ok(!d.includes(b), `不应提取「${b}」，实际：${d.join(' | ')}`); };

test('数字：根号、分数、负数', () => {
  assert.equal(parseNum('2√3').value, 2 * Math.sqrt(3));
  assert.equal(parseNum('√(5)').value, Math.sqrt(5));
  assert.equal(parseNum('3/2').value, 1.5);
  assert.equal(parseNum('-4').value, -4);
  assert.equal(parseNum('abc'), null);
});

test('LaTeX 写法和普通写法提取出相同的条件', () => {
  const a = descs('如图，在 $\\triangle ABC$ 中，$AB=AC=5$，$BC=6$，$D$ 为 $BC$ 的中点，$DE\\perp AC$ 于点 $E$。');
  const b = descs('如图，在△ABC 中，AB = AC = 5，BC = 6，D 为 BC 的中点，DE⊥AC 于点 E。');
  assert.deepEqual(a, b);
  assert.equal(normalizeProblemText('$\\angle C=90^{\\circ}$，$A_1B_1$，$\\dfrac{x^2}{4}$').replace(/\s+/g, ''), '∠C=90°，A1B1，(x^2)/(4)');
});

test('平面几何：长度、等长、中点、垂足、角、平行四边形', () => {
  has('在△ABC 中，AB = AC = 5，BC = 6，D 为 BC 的中点，DE⊥AC 于点 E', 'AB = 5', 'AC = 5', 'BC = 6', 'D 是 BC 的中点', 'DE ⊥ AC', '点 E 在直线 AC 上', '画成平面图');
  has('在 Rt△ABC 中，∠C = 90°，AC = 6，BC = 8，点 D 是斜边 AB 的中点', '∠BCA = 90°', 'D 是 AB 的中点');
  has('在平行四边形 ABCD 中，AB = 6，AD = 4，∠A = 60°', 'AB ∥ DC', 'AD ∥ BC', '∠DAB = 60°');
  has('在矩形 ABCD 中，点 E 在边 BC 上，且 BE = 2，过点 D 作 DF⊥AE 于点 F', '∠ABC = 90°', '点 E 在直线 BC 上', 'BE = 2', '点 F 在直线 AE 上');
  has('等腰三角形 ABC 中，AB = AC，M、N 分别是 AB、AC 的中点', 'AB = AC', 'M 是 AB 的中点', 'N 是 AC 的中点');
  has('正方形 ABCD 的边长为 4', 'AB = BC = CD = DA', 'AB = 4');
  has('边长为 2 的等边三角形 ABC', 'AB = BC = CA', 'AB = 2');
  has('已知 |AB| = 2√3', 'AB = 2√3');
});

test('圆：半径、切线、点到圆心的距离、直径', () => {
  has('已知⊙O 的半径为 3，点 P 到圆心 O 的距离为 5，PA 与⊙O 相切于点 A', '⊙O 的半径为 3', 'PO = 5', 'OA ⊥ PA', 'OA = 3');
  has('AB 是⊙O 的直径，点 C 在⊙O 上', 'O 是 AB 的中点', '点 C 在⊙O 上');
});

test('坐标、立体、动点', () => {
  const f = extractFacts('已知点 A(1, -2)，B(0, √3)').facts.map((x) => x.check);
  assert.deepEqual(f.filter((c) => c.type === 'at').map((c) => [c.p, c.x, Number(c.y.toFixed(4))]), [['A', 1, -2], ['B', 0, 1.7321]]);
  has('在正方体 ABCD-A₁B₁C₁D₁ 中，E 为棱 BB₁ 的中点', 'AB = BC = CD = DA = AA1 = BB1 = CC1 = DD1', '∠A1AB = 90°', 'E 是 BB1 的中点', '画成立体图');
  has('在三棱锥 P-ABC 中，PA⊥平面 ABC，AB⊥BC，PA = AB = BC = 2', 'PA ⊥ AB', 'PA ⊥ AC', 'PA ⊥ BC', 'AB ⊥ BC', 'PA = 2', '画成立体图');
  has('一个圆柱的底面半径为 2，高为 5', '圆柱：半径 2，高 5');
  has('点 P 从点 A 出发，沿 A→B→C 运动', '动点 P（用滑块控制）');
});

test('方程与不等式组', () => {
  const eq = (text) => extractFacts(text).facts.filter((f) => f.check.type === 'curve').map((f) => f.check);
  assert.deepEqual(eq('已知二次函数 y = x² - 2x - 3').map((c) => c.src), ['y = x² - 2x - 3']);
  const ell = eq('已知椭圆 C：x²/4 + y²/3 = 1，直线 l：y = x + m 与椭圆 C 交于 A、B 两点。当 m = 1 时，求弦长。');
  assert.deepEqual(ell.map((c) => c.src), ['C: x²/4 + y²/3 = 1', 'l: y = x + m']);
  assert.deepEqual(ell[1].params, { m: 1 });
  assert.deepEqual(eq('已知函数 f(x) = x² - 2ax + 3')[0].vars, ['a']);
  assert.equal(eq('已知函数 $y=2\\sin(2x+\\dfrac{\\pi}{3})$').length, 1);
  has('已知 x、y 满足约束条件 x + y ≤ 4，x ≥ 0，y ≥ 0，求 z = 2x + y 的最大值', 'x + y ≤ 4，x ≥ 0，y ≥ 0 表示的区域');
  has('若 $\\begin{cases}x-y+1\\ge 0\\\\x+y-3\\le 0\\\\y\\ge 0\\end{cases}$', 'x-y+1≥ 0，x+y-3≤ 0，y≥ 0 表示的区域');
});

test('不该提取的不提取', () => {
  lacks('在△ABC 中，AB = 5。\n【图形】点 D 在 BC 上，BD = 2', '点 D 在直线 BC 上', 'BD = 2');
  lacks('已知 AB + BC = 10，AB:BC = 2:3', 'BC = 10', 'BC = 2');
  lacks('设 AB = 2x + 1，求 AB 的长', 'AB = 2');
  assert.equal(extractFacts('解方程 x² - 2x - 3 = 0').facts.length, 0);
  assert.equal(extractFacts('求 z = 2x + y 的最大值').facts.length, 0);
  assert.equal(extractFacts('甲、乙两车同时从相距 360 千米的两地相向而行').facts.length, 0);
  lacks('∠ABC = 90°', 'BC = 90');
  lacks('求三棱锥外接球的半径', '球：半径');
});

test('内置示例：自己的作图命令满足从题目里提取的全部条件（没有提取错的条件）', () => {
  for (const ex of EXAMPLES) {
    const { facts } = extractFacts(ex.problem);
    const v = verifyFacts(buildScene(ex.analysis.commands, {}), facts);
    assert.equal(v.sat, v.total, `${ex.id}：${describeViolations(v.results).join('；')}`);
  }
});

test('核对：违反的条件给出具体原因；参数未知时不计入', () => {
  const ex = extractFacts('在△ABC 中，AB = AC = 5，BC = 6，D 为 BC 的中点，DE⊥AC 于点 E');
  const v = verifyFacts(buildScene(['A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'D = Midpoint(B, C)', 'E = (1, 2)'], {}), ex.facts);
  const bad = describeViolations(v.results);
  assert.ok(bad.some((s) => s.startsWith('DE ⊥ AC（图中夹角')), bad.join('；'));
  const q = extractFacts('已知函数 f(x) = x² - 2ax + 3');
  const v2 = verifyFacts(buildScene(['f(x) = x^2 + 3'], {}), q.facts);
  assert.equal(v2.results.find((r) => r.fact.check.type === 'curve').ok, null);
  const v3 = verifyFacts(buildScene(['a = Slider(-1, 3, 1)', 'f(x) = x^2 - 2a x + 3'], {}), q.facts);
  assert.equal(v3.sat, v3.total);
});

test('补全：平行四边形缺的顶点、题目里的方程和区域', () => {
  const pg = extractFacts('在平行四边形 ABCD 中，AB = 6，AD = 4，∠A = 60°');
  const r1 = completeFigure(['A = (0, 0)', 'B = (6, 0)', 'D = (2, 2√3)'], pg);
  assert.deepEqual(r1.commands.slice(3), ['C = B + D - A', 'Polygon(A, B, C, D)']);
  assert.equal(verifyFacts(buildScene(r1.commands, {}), pg.facts).sat, pg.facts.length);

  const el = extractFacts('已知椭圆 C：x²/4 + y²/3 = 1，直线 l：y = x + m，当 m = 1 时');
  const r2 = completeFigure(['l: y = x + 1', 'A = (0, 1)'], el);
  assert.ok(r2.commands.includes('C: x²/4 + y²/3 = 1'), r2.commands.join(' / '));

  const lp = extractFacts('已知 x、y 满足约束条件 x + y ≤ 4，x ≥ 0，y ≥ 0');
  const r3 = completeFigure(['A = (0, 0)', 'R = Region(x + y <= 3, x >= 0, y >= 0) #hl'], lp);
  assert.equal(r3.commands[1], 'R = Region(x + y ≤ 4, x ≥ 0, y ≥ 0) #hl');
});

test('补全：画错的函数直接改成题目里的式子，依赖它的点跟着改', () => {
  const ex = extractFacts('已知二次函数 y = x² - 2x - 3，求它与 x 轴的交点坐标');
  const r = completeFigure(['f(x) = x^2 - 2x + 3 #hl', 'A = Root(f, 1)'], ex);
  assert.equal(r.commands[0], 'f(x) = x² - 2x - 3 #hl');
  assert.equal(r.added[0].replaced, 'f(x) = x^2 - 2x + 3 #hl');
  const s = buildScene(r.commands, {});
  assert.ok(Math.abs(s.values.A.x + 1) < 1e-6);
});

test('补全：已经满足的不改；补了也不能变好的不补', () => {
  const ex = extractFacts('已知二次函数 y = x² - 2x - 3');
  const cmds = ['f(x) = x^2 - 2x - 3'];
  assert.deepEqual(completeFigure(cmds, ex), { commands: cmds, added: [] });
  const tri = extractFacts('在△ABC 中，AB = AC = 5，BC = 6');
  const c2 = ['A = (0, 3)', 'B = (-3, 0)', 'C = (3, 0)'];
  assert.deepEqual(completeFigure(c2, tri).commands, c2);
});

test('新的检验类型：平行、坐标、圆、立体、区域', () => {
  const s = buildScene(['A = (0, 0)', 'B = (2, 0)', 'C = (3, 1)', 'D = (1, 1)', 'O = (1, -2)', 'c = Circle(O, 3)', 'Region(x + y <= 4, x >= 0, y >= 0)'], {});
  assert.equal(runCheck(s, { type: 'parallel', l1: ['A', 'B'], l2: ['D', 'C'] }).ok, true);
  assert.equal(runCheck(s, { type: 'parallel', l1: ['A', 'D'], l2: ['B', 'D'] }).ok, false);
  assert.equal(runCheck(s, { type: 'at', p: 'C', x: 3, y: 1 }).ok, true);
  assert.equal(runCheck(s, { type: 'circle', center: 'O', r: 3 }).ok, true);
  assert.equal(runCheck(s, { type: 'circle', center: 'A', r: 3 }).ok, false);
  assert.equal(runCheck(s, { type: 'region', src: 'x + y <= 4, x >= 0, y >= 0' }).ok, true);
  assert.equal(runCheck(s, { type: 'region', src: 'x + y <= 3, x >= 0, y >= 0' }).ok, false);
  const s3 = buildScene(['A = (0, 0, 0)', 'B = (0, 0, 5)', 'Cylinder(A, B, 2)'], {});
  assert.equal(runCheck(s3, { type: 'solid', kind: 'cylinder', r: 2, h: 5 }).ok, true);
  assert.equal(runCheck(s3, { type: 'solid', kind: 'cylinder', r: 2, h: 4 }).ok, false);
});

test('表格检验：单元格里的小数、分数都按数值比较', () => {
  const s = buildScene(['Row("X", 0, 1)', 'Row("P", 1/8, 3/8)', 'Row("条件概率", 0.6*0.3/(0.6*0.3+0.4*0.2))'], {});
  assert.equal(runCheck(s, { type: 'cells', values: [0.125, 0.375] }).ok, true);
  assert.equal(runCheck(s, { type: 'cells', values: [9 / 13] }).ok, true);
  assert.equal(runCheck(s, { type: 'cells', values: [0.5] }).ok, false);
  assert.equal(runCheck(buildScene(['f(x) = x^2'], {}), { type: 'cells', values: [0.5] }).ok, false);
});

test('概率题里的“红球、白球”不当成立体图形；球体、外接球仍然是', () => {
  const mode = (text) => extractFacts(text).facts.find((f) => f.check.type === 'mode')?.check.value;
  assert.equal(mode('盒子里有 3 个红球和 2 个白球，不放回地依次摸出 2 个球。已知第一次摸到红球，求第二次也摸到红球的概率。'), undefined);
  assert.equal(mode('袋中有 5 个黑球，从中任取 2 个球'), undefined);
  assert.equal(mode('在三棱锥 P-ABC 中，PA⊥平面 ABC，求外接球的表面积'), '3d');
  assert.equal(mode('一个球的半径为 3，求球的体积'), '3d');
  assert.equal(mode('半径为 2 的球内有一个正方体'), '3d');
});

test('概率、统计题要求列出表格；几何概型和普通题不要求', () => {
  const wantsTable = (text) => extractFacts(text).facts.some((f) => f.check.type === 'kind' && f.check.kind === 'row');
  assert.equal(wantsTable('盒子里有 3 个红球和 2 个白球，不放回地依次摸出 2 个球。已知第一次摸到红球，求第二次也摸到红球的概率。'), true);
  assert.equal(wantsTable('抛掷一枚质地均匀的硬币 3 次，设正面朝上的次数为 X，求 X 的分布列。'), true);
  assert.equal(wantsTable('袋の中に赤玉と白玉が入っている。赤玉を k 回以上取り出す確率を f(k) とおく。'), true);
  assert.equal(wantsTable('在区间 [0, 2] 上随机取一个数 x，求 x² < 1 的概率。'), false);
  assert.equal(wantsTable('已知二次函数 y = x² - 2x - 3，求它与 x 轴的交点坐标。'), false);
  const f = extractFacts('抛掷一枚硬币 3 次，求正面朝上次数的分布列。').facts;
  assert.ok(!f.some((x) => x.check.type === 'mode'), '概率题不加“画成平面图”');
  const v = verifyFacts(buildScene(['A = (1, 0)', 'B = (2, 0)'], {}), f);
  assert.deepEqual(describeViolations(v.results), ['用表格列出各种情况（图中没有表格）']);
  assert.equal(verifyFacts(buildScene(['Row(X, 0, 1)', 'Row(P, 1/2, 1/2)'], {}), f).sat, 1);
});

test('日文题、带定义域的函数也能提取出来（R6-1）', () => {
  const eqs = (text) => extractFacts(text).facts.filter((f) => f.check.type === 'curve').map((f) => f.check.src);
  assert.deepEqual(eqs('関数 $f(x)=\\sqrt{x}+\\dfrac{2}{\\sqrt{x}}\\ (x>0)$ に対して、$y=f(x)$ のグラフを $C$ とする。'), ['f(x) = √(x)+(2)/(√(x))']);
  assert.deepEqual(eqs('関数 f(x) = √x + 2/√x に対して，y = f(x) のグラフを C とする。'), ['f(x) = √x + 2/√x']);
  assert.deepEqual(eqs('已知函数 f(x) = √x + 2/√x (x > 0)，求 f(x) 的极值。'), ['f(x) = √x + 2/√x']);
  // 定义域改变了图像：有限区间上的函数按区间画（review 修正；原来会画成整条抛物线）
  assert.deepEqual(eqs('已知函数 f(x) = x² - 2x（0 ≤ x ≤ 3），求最大值。'), ['f(x) = Function(x² - 2x, 0, 3)']);
  assert.deepEqual(eqs('已知函数 f(x) = x^2 - 2x, 0 ≤ x ≤ 3，求最大值。'), ['f(x) = Function(x^2 - 2x, 0, 3)']);
  // 不等式组不受影响；括号里不是条件的不去掉
  const lp = extractFacts('已知 x、y 满足约束条件 x + y ≤ 4，x ≥ 0，y ≥ 0').facts.map((f) => f.check.type);
  assert.ok(lp.includes('region'));
  assert.deepEqual(eqs('已知圆 C：(x - 1)² + (y + 2)² = 4'), ['C: (x - 1)² + (y + 2)² = 4']);
  // 参数后面跟括号（顶点式）仍然算参数
  assert.deepEqual(extractFacts('抛物线 y = a(x - 1)² + 2 经过点 (0, 3)').facts.filter((f) => f.check.type === 'curve').map((f) => f.check.vars), [['a']]);
});

test('review 修正：分段函数、限定范围的函数不提取；定义域不改变图像时照常提取', () => {
  const kinds = (s) => extractFacts(s).facts.map((f) => f.check.type + ':' + (f.check.src || f.check.value || f.check.kind || ''));
  assert.deepEqual(kinds('已知函数 f(x) = x + 1 (x ≤ 0)，f(x) = x^2 (x > 0)，画出 f(x) 的图像。'), []);
  assert.deepEqual(kinds('已知函数 $f(x)=\\begin{cases} x+1, & x\\le 0 \\\\ x^2, & x>0 \\end{cases}$，求 f(f(-1))。'), []);
  assert.deepEqual(kinds('已知函数 f(x) = x + 1, x ≤ 0；f(x) = x^2, x > 0。'), []);
  assert.deepEqual(kinds('设 g(x) = log2(x) (x ≥ 1)，求 g(x) 的值域。'), []); // 半无限区间：不提取
  // 写对了（整条或只画区间内）都算满足；写错了就换成区间上的函数
  const ex = extractFacts('已知函数 f(x) = x² - 2x（0 ≤ x ≤ 3），求最大值。');
  assert.deepEqual(completeFigure(['f(x) = x^2 - 2x'], ex).added, []);
  assert.deepEqual(completeFigure(['f(x) = Function(x^2 - 2x, 0, 3)'], ex).added, []);
  assert.deepEqual(completeFigure(['f(x) = x^2 - 2x + 1'], ex).commands, ['f(x) = Function(x² - 2x, 0, 3)']);
  assert.deepEqual(completeFigure(['f(x) = If(x <= 0, x + 1, x^2)'], extractFacts('已知函数 f(x) = x + 1 (x ≤ 0)，f(x) = x^2 (x > 0)。')).added, []);
  assert.deepEqual(kinds('已知函数 f(x) = √x + 2/√x (x > 0)，求 f(x) 的最小值。'), ['curve:f(x) = √x + 2/√x', 'mode:2d']);
  assert.deepEqual(kinds('已知函数 f(x) = x + 1/x (x ≠ 0)，求 f(x) 的单调区间。'), ['curve:f(x) = x + 1/x', 'mode:2d']);
  assert.deepEqual(kinds('已知抛物线 y = ax^2 (a > 0) 经过点 (1, 2)。'), ['curve:y = ax^2', 'mode:2d']);
  assert.deepEqual(kinds('関数 $f(x)=x^2-2x$．このとき'), ['curve:f(x) = x^2-2x', 'mode:2d']); // 全角句点
});

test('review 修正：「样本空间」不算立体图；几何概型不要求列表格', () => {
  const kinds = (s) => extractFacts(s).facts.map((f) => f.check.type + ':' + (f.check.value || f.check.kind || ''));
  assert.deepEqual(kinds('从 1、2、3、4 中任取两个数，写出样本空间，并求两数之和为 5 的概率。'), ['kind:row']);
  assert.deepEqual(kinds('在半径为 1 的圆内任取一点，求该点到圆心的距离小于 1/2 的概率。'), []);
  assert.ok(kinds('如图，在空间直角坐标系中，正方体 ABCD-A1B1C1D1 的棱长为 2。').includes('mode:3d'));
});
