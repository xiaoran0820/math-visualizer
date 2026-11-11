// “看图识别”训练用的题目文字：程序随机生成，不来自任何真题。
// 输出的 text 就是标准答案（App 识别结果的格式：数学式用 LaTeX，行内 $...$、独立 $$...$$，小问各占一行，
// 有图时最后一行起写【图形】）；html 是同一内容排版后的样子，交给 render 渲染成图片。
import katex from 'katex';
import { rng, pick, int, shuffle, poly, tex } from '../gen/util.js';
import { generate } from '../gen/build.js';

const K = (t, display = false) => katex.renderToString(t, { displayMode: display, throwOnError: true, output: 'html' });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------- 数学式的小零件 ----------------
const nz = (r, lo, hi) => { let v = 0; while (!v) v = int(r, lo, hi); return v; };
const P = (r, deg, v = 'x', lo = -5, hi = 5) => tex(poly(Array.from({ length: deg + 1 }, (_, i) => (i === 0 ? nz(r, 1, 3) * (r() < 0.3 ? -1 : 1) : int(r, lo, hi))), v));
const FR = (a, b) => `\\frac{${a}}{${b}}`;
const VAR = (r) => pick(r, ['a', 'k', 'm', 'p', 't']);
const PT = (r) => pick(r, [['A', 'B', 'C'], ['P', 'Q', 'R'], ['A', 'B', 'C']]);

// 不等号：日文试卷常用 ≦ ≧，中文用 ≤ ≥
const LE = (ja) => (ja ? '\\leqq' : '\\le');
const GE = (ja) => (ja ? '\\geqq' : '\\ge');

