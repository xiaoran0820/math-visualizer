// 第四版补充：主攻需要画图的题（2026-11-13）。依据是过去问第二组开发集上第三版画错的题：
// 复数平面上用 cosθ + i sinθ 给出的点、坐标里带参数的立体、积分定义的函数；另外补圆上的点（等弦、直径）
// 和含根式的代数题（列表格，不画无关的图）。不仿照任何一道真题，也避开了第二组测试集里的题型
// （正多边形相邻顶点的三角形、二次方程的复数根、两圆的公共弦、内切圆、½∫₋ₓˣ 1/(1+u²)du 等）。
import { pick, int, num, out } from './util.js';

const cplx = (a, b) => `${num(a)}${b === 0 ? '' : `${b < 0 ? '-' : '+'}${Math.abs(b) === 1 ? '' : num(Math.abs(b))}i`}`;
const PI_TEX = { 0: '0', 30: '\\frac{\\pi}{6}', 45: '\\frac{\\pi}{4}', 60: '\\frac{\\pi}{3}', 90: '\\frac{\\pi}{2}', 120: '\\frac{2\\pi}{3}', 135: '\\frac{3\\pi}{4}', 150: '\\frac{5\\pi}{6}', 180: '\\pi' };
const PI_PLAIN = { 0: '0', 30: 'π/6', 45: 'π/4', 60: 'π/3', 90: 'π/2', 120: '2π/3', 135: '3π/4', 150: '5π/6', 180: 'π' };
const polyT = (b, c, v = 't') => `${v}^2${b === 0 ? '' : `${b < 0 ? '-' : '+'}${Math.abs(b) === 1 ? '' : Math.abs(b)}${v}`}${c === 0 ? '' : `${c < 0 ? '-' : '+'}${Math.abs(c)}`}`; // t^2-3t+2
const sup = (s) => s.replace(/\^2/g, '²');
const k1 = (k) => (k === 1 ? '' : String(k)); // 系数 1 不写：cos(90°)，不写成 1cos(90°)

