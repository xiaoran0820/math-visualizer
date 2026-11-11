// 过去问集：日本旧帝大（东大、京大、阪大、名大、东北大、九大、北大）近年一般选拔（前期）理系数学的原题，共 73 道。
// 2026-11-11 由 Claude 整理：PDF 从各大学官网下载（来源、下载日期、SHA-256 见 eval/exam/README.md），
// 每道题裁成一张图片（eval/exam/images/，由 eval/exam/make-images.mjs 生成）。
//
// - 题目原文有版权，这里不抄原文：评测时由模型从图片识别题目文字（和手机上“拍照识别”一样），再按识别结果作图。
// - 只用来衡量，不根据它的结果调整规则或训练数据（和保留集一样）。
// - 检验的是“题目给出的条件画对了没有”：给出的点、曲线、长度、角度、立体；
//   题目要求求出或图示的东西（轨迹、区域、最值）是答案，不检验。
// - 不需要图的题（整数、组合、概率等）：列出了表格，或者没有画无关的图形，就算通过（检验写成 any + plain）。
// - topic 是 Claude 写的题目概要（不是原文）。
// - src：[PDF 文件名, 页码, 上边 y, 下边 y]，坐标是按 100 DPI 渲染后的像素行；'auto' 表示整页去掉空白和页码。
//   一道题跨页时有多段，竖着拼成一张图。
//
// 检验条件的写法见 public/lib/checks.js。
const T = (n) => Number(n.toFixed(5));
const S3 = Math.sqrt(3);

const table = { type: 'kind', kind: 'row', min: 2 };
const plain = { type: 'plain' };
const noFigure = (...extra) => [{ type: 'any', of: [...extra, table, plain] }];
const unitCircle = { type: 'through', pts: [[1, 0], [0, 1], [-1, 0]], count: 1 };

