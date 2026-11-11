// 第三批题型：把训练里还没用到的命令用起来（Parallel、Circumcenter、Incircle、Reflect、Rotate、
// IntegralBetween、Derivative、Extremum、Root、Sector、Ray、Polyline、三棱柱……），并补上数列、不等式、工程问题。
import { pick, int, num, poly, T, out, subTex } from './util.js';

const fmtPt = (p) => `(${p.map(num).join(', ')})`;
const sq = (x) => x * x;

// ---------- 相似三角形：DE ∥ BC ----------
export function similar(r, S) {
  const [ax, ay, ab] = pick(r, [[3.6, 4.8, 6], [6, 8, 10], [4.8, 6.4, 8], [5.4, 7.2, 9], [7.2, 9.6, 12]]);
  const c = pick(r, [9, 12, 15, 10, 8]);
  const ratios = [[1, 2], [1, 1], [2, 1], [1, 3], [3, 1], [2, 3]].filter(([a, b]) => Number.isInteger((ab * a) / (a + b)) && Number.isInteger((c * a) / (a + b)));
  if (!ratios.length) return null;
  const [m, n] = pick(r, ratios);
  const ad = (ab * m) / (m + n), db = ab - ad, de = (c * m) / (m + n);
  const ask = pick(r, ['de', 'ratio']);
  const text = ask === 'de'
    ? `${pick(r, ['如图，', ''])}在 ${S.tri('ABC')} 中，点 D 在边 AB 上，${S.par('DE', 'BC')} 交 AC 于点 E，${S.eq('AD', ad)}，${S.eq('DB', db)}，${S.eq('BC', c)}，求 DE 的长。`
    : `在 ${S.tri('ABC')} 中，D、E 分别在边 AB、AC 上，${S.par('DE', 'BC')}，${S.eq('AD', ad)}，${S.eq('DB', db)}，求 ${S.tri('ADE')} 与 ${S.tri('ABC')} 的面积比。`;
  const cmds = ['ShowAxes(false)', `A = ${fmtPt([ax, ay])}`, 'B = (0, 0)', `C = (${c}, 0)`, 'Polygon(A, B, C)',
    `D = A + ${m}/${m + n}*(B - A)`, 'l = Parallel(D, Line(B, C)) #aux', 'E = Intersect(l, Line(A, C))', 'Segment(D, E) #hl',
    ask === 'de' ? `Text("DE = {Distance(D, E)}", ${fmtPt([c * 0.6, ay + 0.8])})` : `Text("面积比 {Area(Polygon(A, D, E)) / Area(Polygon(A, B, C))}", ${fmtPt([c * 0.6, ay + 0.8])})`];
  return {
    text,
    out: out({
      title: '平行线与相似三角形', category: '平面几何',
      knowns: ['$DE\\parallel BC$', `$AD=${num(ad)}$，$DB=${num(db)}$${ask === 'de' ? `，$BC=${c}$` : ''}`],
      goal: ask === 'de' ? '求 $DE$ 的长' : '求 $\\triangle ADE$ 与 $\\triangle ABC$ 的面积比',
      layout: `取 B(0,0)、C(${c},0)，A(${num(ax)},${num(ay)})（AB=${ab}）；D 在 AB 上，AD:AB=${m}:${m + n}，D=A+${m}/${m + n}·(B-A)；过 D 作 BC 的平行线交 AC 于 E。${ask === 'de' ? `DE=BC·AD/AB=${num(de)}。` : `相似比 ${m}:${m + n}，面积比是相似比的平方。`}`,
      commands: cmds, insight: '$DE\\parallel BC$，所以 $\\triangle ADE\\sim\\triangle ABC$，对应边成比例。',
    }),
  };
}

