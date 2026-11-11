// 第二版补充：外接圆 / 内切圆（坐标写成算式、数字更多样）、三棱锥的各种摆法和外接球、工程问题（更多数字）。
import { pick, int, num, out, subTex } from './util.js';

const sq = (x) => x * x;
const fmtPt = (p) => `(${p.map(num).join(', ')})`;

// ---------- 外接圆、内切圆 ----------
export function triCircles(r, S) {
  const kind = pick(r, ['right', 'right', 'iso', 'iso', 'eq']);
  let cA, cB, cC, head, knowns, layout, top, cx;
  if (kind === 'right') {
    const a = int(r, 3, 12), b = int(r, 3, 12);
    cB = 'B = (0, 0)'; cC = `C = (${b}, 0)`; cA = `A = (${b}, ${a})`; top = a; cx = b;
    head = `在 ${S.rt('ABC')} 中，${S.ang('C', 90)}，${S.eq('AC', a)}，${S.eq('BC', b)}`;
    knowns = ['$\\angle C=90^\\circ$', `$AC=${a}$，$BC=${b}$`];
    layout = `B(0,0)、C(${b},0)、A(${b},${a})。`;
  } else if (kind === 'iso') {
    const half = int(r, 2, 8), leg = half + int(r, 1, 6);
    cB = `B = (${-half}, 0)`; cC = `C = (${half}, 0)`; cA = `A = (0, sqrt(${leg}^2 - ${half}^2))`; top = Math.sqrt(sq(leg) - sq(half)); cx = half;
    head = `在 ${S.tri('ABC')} 中，${S.L ? `$AB=AC=${leg}$` : `AB = AC = ${leg}`}，${S.eq('BC', 2 * half)}`;
    knowns = [`$AB=AC=${leg}$，$BC=${2 * half}$`];
    layout = `B(${-half},0)、C(${half},0)，高 √(${leg}²-${half}²)，A(0, √(${leg}²-${half}²))，写成算式由程序计算。`;
  } else {
    const s = pick(r, [2, 4, 6, 8, 10, 12]);
    cB = `B = (${-s / 2}, 0)`; cC = `C = (${s / 2}, 0)`; cA = `A = (0, ${s}*sqrt(3)/2)`; top = (s * Math.sqrt(3)) / 2; cx = s / 2;
    head = `等边 ${S.tri('ABC')} 的边长为 ${S.L ? `$${s}$` : s}`;
    knowns = [`等边三角形，边长 $${s}$`];
    layout = `B(${-s / 2},0)、C(${s / 2},0)，A(0, ${s}·√3/2)，写成算式由程序计算。`;
  }
  const base = ['ShowAxes(false)', cB, cC, cA, 'Polygon(A, B, C)'];
  const at = fmtPt([Math.round(cx * 5) / 10, Math.round((top + 2) * 10) / 10]);
  const circum = pick(r, [true, false]);
  // 外心有两种写法：直接求（Circumcenter），或者先画过三点的圆再取圆心（Center）
  const viaCircle = pick(r, [true, false]);
  const cmds = circum
    ? [...base, ...(viaCircle ? ['c = Circle(A, B, C)', 'O = Center(c)'] : ['O = Circumcenter(A, B, C)', 'Circle(A, B, C)']), 'Segment(O, A) #hl', 'Segment(O, B) #aux', 'Segment(O, C) #aux', `Text("R = {Distance(O, A)}", ${at})`]
    : [...base, 'I = Incenter(A, B, C)', 'Incircle(A, B, C)', 'H = Foot(I, Line(B, C))', 'Segment(I, H) #hl', 'Angle(I, H, C)', `Text("r = {Distance(I, H)}", ${at})`];
  return {
    text: `${head}，求 ${S.tri('ABC')} 的${circum ? '外接圆' : '内切圆'}半径。`,
    out: out({
      title: circum ? '三角形的外接圆' : '三角形的内切圆', category: '平面几何', knowns,
      goal: circum ? '求外接圆半径 $R$' : '求内切圆半径 $r$',
      layout: `${layout}${circum ? '外心是三边垂直平分线的交点，用 Circumcenter 由程序求出。' : '内心是三条角平分线的交点，用 Incenter 由程序求出；r=2S/周长。'}`,
      commands: cmds, insight: circum ? (kind === 'right' ? '直角三角形的外心是斜边的中点。' : '外心到三个顶点的距离都等于 $R$。') : '内心到三边的距离都等于 $r$。',
    }),
  };
}