const TODAI = [
  { id: 'todai-2024-1', year: 2024, no: 1, category: '立体几何', topic: '空间中定点与平面上动点的角度条件，图示区域', src: [['todai-2024.pdf', 4, 102, 367]],
    checks: [{ type: 'at', p: 'A', x: 0, y: -1, z: 1 }] },
  { id: 'todai-2024-2', year: 2024, no: 2, category: '微积分', topic: '含绝对值的定积分所定义的函数的最值', src: [['todai-2024.pdf', 6, 102, 388]],
    checks: [{ type: 'fn', at: [[0, 0.34657], [0.5, 0.19438], [1, 0.43882]] }] },
  { id: 'todai-2024-3', year: 2024, no: 3, category: '概率统计', topic: '点按坐标轴和直线 y=±x 随机对称移动', src: [['todai-2024.pdf', 8, 103, 620]],
    checks: [{ type: 'point', at: [2, 1] }, { type: 'point', at: [-2, -1] }, { type: 'through', pts: [[1, 1], [2, 2]] }, { type: 'through', pts: [[1, -1], [2, -2]] }] },
  { id: 'todai-2024-4', year: 2024, no: 4, category: '函数', topic: '抛物线与圆心在 x 轴上、有公共切线的圆', src: [['todai-2024.pdf', 10, 102, 382]],
    checks: [{ type: 'fn', at: [[0, 5.65685], [2, 4.24264], [4, 0]] }, { type: 'kind', kind: 'circle', min: 1 }] },
  { id: 'todai-2024-5', year: 2024, no: 5, category: '立体几何', topic: '空间三角形绕 x 轴旋转所得立体的体积', src: [['todai-2024.pdf', 12, 102, 251]],
    checks: [{ type: 'at', p: 'A', x: 1, y: 0, z: 0 }, { type: 'at', p: 'B', x: 0, y: 1, z: 0 }, { type: 'at', p: 'C', x: 0, y: 0, z: 1 }, { type: 'midpoint', m: 'D', of: ['A', 'C'] }] },
  { id: 'todai-2024-6', year: 2024, no: 6, category: '整数', topic: '三次式的值为素数的整数', src: [['todai-2024.pdf', 14, 100, 328]],
    checks: noFigure({ type: 'fn', at: [[1, 31], [-3, 3], [-7, 7]] }, { type: 'cells', values: [31] }) },

  { id: 'todai-2025-1', year: 2025, no: 1, category: '解析几何', topic: '正方形四个顶点反复内分得到的点的轨迹', src: [['todai-2025.pdf', 4, 'auto']],
    checks: [{ type: 'at', p: 'A', x: 0, y: 0 }, { type: 'at', p: 'B', x: 0, y: 1 }, { type: 'at', p: 'C', x: 1, y: 1 }, { type: 'at', p: 'D', x: 1, y: 0 },
      { type: 'any', of: [{ type: 'kind', kind: 'slider', min: 1 }, { type: 'through', pts: [[0.5, 0.75], [0.15625, 0.5625]] }] }] },
  { id: 'todai-2025-2', year: 2025, no: 2, category: '微积分', topic: 'log x ≤ x−1 与定积分的极限', src: [['todai-2025.pdf', 6, 'auto']],
    checks: [{ type: 'fn', at: [[1, 0], [2.71828, 1], [0.5, -0.69315]] }, { type: 'fn', at: [[0, -1], [2, 1]] }] },
  { id: 'todai-2025-3', year: 2025, no: 3, category: '平面几何', topic: '平行四边形四个顶点在长方形四条边上', src: [['todai-2025.pdf', 8, 'auto']],
    checks: [
      { type: 'angle', pts: ['A', 'B', 'C'], deg: 30 }, { type: 'parallel', l1: ['A', 'B'], l2: ['D', 'C'] }, { type: 'parallel', l1: ['A', 'D'], l2: ['B', 'C'] },
      { type: 'perp', l1: ['E', 'F'], l2: ['F', 'G'] }, { type: 'perp', l1: ['F', 'G'], l2: ['G', 'H'] }, { type: 'perp', l1: ['G', 'H'], l2: ['H', 'E'] },
      { type: 'collinear', pts: ['E', 'A', 'F'] }, { type: 'collinear', pts: ['F', 'B', 'G'] }, { type: 'collinear', pts: ['G', 'C', 'H'] }, { type: 'collinear', pts: ['H', 'D', 'E'] },
    ] },
  { id: 'todai-2025-4', year: 2025, no: 4, category: '整数', topic: 'x²+x−a 的值为平方数的个数', src: [['todai-2025.pdf', 10, 'auto']],
    checks: noFigure({ type: 'curve', src: 'y = x^2 + x - a', vars: ['a'] }) },
  { id: 'todai-2025-5', year: 2025, no: 5, category: '概率统计', topic: '交换相邻卡片后排好顺序的初始排列数', src: [['todai-2025.pdf', 12, 'auto']],
    checks: noFigure() },
  { id: 'todai-2025-6', year: 2025, no: 6, category: '复数', topic: '复平面上的圆与 1/z、1/α²+1/β² 的范围', src: [['todai-2025.pdf', 14, 'auto']],
    checks: [{ type: 'through', pts: [[1, 0], [0.5, 0.5], [0.5, -0.5]], count: 1 }] },

  { id: 'todai-2026-1', year: 2026, no: 1, category: '微积分', topic: 'sinθ−θ+θ³/6 的最值与积分不等式', src: [['todai-2026.pdf', 4, 'auto']],
    checks: [{ type: 'fn', at: [[2, 0.24263], [3, 1.64112], [-3, -1.64112]] }] },
  { id: 'todai-2026-2', year: 2026, no: 2, category: '概率统计', topic: '3×n 个格点中任取三点构成三角形的概率', src: [['todai-2026.pdf', 6, 'auto']],
    checks: [{ type: 'point', at: [1, 1] }, { type: 'point', at: [3, 1] }, { type: 'point', at: [2, 3] }, { type: 'point', at: [3, 5] }] },
  { id: 'todai-2026-3', year: 2026, no: 3, category: '立体几何', topic: '球面上三点、重心固定时线段的轨迹', src: [['todai-2026.pdf', 8, 'auto']],
    checks: [{ type: 'solid', kind: 'sphere', r: 5 }, { type: 'at', p: 'G', x: 2, y: 0, z: 1 }] },
  { id: 'todai-2026-4', year: 2026, no: 4, category: '函数', topic: '三次曲线上三条切线两两成 60°', src: [['todai-2026.pdf', 10, 'auto']],
    checks: [{ type: 'curve', src: 'y = x^3 - k x', vars: ['k'] }, { type: 'kind', kind: 'line', min: 3 }] },
  { id: 'todai-2026-5', year: 2026, no: 5, category: '复数', topic: '单位圆上的点 z 与 (z−α)³ 的轨迹', src: [['todai-2026.pdf', 12, 'auto']],
    checks: [unitCircle, { type: 'point', at: [-3, 0] }] },
  { id: 'todai-2026-6', year: 2026, no: 6, category: '整数', topic: '被 3 除余 1、余 2 的约数的个数', src: [['todai-2026.pdf', 14, 'auto']],
    checks: noFigure({ type: 'cells', values: [16, 14] }) },
];

