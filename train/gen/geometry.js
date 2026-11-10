// 几何类题目：三角形、四边形、圆、解析几何（直线与圆、圆锥曲线）、立体几何。
import { pick, int, chance, num, poly, T, out, subTex } from './util.js';

const sq = (x) => x * x;
const fmtPt = (p) => `(${num(p[0])}, ${num(p[1])}${p.length > 2 ? `, ${num(p[2])}` : ''})`;
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
// 数值 → 文字（整数、整数的平方根）
function surd(x) {
  if (Math.abs(x - Math.round(x)) < 1e-9) return num(x);
  const s = Math.round(x * x);
  if (Math.abs(x * x - s) < 1e-6) {
    for (let k = Math.floor(Math.sqrt(s)); k > 1; k--) if (s % (k * k) === 0) return `${k}√${s / (k * k)}`;
    return `√${s}`;
  }
  return num(x);
}

// ---------- 三角形：等腰、直角、一般三角形里的中点、垂足、角平分线、中线 ----------
const TRIS = [
  { kind: 'iso', base: 6, leg: 5 }, { kind: 'iso', base: 10, leg: 13 }, { kind: 'iso', base: 8, leg: 5 }, { kind: 'iso', base: 16, leg: 10 },
  { kind: 'iso', base: 12, leg: 10 }, { kind: 'iso', base: 4, leg: 3 },
  { kind: 'right', a: 3, b: 4 }, { kind: 'right', a: 6, b: 8 }, { kind: 'right', a: 5, b: 12 }, { kind: 'right', a: 8, b: 6 }, { kind: 'right', a: 9, b: 12 },
  { kind: 'eq', s: 2 }, { kind: 'eq', s: 4 }, { kind: 'eq', s: 6 },
  { kind: 'gen', a: 14, b: 13, c: 15 }, { kind: 'gen', a: 21, b: 17, c: 10 }, { kind: 'gen', a: 4, b: 5, c: 3 },
];

