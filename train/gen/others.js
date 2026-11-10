// 其他题目：线性规划、概率（表格）、动点、应用题（线段图）。
import { pick, int, chance, num, frac, T, out } from './util.js';

// ---------- 线性规划 ----------
export function linearProgram(r, S) {
  // 约束：x ≥ 0，y ≥ 0，a1 x + b1 y ≤ c1，a2 x + b2 y ≤ c2（交点为整数）
  const sets = [
    [[1, 1, 4], [1, 2, 6]], [[1, 2, 8], [3, 1, 9]], [[2, 1, 8], [1, 1, 5]], [[1, 1, 5], [2, 1, 8]], [[1, 3, 9], [1, 1, 5]], [[3, 2, 12], [1, 2, 8]], [[1, 1, 6], [3, 1, 12]],
  ];
  const [[a1, b1, c1], [a2, b2, c2]] = pick(r, sets);
  const det = a1 * b2 - a2 * b1;
  const X = (c1 * b2 - c2 * b1) / det, Y = (a1 * c2 - a2 * c1) / det;
  const verts = [[0, 0], [Math.min(c1 / a1, c2 / a2), 0], [X, Y], [0, Math.min(c1 / b1, c2 / b2)]];
  const [p, q] = pick(r, [[2, 1], [1, 2], [3, 2], [1, 1], [2, 3], [3, 1]]);
  const zs = verts.map(([x, y]) => p * x + q * y);
  const zmax = Math.max(...zs);
  const best = verts[zs.indexOf(zmax)];
  const ineq = (a, b, c) => `${a === 1 ? '' : a}x + ${b === 1 ? '' : b}y <= ${c}`;
  const c1s = ineq(a1, b1, c1), c2s = ineq(a2, b2, c2);
  const zText = `z = ${p === 1 ? '' : p}x + ${q === 1 ? '' : q}y`;
  if (c1s === 'x + y <= 4' && zText === 'z = 2x + y') return null; // 开发集
  const cons = `${S.m(c1s)}，${S.m(c2s)}，${S.m('x >= 0')}，${S.m('y >= 0')}`;
  const text = S.ja ? `$x$, $y$ が ${S.m(c1s)}, ${S.m(c2s)}, ${S.m('x >= 0')}, ${S.m('y >= 0')} を満たすとき、${S.m(zText)} の最大値を求めよ。`
    : pick(r, [
      `若实数 x、y 满足 ${cons}，则 ${S.m(zText)} 的最大值为多少？`,
      `设变量 x，y 满足不等式组 ${cons}，求目标函数 ${S.m(zText)} 的最大值及取得最大值时的 x、y。`,
      `某工厂生产甲、乙两种产品，产量分别为 x、y（单位：吨），受原料限制满足 ${cons}，每吨利润分别为 ${p} 万元和 ${q} 万元，问怎样安排生产利润最大？`,
      `在平面直角坐标系中，画出不等式组 ${cons} 表示的平面区域，并求 ${S.m(zText)} 的最大值。`,
    ]);
  const cmds = [
    `Region(${c1s}, ${c2s}, x >= 0, y >= 0)`,
    `P = (${num(best[0])}, ${num(best[1])}) "最优解" #result`,
    `z = Slider(0, ${num(zmax + 4)}, ${num(Math.max(1, zmax - 3))})`,
    `l: ${p === 1 ? '' : p}x + ${q === 1 ? '' : q}y = z #hl`,
    `Text("z = {z}", (${num(Math.max(...verts.map((v) => v[0])) + 0.5)}, ${num(Math.max(...verts.map((v) => v[1])))}))`,
  ];
  return {
    text,
    out: out({
      title: '线性规划求最大值', category: '不等式',
      knowns: [`$${c1s.replace('<=', '\\le ')}$，$${c2s.replace('<=', '\\le ')}$，$x\\ge 0$，$y\\ge 0$`], goal: `求 $${zText}$ 的最大值`,
      layout: `可行域的顶点：${verts.map((v) => `(${num(v[0])},${num(v[1])})`).join('、')}；目标函数在顶点 (${num(best[0])},${num(best[1])}) 处取最大值 ${num(zmax)}。`,
      commands: cmds, insight: '拖动滑块 $z$，直线平移到可行域的最后一个顶点时 $z$ 最大。',
    }),
  };
}