// ---------- 三棱锥 P-ABC，PA ⊥ 平面 ABC：直角在 A、B、C 三种摆法，以及外接球 ----------
// 第一版只有“AB⊥AC”一种摆法；开发集的题是“AB⊥BC”，模型把 P 放到了 B 的正上方。
export function tetra(r, S) {
  const corner = pick(r, ['B', 'B', 'C', 'A']); // 底面的直角在哪个顶点
  const a = int(r, 2, 6), b = int(r, 2, 6), h = int(r, 2, 6);
  if (corner === 'B' && a === 2 && b === 2 && h === 2) return null; // 开发集
  // 直角顶点放在原点，两条直角边沿 x、y 轴；P 在 A 的正上方（PA ⊥ 底面）
  let pts, perp, lens, dia;
  if (corner === 'B') {
    pts = ['B = (0, 0, 0)', `A = (${a}, 0, 0)`, `C = (0, ${b}, 0)`, `P = (${a}, 0, ${h})`];
    perp = S.perp('AB', 'BC'); lens = [['AB', a], ['BC', b]]; dia = 'C'; // PC 是外接球的直径
  } else if (corner === 'C') {
    pts = ['C = (0, 0, 0)', `A = (${a}, 0, 0)`, `B = (0, ${b}, 0)`, `P = (${a}, 0, ${h})`];
    perp = S.perp('AC', 'BC'); lens = [['AC', a], ['BC', b]]; dia = 'B'; // PB 是外接球的直径
  } else {
    pts = ['A = (0, 0, 0)', `B = (${a}, 0, 0)`, `C = (0, ${b}, 0)`, `P = (0, 0, ${h})`];
    perp = S.perp('AB', 'AC'); lens = [['AB', a], ['AC', b]]; dia = null;
  }
  const head = `在三棱锥 P-ABC 中，${S.L ? '$PA\\perp$ 平面 $ABC$' : 'PA⊥平面 ABC'}，${perp}，${S.eq('PA', h)}，${S.eq(lens[0][0], lens[0][1])}，${S.eq(lens[1][0], lens[1][1])}`;
  const base = [...pts, 'Polygon(A, B, C)', 'Segment(P, A)', 'Segment(P, B)', 'Segment(P, C)',
    `Angle(${corner === 'B' ? 'A, B, C' : corner === 'C' ? 'A, C, B' : 'B, A, C'})`, `Angle(P, A, ${corner === 'A' ? 'B' : corner})`];
  const where = `直角顶点 ${corner} 放在原点，两条直角边沿 x、y 轴；PA⊥底面，所以 P 在 A 的正上方，高度 ${h}。`;
  const ask = pick(r, ['sphere', 'sphere', 'edge', 'angle', 'volume']);
  const top = `(0, 0, ${h + 1})`;
  let text, goal, cmds, layout, insight;
  if (ask === 'sphere') {
    text = `${head}，求三棱锥 P-ABC 的外接球的${pick(r, ['表面积', '半径', '体积'])}。`;
    goal = '求外接球的半径（表面积、体积由半径算出）';
    cmds = dia
      ? [...base, `O = Midpoint(P, ${dia}) #result`, 'Sphere(O, Distance(O, P)) #aux', `Segment(P, ${dia}) #hl`, `Text("R = {Distance(O, P)}", ${top})`]
      : [...base, 'O = 1/2*(B + C + P) #result', 'Sphere(O, Distance(O, P)) #aux', 'Segment(O, P) #hl', `Text("R = {Distance(O, P)}", ${top})`];
    layout = `${where}${dia ? `∠PA${dia}=90°、∠P${corner}${dia}=90°，所以 P${dia} 是外接球的直径，球心是 P${dia} 的中点。` : '三条棱 AB、AC、AP 两两垂直，补成长方体，球心是长方体的中心 (B+C+P)/2。'}`;
    insight = dia ? `$P${dia}$ 对着两个直角，是外接球的直径。` : '三条两两垂直的棱可以补成长方体，长方体的对角线是外接球的直径。';
  } else if (ask === 'edge') {
    const far = corner === 'A' ? 'B' : dia;
    text = `${head}，求 P${far} 的长。`;
    goal = `求 $P${far}$ 的长`;
    cmds = [...base, `Segment(P, ${far}) #hl`, `Text("P${far} = {Distance(P, ${far})}", ${top})`];
    layout = `${where}距离由程序按坐标计算。`;
    insight = '空间中两点的距离可以用坐标直接算。';
  } else if (ask === 'angle') {
    const far = corner === 'A' ? 'B' : dia;
    text = `${head}，求直线 P${far} 与平面 ABC 所成的角。`;
    goal = `求 $P${far}$ 与平面 $ABC$ 所成的角`;
    cmds = [...base, `Angle(P, ${far}, A) "θ" #hl`, `Text("θ = {Angle(P, ${far}, A)}", ${top})`];
    layout = `${where}PA⊥平面 ABC，P${far} 在底面上的射影是 A${far}，所求角是 ∠P${far}A。`;
    insight = `$P${far}$ 在底面上的射影是 $A${far}$，线面角就是 $\\angle P${far}A$。`;
  } else {
    text = `${head}，求三棱锥 P-ABC 的体积。`;
    goal = '求体积';
    cmds = [...base, `Text("底面积 {Area(Polygon(A, B, C))}，高 {Distance(P, A)}", ${top})`];
    layout = `${where}V=⅓·底面积·高=⅓·½·${a}·${b}·${h}=${num((a * b * h) / 6)}。`;
    insight = '$PA$ 垂直于底面，是这个三棱锥的高。';
  }
  void subTex;
  return { text, out: out({ title: ask === 'sphere' ? '三棱锥的外接球' : '三棱锥', category: '立体几何', knowns: ['$PA\\perp$ 平面 $ABC$', `底面直角在 $${corner}$`, `$PA=${h}$，$${lens[0][0]}=${lens[0][1]}$，$${lens[1][0]}=${lens[1][1]}$`], goal, layout, commands: cmds, insight }) };
}