export function triangle(r, S) {
  const t = pick(r, TRIS);
  let A, B, C, knownText, knowns, layout, tri = S.tri('ABC'), head;
  if (t.kind === 'iso') {
    const h = Math.sqrt(sq(t.leg) - sq(t.base / 2));
    B = [-t.base / 2, 0]; C = [t.base / 2, 0]; A = [0, h];
    knownText = `${S.eq('AB', `AC = ${t.leg}`).replace('AC = ', 'AC=').replace('AB=AC=', 'AB=AC=')}，${S.eq('BC', t.base)}`;
    if (!S.L) knownText = `AB = AC = ${t.leg}，BC = ${t.base}`;
    else knownText = `$AB=AC=${t.leg}$，$BC=${t.base}$`;
    knowns = [`$AB=AC=${t.leg}$，$BC=${t.base}$`];
    layout = `取 BC 中点为原点，B(${num(-t.base / 2)},0)、C(${num(t.base / 2)},0)；高 AD=√(${t.leg}²-${num(t.base / 2)}²)=${surd(h)}，所以 A(0,${surd(h)})。`;
    head = `在 ${tri} 中，${knownText}`;
  } else if (t.kind === 'right') {
    // ∠C = 90°：C 在右下，B 在左下，A 在 C 的正上方
    C = [t.b, 0]; B = [0, 0]; A = [t.b, t.a];
    knownText = S.L ? `$\\angle C=90^\\circ$，$AC=${t.a}$，$BC=${t.b}$` : `∠C = 90°，AC = ${t.a}，BC = ${t.b}`;
    knowns = [`$\\angle C=90^\\circ$`, `$AC=${t.a}$，$BC=${t.b}$`];
    layout = `取 B(0,0)、C(${t.b},0)，∠C=90°，A 在 C 的正上方，A(${t.b},${t.a})；斜边 AB=√(${t.a}²+${t.b}²)=${surd(Math.hypot(t.a, t.b))}。`;
    head = `在 ${S.rt('ABC')} 中，${knownText}`;
  } else if (t.kind === 'eq') {
    const h = (t.s * Math.sqrt(3)) / 2;
    B = [-t.s / 2, 0]; C = [t.s / 2, 0]; A = [0, h];
    knownText = S.L ? `边长为 $${t.s}$` : `边长为 ${t.s}`;
    knowns = [`等边三角形，边长 $${t.s}$`];
    layout = `B(${num(-t.s / 2)},0)、C(${num(t.s / 2)},0)，高 ${surd(h)}，A(0,${surd(h)})。`;
    head = `已知等边 ${tri} 的${knownText}`;
  } else {
    // 一般三角形：BC = a，CA = b，AB = c
    B = [0, 0]; C = [t.a, 0];
    const x = (sq(t.c) - sq(t.b) + sq(t.a)) / (2 * t.a);
    A = [x, Math.sqrt(sq(t.c) - x * x)];
    knownText = S.L ? `$AB=${t.c}$，$BC=${t.a}$，$CA=${t.b}$` : `AB = ${t.c}，BC = ${t.a}，CA = ${t.b}`;
    knowns = [`$AB=${t.c}$，$BC=${t.a}$，$CA=${t.b}$`];
    layout = `取 B(0,0)、C(${t.a},0)，设 A(x,y)：x²+y²=${t.c}²，(x-${t.a})²+y²=${t.b}²，得 A(${num(A[0])},${surd(A[1])})。`;
    head = `在 ${tri} 中，${knownText}`;
  }
  const base = ['ShowAxes(false)', `A = ${fmtPt(A)}`, `B = ${fmtPt(B)}`, `C = ${fmtPt(C)}`, 'Polygon(A, B, C)'];
  if (t.kind === 'iso') base.push('Segment(A, B) #eq1', 'Segment(A, C) #eq1');
  if (t.kind === 'right') base.push('Angle(A, C, B)');
  const ask = pick(r, t.kind === 'right' ? ['median', 'altitude', 'foot', 'bisector'] : ['foot', 'median', 'altitude', 'bisector', 'centroid']);
  let text, goal, cmds, insight, title;
  if (ask === 'foot') {
    // D 为 BC 中点，DE ⊥ AC 于 E
    text = `${S.L ? '如图，' : pick(r, ['如图，', ''])}${head}，D 为 BC 的中点，${S.perp('DE', 'AC')} 于点 E，求 DE 的长。`;
    cmds = [...base, 'D = Midpoint(B, C)', 'E = Foot(D, Line(A, C))', 'Segment(D, E) #hl', 'Angle(D, E, C)', 'Text("DE = {Distance(D, E)}", ' + fmtPt([C[0] * 0.6 + 0.3, A[1] + 0.6]) + ')'];
    if (t.kind === 'iso') cmds.splice(cmds.indexOf('D = Midpoint(B, C)') + 1, 0, 'Segment(A, D) #aux');
    goal = '求 $DE$ 的长';
    title = '三角形中的垂线段';
    insight = t.kind === 'iso' ? '等腰三角形三线合一，$AD\\perp BC$；用面积法求 $DE$。' : '在 $\\triangle DCE$ 中，$DE$ 是 $D$ 到 $AC$ 的距离，可以用面积法。';
  } else if (ask === 'median') {
    text = `${head}，${t.kind === 'right' ? '点 D 是斜边 AB 的中点，求 CD 的长' : 'AD 是 BC 边上的中线，求 AD 的长'}。`;
    cmds = t.kind === 'right'
      ? [...base, 'D = Midpoint(A, B)', 'Segment(C, D) #hl', 'Segment(A, D) #eq2', 'Segment(D, B) #eq2', 'Text("CD = {Distance(C, D)}", ' + fmtPt([B[0] + 0.5, A[1]]) + ')']
      : [...base, 'D = Midpoint(B, C)', 'Segment(A, D) #hl', 'Segment(B, D) #eq2', 'Segment(D, C) #eq2', 'Text("AD = {Distance(A, D)}", ' + fmtPt([C[0] * 0.6, A[1] + 0.6]) + ')'];
    if (t.kind === 'right' && sq(t.a) + sq(t.b) === 100 && t.a === 6) return null; // 开发集的题
    goal = t.kind === 'right' ? '求斜边上的中线 $CD$ 的长' : '求中线 $AD$ 的长';
    title = '三角形的中线';
    insight = t.kind === 'right' ? '直角三角形斜边上的中线等于斜边的一半。' : '中线把底边分成相等的两段。';
  } else if (ask === 'altitude') {
    const into = t.kind === 'right' ? 'AB' : 'BC';
    text = `${head}，${t.kind === 'right' ? `${S.perp('CH', 'AB')} 于点 H，求 CH 的长` : `${S.perp('AH', 'BC')} 于点 H，求 AH 的长`}。`;
    cmds = t.kind === 'right'
      ? [...base, 'H = Foot(C, Line(A, B))', 'Segment(C, H) #hl', 'Angle(C, H, B)', 'Text("CH = {Distance(C, H)}", ' + fmtPt([B[0] + 0.5, A[1]]) + ')']
      : [...base, 'H = Foot(A, Line(B, C))', 'Segment(A, H) #hl', 'Angle(A, H, C)', 'Text("AH = {Distance(A, H)}", ' + fmtPt([C[0] * 0.6, A[1] + 0.6]) + ')'];
    goal = `求 ${into} 边上的高`;
    title = '三角形的高';
    insight = '用两种方法表示面积，就能求出高。';
  } else if (ask === 'bisector') {
    text = `${head}，${t.kind === 'right' ? 'CD 平分 ∠ACB 交 AB 于点 D，求 CD 的长' : 'AD 平分 ∠BAC 交 BC 于点 D，求 BD 的长'}。`;
    if (S.L) text = text.replace('∠ACB', '$\\angle ACB$').replace('∠BAC', '$\\angle BAC$');
    cmds = t.kind === 'right'
      ? [...base, 'D = Intersect(AngleBisector(A, C, B), Line(A, B))', 'Segment(C, D) #hl', 'Angle(A, C, D) "α"', 'Angle(D, C, B) "α"', 'Text("CD = {Distance(C, D)}", ' + fmtPt([B[0] + 0.5, A[1]]) + ')']
      : [...base, 'D = Intersect(AngleBisector(B, A, C), Line(B, C))', 'Segment(A, D) #hl', 'Angle(B, A, D) "α"', 'Angle(D, A, C) "α"', 'Segment(B, D) #result', 'Text("BD = {Distance(B, D)}", ' + fmtPt([C[0] * 0.6, A[1] + 0.6]) + ')'];
    goal = t.kind === 'right' ? '求角平分线 $CD$ 的长' : '求 $BD$ 的长';
    title = '三角形的角平分线';
    insight = '角平分线把对边分成的两段，与两条邻边成比例。';
  } else {
    text = `${head}，G 是 ${tri} 的重心，求 AG 的长。`;
    cmds = [...base, 'D = Midpoint(B, C)', 'Segment(A, D) #aux', 'G = Centroid(A, B, C) #result', 'Segment(A, G) #hl', 'Text("AG = {Distance(A, G)}", ' + fmtPt([C[0] * 0.6, A[1] + 0.6]) + ')'];
    goal = '求 $AG$ 的长';
    title = '三角形的重心';
    insight = '重心在中线上，把中线分成 $2:1$ 两段。';
  }
  return { text, out: out({ title, category: '平面几何', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 四边形：矩形、平行四边形、菱形、正方形、梯形 ----------
export function quadrilateral(r, S) {
  const kind = pick(r, ['rect', 'para', 'rhombus', 'square', 'trap']);
  let P, knowns, layout, head, title;
  if (kind === 'rect') {
    const w = pick(r, [6, 8, 10, 12, 4]), h = pick(r, [3, 4, 6, 5]);
    if (w === 8 && h === 6) return null; // 开发集
    P = { A: [0, h], B: [0, 0], C: [w, 0], D: [w, h] };
    head = `在矩形 ABCD 中，${S.eq('AB', h)}，${S.eq('BC', w)}`;
    knowns = [`矩形 $ABCD$，$AB=${h}$，$BC=${w}$`];
    layout = `B(0,0)、C(${w},0)、A(0,${h})、D(${w},${h})。`;
    title = '矩形中的线段';
  } else if (kind === 'para') {
    const a = pick(r, [6, 8, 5]), b = pick(r, [4, 3, 6]), ang = pick(r, [60, 45, 30, 120]);
    if (a === 6 && b === 4 && ang === 60) return null;
    const rad = (ang * Math.PI) / 180;
    P = { A: [0, 0], B: [a, 0], D: [b * Math.cos(rad), b * Math.sin(rad)] };
    P.C = [P.B[0] + P.D[0], P.D[1]];
    head = `在平行四边形 ABCD 中，${S.eq('AB', a)}，${S.eq('AD', b)}，${S.ang('A', ang)}`;
    knowns = [`$AB=${a}$，$AD=${b}$，$\\angle A=${ang}^\\circ$`];
    layout = `A(0,0)、B(${a},0)，D(${b}cos${ang}°, ${b}sin${ang}°)=(${num(P.D[0])},${num(P.D[1])})，C=B+D-A=(${num(P.C[0])},${num(P.C[1])})。`;
    title = '平行四边形的对角线';
  } else if (kind === 'rhombus') {
    const d1 = pick(r, [6, 8, 12, 10]), d2 = pick(r, [8, 6, 16, 24].filter((v) => v !== d1));
    P = { A: [-d1 / 2, 0], B: [0, -d2 / 2], C: [d1 / 2, 0], D: [0, d2 / 2] };
    head = `菱形 ABCD 的两条对角线 ${S.eq('AC', d1)}，${S.eq('BD', d2)}`;
    knowns = [`菱形 $ABCD$，$AC=${d1}$，$BD=${d2}$`];
    layout = `对角线互相垂直平分：以交点 O 为原点，A(${-d1 / 2},0)、C(${d1 / 2},0)、B(0,${-d2 / 2})、D(0,${d2 / 2})；边长 √(${d1 / 2}²+${d2 / 2}²)=${surd(Math.hypot(d1 / 2, d2 / 2))}。`;
    title = '菱形的边长与高';
  } else if (kind === 'square') {
    const s = pick(r, [4, 6, 8]);
    P = { A: [0, s], B: [0, 0], C: [s, 0], D: [s, s] };
    head = `正方形 ABCD 的边长为 ${S.L ? `$${s}$` : s}`;
    knowns = [`正方形 $ABCD$，边长 $${s}$`];
    layout = `B(0,0)、C(${s},0)、D(${s},${s})、A(0,${s})。`;
    title = '正方形中的线段';
  } else {
    // 等腰梯形 ABCD，AD ∥ BC，AD 上底，BC 下底
    const top = pick(r, [4, 6, 2]), bot = top + pick(r, [6, 4, 8]), h = pick(r, [4, 3, 6]);
    const off = (bot - top) / 2;
    P = { B: [0, 0], C: [bot, 0], A: [off, h], D: [off + top, h] };
    head = `在等腰梯形 ABCD 中，${S.par('AD', 'BC')}，${S.eq('AD', top)}，${S.eq('BC', bot)}，${S.eq('AB', `CD = ${surd(Math.hypot(off, h))}`).replace('$AB=CD=', '$AB=CD=')}`;
    if (!S.L) head = `在等腰梯形 ABCD 中，AD∥BC，AD = ${top}，BC = ${bot}，AB = CD = ${surd(Math.hypot(off, h))}`;
    else head = `在等腰梯形 $ABCD$ 中，$AD\\parallel BC$，$AD=${top}$，$BC=${bot}$，$AB=CD=${surd(Math.hypot(off, h)).replace(/(\d*)√(\d+)/, (_, k, n) => `${k}\\sqrt{${n}}`)}$`;
    knowns = [`$AD\\parallel BC$，$AD=${top}$，$BC=${bot}$`, `腰长 $${surd(Math.hypot(off, h)).replace(/(\d*)√(\d+)/, (_, k, n) => `${k}\\sqrt{${n}}`)}$`];
    layout = `B(0,0)、C(${bot},0)；腰在底边上的投影 (${bot}-${top})/2=${num(off)}，高 √(腰²-${num(off)}²)=${h}，A(${num(off)},${h})、D(${num(off + top)},${h})。`;
    title = '等腰梯形的高';
  }
  const base = ['ShowAxes(false)', ...['A', 'B', 'C', 'D'].map((n) => `${n} = ${fmtPt(P[n])}`), 'Polygon(A, B, C, D)'];
  let text, goal, cmds, insight;
  if (kind === 'rect' || kind === 'square') {
    const side = kind === 'rect' ? P.C[0] : P.C[0];
    const e = pick(r, [1, 2, 3].filter((v) => v < side));
    text = pick(r, [
      `${head}，点 E 在边 BC 上，且 ${S.eq('BE', e)}，连接 AE，过点 D 作 ${S.perp('DF', 'AE')} 于点 F，求 DF 的长。`,
      `如图，${head.replace(/^在/, '在')}，E 是 BC 上一点，${S.eq('BE', e)}，${S.perp('DF', 'AE')}，垂足为 F。求点 D 到直线 AE 的距离。`,
      `${head}，E 为 BC 边上的点，${S.eq('BE', e)}。作 ${S.perp('DF', 'AE')} 交 AE 于 F，求线段 DF 的长度。`,
    ]);
    cmds = [...base, `E = (${e}, 0)`, 'Segment(A, E)', 'F = Foot(D, Line(A, E))', 'Segment(D, F) #hl', 'Angle(D, F, A)', 'Text("DF = {Distance(D, F)}", ' + fmtPt([P.D[0] / 2, P.A[1] + 0.8]) + ')'];
    goal = '求 $DF$ 的长';
    insight = '$\\triangle ABE$ 与 $\\triangle DFA$ 相似，或者用面积法。';
  } else if (kind === 'para') {
    text = `${head}，求对角线 BD 和 AC 的长。`;
    cmds = [...base, 'Segment(B, D) #hl', 'Segment(A, C) #hl', `Angle(B, A, D) "${num(Math.round(Math.atan2(P.D[1], P.D[0]) * 180 / Math.PI))}°"`, 'Text("BD = {Distance(B, D)}，AC = {Distance(A, C)}", ' + fmtPt([0, P.D[1] + 1]) + ')'];
    goal = '求对角线 $BD$、$AC$ 的长';
    insight = '在 $\\triangle ABD$、$\\triangle ABC$ 中用余弦定理。';
  } else if (kind === 'rhombus') {
    text = `${head}，求菱形的边长和面积。`;
    cmds = [...base, 'O = Midpoint(A, C)', 'Segment(A, C) #aux', 'Segment(B, D) #aux', 'Angle(C, O, D)', 'Segment(A, B) #hl', 'Text("边长 {Distance(A, B)}，面积 {Area(Polygon(A, B, C, D))}", ' + fmtPt([P.A[0], P.D[1] + 1]) + ')'];
    goal = '求边长和面积';
    insight = '菱形的对角线互相垂直平分，面积等于对角线乘积的一半。';
  } else {
    text = `${head}，求梯形的高和面积。`;
    cmds = [...base, 'H = Foot(A, Line(B, C))', 'Segment(A, H) #hl', 'Angle(A, H, C)', 'Segment(A, B) #eq1', 'Segment(C, D) #eq1', 'Text("高 {Distance(A, H)}，面积 {Area(Polygon(A, B, C, D))}", ' + fmtPt([0, P.A[1] + 1]) + ')'];
    goal = '求梯形的高和面积';
    insight = '从上底的端点作高，把梯形分成矩形和两个全等的直角三角形。';
  }
  return { text, out: out({ title, category: '平面几何', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 圆：弦心距、切线长、直径所对的圆周角 ----------
export function circleGeom(r, S) {
  const kind = pick(r, ['chord', 'tangent', 'diameter']);
  let text, cmds, knowns, goal, layout, insight, title;
  const O = S.odot('O');
  if (kind === 'chord') {
    const [rad, half] = pick(r, [[5, 4], [5, 3], [10, 8], [13, 12], [13, 5], [10, 6]]);
    const d = Math.sqrt(sq(rad) - sq(half));
    text = `已知 ${O} 的半径为 ${S.L ? `$${rad}$` : rad}，弦 AB 的长为 ${S.L ? `$${2 * half}$` : 2 * half}，求圆心 O 到弦 AB 的距离。`;
    cmds = ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${rad})`, `A = (${-half}, ${num(d)})`, `B = (${half}, ${num(d)})`, 'Segment(A, B)', 'H = Foot(O, Line(A, B))', 'Segment(O, H) #hl', 'Segment(O, A) #aux', 'Angle(O, H, B)', 'Text("OH = {Distance(O, H)}", (1, -1))'];
    knowns = [`半径 $${rad}$`, `弦 $AB=${2 * half}$`];
    goal = '求弦心距 $OH$';
    layout = `OH⊥AB，H 是 AB 的中点；OH=√(${rad}²-${half}²)=${num(d)}。取 O(0,0)，A(${-half},${num(d)})、B(${half},${num(d)})。`;
    insight = '垂直于弦的半径平分弦，在直角三角形 $OAH$ 中用勾股定理。';
    title = '圆的弦心距';
  } else if (kind === 'tangent') {
    const [rad, od] = pick(r, [[3, 5], [5, 13], [6, 10], [8, 10], [4, 5], [9, 15]]);
    if (rad === 3 && od === 5) return null; // 开发集
    const pa = Math.sqrt(sq(od) - sq(rad));
    const ax = (rad * rad) / od, ay = (rad * pa) / od;
    text = `已知 ${O} 的半径为 ${S.L ? `$${rad}$` : rad}，点 P 到圆心 O 的距离为 ${S.L ? `$${od}$` : od}，PA 与 ${O} 相切于点 A，求切线长 PA。`;
    cmds = ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${rad})`, `P = (${od}, 0)`, `A = (${num(ax)}, ${num(ay)})`, 'Segment(O, A)', 'Segment(O, P) #aux', 'Segment(P, A) #hl', 'Angle(O, A, P)', 'Text("PA = {Distance(P, A)}", ' + fmtPt([od / 2, rad + 1]) + ')'];
    knowns = [`半径 $${rad}$`, `$OP=${od}$`, `$PA$ 切 ${'$\\odot O$'} 于 $A$`];
    goal = '求切线长 $PA$';
    layout = `OA⊥PA，PA=√(${od}²-${rad}²)=${num(pa)}；取 O(0,0)、P(${od},0)，A(${num(ax)},${num(ay)})。`;
    insight = '切线垂直于过切点的半径，$\\triangle OAP$ 是直角三角形。';
    title = '圆的切线长';
  } else {
    const [ac, bc] = pick(r, [[6, 8], [5, 12], [3, 4], [8, 15]]);
    const ab = Math.hypot(ac, bc), R0 = ab / 2;
    const cx = (ac * ac - bc * bc) / (2 * ab), cy = (ac * bc) / ab;
    text = `如图，AB 是 ${O} 的直径，点 C 在 ${O} 上，${S.eq('AC', ac)}，${S.eq('BC', bc)}，求 ${O} 的半径。`;
    cmds = ['ShowAxes(false)', `A = (${num(-R0)}, 0)`, `B = (${num(R0)}, 0)`, 'O = Midpoint(A, B)', 'c = Circle(O, A)', `C = (${num(cx)}, ${num(cy)})`, 'Segment(A, B)', 'Segment(A, C)', 'Segment(B, C)', 'Angle(A, C, B)', 'Segment(O, C) #hl', 'Text("半径 {Distance(O, A)}", (0, ' + num(-R0 - 1) + '))'];
    knowns = [`$AB$ 是直径`, `$AC=${ac}$，$BC=${bc}$`];
    goal = '求半径';
    layout = `直径所对的圆周角是直角，AB=√(${ac}²+${bc}²)=${num(ab)}，半径 ${num(R0)}；A(${num(-R0)},0)、B(${num(R0)},0)，C(${num(cx)},${num(cy)})。`;
    insight = '直径所对的圆周角是 $90^\\circ$。';
    title = '直径所对的圆周角';
  }
  return { text, out: out({ title, category: '平面几何', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 直线与圆 ----------
export function circleLine(r, S) {
  const a = int(r, -3, 3), b = int(r, -3, 3), R = pick(r, [1, 2, 3, 2, 5]);
  const k = pick(r, [1, -1, 2, 0, 1 / 2]), m = int(r, -3, 4);
  if (a === 1 && b === -2 && R === 2) return null; // 开发集
  const circ = `(x ${a >= 0 ? '-' : '+'} ${Math.abs(a)})^2 + (y ${b >= 0 ? '-' : '+'} ${Math.abs(b)})^2 = ${R * R}`.replace('(x - 0)', 'x').replace('(y - 0)', 'y');
  const lineE = `y = ${poly([k, m])}`;
  const d = Math.abs(k * a - b + m) / Math.hypot(k, 1);
  const rel = Math.abs(d - R) < 1e-9 ? '相切' : d < R ? '相交' : '相离';
  const text = S.ja ? `円 ${S.m(circ)} と直線 ${S.m(lineE)} の位置関係を調べよ。`
    : `已知圆 C：${S.m(circ)}，直线 l：${S.m(lineE)}，判断直线 l 与圆 C 的位置关系${rel === '相交' ? '，若相交，求弦长' : ''}。`;
  const cmds = [`M = (${a}, ${b}) "圆心"`, `C: ${circ}`, `l: ${lineE}`, 'H = Foot(M, l)', 'Segment(M, H) #aux', 'Angle(M, H, H + (1, ' + num(k) + '))'];
  cmds.pop();
  if (rel !== '相离') cmds.push('A = Intersect(C, l, 1)', 'B = Intersect(C, l, 2)');
  if (rel === '相交') cmds.push('Segment(A, B) #hl');
  cmds.push(`Text("d = {Distance(M, H)}，r = ${R}", (${a - R}, ${b + R + 1}))`);
  return {
    text,
    out: out({
      title: '直线与圆的位置关系', category: '解析几何',
      knowns: [T(circ), T(lineE)], goal: rel === '相交' ? '判断位置关系，求弦长' : '判断位置关系',
      layout: `圆心 (${a},${b})，半径 ${R}；圆心到直线的距离 d=|${num(k)}·${a}-(${b})+${m}|/√(${num(k)}²+1)=${num(d)}，${d < R ? 'd<r，相交' : Math.abs(d - R) < 1e-9 ? 'd=r，相切' : 'd>r，相离'}。`,
      commands: cmds, insight: '比较圆心到直线的距离 $d$ 和半径 $r$。',
    }),
  };
}

// ---------- 圆锥曲线 ----------
export function conic(r, S) {
  const kind = pick(r, ['ellipse', 'hyperbola', 'parabola']);
  let text, cmds, knowns, goal, layout, insight, title;
  if (kind === 'ellipse') {
    const [A2, B2] = pick(r, [[4, 3], [9, 5], [25, 16], [16, 12], [8, 4], [9, 8]]);
    const c = Math.sqrt(A2 - B2);
    const e = `x^2/${A2} + y^2/${B2} = 1`;
    const k = pick(r, [1, -1, 1 / 2, 2]), m = pick(r, [0, 1, -1, 2]);
    if (A2 === 4 && B2 === 3 && k === 1) return null; // 开发集
    const l = `y = ${poly([k, m])}`;
    const ask = pick(r, ['chord', 'foci', 'chordSlider']);
    title = '椭圆与直线';
    if (ask === 'foci') {
      text = `已知椭圆 ${S.m(e)}，${S.L ? '$F_1$、$F_2$' : 'F₁、F₂'} 是它的两个焦点，点 P 在椭圆上，求 △PF₁F₂ 的周长。`.replace('△PF₁F₂', S.L ? '$\\triangle PF_1F_2$' : '△PF₁F₂');
      cmds = [`E: ${e}`, `F1 = (${num(-c)}, 0)`, `F2 = (${num(c)}, 0)`, `P = Point(E, (${num(Math.sqrt(A2) / 2)}, ${num(Math.sqrt(B2 * 0.75))}))`, 'Polygon(P, F1, F2) #hl', 'Text("周长 {Distance(P, F1) + Distance(P, F2) + Distance(F1, F2)}", (' + num(-Math.sqrt(A2)) + ', ' + num(Math.sqrt(B2) + 1) + '))'];
      goal = '求 $\\triangle PF_1F_2$ 的周长';
      layout = `a=${surd(Math.sqrt(A2))}，b=${surd(Math.sqrt(B2))}，c=√(a²-b²)=${surd(c)}；焦点 (±${surd(c)},0)；周长 = 2a+2c。`;
      insight = '拖动点 $P$：$|PF_1|+|PF_2|$ 始终等于 $2a$，周长不变。';
      knowns = [T(e)];
    } else {
      const slider = ask === 'chordSlider';
      text = slider ? `已知椭圆 C：${S.m(e)}，直线 l：${S.m(`y = ${poly([k, 0])} + m`)} 与椭圆 C 交于 A、B 两点，讨论弦 AB 的长随 m 的变化。`
        : `已知椭圆 C：${S.m(e)}，直线 l：${S.m(l)} 与椭圆交于 A、B 两点，求弦长 |AB|。`;
      cmds = slider
        ? ['m = Slider(-3, 3, 1)', `E: ${e}`, `l: y = ${poly([k, 0])} + m`, 'A = Intersect(E, l, 1)', 'B = Intersect(E, l, 2)', 'Segment(A, B) #hl', `F1 = (${num(-c)}, 0) #aux`, `F2 = (${num(c)}, 0) #aux`, 'Text("|AB| = {Distance(A, B)}", (' + num(-Math.sqrt(A2)) + ', ' + num(Math.sqrt(B2) + 1) + '))']
        : [`E: ${e}`, `l: ${l}`, 'A = Intersect(E, l, 1)', 'B = Intersect(E, l, 2)', 'Segment(A, B) #hl', 'Text("|AB| = {Distance(A, B)}", (' + num(-Math.sqrt(A2)) + ', ' + num(Math.sqrt(B2) + 1) + '))'];
      goal = slider ? '研究弦长与 $m$ 的关系' : '求弦长 $|AB|$';
      layout = `联立直线和椭圆，消去 y 得关于 x 的一元二次方程，用韦达定理和弦长公式 |AB|=√(1+k²)|x₁-x₂|。`;
      insight = slider ? '拖动滑块 $m$，直线上下平移；与椭圆相切时弦长变为 $0$。' : '交点由程序算出，可以和弦长公式的结果对照。';
      knowns = [T(e), slider ? T(`y=${poly([k, 0])}+m`) : T(l)];
    }
  } else if (kind === 'hyperbola') {
    const [A2, B2] = pick(r, [[4, 5], [9, 16], [4, 12], [1, 3], [16, 9]]);
    const a = Math.sqrt(A2), b = Math.sqrt(B2), c = Math.sqrt(A2 + B2);
    const e = `x^2/${A2} - y^2/${B2} = 1`;
    text = `求双曲线 ${S.m(e)} 的焦点坐标、离心率和渐近线方程。`;
    const kk = b / a;
    const kText = Number.isInteger(kk) ? num(kk) : Number.isInteger(B2 / A2) ? `sqrt(${B2 / A2})` : `${surd(b).replace('√', 'sqrt(').replace(/sqrt\((\d+)$/, 'sqrt($1)')}/${surd(a)}`;
    cmds = [`H: ${e}`, `F1 = (${num(-c)}, 0) "F1"`, `F2 = (${num(c)}, 0) "F2"`, `l1: y = ${num(kk)}x #aux`, `l2: y = ${num(-kk)}x #aux`, `V1 = (${num(-a)}, 0)`, `V2 = (${num(a)}, 0)`];
    knowns = [T(e)];
    goal = '求焦点、离心率、渐近线';
    layout = `a=${surd(a)}，b=${surd(b)}，c=√(a²+b²)=${surd(c)}；焦点 (±${surd(c)},0)，e=c/a=${num(c / a)}，渐近线 y=±(b/a)x=±${num(kk)}x。`;
    insight = '双曲线越往外越贴近两条渐近线。';
    title = '双曲线的焦点和渐近线';
    void kText;
  } else {
    const p2 = pick(r, [4, 8, 2, 12]); // y^2 = p2 x，焦点 (p2/4, 0)
    const f = p2 / 4;
    const k = pick(r, [1, 2, -1]);
    const e = `y^2 = ${p2}x`;
    const l = `y = ${poly([k, -k * f])}`;
    text = `已知抛物线 ${S.m(e)} 的焦点为 F，过 F 且斜率为 ${k} 的直线与抛物线交于 A、B 两点，求 |AB|。`;
    cmds = [`C: ${e}`, `F = (${num(f)}, 0) "F"`, `l: ${l}`, 'A = Intersect(C, l, 1)', 'B = Intersect(C, l, 2)', 'Segment(A, B) #hl', `d: x = ${num(-f)} #aux`, 'Text("|AB| = {Distance(A, B)}", (' + num(f + 1) + ', ' + num(-p2 / 2) + '))'];
    knowns = [T(e), `焦点 $F$，直线斜率 $${k}$`];
    goal = '求弦长 $|AB|$';
    layout = `焦点 F(${num(f)},0)，准线 x=${num(-f)}；直线 ${l.replace(/ /g, '')}；焦点弦长 |AB|=x₁+x₂+p。`;
    insight = '抛物线上的点到焦点的距离等于它到准线的距离。';
    title = '抛物线的焦点弦';
  }
  return { text, out: out({ title, category: '解析几何', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 立体几何 ----------
export function solid(r, S) {
  const kind = pick(r, ['cube', 'cube', 'cuboid', 'pyramid', 'round']);
  const cubeEdges = ['Segment(A, B)', 'Segment(B, C)', 'Segment(C, D)', 'Segment(D, A)', 'Segment(A1, B1)', 'Segment(B1, C1)', 'Segment(C1, D1)', 'Segment(D1, A1)', 'Segment(A, A1)', 'Segment(B, B1)', 'Segment(C, C1)', 'Segment(D, D1)'];
  const name = S.L ? '$ABCD-A_1B_1C_1D_1$' : 'ABCD-A₁B₁C₁D₁';
  const nm = (s) => (S.L ? `$${subTex(s)}$` : s.replace(/([A-Z])1/g, '$1₁'));
  let text, cmds, knowns, goal, layout, insight, title;
  if (kind === 'cube' || kind === 'cuboid') {
    const [a, b, c] = kind === 'cube' ? Array(3).fill(pick(r, [2, 2, 4, 1, 6])) : [pick(r, [2, 3, 4]), pick(r, [3, 4, 2]), pick(r, [2, 5, 3])];
    const pts = { D: [0, 0, 0], A: [a, 0, 0], B: [a, b, 0], C: [0, b, 0], D1: [0, 0, c], A1: [a, 0, c], B1: [a, b, c], C1: [0, b, c] };
    const base = Object.entries(pts).map(([n, p]) => `${n} = ${fmtPt(p)}`).concat(cubeEdges);
    const head = kind === 'cube' ? `在棱长为 ${S.L ? `$${a}$` : a} 的正方体 ${name} 中` : `在长方体 ${name} 中，${S.eq('AB', b)}，${S.eq('AD', a)}，${S.eq(subTex('AA1').replace('_1', '₁'), c).replace('A_1', 'A₁')}`;
    let headTxt = head;
    if (kind === 'cuboid') headTxt = S.L ? `在长方体 ${name} 中，$AB=${b}$，$AD=${a}$，$AA_1=${c}$` : `在长方体 ${name} 中，AB = ${b}，AD = ${a}，AA₁ = ${c}`;
    const ask = pick(r, kind === 'cube' ? ['mid', 'diag', 'skew'] : ['diag', 'mid']);
    title = kind === 'cube' ? '正方体' : '长方体';
    if (ask === 'diag') {
      text = `${headTxt}，求对角线 ${nm('BD1')} 的长${kind === 'cube' ? '，以及它与底面所成角的正切值' : ''}。`;
      cmds = [...base, 'Segment(B, D1) #hl', 'Segment(B, D) #aux', 'Angle(D1, B, D) "θ"', 'Text("BD1 = {Distance(B, D1)}", (0, 0, ' + num(c + 1) + '))'];
      goal = '求体对角线的长';
      layout = `以 D 为原点，DA、DC、DD1 为 x、y、z 轴；B(${a},${b},0)、D1(0,0,${c})，BD1=√(${a}²+${b}²+${c}²)=${surd(Math.sqrt(a * a + b * b + c * c))}。`;
      insight = '体对角线、底面对角线和侧棱组成直角三角形。';
      knowns = [kind === 'cube' ? `正方体棱长 $${a}$` : `$AB=${b}$，$AD=${a}$，$AA_1=${c}$`];
    } else if (ask === 'mid') {
      const edge = pick(r, [['B', 'B1', 'E'], ['C', 'C1', 'E'], ['A1', 'B1', 'E'], ['D1', 'C1', 'F']]);
      text = `${headTxt}，${edge[2]} 为棱 ${nm(edge[0] + edge[1])} 的中点，求 ${nm('A' + edge[2])} 的长。`.replace(/A([EF])/g, (m0) => m0);
      cmds = [...base, `${edge[2]} = Midpoint(${edge[0]}, ${edge[1]})`, `Segment(A, ${edge[2]}) #hl`, `Text("A${edge[2]} = {Distance(A, ${edge[2]})}", (0, 0, ${num(c + 1)}))`];
      goal = `求 $A${edge[2]}$ 的长`;
      const M = pts[edge[0]].map((v, i) => (v + pts[edge[1]][i]) / 2);
      layout = `以 D 为原点建系；${edge[2]} 是 ${edge[0]}${edge[1]} 的中点，${edge[2]}${fmtPt(M).replace(/ /g, '')}，A(${a},0,0)。`;
      insight = '空间中两点的距离可以用坐标直接算。';
      knowns = [kind === 'cube' ? `正方体棱长 $${a}$` : `$AB=${b}$，$AD=${a}$，$AA_1=${c}$`, `$${edge[2]}$ 为 $${subTex(edge[0] + edge[1])}$ 的中点`];
    } else {
      text = `${headTxt}，求异面直线 ${nm('A1B')} 与 ${nm('B1C')} 所成的角。`;
      cmds = [...base, 'Segment(A1, B) #hl', 'Segment(B1, C) #hl', 'Segment(A1, D) #aux', 'Segment(B, D) #aux', 'Angle(B, A1, D) "θ"'];
      goal = '求异面直线所成的角';
      layout = `以 D 为原点建系；B1C∥A1D，所以所求角等于 ∠BA1D；△A1BD 是等边三角形，角为 60°。`;
      insight = '把一条直线平移到与另一条相交，再看夹角。';
      knowns = [`正方体棱长 $${a}$`];
    }
  } else if (kind === 'pyramid') {
    const s = pick(r, [2, 4, 6]), h = pick(r, [2, 3, 4, 6]);
    const P = [s / 2, s / 2, h];
    text = `正四棱锥 P-ABCD 的底面边长为 ${S.L ? `$${s}$` : s}，高为 ${S.L ? `$${h}$` : h}，求侧棱 PA 的长和四棱锥的体积。`;
    cmds = [`A = (${s}, 0, 0)`, `B = (${s}, ${s}, 0)`, `C = (0, ${s}, 0)`, 'D = (0, 0, 0)', `P = ${fmtPt(P)}`, 'Polygon(A, B, C, D)', 'Segment(P, A)', 'Segment(P, B)', 'Segment(P, C)', 'Segment(P, D)',
      'O = Midpoint(A, C)', 'Segment(P, O) #aux', 'Segment(O, A) #aux', 'Angle(P, O, A)', 'Segment(P, A) #hl', 'Text("PA = {Distance(P, A)}", (0, 0, ' + num(h + 1) + '))'];
    knowns = [`底面边长 $${s}$，高 $${h}$`];
    goal = '求侧棱长和体积';
    layout = `底面中心 O(${num(s / 2)},${num(s / 2)},0)，P(${num(s / 2)},${num(s / 2)},${h})；OA=${surd(s / Math.SQRT2)}，PA=√(${h}²+OA²)=${surd(Math.sqrt(h * h + s * s / 2))}；V=⅓·${s}²·${h}=${num((s * s * h) / 3)}。`;
    insight = '高、底面中心到顶点的连线和侧棱组成直角三角形。';
    title = '正四棱锥';
  } else {
    const shape = pick(r, ['cone', 'cylinder', 'sphere']);
    const rad = pick(r, [1, 2, 3]), h = pick(r, [3, 4, 5]);
    if (shape === 'cylinder' && rad === 2 && h === 5) return null; // 开发集
    if (shape === 'cone') {
      const l = Math.hypot(rad, h);
      text = `一个圆锥的底面半径为 ${S.L ? `$${rad}$` : rad}，高为 ${S.L ? `$${h}$` : h}，求它的母线长、侧面积和体积。`;
      cmds = [`O = (0, 0, 0)`, `P = (0, 0, ${h})`, `Cone(O, P, ${rad})`, `A = (${rad}, 0, 0)`, 'Segment(P, A) #hl', 'Segment(O, A) #aux', 'Segment(O, P) #aux', 'Angle(P, O, A)', 'Text("母线 {Distance(P, A)}", (0, 0, ' + num(h + 1) + '))'];
      knowns = [`底面半径 $${rad}$，高 $${h}$`];
      goal = '求母线长、侧面积和体积';
      layout = `母线 l=√(${rad}²+${h}²)=${surd(l)}；S侧=πrl，V=⅓πr²h。`;
      insight = '高、底面半径和母线组成直角三角形。';
      title = '圆锥';
    } else if (shape === 'cylinder') {
      text = `一个圆柱的底面半径为 ${S.L ? `$${rad}$` : rad}，高为 ${S.L ? `$${h}$` : h}，求它的侧面积和体积。`;
      cmds = [`O = (0, 0, 0)`, `O1 = (0, 0, ${h})`, `Cylinder(O, O1, ${rad})`, `A = (${rad}, 0, 0)`, `A1 = (${rad}, 0, ${h})`, 'Segment(A, A1) #hl', 'Segment(O, A) #aux', 'Segment(O, O1) #aux'];
      knowns = [`底面半径 $${rad}$，高 $${h}$`];
      goal = '求侧面积和体积';
      layout = `S侧=2πrh=${2 * rad * h}π，V=πr²h=${rad * rad * h}π。`;
      insight = '侧面展开是一个长为 $2\\pi r$、宽为 $h$ 的矩形。';
      title = '圆柱';
    } else {
      text = `球的半径为 ${S.L ? `$${rad + 2}$` : rad + 2}，一个平面截球得到的截面圆半径为 ${S.L ? `$${rad + 1}$` : rad + 1}，求球心到截面的距离。`;
      const R0 = rad + 2, r0 = rad + 1, d = Math.sqrt(R0 * R0 - r0 * r0);
      cmds = ['O = (0, 0, 0)', `Sphere(O, ${R0}) #aux`, `M = (0, 0, ${num(d)})`, `A = (${r0}, 0, ${num(d)})`, 'Segment(O, M) #hl', 'Segment(M, A)', 'Segment(O, A) #aux', 'Angle(O, M, A)', 'Text("OM = {Distance(O, M)}", (0, 0, ' + num(R0 + 1) + '))'];
      knowns = [`球半径 $${R0}$`, `截面圆半径 $${r0}$`];
      goal = '求球心到截面的距离';
      layout = `球心到截面的距离 d=√(R²-r²)=√(${R0}²-${r0}²)=${surd(d)}。`;
      insight = '球心、截面圆心和截面圆上一点组成直角三角形。';
      title = '球的截面';
    }
  }
  return { text, out: out({ title, category: '立体几何', knowns, goal, layout, commands: cmds, insight }) };
}