// ---------- 复数的极形式：乘法是旋转、关于直线的对称、乘方 ----------
export function complexPolar(r, S) {
  const kind = pick(r, ['rotate', 'reflect', 'power']);
  const ang = (d) => (S.L ? PI_TEX[d] : PI_PLAIN[d]);
  if (kind === 'rotate') {
    const d = pick(r, [30, 45, 60, 90, 120, 135, 150]);
    let a, b;
    do { a = int(r, -3, 4); b = int(r, -3, 4); } while (a === 0 && b === 0);
    const z = cplx(a, b);
    const w = S.L ? `\\cos${ang(d)}+i\\sin${ang(d)}` : `cos(${ang(d)}) + i·sin(${ang(d)})`;
    const text = S.ja ? `複素数平面上で，$z=${z}$ を表す点を A とする。$w=${w}$ とするとき，$zw$ を表す点 B を図示し，B の座標を求めよ。`
      : S.L ? `在复平面内，复数 $z=${z}$ 对应的点为 A，$w=${w}$。画出 $zw$ 对应的点 B，并求 B 的坐标。`
        : `在复平面内，复数 z = ${z} 对应的点为 A，w = ${w}。画出 zw 对应的点 B，并求 B 的坐标。`;
    return {
      text,
      out: out({
        title: '复数乘法与旋转', category: '其他', knowns: [`$z=${z}$`, `$w=\\cos${PI_TEX[d]}+i\\sin${PI_TEX[d]}$`], goal: '画出 $zw$ 对应的点并求坐标',
        layout: `w 的模是 1、辐角是 ${d}°，乘以 w 就是把点 A(${a}, ${b}) 绕原点逆时针旋转 ${d}°：B = Rotate(A, ${d}°, O)，坐标由程序计算。`,
        commands: ['O = (0, 0)', `A = (${a}, ${b}) "z"`, `B = Rotate(A, ${d}°, O) "zw" #result`, 'Segment(O, A) #aux', 'Segment(O, B) #aux', 'Angle(A, O, B)',
          `Text("B = ({x(B)}, {y(B)})", (${num(a / 2 + 0.5)}, ${num(b / 2 + 1.5)}))`],
        insight: `乘以 $\\cos\\theta+i\\sin\\theta$ 就是绕原点旋转 $\\theta$，模不变：$|zw|=|z|$。`,
      }),
    };
  }
  if (kind === 'reflect') {
    const [al, be] = pick(r, [[0, 60], [0, 90], [0, 120], [30, 90], [30, 120], [45, 135], [60, 120], [60, 150], [90, 150], [90, 180]]);
    let a, b;
    do { a = int(r, -3, 3); b = int(r, -3, 3); } while (a === 0 && b === 0);
    const z = cplx(a, b);
    const e = (d) => (S.L ? `e\\left(${PI_TEX[d]}\\right)` : `e(${PI_PLAIN[d]})`);
    const def = S.L ? '$e(\\theta)=\\cos\\theta+i\\sin\\theta$' : 'e(θ) = cos θ + i·sin θ';
    const text = S.ja ? `実数 $\\theta$ に対して $e(\\theta)=\\cos\\theta+i\\sin\\theta$ とする。複素数平面上の 2 点 $${e(al)}$，$${e(be)}$ を通る直線を $\\ell$ とする。$z=${z}$ と直線 $\\ell$ に関して対称な点を表す複素数を求めよ。`
      : S.L ? `设 ${def}。复平面上过点 $${e(al)}$ 和 $${e(be)}$ 的直线为 $\\ell$，求复数 $z=${z}$ 对应的点关于 $\\ell$ 的对称点所对应的复数。`
        : `设 ${def}。复平面上过点 ${e(al)} 和 ${e(be)} 的直线为 l，求复数 z = ${z} 对应的点关于 l 的对称点所对应的复数。`;
    return {
      text,
      out: out({
        title: '关于直线的对称点', category: '其他', knowns: [`$e(\\theta)=\\cos\\theta+i\\sin\\theta$`, `$z=${z}$`], goal: '求 $z$ 关于直线 $\\ell$ 的对称点',
        layout: `e(θ) 是单位圆上辐角为 θ 的点：P(cos${al}°, sin${al}°)、Q(cos${be}°, sin${be}°)，直线 ℓ 过 P、Q；Z(${a}, ${b}) 关于 ℓ 的对称点用 Reflect 由程序计算。`,
        commands: ['O = (0, 0)', 'Circle(O, 1) #aux', `P = (cos(${al}°), sin(${al}°))`, `Q = (cos(${be}°), sin(${be}°))`, 'l = Line(P, Q)', `Z = (${a}, ${b}) "z"`,
          "Z' = Reflect(Z, l) #result", "Segment(Z, Z') #aux", `Text("对称点 ({x(Z')}, {y(Z')})", (${num(a + 0.5)}, ${num(b + 1)}))`],
        insight: '关于直线的对称点：连线和直线垂直，中点在直线上。',
      }),
    };
  }
  const d = pick(r, [30, 45, 60, 90]), m = pick(r, [1, 1, 2]);
  const zt = S.L ? `${m === 1 ? '' : m}\\left(\\cos${ang(d)}+i\\sin${ang(d)}\\right)` : `${m === 1 ? '' : m}(cos(${ang(d)}) + i·sin(${ang(d)}))`;
  const text = S.ja ? `$z=${zt}$ のとき，$z$，$z^2$，$z^3$ を表す点を複素数平面上に図示し，$z^3$ を求めよ。`
    : S.L ? `已知 $z=${zt}$，在复平面上画出 $z$、$z^2$、$z^3$ 对应的点，并求 $z^3$。`
      : `已知 z = ${zt}，在复平面上画出 z、z²、z³ 对应的点，并求 z³。`;
  return {
    text,
    out: out({
      title: '复数的乘方', category: '其他', knowns: [`$z=${m === 1 ? '' : m}(\\cos${PI_TEX[d]}+i\\sin${PI_TEX[d]})$`], goal: '画出 $z$、$z^2$、$z^3$ 并求 $z^3$',
      layout: `棣莫弗公式：zⁿ 的模是 ${m}ⁿ、辐角是 n·${d}°。A、B、C 分别是 z、z²、z³ 对应的点，坐标由程序计算。`,
      commands: ['O = (0, 0)', `A = (${k1(m)}cos(${d}°), ${k1(m)}sin(${d}°)) "z"`, `B = (${k1(m * m)}cos(${2 * d}°), ${k1(m * m)}sin(${2 * d}°)) "z²"`, `C = (${k1(m ** 3)}cos(${3 * d}°), ${k1(m ** 3)}sin(${3 * d}°)) "z³" #result`,
        'Segment(O, A) #aux', 'Segment(O, B) #aux', 'Segment(O, C) #aux', 'Angle(A, O, B)', `Text("z³ = {x(C)} + ({y(C)})i", (0.5, ${num(m ** 3 + 1)}))`],
      insight: `每乘一次 $z$，模乘 ${m}，辐角加 ${d}°。`,
    }),
  };
}

