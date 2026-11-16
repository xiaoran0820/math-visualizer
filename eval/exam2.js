// 过去问集（第二组）：神户大学、一桥大学、东京科学大学近年一般选拔的数学原题，共 58 道。
// 2026-11-12 由 Claude 整理：PDF 从各大学官网下载（来源、大小、SHA-256 见 eval/exam/README.md 第二组），
// 每道题裁成一张图片（eval/exam/images/，由 eval/exam/make-images.mjs 生成）。
//
// 为什么要第二组：第一组（eval/exam.js）已经用来设计第三版的训练题型、发现识别 LoRA 的问题，
// 再用它衡量下一版就不公平。第二组换了大学，衡量时不受这些影响。
//
// - 分成两半（按大学和“要不要画图”分层随机，种子 20261112）：
//   split: 'dev'  开发集：可以逐题看结果，用来查原因、改程序；
//   split: 'test' 测试集：只看汇总，不根据它调整任何东西（和保留集一样）。
// - 题目原文有版权，这里不抄原文：评测时由模型从图片识别题目文字，再按识别结果作图。
// - 检验写法和第一组相同（见 eval/exam.js 开头）：检验题目给出的条件，不检验答案；
//   不需要图的题（整数、组合、概率等）列了表格或没有画无关图形就算通过。
// - topic 是 Claude 写的题目概要（不是原文）。
// - src：[PDF 文件名, 页码, 上边 y, 下边 y, 左边 x?, 右边 x?]，坐标是按 100 DPI 渲染后的像素；
//   神户大学、东京科学大学（理工系）的页面四周有裁切标记，只取 x 60～760 之间。
// - 东京科学大学齿学科的卷子前两题和医学科相同、第 3 题只是变体，没有收进来。
//
// 检验条件的写法见 public/lib/checks.js。
const T = (n) => Number(n.toFixed(5));
const PI = Math.PI;

const table = { type: 'kind', kind: 'row', min: 2 };
const plain = { type: 'plain' };
const noFigure = (...extra) => [{ type: 'any', of: [...extra, table, plain] }];
const fn = (...at) => ({ type: 'fn', at: at.map(([x, y]) => [T(x), T(y)]) });
const at = (p, x, y, z) => (z === undefined ? { type: 'at', p, x, y } : { type: 'at', p, x, y, z });
const kobe = (pdf, page, y1) => [[pdf, page, 146, y1, 60, 760]];
const isct = (page, y1) => [['isct-2026.pdf', page, 142, y1, 60, 760]];

// 开发集 29 题，其余 29 题是测试集。按“大学 × 要不要画图”分组，每组用种子 20261112 打乱后取一半
// （奇数组交替多给开发集、测试集一题）。划分在看任何结果之前定下，之后不再改动。
const DEV = new Set([
  'kobe-2024-1', 'kobe-2024-4', 'kobe-2025-2', 'kobe-2026-1', 'kobe-2026-2', 'kobe-2026-4',
  'kobe-2024k-2', 'kobe-2024k-3', 'kobe-2024k-5', 'kobe-2025k-1', 'kobe-2025k-2', 'kobe-2026k-2', 'kobe-2026k-3', 'kobe-2026k-4', 'kobe-2026k-5',
  'hitotsubashi-2025-3', 'hitotsubashi-2025-4', 'hitotsubashi-2025-5', 'hitotsubashi-2026-1', 'hitotsubashi-2026-4',
  'hitotsubashi-2025k-1', 'hitotsubashi-2025k-3', 'hitotsubashi-2025k-4', 'hitotsubashi-2026k-1', 'hitotsubashi-2026k-2',
  'isct-2026-1', 'isct-2026-2', 'isct-2026-4', 'isct-2026m-1',
]);

