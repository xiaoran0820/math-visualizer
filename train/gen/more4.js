// 第三版补充（课程里常见、前两版没有的题型；不仿照任何一道真题）：
// 复平面上的圆和点、空间坐标、参数方程、整数（列表格，不画无关的图）、递推数列（列表格并描点）。
import { pick, int, num, out } from './util.js';

const sgn = (v) => (v < 0 ? `-${num(-v)}` : `+${num(v)}`);
const cplx = (a, b) => `${num(a)}${b === 0 ? '' : `${b < 0 ? '-' : '+'}${Math.abs(b) === 1 ? '' : num(Math.abs(b))}i`}`; // 3-2i
const pt3 = (p) => `(${p.map(num).join(', ')})`;

// ---------- 复平面上的圆：|z - c| = r，求 |z| 的最值 ----------
export function complexCircle(r, S) {
  let a, b;
  do { a = int(r, -4, 4); b = int(r, -4, 4); } while (a === 0 && b === 0);
  const R = int(r, 1, 3);
  if (Math.hypot(a, b) < R + 0.5) return null; // 原点在圆外，最值是 |OC| ± r
  const c = cplx(a, b);
  const cond = S.L ? `$|z-(${c})|=${R}$` : `|z − (${c.replace('-', ' − ').replace('+', ' + ')})| = ${R}`;
  const text = S.ja ? `複素数 $z$ が ${cond} を満たすとき，$|z|$ の最大値と最小値を求めよ。`
    : pick(r, [`复数 ${S.L ? '$z$' : 'z'} 满足 ${cond}，求 ${S.L ? '$|z|$' : '|z|'} 的最大值和最小值。`, `已知复数 ${S.L ? '$z$' : 'z'} 满足 ${cond}，求 ${S.L ? '$|z|$' : '|z|'} 的取值范围。`]);
  const d = Math.hypot(a, b);
  return {
    text,
    out: out({
      title: '复数的模的最值', category: '其他', knowns: [`$|z-(${c})|=${R}$`], goal: '求 $|z|$ 的最大值和最小值',
      layout: `复数 z 对应复平面上的点 Z；条件表示以 C(${a}, ${b}) 为圆心、半径 ${R} 的圆。|z| 是 O 到 Z 的距离，最大、最小值在直线 OC 与圆的两个交点处取得，等于 |OC| ± ${R}，由程序计算。`,
      commands: [`C = (${a}, ${b}) "圆心"`, `Circle(C, ${R})`, 'O = (0, 0)', 'Line(O, C) #aux', 's = Slider(0, 6.28, 0.6)', `Z = (${a} + ${R}cos(s), ${b} + ${R}sin(s)) #hl`, 'Segment(O, Z) #hl',
        `Text("|z| = {Distance(O, Z)}；最大 {Distance(O, C) + ${R}}，最小 {Distance(O, C) - ${R}}", (${num(a > 0 ? -5 : 1)}, ${num(b > 0 ? -2 : 5)}))`],
      insight: `$|z|$ 的最大值和最小值是 $|OC|\\pm ${R}$，约为 ${num(Math.round((d + R) * 100) / 100)} 和 ${num(Math.round((d - R) * 100) / 100)}。`,
    }),
  };
}