// ---------------- 日文（大学入试风格） ----------------
const JA = [
  (r) => { const a = VAR(r); return { stem: [`${a} を実数とする。関数 $f(x)=${P(r, 3)}$ について，次の問いに答えよ。`], subs: [`$f(x)$ の極値を求めよ。`, `曲線 $y=f(x)$ と直線 $y=${a}$ の共有点がちょうど $3$ 個となるような ${a} の値の範囲を求めよ。`] }; },
  (r) => { const n = int(r, 2, 4); return { stem: [`関数`, `$$f(x)=\\int_{0}^{x} (x-t)e^{-${n}t}\\,dt$$`, `を考える。`], subs: [`$f'(x)$ を求めよ。`, `$\\displaystyle\\lim_{x \\to \\infty} f(x)$ を求めよ。`] }; },
  (r) => { const a = int(r, 2, 6), d = int(r, 1, 5); return { stem: [`数列 $\\{a_n\\}$ を $a_1=${a}$，$a_{n+1}=${int(r, 2, 3)}a_n-${d}$ $(n=1,2,3,\\cdots)$ で定める。`], subs: [`$a_n$ を $n$ の式で表せ。`, `$\\displaystyle\\sum_{k=1}^{n} a_k$ を求めよ。`] }; },
  (r) => { const n = int(r, 4, 9), w = int(r, 2, n - 1); return { stem: [`袋の中に赤玉が ${w} 個，白玉が ${n - w} 個入っている。この袋から玉を 1 個取り出し，色を確かめてからもとに戻す操作を繰り返す。`], subs: [`操作を $3$ 回行うとき，赤玉がちょうど $2$ 回出る確率を求めよ。`, `赤玉が $2$ 回続けて出た時点で操作を終了する。$n$ 回目で終了する確率 $p_n$ を求めよ。`] }; },
  (r) => { const [A, B, C] = PT(r); const s = int(r, 2, 4); return { stem: [`四面体 $O${A}${B}${C}$ において，$\\overrightarrow{O${A}}=\\vec{a}$，$\\overrightarrow{O${B}}=\\vec{b}$，$\\overrightarrow{O${C}}=\\vec{c}$ とする。辺 $${A}${B}$ を $1:${s}$ に内分する点を $M$ とする。`], subs: [`$\\overrightarrow{OM}$ を $\\vec{a}$，$\\vec{b}$ を用いて表せ。`, `直線 $${C}M$ と平面 $O${A}${B}$ のなす角を $\\theta$ とするとき，$\\cos\\theta$ を求めよ。`] }; },
  (r) => { const a = int(r, 1, 3), b = int(r, 2, 5); return { stem: [`複素数平面上で，$|z-${a}i|=${b}$ を満たす点 $z$ 全体が表す図形を $C$ とする。`], subs: [`$C$ 上の点 $z$ に対し，$w=\\dfrac{1}{z}$ が描く図形を図示せよ。`, `$|w|$ の最大値を求めよ。`] }; },
  (r) => { const a = int(r, 2, 5), b = int(r, 1, a - 1); return { stem: [`楕円 $\\dfrac{x^2}{${a * a}}+\\dfrac{y^2}{${b * b}}=1$ 上の点 $P$ における接線を $\\ell$ とする。`], subs: [`$\\ell$ と $x$ 軸，$y$ 軸との交点をそれぞれ $Q$，$R$ とするとき，線分 $QR$ の長さの最小値を求めよ。`] }; },
  (r) => { const n = int(r, 2, 4); return { stem: [`$n$ を正の整数とし，`, `$$I_n=\\int_{0}^{\\frac{\\pi}{2}} \\sin^{${n}} x \\cos^{n} x\\,dx$$`, `とおく。`], subs: [`$I_1$ を求めよ。`, `$I_{n+1}$ を $I_n$ を用いて表せ。`, `$\\displaystyle\\lim_{n \\to \\infty} \\frac{I_{n+1}}{I_n}$ を求めよ。`] }; },
  (r) => { const p = pick(r, [3, 5, 7]); return { stem: [`$${p}^n$ を $${p + 1}$ で割った余りを $r_n$ とする。ただし，$n$ は正の整数である。`], subs: [`$r_1$，$r_2$，$r_3$ を求めよ。`, `$r_n$ を求めよ。`] }; },
  (r) => { const a = int(r, 1, 4); return { stem: [`座標平面上に 2 点 $A(${a},\\,0)$，$B(0,\\,${a + 1})$ がある。点 $P$ は放物線 $y=x^2$ 上を動く。`], subs: [`$\\triangle ABP$ の面積が最小となる点 $P$ の座標を求めよ。`, `そのときの面積を求めよ。`] }; },
  (r) => { const t = pick(r, ['\\frac{\\pi}{3}', '\\frac{\\pi}{4}', '\\frac{\\pi}{6}', '\\frac{2}{3}\\pi']); return { stem: [`$0 ${LE(true)} \\theta < 2\\pi$ とする。関数 $f(\\theta)=\\sin 2\\theta+2(\\sin\\theta+\\cos\\theta)$ について考える。`], subs: [`$t=\\sin\\theta+\\cos\\theta$ とおくとき，$f(\\theta)$ を $t$ の式で表せ。`, `$\\theta=${t}$ のときの $f(\\theta)$ の値を求めよ。`, `$f(\\theta)$ の最大値と最小値を求めよ。`] }; },
  (r) => { const k = int(r, 2, 5); return { stem: [`$x$，$y$ が 4 つの不等式 $x ${GE(true)} 0$，$y ${GE(true)} 0$，$x+${k}y ${LE(true)} ${k * 4}$，$${k}x+y ${LE(true)} ${k * 4}$ を満たすとき，$x+y$ の最大値を求めよ。`], subs: [] }; },
  (r) => { const a = int(r, 2, 4); return { stem: [`$a>0$ とする。2 つの曲線 $y=\\log x$ と $y=a\\sqrt{x}$ が共有点をもつような $a$ の値の範囲を求めよ。ただし，必要ならば $\\displaystyle\\lim_{x \\to \\infty}\\frac{\\log x}{\\sqrt{x}}=0$ を用いてよい。`], subs: [], extra: a }; },
  (r) => { const n = int(r, 5, 9); return { stem: [`1 から ${n} までの番号が書かれた ${n} 枚のカードから同時に 3 枚を取り出す。取り出したカードの番号の最小値を $X$ とする。`], subs: [`$X=1$ となる確率を求めよ。`, `$X$ の期待値を求めよ。`] }; },
  (r) => { const a = int(r, 1, 3), b = int(r, 2, 4); return { stem: [`座標空間に 3 点 $A(${a},\\,0,\\,0)$，$B(0,\\,${b},\\,0)$，$C(0,\\,0,\\,${a + b})$ をとる。`], subs: [`$\\triangle ABC$ の面積を求めよ。`, `原点 $O$ から平面 $ABC$ に下ろした垂線の足 $H$ の座標を求めよ。`] }; },
  (r) => { const a = int(r, 2, 5); return { stem: [`次の極限を求めよ。`], subs: [`$\\displaystyle\\lim_{n \\to \\infty}\\left(\\sqrt{n^2+${a}n}-n\\right)$`, `$\\displaystyle\\lim_{x \\to 0}\\frac{1-\\cos ${a}x}{x^2}$`] }; },
  (r) => { const m = int(r, 2, 4); return { stem: [`曲線 $C:\\ y=e^{x}$ 上の点 $(t,\\,e^{t})$ における接線を $\\ell_t$ とする。`], subs: [`$\\ell_t$ の方程式を求めよ。`, `$C$，$\\ell_{${m}}$ および $y$ 軸で囲まれた部分の面積を求めよ。`] }; },
  (r) => { const n = int(r, 3, 6); return { stem: [`正 ${n * 2} 角形の頂点から異なる 3 点を選んで三角形を作る。`], subs: [`三角形は全部でいくつできるか。`, `直角三角形はいくつできるか。`] }; },
  (r) => { const a = int(r, 1, 3); return { stem: [`$a$ を正の定数とする。$x$ の方程式`, `$$x^3-3a^2x+${a * 2}=0$$`, `が異なる 3 つの実数解をもつような $a$ の値の範囲を求めよ。`], subs: [] }; },
  (r) => { const [A, B, C] = ['A', 'B', 'C']; const b = int(r, 3, 7), c = int(r, 3, 7); return { stem: [`$\\triangle ${A}${B}${C}$ において，$${A}${B}=${c}$，$${A}${C}=${b}$，$\\angle ${B}${A}${C}=60^\\circ$ とする。`], subs: [`辺 $${B}${C}$ の長さを求めよ。`, `$\\triangle ${A}${B}${C}$ の外接円の半径を求めよ。`, `$\\angle ${A}$ の二等分線と辺 $${B}${C}$ の交点を $D$ とするとき，線分 $${A}D$ の長さを求めよ。`] }; },
];

