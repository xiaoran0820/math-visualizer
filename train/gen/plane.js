// 平面几何：三角形、四边形、圆。
// 第二版（2026-11-11）：需要开方、三角函数才能算出的坐标一律写成算式（sqrt(5^2 - 3^2)、4cos(60°)），
// 或者用作图命令确定（两个圆的交点），由程序计算。第一版里这些坐标是算好的数，模型换一组数字就要自己做算术——
// 开发集上平行四边形那道题就是把 4·cos 60° 算错了。
import { pick, int, num, out } from './util.js';

const sq = (x) => x * x;
const fmtPt = (p) => `(${p.map(num).join(', ')})`;
// 数值 → 文字（整数、整数的平方根）
export function surd(x) {
  if (Math.abs(x - Math.round(x)) < 1e-9) return num(x);
  const s = Math.round(x * x);
  if (Math.abs(x * x - s) < 1e-6) {
    for (let k = Math.floor(Math.sqrt(s)); k > 1; k--) if (s % (k * k) === 0) return `${k}√${s / (k * k)}`;
    return `√${s}`;
  }
  return num(x);
}
// k√n 写成作图命令里的算式：5 → 5，2√13 → 2sqrt(13)
function surdExpr(x) {
  const m = /^(\d*)√(\d+)$/.exec(surd(x));
  return m ? `${m[1]}sqrt(${m[2]})` : surd(x);
}
const surdTex = (x) => surd(x).replace(/(\d*)√(\d+)/, (_, k, n) => `${k}\\sqrt{${n}}`);