// ---------- 坐标里带参数的立体：参数做成滑块，满足题目给的关系 ----------
// 关系写成 c₁a + c₂h = k（长方体写成棱长之和），参数取值多一些，题目不重样
const lin = (c1, c2, k) => `${c1 === 1 ? '' : c1}a+${c2 === 1 ? '' : c2}h=${k}`;
export function solidParam(r, S) {
  const kind = pick(r, ['pyramid', 'box', 'prism']);
  const k = int(r, 3, 9);
  const m = (s) => (S.L ? `$${s}$` : s);
  if (kind === 'box') {
    const w = pick(r, [1, 2, 3]); // OC = w·a
    const amax = k / (1 + w), best = (2 * k) / (3 * (1 + w));
    const wa = w === 1 ? 'a' : `${w}a`;
    const text = S.ja ? `直方体 OABC-DEFG を，O$(0,0,0)$，A$(a,0,0)$，C$(0,${wa},0)$，D$(0,0,h)$ となるように座標空間におく。すべての辺の長さの和が $${4 * k}$ のとき，直方体の体積 $V$ の最大値を求めよ。ただし $a>0$，$h>0$ とする。`
      : `长方体 OABC-DEFG 放在空间直角坐标系中，O${m('(0,0,0)')}，A${m('(a,0,0)')}，C${m(`(0,${wa},0)`)}，D${m('(0,0,h)')}（${m('a>0')}，${m('h>0')}）。若所有棱长之和为 ${m(String(4 * k))}，求长方体体积 ${m('V')} 的最大值。`;
    return {
      text,
      out: out({
        title: '长方体体积的最大值', category: '立体几何', knowns: [`$OA=a$，$OC=${wa}$，$OD=h$`, `棱长之和 $4(a+${wa}+h)=${4 * k}$`], goal: '求体积 $V$ 的最大值',
        layout: `棱长之和 4(${1 + w}a + h) = ${4 * k}，所以 h = ${k} − ${1 + w}a，a 用滑块（0 < a < ${num(amax)}）；V = ${w === 1 ? '' : w}a²h，求导得 a = ${num(best)} 时最大。滑块初始值放在这里。`,
        commands: [`a = Slider(0.05, ${num(amax - 0.05)}, ${num(best)})`, `h = ${k} - ${1 + w}a`, 'O = (0, 0, 0)', 'A = (a, 0, 0)', `B = (a, ${wa}, 0)`, `C = (0, ${wa}, 0)`,
          'D = (0, 0, h)', 'E = (a, 0, h)', `F = (a, ${wa}, h)`, `G = (0, ${wa}, h)`, 'Polygon(O, A, B, C)', 'Polygon(D, E, F, G)', 'Segment(O, D)', 'Segment(A, E)', 'Segment(B, F)', 'Segment(C, G)',
          `Text("V = {${w === 1 ? '' : `${w}*`}a^2*h}", (0, 0, ${k + 1}))`],
        insight: `$V=${w === 1 ? '' : w}a^2(${k}-${1 + w}a)$，在 $a=${num(best)}$ 时最大。`,
      }),
    };
  }
  const c1 = pick(r, [1, 1, 2]), c2 = pick(r, [1, 1, 2, 3]);
  const amax = k / c1, best = (2 * k) / (3 * c1);
  const rel = lin(c1, c2, k);
  const hExpr = c2 === 1 ? `${k} - ${c1 === 1 ? '' : `${c1}`}a` : `(${k} - ${c1 === 1 ? '' : `${c1}`}a)/${c2}`;
  if (kind === 'pyramid') {
    const pts = `O${m('(0,0,0)')}，A${m('(a,0,0)')}，B${m('(a,a,0)')}，C${m('(0,a,0)')}`;
    const text = S.ja ? `$a>0$，$h>0$，$${rel}$ とする。座標空間の 4 点 O$(0,0,0)$，A$(a,0,0)$，B$(a,a,0)$，C$(0,a,0)$ を頂点とする正方形を底面とし，P$(0,0,h)$ を頂点とする四角錐の体積 $V$ の最大値を求めよ。`
      : `在空间直角坐标系中，四棱锥 P-OABC 的底面是正方形 OABC，${pts}，顶点 P${m('(0,0,h)')}，其中 ${m('a>0')}，${m('h>0')}，${m(rel)}。求四棱锥的体积 ${m('V')} 的最大值。`;
    return {
      text,
      out: out({
        title: '体积的最大值', category: '立体几何', knowns: ['底面是正方形 $OABC$，边长 $a$', `高 $h$，$${rel}$`], goal: '求体积 $V$ 的最大值',
        layout: `a 用滑块（0 < a < ${num(amax)}），h = ${hExpr} 由程序算；V = a²h/3，求导得 a = ${num(best)} 时最大。滑块初始值放在这里。`,
        commands: [`a = Slider(0.05, ${num(amax - 0.05)}, ${num(best)})`, `h = ${hExpr}`, 'O = (0, 0, 0)', 'A = (a, 0, 0)', 'B = (a, a, 0)', 'C = (0, a, 0)', 'P = (0, 0, h)',
          'Polygon(O, A, B, C)', 'Segment(P, O)', 'Segment(P, A)', 'Segment(P, B)', 'Segment(P, C)', `Text("V = a²h/3 = {a^2*h/3}", (0, 0, ${k + 1}))`],
        insight: `把 $h$ 用 $a$ 表示，$V$ 就是 $a$ 的三次函数，在 $a=${num(best)}$ 时取最大值。`,
      }),
    };
  }
  const text = S.ja ? `$a>0$，$h>0$，$${rel}$ とする。座標空間の 3 点 A$(0,0,0)$，B$(a,0,0)$，C$(0,a,0)$ を頂点とする三角形を底面とし，高さが $h$ の三角柱 ABC-DEF（D$(0,0,h)$）の体積の最大値を求めよ。`
    : `直三棱柱 ABC-DEF 的底面顶点为 A${m('(0,0,0)')}，B${m('(a,0,0)')}，C${m('(0,a,0)')}，侧棱 AD 在 z 轴上，D${m('(0,0,h)')}，其中 ${m('a>0')}，${m('h>0')}，${m(rel)}。求三棱柱体积的最大值。`;
  return {
    text,
    out: out({
      title: '三棱柱体积的最大值', category: '立体几何', knowns: ['底面是直角边为 $a$ 的等腰直角三角形', `高 $h$，$${rel}$`], goal: '求体积的最大值',
      layout: `a 用滑块（0 < a < ${num(amax)}），h = ${hExpr}；E、F 是 B、C 向上平移 h 得到的点。V = a²h/2，求导得 a = ${num(best)} 时最大。`,
      commands: [`a = Slider(0.05, ${num(amax - 0.05)}, ${num(best)})`, `h = ${hExpr}`, 'A = (0, 0, 0)', 'B = (a, 0, 0)', 'C = (0, a, 0)', 'D = (0, 0, h)', 'E = (a, 0, h)', 'F = (0, a, h)',
        'Polygon(A, B, C)', 'Polygon(D, E, F)', 'Segment(A, D)', 'Segment(B, E)', 'Segment(C, F)', `Text("V = a²h/2 = {a^2*h/2}", (0, 0, ${k + 1}))`],
      insight: `把 $h$ 用 $a$ 表示，$V$ 就是 $a$ 的三次函数，在 $a=${num(best)}$ 时取最大值。`,
    }),
  };
}