const KYODAI = [
  { id: 'kyodai-2025-1', year: 2025, no: 1, category: '复数', topic: '|z|=2 时 |z−i/z| 的最值；两个定积分', src: [['kyodai-2025.pdf', 2, 87, 325]],
    checks: [{ type: 'any', of: [{ type: 'through', pts: [[2, 0], [0, 2], [-2, 0]] }, { type: 'fn', at: [[0, 1], [1, 2.20711], [1.73205, 3.7141]] }, { type: 'fn', at: [[1, 0.5463], [1.5708, 1]] }] }] },
  { id: 'kyodai-2025-2', year: 2025, no: 2, category: '整数', topic: '9z²=x⁶+y⁴ 的最小值', src: [['kyodai-2025.pdf', 2, 350, 510]],
    checks: noFigure() },
  { id: 'kyodai-2025-3', year: 2025, no: 3, category: '函数', topic: 'x²log x 的法线与 x 轴交点的范围', src: [['kyodai-2025.pdf', 2, 545, 840]],
    checks: [{ type: 'fn', at: [[1, 0], [2, 2.77259], [2.71828, 7.38906]] }, { type: 'fn', at: [[1, -1], [2, 2.35353], [2.71828, 7.05572]] }] },
  { id: 'kyodai-2025-4', year: 2025, no: 4, category: '向量', topic: '四面体棱上三点所定平面过定点', src: [['kyodai-2025.pdf', 3, 89, 437]],
    checks: [{ type: 'mode', value: '3d' }, { type: 'collinear', pts: ['O', 'L', 'A'] }, { type: 'collinear', pts: ['O', 'M', 'B'] }, { type: 'collinear', pts: ['O', 'N', 'C'] }] },
  { id: 'kyodai-2025-5', year: 2025, no: 5, category: '立体几何', topic: '空间直线与 xy 平面交点的轨迹', src: [['kyodai-2025.pdf', 3, 462, 617]],
    checks: [{ type: 'at', p: 'A', x: 0, y: 0, z: T(Math.SQRT2 / 4) }, { type: 'moving', p: 'P' }] },
  { id: 'kyodai-2025-6', year: 2025, no: 6, category: '概率统计', topic: '投硬币得到的和为奇数的概率', src: [['kyodai-2025.pdf', 3, 644, 855]],
    checks: noFigure() },

  { id: 'kyodai-2026-1', year: 2026, no: 1, category: '函数', topic: '含参数的函数与水平线恰有两个交点的条件', src: [['kyodai-2026.pdf', 2, 90, 347]],
    checks: [{ type: 'curve', src: 'y = 1/(x^2 (ln(a/x))^2)', vars: ['a'], domain: [0.05, 0.95] }] },
  { id: 'kyodai-2026-2', year: 2026, no: 2, category: '立体几何', topic: '正四面体棱上的点为球心的球面与棱的位置', src: [['kyodai-2026.pdf', 2, 373, 535]],
    checks: [{ type: 'mode', value: '3d' }, { type: 'equal', segs: [['O', 'A'], ['O', 'B'], ['O', 'C'], ['A', 'B'], ['A', 'C'], ['B', 'C']] }, { type: 'dist', a: 'O', b: 'A', value: 1 },
      { type: 'collinear', pts: ['O', 'P', 'A'] }, { type: 'solid', kind: 'sphere' }] },
  { id: 'kyodai-2026-3', year: 2026, no: 3, category: '整数', topic: '多项式的系数被 2 的幂整除', src: [['kyodai-2026.pdf', 2, 565, 757]],
    checks: noFigure() },
  { id: 'kyodai-2026-4', year: 2026, no: 4, category: '平面几何', topic: '能放进单位正方形的正三角形的最小边长', src: [['kyodai-2026.pdf', 3, 90, 243]],
    checks: [{ type: 'shape', n: 4, side: 1 }, { type: 'shape', n: 3 }] },
  { id: 'kyodai-2026-5', year: 2026, no: 5, category: '三角函数', topic: '两条正弦曲线围成的区域绕 x 轴旋转', src: [['kyodai-2026.pdf', 3, 284, 410]],
    checks: [{ type: 'curve', src: 'y = sin(x + a)', vars: ['a'], domain: [-1.5, 1.5] }, { type: 'curve', src: 'y = sin(x - a)', vars: ['a'], domain: [-1.5, 1.5] }] },
  { id: 'kyodai-2026-6', year: 2026, no: 6, category: '概率统计', topic: '取三张牌时最大号码的期望值', src: [['kyodai-2026.pdf', 3, 451, 588]],
    checks: noFigure() },
];

