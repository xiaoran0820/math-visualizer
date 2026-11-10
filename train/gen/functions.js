// 函数类题目：二次函数、含参二次函数、三次函数、指对函数、三角函数、直线与曲线的交点。
// 每个生成器返回 { text, out }；out 是模型应该输出的分析 JSON（作图命令由程序按题目算出）。
import { pick, int, chance, num, poly, plain, tex, T, out } from './util.js';

const fname = (r, S) => (S.ja ? 'f(x)' : pick(r, ['f(x)', 'f(x)', 'y']));

// ---------- 二次函数：交点、顶点、对称轴、区间上的最值 ----------
export function quadratic(r, S) {
  const a = pick(r, [1, 1, 1, -1, 2, -1, -2, 1]);
  const p = int(r, -4, 2), q = p + int(r, 1, 6);
  const b = -a * (p + q), c = a * p * q;
  const h = (p + q) / 2, k = a * (h - p) * (h - q);
  const e = poly([a, b, c]);
  const nm = fname(r, S);
  const lhs = nm === 'y' ? 'y' : 'f(x)';
  const ask = pick(r, ['roots', 'extreme', 'interval']);
  const cmds = [`f(x) = ${e}`];
  let text, goal, layout, insight, title;
  const fx = S.m(`${lhs} = ${e}`);
  if (ask === 'roots') {
    title = '二次函数的交点与顶点';
    text = S.ja ? `2 次関数 ${fx} のグラフと $x$ 軸の交点の座標、および頂点の座標を求めよ。`
      : pick(r, [`已知二次函数 ${fx}，求它的图像与 x 轴的交点坐标和顶点坐标。`, `求抛物线 ${fx} 与 x 轴的交点和顶点坐标。`, `二次函数 ${fx} 的图像与 x 轴交于 A、B 两点（A 在 B 的左边），顶点为 C，求 A、B、C 的坐标。`]);
    cmds.push('A = Intersect(f, xAxis, 1)', 'B = Intersect(f, xAxis, 2)', `${text.includes('顶点为 C') ? 'C' : 'V'} = Vertex(f) "顶点" #result`, `l: x = ${num(h)} #aux`);
    goal = '求图像与 $x$ 轴的交点和顶点坐标';
    layout = `令 y=0，${e.replace(/ /g, '')}=0 的两根是 ${p} 和 ${q}；对称轴 x=${num(h)}，顶点 (${num(h)}, ${num(k)})。`;
    insight = '两个交点关于对称轴对称，顶点在对称轴上。';
  } else if (ask === 'extreme') {
    title = a > 0 ? '二次函数的最小值' : '二次函数的最大值';
    const w = a > 0 ? '最小值' : '最大值';
    text = S.ja ? `2 次関数 ${fx} の${a > 0 ? '最小値' : '最大値'}と、そのときの $x$ の値を求めよ。`
      : `已知二次函数 ${fx}，求它的对称轴和${w}。`;
    cmds.push(`V = Vertex(f) "${w}点" #result`, `l: x = ${num(h)} "对称轴" #aux`, `Text("${w} {f(${num(h)})}", (${num(h + 0.6)}, ${num(k + (a > 0 ? -1 : 1))}))`);
    goal = `求对称轴和${w}`;
    layout = `配方：${lhs === 'y' ? 'y' : 'f(x)'}=${num(a) === '1' ? '' : num(a) === '-1' ? '-' : num(a)}(x${h >= 0 ? '-' : '+'}${num(Math.abs(h))})²${k >= 0 ? '+' : '-'}${num(Math.abs(k))}，对称轴 x=${num(h)}，顶点 (${num(h)}, ${num(k)})。`;
    insight = `开口${a > 0 ? '向上，顶点是最低点' : '向下，顶点是最高点'}。`;
  } else {
    const lo = int(r, Math.floor(h) - 3, Math.floor(h)), hi = lo + int(r, 2, 4);
    const inside = h >= lo && h <= hi;
    const vals = [lo, hi, ...(inside ? [h] : [])].map((x) => a * x * x + b * x + c);
    title = '二次函数在区间上的最值';
    text = S.ja ? `関数 ${fx} $(${lo}\\le x\\le ${hi})$ の最大値と最小値を求めよ。`
      : `已知函数 ${fx}，求它在区间 [${lo}, ${hi}] 上的最大值和最小值。`;
    cmds.push(`g(x) = Function(${e}, ${lo}, ${hi}) #hl`, `P = (${lo}, f(${lo}))`, `Q = (${hi}, f(${hi}))`);
    if (inside) cmds.push('V = Vertex(f) "顶点"');
    cmds.push(`l: x = ${num(h)} #aux`);
    goal = `求在 $[${lo},${hi}]$ 上的最大值和最小值`;
    layout = `对称轴 x=${num(h)}，${inside ? '在区间内' : '在区间外'}；比较端点${inside ? '和顶点' : ''}的函数值：${vals.map(num).join('、')}。`;
    insight = '看区间内那一段图像的最高点和最低点。';
  }
  return { text, out: out({ title, category: '函数', knowns: [T(`${lhs}=${e}`)], goal, layout, commands: cmds, insight }) };
}