// ---------- 积分定义的函数：∫ᴸˣ f(t)dt、∫ₓˣ⁺ʷ g(t)dt、∫ᴸᴸ⁺ᵐ |t − x| dt ----------
// a t² + b t + c（a = ±1）的写法
const quadT = (a, b, c, v = 't') => {
  const sgn = (n, first) => (n < 0 ? '-' : first ? '' : '+');
  const term = (n, s) => (n === 0 ? '' : `${sgn(n, false)}${Math.abs(n) === 1 && s ? '' : Math.abs(n)}${s}`);
  return `${a < 0 ? '-' : ''}${v}^2${term(b, v)}${term(c, '')}`;
};
export function integralFunction(r, S) {
  const kind = pick(r, ['cumulative', 'cumulative', 'window', 'absolute']);
  if (kind === 'cumulative') {
    const s = pick(r, [1, 1, -1]), p = int(r, -3, 2), q = p + int(r, 1, 4), L = pick(r, [0, 0, 1]);
    const ft = quadT(s, -s * (p + q), s * p * q), fx = quadT(s, -s * (p + q), s * p * q, 'x');
    const [mx, mn] = s > 0 ? [p, q] : [q, p];
    const text = S.ja ? `関数 $F(x)=\\int_${L}^x (${ft})\\,dt$ の極値を求めよ。`
      : S.L ? `已知函数 $F(x)=\\int_${L}^x (${ft})\\,dt$，求 $F(x)$ 的极值。` : `已知函数 F(x) = ∫${L === 0 ? '₀' : '₁'}ˣ (${sup(ft)}) dt，求 F(x) 的极值。`;
    return {
      text,
      out: out({
        title: '积分定义的函数的极值', category: '函数', knowns: [`$F(x)=\\int_${L}^x (${ft})\\,dt$`], goal: '求 $F(x)$ 的极值',
        layout: `F'(x) = f(x) = ${sup(fx)}，在 x = ${mx} 由正变负（极大）、x = ${mn} 由负变正（极小）。F(x) = Integral(f, ${L}, x) 由程序计算。`,
        commands: [`f(x) = ${fx} #aux`, `F(x) = Integral(f, ${L}, x) #hl`, `A = (${mx}, F(${mx})) "极大"`, `B = (${mn}, F(${mn})) "极小"`,
          `Text("极大值 F(${mx}) = {F(${mx})}，极小值 F(${mn}) = {F(${mn})}", (${num(Math.max(p, q) + 0.5)}, 3))`],
        insight: "$F'(x)=f(x)$：被积函数变号的地方就是 $F(x)$ 的极值点。",
      }),
    };
  }
  if (kind === 'window') {
    const c = int(r, -2, 3), w = pick(r, [1, 1, 2]), abs = pick(r, [false, false, true]);
    const sh = c === 0 ? 't' : `t${c < 0 ? '+' : '-'}${Math.abs(c)}`;
    const gt = abs ? `|${sh}|` : c === 0 ? 't^2' : `(${sh})^2`, gx = gt.replace(/t/g, 'x');
    const up = w === 1 ? 'x+1' : 'x+2', at = num(c - w / 2);
    const text = S.ja ? `関数 $f(x)=\\int_x^{${up}} ${gt}\\,dt$ の最小値と，そのときの $x$ の値を求めよ。`
      : S.L ? `已知函数 $f(x)=\\int_x^{${up}} ${gt}\\,dt$，求 $f(x)$ 的最小值及此时 $x$ 的值。` : `已知函数 f(x) = ∫ₓ^(${up}) ${sup(gt)} dt，求 f(x) 的最小值及此时 x 的值。`;
    return {
      text,
      out: out({
        title: '积分区间移动的函数', category: '函数', knowns: [`$f(x)=\\int_x^{${up}} ${gt}\\,dt$`], goal: '求 $f(x)$ 的最小值',
        layout: `被积函数 g(x) = ${sup(gx)}；f(x) = Integral(g, x, ${up.replace('+', ' + ')}) 由程序计算。区间 [x, ${up}] 关于 t = ${c} 对称时最小，即 x = ${at}。`,
        commands: [`g(x) = ${abs ? `abs(${gx.slice(1, -1)})` : gx} #aux`, `f(x) = Integral(g, x, ${up.replace('+', ' + ')}) #hl`, `M = (${at}, f(${at})) "最小" #result`,
          `Text("最小值 f(${at}) = {f(${at})}", (${num(c + 1)}, 2))`],
        insight: `$f(x)$ 是曲线在宽为 ${w} 的区间上的面积，区间对着曲线的最低点时最小。`,
      }),
    };
  }
  const mm = int(r, 1, 4), L = pick(r, [0, 0, -1, 1]);
  const lo = String(L), hi = String(L + mm), mid = num(L + mm / 2);
  const text = S.ja ? `関数 $f(x)=\\int_{${lo}}^{${hi}} |t-x|\\,dt$ の最小値を求めよ。`
    : S.L ? `已知函数 $f(x)=\\int_{${lo}}^{${hi}} |t-x|\\,dt$，求 $f(x)$ 的最小值。` : `已知函数 f(x) = ∫(${lo}→${hi}) |t − x| dt，求 f(x) 的最小值。`;
  return {
    text,
    out: out({
      title: '含绝对值的积分', category: '函数', knowns: [`$f(x)=\\int_{${lo}}^{${hi}} |t-x|\\,dt$`], goal: '求 $f(x)$ 的最小值',
      layout: `t 是积分变量、x 是参数：f(x) = Integral(abs(t − x), ${lo}, ${hi}) 由程序计算。x 在区间中点 ${mid} 时最小，最小值 ${num(mm * mm / 4)}。`,
      commands: [`f(x) = Integral(abs(t - x), ${lo}, ${hi}) #hl`, `M = (${mid}, f(${mid})) "最小" #result`, `Text("最小值 f(${mid}) = {f(${mid})}", (${mid}, ${num(mm * mm / 4 + 1.5)}))`],
      insight: `$|t-x|$ 的积分是两块三角形的面积之和，$x$ 在中点时最小。`,
    }),
  };
}