// ---------- 外接圆、内切圆 ----------
export function triCircles(r, S) {
  const t = pick(r, [{ k: 'right', a: 6, b: 8 }, { k: 'right', a: 3, b: 4 }, { k: 'right', a: 5, b: 12 }, { k: 'right', a: 8, b: 15 },
    { k: 'iso', leg: 5, base: 6 }, { k: 'iso', leg: 5, base: 8 }, { k: 'iso', leg: 13, base: 10 }, { k: 'iso', leg: 10, base: 12 }, { k: 'eq', s: 6 }, { k: 'eq', s: 4 }]);
  let A, B, C, head, knowns, layout;
  if (t.k === 'right') {
    B = [0, 0]; C = [t.b, 0]; A = [t.b, t.a];
    head = `在 ${S.rt('ABC')} 中，${S.ang('C', 90)}，${S.eq('AC', t.a)}，${S.eq('BC', t.b)}`;
    knowns = ['$\\angle C=90^\\circ$', `$AC=${t.a}$，$BC=${t.b}$`];
    layout = `B(0,0)、C(${t.b},0)、A(${t.b},${t.a})，斜边 AB=${num(Math.hypot(t.a, t.b))}。`;
  } else if (t.k === 'iso') {
    const h = Math.sqrt(sq(t.leg) - sq(t.base / 2));
    B = [-t.base / 2, 0]; C = [t.base / 2, 0]; A = [0, h];
    head = `在 ${S.tri('ABC')} 中，${S.L ? `$AB=AC=${t.leg}$` : `AB = AC = ${t.leg}`}，${S.eq('BC', t.base)}`;
    knowns = [`$AB=AC=${t.leg}$，$BC=${t.base}$`];
    layout = `B(${-t.base / 2},0)、C(${t.base / 2},0)，高 √(${t.leg}²-${t.base / 2}²)=${num(h)}，A(0,${num(h)})。`;
  } else {
    const h = (t.s * Math.sqrt(3)) / 2;
    B = [-t.s / 2, 0]; C = [t.s / 2, 0]; A = [0, h];
    head = `等边 ${S.tri('ABC')} 的边长为 ${S.L ? `$${t.s}$` : t.s}`;
    knowns = [`等边三角形，边长 $${t.s}$`];
    layout = `B(${-t.s / 2},0)、C(${t.s / 2},0)，A(0,${num(h)})。`;
  }
  const base = ['ShowAxes(false)', `A = ${fmtPt(A)}`, `B = ${fmtPt(B)}`, `C = ${fmtPt(C)}`, 'Polygon(A, B, C)'];
  const top = Math.max(A[1], 0) + 1;
  const circum = pick(r, [true, false]);
  const text = `${head}，求 ${S.tri('ABC')} 的${circum ? '外接圆' : '内切圆'}半径。`;
  const cmds = circum
    ? [...base, 'O = Circumcenter(A, B, C)', 'Circle(A, B, C)', 'Segment(O, A) #hl', 'Segment(O, B) #aux', 'Segment(O, C) #aux', `Text("R = {Distance(O, A)}", ${fmtPt([C[0] * 0.5, top + 1.5])})`]
    : [...base, 'I = Incenter(A, B, C)', 'Incircle(A, B, C)', 'H = Foot(I, Line(B, C))', 'Segment(I, H) #hl', 'Angle(I, H, C)', `Text("r = {Distance(I, H)}", ${fmtPt([C[0] * 0.5, top])})`];
  return {
    text,
    out: out({
      title: circum ? '三角形的外接圆' : '三角形的内切圆', category: '平面几何', knowns,
      goal: circum ? '求外接圆半径 $R$' : '求内切圆半径 $r$',
      layout: `${layout}${circum ? '外心是三边垂直平分线的交点，到三个顶点的距离相等。' : '内心是三条角平分线的交点，到三边的距离相等；r=2S/周长。'}`,
      commands: cmds, insight: circum ? (t.k === 'right' ? '直角三角形的外心是斜边的中点。' : '外心到三个顶点的距离都等于 $R$。') : '内心到三边的距离都等于 $r$。',
    }),
  };
}

// ---------- 对称与旋转 ----------
export function transform(r, S) {
  const kind = pick(r, ['reflectLine', 'rotate', 'reflectTri', 'reflectAxis', 'translate']);
  const pt = (x, y) => (S.L ? `$(${x},${y})$` : `(${x}, ${y})`);
  if (kind === 'reflectLine') {
    const a = int(r, -3, 4), b = int(r, -2, 5);
    const [k, m] = pick(r, [[1, 0], [1, 1], [-1, 0], [-1, 2], [1, -2], [2, 0], [-1, 1]]);
    if (b === k * a + m) return null; // 点在直线上
    const l = `y = ${poly([k, m])}`;
    return {
      text: `求点 A${pt(a, b)} 关于直线 ${S.m(l)} 的对称点 B 的坐标。`,
      out: out({
        title: '点关于直线的对称点', category: '解析几何', knowns: [`$A(${a},${b})$`, `直线 ${T(l)}`], goal: '求对称点 $B$ 的坐标',
        layout: `AB 与直线垂直，AB 的中点在直线上；对称点由程序用 Reflect 算出。`,
        commands: [`A = (${a}, ${b})`, `l: ${l}`, 'B = Reflect(A, l) #result', 'Segment(A, B) #aux', 'M = Midpoint(A, B)', 'Angle(A, M, M + (1, ' + num(k) + '))'].slice(0, 5),
        insight: '对称轴垂直平分 $AB$：$AB$ 的中点 $M$ 在直线上。',
      }),
    };
  }
  if (kind === 'rotate') {
    const a = int(r, 1, 5), b = int(r, -1, 4), deg = pick(r, [90, 180, 60, 45]);
    return {
      text: `在平面直角坐标系中，将点 A${pt(a, b)} 绕原点 O 逆时针旋转 ${S.L ? `$${deg}^\\circ$` : `${deg}°`} 得到点 B，求点 B 的坐标。`,
      out: out({
        title: '点绕原点旋转', category: '解析几何', knowns: [`$A(${a},${b})$`, `绕 $O$ 逆时针旋转 $${deg}^\\circ$`], goal: '求点 $B$ 的坐标',
        layout: `OA=OB，∠AOB=${deg}°；旋转后的点由程序用 Rotate 算出。`,
        commands: ['O = (0, 0)', `A = (${a}, ${b})`, `B = Rotate(A, ${deg}°, O) #result`, 'Segment(O, A) #eq1', 'Segment(O, B) #eq1', `Angle(A, O, B) "${deg}°"`],
        insight: '旋转不改变到旋转中心的距离，$OA=OB$。',
      }),
    };
  }
  if (kind === 'translate') {
    const a = int(r, -3, 3), b = int(r, -2, 4), dx = pick(r, [2, 3, -2, 4, -3]), dy = pick(r, [1, -2, 3, -1, 2]);
    return {
      text: `将点 A${pt(a, b)} 先向${dx > 0 ? '右' : '左'}平移 ${Math.abs(dx)} 个单位，再向${dy > 0 ? '上' : '下'}平移 ${Math.abs(dy)} 个单位得到点 B，求点 B 的坐标。`,
      out: out({
        title: '点的平移', category: '解析几何', knowns: [`$A(${a},${b})$`, `向${dx > 0 ? '右' : '左'} ${Math.abs(dx)}，向${dy > 0 ? '上' : '下'} ${Math.abs(dy)}`], goal: '求点 $B$ 的坐标',
        layout: `向右（左）平移，横坐标加（减）；向上（下）平移，纵坐标加（减）：B(${a}${dx > 0 ? '+' : '-'}${Math.abs(dx)}, ${b}${dy > 0 ? '+' : '-'}${Math.abs(dy)})。`,
        commands: [`A = (${a}, ${b})`, `B = Translate(A, (${dx}, ${dy})) #result`, 'Vector(A, B) #hl'],
        insight: '平移只改变位置，不改变图形的形状和大小。',
      }),
    };
  }
  if (kind === 'reflectAxis') {
    const a = int(r, 1, 5), b = int(r, 1, 5);
    const axis = pick(r, [[' x 轴', 'xAxis'], [' y 轴', 'yAxis'], ['原点', 'O']]);
    return {
      text: `点 P${pt(a, b)} 关于${axis[0]}对称的点 Q 的坐标是什么？`,
      out: out({
        title: `关于${axis[0].trim()}的对称点`, category: '解析几何', knowns: [`$P(${a},${b})$`], goal: `求关于${axis[0].trim()}的对称点 $Q$`,
        layout: `关于 x 轴对称，纵坐标变号；关于 y 轴对称，横坐标变号；关于原点对称，两个坐标都变号。`,
        commands: [...(axis[1] === 'O' ? ['O = (0, 0)'] : []), `P = (${a}, ${b})`, `Q = Reflect(P, ${axis[1]}) #result`, 'Segment(P, Q) #aux'],
        insight: `$P$、$Q$ 到${axis[0].trim()}的距离相等。`,
      }),
    };
  }
  const P = [[int(r, 1, 2), int(r, 1, 2)], [int(r, 4, 5), int(r, 1, 2)], [int(r, 2, 4), int(r, 3, 5)]];
  const axis = pick(r, [[' y 轴', 'yAxis'], [' x 轴', 'xAxis']]);
  const nm = S.L ? "$\\triangle A'B'C'$" : "△A'B'C'";
  return {
    text: `${S.tri('ABC')} 的三个顶点分别为 A${pt(...P[0])}、B${pt(...P[1])}、C${pt(...P[2])}，画出 ${S.tri('ABC')} 关于${axis[0]}对称的 ${nm}，并写出各顶点的坐标。`,
    out: out({
      title: '三角形的轴对称', category: '平面几何', knowns: [`$A(${P[0]})$、$B(${P[1]})$、$C(${P[2]})$`], goal: `画出关于${axis[0].trim()}对称的三角形`,
      layout: `每个顶点分别关于${axis[0].trim()}作对称点，再顺次连接。`,
      commands: [`A = ${fmtPt(P[0])}`, `B = ${fmtPt(P[1])}`, `C = ${fmtPt(P[2])}`, 'Polygon(A, B, C)', `A' = Reflect(A, ${axis[1]})`, `B' = Reflect(B, ${axis[1]})`, `C' = Reflect(C, ${axis[1]})`, "Polygon(A', B', C') #hl", "Segment(A, A') #aux"],
      insight: `对应点的连线被${axis[0].trim()}垂直平分。`,
    }),
  };
}