// ---------- 含参二次函数：对称轴随参数移动（滑块） ----------
export function quadraticParam(r, S) {
  const lo = int(r, -1, 1), hi = lo + int(r, 2, 4);
  const c0 = int(r, -2, 5);
  const up = chance(r, 0.7);
  const e = up ? poly([1, 0, c0]).replace(/^x\^2/, `x^2 - 2a x`) : `-x^2 + 2a x${c0 >= 0 ? ` + ${c0}` : ` - ${-c0}`}`;
  const eText = e.replace(/2a x/, '2ax');
  const w = up ? '最小值' : '最大值';
  if (up && lo === 0 && hi === 2 && c0 === 3) return null; // 和开发集的题目一样，跳过
  const text = S.ja ? `$a$ を定数とする。関数 ${S.m(`f(x) = ${eText}`)} $(${lo}\\le x\\le ${hi})$ の${up ? '最小値' : '最大値'}を求めよ。`
    : pick(r, [`已知函数 ${S.m(`f(x) = ${eText}`)}，求 f(x) 在区间 [${lo}, ${hi}] 上的${w}。`, `设函数 ${S.m(`f(x) = ${eText}`)}，a 为常数，讨论 f(x) 在 [${lo}, ${hi}] 上的${w}。`]);
  const cmds = [
    `a = Slider(${lo - 2}, ${hi + 2}, ${num((lo + hi) / 2)})`,
    `f(x) = ${e}`,
    `g(x) = Function(${e}, ${lo}, ${hi}) #hl`,
    'l: x = a #aux',
    `m = If(a < ${lo}, ${lo}, If(a > ${hi}, ${hi}, a))`,
    `P = (m, f(m)) "${w}点" #result`,
    `Text("a = {a} 时，${w} {f(m)}", (${lo - 1}, ${up ? c0 + 6 : c0 + 8}))`,
  ];
  if (!up) cmds[4] = `m = If(a < ${lo}, ${lo}, If(a > ${hi}, ${hi}, a))`;
  return {
    text,
    out: out({
      title: `含参二次函数的${w}`, category: '函数',
      knowns: [T(`f(x)=${eText}`) + '，对称轴 $x=a$', `区间 $[${lo},${hi}]$`],
      goal: `求 $f(x)$ 在 $[${lo},${hi}]$ 上的${w}`,
      layout: `参数 a 用滑块；对称轴 x=a；${w}点的横坐标按 a<${lo}、${lo}≤a≤${hi}、a>${hi} 分段。`,
      commands: cmds,
      insight: `拖动滑块 $a$，看对称轴在区间左边、中间、右边时，${w}分别在哪里取到。`,
    }),
  };
}

