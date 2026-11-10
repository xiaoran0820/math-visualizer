// 保留题集：在改进“核对题目条件”之后新写的题目，措辞和题型与 problems.js 不同，
// 用来检验改进是不是只对开发用的 17 道题有效。写好之后不再根据它的结果调整提取规则。
// 检验条件的写法见 problems.js。

export const HOLDOUT = [
  {
    id: 'h-vertex', category: '函数',
    text: '抛物线 y = -x² + 4x - 3 的顶点为 P，与 x 轴交于 A、B 两点，求△ABP 的面积。',
    checks: [{ type: 'mode', value: '2d' }, { type: 'fn', at: [[1, 0], [3, 0], [2, 1], [0, -3]] }],
  },
  {
    id: 'h-cubic', category: '函数',
    text: '已知函数 f(x) = x³ - 3x，求 f(x) 的单调区间和极值。',
    checks: [{ type: 'fn', at: [[0, 0], [1, -2], [-1, 2], [2, 2]] }],
  },
  {
    id: 'h-abs', category: '函数',
    text: '画出函数 y = |x - 1| + 1 的图像，并写出它的最小值。',
    checks: [{ type: 'fn', at: [[1, 1], [3, 3], [-1, 3]] }],
  },
  {
    id: 'h-ln', category: '函数',
    text: '已知函数 f(x) = ln x，g(x) = x - 1，证明：当 x > 0 时，f(x) ≤ g(x)。',
    checks: [{ type: 'fn', at: [[1, 0], [Math.E, 1], [Math.E ** 2, 2]] }, { type: 'fn', at: [[0, -1], [2, 1], [3, 2]] }],
  },
  {
    id: 'h-equilateral', category: '平面几何',
    text: '等边三角形 ABC 的边长为 6，AD 是 BC 边上的高，求 AD 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'B', value: 6 }, { type: 'dist', a: 'B', b: 'C', value: 6 }, { type: 'dist', a: 'C', b: 'A', value: 6 },
      { type: 'perp', l1: ['A', 'D'], l2: ['B', 'C'] }, { type: 'collinear', pts: ['B', 'D', 'C'] },
    ],
  },
  {
    id: 'h-rhombus', category: '平面几何',
    text: '在菱形 ABCD 中，∠ABC = 120°，AB = 4，求对角线 AC 的长。',
    checks: [{ type: 'equal', segs: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']] }, { type: 'dist', a: 'A', b: 'B', value: 4 }, { type: 'angle', pts: ['A', 'B', 'C'], deg: 120 }],
  },
  {
    id: 'h-trapezoid', category: '平面几何',
    text: '在梯形 ABCD 中，AD∥BC，AB = CD = 5，AD = 4，BC = 10，求梯形的高。',
    checks: [
      { type: 'parallel', l1: ['A', 'D'], l2: ['B', 'C'] }, { type: 'dist', a: 'A', b: 'B', value: 5 }, { type: 'dist', a: 'C', b: 'D', value: 5 },
      { type: 'dist', a: 'A', b: 'D', value: 4 }, { type: 'dist', a: 'B', b: 'C', value: 10 },
    ],
  },
  {
    id: 'h-chord', category: '平面几何',
    text: '⊙O 的直径 AB = 10，弦 CD⊥AB 于点 E，OE = 3，求弦 CD 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'B', value: 10 }, { type: 'midpoint', m: 'O', of: ['A', 'B'] }, { type: 'perp', l1: ['C', 'D'], l2: ['A', 'B'] },
      { type: 'collinear', pts: ['A', 'E', 'B'] }, { type: 'dist', a: 'O', b: 'E', value: 3 }, { type: 'dist', a: 'O', b: 'C', value: 5 }, { type: 'dist', a: 'O', b: 'D', value: 5 },
    ],
  },
  {
    id: 'h-bisector', category: '平面几何',
    text: '在△ABC 中，∠B = 90°，AB = 3，BC = 4，AD 平分∠BAC 交 BC 于点 D，求 BD 的长。',
    checks: [
      { type: 'angle', pts: ['A', 'B', 'C'], deg: 90 }, { type: 'dist', a: 'A', b: 'B', value: 3 }, { type: 'dist', a: 'B', b: 'C', value: 4 },
      { type: 'collinear', pts: ['B', 'D', 'C'] }, { type: 'angle', pts: ['B', 'A', 'D'], deg: (Math.atan2(4, 3) * 90) / Math.PI }, { type: 'dist', a: 'B', b: 'D', value: 1.5 },
    ],
  },
  {
    id: 'h-tangents', category: '平面几何',
    text: 'PA、PB 分别与⊙O 相切于点 A、B，⊙O 的半径为 2，∠APB = 60°，求 PA 的长。',
    checks: [
      { type: 'dist', a: 'O', b: 'A', value: 2 }, { type: 'dist', a: 'O', b: 'B', value: 2 }, { type: 'angle', pts: ['A', 'P', 'B'], deg: 60 },
      { type: 'angle', pts: ['O', 'A', 'P'], deg: 90 }, { type: 'angle', pts: ['O', 'B', 'P'], deg: 90 },
    ],
  },
  {
    id: 'h-similar', category: '平面几何',
    text: '如图，在△ABC 中，点 D、E 分别在 AB、AC 上，DE∥BC，AD = 2，DB = 3，DE = 4，求 BC 的长。',
    checks: [
      { type: 'parallel', l1: ['D', 'E'], l2: ['B', 'C'] }, { type: 'dist', a: 'A', b: 'D', value: 2 }, { type: 'dist', a: 'D', b: 'B', value: 3 },
      { type: 'dist', a: 'D', b: 'E', value: 4 }, { type: 'collinear', pts: ['A', 'D', 'B'] }, { type: 'collinear', pts: ['A', 'E', 'C'] }, { type: 'dist', a: 'B', b: 'C', value: 10 },
    ],
  },
  {
    id: 'h-hyperbola', category: '解析几何',
    text: '已知双曲线 x² - y²/3 = 1 的左、右焦点分别为 F₁、F₂，求焦点坐标和渐近线方程。',
    checks: [{ type: 'through', pts: [[1, 0], [-1, 0], [2, 3]], count: 1 }, { type: 'dist', a: 'F1', b: 'F2', value: 4 }],
  },
  {
    id: 'h-parabola', category: '解析几何',
    text: '抛物线 y² = 4x 的焦点为 F，点 P(4, 4) 在抛物线上，求 |PF|。',
    checks: [{ type: 'through', pts: [[1, 2], [1, -2], [4, 4]], count: 1 }, { type: 'at', p: 'P', x: 4, y: 4 }, { type: 'at', p: 'F', x: 1, y: 0 }],
  },
  {
    id: 'h-lp', category: '不等式',
    text: '若实数 x、y 满足 x - y + 1 ≥ 0，x + y - 3 ≤ 0，y ≥ 0，求 z = x + 2y 的最大值。',
    checks: [{ type: 'kind', kind: 'region', min: 1 }, { type: 'region', src: 'x - y + 1 >= 0, x + y - 3 <= 0, y >= 0' }],
  },
  {
    id: 'h-cuboid', category: '立体几何',
    text: '在长方体 ABCD-A₁B₁C₁D₁ 中，AB = 4，AD = 3，AA₁ = 5，求对角线 AC₁ 的长。',
    checks: [
      { type: 'mode', value: '3d' }, { type: 'dist', a: 'A', b: 'B', value: 4 }, { type: 'dist', a: 'A', b: 'D', value: 3 }, { type: 'dist', a: 'A', b: 'A1', value: 5 },
      { type: 'angle', pts: ['D', 'A', 'B'], deg: 90 }, { type: 'angle', pts: ['A1', 'A', 'B'], deg: 90 }, { type: 'angle', pts: ['A1', 'A', 'D'], deg: 90 },
      { type: 'dist', a: 'A', b: 'C1', value: Math.sqrt(50) },
    ],
  },
  {
    id: 'h-cone', category: '立体几何',
    text: '一个圆锥的底面半径为 3，高为 4，求它的母线长和侧面积。',
    checks: [{ type: 'mode', value: '3d' }, { type: 'kind', kind: 'cone', min: 1 }, { type: 'solid', kind: 'cone', r: 3, h: 4 }],
  },
  {
    id: 'h-pyramid', category: '立体几何',
    text: '正四棱锥 P-ABCD 的底面边长为 2，侧棱长为 √6，求它的高。',
    checks: [
      { type: 'mode', value: '3d' }, { type: 'equal', segs: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']] }, { type: 'dist', a: 'A', b: 'B', value: 2 },
      { type: 'angle', pts: ['D', 'A', 'B'], deg: 90 }, { type: 'equal', segs: [['P', 'A'], ['P', 'B'], ['P', 'C'], ['P', 'D']] }, { type: 'dist', a: 'P', b: 'A', value: Math.sqrt(6) },
    ],
  },
  {
    id: 'h-moving', category: '函数',
    text: '在矩形 ABCD 中，AB = 6，BC = 4，动点 P 从点 B 出发，沿 B→C→D 运动，设点 P 运动的路程为 x，△ABP 的面积为 y，求 y 与 x 的函数关系式。',
    checks: [
      { type: 'kind', kind: 'slider', min: 1 }, { type: 'moving', p: 'P' }, { type: 'dist', a: 'A', b: 'B', value: 6 },
      { type: 'dist', a: 'B', b: 'C', value: 4 }, { type: 'angle', pts: ['A', 'B', 'C'], deg: 90 },
    ],
  },
  {
    id: 'h-work', category: '应用题',
    text: '一项工程，甲队单独做 12 天完成，乙队单独做 18 天完成。两队合做，几天可以完成？',
    checks: [{ type: 'mode', value: '2d' }, { type: 'kind', kind: 'brace', min: 1 }],
  },
];