// ---------- 定积分与面积 ----------
export function integral(r, S) {
  const kind = pick(r, ['between', 'between', 'definite']);
  if (kind === 'between') {
    const x1 = int(r, -2, 1), x2 = x1 + int(r, 1, 4);
    const k = x1 + x2, m = -x1 * x2;
    const g = poly([k, m]);
    if (g === '0') return null;
    const text = S.ja ? `放物線 ${S.m('y = x^2')} と直線 ${S.m(`y = ${g}`)} で囲まれた図形の面積を求めよ。`
      : `求由抛物线 ${S.m('y = x^2')} 与直线 ${S.m(`y = ${g}`)} 所围成的图形的面积。`;
    return {
      text,
      out: out({
        title: '曲线围成的面积', category: '函数', knowns: [T('y=x^2'), T(`y=${g}`)], goal: '求围成图形的面积',
        layout: `联立得 x=${x1} 或 x=${x2}；在 [${x1}, ${x2}] 上直线在抛物线上方，面积=∫(${g.replace(/ /g, '')}-x²)dx。`,
        commands: ['f(x) = x^2', `g(x) = ${g}`, 'A = Intersect(f, g, 1)', 'B = Intersect(f, g, 2)', `S = IntegralBetween(g, f, ${x1}, ${x2}) #hl`, `Text("面积 {Area(S)}", (${x1}, ${num(Math.max(sq(x1), sq(x2)) + 1)}))`],
        insight: '阴影部分是直线与抛物线之间的区域，面积等于两个函数之差的定积分。',
      }),
    };
  }
  const a = int(r, 0, 1), b = a + int(r, 1, 3);
  const e = pick(r, ['x^2', 'x^2 + 1', '2x + 1', 'x^3', '3x^2']);
  const text = S.L ? `计算定积分 $\\int_{${a}}^{${b}} (${e.replace(/\^(\d)/g, '^$1').replace(/ /g, '')})\\,dx$，并说明它的几何意义。`
    : `计算函数 ${S.m(`f(x) = ${e}`)} 在区间 [${a}, ${b}] 上的定积分，并说明它的几何意义。`;
  return {
    text,
    out: out({
      title: '定积分的几何意义', category: '函数', knowns: [T(`f(x)=${e}`), `区间 $[${a},${b}]$`], goal: '求定积分并说明几何意义',
      layout: `画出 f(x)=${e.replace(/ /g, '')}，把 x=${a} 到 x=${b} 之间、曲线与 x 轴围成的部分涂色，面积由程序计算。`,
      commands: [`f(x) = ${e}`, `S = Integral(f, ${a}, ${b}) #hl`, `Text("定积分 = {Area(S)}", (${a}, ${num(Math.max(1, b * b) + 2)}))`],
      insight: '定积分等于曲线、$x$ 轴和两条竖直线围成的面积。',
    }),
  };
}