// ---------- 圆上的点：等弦、直径所对的圆周角、弦心距 ----------
export function circleChords(r, S) {
  const kind = pick(r, ['equal', 'equal', 'right', 'dist']);
  const R = int(r, 2, 7);
  if (kind === 'equal') {
    const n = pick(r, [2, 3, 4]);
    const names = ['A', 'B', 'C', 'D', 'E'].slice(0, n + 1);
    const first = names[0], last = names[n];
    const eqs = names.slice(0, n).map((x, i) => `${x}${names[i + 1]}`).join(' = ');
    const poly = ['', '', '三角形', '四边形', '五边形'][n], polyJa = ['', '', '三角形', '四角形', '五角形'][n];
    const ask = n >= 3 ? pick(r, ['area', 'diag']) : 'area';
    const qZh = ask === 'area' ? `求 ${first}${names[1]} 的长和${poly} ${names.join('')} 的面积` : `求 ${first}${names[1]}、${first}${names[2]} 的长`;
    const qJa = ask === 'area' ? `${first}${names[1]} の長さと${polyJa} ${names.join('')} の面積を求めよ` : `${first}${names[1]}，${first}${names[2]} の長さを求めよ`;
    const text = S.ja ? `半径 $${R}$ の円 O の周上に ${names.join('，')} がこの順に並び，${first}${last} は直径で，${S.L ? `$${eqs}$` : eqs} であるとする。${qJa}。`
      : `圆 O 的半径为 ${S.L ? `$${R}$` : R}，${names.join('、')} 依次在圆上，${first}${last} 是直径，且 ${S.L ? `$${eqs}$` : eqs}。${qZh}。`;
    const step = 180 / n;
    const pts = names.slice(1, n).map((x, i) => `${x} = Rotate(${first}, ${num(-(i + 1) * step)}°, O)`);
    const show = ask === 'area' ? `"${first}${names[1]} = {Distance(${first}, ${names[1]})}，面积 {Area(Polygon(${names.join(', ')}))}"` : `"${first}${names[1]} = {Distance(${first}, ${names[1]})}，${first}${names[2]} = {Distance(${first}, ${names[2]})}"`;
    return {
      text,
      out: out({
        title: '圆上的等弦', category: '平面几何', knowns: [`半径 $${R}$`, `$${first}${last}$ 是直径`, `$${eqs}$`], goal: ask === 'area' ? `求 $${first}${names[1]}$ 和面积` : `求 $${first}${names[1]}$、$${first}${names[2]}$`,
        layout: `等弦对等圆心角：半圆被分成 ${n} 份，每份圆心角 ${num(step)}°。取 ${first}(${-R}, 0)、${last}(${R}, 0)，其余点由 ${first} 绕 O 依次转 ${num(step)}° 得到，长度、面积由程序计算。`,
        commands: ['O = (0, 0)', `Circle(O, ${R})`, `${first} = (${-R}, 0)`, `${last} = (${R}, 0)`, ...pts, `Segment(${first}, ${last}) #aux`, `Polygon(${names.join(', ')}) #hl`,
          ...(ask === 'diag' ? [`Segment(${first}, ${names[2]}) #hl`] : []), `Text(${show}, (${-R}, ${num(R + 1)}))`],
        insight: `相等的弦所对的圆心角相等，每段弦长 $2\\cdot${R}\\sin${num(step / 2)}^\\circ$。`,
      }),
    };
  }
  if (kind === 'right') {
    const [p, q, dd] = pick(r, [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [9, 12, 15], [12, 9, 15], [7, 24, 25]]);
    const ask = pick(r, ['area', 'height']);
    const qZh = ask === 'area' ? `求圆 O 的半径和 ${S.L ? '$\\triangle ABC$' : '△ABC'} 的面积` : '求圆 O 的半径和点 B 到 AC 的距离';
    const qJa = ask === 'area' ? '円 O の半径と三角形 ABC の面積を求めよ' : '円 O の半径と，点 B から直線 AC までの距離を求めよ';
    const text = S.ja ? `円 O に内接する三角形 ABC において，AC は直径で，$AB=${p}$，$BC=${q}$ である。${qJa}。`
      : `${S.L ? '$\\triangle ABC$' : '△ABC'} 内接于圆 O，AC 是直径，${S.L ? `$AB=${p}$` : `AB = ${p}`}，${S.L ? `$BC=${q}$` : `BC = ${q}`}。${qZh}。`;
    return {
      text,
      out: out({
        title: '直径所对的圆周角', category: '平面几何', knowns: ['$AC$ 是直径', `$AB=${p}$，$BC=${q}$`], goal: ask === 'area' ? '求半径和面积' : '求半径和 $B$ 到 $AC$ 的距离',
        layout: `直径所对的圆周角是直角，AC = √(${p}²+${q}²) = ${dd}，半径 ${num(dd / 2)}。取 A(${num(-dd / 2)}, 0)、C(${num(dd / 2)}, 0)，B 是圆与以 A 为圆心、半径 ${p} 的圆的交点，由程序计算。`,
        commands: ['O = (0, 0)', `c = Circle(O, ${num(dd / 2)})`, `A = (${num(-dd / 2)}, 0)`, `C = (${num(dd / 2)}, 0)`, `B = Intersect(c, Circle(A, ${p}), 1)`, 'Polygon(A, B, C) #hl', 'Angle(A, B, C)',
          ...(ask === 'height' ? ['H = Foot(B, Line(A, C))', 'Segment(B, H) #hl', `Text("半径 ${num(dd / 2)}，BH = {Distance(B, H)}", (${num(-dd / 2)}, ${num(dd / 2 + 1)}))`]
            : [`Text("半径 ${num(dd / 2)}，面积 {Area(Polygon(A, B, C))}", (${num(-dd / 2)}, ${num(dd / 2 + 1)}))`])],
        insight: ask === 'area' ? '直径所对的圆周角是直角，面积是两条直角边乘积的一半。' : `直角三角形斜边上的高 $=\\frac{${p}\\times${q}}{${dd}}$。`,
      }),
    };
  }
  const c = 2 * int(r, 1, R - 1); // 弦长，比直径短
  const d = Math.sqrt(R * R - (c / 2) ** 2);
  const text = S.ja ? `半径 $${R}$ の円 O において，長さ $${c}$ の弦 AB がある。円の中心 O から弦 AB までの距離を求めよ。`
    : `圆 O 的半径为 ${S.L ? `$${R}$` : R}，弦 AB 的长为 ${S.L ? `$${c}$` : c}。求圆心 O 到弦 AB 的距离。`;
  return {
    text,
    out: out({
      title: '弦心距', category: '平面几何', knowns: [`半径 $${R}$`, `弦 $AB=${c}$`], goal: '求圆心到弦的距离',
      layout: `圆心到弦的垂线平分弦：取 M(0, ${num(-d)}) 为 AB 的中点，A(${-c / 2}, y)、B(${c / 2}, y) 在圆上，OM = √(${R}² − ${c / 2}²)，由程序计算。`,
      commands: ['O = (0, 0)', `Circle(O, ${R})`, `A = (${-c / 2}, -sqrt(${R}^2 - ${(c / 2) ** 2}))`, `B = (${c / 2}, -sqrt(${R}^2 - ${(c / 2) ** 2}))`, 'Segment(A, B) #hl',
        'M = Midpoint(A, B)', 'Segment(O, M) #hl', 'Segment(O, A) #aux', 'Angle(O, M, B)', `Text("OM = {Distance(O, M)}", (0.5, ${num(-d / 2)}))`],
      insight: '圆心到弦的垂线平分弦：$OM^2+\\left(\\frac{AB}{2}\\right)^2=r^2$。',
    }),
  };
}