// ---------- 三次函数：极值、单调区间、切线 ----------
export function cubic(r, S) {
  const s = pick(r, [1, 1, 2, -1]);
  let p = int(r, -3, 1), q = p + int(r, 1, 4);
  if (s === 2 && (p + q) % 2) q += 1;
  // f'(x) = 3s(x-p)(x-q)  →  f(x) = s x^3 - 1.5s(p+q) x^2 + 3s pq x + d
  const b = -1.5 * s * (p + q), c = 3 * s * p * q, d = int(r, -3, 4);
  if (!Number.isInteger(b)) return null;
  const e = poly([s, b, c, d]);
  const f = (x) => s * x ** 3 + b * x * x + c * x + d;
  const ask = pick(r, ['extreme', 'mono', 'tangent']);
  const fx = S.m(`f(x) = ${e}`);
  const cmds = [`f(x) = ${e}`];
  const [maxX, minX] = s > 0 ? [p, q] : [q, p];
  let text, goal, layout, insight, title;
  if (ask === 'tangent') {
    const x0 = int(r, p - 1, q + 1), y0 = f(x0), k = 3 * s * (x0 - p) * (x0 - q);
    title = '曲线的切线';
    text = S.ja ? `曲線 ${S.m(`y = ${e}`)} 上の点 $(${x0},${num(y0)})$ における接線の方程式を求めよ。`
      : `求曲线 ${S.m(`y = ${e}`)} 在点 (${x0}, ${num(y0)}) 处的切线方程。`;
    cmds.push(`P = (${x0}, f(${x0})) #result`, `t = Tangent(${x0}, f) #hl`);
    goal = `求在点 $(${x0},${num(y0)})$ 处的切线方程`;
    layout = `f'(x)=${poly([3 * s, 2 * b, c]).replace(/ /g, '')}，切线斜率 k=f'(${x0})=${num(k)}，过点 (${x0}, ${num(y0)})。`;
    insight = '切线在切点附近和曲线贴在一起，斜率就是该点的导数值。';
  } else {
    title = ask === 'extreme' ? '三次函数的极值' : '三次函数的单调区间';
    text = S.ja ? `関数 ${fx} の${ask === 'extreme' ? '極値' : '増減'}を調べよ。`
      : ask === 'extreme' ? `已知函数 ${fx}，求 f(x) 的极值。` : `求函数 ${fx} 的单调区间。`;
    cmds.push(`A = (${maxX}, f(${maxX})) "极大值点" #result`, `B = (${minX}, f(${minX})) "极小值点" #result`,
      `Segment(A, (${maxX}, 0)) #aux`, `Segment(B, (${minX}, 0)) #aux`);
    goal = ask === 'extreme' ? '求 $f(x)$ 的极值' : '求 $f(x)$ 的单调区间';
    layout = `f'(x)=${poly([3 * s, 2 * b, c]).replace(/ /g, '')}=${num(3 * s)}(x${p >= 0 ? '-' : '+'}${Math.abs(p)})(x${q >= 0 ? '-' : '+'}${Math.abs(q)})，零点 x=${p}、x=${q}；极大值 f(${maxX})=${num(f(maxX))}，极小值 f(${minX})=${num(f(minX))}。`;
    insight = ask === 'extreme' ? '在极值点两侧，图像由升变降（极大）或由降变升（极小）。' : `x=${p}、x=${q} 把数轴分成三段，看每一段图像是上升还是下降。`;
  }
  return { text, out: out({ title, category: '函数', knowns: [T(`f(x)=${e}`)], goal, layout, commands: cmds, insight }) };
}

// ---------- 指数、对数函数 ----------
export function expLog(r, S) {
  const base = pick(r, [2, 3, 2, 'e']);
  const kind = pick(r, ['pair', 'shift', 'line']);
  const cmds = [];
  let text, goal, layout, insight, title, knowns;
  const ex = base === 'e' ? 'e^x' : `${base}^x`;
  const lg = base === 'e' ? 'ln(x)' : `log(${base}, x)`;
  const lgText = base === 'e' ? 'ln x' : `log${base === 2 ? '₂' : '₃'}x`;
  const lgTex = base === 'e' ? '\\ln x' : `\\log_${base} x`;
  const lgShow = S.L ? `$y=${lgTex}$` : `y = ${lgText}`;
  if (kind === 'pair') {
    title = '指数函数与对数函数';
    text = `在同一坐标系中画出 ${S.m(`y = ${ex}`)} 和 ${lgShow} 的图像，并说明它们的位置关系。`;
    cmds.push(`f(x) = ${ex}`, `g(x) = ${lg}`, 'l: y = x #aux', 'A = (0, 1)', 'B = (1, 0)');
    knowns = [T(`y=${ex}`), `$y=${lgTex}$`];
    goal = '比较两个函数的图像';
    layout = `两函数互为反函数，图像关于直线 y=x 对称；分别过定点 (0,1) 和 (1,0)。`;
    insight = '把一个图像沿直线 $y=x$ 翻折，就得到另一个。';
  } else if (kind === 'shift') {
    const h = int(r, -3, 3) || 1, v = int(r, -2, 3);
    const e = `${base === 'e' ? 'e' : base}^(x${h > 0 ? ' - ' : ' + '}${Math.abs(h)})${v ? (v > 0 ? ` + ${v}` : ` - ${-v}`) : ''}`;
    title = '指数函数图像的平移';
    text = `函数 ${S.m(`y = ${e}`)} 的图像是由 ${S.m(`y = ${ex}`)} 的图像怎样平移得到的？它经过哪个定点？`;
    cmds.push(`g(x) = ${ex} #aux`, `f(x) = ${e} #hl`, `A = (0, 1) #aux`, `P = (${h}, ${1 + v}) "定点" #result`);
    if (v) cmds.push(`l: y = ${v} #aux`);
    knowns = [T(`y=${e}`)];
    goal = '说明平移方式和所过定点';
    layout = `向${h > 0 ? '右' : '左'}平移 ${Math.abs(h)} 个单位${v ? `，再向${v > 0 ? '上' : '下'}平移 ${Math.abs(v)} 个单位` : ''}；定点 (0,1) 移到 (${h}, ${1 + v})。`;
    insight = '定点 $(0,1)$ 跟着平移，渐近线也跟着上下移动。';
  } else {
    const k = pick(r, [1, 2, -1]), m = int(r, -1, 3);
    title = '指数函数与直线的交点';
    text = `判断方程 ${S.m(`${ex} = ${poly([k, m])}`)} 有几个实数根。`;
    cmds.push(`f(x) = ${ex}`, `l: y = ${poly([k, m])}`, 'A = Intersect(f, l, 1) #result', 'B = Intersect(f, l, 2) #result');
    knowns = [T(`${ex}=${poly([k, m])}`)];
    goal = '判断实数根的个数';
    layout = `根的个数就是 y=${ex} 与直线 y=${poly([k, m]).replace(/ /g, '')} 的交点个数。`;
    insight = '数一数两条图像有几个交点。';
  }
  return { text, out: out({ title, category: '函数', knowns, goal, layout, commands: cmds, insight }) };
}