const HANDAI = [
  { id: 'handai-2026-1', year: 2026, no: 1, category: '函数', topic: '三次曲线的三条切线围成的三角形面积', src: [['handai-2026.pdf', 2, 119, 359]],
    checks: [{ type: 'fn', at: [[0, 0], [0.5, 0.375], [-1, 0], [2, -6]] }, { type: 'fn', at: [[0, 0], [1, 1]] }, { type: 'fn', at: [[0, 2], [1, 0]] }, { type: 'at', p: 'P', x: T(2 / 3), y: T(2 / 3) }] },
  { id: 'handai-2026-2', year: 2026, no: 2, category: '向量', topic: '空间四点的长度角度条件与共面的点', src: [['handai-2026.pdf', 3, 117, 385]],
    checks: [{ type: 'mode', value: '3d' }, { type: 'dist', a: 'O', b: 'A', value: 1 }, { type: 'dist', a: 'O', b: 'B', value: 1 }, { type: 'dist', a: 'O', b: 'C', value: 1 },
      { type: 'angle', pts: ['A', 'O', 'B'], deg: 90 }, { type: 'angle', pts: ['A', 'O', 'C'], deg: 90 }, { type: 'angle', pts: ['B', 'O', 'C'], deg: 60 },
      { type: 'collinear', pts: ['O', 'B', 'D'] }, { type: 'collinear', pts: ['O', 'C', 'E'] }] },
  { id: 'handai-2026-3', year: 2026, no: 3, category: '复数', topic: '|z|=1 上满足方程的复数的个数', src: [['handai-2026.pdf', 3, 497, 795]],
    checks: [unitCircle] },
  { id: 'handai-2026-4', year: 2026, no: 4, category: '微积分', topic: 'e^(−x)cos x 的不等式与积分的极限', src: [['handai-2026.pdf', 4, 116, 335]],
    checks: [{ type: 'fn', at: [[0, 1], [0.5, 0.53228], [1, 0.19877], [1.5708, 0]] }, { type: 'fn', at: [[0, 1], [1, 0]] }] },
  { id: 'handai-2026-5', year: 2026, no: 5, category: '概率统计', topic: '掷三次骰子，式子的值为整数的概率', src: [['handai-2026.pdf', 5, 115, 337]],
    checks: noFigure() },
];