const KOBE = [
  { id: 'kobe-2024-1', year: 2024, term: '前期', no: 1, category: '数列', topic: '函数取最大值处的 x 定义的数列与以 2 为底的对数数列', src: kobe('kobe-2024.pdf', 2, 555),
    checks: noFigure({ type: 'curve', src: 'y = x + sqrt(c - x^2)', vars: ['c'], domain: [0.05, 0.6] }) },
  { id: 'kobe-2024-2', year: 2024, term: '前期', no: 2, category: '函数', topic: '与两条定直线都相切的抛物线，切点与顶点的重心轨迹', src: kobe('kobe-2024.pdf', 3, 592),
    checks: [fn([0, 3], [1, 0]), fn([0, 3], [1, 4]), { type: 'curve', src: 'y = a x^2 - x + 3 + 1/a', vars: ['a'] }] },
  { id: 'kobe-2024-3', year: 2024, term: '前期', no: 3, category: '概率统计', topic: '骰子的点数是 n 的约数的概率', src: kobe('kobe-2024.pdf', 4, 400),
    checks: noFigure() },
  { id: 'kobe-2024-4', year: 2024, term: '前期', no: 4, category: '立体几何', topic: '给定顶点坐标的长方体绕直线旋转所得立体的体积', src: kobe('kobe-2024.pdf', 5, 593),
    checks: [at('A', 1, 0, 0), at('B', 0, 1, 0), at('C', -1, 0, 0), at('D', 0, -1, 0), at('E', 1, 0, 1), at('F', 0, 1, 1), at('G', -1, 0, 1), at('H', 0, -1, 1)] },
  { id: 'kobe-2024-5', year: 2024, term: '前期', no: 5, category: '微积分', topic: '积分定义的函数与不等式表示的区域的面积', src: kobe('kobe-2024.pdf', 6, 453),
    checks: [{ type: 'any', of: [fn([0, 0], [0.5, Math.atan(0.5)], [1, PI / 4]), fn([0, 1], [1, 0.5], [2, 0.2])] }] },

  { id: 'kobe-2025-1', year: 2025, term: '前期', no: 1, category: '函数', topic: '|x³−x| 的图像与过定点的直线恰有 4 个公共点', src: kobe('kobe-2025.pdf', 2, 455),
    checks: [fn([0, 0], [0.5, 0.375], [2, 6], [-2, 6]), { type: 'curve', src: 'y = k (x + 1)', vars: ['k'] }] },
  { id: 'kobe-2025-2', year: 2025, term: '前期', no: 2, category: '数列', topic: '√(n²+1)−n 与小数部分构成的数列', src: kobe('kobe-2025.pdf', 3, 403),
    checks: noFigure() },
  { id: 'kobe-2025-3', year: 2025, term: '前期', no: 3, category: '微积分', topic: '含绝对值的参数曲线的概形与围成的面积', src: kobe('kobe-2025.pdf', 4, 365),
    // 右半边分上下两段核对：画成一条参数曲线、或分段画成两个函数都可以
    checks: [{ type: 'through', pts: [[0, 1], [T(Math.SQRT1_2), T(Math.SQRT2)], [1, 1]] }, { type: 'through', pts: [[1, 1], [T(Math.SQRT1_2), 0], [0, -1]] }] },
  { id: 'kobe-2025-4', year: 2025, term: '前期', no: 4, category: '向量', topic: '空间两定点与含两个参数的点构成的三角形的面积', src: kobe('kobe-2025.pdf', 5, 433),
    checks: [at('A', -4, -1, 0), at('B', -3, 0, -1)] },
  { id: 'kobe-2025-5', year: 2025, term: '前期', no: 5, category: '微积分', topic: '到原点的距离等于曲线长加常数的函数', src: kobe('kobe-2025.pdf', 6, 521),
    checks: noFigure(fn([1, Math.sqrt(3)], [2, 2 * Math.sqrt(3)])) },

  { id: 'kobe-2026-1', year: 2026, term: '前期', no: 1, category: '概率统计', topic: '骰子决定系数的多项式除法的余式', src: kobe('kobe-2026.pdf', 2, 621),
    checks: noFigure() },
  { id: 'kobe-2026-2', year: 2026, term: '前期', no: 2, category: '微积分', topic: 'sin(log x)cos(log x) 的图像与围成的面积', src: kobe('kobe-2026.pdf', 3, 424),
    checks: [fn([1, 0], [Math.exp(PI / 4), 0.5], [Math.exp(PI / 2), 0], [Math.exp(3 * PI / 4), -0.5])] },
  { id: 'kobe-2026-3', year: 2026, term: '前期', no: 3, category: '整数', topic: '可写成高斯整数平方的绝对值的整数', src: kobe('kobe-2026.pdf', 4, 523),
    checks: noFigure() },
  { id: 'kobe-2026-4', year: 2026, term: '前期', no: 4, category: '微积分', topic: '含参数的积分定义的函数与必要充分条件', src: kobe('kobe-2026.pdf', 5, 460),
    checks: noFigure(fn([0, 0], [PI / 6, 0.25], [PI / 2, 0]), fn([0, -2], [PI / 4, -0.5], [PI / 2, 1])) },
  { id: 'kobe-2026-5', year: 2026, term: '前期', no: 5, category: '复数', topic: '系数含参数的二次方程的解所在的圆与三角形面积的最大值', src: kobe('kobe-2026.pdf', 6, 498),
    checks: [{ type: 'point', at: [0, 0] }, { type: 'point', at: [1, 0] }] },

  { id: 'kobe-2024k-1', year: 2024, term: '後期', no: 1, category: '函数', topic: 'y=log x 的法线中经过定点的条数', src: kobe('kobe-2024k.pdf', 2, 224),
    checks: [fn([1, 0], [Math.E, 1], [0.5, Math.log(0.5)]), { type: 'kind', kind: 'line', min: 1 }] },
  { id: 'kobe-2024k-2', year: 2024, term: '後期', no: 2, category: '函数', topic: '平移后的二次函数与三次函数的图像', src: kobe('kobe-2024k.pdf', 3, 427),
    checks: [{ type: 'any', of: [fn([0, 1], [1, 2], [-1, 6]), fn([0, 0], [1, -2], [2, 2]), fn([0, -4], [1, 2])] }] },
  { id: 'kobe-2024k-3', year: 2024, term: '後期', no: 3, category: '微积分', topic: '和式的极限与 |cos x| 的积分', src: kobe('kobe-2024k.pdf', 4, 463),
    checks: [{ type: 'any', of: [fn([0, 1], [1, Math.cos(1)], [PI / 2, 0], [PI, 1]), fn([0, 0], [PI / 4, Math.SQRT1_2], [PI / 2, 1], [PI, 2])] }] },
  { id: 'kobe-2024k-4', year: 2024, term: '後期', no: 4, category: '整数', topic: 'xⁿ 除以 (x−1)(x−2) 的商与余式', src: kobe('kobe-2024k.pdf', 5, 563),
    checks: noFigure() },
  { id: 'kobe-2024k-5', year: 2024, term: '後期', no: 5, category: '概率统计', topic: '两个变量的相关系数与数据的组数', src: kobe('kobe-2024k.pdf', 6, 775),
    checks: noFigure() },

  { id: 'kobe-2025k-1', year: 2025, term: '後期', no: 1, category: '三角函数', topic: 'sin(x+θ)cos x+1 的最大值与对 θ 的积分', src: kobe('kobe-2025k.pdf', 2, 389),
    checks: [{ type: 'any', of: ['θ', 'theta', 't'].map((v) => ({ type: 'curve', src: `y = sin(x + ${v}) cos(x) + 1`, vars: [v], params: { [v]: T(PI / 6) }, domain: [0.1, 1.47] })) }] },
  { id: 'kobe-2025k-2', year: 2025, term: '後期', no: 2, category: '函数', topic: '二次函数在整数处的最小值', src: kobe('kobe-2025k.pdf', 3, 492),
    checks: [{ type: 'curve', src: 'y = a^2 x^2 - 2*a*(a - 1)*x + 2', vars: ['a'], params: { a: 2 } }] },
  { id: 'kobe-2025k-3', year: 2025, term: '後期', no: 3, category: '平面几何', topic: '等腰三角形与内切圆的面积之比的最大值', src: kobe('kobe-2025k.pdf', 4, 346),
    checks: [{ type: 'dist', a: 'A', b: 'B', value: 1 }, { type: 'dist', a: 'A', b: 'C', value: 1 }, { type: 'kind', kind: 'circle', min: 1 }] },
  { id: 'kobe-2025k-4', year: 2025, term: '後期', no: 4, category: '概率统计', topic: '卡片数字之和除以 3 的余数的概率', src: kobe('kobe-2025k.pdf', 5, 536),
    checks: noFigure() },
  { id: 'kobe-2025k-5', year: 2025, term: '後期', no: 5, category: '不等式', topic: '用两条抛物线夹住 1−cos x', src: kobe('kobe-2025k.pdf', 6, 284),
    checks: [fn([0, 0], [1, 1 - Math.cos(1)], [PI / 2, 1]), { type: 'kind', kind: 'function', min: 2 }] },

  { id: 'kobe-2026k-1', year: 2026, term: '後期', no: 1, category: '平面几何', topic: '单位圆内接正 3·2ⁿ 边形相邻三顶点构成的三角形', src: kobe('kobe-2026k.pdf', 2, 439),
    checks: [{ type: 'circle', r: 1 }, { type: 'dist', a: 'O', b: 'P1', value: 1 }, { type: 'dist', a: 'O', b: 'P2', value: 1 }, { type: 'dist', a: 'O', b: 'P3', value: 1 },
      { type: 'equal', segs: [['P1', 'P2'], ['P2', 'P3']] }] },
  { id: 'kobe-2026k-2', year: 2026, term: '後期', no: 2, category: '微积分', topic: 'tan x−x²/2 的反函数的导数与积分', src: kobe('kobe-2026k.pdf', 3, 631),
    checks: [fn([0, 0], [0.5, Math.tan(0.5) - 0.125], [1, Math.tan(1) - 0.5])] },
  { id: 'kobe-2026k-3', year: 2026, term: '後期', no: 3, category: '函数', topic: '指数、对数式的化简与 x 的 log(2^log x) 次方的图像', src: kobe('kobe-2026k.pdf', 4, 487),
    checks: [fn([1, 1], [Math.E, 2], [1 / Math.E, 2])] },
  { id: 'kobe-2026k-4', year: 2026, term: '後期', no: 4, category: '微积分', topic: '折线与正弦曲线围成的面积及绕竖直线旋转的体积', src: kobe('kobe-2026k.pdf', 5, 484),
    checks: [fn([0, 0], [PI / 4, 0.5], [PI / 2, 1], [PI, 0]), fn([0, 0], [PI / 6, 0.5], [PI / 2, 1])] },
  { id: 'kobe-2026k-5', year: 2026, term: '後期', no: 5, category: '三角函数', topic: 'a sin x+sin 2x 取极大值的个数', src: kobe('kobe-2026k.pdf', 6, 365),
    checks: [{ type: 'curve', src: 'y = a sin(x) + sin(2x)', vars: ['a'], domain: [0.1, 6.18] }] },
];