// ---------- 三角函数 y = A sin(ωx + φ) + B ----------
export function trig(r, S) {
  const A = pick(r, [1, 2, 3, 2]);
  const w = pick(r, [1, 2, 2, 1 / 2, 3]);
  const phiK = pick(r, [0, 1, 2, -1, 3]); // φ = phiK·π/6
  const B = pick(r, [0, 0, 1, -1]);
  const fn = pick(r, ['sin', 'cos']);
  const wT = w === 1 / 2 ? '1/2*' : w === 1 ? '' : `${w}`;
  // φ = kπ/6，约分：π/6、π/3、π/2、2π/3……
  const g6 = (a, b) => (b ? g6(b, a % b) : a);
  const kk = Math.abs(phiK), gd = g6(kk, 6) || 6, pn = kk / gd, pd = 6 / gd;
  const phiTxt = phiK === 0 ? '' : ` ${phiK > 0 ? '+' : '-'} ${pn === 1 ? '' : pn}pi${pd === 1 ? '' : `/${pd}`}`;
  const inner = `${wT}x${phiTxt}`.replace('1/2*x', 'x/2');
  const e = `${A === 1 ? '' : A}${fn}(${inner})${B ? (B > 0 ? ` + ${B}` : ` - ${-B}`) : ''}`;
  const T0 = (2 * Math.PI) / w;
  const phi = (phiK * Math.PI) / 6;
  // 第一个最高点：ωx + φ = π/2（sin）或 0（cos），取正的最小值
  let x0 = ((fn === 'sin' ? Math.PI / 2 : 0) - phi) / w;
  while (x0 < 0) x0 += T0;
  while (x0 - T0 >= 0) x0 -= T0;
  const pText = (x) => {
    if (Math.abs(x) < 1e-9) return '0';
    const k = Math.round((x / Math.PI) * 12);
    const g = (a, b) => (b ? g(b, a % b) : a);
    const d = g(Math.abs(k), 12) || 12;
    const n = k / d, m = 12 / d;
    return `${n === 1 ? '' : n === -1 ? '-' : n}π${m === 1 ? '' : `/${m}`}`;
  };
  const text = S.ja ? `関数 ${S.m(`y = ${e}`)} の周期と最大値を求め、グラフをかけ。`
    : pick(r, [`画出函数 ${S.m(`y = ${e}`)} 的图像，并求它的最小正周期和最大值。`, `已知函数 ${S.m(`f(x) = ${e}`)}，求 f(x) 的最小正周期、最大值以及取得最大值时 x 的值。`]);
  const cmds = [`f(x) = ${e}`, `M = (${num(x0)}, ${A + B}) "最高点" #result`, `N = (${num(x0 + T0)}, ${A + B}) #aux`, `Segment(M, N) #hl`, `Text("一个周期 T = ${pText(T0)}", (${num(x0)}, ${A + B + 1}))`];
  if (B) cmds.push(`l: y = ${B} #aux`);
  return {
    text,
    out: out({
      title: '三角函数的周期与最值', category: '三角函数',
      knowns: [T(`y=${e}`)], goal: '求最小正周期和最大值',
      layout: `T=2π/${w === 1 / 2 ? '(1/2)' : w}=${pText(T0)}；最大值 ${B ? `${A}${B > 0 ? '+' : ''}${B}=${A + B}` : A}，在 x=${pText(x0)} 处${pText(x0) === '0' ? '' : `（约 ${num(x0)}）`}取到。`,
      commands: cmds, insight: '相邻两个最高点之间的距离就是一个周期。',
    }),
  };
}

