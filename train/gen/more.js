// 补充的题型：解三角形、平面向量、分段函数与绝对值函数、两条切线、圆周角、三角形里的动点。
import { pick, int, num, poly, T, out } from './util.js';

const rad = (d) => (d * Math.PI) / 180;
const fmtPt = (p) => `(${num(p[0])}, ${num(p[1])})`;

// ---------- 解三角形：余弦定理、正弦定理、面积 ----------
// 边角组合都取能算出整数（或简单根式）的数
const SAS = [[5, 8, 60, 7], [3, 5, 120, 7], [8, 5, 60, 7], [7, 8, 120, 13], [5, 3, 120, 7], [3, 8, 60, 7], [5, 16, 60, 14], [6, 10, 120, 14], [16, 5, 60, 14], [7, 15, 120, 20]];
export function solveTriangle(r, S) {
  const kind = pick(r, ['sas', 'sas', 'area', 'sss']);
  const [a, b, C, c] = pick(r, SAS);
  // 顶点：C 在左下 (0,0)，B 在 x 轴上 (a,0)，A 由 b 和角 C 确定
  const Cp = [0, 0], Bp = [a, 0], Ap = [b * Math.cos(rad(C)), b * Math.sin(rad(C))];
  const base = ['ShowAxes(false)', `A = ${fmtPt(Ap)}`, `B = ${fmtPt(Bp)}`, `C = ${fmtPt(Cp)}`, 'Polygon(A, B, C)'];
  const lab = (s) => (S.L ? `$${s}$` : s);
  let text, goal, layout, cmds, title, insight, knowns;
  if (kind === 'sas') {
    text = S.ja ? `$\\triangle ABC$ において、$a=${a}$、$b=${b}$、$C=${C}^\\circ$ のとき、$c$ を求めよ。`
      : `在 ${S.tri('ABC')} 中，角 A、B、C 的对边分别为 a、b、c，已知 ${lab(`a = ${a}`)}，${lab(`b = ${b}`)}，${S.L ? `$C=${C}^\\circ$` : `C = ${C}°`}，求 c。`;
    cmds = [...base, `Angle(B, C, A) "${C}°"`, 'Segment(A, B) #hl', 'Text("c = AB = {Distance(A, B)}", ' + fmtPt([a / 2, Ap[1] + 1]) + ')'];
    goal = '求边 $c$';
    layout = `c²=a²+b²-2ab·cosC=${a}²+${b}²-2·${a}·${b}·cos${C}°=${c * c}，c=${c}；取 C(0,0)、B(${a},0)，A(${b}cos${C}°, ${b}sin${C}°)。`;
    title = '余弦定理求边';
    insight = '两边及其夹角确定一个三角形，用余弦定理求第三边。';
    knowns = [`$a=${a}$，$b=${b}$，$C=${C}^\\circ$`];
  } else if (kind === 'area') {
    text = `在 ${S.tri('ABC')} 中，${lab(`a = ${a}`)}，${lab(`b = ${b}`)}，${S.L ? `$C=${C}^\\circ$` : `C = ${C}°`}，求 ${S.tri('ABC')} 的面积。`;
    cmds = [...base, `Angle(B, C, A) "${C}°"`, 'H = Foot(A, Line(B, C))', 'Segment(A, H) #aux', 'Text("S = {Area(Polygon(A, B, C))}", ' + fmtPt([a / 2, Ap[1] + 1]) + ')'];
    goal = '求面积';
    layout = `S=½ab·sinC=½·${a}·${b}·sin${C}°；取 C(0,0)、B(${a},0)，A(${num(Ap[0])},${num(Ap[1])})。`;
    title = '三角形的面积';
    insight = '面积 $=\\frac{1}{2}ab\\sin C$，图中的高 $AH=b\\sin C$。';
    knowns = [`$a=${a}$，$b=${b}$，$C=${C}^\\circ$`];
  } else {
    text = `在 ${S.tri('ABC')} 中，三边长分别为 ${a}、${b}、${c}，求最大角的大小。`;
    cmds = [...base, `Angle(A, B, C) "β"`, `Angle(B, C, A) "γ" #hl`, `Angle(C, A, B) "α"`, 'Text("最大角 {Angle(B, C, A)}", ' + fmtPt([a / 2, Ap[1] + 1]) + ')'];
    goal = '求最大角';
    layout = `最大边 ${c} 所对的角最大：cos=(${a}²+${b}²-${c}²)/(2·${a}·${b})=${num(Math.cos(rad(C)))}，角为 ${C}°。`;
    title = '余弦定理求角';
    insight = '大边对大角，先找最长的边。';
    knowns = [`三边 $${a}$、$${b}$、$${c}$`];
  }
  return { text, out: out({ title, category: '三角函数', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 平面向量 ----------
export function vectors(r, S) {
  let ax = int(r, -3, 4), ay = int(r, -2, 4), bx = int(r, -3, 4), by = int(r, -2, 4);
  if (ax * by - ay * bx === 0) { bx += 1; by += 2; }
  const ask = pick(r, ['sum', 'angle', 'perp']);
  const vec = (x, y) => (S.L ? `$(${x},${y})$` : `(${x}, ${y})`);
  const A = S.L ? '$\\vec a$' : '向量 a', B = S.L ? '$\\vec b$' : '向量 b';
  const base = ['O = (0, 0)', `A = (${ax}, ${ay})`, `B = (${bx}, ${by})`, 'Vector(O, A) "a"', 'Vector(O, B) "b"'];
  let text, cmds, goal, layout, insight, title;
  if (ask === 'sum') {
    text = `已知 ${A} = ${vec(ax, ay)}，${B} = ${vec(bx, by)}，求 a + b 的坐标和模。`;
    cmds = [...base, 'C = A + B', 'Vector(O, C) "a + b" #hl', 'Segment(A, C) #aux', 'Segment(B, C) #aux', 'Text("|a + b| = {Distance(O, C)}", (' + num(Math.min(ax, bx, 0) - 1) + ', ' + num(Math.max(ay + by, ay, by) + 1) + '))'];
    goal = '求 $\\vec a+\\vec b$ 的坐标和模';
    layout = `a+b=(${ax}+${bx}, ${ay}+${by})=(${ax + bx}, ${ay + by})；以 a、b 为邻边的平行四边形的对角线。`;
    insight = '向量加法的平行四边形法则：从原点出发的对角线就是 $\\vec a+\\vec b$。';
    title = '向量的加法';
  } else if (ask === 'angle') {
    const dot = ax * bx + ay * by;
    text = `已知 ${A} = ${vec(ax, ay)}，${B} = ${vec(bx, by)}，求 a 与 b 夹角的余弦值。`;
    cmds = [...base, 'Angle(A, O, B) "θ" #hl', 'Text("θ = {Angle(A, O, B)}", (' + num(Math.min(ax, bx, 0) - 1) + ', ' + num(Math.max(ay, by) + 1) + '))'];
    goal = '求夹角的余弦值';
    layout = `a·b=${ax}·${bx}+${ay}·${by}=${dot}，|a|=√${ax * ax + ay * ay}，|b|=√${bx * bx + by * by}，cosθ=a·b/(|a||b|)。`;
    insight = '数量积为正时夹角是锐角，为负时是钝角。';
    title = '向量的夹角';
  } else {
    // 求 k 使 a ⊥ (a + k b)：a·a + k a·b = 0
    const aa = ax * ax + ay * ay, ab = ax * bx + ay * by;
    if (!ab) return null;
    const k = -aa / ab;
    text = `已知 ${A} = ${vec(ax, ay)}，${B} = ${vec(bx, by)}，若 a ⊥ (a + kb)，求实数 k。`.replace('a ⊥ (a + kb)', S.L ? '$\\vec a\\perp(\\vec a+k\\vec b)$' : 'a ⊥ (a + kb)');
    cmds = [...base, `k = Slider(${num(Math.floor(k) - 3)}, ${num(Math.ceil(k) + 3)}, ${num(k)})`, 'C = A + k*B', 'Vector(O, C) "a + kb" #hl', 'Angle(A, O, C) #aux', 'Text("k = {k}，夹角 {Angle(A, O, C)}", (' + num(Math.min(ax, bx, 0) - 2) + ', ' + num(Math.max(ay, by) + 2) + '))'];
    goal = '求 $k$';
    layout = `a·(a+kb)=|a|²+k·a·b=${aa}${ab >= 0 ? '+' : '-'}${Math.abs(ab)}k=0，k=${num(k)}。`;
    insight = '拖动滑块 $k$，夹角变成 $90^\\circ$ 时就是所求的 $k$。';
    title = '向量垂直求参数';
  }
  return { text, out: out({ title, category: '向量', knowns: [`$\\vec a=(${ax},${ay})$`, `$\\vec b=(${bx},${by})$`], goal, layout, commands: cmds, insight }) };
}

// ---------- 分段函数、绝对值函数 ----------
export function piecewise(r, S) {
  const kind = pick(r, ['abs', 'cases', 'absQuad']);
  let text, cmds, goal, layout, insight, title, knowns;
  if (kind === 'abs') {
    const h = int(r, -2, 3), v = int(r, -2, 2);
    const e = `|x ${h >= 0 ? '-' : '+'} ${Math.abs(h)}|${v ? (v > 0 ? ` + ${v}` : ` - ${-v}`) : ''}`.replace('|x - 0|', '|x|');
    const k = v + int(r, 1, 3);
    text = `已知函数 ${S.m(`f(x) = ${e}`)}，若方程 f(x) = ${k} 的两个根为 x₁、x₂，求 x₁ + x₂。`.replace('x₁、x₂', S.L ? '$x_1$、$x_2$' : 'x₁、x₂').replace('x₁ + x₂', S.L ? '$x_1+x_2$' : 'x₁ + x₂');
    cmds = [`f(x) = abs(x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})${v ? (v > 0 ? ` + ${v}` : ` - ${-v}`) : ''}`.replace('abs(x - 0)', 'abs(x)'), `l: y = ${k}`, 'A = Intersect(f, l, 1) #result', 'B = Intersect(f, l, 2) #result', `m: x = ${h} #aux`];
    goal = '求两根之和';
    layout = `图像是以 (${h}, ${v}) 为顶点的“V”形，关于 x=${h} 对称；y=${k} 与它交于两点，x₁+x₂=2·${h}=${2 * h}。`;
    insight = '两个交点关于对称轴 $x=' + h + '$ 对称。';
    title = '绝对值函数';
    knowns = [T(`f(x)=${e}`)];
  } else if (kind === 'cases') {
    const c = int(r, -1, 1), m = int(r, 0, 2);
    // x ≤ c 时 f = x + m；x > c 时 f = x^2
    const left = poly([1, m]), right = 'x^2';
    text = S.L ? `已知函数 $f(x)=\\begin{cases} ${left.replace(/ /g, '')}, & x\\le ${c} \\\\ x^2, & x>${c} \\end{cases}$，讨论方程 f(x) = k 的实数根的个数。`
      : `已知函数 f(x) = { ${left}，x ≤ ${c}；x²，x > ${c} }，讨论方程 f(x) = k 的实数根的个数。`;
    cmds = [`f(x) = If(x <= ${c}, ${left}, ${right})`, `k = Slider(-2, 5, 1)`, 'l: y = k #hl', 'A = Intersect(f, l, 1)', 'B = Intersect(f, l, 2)', `P = (${c}, ${c + m}) #aux`, `Q = (${c}, ${c * c}) #open`];
    goal = '讨论根的个数';
    layout = `左边是直线 y=${left.replace(/ /g, '')}（x≤${c}），右边是抛物线 y=x²（x>${c}）；拖动 y=k，数交点个数。`;
    insight = '根的个数就是直线 $y=k$ 与图像的交点个数，注意分界点处的端点是实心还是空心。';
    title = '分段函数与方程的根';
    knowns = ['分段函数 $f(x)$'];
  } else {
    const p = int(r, -3, 0), q = p + int(r, 2, 4);
    const e = poly([1, -(p + q), p * q]);
    text = `画出函数 ${S.m(`y = |${e}|`)} 的图像，并写出它的单调递增区间。`;
    cmds = [`f(x) = abs(${e})`, `g(x) = ${e} #aux`, `A = (${p}, 0)`, `B = (${q}, 0)`, `V = (${num((p + q) / 2)}, ${num(Math.abs(((q - p) / 2) ** 2))}) "最高点"`];
    goal = '画图并写出单调递增区间';
    layout = `先画抛物线 y=${e.replace(/ /g, '')}，再把 x 轴下方的部分翻折到上方；零点 x=${p}、x=${q}，顶点翻折后为 (${num((p + q) / 2)}, ${num(((q - p) / 2) ** 2)})。`;
    insight = '加绝对值就是把 $x$ 轴下方的部分翻到上方。';
    title = '绝对值与二次函数';
    knowns = [T(`y=|${e}|`)];
  }
  return { text, out: out({ title, category: '函数', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 圆：两条切线、圆周角 ----------
export function circleMore(r, S) {
  const kind = pick(r, ['twoTangents', 'inscribed']);
  const O = S.odot('O');
  if (kind === 'twoTangents') {
    const [rr, d] = pick(r, [[3, 5], [5, 13], [6, 10], [8, 17], [9, 15], [12, 13], [4, 5]]);
    const pa = Math.sqrt(d * d - rr * rr), ax = (rr * rr) / d, ay = (rr * pa) / d;
    const text = `从 ${O} 外一点 P 引 ${O} 的两条切线 PA、PB，切点分别为 A、B，若 ${O} 的半径为 ${S.L ? `$${rr}$` : rr}，${S.eq('OP', d)}，求 AB 的长。`;
    const cmds = ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${rr})`, `P = (${d}, 0)`, `A = (${num(ax)}, ${num(ay)})`, `B = (${num(ax)}, ${num(-ay)})`, 'Segment(P, A)', 'Segment(P, B)', 'Segment(O, A) #aux', 'Segment(O, B) #aux', 'Segment(O, P) #aux', 'Segment(A, B) #hl', 'Angle(O, A, P)', 'Text("AB = {Distance(A, B)}", ' + fmtPt([d / 2, rr + 1]) + ')'];
    return {
      text,
      out: out({
        title: '两条切线', category: '平面几何', knowns: [`半径 $${rr}$，$OP=${d}$`, '$PA$、$PB$ 是切线'], goal: '求 $AB$ 的长',
        layout: `PA=PB=√(${d}²-${rr}²)=${num(pa)}；OP 垂直平分 AB，AB=2·PA·OA/OP=${num(2 * ay)}；取 O(0,0)、P(${d},0)，A(${num(ax)},${num(ay)})、B(${num(ax)},${num(-ay)})。`,
        commands: cmds, insight: '从圆外一点引的两条切线长相等，$OP$ 垂直平分 $AB$。',
      }),
    };
  }
  const R0 = pick(r, [2, 3, 4, 5]), aob = pick(r, [60, 80, 100, 120, 140]);
  const A = [R0, 0], B = [R0 * Math.cos(rad(aob)), R0 * Math.sin(rad(aob))];
  const cAng = 180 + aob / 2 + 40; // 优弧上的一点
  const C = [R0 * Math.cos(rad(cAng)), R0 * Math.sin(rad(cAng))];
  const text = `如图，A、B、C 是 ${O} 上的三点，${S.ang('AOB', aob)}，求 ${S.ang('ACB')} 的度数。`;
  const cmds = ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${R0})`, `A = ${fmtPt(A)}`, `B = ${fmtPt(B)}`, `C = ${fmtPt(C)}`, 'Segment(O, A)', 'Segment(O, B)', 'Segment(C, A)', 'Segment(C, B)', `Angle(A, O, B) "${aob}°"`, 'Angle(A, C, B) #hl', 'Text("∠ACB = {Angle(A, C, B)}", ' + fmtPt([-R0, R0 + 1]) + ')'];
  return {
    text,
    out: out({
      title: '圆周角定理', category: '平面几何', knowns: [`$\\angle AOB=${aob}^\\circ$`], goal: '求 $\\angle ACB$',
      layout: `同弧所对的圆周角是圆心角的一半，∠ACB=${aob}°/2=${aob / 2}°；A、B、C 取在半径 ${R0} 的圆上，C 在优弧上。`,
      commands: cmds, insight: '拖动不了的点 $C$ 换到优弧上任何位置，$\\angle ACB$ 都不变。',
    }),
  };
}

// ---------- 三角形里的动点 ----------
export function movingTriangle(r, S) {
  const [a, b] = pick(r, [[6, 8], [8, 6], [3, 4], [9, 12], [5, 12]]);
  // Rt△ABC，∠B = 90°，AB = a（竖直），BC = b（水平）；P 从 B 出发沿 BC 运动
  const v = pick(r, [1, 2]);
  const T0 = b / v;
  const text = `在 ${S.rt('ABC')} 中，${S.ang('B', 90)}，${S.eq('AB', a)}，${S.eq('BC', b)}，动点 P 从点 B 出发，沿 BC 以每秒 ${v} 个单位的速度向点 C 运动，设运动时间为 t 秒，${S.tri('APC')} 的面积为 S，求 S 关于 t 的函数关系式。`;
  const cmds = ['ShowAxes(false)', `A = (0, ${a}) #fixed`, 'B = (0, 0) #fixed', `C = (${b}, 0) #fixed`, 'Polygon(A, B, C)', 'Angle(A, B, C)',
    `t = Slider(0, ${num(T0)}, ${num(T0 / 2)}) "时间 t"`, `P = (${v}t, 0) #hl`, 'Polygon(A, P, C) #hl', `Text("t = {t}，S = {Area(Polygon(A, P, C))}", (0, ${a + 1}))`];
  return {
    text,
    out: out({
      title: '三角形中的动点', category: '函数', knowns: [`$\\angle B=90^\\circ$，$AB=${a}$，$BC=${b}$`, `$P$ 沿 $BC$ 运动，速度 $${v}$`],
      goal: '求 $S$ 关于 $t$ 的函数关系式',
      layout: `B(0,0)、A(0,${a})、C(${b},0)；BP=${v}t，PC=${b}-${v}t，S=½·PC·AB=½·(${b}-${v}t)·${a}（0≤t≤${num(T0)}）。`,
      commands: cmds, insight: '拖动滑块 $t$：底边 $PC$ 越来越短，高 $AB$ 不变，面积均匀减小。',
    }),
  };
}