const MEIDAI = [
  { id: 'meidai-2024-1', year: 2024, no: 1, category: '函数', topic: '√x+2/√x 的极值与切线', src: [['meidai-2024.pdf', 1, 226, 355]],
    checks: [{ type: 'fn', at: [[1, 3], [4, 3], [0.25, 4.5]] }] },
  { id: 'meidai-2024-2', year: 2024, no: 2, category: '复数', topic: '三次方程的解画在复平面上与公共解', src: [['meidai-2024.pdf', 1, 364, 515]],
    checks: [{ type: 'point', at: [1, 0] }] },
  { id: 'meidai-2024-3', year: 2024, no: 3, category: '向量', topic: '空间三点确定的平面与区域上离原点最近的点', src: [['meidai-2024.pdf', 1, 523, 695]],
    checks: [{ type: 'at', p: 'A', x: 3, y: 1, z: 3 }, { type: 'at', p: 'B', x: 4, y: 2, z: 2 }, { type: 'at', p: 'C', x: 4, y: 0, z: 1 }] },
  { id: 'meidai-2024-4', year: 2024, no: 4, category: '概率统计', topic: '放回抽取的概率与积分表示', src: [['meidai-2024.pdf', 1, 703, 920]],
    checks: noFigure() },

  { id: 'meidai-2025-1', year: 2025, no: 1, category: '微积分', topic: 'log((e^x+e^(−x))/2) 与 cx−f(x) 的最大值', src: [['meidai-2025.pdf', 1, 227, 488]],
    checks: [{ type: 'fn', at: [[0, 0], [1, 0.43378], [2, 1.325], [-2, 1.325]] }] },
  { id: 'meidai-2025-2', year: 2025, no: 2, category: '整数', topic: 'a²−b²=c 的非负整数解', src: [['meidai-2025.pdf', 1, 494, 619]],
    checks: noFigure({ type: 'curve', src: 'x^2 - y^2 = 24' }, { type: 'curve', src: 'x^2 - y^2 = 25' }) },
  { id: 'meidai-2025-3', year: 2025, no: 3, category: '立体几何', topic: '旋转的圆盘、球扫过的面积和体积', src: [['meidai-2025.pdf', 1, 623, 768]],
    checks: [{ type: 'point', at: [1, 0] }, { type: 'kind', kind: 'circle', min: 1 }] },
  { id: 'meidai-2025-4', year: 2025, no: 4, category: '概率统计', topic: '翻转相邻硬币后全部反面的概率', src: [['meidai-2025.pdf', 1, 774, 1120]],
    checks: noFigure() },

  { id: 'meidai-2026-1', year: 2026, no: 1, category: '函数', topic: 'y=1/x 上两点与原点围成的面积', src: [['meidai-2026.pdf', 1, 200, 356]],
    checks: [{ type: 'fn', at: [[1, 1], [2, 0.5], [0.5, 2]] }, { type: 'onCurve', p: 'A', src: 'y = 1/x' }, { type: 'onCurve', p: 'B', src: 'y = 1/x' }] },
  { id: 'meidai-2026-2', year: 2026, no: 2, category: '向量', topic: '含参数的平面与直线、线段的公共点', src: [['meidai-2026.pdf', 1, 357, 464]],
    checks: [{ type: 'at', p: 'A', x: 2, y: 1, z: 3 }, { type: 'at', p: 'C', x: 1, y: 0, z: 0 }, { type: 'at', p: 'D', x: -1, y: 2, z: 1 }, { type: 'at', p: 'E', x: -3, y: 1, z: 0 }] },
  { id: 'meidai-2026-3', year: 2026, no: 3, category: '整数', topic: '两两互素、乘积为定值的三元组', src: [['meidai-2026.pdf', 1, 470, 666]],
    checks: noFigure() },
  { id: 'meidai-2026-4', year: 2026, no: 4, category: '概率统计', topic: '格点上随机移动的点留在带状区域内的概率', src: [['meidai-2026.pdf', 1, 673, 1033]],
    checks: [
      { type: 'any', of: [{ type: 'region', src: 'y - x <= 1, y - x >= -1' }, { type: 'through', pts: [[0, 1], [1, 2]] }] },
      { type: 'any', of: [{ type: 'region', src: 'y - x <= 1, y - x >= -1' }, { type: 'through', pts: [[1, 0], [2, 1]] }] },
    ] },
];

const TOHOKUDAI = [
  { id: 'tohokudai-2026-1', year: 2026, no: 1, category: '函数', topic: '抛物线的两条切线与切点连线的垂直平分线', src: [['tohokudai-2026.pdf', 4, 283, 605]],
    checks: [{ type: 'fn', at: [[1, 1], [2, 4], [-1, 1]] }, { type: 'kind', kind: 'line', min: 2 }] },
  { id: 'tohokudai-2026-2', year: 2026, no: 2, category: '整数', topic: 'a²+2b²=c² 的正整数解', src: [['tohokudai-2026.pdf', 4, 625, 861]],
    checks: noFigure() },
  { id: 'tohokudai-2026-3', year: 2026, no: 3, category: '函数', topic: '分段定义、处处可导的函数的最小值', src: [['tohokudai-2026.pdf', 5, 255, 484]],
    checks: [{ type: 'fn', at: [[0, 2], [0.5, 1.5], [-0.5, -0.5]] }] },
  { id: 'tohokudai-2026-4', year: 2026, no: 4, category: '概率统计', topic: '格点随机游走落在双曲线上的概率', src: [['tohokudai-2026.pdf', 5, 508, 910]],
    checks: [{ type: 'curve', src: 'x^2 - y^2 = 16' }, { type: 'point', at: [4, 0] }, { type: 'point', at: [4, 2] }] },
  { id: 'tohokudai-2026-5', year: 2026, no: 5, category: '微积分', topic: '参数曲线、切线围成的图形绕 x 轴旋转', src: [['tohokudai-2026.pdf', 6, 256, 605]],
    checks: [{ type: 'through', pts: [[1, 0], [1.55088, 1.55088], [0, 4.81048]] }] },
  { id: 'tohokudai-2026-6', year: 2026, no: 6, category: '向量', topic: '球面上的点与满足向量关系的点', src: [['tohokudai-2026.pdf', 6, 629, 887]],
    checks: [{ type: 'mode', value: '3d' }, { type: 'collinear', pts: ['O', 'A', 'P'] }, { type: 'collinear', pts: ['O', 'B', 'Q'] }, { type: 'collinear', pts: ['C', 'Q', 'D'] }, { type: 'solid', kind: 'sphere' }] },
];