// ---------- 用导数求极值（极值点由程序计算） ----------
const EXTREMA = [
  ['x - ln(x)', '最小值', 'x-\\ln x', 'x-\\log x'], ['x^2 - 2ln(x)', '最小值', 'x^2-2\\ln x', 'x^2-2\\log x'], ['ln(x)/x', '最大值', '\\frac{\\ln x}{x}', '\\frac{\\log x}{x}'],
  ['x*e^x', '最小值', 'xe^x', 'xe^x'], ['e^x - x', '最小值', 'e^x-x', 'e^x-x'], ['x*e^(-x)', '最大值', 'xe^{-x}', 'xe^{-x}'], ['x + 4/x', '极值', 'x+\\frac{4}{x}', 'x+\\frac{4}{x}'],
  ['e^x - 2x', '最小值', 'e^x-2x', 'e^x-2x'], ['x*ln(x)', '最小值', 'x\\ln x', 'x\\log x'], ['x^2*e^(-x)', '极值', 'x^2e^{-x}', 'x^2e^{-x}'], ['2x - ln(x)', '最小值', '2x-\\ln x', '2x-\\log x'],
  ['x - 2sqrt(x)', '最小值', 'x-2\\sqrt{x}', 'x-2\\sqrt{x}'], ['ln(x) - x', '最大值', '\\ln x-x', '\\log x-x'],
];
export function extremum(r, S) {
  const [e, what, texE, jaE] = pick(r, EXTREMA);
  const plainE = e.replace(/\*/g, '').replace(/ln\(x\)/g, 'ln x').replace(/sqrt\(x\)/g, '√x').replace(/\^\((-x)\)/g, '^(-x)');
  const show = S.ja ? `$f(x)=${jaE}$` : S.L ? `$f(x)=${texE}$` : `f(x) = ${plainE}`;
  const two = what === '极值';
  const text = S.ja ? `関数 ${show} の${what === '最大值' ? '最大値' : what === '最小值' ? '最小値' : '極値'}を求めよ。`
    : pick(r, [`已知函数 ${show}，求 f(x) 的${what}。`, `求函数 ${show} 的单调区间和${what}。`]);
  const cmds = [`f(x) = ${e}`, 'g(x) = Derivative(f) #aux', `P = Extremum(f, 1) "${two ? '极值点' : `${what}点`}" #result`];
  if (two) cmds.push('Q = Extremum(f, 2) "极值点" #result');
  cmds.push('R = Root(g, 1) #aux');
  return {
    text,
    out: out({
      title: `用导数求${what}`, category: '函数', knowns: [`$f(x)=${texE}$`], goal: `求 $f(x)$ 的${what}`,
      layout: `画出 f(x) 和它的导函数（Derivative，由程序求导）；导函数的零点 R 对应 f(x) 的极值点，极值点用 Extremum 由程序计算。`,
      commands: cmds, insight: '导函数在 $x$ 轴下方时 $f(x)$ 递减，在上方时递增；导函数的零点处取得极值。',
    }),
  };
}

// ---------- 曲线在某点的切线 ----------
const TANGENTS = [['ln(x)', 1, '\\ln x'], ['e^x', 0, 'e^x'], ['e^x', 1, 'e^x'], ['sqrt(x)', 4, '\\sqrt{x}'], ['sqrt(x)', 1, '\\sqrt{x}'], ['1/x', 1, '\\frac{1}{x}'], ['1/x', 2, '\\frac{1}{x}'],
  ['x*ln(x)', 1, 'x\\ln x'], ['sin(x)', 0, '\\sin x'], ['x^3', 1, 'x^3'], ['x^2 + 1/x', 1, 'x^2+\\frac{1}{x}'], ['ln(x) + x', 1, '\\ln x+x'], ['x^3 - x', 1, 'x^3-x'], ['2^x', 0, '2^x'], ['cos(x)', 0, '\\cos x'], ['x^2', 2, 'x^2'], ['x^2', -1, 'x^2']];
export function tangent(r, S) {
  const [e, x0, texE] = pick(r, TANGENTS);
  const plainE = e.replace(/\*/g, '').replace(/ln\(x\)/g, 'ln x').replace(/sqrt\(x\)/g, '√x').replace(/sin\(x\)/g, 'sin x').replace(/cos\(x\)/g, 'cos x').replace(/\^(\d)/g, (_, d) => ({ 2: '²', 3: '³' })[d] || `^${d}`);
  const show = S.L ? `$y=${S.ja ? texE.replace(/\\ln/g, '\\log') : texE}$` : `y = ${plainE}`;
  const text = S.ja ? `曲線 ${show} 上の $x=${x0}$ に対応する点における接線の方程式を求めよ。`
    : pick(r, [`求曲线 ${show} 在 ${S.L ? `$x=${x0}$` : `x = ${x0}`} 处的切线方程。`, `已知函数 ${show.replace('y', 'f(x)')}，求它的图像在 ${S.L ? `$x=${x0}$` : `x = ${x0}`} 处的切线方程。`]);
  return {
    text,
    out: out({
      title: '曲线的切线', category: '函数', knowns: [`$y=${texE}$`, `切点横坐标 $x=${x0}$`], goal: '求切线方程',
      layout: `切点 P(${x0}, f(${x0}))；切线斜率是 f'(${x0})，切线用 Tangent(${x0}, f) 由程序画出。`,
      commands: [`f(x) = ${e}`, `P = (${x0}, f(${x0})) "切点" #result`, `t = Tangent(${x0}, f) #hl`],
      insight: '切线的斜率等于函数在切点处的导数值。',
    }),
  };
}