// ---------- 概率：列表格 ----------
const CONTEXTS = [
  { a: ['男生', '女生'], b: ['近视', '不近视'], title: '性别与是否近视', pa: [0.6, 0.4], cond: [0.3, 0.2], ask: '已知抽到的学生近视，求他是男生的概率' },
  { a: ['甲厂', '乙厂'], b: ['次品', '合格品'], title: '产地与是否合格', pa: [0.7, 0.3], cond: [0.02, 0.05], ask: '已知取到的是次品，求它来自甲厂的概率' },
  { a: ['下雨', '不下雨'], b: ['迟到', '不迟到'], title: '天气与是否迟到', pa: [0.3, 0.7], cond: [0.4, 0.1], ask: '已知小明迟到了，求那天下雨的概率' },
  { a: ['患病', '未患病'], b: ['阳性', '阴性'], title: '是否患病与检测结果', pa: [0.1, 0.9], cond: [0.9, 0.05], ask: '已知检测结果为阳性，求此人确实患病的概率' },
  { a: ['A 组', 'B 组'], b: ['及格', '不及格'], title: '分组与是否及格', pa: [0.5, 0.5], cond: [0.8, 0.6], ask: '已知某人及格，求他来自 A 组的概率' },
];
const pct = (x) => `${Math.round(x * 100)}%`;

