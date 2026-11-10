// 评测题集：每道题给出题目文本，以及可以自动检验的条件（checks）。
// checks 检验的是“画出来的图形是否符合题意”，而不只是“命令能否执行”。
//   dist      两点距离：{ type: 'dist', a, b, value }
//   equal     若干线段等长：{ type: 'equal', segs: [[a, b], ...] }
//   angle     角度（顶点在中间）：{ type: 'angle', pts: [a, vertex, c], deg }
//   perp      两条线垂直：{ type: 'perp', l1: [a, b], l2: [c, d] }
//   collinear 三点共线：{ type: 'collinear', pts: [a, b, c] }
//   midpoint  中点：{ type: 'midpoint', m, of: [a, b] }
//   fn        存在一个函数（或直线）经过这些点：{ type: 'fn', at: [[x, y], ...] }
//   through   至少 count 条曲线（函数/直线/圆/方程曲线）都经过这些点：{ type: 'through', pts: [[x, y], ...], count }
//   cells     表格里出现了这些数（小数、分数都算）：{ type: 'cells', values: [...] }
//   kind      至少 min 个某类对象：{ type: 'kind', kind: 'slider'|'function'|'implicit'|'region'|'brace'|'sphere'|'cylinder'|'polygon', min }
//   mode      2d / 3d：{ type: 'mode', value }
// image: true 的题目会生成题目图片，用来评测拍照识别（OCR）。

const S3 = Math.sqrt(3);

