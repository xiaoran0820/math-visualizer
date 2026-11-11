// 新题型集：训练数据（train/gen/）里没有的题型，用来看微调后的模型遇到没学过的题型会不会变差。
// 2026-11-11 由 Claude 编写：先看了训练数据有哪些题型，再挑不在其中的；写的时候没有让任何模型做过这些题。
// 只用来衡量，不根据这里的结果调整训练数据或规则（那样它就变成开发集了）。
// 检验条件的写法见 eval/problems.js。
const S3 = Math.sqrt(3);

export const FRESH = [
  {
    id: 'n-two-circles', category: '解析几何',
    text: '已知圆 C₁：x² + y² = 4 和圆 C₂：(x - 3)² + y² = 1，判断这两个圆的位置关系。',
    checks: [{ type: 'through', pts: [[0, 2], [-2, 0]], count: 1 }, { type: 'through', pts: [[3, 1], [4, 0]], count: 1 }],
  },
  {
    id: 'n-reciprocal-area', category: '函数',
    text: '点 A 在反比例函数 y = 6/x（x > 0）的图像上，过点 A 作 AB⊥x 轴于点 B，O 为坐标原点，求 △AOB 的面积。',
    checks: [{ type: 'fn', at: [[1, 6], [2, 3], [3, 2]] }, { type: 'perp', l1: ['A', 'B'], l2: ['O', 'B'] }],
  },
  {
    id: 'n-sine-rule', category: '三角函数',
    text: '在 △ABC 中，∠A = 45°，∠B = 60°，BC = 6，求 AC 的长。',
    checks: [{ type: 'angle', pts: ['B', 'A', 'C'], deg: 45 }, { type: 'angle', pts: ['A', 'B', 'C'], deg: 60 }, { type: 'dist', a: 'B', b: 'C', value: 6 }],
  },
  {
    id: 'n-midline', category: '平面几何',
    text: '在 △ABC 中，D、E 分别是 AB、AC 的中点，BC = 10，求 DE 的长。',
    checks: [{ type: 'midpoint', m: 'D', of: ['A', 'B'] }, { type: 'midpoint', m: 'E', of: ['A', 'C'] }, { type: 'dist', a: 'B', b: 'C', value: 10 }],
  },
  {
    id: 'n-hexagon', category: '平面几何',
    text: '正六边形 ABCDEF 的边长为 2，求对角线 AD 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'B', value: 2 }, { type: 'dist', a: 'B', b: 'C', value: 2 }, { type: 'dist', a: 'C', b: 'D', value: 2 },
      { type: 'dist', a: 'D', b: 'E', value: 2 }, { type: 'dist', a: 'E', b: 'F', value: 2 }, { type: 'dist', a: 'F', b: 'A', value: 2 }, { type: 'dist', a: 'A', b: 'D', value: 4 },
    ],
  },
  {
    id: 'n-two-lines', category: '函数',
    text: '直线 y = x + 2 与直线 y = -2x + 8 交于点 P，它们与 x 轴分别交于点 A、B，求 △PAB 的面积。',
    checks: [{ type: 'fn', at: [[0, 2], [1, 3]] }, { type: 'fn', at: [[0, 8], [1, 6]] }],
  },
  {
    id: 'n-point-circle', category: '解析几何',
    text: '已知点 P(5, 0) 和圆 x² + y² = 9，求圆上的点到点 P 的距离的最小值。',
    checks: [{ type: 'through', pts: [[3, 0], [0, 3]], count: 1 }],
  },
  {
    id: 'n-tetrahedron', category: '立体几何',
    text: '正四面体 ABCD 的棱长为 2，求它的高。',
    checks: [
      { type: 'mode', value: '3d' }, { type: 'dist', a: 'A', b: 'B', value: 2 },
      { type: 'equal', segs: [['A', 'B'], ['A', 'C'], ['A', 'D'], ['B', 'C'], ['B', 'D'], ['C', 'D']] },
    ],
  },
  {
    id: 'n-tri-prism', category: '立体几何',
    text: '正三棱柱 ABC-A₁B₁C₁ 的底面边长为 2，侧棱长为 3，求 A₁B 的长。',
    checks: [
      { type: 'mode', value: '3d' }, { type: 'dist', a: 'A', b: 'B', value: 2 }, { type: 'dist', a: 'B', b: 'C', value: 2 }, { type: 'dist', a: 'A', b: 'C', value: 2 },
      { type: 'dist', a: 'A', b: 'A1', value: 3 }, { type: 'angle', pts: ['A1', 'A', 'B'], deg: 90 },
    ],
  },
  {
    id: 'n-statistics', category: '概率统计',
    text: '某小组 5 名同学的数学成绩分别为 82、90、76、88、94，求这组数据的平均数和方差。',
    checks: [{ type: 'kind', kind: 'row', min: 2 }, { type: 'cells', values: [86, 40] }],
  },
  {
    id: 'n-log-shift', category: '函数',
    text: '画出函数 f(x) = log₂(x - 1) 的图像，并求它与直线 y = 2 的交点坐标。',
    checks: [{ type: 'fn', at: [[2, 0], [3, 1], [5, 2]] }],
  },
  {
    id: 'n-circle-general', category: '解析几何',
    text: '求圆 x² + y² - 4x + 2y - 4 = 0 的圆心坐标和半径。',
    checks: [{ type: 'through', pts: [[2, 2], [5, -1], [-1, -1]], count: 1 }],
  },
  {
    id: 'n-trisection', category: '向量',
    text: '已知点 A(1, 2)、B(4, 6)，点 C 在线段 AB 上，且 AC = 1/3·AB，求点 C 的坐标。',
    checks: [{ type: 'collinear', pts: ['A', 'C', 'B'] }, { type: 'dist', a: 'A', b: 'B', value: 5 }, { type: 'dist', a: 'A', b: 'C', value: 5 / 3 }],
  },
  {
    id: 'n-sqrt-area', category: '函数',
    text: '求曲线 y = √x 与直线 y = x 所围成的图形的面积。',
    checks: [{ type: 'fn', at: [[1, 1], [4, 2]] }, { type: 'fn', at: [[2, 2], [3, 3]] }, { type: 'kind', kind: 'integral', min: 1 }],
  },
  {
    id: 'n-ellipse-foci', category: '解析几何',
    text: '已知椭圆的两个焦点为 F₁(-3, 0)、F₂(3, 0)，椭圆上任意一点到两个焦点的距离之和为 10，求椭圆的方程并画出图形。',
    checks: [{ type: 'through', pts: [[5, 0], [0, 4], [3, 3.2]], count: 1 }],
  },
  {
    id: 'n-30-60-90', category: '平面几何',
    text: '在 Rt△ABC 中，∠C = 90°，∠A = 30°，AB = 8，求 BC 和 AC 的长。',
    checks: [{ type: 'angle', pts: ['A', 'C', 'B'], deg: 90 }, { type: 'angle', pts: ['B', 'A', 'C'], deg: 30 }, { type: 'dist', a: 'A', b: 'B', value: 8 }, { type: 'dist', a: 'A', b: 'C', value: 4 * S3 }],
  },
];