export function probability(r, S) {
  const kind = pick(r, ['cond', 'draw', 'binom', 'dice']);
  let text, cmds, knowns, goal, layout, insight, title;
  if (kind === 'cond') {
    const c = pick(r, CONTEXTS);
    const [p1, p2] = c.pa, [q1, q2] = c.cond;
    if (c.a[0] === '男生' && p1 === 0.6 && q1 === 0.3) {
      // 和提示词里的例题一样：换一组数
      c.pa = [0.55, 0.45]; c.cond = [0.4, 0.25];
    }
    const [P1, P2] = c.pa, [Q1, Q2] = c.cond;
    text = `${c.a[0]}占 ${pct(P1)}，${c.a[1]}占 ${pct(P2)}；${c.a[0]}中${c.b[0]}的占 ${pct(Q1)}，${c.a[1]}中${c.b[0]}的占 ${pct(Q2)}。${c.ask}。`;
    cmds = [`Table(${c.title}的概率)`, `Row(${c.title.split('与')[0]}, ${c.b[0]}, ${c.b[1]}, 合计)`,
      `Row(${c.a[0]}, ${P1}*${Q1}, ${P1}*${num(1 - Q1)}, ${P1})`, `Row(${c.a[1]}, ${P2}*${Q2}, ${P2}*${num(1 - Q2)}, ${P2})`,
      `Row(合计, ${P1}*${Q1}+${P2}*${Q2}, ${P1}*${num(1 - Q1)}+${P2}*${num(1 - Q2)}, 1)`,
      `Row(P(${c.a[0]}|${c.b[0]}), ${P1}*${Q1}/(${P1}*${Q1}+${P2}*${Q2}))`];
    knowns = [`${c.a[0]} ${pct(P1)}，${c.a[1]} ${pct(P2)}`, `${c.b[0]}的比例：${pct(Q1)}、${pct(Q2)}`];
    goal = `求 $P(${c.a[0]}\\mid ${c.b[0]})$`;
    layout = `按“${c.title}”列出四种情况的概率，再用 P(${c.a[0]}|${c.b[0]})=P(${c.a[0]}且${c.b[0]})/P(${c.b[0]})。`;
    insight = `只看“${c.b[0]}”这一列：其中${c.a[0]}所占的比例就是所求的条件概率。`;
    title = '条件概率';
  } else if (kind === 'draw') {
    const red = int(r, 2, 5), white = int(r, 1, 4), n = red + white;
    if (red === 3 && white === 2) return null; // 开发集
    text = `盒中有 ${red} 个红球和 ${white} 个白球，从中不放回地依次摸出 2 个球，求两次都摸到红球的概率${chance(r, 0.5) ? '，以及已知第一次摸到红球时第二次也摸到红球的概率' : ''}。`;
    cmds = ['Table(两次摸球的结果)', 'Row(第一次, 第二次, 概率)',
      `Row(红, 红, ${red}/${n}*${red - 1}/${n - 1})`, `Row(红, 白, ${red}/${n}*${white}/${n - 1})`,
      `Row(白, 红, ${white}/${n}*${red}/${n - 1})`, `Row(白, 白, ${white}/${n}*${white - 1}/${n - 1})`];
    knowns = [`红球 ${red} 个，白球 ${white} 个`, '不放回地摸 2 次'];
    goal = '求两次都摸到红球的概率';
    layout = `列出四种结果：每种的概率 = 第一次的概率 × 第一次之后第二次的概率（共 ${n} 个球，摸走一个剩 ${n - 1} 个）。`;
    insight = '第二次的概率要看第一次摸走了什么球。';
    title = '不放回摸球';
  } else if (kind === 'binom') {
    const nn = pick(r, [2, 3, 4, 3]);
    const [pn, pd] = pick(r, [[1, 2], [1, 3], [2, 3], [1, 4]]);
    if (nn === 3 && pn === 1 && pd === 2) return null; // 开发集（抛硬币 3 次）
    const pText = `${pn}/${pd}`, qText = `${pd - pn}/${pd}`;
    const C = (n, k) => { let v = 1; for (let i = 1; i <= k; i++) v = (v * (n - k + i)) / i; return v; };
    const ctx = pick(r, [['某人投篮', '投中'], ['一台机器每次', '正常运行'], ['某射手射击', '命中']]);
    text = `${ctx[0]}${ctx[1]}的概率为 ${S.m(pText)}，${ctx[0].includes('每次') ? '' : '每次'}相互独立，进行 ${nn} 次，设${ctx[1]}的次数为 X，求 X 的分布列和数学期望。`;
    const probs = Array.from({ length: nn + 1 }, (_, k) => `${C(nn, k) === 1 ? '' : `${C(nn, k)}*`}(${pText})^${k}*(${qText})^${nn - k}`.replace(/\(\d+\/\d+\)\^0\*?/g, '').replace(/\*$/, '').replace(/^\*/, '') || '1');
    cmds = ['Table(X 的分布列)', `Row(X, ${Array.from({ length: nn + 1 }, (_, k) => k).join(', ')})`, `Row(P, ${probs.join(', ')})`, `Row(E(X), ${nn}*${pText})`];
    knowns = [`每次${ctx[1]}的概率 $${pText.replace(/(\d+)\/(\d+)/, '\\frac{$1}{$2}')}$`, `独立重复 ${nn} 次`];
    goal = '求 $X$ 的分布列和数学期望';
    layout = `X~B(${nn}, ${pText})，P(X=k)=C(${nn},k)(${pText})^k(${qText})^(${nn}-k)；E(X)=np=${frac(nn * pn, pd)}。`;
    insight = '各个概率加起来等于 $1$，可以用来检查。';
    title = '二项分布';
  } else {
    const t = pick(r, ['sum', 'max']);
    if (t === 'sum') {
      text = '同时抛掷两枚质地均匀的骰子，设向上的点数之和为 X，求 X 的分布列，并求 P(X ≥ 10)。';
      const counts = Array.from({ length: 11 }, (_, i) => 6 - Math.abs(i - 5));
      cmds = ['Table(点数之和 X 的分布列)', `Row(X, ${Array.from({ length: 11 }, (_, i) => i + 2).join(', ')})`, `Row(P, ${counts.map((c) => `${c}/36`).join(', ')})`, 'Row(P(X≥10), 3/36+2/36+1/36)'];
      knowns = ['两枚均匀骰子', '$X$ 为点数之和'];
      goal = '求分布列和 $P(X\\ge 10)$';
      layout = '共 36 种等可能结果；和为 k 的结果数依次为 1,2,3,4,5,6,5,4,3,2,1。';
      insight = '和为 $7$ 的情况最多；分布列关于 $7$ 对称。';
      title = '两枚骰子的点数和';
    } else {
      const n = int(r, 4, 6), m = 2;
      text = `从 1, 2, …, ${n} 这 ${n} 个数中任取 ${m} 个不同的数，设取出的数中较大的数为 X，求 X 的分布列。`;
      const total = (n * (n - 1)) / 2;
      cmds = ['Table(较大的数 X 的分布列)', `Row(X, ${Array.from({ length: n - 1 }, (_, i) => i + 2).join(', ')})`, `Row(P, ${Array.from({ length: n - 1 }, (_, i) => `${i + 1}/${total}`).join(', ')})`];
      knowns = [`从 $1\\sim ${n}$ 中任取 $2$ 个数`];
      goal = '求较大的数 $X$ 的分布列';
      layout = `共 C(${n},2)=${total} 种取法；较大数为 k 时，另一个数有 k-1 种取法。`;
      insight = '较大的数越大，可选的另一个数越多，概率越大。';
      title = '取数问题的分布列';
    }
  }
  return { text, out: out({ title, category: '概率统计', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 动点问题 ----------
export function movingPoint(r, S) {
  const w = pick(r, [4, 6, 8]), h = pick(r, [3, 4, 6]);
  const sq = w === h;
  if (sq && w === 4) return null; // 开发集
  const shape = sq ? `正方形 ABCD 的边长为 ${w}` : `矩形 ABCD 中，AB = ${h}，BC = ${w}`;
  const text = `${shape}，点 P 从点 A 出发，沿 A→B→C 以每秒 1 个单位的速度运动，设运动时间为 t 秒，△APD 的面积为 S，求 S 关于 t 的函数关系式。`;
  // A 左上，B 左下，C 右下，D 右上
  const cmds = ['ShowAxes(false)', `A = (0, ${h}) #fixed`, 'B = (0, 0) #fixed', `C = (${w}, 0) #fixed`, `D = (${w}, ${h}) #fixed`, 'Polygon(A, B, C, D)',
    `t = Slider(0, ${w + h}, ${num(h / 2)}) "时间 t"`, `P = (If(t <= ${h}, 0, t - ${h}), If(t <= ${h}, ${h} - t, 0)) #hl`,
    'Polygon(A, P, D) #hl', `Text("t = {t}，S = {Area(Polygon(A, P, D))}", (0, ${h + 1}))`];
  return {
    text: S.L ? text.replace(/△APD/, '$\\triangle APD$') : text,
    out: out({
      title: '动点与面积', category: '函数',
      knowns: [sq ? `正方形边长 $${w}$` : `$AB=${h}$，$BC=${w}$`, '$P$ 沿 $A\\to B\\to C$ 运动，速度 $1$'],
      goal: '求 $S$ 关于 $t$ 的函数关系式',
      layout: `A(0,${h})、B(0,0)、C(${w},0)、D(${w},${h})；0≤t≤${h} 时 P 在 AB 上，P(0,${h}-t)；${h}<t≤${w + h} 时 P 在 BC 上，P(t-${h},0)。`,
      commands: cmds,
      insight: `拖动滑块 $t$：$P$ 在 $AB$ 上时面积随 $t$ 增大，到 $BC$ 上后面积保持 $${num((w * h) / 2)}$ 不变。`,
    }),
  };
}

// ---------- 应用题：相遇、追及（线段图） ----------
export function travel(r, S) {
  const kind = pick(r, ['meet', 'chase']);
  if (kind === 'meet') {
    const v1 = pick(r, [60, 70, 80, 45, 50]), v2 = pick(r, [40, 50, 60, 55]), t0 = pick(r, [2, 3, 4, 2.5]);
    const D = (v1 + v2) * t0;
    if (D === 360 && v1 === 70) return null; // 开发集
    const L = 12, sc = D / L;
    const text = pick(r, [
      `A、B 两地相距 ${num(D)} 千米，一辆货车从 A 地开往 B 地，每小时行 ${v1} 千米；同时一辆客车从 B 地开往 A 地，每小时行 ${v2} 千米。两车出发后多久相遇？`,
      `小王和小李分别从相距 ${num(D)} 米的两处同时出发相对而行，小王每分钟走 ${v1} 米，小李每分钟走 ${v2} 米，几分钟后两人相遇？`,
      `两列火车从相距 ${num(D)} 千米的两站同时相对开出，一列时速 ${v1} 千米，另一列时速 ${v2} 千米，几小时后相遇？相遇时各行了多少千米？`,
    ]);
    const cmds = ['ShowAxes(false)', 'A = (0, 0) "甲地" #fixed', `B = (${L}, 0) "乙地" #fixed`, 'Segment(A, B)', `Brace(A, B, "全程 ${num(D)} 千米")`,
      `t = Slider(0, ${num(t0 + 1)}, ${num(t0 / 2)}) "时间 t（小时）"`, `P = (${v1}t/${num(sc)}, 0) #hl #nolabel`, `Q = (${L} - ${v2}t/${num(sc)}, 0) #result #nolabel`,
      'Segment(A, P) #hl', 'Segment(Q, B) #result', `Brace(P, A, "甲车行 {${v1}t} 千米")`, `Brace(B, Q, "乙车行 {${v2}t} 千米")`,
      `Text("经过 {t} 小时，两车相距 {abs(${num(D)} - ${v1 + v2}t)} 千米", (2, 2.8))`];
    return {
      text,
      out: out({
        title: '相遇问题', category: '应用题', knowns: [`全程 ${num(D)} 千米`, `甲 ${v1} 千米/时，乙 ${v2} 千米/时，相向而行`],
        goal: '求相遇时间', layout: `线段图：全程 ${L} 个单位代表 ${num(D)} 千米；速度和 ${v1}+${v2}=${v1 + v2}，相遇时间 ${num(D)}÷${v1 + v2}=${num(t0)} 小时。`,
        commands: cmds, insight: '拖动滑块 $t$，两车每小时共同缩短的距离就是速度和。',
      }),
    };
  }
  const v1 = pick(r, [60, 80, 75]), v2 = pick(r, [40, 50, 45]), gap = pick(r, [60, 90, 120]);
  const t0 = gap / (v1 - v2);
  const L = 12, total = gap + v2 * (t0 + 1), sc = total / L;
  const text = pick(r, [
    `乙车在甲车前方 ${gap} 千米处，两车同时同向出发，甲车每小时行 ${v1} 千米，乙车每小时行 ${v2} 千米，甲车几小时后追上乙车？`,
    `一辆摩托车在一辆卡车后面 ${gap} 千米，二者同时向同一方向出发，摩托车时速 ${v1} 千米，卡车时速 ${v2} 千米，摩托车多久能追上卡车？`,
  ]);
  const cmds = ['ShowAxes(false)', 'A = (0, 0) "甲出发" #fixed', `B = (${num(gap / sc)}, 0) "乙出发" #fixed`, `E = (${L}, 0) #aux #nolabel`, 'Segment(A, E) #aux', `Brace(A, B, "相距 ${gap} 千米")`,
    `t = Slider(0, ${num(t0 + 1)}, ${num(t0 / 2)}) "时间 t（小时）"`, `P = (${v1}t/${num(sc)}, 0) #hl #nolabel`, `Q = (${num(gap / sc)} + ${v2}t/${num(sc)}, 0) #result #nolabel`,
    'Segment(A, P) #hl', 'Segment(B, Q) #result', `Text("经过 {t} 小时，甲车落后 {${gap} - ${v1 - v2}t} 千米", (1, 2.8))`];
  return {
    text,
    out: out({
      title: '追及问题', category: '应用题', knowns: [`相距 ${gap} 千米`, `甲 ${v1} 千米/时，乙 ${v2} 千米/时，同向`],
      goal: '求追及时间', layout: `速度差 ${v1}-${v2}=${v1 - v2}，追及时间 ${gap}÷${v1 - v2}=${num(t0)} 小时；线段图 ${L} 个单位代表 ${num(total)} 千米。`,
      commands: cmds, insight: '拖动滑块 $t$，甲每小时比乙多走的路程就是速度差。',
    }),
  };
}