export const PROBLEMS = [
  {
    id: 'quad-roots', category: '函数', image: true,
    text: '已知二次函数 y = x² - 2x - 3，求它与 x 轴的交点坐标和顶点坐标。',
    checks: [{ type: 'mode', value: '2d' }, { type: 'fn', at: [[0, -3], [1, -4], [3, 0], [-1, 0]] }],
  },
  {
    id: 'quad-param', category: '函数',
    text: '已知函数 f(x) = x² - 2ax + 3，求 f(x) 在区间 [0, 2] 上的最小值 g(a)。',
    checks: [{ type: 'kind', kind: 'slider', min: 1 }, { type: 'kind', kind: 'function', min: 1 }],
  },
  {
    id: 'line-parabola', category: '函数',
    text: '求直线 y = x + 1 与抛物线 y = x² - 1 的交点坐标。',
    checks: [{ type: 'through', pts: [[2, 3], [-1, 0]], count: 2 }],
  },
  {
    id: 'trig', category: '三角函数', image: true,
    text: '画出函数 y = 2sin(2x + π/3) 的图像，并指出它的最小正周期和最大值。',
    checks: [{ type: 'fn', at: [[0, 2 * Math.sin(Math.PI / 3)], [Math.PI / 12, 2], [Math.PI / 3, 0]] }],
  },
  {
    id: 'isosceles', category: '平面几何', image: true,
    text: '如图，在△ABC 中，AB = AC = 5，BC = 6，D 为 BC 的中点，DE⊥AC 于点 E，求 DE 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'B', value: 5 }, { type: 'dist', a: 'A', b: 'C', value: 5 }, { type: 'dist', a: 'B', b: 'C', value: 6 },
      { type: 'midpoint', m: 'D', of: ['B', 'C'] }, { type: 'perp', l1: ['D', 'E'], l2: ['A', 'C'] }, { type: 'collinear', pts: ['A', 'E', 'C'] },
    ],
  },
  {
    id: 'right-median', category: '平面几何', image: true,
    text: '在 Rt△ABC 中，∠C = 90°，AC = 6，BC = 8，点 D 是斜边 AB 的中点，求 CD 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'C', value: 6 }, { type: 'dist', a: 'B', b: 'C', value: 8 },
      { type: 'angle', pts: ['A', 'C', 'B'], deg: 90 }, { type: 'midpoint', m: 'D', of: ['A', 'B'] },
    ],
  },
  {
    id: 'rectangle', category: '平面几何', image: true,
    text: '在矩形 ABCD 中，AB = 8，BC = 6，点 E 在边 BC 上，且 BE = 2，连接 AE，过点 D 作 DF⊥AE 于点 F，求 DF 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'B', value: 8 }, { type: 'dist', a: 'B', b: 'C', value: 6 }, { type: 'angle', pts: ['A', 'B', 'C'], deg: 90 },
      { type: 'dist', a: 'B', b: 'E', value: 2 }, { type: 'collinear', pts: ['B', 'E', 'C'] },
      { type: 'perp', l1: ['D', 'F'], l2: ['A', 'E'] }, { type: 'collinear', pts: ['A', 'F', 'E'] },
    ],
  },
  {
    id: 'tangent', category: '平面几何',
    text: '已知⊙O 的半径为 3，点 P 到圆心 O 的距离为 5，PA 与⊙O 相切于点 A，求切线长 PA。',
    checks: [{ type: 'dist', a: 'O', b: 'A', value: 3 }, { type: 'dist', a: 'O', b: 'P', value: 5 }, { type: 'angle', pts: ['O', 'A', 'P'], deg: 90 }],
  },
  {
    id: 'parallelogram', category: '平面几何',
    text: '在平行四边形 ABCD 中，AB = 6，AD = 4，∠A = 60°，求对角线 BD 的长。',
    checks: [
      { type: 'dist', a: 'A', b: 'B', value: 6 }, { type: 'dist', a: 'A', b: 'D', value: 4 }, { type: 'angle', pts: ['D', 'A', 'B'], deg: 60 },
      { type: 'dist', a: 'B', b: 'C', value: 4 }, { type: 'dist', a: 'C', b: 'D', value: 6 },
    ],
  },
  {
    id: 'ellipse', category: '解析几何', image: true,
    text: '已知椭圆 C：x²/4 + y²/3 = 1，直线 l：y = x + m 与椭圆 C 交于 A、B 两点。当 m = 1 时，求弦长 |AB|。',
    checks: [{ type: 'through', pts: [[2, 0], [0, S3], [-2, 0]], count: 1 }],
  },
  {
    id: 'circle-line', category: '解析几何',
    text: '已知圆 C：(x - 1)² + (y + 2)² = 4，直线 l：x - y + 1 = 0，判断直线 l 与圆 C 的位置关系。',
    checks: [{ type: 'through', pts: [[3, -2], [1, 0], [-1, -2]], count: 1 }, { type: 'through', pts: [[0, 1], [1, 2]], count: 1 }],
  },
  {
    id: 'lp', category: '不等式',
    text: '已知 x、y 满足约束条件 x + y ≤ 4，x ≥ 0，y ≥ 0，求 z = 2x + y 的最大值。',
    checks: [{ type: 'kind', kind: 'region', min: 1 }],
  },
  {
    id: 'cube', category: '立体几何', image: true,
    text: '在正方体 ABCD-A₁B₁C₁D₁ 中，E 为棱 BB₁ 的中点，求异面直线 AE 与 B₁C 所成角的余弦值。',
    checks: [
      { type: 'mode', value: '3d' }, { type: 'equal', segs: [['A', 'B'], ['B', 'C'], ['A', 'A1'], ['C', 'C1']] },
      { type: 'angle', pts: ['A', 'B', 'C'], deg: 90 }, { type: 'angle', pts: ['A1', 'A', 'B'], deg: 90 }, { type: 'midpoint', m: 'E', of: ['B', 'B1'] },
    ],
  },
  {
    id: 'pyramid-sphere', category: '立体几何',
    text: '在三棱锥 P-ABC 中，PA⊥平面 ABC，AB⊥BC，PA = AB = BC = 2，求三棱锥 P-ABC 外接球的表面积。',
    checks: [
      { type: 'mode', value: '3d' }, { type: 'dist', a: 'P', b: 'A', value: 2 }, { type: 'dist', a: 'A', b: 'B', value: 2 }, { type: 'dist', a: 'B', b: 'C', value: 2 },
      { type: 'angle', pts: ['A', 'B', 'C'], deg: 90 }, { type: 'angle', pts: ['P', 'A', 'B'], deg: 90 }, { type: 'angle', pts: ['P', 'A', 'C'], deg: 90 },
    ],
  },
  {
    id: 'cylinder', category: '立体几何',
    text: '一个圆柱的底面半径为 2，高为 5，求它的侧面积和体积。',
    checks: [{ type: 'mode', value: '3d' }, { type: 'kind', kind: 'cylinder', min: 1 }],
  },
  {
    id: 'moving-point', category: '函数',
    text: '正方形 ABCD 的边长为 4，点 P 从点 A 出发沿 A→B→C 运动，设点 P 运动的路程为 x，△APD 的面积为 y，求 y 关于 x 的函数关系式。',
    checks: [{ type: 'kind', kind: 'slider', min: 1 }, { type: 'equal', segs: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A']] }, { type: 'dist', a: 'A', b: 'B', value: 4 }],
  },
  // 2026-11-10 20:10 加入：用户发现概率题更适合列表格，新增“表格”后用这两道题检验（检验条件由 Claude 编写）
  {
    id: 'prob-cond', category: '概率统计',
    text: '盒子里有 3 个红球和 2 个白球，不放回地依次摸出 2 个球。已知第一次摸到红球，求第二次也摸到红球的概率。',
    checks: [{ type: 'kind', kind: 'row', min: 2 }, { type: 'cells', values: [0.5] }],
  },
  {
    id: 'prob-dist', category: '概率统计',
    text: '抛掷一枚质地均匀的硬币 3 次，设正面朝上的次数为 X，求 X 的分布列。',
    checks: [{ type: 'kind', kind: 'row', min: 2 }, { type: 'cells', values: [0.125, 0.375] }],
  },
  {
    id: 'meeting', category: '应用题',
    text: '甲、乙两车同时从相距 360 千米的两地相向而行，甲车每小时行 70 千米，乙车每小时行 50 千米。经过几小时两车相遇？',
    checks: [{ type: 'mode', value: '2d' }, { type: 'kind', kind: 'brace', min: 1 }],
  },
];
