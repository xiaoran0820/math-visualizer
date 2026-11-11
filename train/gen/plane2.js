// 解三角形、圆的切线与圆周角（第二版：坐标写成算式或用作图命令确定，由程序计算）。
import { pick, int, num, out } from './util.js';

const rad = (d) => (d * Math.PI) / 180;
const fmtPt = (p) => `(${p.map(num).join(', ')})`;

// ---------- 解三角形：余弦定理、面积 ----------
// 顶点坐标写成算式（b·cos C、b·sin C）；三边已知时用两个圆的交点
export function solveTriangle(r, S) {
  const kind = pick(r, ['sas', 'sas', 'area', 'sss']);
  const lab = (s0) => (S.L ? `$${s0}$` : s0);
  if (kind === 'sss') {
    const a = int(r, 5, 12), b = int(r, 4, 11), c = int(r, 4, 11);
    if (!(a + b > c + 1 && a + c > b + 1 && b + c > a + 1)) return null;
    const big = Math.max(a, b, c);
    const which = big === c ? 'C' : big === a ? 'A' : 'B';
    const args = which === 'C' ? 'B, C, A' : which === 'A' ? 'C, A, B' : 'A, B, C';
    const x = (a * a + b * b - c * c) / (2 * a);
    const top = Math.round(Math.sqrt(Math.max(1, b * b - x * x)) * 10) / 10 + 1;
    return {
      text: `在 ${S.tri('ABC')} 中，角 A、B、C 的对边分别为 ${lab(`a = ${a}`)}，${lab(`b = ${b}`)}，${lab(`c = ${c}`)}，求最大角的余弦值。`,
      out: out({
        title: '余弦定理求角', category: '三角函数', knowns: [`$a=${a}$，$b=${b}$，$c=${c}$`], goal: '求最大角的余弦值',
        layout: `取 C(0,0)、B(${a},0)（BC=a=${a}）；A 到 C 的距离是 b=${b}、到 B 的距离是 c=${c}，用两个圆的交点确定，由程序计算。大边对大角，所求是角 ${which}。`,
        commands: ['ShowAxes(false)', 'C = (0, 0)', `B = (${a}, 0)`, `A = Intersect(Circle(C, ${b}), Circle(B, ${c}), 2)`, 'Polygon(A, B, C)',
          `Angle(${args}) "最大角" #hl`, `Text("最大角 {Angle(${args})}", (${num(a / 2)}, ${num(top)}))`],
        insight: '大边对大角：先找最长的边，再用余弦定理。',
      }),
    };
  }
  const a = int(r, 3, 12), b = int(r, 3, 12), C = pick(r, [30, 45, 60, 90, 120, 135, 150]);
  const base = ['ShowAxes(false)', 'C = (0, 0)', `B = (${a}, 0)`, `A = (${b}cos(${C}°), ${b}sin(${C}°))`, 'Polygon(A, B, C)'];
  const top = Math.round(b * Math.sin(rad(C)) * 10) / 10 + 1;
  const ang = S.L ? `$C=${C}^\\circ$` : `C = ${C}°`;
  if (kind === 'sas') {
    const text = S.ja ? `$\\triangle ABC$ において、$a=${a}$、$b=${b}$、$C=${C}^\\circ$ のとき、$c$ を求めよ。`
      : `在 ${S.tri('ABC')} 中，角 A、B、C 的对边分别为 a、b、c，已知 ${lab(`a = ${a}`)}，${lab(`b = ${b}`)}，${ang}，求 c。`;
    return {
      text,
      out: out({
        title: '余弦定理求边', category: '三角函数', knowns: [`$a=${a}$，$b=${b}$，$C=${C}^\\circ$`], goal: '求边 $c$',
        layout: `取 C(0,0)、B(${a},0)（BC=a=${a}）；CA=b=${b} 且 ∠C=${C}°，所以 A(${b}cos${C}°, ${b}sin${C}°)，写成算式由程序计算。c=AB，c²=a²+b²-2ab·cosC。`,
        commands: [...base, `Angle(B, C, A) "${C}°"`, 'Segment(A, B) #hl', `Text("c = AB = {Distance(A, B)}", (${num(a / 2)}, ${num(top)}))`],
        insight: '两边及其夹角确定一个三角形，用余弦定理求第三边。',
      }),
    };
  }
  return {
    text: `在 ${S.tri('ABC')} 中，${lab(`a = ${a}`)}，${lab(`b = ${b}`)}，${ang}，求 ${S.tri('ABC')} 的面积。`,
    out: out({
      title: '三角形的面积', category: '三角函数', knowns: [`$a=${a}$，$b=${b}$，$C=${C}^\\circ$`], goal: '求面积',
      layout: `取 C(0,0)、B(${a},0)；A(${b}cos${C}°, ${b}sin${C}°)，写成算式由程序计算。S=½ab·sinC。`,
      commands: [...base, `Angle(B, C, A) "${C}°"`, 'H = Foot(A, Line(B, C))', 'Segment(A, H) #aux', `Text("S = {Area(Polygon(A, B, C))}", (${num(a / 2)}, ${num(top)}))`],
      insight: '面积 $=\\frac{1}{2}ab\\sin C$，图中的高 $AH=b\\sin C$。',
    }),
  };
}