// ---------------- 中文（高考风格） ----------------
const ZH = [
  (r) => ({ stem: [`已知函数 $f(x)=${P(r, 3)}$。`], subs: [`求 $f(x)$ 的单调区间；`, `若方程 $f(x)=m$ 有三个不同的实数根，求实数 $m$ 的取值范围。`] }),
  (r) => { const a = int(r, 2, 5), b = int(r, 1, a - 1); return { stem: [`已知椭圆 $C:\\ \\dfrac{x^2}{${a * a}}+\\dfrac{y^2}{${b * b}}=1$，直线 $l$ 过点 $(1,\\,0)$。`], subs: [`求椭圆 $C$ 的离心率；`, `若直线 $l$ 与椭圆 $C$ 交于 $A$，$B$ 两点，求 $\\triangle OAB$ 面积的最大值。`] }; },
  (r) => { const a = int(r, 1, 4), d = int(r, 2, 5); return { stem: [`已知等差数列 $\\{a_n\\}$ 的首项为 $${a}$，公差为 $${d}$，数列 $\\{b_n\\}$ 满足 $b_n=2^{a_n}$。`], subs: [`求数列 $\\{a_n\\}$ 的通项公式；`, `求数列 $\\{b_n\\}$ 的前 $n$ 项和 $S_n$。`] }; },
  (r) => { const n = int(r, 5, 9), w = int(r, 2, n - 2); return { stem: [`一个袋子中有 ${w} 个红球和 ${n - w} 个白球，从中不放回地依次取出 2 个球。`], subs: [`求第一次取到红球的概率；`, `求在第一次取到红球的条件下，第二次也取到红球的概率；`, `记取到红球的个数为 $X$，求 $X$ 的分布列和数学期望。`] }; },
  (r) => { const a = int(r, 2, 4); return { stem: [`如图，在三棱锥 $P-ABC$ 中，$PA\\perp$ 平面 $ABC$，$AB\\perp BC$，$PA=AB=BC=${a}$。`], subs: [`求证：$BC\\perp$ 平面 $PAB$；`, `求二面角 $A-PC-B$ 的余弦值。`] }; },
  (r) => { const w = pick(r, [2, 3]), phi = pick(r, ['\\frac{\\pi}{6}', '\\frac{\\pi}{3}', '-\\frac{\\pi}{6}']); return { stem: [`已知函数 $f(x)=2\\sin(${w}x+${phi})+1$。`], subs: [`求 $f(x)$ 的最小正周期；`, `求 $f(x)$ 在区间 $\\left[0,\\,\\dfrac{\\pi}{2}\\right]$ 上的最大值和最小值。`] }; },
  (r) => { const b = int(r, 1, 3); return { stem: [`已知函数 $f(x)=\\ln x-ax+\\dfrac{${b}}{x}$，其中 $a$ 为实数。`], subs: [`当 $a=1$ 时，求曲线 $y=f(x)$ 在点 $(1,\\,f(1))$ 处的切线方程；`, `讨论 $f(x)$ 的单调性。`] }; },
  (r) => { const p = int(r, 1, 4); return { stem: [`已知抛物线 $y^2=${2 * p}x$ 的焦点为 $F$，过 $F$ 的直线与抛物线交于 $A$，$B$ 两点。`], subs: [`若 $|AB|=${4 * p}$，求直线 $AB$ 的方程；`, `求 $\\overrightarrow{OA}\\cdot\\overrightarrow{OB}$ 的值。`] }; },
  (r) => { const a = int(r, 2, 5); return { stem: [`在 $\\triangle ABC$ 中，角 $A$，$B$，$C$ 的对边分别为 $a$，$b$，$c$，已知 $a=${a}$，$b\\cos C+c\\cos B=2a\\cos A$。`], subs: [`求角 $A$；`, `求 $\\triangle ABC$ 面积的最大值。`] }; },
  (r) => { const n = int(r, 3, 6); return { stem: [`已知复数 $z=\\dfrac{${n}+i}{1-i}$（$i$ 为虚数单位）。`], subs: [`求 $|z|$；`, `若复数 $z$ 在复平面内对应的点在直线 $y=x+m$ 上，求实数 $m$ 的值。`] }; },
  (r) => { const k = int(r, 2, 4); return { stem: [`设 $x$，$y$ 满足约束条件 $\\begin{cases} x+y ${GE(false)} 1 \\\\ x-y ${LE(false)} 1 \\\\ y ${LE(false)} ${k} \\end{cases}$，求 $z=2x+y$ 的最大值。`], subs: [] }; },
  (r) => { const a = int(r, 1, 3); return { stem: [`已知 $f(x)=|x-${a}|+|x+1|$。`], subs: [`解不等式 $f(x) ${GE(false)} 4$；`, `若 $f(x) ${GE(false)} m^2-2m$ 对任意实数 $x$ 恒成立，求实数 $m$ 的取值范围。`] }; },
];