// ---------- 工程问题（线段图） ----------
export function work(r, S) {
  const a = int(r, 2, 30), b = int(r, 2, 30);
  if (a === b) return null;
  const t0 = (a * b) / (a + b);
  const ctx = pick(r, [
    { text: `一项工程，甲队单独做需要 ${a} 天完成，乙队单独做需要 ${b} 天完成。两队合作，需要多少天完成？`, unit: '天', A: '甲队', B: '乙队', whole: '全部工程' },
    { text: `一个水池，单开甲管 ${a} 小时可以注满，单开乙管 ${b} 小时可以注满。两管同时打开，几小时可以注满水池？`, unit: '小时', A: '甲管', B: '乙管', whole: '一池水' },
    { text: `一批零件，师傅单独做 ${a} 小时完成，徒弟单独做 ${b} 小时完成，两人合做几小时完成？`, unit: '小时', A: '师傅', B: '徒弟', whole: '全部零件' },
    { text: `修一条路，甲工程队单独修要 ${a} 天，乙工程队单独修要 ${b} 天。两队从两头同时开工，多少天修完？`, unit: '天', A: '甲队', B: '乙队', whole: '整条路' },
  ]);
  void S;
  return {
    text: ctx.text,
    out: out({
      title: '工程问题', category: '应用题', knowns: [`${ctx.A}单独 ${a} ${ctx.unit}`, `${ctx.B}单独 ${b} ${ctx.unit}`], goal: '求合作所需的时间',
      layout: `把${ctx.whole}看作 1，用一条长 12 的线段表示；${ctx.A}每${ctx.unit}完成 1/${a}，${ctx.B}每${ctx.unit}完成 1/${b}，合作需要 1÷(1/${a}+1/${b}) ${ctx.unit}，由程序计算。`,
      commands: ['ShowAxes(false)', 'A = (0, 0) #fixed #nolabel', 'B = (12, 0) #fixed #nolabel', 'Segment(A, B)', `Brace(A, B, "${ctx.whole}（看作 1）")`,
        `t = Slider(0, ${num(Math.ceil(t0))}, ${num(Math.round(t0 * 5) / 10)}) "时间 t（${ctx.unit}）"`, `P = (12t/${a}, 0) #hl #nolabel`, `Q = (12 - 12t/${b}, 0) #result #nolabel`,
        'Segment(A, P) #hl', 'Segment(Q, B) #result', `Brace(P, A, "${ctx.A}完成 {t/${a}}")`, `Brace(B, Q, "${ctx.B}完成 {t/${b}}")`,
        `Text("{t} ${ctx.unit}后还剩 {1 - t/${a} - t/${b}}；合作共需 {1/(1/${a} + 1/${b})} ${ctx.unit}", (1, 2.8))`],
      insight: '拖动滑块 $t$，两段线段正好接上的时候，工作全部完成。',
    }),
  };
}