// ---------- 复平面上的点：两点的距离、中点、三角形 ----------
export function complexPoints(r, S) {
  const a = int(r, -4, 4), b = int(r, -4, 4), c = int(r, -4, 4), d = int(r, -4, 4);
  if ((a === c && b === d) || a * d - b * c === 0) return null; // O、A、B 不共线
  const z1 = cplx(a, b), z2 = cplx(c, d);
  const ask = pick(r, ['dist', 'mid', 'area']);
  const q = { dist: S.ja ? '$|z_1-z_2|$ を求めよ' : `求 ${S.L ? '$|z_1-z_2|$' : '|z₁ − z₂|'}`, mid: S.ja ? '線分 $AB$ の中点が表す複素数を求めよ' : '求线段 AB 的中点对应的复数', area: S.ja ? '$\\triangle OAB$ の面積を求めよ' : `求 ${S.L ? '$\\triangle OAB$' : '△OAB'} 的面积` }[ask];
  const text = S.ja ? `複素数平面上で，$z_1=${z1}$，$z_2=${z2}$ が表す点をそれぞれ $A$，$B$ とする。${q}。`
    : `在复平面内，复数 ${S.L ? `$z_1=${z1}$` : `z₁ = ${z1}`}，${S.L ? `$z_2=${z2}$` : `z₂ = ${z2}`} 对应的点分别为 A，B，${q}。`;
  const cmds = ['O = (0, 0)', `A = (${a}, ${b}) "z₁"`, `B = (${c}, ${d}) "z₂"`, 'Segment(A, B) #hl'];
  if (ask === 'dist') cmds.push(`Text("|z₁ - z₂| = |AB| = {Distance(A, B)}", (${num((a + c) / 2 + 0.5)}, ${num((b + d) / 2 + 1)}))`);
  if (ask === 'mid') cmds.push('M = Midpoint(A, B) #result', `Text("中点 M 对应 {x(M)} + ({y(M)})i", (${num((a + c) / 2 + 0.5)}, ${num((b + d) / 2 + 1)}))`);
  if (ask === 'area') cmds.push('Polygon(O, A, B) #aux', `Text("面积 {Area(Polygon(O, A, B))}", (${num((a + c) / 3 + 0.5)}, ${num((b + d) / 3 + 1)}))`);
  return {
    text,
    out: out({
      title: '复平面上的点', category: '其他', knowns: [`$z_1=${z1}$，$z_2=${z2}$`], goal: { dist: '求 $|z_1-z_2|$', mid: '求线段 $AB$ 的中点对应的复数', area: '求 $\\triangle OAB$ 的面积' }[ask],
      layout: `复数 a+bi 对应复平面上的点 (a, b)：A(${a}, ${b})，B(${c}, ${d})。${{ dist: '|z₁ − z₂| 就是 A、B 两点的距离', mid: '中点坐标是两点坐标的平均数', area: '三角形 OAB 的面积由程序计算' }[ask]}。`,
      commands: cmds,
      insight: { dist: '两个复数之差的模，就是复平面上对应两点之间的距离。', mid: '中点对应的复数是 $\\frac{z_1+z_2}{2}$。', area: '$\\triangle OAB$ 的面积等于 $\\frac{1}{2}|ad-bc|$。' }[ask],
    }),
  };
}

// ---------- 空间坐标：三点构成的三角形 ----------
export function space3d(r, S) {
  const P = () => [int(r, -2, 3), int(r, -2, 3), int(r, 0, 4)];
  const A = P(), B = P(), C = P();
  const sub = (u, v) => u.map((x, i) => x - v[i]);
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (Math.hypot(...cross(sub(B, A), sub(C, A))) < 1) return null; // 不共线
  const ask = pick(r, ['angle', 'sides', 'angle']);
  const pts = S.L ? `$A${pt3(A)}$，$B${pt3(B)}$，$C${pt3(C)}$` : `A${pt3(A)}，B${pt3(B)}，C${pt3(C)}`;
  const text = S.ja ? `座標空間に 3 点 ${pts.replace(/，/g, '，')} がある。${ask === 'angle' ? '$\\angle BAC$ の大きさを求めよ' : '$\\triangle ABC$ の 3 辺の長さを求めよ'}。`
    : `在空间直角坐标系中，已知 ${pts}，${ask === 'angle' ? `求 ${S.L ? '$\\angle BAC$' : '∠BAC'} 的大小` : `求 ${S.L ? '$\\triangle ABC$' : '△ABC'} 的三边长`}。`;
  return {
    text,
    out: out({
      title: ask === 'angle' ? '空间中的角' : '空间三角形的边长', category: '向量', knowns: [`$A${pt3(A)}$，$B${pt3(B)}$，$C${pt3(C)}$`], goal: ask === 'angle' ? '求 $\\angle BAC$' : '求 $\\triangle ABC$ 的三边长',
      layout: `在空间直角坐标系中按坐标画出 A、B、C 三点和三角形 ABC；${ask === 'angle' ? '∠BAC 由向量 AB、AC 的夹角公式计算' : '边长用两点间距离公式计算'}，由程序计算。`,
      commands: ['O = (0, 0, 0)', `A = ${pt3(A)}`, `B = ${pt3(B)}`, `C = ${pt3(C)}`, 'Polygon(A, B, C)',
        ask === 'angle' ? 'Angle(B, A, C) #hl' : 'Segment(A, B) #hl',
        ask === 'angle' ? `Text("∠BAC = {Angle(B, A, C)}", (0, 0, 5))` : `Text("AB = {Distance(A, B)}，BC = {Distance(B, C)}，CA = {Distance(C, A)}", (0, 0, 5))`],
      insight: ask === 'angle' ? '$\\cos\\angle BAC=\\frac{\\overrightarrow{AB}\\cdot\\overrightarrow{AC}}{|\\overrightarrow{AB}||\\overrightarrow{AC}|}$。' : '空间两点间的距离：三个坐标差的平方和再开方。',
    }),
  };
}