// ---------- 含根式的数：列表格，不画无关的图 ----------
export function radicalTable(r, S) {
  const a = int(r, 1, 4), b = pick(r, [2, 3, 5, 6, 7]), sg = pick(r, [1, -1]);
  const kind = pick(r, ['value', 'pair']);
  const x = `${a}${sg > 0 ? '+' : '-'}\\sqrt{${b}}`, xp = `${a} ${sg > 0 ? '+' : '−'} √${b}`;
  const xm = (s) => (S.L ? `$${s}$` : s);
  if (kind === 'value') {
    const q = `x^2-${2 * a}x`, qp = `x² − ${2 * a}x`;
    const text = S.ja ? `$x=${x}$ のとき，$${q}$ の値を求めよ。また，$x$ を解にもつ有理数係数の 2 次方程式を 1 つ求めよ。`
      : `设 ${xm(S.L ? `x=${x}` : `x = ${xp}`)}，求 ${xm(S.L ? q : qp)} 的值，并写出一个以 ${xm('x')} 为根、系数都是有理数的二次方程。`;
    return {
      text,
      out: out({
        title: '含根式的数的值', category: '代数方程', knowns: [`$x=${x}$`], goal: `求 $${q}$ 的值和有理系数方程`,
        layout: `x − ${a} = ${sg > 0 ? '' : '−'}√${b}，两边平方得 x² − ${2 * a}x + ${a * a} = ${b}，所以 ${qp} = ${b - a * a}，方程 x² − ${2 * a}x + ${a * a - b} = 0。不需要画图，列表格。`,
        commands: [`Table(Row("x", "${xp}"), Row("${qp}", ${b - a * a}), Row("二次方程", "x² − ${2 * a}x + (${a * a - b}) = 0"))`],
        insight: `把根式移到一边再平方，根号就消掉了。`,
      }),
    };
  }
  const al = x, be = `${a}${sg > 0 ? '-' : '+'}\\sqrt{${b}}`, alp = xp, bep = `${a} ${sg > 0 ? '−' : '+'} √${b}`;
  const text = S.ja ? `$\\alpha=${al}$，$\\beta=${be}$ のとき，$\\alpha+\\beta$，$\\alpha\\beta$，$\\alpha^2+\\beta^2$ の値を求めよ。`
    : S.L ? `设 $\\alpha=${al}$，$\\beta=${be}$，求 $\\alpha+\\beta$、$\\alpha\\beta$、$\\alpha^2+\\beta^2$ 的值。`
      : `设 α = ${alp}，β = ${bep}，求 α + β、αβ、α² + β² 的值。`;
  return {
    text,
    out: out({
      title: '共轭根式的对称式', category: '代数方程', knowns: [`$\\alpha=${al}$，$\\beta=${be}$`], goal: '求 $\\alpha+\\beta$、$\\alpha\\beta$、$\\alpha^2+\\beta^2$',
      layout: `α + β = ${2 * a}，αβ = ${a * a} − ${b} = ${a * a - b}，α² + β² = (α + β)² − 2αβ = ${4 * a * a - 2 * (a * a - b)}。不需要画图，列表格。`,
      commands: [`Table(Row("α + β", ${2 * a}), Row("αβ", ${a * a - b}), Row("α² + β²", ${4 * a * a - 2 * (a * a - b)}))`],
      insight: '先算 $\\alpha+\\beta$ 和 $\\alpha\\beta$，其他对称式都能用它们表示。',
    }),
  };
}