const KYUDAI = [
  { id: 'kyudai-2025-1', year: 2025, no: 1, category: '向量', topic: '过三点的平面的垂线与 xy 平面的交点', src: [['kyudai-2025.pdf', 4, 'auto']],
    checks: [{ type: 'at', p: 'A', x: 1, y: 1, z: -5 }, { type: 'at', p: 'B', x: -1, y: -1, z: 7 }, { type: 'at', p: 'C', x: 1, y: -1, z: 3 }] },
  { id: 'kyudai-2025-2', year: 2025, no: 2, category: '微积分', topic: 'tan x 的导数与含 tan 的定积分', src: [['kyudai-2025.pdf', 6, 'auto']],
    checks: [{ type: 'fn', at: [[0.5, 0.5463], [1, 1.55741], [-0.5, -0.5463]] }] },
  { id: 'kyudai-2025-3', year: 2025, no: 3, category: '整数', topic: '2^m=n²+3 的整数解', src: [['kyudai-2025.pdf', 8, 'auto']],
    checks: noFigure({ type: 'fn', at: [[0, 1], [2, 4], [3, 8]] }) },
  { id: 'kyudai-2025-4', year: 2025, no: 4, category: '平面几何', topic: '单位圆上四点，等弦与直径', src: [['kyudai-2025.pdf', 10, 'auto']],
    checks: [{ type: 'circle', r: 1 }, { type: 'dist', a: 'A', b: 'D', value: 2 }, { type: 'equal', segs: [['A', 'C'], ['C', 'D']] }, { type: 'equal', segs: [['A', 'B'], ['B', 'C']] },
      { type: 'angle', pts: ['A', 'B', 'D'], deg: 90 }, { type: 'angle', pts: ['A', 'C', 'D'], deg: 90 }] },
  { id: 'kyudai-2025-5', year: 2025, no: 5, category: '概率统计', topic: '骰子决定系数的三次方程的解的个数', src: [['kyudai-2025.pdf', 12, 'auto']],
    checks: noFigure({ type: 'curve', src: 'y = (x^2 - a x + b)(x - c)', vars: ['a', 'b', 'c'] }) },

  { id: 'kyudai-2026-1', year: 2026, no: 1, category: '立体几何', topic: '球与垂直于 OP 的两个平面的截面圆', src: [['kyudai-2026.pdf', 4, 'auto']],
    checks: [{ type: 'solid', kind: 'sphere', r: 3 }, { type: 'at', p: 'P', x: 1, y: 0, z: T(S3) }] },
  { id: 'kyudai-2026-2', year: 2026, no: 2, category: '复数', topic: '线段上的 z 与 z²−wz+1=0 的 w 的轨迹', src: [['kyudai-2026.pdf', 6, 'auto']],
    checks: [{ type: 'through', pts: [[T((S3 - 1) / 2), T((S3 - 1) / 2)], [1, 1], [T((S3 + 1) / 2), T((S3 + 1) / 2)]] }] },
  { id: 'kyudai-2026-3', year: 2026, no: 3, category: '概率统计', topic: '硬币决定黑白球的排列', src: [['kyudai-2026.pdf', 8, 'auto']],
    checks: noFigure() },
  { id: 'kyudai-2026-4', year: 2026, no: 4, category: '整数', topic: '√2+√3 为解的有理系数方程', src: [['kyudai-2026.pdf', 10, 'auto']],
    checks: noFigure({ type: 'fn', at: [[0, 1], [1, -8], [2, -23], [3, -8]] }) },
  { id: 'kyudai-2026-5', year: 2026, no: 5, category: '微积分', topic: '积分上下限含 x 的函数的极值', src: [['kyudai-2026.pdf', 12, 'auto']],
    checks: [{ type: 'fn', at: [[-0.5, 0.26394], [0, 0.71659], [1, 2.27566]] }] },
];