// ---------- 扇形 ----------
export function sector(r, S) {
  const rad = pick(r, [2, 3, 4, 6, 9]), deg = pick(r, [60, 90, 120, 150, 45, 30]);
  const text = pick(r, [
    `已知扇形的半径为 ${S.L ? `$${rad}$` : rad}，圆心角为 ${S.L ? `$${deg}^\\circ$` : `${deg}°`}，求扇形的弧长和面积。`,
    `一个扇形的圆心角是 ${S.L ? `$${deg}^\\circ$` : `${deg}°`}，半径是 ${S.L ? `$${rad}$` : rad}，它的面积是多少？`,
  ]);
  return {
    text,
    out: out({
      title: '扇形的弧长和面积', category: '平面几何', knowns: [`半径 $${rad}$`, `圆心角 $${deg}^\\circ$`], goal: '求弧长和面积',
      layout: `圆心 O(0,0)，A(${rad},0)，B 由 A 绕 O 旋转 ${deg}° 得到；弧长 l=${deg}π·${rad}/180，面积 S=${deg}π·${rad}²/360。`,
      commands: ['ShowAxes(false)', 'O = (0, 0)', `A = (${rad}, 0)`, `B = Rotate(A, ${deg}°, O)`, 'Sector(O, A, B) #hl', `Angle(A, O, B) "${deg}°"`, `Text("弧长 {Length(Arc(O, A, B))}，面积 {Area(Sector(O, A, B))}", (0, ${rad + 1}))`],
      insight: '扇形的面积占整个圆的 $\\frac{n}{360}$。',
    }),
  };
}

// ---------- 工程问题（线段图） ----------
export function work(r, S) {
  const [a, b] = pick(r, [[6, 3], [10, 15], [12, 6], [20, 30], [12, 4], [8, 24], [9, 18], [15, 30], [6, 12], [4, 12]]);
  const t0 = (a * b) / (a + b);
  const ctx = pick(r, [
    { text: `一项工程，甲队单独做需要 ${a} 天完成，乙队单独做需要 ${b} 天完成。两队合作，需要多少天完成？`, unit: '天', A: '甲队', B: '乙队', whole: '全部工程' },
    { text: `一个水池，单开甲管 ${a} 小时可以注满，单开乙管 ${b} 小时可以注满。两管同时打开，几小时可以注满水池？`, unit: '小时', A: '甲管', B: '乙管', whole: '一池水' },
    { text: `一批零件，师傅单独做 ${a} 小时完成，徒弟单独做 ${b} 小时完成，两人合做几小时完成？`, unit: '小时', A: '师傅', B: '徒弟', whole: '全部零件' },
  ]);
  void S;
  return {
    text: ctx.text,
    out: out({
      title: '工程问题', category: '应用题', knowns: [`${ctx.A}单独 ${a} ${ctx.unit}`, `${ctx.B}单独 ${b} ${ctx.unit}`], goal: '求合作所需的时间',
      layout: `把${ctx.whole}看作 1，用一条长 12 的线段表示；${ctx.A}每${ctx.unit}完成 1/${a}，${ctx.B}每${ctx.unit}完成 1/${b}，合作 1÷(1/${a}+1/${b})=${num(t0)} ${ctx.unit}。`,
      commands: ['ShowAxes(false)', 'A = (0, 0) #fixed #nolabel', 'B = (12, 0) #fixed #nolabel', 'Segment(A, B)', `Brace(A, B, "${ctx.whole}（看作 1）")`,
        `t = Slider(0, ${num(Math.ceil(t0))}, ${num(t0 / 2)}) "时间 t（${ctx.unit}）"`, `P = (12t/${a}, 0) #hl #nolabel`, `Q = (12 - 12t/${b}, 0) #result #nolabel`,
        'Segment(A, P) #hl', 'Segment(Q, B) #result', `Brace(P, A, "${ctx.A}完成 {t/${a}}")`, `Brace(B, Q, "${ctx.B}完成 {t/${b}}")`, `Text("{t} ${ctx.unit}后还剩 {1 - t/${a} - t/${b}}", (2, 2.8))`],
      insight: '拖动滑块 $t$，两段线段正好接上的时候，工作全部完成。',
    }),
  };
}

