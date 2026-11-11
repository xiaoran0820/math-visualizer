// 几何类题目：解析几何（直线与圆、圆锥曲线）、立体几何。平面几何（三角形、四边形、圆）在 plane.js。
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
    const [A2, B2] = pick(r, [[4, 3], [9, 5], [25, 16], [16, 12], [8, 4], [9, 8], [16, 7], [25, 9], [12, 3], [6, 2], [10, 6], [5, 4], [9, 4], [16, 9]]);
    const c = Math.sqrt(A2 - B2);
    const cE = `sqrt(${A2} - ${B2})`; // 焦点的横坐标写成算式 √(a² - b²)，由程序计算
    const e = `x^2/${A2} + y^2/${B2} = 1`;
    const k = pick(r, [1, -1, 1 / 2, 2]), m = pick(r, [0, 1, -1, 2]);
    if (A2 === 4 && B2 === 3 && k === 1) return null; // 开发集
    const l = `y = ${poly([k, m])}`;
    const ask = pick(r, ['chord', 'foci', 'chordSlider']);
    title = '椭圆与直线';
    if (ask === 'foci') {
      text = `已知椭圆 ${S.m(e)}，${S.L ? '$F_1$、$F_2$' : 'F₁、F₂'} 是它的两个焦点，点 P 在椭圆上，求 △PF₁F₂ 的周长。`.replace('△PF₁F₂', S.L ? '$\\triangle PF_1F_2$' : '△PF₁F₂');
      cmds = [`E: ${e}`, `F1 = (-${cE}, 0)`, `F2 = (${cE}, 0)`, `P = Point(E, (${num(Math.sqrt(A2) / 2)}, ${num(Math.sqrt(B2 * 0.75))}))`, 'Polygon(P, F1, F2) #hl', 'Text("周长 {Distance(P, F1) + Distance(P, F2) + Distance(F1, F2)}", (' + num(-Math.sqrt(A2)) + ', ' + num(Math.sqrt(B2) + 1) + '))'];
      goal = '求 $\\triangle PF_1F_2$ 的周长';
      layout = `a²=${A2}，b²=${B2}，c=√(a²-b²)=√(${A2}-${B2})，焦点 (±c,0)，写成算式由程序计算；周长 = 2a+2c。`;
      insight = '拖动点 $P$：$|PF_1|+|PF_2|$ 始终等于 $2a$，周长不变。';
      knowns = [T(e)];
    } else {
      const slider = ask === 'chordSlider';
      text = slider ? `已知椭圆 C：${S.m(e)}，直线 l：${S.m(`y = ${poly([k, 0])} + m`)} 与椭圆 C 交于 A、B 两点，讨论弦 AB 的长随 m 的变化。`
        : `已知椭圆 C：${S.m(e)}，直线 l：${S.m(l)} 与椭圆交于 A、B 两点，求弦长 |AB|。`;
      cmds = slider
        ? ['m = Slider(-3, 3, 1)', `E: ${e}`, `l: y = ${poly([k, 0])} + m`, 'A = Intersect(E, l, 1)', 'B = Intersect(E, l, 2)', 'Segment(A, B) #hl', `F1 = (-${cE}, 0) #aux`, `F2 = (${cE}, 0) #aux`, 'Text("|AB| = {Distance(A, B)}", (' + num(-Math.sqrt(A2)) + ', ' + num(Math.sqrt(B2) + 1) + '))']
        : [`E: ${e}`, `l: ${l}`, 'A = Intersect(E, l, 1)', 'B = Intersect(E, l, 2)', 'Segment(A, B) #hl', 'Text("|AB| = {Distance(A, B)}", (' + num(-Math.sqrt(A2)) + ', ' + num(Math.sqrt(B2) + 1) + '))'];
      goal = slider ? '研究弦长与 $m$ 的关系' : '求弦长 $|AB|$';
      layout = `联立直线和椭圆，消去 y 得关于 x 的一元二次方程，用韦达定理和弦长公式 |AB|=√(1+k²)|x₁-x₂|。`;
      insight = slider ? '拖动滑块 $m$，直线上下平移；与椭圆相切时弦长变为 $0$。' : '交点由程序算出，可以和弦长公式的结果对照。';
      knowns = [T(e), slider ? T(`y=${poly([k, 0])}+m`) : T(l)];
    }
  } else if (kind === 'hyperbola') {
    const [A2, B2] = pick(r, [[4, 5], [9, 16], [4, 12], [1, 3], [16, 9], [3, 6], [2, 7], [5, 4], [8, 8], [9, 7], [4, 4], [1, 8], [6, 3]]);
    const e = `x^2/${A2} - y^2/${B2} = 1`;
    text = pick(r, [`求双曲线 ${S.m(e)} 的焦点坐标、离心率和渐近线方程。`, `已知双曲线 ${S.m(e)}，写出它的顶点、焦点和渐近线。`]);
    // 焦点、顶点、渐近线的斜率都写成算式：c = √(a² + b²)，斜率 ±√(b²/a²)
    cmds = [`H: ${e}`, `F1 = (-sqrt(${A2} + ${B2}), 0) "F1"`, `F2 = (sqrt(${A2} + ${B2}), 0) "F2"`, `l1: y = sqrt(${B2}/${A2})*x #aux`, `l2: y = -sqrt(${B2}/${A2})*x #aux`, `V1 = (-sqrt(${A2}), 0)`, `V2 = (sqrt(${A2}), 0)`];
    knowns = [T(e)];
    goal = '求焦点、离心率、渐近线';
    layout = `a²=${A2}，b²=${B2}，c=√(a²+b²)=√(${A2}+${B2})；焦点 (±c,0)，顶点 (±√${A2},0)，渐近线 y=±(b/a)x=±√(${B2}/${A2})·x，都写成算式由程序计算。`;
    insight = '双曲线越往外越贴近两条渐近线。';
    title = '双曲线的焦点和渐近线';
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
  const kind = pick(r, ['cube', 'cube', 'cuboid', 'cuboid', 'pyramid']); // 圆柱、圆锥、球在 plane2.js 的 round 里单独成一类
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