const HOKUDAI = [
  { id: 'hokudai-2025-1', year: 2025, no: 1, category: '数列', topic: '等比数列与以项为底的对数数列', src: [['hokudai-2025.pdf', 3, 104, 525]],
    checks: noFigure() },
  { id: 'hokudai-2025-2', year: 2025, no: 2, category: '解析几何', topic: '单位圆的两条切线与椭圆上的动点', src: [['hokudai-2025.pdf', 3, 619, 902]],
    checks: [unitCircle, { type: 'curve', src: 'x^2/2 + y^2/3 = 1' }, { type: 'kind', kind: 'line', min: 2 }] },
  { id: 'hokudai-2025-3', year: 2025, no: 3, category: '微积分', topic: 'e^(ax)sin(nx) 的定积分与极限', src: [['hokudai-2025.pdf', 4, 120, 405]],
    checks: [{ type: 'curve', src: 'y = e^(a x) sin(n x)', vars: ['a', 'n'], domain: [0.2, 6] }] },
  { id: 'hokudai-2025-4', year: 2025, no: 4, category: '复数', topic: '复数方程表示的图形', src: [['hokudai-2025.pdf', 4, 461, 767]],
    checks: [{ type: 'any', of: [{ type: 'curve', src: 'x^2 + y^2 - a x = 0', vars: ['a'] }, { type: 'curve', src: 'x^2 + y^2 = 6 - a', vars: ['a'] }] }] },
  { id: 'hokudai-2025-5', year: 2025, no: 5, category: '整数', topic: '满足大小关系的整数组的个数', src: [['hokudai-2025.pdf', 4, 822, 1012]],
    checks: noFigure() },

  { id: 'hokudai-2026-1', year: 2026, no: 1, category: '数列', topic: '分式递推数列的一般项', src: [['hokudai-2026.pdf', 3, 176, 403]],
    checks: noFigure({ type: 'cells', values: [-8, T(-2 / 7)] }) },
  { id: 'hokudai-2026-2', year: 2026, no: 2, category: '微积分', topic: '积分定义的函数及其极限', src: [['hokudai-2026.pdf', 3, 437, 685]],
    checks: [{ type: 'fn', at: [[1, 0.21424], [2, 0.81052], [3, 0.70291]] }] },
  { id: 'hokudai-2026-3', year: 2026, no: 3, category: '复数', topic: '单位圆上的点与 w(z−β)=1 的图形', src: [['hokudai-2026.pdf', 3, 728, 939]],
    checks: [unitCircle, { type: 'point', at: [-0.5, T(S3 / 2)] }] },
  { id: 'hokudai-2026-4', year: 2026, no: 4, category: '立体几何', topic: '过三点的平面与坐标轴的交点、四面体体积', src: [['hokudai-2026.pdf', 4, 177, 401]],
    checks: [{ type: 'at', p: 'P', x: 1, y: 0, z: 3 }, { type: 'at', p: 'Q', x: 0, y: 2, z: 3 }] },
  { id: 'hokudai-2026-5', year: 2026, no: 5, category: '概率统计', topic: '骰子决定得分倍数的概率与期望', src: [['hokudai-2026.pdf', 4, 447, 707]],
    checks: noFigure() },
];

const UNIV = { todai: '東京大学', kyodai: '京都大学', handai: '大阪大学', meidai: '名古屋大学', tohokudai: '東北大学', kyudai: '九州大学', hokudai: '北海道大学' };

export const EXAM = [...TODAI, ...KYODAI, ...HANDAI, ...MEIDAI, ...TOHOKUDAI, ...KYUDAI, ...HOKUDAI].map((p) => ({
  ...p,
  univ: UNIV[p.id.split('-')[0]],
  image: `exam/images/${p.id}.png`,
}));