// ---------------- 题号的样式（文字 + 排版） ----------------
function header(r, ja) {
  const n = int(r, 1, 6), pts = pick(r, [20, 25, 30, 35, 40, 50]);
  const styles = ja
    ? [null, null, { text: `第 ${n} 問`, html: `<div class="center"><b>第&nbsp;&nbsp;${n}&nbsp;&nbsp;問</b></div>` },
      { text: `[${n}]`, html: `<span class="num">${n}</span>`, inline: true },
      { text: `[${n}]（${pts} 点）`, html: `<div class="row"><span class="num">${n}</span><span class="right">（${pts} 点）</span></div>` },
      { text: `〔${n}〕（配点 ${pts} 点）`, html: `<div><b>〔${n}〕</b>&nbsp;&nbsp;（配点 ${pts} 点）</div>` },
      { text: `問 ${n}`, html: `<span>問 ${n}&nbsp;&nbsp;</span>`, inline: true }]
    : [null, null, { text: `${n}.`, html: `<span>${n}.&nbsp;</span>`, inline: true },
      { text: `${n}．（本小题满分 ${pts > 20 ? 12 : 10} 分）`, html: `<span>${n}．（本小题满分 ${pts > 20 ? 12 : 10} 分）</span>`, inline: true },
      { text: `第 ${n} 题`, html: `<div><b>第 ${n} 题</b></div>` }];
  return pick(r, styles);
}