// ---------- 数列 ----------
export function sequence(r, S) {
  const arith = pick(r, [true, true, false]);
  const sub = (n) => (S.L ? `$a_{${n}}$` : `a${'₀₁₂₃₄₅₆₇₈₉'[n] || `_${n}`}`);
  if (arith) {
    const a1 = int(r, -3, 5), d = pick(r, [-2, -1, 1, 2, 3]), n = pick(r, [10, 8, 12]);
    const text = S.ja ? `初項 $${a1}$、公差 $${d}$ の等差数列 $\\{a_n\\}$ について、第 $${n}$ 項と初項から第 $${n}$ 項までの和を求めよ。`
      : `在等差数列 ${S.L ? '$\\{a_n\\}$' : '{aₙ}'} 中，${sub(1)}${S.L ? '' : ' '}= ${a1}，公差 d = ${d}，求第 ${n} 项和前 ${n} 项的和。`.replace(/\$= /, '$ = ');
    const pts = Array.from({ length: 8 }, (_, i) => `P${i + 1} = (${i + 1}, ${i === 0 ? 'a' : `a + ${i === 1 ? '' : i}d`})`);
    return {
      text,
      out: out({
        title: '等差数列', category: '数列', knowns: [`$a_1=${a1}$，$d=${d}$`], goal: `求 $a_{${n}}$ 和 $S_{${n}}$`,
        layout: `把前 8 项画成点 (n, aₙ)，它们在一条直线上；aₙ=a₁+(n-1)d，Sₙ=n·a₁+n(n-1)d/2。`,
        commands: [`a = ${a1}`, `d = ${d}`, ...pts, pick(r, ['f(x) = a + (x - 1)d #aux', 'Polyline(P1, P2, P3, P4, P5, P6, P7, P8) #aux']), `Text("第 ${n} 项 {a + ${n - 1}d}，前 ${n} 项和 {${n}a + ${(n * (n - 1)) / 2}d}", (1, ${num(Math.max(a1, a1 + 7 * d) + 2)}))`],
        insight: '等差数列的点都在一条直线上，直线的斜率就是公差 $d$。',
      }),
    };
  }
  const a1 = pick(r, [1, 2, 3]), q = pick(r, [2, 3, 1 / 2]), n = pick(r, [5, 6]);
  const qT = q === 1 / 2 ? '1/2' : String(q);
  const text = `在等比数列 ${S.L ? '$\\{a_n\\}$' : '{aₙ}'} 中，${S.L ? `$a_1=${a1}$` : `a₁ = ${a1}`}，公比 ${S.L ? `$q=${q === 1 / 2 ? '\\frac{1}{2}' : q}$` : `q = ${qT}`}，求第 ${n} 项和前 ${n} 项的和。`;
  const pts = Array.from({ length: 6 }, (_, i) => `P${i + 1} = (${i + 1}, ${i === 0 ? 'a' : i === 1 ? 'a*q' : `a*q^${i}`})`);
  return {
    text,
    out: out({
      title: '等比数列', category: '数列', knowns: [`$a_1=${a1}$，$q=${q === 1 / 2 ? '\\frac{1}{2}' : q}$`], goal: `求 $a_{${n}}$ 和 $S_{${n}}$`,
      layout: `把前 6 项画成点 (n, aₙ)，它们在指数曲线 y=a₁·q^(x-1) 上；aₙ=a₁q^(n-1)，Sₙ=a₁(1-qⁿ)/(1-q)。`,
      commands: [`a = ${a1}`, `q = ${qT}`, ...pts, 'f(x) = a*q^(x - 1) #aux', `Text("第 ${n} 项 {a*q^${n - 1}}，前 ${n} 项和 {a*(1 - q^${n})/(1 - q)}", (1, ${num(Math.max(a1, a1 * q ** 5) + 2)}))`],
      insight: q > 1 ? '公比大于 $1$ 时，各项增长得越来越快。' : '公比在 $0$ 和 $1$ 之间时，各项越来越接近 $0$。',
    }),
  };
}

// ---------- 一元二次不等式、绝对值不等式 ----------
export function inequality(r, S) {
  if (pick(r, [true, true, false])) {
    const p = int(r, -4, 1), q = p + int(r, 1, 5);
    const e = poly([1, -(p + q), p * q]);
    const op = pick(r, ['<', '>', '<=', '>=']);
    const inside = op[0] === '<';
    const text = S.ja ? `2 次不等式 ${S.m(`${e} ${op} 0`)} を解け。` : pick(r, [`解不等式 ${S.m(`${e} ${op} 0`)}。`, `求不等式 ${S.m(`${e} ${op} 0`)} 的解集。`]);
    const cmds = [`f(x) = ${e}`, 'A = Intersect(f, xAxis, 1)', 'B = Intersect(f, xAxis, 2)',
      ...(inside ? ['Segment(A, B) #hl'] : ['Ray(A, A + (-1, 0)) #hl', 'Ray(B, B + (1, 0)) #hl'])];
    if (op.length === 1) cmds[1] += ' #open', cmds[2] += ' #open';
    return {
      text,
      out: out({
        title: '一元二次不等式', category: '不等式', knowns: [T(`${e}${op}0`)], goal: '求解集',
        layout: `方程 ${e.replace(/ /g, '')}=0 的两根是 ${p} 和 ${q}；抛物线开口向上，${inside ? '在两根之间位于 x 轴下方' : '在两根之外位于 x 轴上方'}。`,
        commands: cmds, insight: `看抛物线在 $x$ 轴${inside ? '下方' : '上方'}的部分对应的 $x$ 的范围${op.length === 1 ? '，端点不包括在内' : '，端点包括在内'}。`,
      }),
    };
  }
  const a = int(r, -2, 3), b = int(r, 1, 4);
  const lhs = a === 0 ? '|x|' : `|x ${a > 0 ? '-' : '+'} ${Math.abs(a)}|`;
  const text = `解不等式 ${S.m(`${lhs} < ${b}`)}。`;
  return {
    text,
    out: out({
      title: '绝对值不等式', category: '不等式', knowns: [T(`${lhs}<${b}`)], goal: '求解集',
      layout: `画出 y=${lhs} 和直线 y=${b}，交点的横坐标是 ${a - b} 和 ${a + b}；“V”形图像在直线下方的部分对应解集 (${a - b}, ${a + b})。`,
      commands: [`f(x) = ${a === 0 ? 'abs(x)' : `abs(x ${a > 0 ? '-' : '+'} ${Math.abs(a)})`}`, `l: y = ${b}`, 'A = Intersect(f, l, 1) #open', 'B = Intersect(f, l, 2) #open', 'C = Foot(A, xAxis) #open', 'D = Foot(B, xAxis) #open', 'Segment(C, D) #hl', 'Segment(A, C) #aux', 'Segment(B, D) #aux'],
      insight: `$|x${a === 0 ? '' : a > 0 ? `-${a}` : `+${-a}`}|$ 表示数轴上 $x$ 到 $${a}$ 的距离，距离小于 $${b}$ 的点在两个交点之间。`,
    }),
  };
}