// ---------- 参数方程 ----------
export function parametric(r, S) {
  const kind = pick(r, ['ellipse', 'circle', 'parabola', 'line']);
  let x, y, t0 = '0', t1 = '2pi', ordinary, ask, cmdsExtra = [];
  if (kind === 'ellipse') { const a = int(r, 2, 4), b = int(r, 1, a - 1); x = `${a}cos(t)`; y = `${b}sin(t)`; ordinary = `x^2/${a * a} + y^2/${b * b} = 1`; ask = 'ord'; }
  else if (kind === 'circle') { const a = int(r, -2, 2), b = int(r, -2, 2), R = int(r, 1, 3); x = `${a === 0 ? '' : `${a} + `}${R}cos(t)`; y = `${b === 0 ? '' : `${b} + `}${R}sin(t)`; ordinary = `(x ${sgn(-a)})^2 + (y ${sgn(-b)})^2 = ${R * R}`.replace(/\(x \+0\)/, 'x').replace(/\(y \+0\)/, 'y').replace(/\(x -0\)/, 'x').replace(/\(y -0\)/, 'y'); ask = 'ord'; }
  else if (kind === 'parabola') { const p = int(r, 1, 3); x = `t^2`; y = `${2 * p}t`; t0 = '-3'; t1 = '3'; ordinary = `y^2 = ${4 * p}x`; ask = 'ord'; }
  else { const a = int(r, -2, 2), b = int(r, -2, 2), c = pick(r, [1, 2, -1]), d = pick(r, [1, 2, -2]); x = `${a} + ${c}t`.replace('0 + ', ''); y = `${b} + ${d}t`.replace('0 + ', ''); t0 = '-4'; t1 = '4'; ordinary = null; ask = 'xaxis'; cmdsExtra = [`X = (${num(a - (c * b) / d)}, 0) #result`]; }
  const tx = (e) => e.replace(/cos\(t\)/g, '\\cos t').replace(/sin\(t\)/g, '\\sin t').replace(/t\^2/g, 't^2');
  const eqs = S.L ? `$\\begin{cases} x=${tx(x)} \\\\ y=${tx(y)} \\end{cases}$（$t$ 为参数）` : `x = ${x.replace(/\(t\)/g, ' t')}，y = ${y.replace(/\(t\)/g, ' t')}（t 为参数）`;
  const goal = ask === 'ord' ? '求曲线的普通方程' : '求直线与 x 轴的交点坐标';
  const text = S.ja ? `媒介変数 $t$ を用いて $x=${tx(x)}$，$y=${tx(y)}$ と表される曲線について，${ask === 'ord' ? '$x$，$y$ の関係式を求めよ' : '$x$ 軸との交点の座標を求めよ'}。`
    : `已知曲线 C 的参数方程为 ${eqs}，${goal}。`;
  return {
    text,
    out: out({
      title: '参数方程', category: '解析几何', knowns: [`$x=${tx(x)}$，$y=${tx(y)}$`], goal,
      layout: `用参数方程直接画出曲线（t 从 ${t0} 到 ${t1}）；拖动滑块 t，点 P 沿曲线移动。${ordinary ? `消去 t 得 ${ordinary}。` : '令 y = 0 求出 t，再代入 x。'}`,
      commands: [`Curve(${x}, ${y}, t, ${t0}, ${t1})`, `s = Slider(${t0 === '0' ? 0 : t0}, ${t1 === '2pi' ? 6.28 : t1}, 0.5)`, `P = (${x.replace(/t/g, 's')}, ${y.replace(/t/g, 's')}) #hl`, ...cmdsExtra,
        ...(ordinary ? [`Text("普通方程：${ordinary}", (-4, 4.5))`] : [])],
      insight: ordinary ? '参数方程和普通方程表示同一条曲线，消去参数 $t$ 就能互相转化。' : '直线与 $x$ 轴的交点处 $y=0$，先求出对应的 $t$。',
    }),
  };
}