// 行内：$...$ 用 KaTeX，其余转义
function inlineHtml(s) {
  return s.split(/(\$[^$]+\$)/).map((part) => (part.startsWith('$') && part.endsWith('$') && part.length > 2 ? K(part.slice(1, -1).replace(/^\\displaystyle/, '\\displaystyle ')) : esc(part))).join('');
}

// 一道题 → 文字（标准答案）和 HTML
function compose(r, { stem, subs }, ja, opts = {}) {
  const head = opts.noHeader ? null : header(r, ja);
  const comma = ja && r() < 0.5; // 有的学校用“，．”，有的用“、。”
  const fix = (s) => (ja ? (comma ? s.replace(/、/g, '，').replace(/。/g, '．') : s.replace(/，/g, '、').replace(/．/g, '。')) : s);
  const lines = [], html = [];
  if (head) lines.push(head.text);
  if (head && !head.inline) html.push(head.html);
  stem.forEach((line, i) => {
    const t = fix(line);
    lines.push(t);
    if (/^\$\$.*\$\$$/.test(t)) html.push(K(t.slice(2, -2), true));
    else html.push(`<div class="p">${i === 0 && head?.inline ? head.html : ''}${inlineHtml(t)}</div>`);
  });
  if (subs.length > 1 || (subs.length === 1 && r() < 0.5)) {
    subs.forEach((s, i) => { const t = `(${i + 1}) ${fix(s)}`; lines.push(t); html.push(`<div class="sub">${inlineHtml(t)}</div>`); });
  } else if (subs.length === 1) {
    lines[lines.length - 1] += fix(subs[0]);
    html[html.length - 1] = html[html.length - 1].replace(/<\/div>$/, `${inlineHtml(fix(subs[0]))}</div>`);
  }
  return { lines, html };
}