const HITOTSUBASHI = [
  { id: 'hitotsubashi-2025-1', year: 2025, term: '前期', no: 1, category: '整数', topic: '约数个数与 √n 之比的最大值', src: [['hitotsubashi-2025.pdf', 2, 97, 350]],
    checks: noFigure() },
  { id: 'hitotsubashi-2025-2', year: 2025, term: '前期', no: 2, category: '解析几何', topic: '两圆的公共弦与关于它的对称点的轨迹', src: [['hitotsubashi-2025.pdf', 2, 435, 655]],
    checks: [{ type: 'through', pts: [[3, 0], [0, 3], [-3, 0]], count: 1 }, { type: 'circle', r: 1 }] },
  { id: 'hitotsubashi-2025-3', year: 2025, term: '前期', no: 3, category: '微积分', topic: '含绝对值的定积分等式恰有 4 个实数解', src: [['hitotsubashi-2025.pdf', 2, 735, 874]],
    checks: [{ type: 'any', of: [fn([0, 0], [1, 1], [2, 4]), { type: 'curve', src: 'y = |x^2 - a|', vars: ['a'] }, fn([-1, 25], [0, 16], [1, 13], [4, 24])] }] },
  { id: 'hitotsubashi-2025-4', year: 2025, term: '前期', no: 4, category: '向量', topic: '向量表示的点的范围内离原点最近的圆的中心', src: [['hitotsubashi-2025.pdf', 3, 97, 304]],
    checks: [at('A', 0, 3, -5), at('B', 5, -2, 10)] },
  { id: 'hitotsubashi-2025-5', year: 2025, term: '前期', no: 5, category: '概率统计', topic: '五个点组成的图上的随机移动与条件概率', src: [['hitotsubashi-2025.pdf', 3, 449, 837]],
    checks: noFigure({ type: 'kind', kind: 'line', min: 5 }) },

  { id: 'hitotsubashi-2026-1', year: 2026, term: '前期', no: 1, category: '整数', topic: '|x²−7x+1|=y² 的整数解', src: [['hitotsubashi-2026.pdf', 2, 97, 234]],
    checks: noFigure() },
  { id: 'hitotsubashi-2026-2', year: 2026, term: '前期', no: 2, category: '数列', topic: '递推数列超过 10 的 2026 次方的最小项', src: [['hitotsubashi-2026.pdf', 2, 379, 509]],
    checks: noFigure() },
  { id: 'hitotsubashi-2026-3', year: 2026, term: '前期', no: 3, category: '函数', topic: '三次函数两个极值点连线的斜率的范围', src: [['hitotsubashi-2026.pdf', 2, 638, 863]],
    checks: [{ type: 'any', of: [
      ...[['α', 'β'], ['alpha', 'beta'], ['a', 'b']].map(([u, v]) => ({ type: 'curve', src: `y = x^3 - 3/2*(${u} + ${v})*x^2 + 3*${u}*${v}*x`, vars: [u, v] })),
      { type: 'region', src: 'x >= -2, x <= -1, y >= 1, y <= 2' },
    ] }] },
  { id: 'hitotsubashi-2026-4', year: 2026, term: '前期', no: 4, category: '立体几何', topic: '正方体被平面截得的截面为底、原点为顶点的锥体体积', src: [['hitotsubashi-2026.pdf', 3, 97, 222]],
    checks: [at('A', 6, 0, 0), at('B', 0, 6, 0), at('C', 0, 0, 6), at('D', 0, 2, 6), at('E', 0, 6, 3), at('F', 3, 6, 0)] },
  { id: 'hitotsubashi-2026-5', year: 2026, term: '前期', no: 5, category: '概率统计', topic: '随机连接绳子的两端形成的环的个数', src: [['hitotsubashi-2026.pdf', 3, 334, 801]],
    checks: noFigure() },

  { id: 'hitotsubashi-2025k-1', year: 2025, term: '後期', no: 1, category: '整数', topic: '勾股数与一边为 2025 的直角三角形的面积', src: [['hitotsubashi-2025k.pdf', 2, 97, 273]],
    checks: noFigure() },
  { id: 'hitotsubashi-2025k-2', year: 2025, term: '後期', no: 2, category: '微积分', topic: 'y=x³ 与长方形，图像下方部分的面积比的最大值', src: [['hitotsubashi-2025k.pdf', 2, 330, 536]],
    checks: [fn([0, 0], [1, 1], [2, 8], [-1, -1]), { type: 'any', of: [{ type: 'kind', kind: 'polygon', min: 1 }, { type: 'kind', kind: 'line', min: 4 }] }] },
  { id: 'hitotsubashi-2025k-3', year: 2025, term: '後期', no: 3, category: '向量', topic: '三等分角的两点与内积之比', src: [['hitotsubashi-2025k.pdf', 2, 598, 853]],
    checks: [{ type: 'collinear', pts: ['A', 'M', 'B'] }, { type: 'collinear', pts: ['A', 'N', 'B'] }] },
  { id: 'hitotsubashi-2025k-4', year: 2025, term: '後期', no: 4, category: '概率统计', topic: '数轴上的随机移动在 3 或 −2 处停止', src: [['hitotsubashi-2025k.pdf', 3, 97, 362]],
    checks: noFigure() },
  { id: 'hitotsubashi-2025k-5', year: 2025, term: '後期', no: 5, category: '解析几何', topic: '二选一：圆族扫过的区域，或积分与 π 的不等式', src: [['hitotsubashi-2025k.pdf', 3, 412, 893]],
    checks: noFigure({ type: 'curve', src: 'x^2 + y^2 - 1 - t*(4x + 2y - 10) = 0', vars: ['t'] }, { type: 'curve', src: 'y = x^(4n)/(x^2 + 1)', vars: ['n'], domain: [0, 1] }) },

  { id: 'hitotsubashi-2026k-1', year: 2026, term: '後期', no: 1, category: '整数', topic: '含根式的分式所能表示的整数', src: [['hitotsubashi-2026k.pdf', 2, 97, 242]],
    checks: noFigure() },
  { id: 'hitotsubashi-2026k-2', year: 2026, term: '後期', no: 2, category: '不等式', topic: '两个二次不等式之间的命题为真的条件', src: [['hitotsubashi-2026k.pdf', 2, 384, 512]],
    checks: [{ type: 'any', of: [{ type: 'curve', src: 'y = x^2 - 2x - a', vars: ['a'] }, fn([0, 0], [1, -1], [2, 0], [3, 3])] },
      { type: 'any', of: [{ type: 'curve', src: 'y = x^2 - 2*a*x - 1', vars: ['a'] }, fn([-1, 0], [0.5, -0.75], [1, 0], [2, 0.75])] }] },
  { id: 'hitotsubashi-2026k-3', year: 2026, term: '後期', no: 3, category: '概率统计', topic: '投硬币恰好出现两段 m 次连续正面的概率', src: [['hitotsubashi-2026k.pdf', 2, 653, 854]],
    checks: noFigure() },
  { id: 'hitotsubashi-2026k-4', year: 2026, term: '後期', no: 4, category: '微积分', topic: '含绝对值的参数曲线围成的面积', src: [['hitotsubashi-2026k.pdf', 3, 97, 171]],
    checks: [{ type: 'through', pts: [[4, 11], [3, 5.875], [6, 16]] }, { type: 'through', pts: [[4, -9], [3, -14.375], [6, 16]] }] },
  { id: 'hitotsubashi-2026k-5', year: 2026, term: '後期', no: 5, category: '数列', topic: '二选一：k 个 k 排成的数列与取整，或 sin x/eˣ 的旋转体体积之和', src: [['hitotsubashi-2026k.pdf', 3, 283, 868]],
    checks: noFigure(fn([0, 0], [PI / 4, Math.SQRT1_2 * Math.exp(-PI / 4)], [PI / 2, Math.exp(-PI / 2)], [PI, 0])) },
];