// ---------- 整数：列表格，不画无关的图 ----------
export function integerTable(r, S) {
  const kind = pick(r, ['mod', 'divis', 'pairs', 'count']);
  const rows = [], head = [];
  let text, title, goal, layout, insight, knowns;
  if (kind === 'mod') {
    const b = pick(r, [2, 3]), m = pick(r, [5, 7, 9].filter((x) => x % b));
    const rem = Array.from({ length: 6 }, (_, i) => b ** (i + 1) % m);
    text = S.ja ? `$${b}^n$ を $${m}$ で割った余りを $r_n$ とする（$n$ は正の整数）。$r_{100}$ を求めよ。` : `求 ${S.L ? `$${b}^{100}$` : `${b}¹⁰⁰`} 除以 ${m} 的余数。`;
    title = '幂的余数'; goal = S.ja ? '$r_{100}$ を求めよ' : `求 $${b}^{100}$ 除以 ${m} 的余数`; knowns = [`$${b}^n$ 除以 $${m}$ 的余数`];
    head.push('Row(n, 1, 2, 3, 4, 5, 6)', `Row(余数, ${rem.join(', ')})`);
    layout = `不需要画图：列出 n = 1～6 时 ${b}ⁿ 除以 ${m} 的余数，找出循环的周期，再求第 100 项。`;
    insight = '余数是周期性出现的，找到周期就能求出很大的 $n$ 对应的余数。';
  } else if (kind === 'divis') {
    const k = pick(r, [6, 3]);
    const vals = Array.from({ length: 6 }, (_, i) => (i + 1) ** 3 - (i + 1));
    text = S.ja ? `すべての正の整数 $n$ について，$n^3-n$ は ${k} の倍数であることを示せ。` : `证明：对任意正整数 n，${S.L ? '$n^3-n$' : 'n³ − n'} 都能被 ${k} 整除。`;
    title = '整除性'; goal = `证明 $n^3-n$ 是 $${k}$ 的倍数`; knowns = ['$n$ 为正整数'];
    head.push('Row(n, 1, 2, 3, 4, 5, 6)', `Row(n^3 - n, ${vals.join(', ')})`, `Row(÷${k}, ${vals.map((v) => v / k).join(', ')})`);
    layout = '不需要画图：列出前几个 n 的值验证规律；证明时把 n³ − n 分解成 (n−1)n(n+1)，是三个连续整数的积。';
    insight = '$n^3-n=(n-1)n(n+1)$ 是三个连续整数的积，其中必有 $2$ 的倍数和 $3$ 的倍数。';
  } else if (kind === 'pairs') {
    const N = pick(r, [12, 18, 20, 24, 28, 30, 36]);
    const ps = []; for (let a = 1; a * a <= N; a++) if (N % a === 0) ps.push([a, N / a]);
    text = S.ja ? `$ab=${N}$，$a ${'\\leqq'} b$ を満たす正の整数の組 $(a,\\,b)$ をすべて求めよ。` : `求满足 ${S.L ? `$ab=${N}$` : `ab = ${N}`}，且 a ≤ b 的所有正整数对 (a, b)。`;
    title = '因数的组合'; goal = `求所有 $(a,b)$`; knowns = [`$ab=${N}$，$a\\le b$`];
    head.push(`Row(a, ${ps.map((p) => p[0]).join(', ')})`, `Row(b, ${ps.map((p) => p[1]).join(', ')})`);
    layout = `不需要画图：从 a = 1 开始试，a 是 ${N} 的约数且 a ≤ b，列成表格。`;
    insight = `$${N}$ 有 ${ps.length * 2 - (Math.sqrt(N) % 1 === 0 ? 1 : 0)} 个正约数，两两配对。`;
  } else {
    const N = pick(r, [50, 60, 100, 120]), p = pick(r, [2, 3]), q = pick(r, [5, 7]);
    const fp = Math.floor(N / p), fq = Math.floor(N / q), fpq = Math.floor(N / (p * q));
    text = S.ja ? `1 から ${N} までの整数のうち，${p} の倍数または ${q} の倍数であるものの個数を求めよ。` : `在 1 到 ${N} 的整数中，求是 ${p} 的倍数或 ${q} 的倍数的数的个数。`;
    title = '倍数的个数'; goal = '求个数'; knowns = [`$1$～$${N}$ 的整数`];
    head.push(`Row(${p} 的倍数, ${fp})`, `Row(${q} 的倍数, ${fq})`, `Row(${p * q} 的倍数, ${fpq})`, `Row(合计, ${fp} + ${fq} - ${fpq})`);
    layout = '不需要画图：用容斥原理，两类倍数的个数相加，再减去重复计算的公倍数的个数。';
    insight = `个数 $=${fp}+${fq}-${fpq}=${fp + fq - fpq}$。`;
  }
  return {
    text,
    out: out({ title, category: '其他', knowns, goal, layout, commands: ['ShowAxes(false)', `Table(${title})`, ...head], insight }),
  };
}