// ---------- 三棱柱、三棱锥 ----------
export function solid2(r, S) {
  const nm = (s) => (S.L ? `$${subTex(s)}$` : s.replace(/([A-Z])1/g, '$1₁'));
  if (pick(r, [true, false])) {
    const b = pick(r, [2, 3, 4]), c = pick(r, [2, 3, 4]), h = pick(r, [2, 3, 4]);
    const P = { A: [0, 0, 0], B: [b, 0, 0], C: [0, c, 0], A1: [0, 0, h], B1: [b, 0, h], C1: [0, c, h] };
    const base = [...Object.entries(P).map(([n, p]) => `${n} = ${fmtPt(p)}`),
      'Segment(A, B)', 'Segment(B, C)', 'Segment(C, A)', 'Segment(A1, B1)', 'Segment(B1, C1)', 'Segment(C1, A1)', 'Segment(A, A1)', 'Segment(B, B1)', 'Segment(C, C1)', 'Angle(B, A, C)'];
    const head = `在直三棱柱 ${S.L ? '$ABC-A_1B_1C_1$' : 'ABC-A₁B₁C₁'} 中，${S.perp('AB', 'AC')}，${S.eq('AB', b)}，${S.eq('AC', c)}，${S.L ? `$AA_1=${h}$` : `AA₁ = ${h}`}`;
    const ask = pick(r, ['diag', 'mid']);
    const cmds = ask === 'diag' ? [...base, 'Segment(B, C1) #hl', `Text("BC1 = {Distance(B, C1)}", (0, 0, ${h + 1}))`]
      : [...base, 'M = Midpoint(B, C)', 'Segment(A1, M) #hl', 'Segment(A, M) #aux', `Text("A1M = {Distance(A1, M)}", (0, 0, ${h + 1}))`];
    return {
      text: `${head}，${ask === 'diag' ? `求 ${nm('BC1')} 的长` : `M 为 BC 的中点，求 ${nm('A1M')} 的长`}。`,
      out: out({
        title: '直三棱柱', category: '立体几何', knowns: ['$AB\\perp AC$', `$AB=${b}$，$AC=${c}$，$AA_1=${h}$`], goal: ask === 'diag' ? '求 $BC_1$ 的长' : '求 $A_1M$ 的长',
        layout: `以 A 为原点，AB、AC、AA1 为 x、y、z 轴：B(${b},0,0)、C(0,${c},0)、A1(0,0,${h})、B1(${b},0,${h})、C1(0,${c},${h})。`,
        commands: cmds, insight: '侧棱垂直于底面，用空间直角坐标系可以直接算出距离。',
      }),
    };
  }
  const a = pick(r, [2, 3, 4]), b = pick(r, [2, 3, 4]), h = pick(r, [2, 3, 4, 6]);
  if (a === 2 && b === 2 && h === 2) return null;
  const ask = pick(r, ['edge', 'angle', 'volume']);
  const head = `在三棱锥 P-ABC 中，${S.L ? '$PA\\perp$ 平面 $ABC$' : 'PA⊥平面 ABC'}，${S.perp('AB', 'AC')}，${S.eq('PA', h)}，${S.eq('AB', a)}，${S.eq('AC', b)}`;
  const base = ['A = (0, 0, 0)', `B = (${a}, 0, 0)`, `C = (0, ${b}, 0)`, `P = (0, 0, ${h})`, 'Polygon(A, B, C)', 'Segment(P, A)', 'Segment(P, B)', 'Segment(P, C)', 'Angle(B, A, C)', 'Angle(P, A, B)'];
  const cmds = ask === 'edge' ? [...base, 'Segment(P, B) #hl', `Text("PB = {Distance(P, B)}，PC = {Distance(P, C)}", (0, 0, ${h + 1}))`]
    : ask === 'angle' ? [...base, 'Angle(P, B, A) "θ" #hl', `Text("θ = {Angle(P, B, A)}", (0, 0, ${h + 1}))`]
      : [...base, `Text("底面积 {Area(Polygon(A, B, C))}，高 {Distance(P, A)}", (0, 0, ${h + 1}))`];
  return {
    text: `${head}，${ask === 'edge' ? '求 PB、PC 的长' : ask === 'angle' ? '求直线 PB 与平面 ABC 所成的角' : '求三棱锥 P-ABC 的体积'}。`,
    out: out({
      title: '三棱锥', category: '立体几何', knowns: ['$PA\\perp$ 平面 $ABC$，$AB\\perp AC$', `$PA=${h}$，$AB=${a}$，$AC=${b}$`],
      goal: ask === 'edge' ? '求 $PB$、$PC$ 的长' : ask === 'angle' ? '求 $PB$ 与平面 $ABC$ 所成的角' : '求体积',
      layout: `以 A 为原点，AB、AC、AP 为 x、y、z 轴：B(${a},0,0)、C(0,${b},0)、P(0,0,${h})。${ask === 'angle' ? 'PA⊥平面 ABC，所以所求角是 ∠PBA。' : ask === 'volume' ? `V=⅓·½·${a}·${b}·${h}=${num((a * b * h) / 6)}。` : ''}`,
      commands: cmds, insight: ask === 'angle' ? '$PB$ 在底面上的射影是 $AB$，线面角就是 $\\angle PBA$。' : '$PA$ 垂直于底面，是这个三棱锥的高。',
    }),
  };
}

