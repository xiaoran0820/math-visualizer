// 训练数据生成器的通用工具：随机数、数字和式子的格式、题目文字的几种写法。
// 题目文字有三种写法：键盘输入（x²、√3、△ABC）、拍照识别（$x^2$、$\sqrt{3}$、$\triangle ABC$），以及日文题（识别结果的写法）。

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
export const chance = (r, p) => r() < p;
export function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 数字：整数照写，其余最多三位小数
export const num = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : String(Math.round(x * 1000) / 1000));
export const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
// 分数 p/q（约分；q = 1 时写整数）
export function frac(p, q) {
  if (q < 0) { p = -p; q = -q; }
  const g = gcd(p, q) || 1;
  p /= g; q /= g;
  return q === 1 ? String(p) : `${p}/${q}`;
}

// 多项式（系数从高次到常数项）→ 作图命令里的写法：x^2 - 2x - 3
export function poly(coefs, v = 'x') {
  const d = coefs.length - 1;
  let s = '';
  coefs.forEach((c, i) => {
    const p = d - i;
    if (!c) return;
    const sign = c < 0 ? '-' : '+';
    const a = Math.abs(c);
    const coef = p > 0 && a === 1 ? '' : num(a);
    const term = p === 0 ? num(a) : `${coef}${v}${p > 1 ? `^${p}` : ''}`;
    s += s ? ` ${sign} ${term}` : `${c < 0 ? '-' : ''}${term}`;
  });
  return s || '0';
}

// 一次式 kx + b
export const linear = (k, b) => poly([k, b]);

const SUP = { 2: '²', 3: '³', 4: '⁴' };
const SUB = '₀₁₂₃₄₅₆₇₈₉';

// 作图命令写法 → 键盘输入写法
export function plain(e) {
  return String(e)
    .replace(/\^\((\d)\)/g, (_, d) => SUP[d] || `^${d}`)
    .replace(/\^(\d)(?!\d)/g, (_, d) => SUP[d] || `^${d}`)
    .replace(/sqrt\((\d+)\)/g, '√$1')
    .replace(/sqrt\(/g, '√(')
    .replace(/pi\b/g, 'π')
    .replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/!=/g, '≠')
    .replace(/\*/g, '')
    .replace(/°/g, '°');
}

// 作图命令写法 → 识别结果的 LaTeX 写法（不含外面的 $）
export function tex(e) {
  return String(e)
    .replace(/\^\(([^()]+)\)/g, '^{$1}')
    .replace(/(?<![A-Za-z\\])(sin|cos|tan|ln|log|exp)(?![a-z])/g, '\\$1')
    .replace(/(\d*)pi\/(\d+)/g, (_, k, d) => `\\frac{${k}\\pi}{${d}}`)
    .replace(/\(([^()]+)\)\/(\d+)/g, '\\frac{$1}{$2}')
    .replace(/([A-Za-z0-9]+(?:\^\d)?)\/([A-Za-z0-9]+(?:\^\d)?)/g, '\\frac{$1}{$2}')
    .replace(/sqrt\(([^()]+)\)/g, '\\sqrt{$1}')
    .replace(/(?<![\\A-Za-z])pi\b/g, '\\pi ')
    .replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ').replace(/!=/g, '\\ne ')
    .replace(/\*/g, '\\cdot ')
    .replace(/(\d+)°/g, '$1^\\circ')
    .replace(/\s*([=+\-<>,])\s*/g, '$1')
    .replace(/\\(le|ge|ne|pi|cdot|sin|cos|tan|ln|log)(?![a-z]) ?/g, '\\$1 ')
    .replace(/\\frac\{(\d*)\\pi \}/g, '\\frac{$1\\pi}')
    .trim();
}

// 点名里的数字下标：A1 → A₁（键盘）或 A_1（LaTeX）
export const subPlain = (s) => s.replace(/([A-Z])(\d)/g, (_, a, d) => a + SUB[d]);
export const subTex = (s) => s.replace(/([A-Z])(\d)/g, '$1_$2');

// 题目文字的写法
export function style(kind) {
  const L = kind !== 'plain';
  return {
    kind,
    L,
    ja: kind === 'ja',
    m: (e) => (L ? `$${tex(e)}$` : plain(e)),
    tri: (abc) => (L ? `$\\triangle ${abc}$` : `△${abc}`),
    rt: (abc) => (L ? `$\\mathrm{Rt}\\triangle ${abc}$` : `Rt△${abc}`),
    ang: (a, v) => (L ? `$\\angle ${a}${v !== undefined ? `=${v}^\\circ` : ''}$` : `∠${a}${v !== undefined ? ` = ${v}°` : ''}`),
    perp: (a, b) => (L ? `$${a}\\perp ${b}$` : `${a}⊥${b}`),
    par: (a, b) => (L ? `$${a}\\parallel ${b}$` : `${a}∥${b}`),
    eq: (a, v) => (L ? `$${a}=${tex(String(v))}$` : `${a} = ${plain(String(v))}`),
    odot: (o) => (L ? `$\\odot ${o}$` : `⊙${o}`),
    sub: (s) => (L ? `$${subTex(s)}$` : subPlain(s)),
    v: (s) => (L ? `$${subTex(s)}$` : subPlain(s)), // 单独的点名、线段名
  };
}

// 分析里（knowns、goal、insight）一律用 $...$
export const T = (e) => `$${tex(e)}$`;

// 输出的分析 JSON（字段顺序与提示词一致）
export function out({ title, category, knowns, goal, layout, commands, insight }) {
  return { title, category, knowns, goal, layout, commands, insight };
}