// ---------- 递推数列：列表格并描点 ----------
export function recurrence(r, S) {
  const kind = pick(r, ['linear', 'linear', 'plusn']);
  const a1 = int(r, 1, 4);
  let p = 1, q = 0, rule, terms = [a1];
  if (kind === 'linear') { p = pick(r, [2, 3]); q = pick(r, [-1, 1, 2, -2]); rule = { L: `a_{n+1}=${p}a_n${sgn(q)}`, P: `aₙ₊₁ = ${p}aₙ ${q < 0 ? '−' : '+'} ${Math.abs(q)}`, J: `a_{n+1}=${p}a_n${sgn(q)}` }; for (let i = 1; i < 5; i++) terms.push(p * terms[i - 1] + q); }
  else { rule = { L: 'a_{n+1}=a_n+n', P: 'aₙ₊₁ = aₙ + n', J: 'a_{n+1}=a_n+n' }; for (let i = 1; i < 5; i++) terms.push(terms[i - 1] + i); }
  const text = S.ja ? `数列 $\\{a_n\\}$ を $a_1=${a1}$，$${rule.J}$ $(n=1,2,3,\\cdots)$ で定める。一般項 $a_n$ を求めよ。`
    : `已知数列 ${S.L ? '$\\{a_n\\}$' : '{aₙ}'} 满足 ${S.L ? `$a_1=${a1}$，$${rule.L}$` : `a₁ = ${a1}，${rule.P}`}，求数列的通项公式。`;
  const pts = terms.map((v, i) => `P${i + 1} = (${i + 1}, ${v})`);
  return {
    text,
    out: out({
      title: '递推数列', category: '数列', knowns: [`$a_1=${a1}$，$${rule.L}$`], goal: '求通项 $a_n$',
      layout: `先按递推式算出前 5 项：${terms.join('，')}，列成表格，并画成点 (n, aₙ) 观察变化；${kind === 'linear' ? `两边加上 ${num(q / (p - 1))}，化成等比数列。` : '用累加法求通项。'}`,
      commands: ['Table(前 5 项)', `Row(n, 1, 2, 3, 4, 5)`, `Row(a_n, ${terms.join(', ')})`, ...pts, 'Polyline(P1, P2, P3, P4, P5) #aux'],
      insight: kind === 'linear' ? `$a_{n+1}+${num(q / (p - 1))}=${p}(a_n+${num(q / (p - 1))})$，所以 $\\{a_n+${num(q / (p - 1))}\\}$ 是公比为 $${p}$ 的等比数列。` : '$a_n=a_1+1+2+\\cdots+(n-1)$。',
    }),
  };
}