// ---------- 三角形：等腰、直角、等边、一般三角形里的中点、垂足、角平分线、中线、重心 ----------
export function triangle(r, S) {
  const kind = pick(r, ['iso', 'iso', 'right', 'right', 'eq', 'gen']);
  const tri = S.tri('ABC');
  let A, cA, cB, cC, knowns, layout, head, cx;
  if (kind === 'iso') {
    const half = int(r, 2, 8), leg = half + int(r, 1, 6), base = 2 * half;
    A = [0, Math.sqrt(sq(leg) - sq(half))]; cx = half;
    cB = `B = (${-half}, 0)`; cC = `C = (${half}, 0)`; cA = `A = (0, sqrt(${leg}^2 - ${half}^2))`;
    head = `在 ${tri} 中，${S.L ? `$AB=AC=${leg}$，$BC=${base}$` : `AB = AC = ${leg}，BC = ${base}`}`;
    knowns = [`$AB=AC=${leg}$，$BC=${base}$`];
    layout = `取 BC 中点为原点，B(${-half},0)、C(${half},0)；等腰三角形的高 AD=√(${leg}²-${half}²)，所以 A(0, √(${leg}²-${half}²))，写成算式由程序计算。`;
  } else if (kind === 'right') {
    const a = int(r, 3, 12), b = int(r, 3, 12);
    A = [b, a]; cx = b;
    cB = 'B = (0, 0)'; cC = `C = (${b}, 0)`; cA = `A = (${b}, ${a})`;
    head = `在 ${S.rt('ABC')} 中，${S.L ? `$\\angle C=90^\\circ$，$AC=${a}$，$BC=${b}$` : `∠C = 90°，AC = ${a}，BC = ${b}`}`;
    knowns = ['$\\angle C=90^\\circ$', `$AC=${a}$，$BC=${b}$`];
    layout = `取 B(0,0)、C(${b},0)，∠C=90°，A 在 C 的正上方，A(${b},${a})。`;
  } else if (kind === 'eq') {
    const s = pick(r, [2, 4, 6, 8, 10, 12]);
    A = [0, (s * Math.sqrt(3)) / 2]; cx = s / 2;
    cB = `B = (${-s / 2}, 0)`; cC = `C = (${s / 2}, 0)`; cA = `A = (0, ${s}*sqrt(3)/2)`;
    head = `已知等边 ${tri} 的边长为 ${S.L ? `$${s}$` : s}`;
    knowns = [`等边三角形，边长 $${s}$`];
    layout = `B(${-s / 2},0)、C(${s / 2},0)；等边三角形的高是边长的 √3/2 倍，A(0, ${s}·√3/2)，写成算式由程序计算。`;
  } else {
    // 一般三角形：BC = a，CA = b，AB = c（取锐角三角形，A 落在 BC 的上方）
    const a = int(r, 6, 15), b = int(r, 5, 14), c = int(r, 5, 14);
    if (!(sq(a) + sq(b) > sq(c) && sq(a) + sq(c) > sq(b) && sq(b) + sq(c) > sq(a)) || b === c) return null;
    const x = (sq(c) - sq(b) + sq(a)) / (2 * a);
    A = [x, Math.sqrt(sq(c) - x * x)]; cx = a;
    cB = 'B = (0, 0)'; cC = `C = (${a}, 0)`; cA = `A = Intersect(Circle(B, ${c}), Circle(C, ${b}), 2)`;
    head = `在 ${tri} 中，${S.L ? `$AB=${c}$，$BC=${a}$，$CA=${b}$` : `AB = ${c}，BC = ${a}，CA = ${b}`}`;
    knowns = [`$AB=${c}$，$BC=${a}$，$CA=${b}$`];
    layout = `取 B(0,0)、C(${a},0)；A 到 B 的距离是 ${c}、到 C 的距离是 ${b}：以 B、C 为圆心各画一个圆，取上方的交点，由程序计算。`;
  }
  const base = ['ShowAxes(false)', cB, cC, cA, 'Polygon(A, B, C)'];
  if (kind === 'iso') base.push('Segment(A, B) #eq1', 'Segment(A, C) #eq1');
  if (kind === 'right') base.push('Angle(A, C, B)');
  const top = Math.round((A[1] + 0.8) * 10) / 10;
  const at = fmtPt([Math.round(cx * 6) / 10 + 0.3, top]);
  const atLeft = fmtPt([0.5, top]);
  const ask = pick(r, kind === 'right' ? ['median', 'altitude', 'foot', 'bisector'] : ['foot', 'median', 'altitude', 'bisector', 'centroid', 'centroid', 'orthocenter']);
  let text, goal, cmds, insight, title;
  if (ask === 'orthocenter') {
    text = `${head}，三条高交于点 H，求 AH 的长。`;
    cmds = [...base, 'H = Orthocenter(A, B, C) #result', 'D = Foot(A, Line(B, C))', 'E = Foot(B, Line(A, C))', 'Segment(A, D) #aux', 'Segment(B, E) #aux', 'Segment(A, H) #hl', `Text("AH = {Distance(A, H)}", ${at})`];
    goal = '求 $AH$ 的长';
    title = '三角形的垂心';
    insight = '三条高交于一点，这个点叫垂心。';
  } else if (ask === 'foot') {
    text = `${S.L ? '如图，' : pick(r, ['如图，', ''])}${head}，D 为 BC 的中点，${S.perp('DE', 'AC')} 于点 E，求 DE 的长。`;
    cmds = [...base, 'D = Midpoint(B, C)', ...(kind === 'iso' || kind === 'eq' ? ['Segment(A, D) #aux'] : []), 'E = Foot(D, Line(A, C))', 'Segment(D, E) #hl', 'Angle(D, E, C)', `Text("DE = {Distance(D, E)}", ${at})`];
    goal = '求 $DE$ 的长';
    title = '三角形中的垂线段';
    insight = kind === 'iso' || kind === 'eq' ? '等腰三角形三线合一，$AD\\perp BC$；用面积法求 $DE$。' : '$DE$ 是点 $D$ 到 $AC$ 的距离，可以用面积法。';
  } else if (ask === 'median') {
    text = `${head}，${kind === 'right' ? '点 D 是斜边 AB 的中点，求 CD 的长' : 'AD 是 BC 边上的中线，求 AD 的长'}。`;
    cmds = kind === 'right'
      ? [...base, 'D = Midpoint(A, B)', 'Segment(C, D) #hl', 'Segment(A, D) #eq2', 'Segment(D, B) #eq2', `Text("CD = {Distance(C, D)}", ${atLeft})`]
      : [...base, 'D = Midpoint(B, C)', 'Segment(A, D) #hl', 'Segment(B, D) #eq2', 'Segment(D, C) #eq2', `Text("AD = {Distance(A, D)}", ${at})`];
    goal = kind === 'right' ? '求斜边上的中线 $CD$ 的长' : '求中线 $AD$ 的长';
    title = '三角形的中线';
    insight = kind === 'right' ? '直角三角形斜边上的中线等于斜边的一半。' : '中线把底边分成相等的两段。';
  } else if (ask === 'altitude') {
    text = `${head}，${kind === 'right' ? `${S.perp('CH', 'AB')} 于点 H，求 CH 的长` : `${S.perp('AH', 'BC')} 于点 H，求 AH 的长`}。`;
    cmds = kind === 'right'
      ? [...base, 'H = Foot(C, Line(A, B))', 'Segment(C, H) #hl', 'Angle(C, H, B)', `Text("CH = {Distance(C, H)}", ${atLeft})`]
      : [...base, 'H = Foot(A, Line(B, C))', 'Segment(A, H) #hl', 'Angle(A, H, C)', `Text("AH = {Distance(A, H)}", ${at})`];
    goal = `求 ${kind === 'right' ? 'AB' : 'BC'} 边上的高`;
    title = '三角形的高';
    insight = '用两种方法表示面积，就能求出高。';
  } else if (ask === 'bisector') {
    text = `${head}，${kind === 'right' ? 'CD 平分 ∠ACB 交 AB 于点 D，求 CD 的长' : 'AD 平分 ∠BAC 交 BC 于点 D，求 BD 的长'}。`;
    if (S.L) text = text.replace('∠ACB', '$\\angle ACB$').replace('∠BAC', '$\\angle BAC$');
    cmds = kind === 'right'
      ? [...base, 'D = Intersect(AngleBisector(A, C, B), Line(A, B))', 'Segment(C, D) #hl', 'Angle(A, C, D) "α"', 'Angle(D, C, B) "α"', `Text("CD = {Distance(C, D)}", ${atLeft})`]
      : [...base, 'D = Intersect(AngleBisector(B, A, C), Line(B, C))', 'Segment(A, D) #hl', 'Angle(B, A, D) "α"', 'Angle(D, A, C) "α"', 'Segment(B, D) #result', `Text("BD = {Distance(B, D)}", ${at})`];
    goal = kind === 'right' ? '求角平分线 $CD$ 的长' : '求 $BD$ 的长';
    title = '三角形的角平分线';
    insight = '角平分线把对边分成的两段，与两条邻边成比例。';
  } else {
    text = `${head}，G 是 ${tri} 的重心，求 AG 的长。`;
    cmds = [...base, 'D = Midpoint(B, C)', 'Segment(A, D) #aux', 'G = Centroid(A, B, C) #result', 'Segment(A, G) #hl', `Text("AG = {Distance(A, G)}", ${at})`];
    goal = '求 $AG$ 的长';
    title = '三角形的重心';
    insight = '重心在中线上，把中线分成 $2:1$ 两段。';
  }
  return { text, out: out({ title, category: '平面几何', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 四边形：矩形、平行四边形、菱形、正方形、梯形 ----------
export function quadrilateral(r, S) {
  const kind = pick(r, ['rect', 'para', 'para', 'rhombus', 'square', 'trap']);
  let base, knowns, layout, head, title, W, H;
  if (kind === 'rect') {
    const h = int(r, 3, 8), w = h + int(r, 1, 6);
    W = w; H = h;
    base = [`A = (0, ${h})`, 'B = (0, 0)', `C = (${w}, 0)`, `D = (${w}, ${h})`];
    head = `在矩形 ABCD 中，${S.eq('AB', h)}，${S.eq('BC', w)}`;
    knowns = [`矩形 $ABCD$，$AB=${h}$，$BC=${w}$`];
    layout = `B(0,0)、C(${w},0)、A(0,${h})、D(${w},${h})。`;
    title = '矩形中的线段';
  } else if (kind === 'para') {
    const a = int(r, 5, 10), b = int(r, 3, 7), ang = pick(r, [60, 45, 30, 120, 135, 150]);
    W = a; H = b * Math.sin((ang * Math.PI) / 180);
    base = ['A = (0, 0)', `B = (${a}, 0)`, `D = (${b}cos(${ang}°), ${b}sin(${ang}°))`, 'C = B + D - A'];
    head = `在平行四边形 ABCD 中，${S.eq('AB', a)}，${S.eq('AD', b)}，${S.ang('A', ang)}`;
    knowns = [`$AB=${a}$，$AD=${b}$，$\\angle A=${ang}^\\circ$`];
    layout = `A(0,0)、B(${a},0)；AD=${b} 且 ∠A=${ang}°，所以 D(${b}cos${ang}°, ${b}sin${ang}°)，写成算式由程序计算；C=B+D-A。`;
    title = '平行四边形的对角线';
  } else if (kind === 'rhombus') {
    const d1 = 2 * int(r, 2, 8), d2 = 2 * int(r, 2, 8);
    if (d1 === d2) return null;
    W = d1 / 2; H = d2 / 2;
    base = [`A = (${-d1 / 2}, 0)`, `B = (0, ${-d2 / 2})`, `C = (${d1 / 2}, 0)`, `D = (0, ${d2 / 2})`];
    head = `菱形 ABCD 的两条对角线 ${S.eq('AC', d1)}，${S.eq('BD', d2)}`;
    knowns = [`菱形 $ABCD$，$AC=${d1}$，$BD=${d2}$`];
    layout = `对角线互相垂直平分：以交点 O 为原点，A(${-d1 / 2},0)、C(${d1 / 2},0)、B(0,${-d2 / 2})、D(0,${d2 / 2})。`;
    title = '菱形的边长与面积';
  } else if (kind === 'square') {
    const s = int(r, 2, 10);
    W = s; H = s;
    base = [`A = (0, ${s})`, 'B = (0, 0)', `C = (${s}, 0)`, `D = (${s}, ${s})`];
    head = `正方形 ABCD 的边长为 ${S.L ? `$${s}$` : s}`;
    knowns = [`正方形 $ABCD$，边长 $${s}$`];
    layout = `B(0,0)、C(${s},0)、D(${s},${s})、A(0,${s})。`;
    title = '正方形中的线段';
  } else {
    // 等腰梯形：AD ∥ BC，AD 是上底
    const top = int(r, 2, 6), off = int(r, 1, 4), h = int(r, 2, 6), bot = top + 2 * off;
    const leg = Math.hypot(off, h);
    const legE = surdExpr(leg);
    W = bot; H = h;
    base = ['B = (0, 0)', `C = (${bot}, 0)`, `h = sqrt(${/sqrt/.test(legE) ? `(${legE})` : legE}^2 - ${off}^2)`, `A = (${off}, h)`, `D = (${off + top}, h)`];
    head = S.L ? `在等腰梯形 $ABCD$ 中，$AD\\parallel BC$，$AD=${top}$，$BC=${bot}$，$AB=CD=${surdTex(leg)}$` : `在等腰梯形 ABCD 中，AD∥BC，AD = ${top}，BC = ${bot}，AB = CD = ${surd(leg)}`;
    knowns = [`$AD\\parallel BC$，$AD=${top}$，$BC=${bot}$`, `腰长 $${surdTex(leg)}$`];
    layout = `B(0,0)、C(${bot},0)；腰在底边上的投影是 (${bot}-${top})/2=${off}，高 h=√(腰²-${off}²)，写成算式由程序计算；A(${off},h)、D(${off + top},h)。`;
    title = '等腰梯形的高';
  }
  const cmds0 = ['ShowAxes(false)', ...base, 'Polygon(A, B, C, D)'];
  const at = (x, y) => fmtPt([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  let text, goal, cmds, insight;
  if (kind === 'rect' || kind === 'square') {
    const e = int(r, 1, Math.max(1, W - 1));
    text = pick(r, [
      `${head}，点 E 在边 BC 上，且 ${S.eq('BE', e)}，连接 AE，过点 D 作 ${S.perp('DF', 'AE')} 于点 F，求 DF 的长。`,
      `如图，${head}，E 是 BC 上一点，${S.eq('BE', e)}，${S.perp('DF', 'AE')}，垂足为 F。求点 D 到直线 AE 的距离。`,
      `${head}，E 为 BC 边上的点，${S.eq('BE', e)}。作 ${S.perp('DF', 'AE')} 交 AE 于 F，求线段 DF 的长度。`,
    ]);
    cmds = [...cmds0, `E = (${e}, 0)`, 'Segment(A, E)', 'F = Foot(D, Line(A, E))', 'Segment(D, F) #hl', 'Angle(D, F, A)', `Text("DF = {Distance(D, F)}", ${at(W / 2, H + 0.8)})`];
    goal = '求 $DF$ 的长';
    insight = '$\\triangle ABE$ 与 $\\triangle DFA$ 相似，或者用面积法。';
  } else if (kind === 'para') {
    text = pick(r, [`${head}，求对角线 BD 和 AC 的长。`, `${head}，求对角线 BD 的长。`]);
    cmds = [...cmds0, 'Segment(B, D) #hl', 'Segment(A, C) #hl', 'Angle(B, A, D)', `Text("BD = {Distance(B, D)}，AC = {Distance(A, C)}", ${at(0, H + 1)})`];
    goal = '求对角线的长';
    insight = '在 $\\triangle ABD$、$\\triangle ABC$ 中用余弦定理。';
  } else if (kind === 'rhombus') {
    text = `${head}，求菱形的边长和面积。`;
    cmds = [...cmds0, 'O = Midpoint(A, C)', 'Segment(A, C) #aux', 'Segment(B, D) #aux', 'Angle(C, O, D)', 'Segment(A, B) #hl', `Text("边长 {Distance(A, B)}，面积 {Area(Polygon(A, B, C, D))}", ${at(-W, H + 1)})`];
    goal = '求边长和面积';
    insight = '菱形的对角线互相垂直平分，面积等于对角线乘积的一半。';
  } else {
    text = `${head}，求梯形的高和面积。`;
    cmds = [...cmds0, 'H = Foot(A, Line(B, C))', 'Segment(A, H) #hl', 'Angle(A, H, C)', 'Segment(A, B) #eq1', 'Segment(C, D) #eq1', `Text("高 {Distance(A, H)}，面积 {Area(Polygon(A, B, C, D))}", ${at(0, H + 1)})`];
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
  const n = (x) => (S.L ? `$${x}$` : x);
  if (kind === 'chord') {
    const rad = int(r, 3, 13), half = int(r, 1, rad - 1);
    text = pick(r, [
      `已知 ${O} 的半径为 ${n(rad)}，弦 AB 的长为 ${n(2 * half)}，求圆心 O 到弦 AB 的距离。`,
      `${O} 的半径是 ${n(rad)}，弦 ${S.eq('AB', 2 * half)}，${S.perp('OH', 'AB')} 于点 H，求 OH 的长。`,
    ]);
    cmds = ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${rad})`, `d = sqrt(${rad}^2 - ${half}^2)`, `A = (${-half}, d)`, `B = (${half}, d)`, 'Segment(A, B)', 'H = Midpoint(A, B)', 'Segment(O, H) #hl', 'Segment(O, A) #aux', 'Angle(O, H, B)', 'Text("OH = {Distance(O, H)}", (1, -1))'];
    knowns = [`半径 $${rad}$`, `弦 $AB=${2 * half}$`];
    goal = '求弦心距 $OH$';
    layout = `OH⊥AB，H 是 AB 的中点，AH=${half}；弦心距 d=√(${rad}²-${half}²)，写成算式由程序计算。取 O(0,0)，A(${-half},d)、B(${half},d)。`;
    insight = '垂直于弦的半径平分弦，在直角三角形 $OAH$ 中用勾股定理。';
    title = '圆的弦心距';
  } else if (kind === 'tangent') {
    const rad = int(r, 2, 9), od = rad + int(r, 1, 8);
    if (rad === 3 && od === 5) return null; // 开发集
    text = `已知 ${O} 的半径为 ${n(rad)}，点 P 到圆心 O 的距离为 ${n(od)}，PA 与 ${O} 相切于点 A，求切线长 PA。`;
    cmds = ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${rad})`, `P = (${od}, 0)`, `A = (${rad}^2/${od}, ${rad}*sqrt(${od}^2 - ${rad}^2)/${od})`, 'Segment(O, A)', 'Segment(O, P) #aux', 'Segment(P, A) #hl', 'Angle(O, A, P)', `Text("PA = {Distance(P, A)}", ${fmtPt([od / 2, rad + 1])})`];
    knowns = [`半径 $${rad}$`, `$OP=${od}$`, '$PA$ 切 $\\odot O$ 于 $A$'];
    goal = '求切线长 $PA$';
    layout = `OA⊥PA，PA=√(${od}²-${rad}²)；取 O(0,0)、P(${od},0)，切点 A(r²/OP, r·PA/OP)=(${rad}²/${od}, ${rad}·√(${od}²-${rad}²)/${od})，写成算式由程序计算。`;
    insight = '切线垂直于过切点的半径，$\\triangle OAP$ 是直角三角形。';
    title = '圆的切线长';
  } else {
    const ac = int(r, 3, 12), bc = int(r, 3, 12);
    const semi = pick(r, [true, false, false]); // 有的题说的是半圆
    text = semi ? `如图，AB 是半圆 O 的直径，点 C 在半圆上，${S.eq('AC', ac)}，${S.eq('BC', bc)}，求半圆的半径。`
      : `如图，AB 是 ${O} 的直径，点 C 在 ${O} 上，${S.eq('AC', ac)}，${S.eq('BC', bc)}，求 ${O} 的半径。`;
    cmds = ['ShowAxes(false)', `A = (-sqrt(${ac}^2 + ${bc}^2)/2, 0)`, `B = (sqrt(${ac}^2 + ${bc}^2)/2, 0)`, 'O = Midpoint(A, B)', semi ? 'Semicircle(A, B)' : 'c = Circle(O, A)', `C = Intersect(Circle(A, ${ac}), Circle(B, ${bc}), 2)`, 'Segment(A, B)', 'Segment(A, C)', 'Segment(B, C)', 'Angle(A, C, B)', 'Segment(O, C) #hl', `Text("半径 {Distance(O, A)}", (0, ${num(-Math.hypot(ac, bc) / 2 - 1)}))`];
    knowns = ['$AB$ 是直径', `$AC=${ac}$，$BC=${bc}$`];
    goal = '求半径';
    layout = `直径所对的圆周角是直角，AB=√(${ac}²+${bc}²)，半径是它的一半；A、B 取在 x 轴上关于原点对称，C 到 A 的距离 ${ac}、到 B 的距离 ${bc}，用两个圆的交点确定。`;
    insight = '直径所对的圆周角是 $90^\\circ$。';
    title = '直径所对的圆周角';
  }
  return { text, out: out({ title, category: '平面几何', knowns, goal, layout, commands: cmds, insight }) };
}