// ---------- 解析几何基础：垂线、平行线、垂直平分线、点到直线的距离、参数方程 ----------
export function analytic(r, S) {
  const kind = pick(r, ['perp', 'par', 'bisector', 'dist', 'param']);
  const pt = (x, y) => (S.L ? `$(${x},${y})$` : `(${x}, ${y})`);
  if (kind === 'param') {
    const a = pick(r, [2, 3, 4, 5]), b = pick(r, [1, 2, 3].filter((v) => v !== a));
    const bs = b === 1 ? '' : String(b);
    const text = S.L ? `参数方程 $\\begin{cases} x=${a}\\cos t \\\\ y=${bs}\\sin t \\end{cases}$（$t$ 为参数）表示什么曲线？画出它的图形。`
      : `参数方程 x = ${a}cos t，y = ${bs}sin t（t 为参数）表示什么曲线？画出它的图形。`;
    return {
      text,
      out: out({
        title: '参数方程表示的曲线', category: '解析几何', knowns: [`$x=${a}\\cos t$，$y=${bs}\\sin t$`], goal: '判断曲线类型并画图',
        layout: `消去参数：(x/${a})²+(y/${b})²=cos²t+sin²t=1，是中心在原点、长半轴 ${Math.max(a, b)}、短半轴 ${Math.min(a, b)} 的椭圆；用 Curve 直接按参数方程画。`,
        commands: [`Curve(${a}cos(t), ${bs}sin(t), t, 0, 2pi)`, `A = (${a}, 0)`, `B = (0, ${b})`, 's = Slider(0, 6.28, 0.8)', `P = (${a}cos(s), ${bs}sin(s)) #hl`],
        insight: '拖动滑块 $s$，点 $P$ 沿椭圆转一圈。',
      }),
    };
  }
  const a = int(r, -3, 4), b = int(r, -2, 5);
  const [k, m] = pick(r, [[1, 1], [2, -1], [-1, 2], [1 / 2, 1], [-2, 3], [3, 0], [1, -2]]);
  if (b === k * a + m) return null;
  const l = `y = ${poly([k, m])}`;
  if (kind === 'perp' || kind === 'par') {
    const perp = kind === 'perp';
    return {
      text: S.ja ? `点 ${pt(a, b)} を通り、直線 ${S.m(l)} に${perp ? '垂直' : '平行'}な直線の方程式を求めよ。`
        : `求过点 A${pt(a, b)} 且与直线 ${S.m(l)} ${perp ? '垂直' : '平行'}的直线方程。`,
      out: out({
        title: perp ? '过定点的垂线' : '过定点的平行线', category: '解析几何', knowns: [`点 $A(${a},${b})$`, `直线 ${T(l)}`], goal: `求过 $A$ 且与已知直线${perp ? '垂直' : '平行'}的直线方程`,
        layout: `已知直线的斜率 ${num(k)}，所求直线的斜率 ${perp ? num(-1 / k) : num(k)}；用 ${perp ? 'Perpendicular' : 'Parallel'}(A, l) 由程序画出。`,
        commands: [`A = (${a}, ${b})`, `l: ${l}`, `m = ${perp ? 'Perpendicular' : 'Parallel'}(A, l) #hl`, ...(perp ? ['H = Intersect(l, m)', 'Angle(A, H, H + (1, ' + num(k) + '))'] : []),
          `Text("所求直线的斜率 {Slope(m)}", (${a}, ${b + 1}))`],
        insight: perp ? '两条直线垂直，斜率的乘积等于 $-1$。' : '两条直线平行，斜率相等。',
      }),
    };
  }
  if (kind === 'dist') {
    return {
      text: `求点 P${pt(a, b)} 到直线 ${S.m(l)} 的距离。`,
      out: out({
        title: '点到直线的距离', category: '解析几何', knowns: [`点 $P(${a},${b})$`, `直线 ${T(l)}`], goal: '求点到直线的距离',
        layout: `过 P 作直线的垂线，垂足为 H，PH 的长就是所求；d=|${num(k)}·${a}-${b}${m >= 0 ? '+' : '-'}${Math.abs(m)}|/√(${num(k)}²+1)=${num(Math.abs(k * a - b + m) / Math.hypot(k, 1))}。`,
        commands: [`P = (${a}, ${b})`, `l: ${l}`, 'H = Foot(P, l)', 'Segment(P, H) #hl', `Text("d = {Distance(P, H)}", (${a}, ${b + 1}))`],
        insight: '点到直线的距离是垂线段 $PH$ 的长。',
      }),
    };
  }
  const c = a + pick(r, [2, 4, 6]), d = b + pick(r, [-2, 2, 4]);
  return {
    text: `已知点 A${pt(a, b)}、B${pt(c, d)}，求线段 AB 的垂直平分线的方程。`,
    out: out({
      title: '线段的垂直平分线', category: '解析几何', knowns: [`$A(${a},${b})$、$B(${c},${d})$`], goal: '求 $AB$ 的垂直平分线的方程',
      layout: `AB 的中点 M(${num((a + c) / 2)}, ${num((b + d) / 2)})，AB 的斜率 ${num((d - b) / (c - a))}，垂直平分线的斜率 ${num(-(c - a) / (d - b))}；用 PerpendicularBisector(A, B) 由程序画出。`,
      commands: [`A = (${a}, ${b})`, `B = (${c}, ${d})`, 'Segment(A, B)', 'M = Midpoint(A, B)', 'm = PerpendicularBisector(A, B) #hl', 'Segment(A, M) #eq1', 'Segment(M, B) #eq1'],
      insight: '垂直平分线上的点到 $A$、$B$ 的距离相等。',
    }),
  };
}