// ---------------- 图形（SVG）和它的【图形】描述 ----------------
const where = (p, c) => {
  const dx = p.x - c.x, dy = p.y - c.y, ax = Math.abs(dx), ay = Math.abs(dy);
  const v = dy < 0 ? '上' : '下', h = dx < 0 ? '左' : '右';
  if (ay > ax * 2) return `${v}方`;
  if (ax > ay * 2) return `${h}侧`;
  return `${h}${v}`;
};
function figTriangle(r) {
  const names = pick(r, [['A', 'B', 'C'], ['P', 'Q', 'R'], ['A', 'B', 'C']]);
  const A = { x: 120 + int(r, -40, 60), y: 30 + int(r, 0, 20) }, B = { x: 30 + int(r, 0, 30), y: 210 }, C = { x: 300 + int(r, -30, 30), y: 210 };
  const pts = [A, B, C];
  const c = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  const svg = [`<polygon points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#111" stroke-width="1.6"/>`];
  const desc = [`点 ${names[0]} 在${where(A, c)}，点 ${names[1]} 在${where(B, c)}，点 ${names[2]} 在${where(C, c)}，${names.join('、')} 两两连线，构成三角形。`];
  pts.forEach((p, i) => svg.push(`<text x="${p.x + (p.x < c.x ? -18 : 6)}" y="${p.y + (p.y < c.y ? -6 : 20)}" font-size="18" font-style="italic">${names[i]}</text>`));
  if (r() < 0.6) {
    const t = pick(r, [0.35, 0.5, 0.6]), D = { x: B.x + (C.x - B.x) * t, y: B.y + (C.y - B.y) * t };
    const dashed = r() < 0.5;
    svg.push(`<line x1="${A.x}" y1="${A.y}" x2="${D.x}" y2="${D.y}" stroke="#111" stroke-width="1.4"${dashed ? ' stroke-dasharray="6,5"' : ''}/>`, `<text x="${D.x - 6}" y="${D.y + 22}" font-size="18" font-style="italic">D</text>`);
    desc.push(`点 D 在线段 ${names[1]}${names[2]} 上，${names[0]}、D 之间连${dashed ? '虚线' : '实线'}。`);
  }
  if (r() < 0.6) {
    const v = int(r, 3, 12);
    svg.push(`<text x="${(B.x + C.x) / 2 - 6}" y="${B.y + 24}" font-size="17">${v}</text>`);
    desc.push(`${names[1]}${names[2]} 下方标有 ${v}。`);
  }
  return { svg: `<svg width="340" height="240" xmlns="http://www.w3.org/2000/svg">${svg.join('')}</svg>`, desc };
}
function figCircle(r) {
  const O = { x: 150, y: 125 }, R = 95;
  const angs = shuffle(r, [100, 200, 330, 40, 250]).slice(0, 3).sort((a, b) => a - b);
  const names = ['A', 'B', 'C'];
  const pts = angs.map((a) => ({ x: O.x + R * Math.cos((a * Math.PI) / 180), y: O.y - R * Math.sin((a * Math.PI) / 180) }));
  const svg = [`<circle cx="${O.x}" cy="${O.y}" r="${R}" fill="none" stroke="#111" stroke-width="1.6"/>`, `<circle cx="${O.x}" cy="${O.y}" r="2.5" fill="#111"/>`, `<text x="${O.x + 5}" y="${O.y + 18}" font-size="18" font-style="italic">O</text>`];
  pts.forEach((p, i) => svg.push(`<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="#111"/>`, `<text x="${p.x + (p.x < O.x ? -20 : 6)}" y="${p.y + (p.y < O.y ? -6 : 20)}" font-size="18" font-style="italic">${names[i]}</text>`));
  svg.push(`<polygon points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#111" stroke-width="1.4"/>`);
  const desc = [`以点 O 为圆心的圆，点 ${names.map((n, i) => `${n} 在圆上${where(pts[i], O)}`).join('，')}；A、B、C 两两连线。`];
  if (r() < 0.5) { svg.push(`<line x1="${O.x}" y1="${O.y}" x2="${pts[0].x}" y2="${pts[0].y}" stroke="#111" stroke-width="1.3" stroke-dasharray="6,5"/>`); desc.push('O、A 之间连虚线。'); }
  return { svg: `<svg width="320" height="260" xmlns="http://www.w3.org/2000/svg">${svg.join('')}</svg>`, desc };
}
function figGraph(r) {
  const W = 320, H = 240, ox = 150, oy = 150, s = 30;
  const a = pick(r, [1, -1]), p = int(r, -2, 2), q = int(r, -3, 2);
  const f = (x) => a * (x - p) * (x - p) + q;
  let d = '';
  for (let X = -4.5; X <= 4.5; X += 0.1) { const Y = f(X); if (Math.abs(Y) > 5) continue; d += `${d ? 'L' : 'M'}${(ox + X * s).toFixed(1)},${(oy - Y * s).toFixed(1)} `; }
  const svg = [`<line x1="10" y1="${oy}" x2="${W - 10}" y2="${oy}" stroke="#111"/>`, `<line x1="${ox}" y1="${H - 5}" x2="${ox}" y2="5" stroke="#111"/>`,
    `<text x="${W - 22}" y="${oy - 6}" font-size="17" font-style="italic">x</text>`, `<text x="${ox + 6}" y="16" font-size="17" font-style="italic">y</text>`, `<text x="${ox - 18}" y="${oy + 18}" font-size="17" font-style="italic">O</text>`,
    `<path d="${d}" fill="none" stroke="#111" stroke-width="1.6"/>`];
  const desc = [`坐标系，原点 O；一条开口向${a > 0 ? '上' : '下'}的抛物线，顶点在 ${p === 0 ? 'y 轴上' : p < 0 ? 'y 轴左侧' : 'y 轴右侧'}${q === 0 ? '、x 轴上' : q < 0 ? '、x 轴下方' : '、x 轴上方'}。`];
  return { svg: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${svg.join('')}</svg>`, desc };
}

// ---------------- 一个样本 ----------------
const FONTS = { ja: ['"Hiragino Mincho ProN", serif', '"Hiragino Mincho ProN", serif', '"Hiragino Sans GB", sans-serif'], zh: ['"Songti SC", serif', '"Songti SC", serif', '"Hiragino Sans GB", sans-serif', '"STHeiti", sans-serif'] };
export function page(r, body) {
  const fs = int(r, 18, 25), lh = pick(r, [1.7, 1.8, 1.9, 2.0]), pad = int(r, 16, 40);
  return { css: `.page{padding:${pad}px ${pad + int(r, 0, 20)}px;font-size:${fs}px;line-height:${lh};color:#111}`, width: int(r, 900, 1250), body };
}
export function sample(r, kind, ja, katexCss) {
  let lines, html;
  if (kind === 'exam') ({ lines, html } = compose(r, pick(r, ja ? JA : ZH)(r), ja));
  else ({ lines, html } = kind);
  let figure = null;
  if (r() < 0.3) figure = pick(r, [figTriangle, figCircle, figGraph])(r);
  const text = [...lines, ...(figure ? ['', '【图形】', ...figure.desc] : [])].join('\n');
  const font = pick(r, FONTS[ja ? 'ja' : 'zh']);
  const pg = page(r, html.join(''));
  const fig = figure ? `<div class="fig" style="text-align:${pick(r, ['right', 'center'])}">${figure.svg}</div>` : '';
  const doc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${katexCss}"><style>html,body{margin:0;background:#fff}${pg.css}.page{font-family:${font}}.num{display:inline-block;border:1.5px solid #111;padding:0 7px;line-height:1.3;margin-right:12px}.row{display:flex;justify-content:space-between}.center{text-align:center;margin-bottom:.6em}.sub{padding-left:1.6em;text-indent:-1.6em}.p{margin:.1em 0}.katex{font-size:1.06em}</style></head><body><div class="page">${pg.body}${fig}</div></body></html>`;
  return { text, html: doc, width: pg.width, lang: ja ? 'ja' : 'zh', figure: !!figure };
}

// 现有作图训练题（train/gen）的 LaTeX、日文写法：单个问题，加或不加题号
export function generatorProblems(seed) {
  const list = generate(6, seed, { log: () => {} }).filter((x) => x.style === 'latex' || x.style === 'ja');
  return list.map((x) => ({ text: x.text, ja: x.style === 'ja' }));
}
export function fromText(r, text, ja) {
  return compose(r, { stem: [text], subs: [] }, ja);
}