// ---------- 直线与曲线的交点 ----------
export function lineCurve(r, S) {
  const kind = pick(r, ['parabola', 'hyperbola', 'parabola']);
  let text, layout, e, cmds, title;
  if (kind === 'parabola') {
    // 抛物线 y = x^2 + bx + c 与直线 y = kx + m 交于 x1、x2（整数）
    const x1 = int(r, -3, 1), x2 = x1 + int(r, 1, 4), k = int(r, -2, 3), m = int(r, -2, 3);
    // x^2 + bx + c - kx - m = (x - x1)(x - x2)
    const b = k - (x1 + x2), c = m + x1 * x2;
    e = poly([1, b, c]);
    const l = poly([k, m]);
    if (b === -0 && c === -1 && k === 1 && m === 1) return null; // 开发集的题
    title = '直线与抛物线的交点';
    text = S.ja ? `放物線 ${S.m(`y = ${e}`)} と直線 ${S.m(`y = ${l}`)} の交点の座標を求めよ。`
      : `求直线 ${S.m(`y = ${l}`)} 与抛物线 ${S.m(`y = ${e}`)} 的交点坐标。`;
    cmds = [`f(x) = ${e}`, `l: y = ${l}`, 'A = Intersect(f, l, 1) #result', 'B = Intersect(f, l, 2) #result'];
    layout = `联立得 x²${b - k >= 0 ? '+' : '-'}${Math.abs(b - k) === 1 ? '' : Math.abs(b - k)}x${c - m >= 0 ? '+' : '-'}${Math.abs(c - m)}=0，x=${x1} 或 ${x2}，交点 (${x1}, ${k * x1 + m})、(${x2}, ${k * x2 + m})。`.replace('+0x', '').replace('-0x', '').replace('x+0=', 'x=');
    return { text, out: out({ title, category: '函数', knowns: [T(`y=${e}`), T(`y=${l}`)], goal: '求交点坐标', layout, commands: cmds, insight: '交点的横坐标就是联立后方程的根。' }) };
  }
  const k = pick(r, [2, 4, 6, -4, 3]);
  const a = pick(r, [1, 2, -1, 1]);
  // y = k/x 与 y = a x + m 的交点：取一个整数交点 x1，另一个由韦达定理得到
  const x1 = pick(r, [1, 2, -1, -2].filter((v) => Number.isInteger(k / v)));
  const y1 = k / x1;
  const m = y1 - a * x1;
  const l = poly([a, m]);
  title = '直线与反比例函数的交点';
  text = `已知反比例函数 ${S.m(`y = ${k}/x`)} 与一次函数 ${S.m(`y = ${l}`)} 的图像交于 A、B 两点，求 A、B 的坐标。`;
  cmds = [`f(x) = ${k}/x`, `l: y = ${l}`, 'A = Intersect(f, l, 1) #result', 'B = Intersect(f, l, 2) #result', 'Segment(A, B) #aux'];
  layout = `联立 ${k}/x=${l.replace(/ /g, '')}，得 ${a === 1 ? '' : a === -1 ? '-' : a}x²${m >= 0 ? '+' : '-'}${Math.abs(m)}x-${k}=0，其中一个根是 x=${x1}。`.replace('+0x', '').replace('-0x', '');
  return { text, out: out({ title, category: '函数', knowns: [T(`y=${k}/x`), T(`y=${l}`)], goal: '求交点 $A$、$B$ 的坐标', layout, commands: cmds, insight: '两个交点分别在双曲线的两支上（或同一支上），看直线怎样穿过图像。' }) };
}