const ISCT = [
  { id: 'isct-2026-1', year: 2026, term: '前期', no: 1, category: '代数', topic: 'a+b√n、a+b∛n 满足的有理系数方程', src: isct(3, 408),
    checks: noFigure() },
  { id: 'isct-2026-2', year: 2026, term: '前期', no: 2, category: '整数', topic: '组合数的恒等式与空间格点的个数', src: isct(5, 824),
    checks: noFigure() },
  { id: 'isct-2026-3', year: 2026, term: '前期', no: 3, category: '解析几何', topic: '直角三角形的中点、外心与直角条件的点', src: isct(7, 547),
    checks: [at('O', 0, 0), { type: 'midpoint', m: 'C', of: ['A', 'B'] }, { type: 'midpoint', m: 'P', of: ['A', 'C'] }, { type: 'equal', segs: [['Q', 'B'], ['Q', 'C'], ['Q', 'O']] }] },
  { id: 'isct-2026-4', year: 2026, term: '前期', no: 4, category: '复数', topic: '正六边形的边所在直线的对称变换与复数列', src: isct(9, 713),
    checks: [{ type: 'point', at: [1, 0] }, { type: 'point', at: [0.5, T(Math.sqrt(3) / 2)] }, { type: 'through', pts: [[1, 0], [0.5, T(Math.sqrt(3) / 2)]] }] },
  { id: 'isct-2026-5', year: 2026, term: '前期', no: 5, category: '微积分', topic: '含 sin²(nx) 的积分的极限与不等式', src: isct(11, 325),
    checks: noFigure({ type: 'curve', src: 'y = x^k e^(-x)', vars: ['k'] }) },

  { id: 'isct-2026m-1', year: 2026, term: '前期', no: 1, category: '立体几何', topic: '上下底为正方形的多面体体积的最大值', src: [['isct-2026-med.pdf', 3, 90, 440]],
    checks: [{ type: 'mode', value: '3d' }, at('O', 0, 0, 0), { type: 'perp', l1: ['O', 'A'], l2: ['O', 'C'] }] },
  { id: 'isct-2026m-2', year: 2026, term: '前期', no: 2, category: '概率统计', topic: '任意两项之和不为 7 的数列的个数', src: [['isct-2026-med.pdf', 4, 90, 469]],
    checks: noFigure() },
  { id: 'isct-2026m-3', year: 2026, term: '前期', no: 3, category: '解析几何', topic: '两个圆盘的公共部分的面积与扫过的立体的体积', src: [['isct-2026-med.pdf', 5, 90, 745]],
    checks: [{ type: 'any', of: [{ type: 'curve', src: 'x^2 + (y - c)^2 = r^2', vars: ['c', 'r'] }, { type: 'kind', kind: 'circle', min: 2 }, { type: 'mode', value: '3d' }] }] },
];

const UNIV = { kobe: '神戸大学', hitotsubashi: '一橋大学', isct: '東京科学大学' };
const PAPER = (id) => (id.startsWith('isct-2026m') ? '医学科' : id.startsWith('isct') ? '理工系' : undefined);

export const EXAM2 = [...KOBE, ...HITOTSUBASHI, ...ISCT].map((p) => ({
  ...p,
  univ: UNIV[p.id.split('-')[0]],
  ...(PAPER(p.id) ? { paper: PAPER(p.id) } : {}),
  split: DEV.has(p.id) ? 'dev' : 'test',
  image: `exam/images/${p.id}.png`,
}));