// ---------- 圆：两条切线、圆周角 ----------
export function circleMore(r, S) {
  const kind = pick(r, ['twoTangents', 'inscribed']);
  const O = S.odot('O');
  if (kind === 'twoTangents') {
    const rr = int(r, 2, 9), d = rr + int(r, 1, 9);
    return {
      text: `从 ${O} 外一点 P 引 ${O} 的两条切线 PA、PB，切点分别为 A、B，若 ${O} 的半径为 ${S.L ? `$${rr}$` : rr}，${S.eq('OP', d)}，求 AB 的长。`,
      out: out({
        title: '两条切线', category: '平面几何', knowns: [`半径 $${rr}$，$OP=${d}$`, '$PA$、$PB$ 是切线'], goal: '求 $AB$ 的长',
        layout: `取 O(0,0)、P(${d},0)；切点 A(r²/OP, r·√(OP²-r²)/OP)=(${rr}²/${d}, ${rr}·√(${d}²-${rr}²)/${d})，写成算式由程序计算；B 是 A 关于直线 OP 的对称点。`,
        commands: ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${rr})`, `P = (${d}, 0)`, `A = (${rr}^2/${d}, ${rr}*sqrt(${d}^2 - ${rr}^2)/${d})`, 'B = Reflect(A, Line(O, P))',
          'Segment(P, A)', 'Segment(P, B)', 'Segment(O, A) #aux', 'Segment(O, B) #aux', 'Segment(O, P) #aux', 'Segment(A, B) #hl', 'Angle(O, A, P)', `Text("AB = {Distance(A, B)}", ${fmtPt([d / 2, rr + 1])})`],
        insight: '从圆外一点引的两条切线长相等，$OP$ 垂直平分 $AB$。',
      }),
    };
  }
  const R0 = int(r, 2, 6), aob = pick(r, [40, 60, 70, 80, 100, 110, 120, 130, 140]);
  const cAng = 180 + aob / 2 + 40;
  // 一半的题把 C 做成圆上可以拖动的点（Point），让用户自己验证“圆周角不变”
  const drag = pick(r, [true, false]);
  const cCmd = drag ? `C = Point(c, (${num(R0 * Math.cos(rad(cAng)))}, ${num(R0 * Math.sin(rad(cAng)))}))` : `C = Rotate(A, ${cAng}°, O)`;
  return {
    text: pick(r, [
      `如图，A、B、C 是 ${O} 上的三点，${S.ang('AOB', aob)}，求 ${S.ang('ACB')} 的度数。`,
      `在 ${O} 中，弧 AB 所对的圆心角 ${S.ang('AOB', aob)}，点 C 在优弧 AB 上，求圆周角 ${S.ang('ACB')} 的大小。`,
    ]),
    out: out({
      title: '圆周角定理', category: '平面几何', knowns: [`$\\angle AOB=${aob}^\\circ$`], goal: '求 $\\angle ACB$',
      layout: `A 取在 (${R0},0)，B 由 A 绕 O 旋转 ${aob}° 得到，C 取在优弧上${drag ? '，做成圆上可以拖动的点' : `（A 绕 O 旋转 ${cAng}°）`}；同弧所对的圆周角是圆心角的一半。`,
      commands: ['ShowAxes(false)', 'O = (0, 0)', `c = Circle(O, ${R0})`, `A = (${R0}, 0)`, `B = Rotate(A, ${aob}°, O)`, cCmd,
        'Segment(O, A)', 'Segment(O, B)', 'Segment(C, A)', 'Segment(C, B)', `Angle(A, O, B) "${aob}°"`, 'Angle(A, C, B) #hl', `Text("∠ACB = {Angle(A, C, B)}", ${fmtPt([-R0, R0 + 1])})`],
      insight: drag ? '拖动点 $C$：只要它在优弧上，$\\angle ACB$ 就不变，等于圆心角的一半。' : '点 $C$ 在优弧上任何位置，$\\angle ACB$ 都等于圆心角的一半。',
    }),
  };
}

// ---------- 圆柱、圆锥、球（单独成一类：第一版里圆柱只有 4 道题，模型没学会 Cylinder 的写法） ----------
export function round(r, S) {
  const shape = pick(r, ['cone', 'cylinder', 'sphere', 'cylinder', 'cone', 'section', 'cylinder']);
  const n = (x) => (S.L ? `$${x}$` : x);
  const R = int(r, 1, 6), h = int(r, 2, 9);
  if (shape === 'cone') {
    const text = pick(r, [
      `一个圆锥的底面半径为 ${n(R)}，高为 ${n(h)}，求它的母线长、侧面积和体积。`,
      `已知圆锥的底面半径是 ${n(R)}，高是 ${n(h)}，求圆锥的母线长和侧面展开图的面积。`,
      `圆锥的高为 ${n(h)}，底面半径为 ${n(R)}，求它的体积和表面积。`,
    ]);
    return {
      text,
      out: out({
        title: '圆锥', category: '立体几何', knowns: [`底面半径 $${R}$，高 $${h}$`], goal: '求母线长、侧面积和体积',
        layout: `底面圆心 O(0,0,0)，顶点 P(0,0,${h})；母线 l=√(${R}²+${h}²)，由程序用距离算出；S侧=πrl，V=⅓πr²h。`,
        commands: ['O = (0, 0, 0)', `P = (0, 0, ${h})`, `Cone(O, P, ${R})`, `A = (${R}, 0, 0)`, 'Segment(P, A) #hl', 'Segment(O, A) #aux', 'Segment(O, P) #aux', 'Angle(P, O, A)', `Text("母线 {Distance(P, A)}", (0, 0, ${h + 1}))`],
        insight: '高、底面半径和母线组成直角三角形。',
      }),
    };
  }
  if (shape === 'cylinder') {
    if (R === 2 && h === 5) return null; // 开发集
    // 说法尽量和开发集那道圆柱题不一样（太像的会被自动去掉，第一版因此几乎没有圆柱题）
    const text = pick(r, [
      `已知圆柱的底面半径是 ${n(R)}，母线长是 ${n(h)}，求圆柱的表面积。`,
      `圆柱的高为 ${n(h)}，底面直径为 ${n(2 * R)}，求它的体积和轴截面的面积。`,
      `一个圆柱形水桶，底面半径是 ${n(R)} 分米，高是 ${n(h)} 分米，这个水桶最多能装多少立方分米的水？`,
      `把一张长方形纸片卷成一个圆柱，圆柱的底面半径为 ${n(R)}，高为 ${n(h)}，这张纸片的面积是多少？`,
      `圆柱的上、下底面圆心分别为 O₁、O，底面半径 ${n(R)}，${S.L ? `$OO_1=${h}$` : `OO₁ = ${h}`}，求圆柱的侧面积。`,
    ]);
    return {
      text,
      out: out({
        title: '圆柱', category: '立体几何', knowns: [`底面半径 $${R}$，高 $${h}$`], goal: '求侧面积和体积',
        layout: `下底面圆心 O(0,0,0)，上底面圆心 O1(0,0,${h})；S侧=2πrh=${2 * R * h}π，V=πr²h=${R * R * h}π。`,
        commands: ['O = (0, 0, 0)', `O1 = (0, 0, ${h})`, `Cylinder(O, O1, ${R})`, `A = (${R}, 0, 0)`, `A1 = (${R}, 0, ${h})`, 'Segment(A, A1) #hl', 'Segment(O, A) #aux', 'Segment(O, O1) #aux'],
        insight: '侧面展开是一个长为 $2\\pi r$、宽为 $h$ 的矩形。',
      }),
    };
  }
  if (shape === 'sphere') {
    const text = pick(r, [
      `已知球的半径为 ${n(R)}，求球的表面积和体积。`,
      `一个球的直径是 ${n(2 * R)}，求它的表面积。`,
      `正方体的棱长为 ${n(2 * R)}，求它的内切球的体积。`,
    ]);
    const cube = text.includes('正方体');
    return {
      text,
      out: out({
        title: cube ? '正方体的内切球' : '球的表面积和体积', category: '立体几何', knowns: [cube ? `正方体棱长 $${2 * R}$` : `球的半径 $${R}$`], goal: cube ? '求内切球的体积' : '求表面积和体积',
        layout: `球心 O(0,0,0)，半径 ${R}${cube ? `（内切球的直径等于棱长 ${2 * R}）` : ''}；S=4πR²=${4 * R * R}π，V=4/3·πR³。`,
        commands: ['O = (0, 0, 0)', `Sphere(O, ${R})`, `A = (${R}, 0, 0)`, 'Segment(O, A) #hl', `Text("R = {Distance(O, A)}", (0, 0, ${R + 1}))`],
        insight: '球面上每一点到球心的距离都等于半径。',
      }),
    };
  }
  const R0 = R + int(r, 1, 4), r0 = R;
  return {
    text: `球的半径为 ${n(R0)}，一个平面截球得到的截面圆半径为 ${n(r0)}，求球心到截面的距离。`,
    out: out({
      title: '球的截面', category: '立体几何', knowns: [`球半径 $${R0}$`, `截面圆半径 $${r0}$`], goal: '求球心到截面的距离',
      layout: `球心 O 到截面的距离 d=√(R²-r²)=√(${R0}²-${r0}²)，写成算式由程序计算；截面圆心 M(0,0,d)，截面圆上一点 A(${r0},0,d)。`,
      commands: ['O = (0, 0, 0)', `Sphere(O, ${R0}) #aux`, `d = sqrt(${R0}^2 - ${r0}^2)`, 'M = (0, 0, d)', `A = (${r0}, 0, d)`, 'Segment(O, M) #hl', 'Segment(M, A)', 'Segment(O, A) #aux', 'Angle(O, M, A)', `Text("OM = {Distance(O, M)}", (0, 0, ${R0 + 1}))`],
      insight: '球心、截面圆心和截面圆上一点组成直角三角形。',
    }),
  };
}
