// 从题目文字里提取可以自动核对的条件，用来：
//   1. 核对模型画出的图形是否符合题意（verifyFacts）；不符合时把具体哪里不对告诉模型（pipeline.js）；
//   2. 题目里写明、但图里没有画对的方程、不等式组、平行四边形缺的顶点，由程序直接补上（completeFigure）。
// 原则：宁可少提取，不可提取错——提取错的条件会让正确的图被判为“不符合”。
// 只做文字层面的识别（正则），不调用模型，手机上也能瞬间完成。
import { buildScene } from './scene.js';
import { runCheck, describeCheck, findPoint } from './checks.js';

// ---------------- 文字预处理：LaTeX、全角、下标统一成一种写法 ----------------
export function normalizeProblemText(text) {
  let s = String(text || '');
  s = s.replace(/\\begin\{[a-z*]+\}|\\end\{[a-z*]+\}/g, ' ').replace(/\\\\/g, '，').replace(/&/g, ' ')
    .replace(/\$+/g, ' ')
    .replace(/\\(?:mathrm|text|mathit|operatorname|boldsymbol|mathbf)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\triangle\s*/g, '△').replace(/\\angle\s*/g, '∠').replace(/\\perp/g, '⊥').replace(/\\parallel/g, '∥')
    .replace(/\\odot\s*/g, '⊙').replace(/\^\s*\{?\s*\\circ\s*\}?/g, '°').replace(/\\circ/g, '°').replace(/\\degree/g, '°')
    .replace(/\\leqslant|\\leq(?![a-z])|\\le(?![a-z])/g, '≤').replace(/\\geqslant|\\geq(?![a-z])|\\ge(?![a-z])/g, '≥')
    .replace(/\\neq?(?![a-z])/g, '≠').replace(/\\pi(?![a-z])/g, 'π').replace(/\\cdot|\\times/g, '·')
    .replace(/\\left|\\right/g, '').replace(/\\to(?![a-z])|\\rightarrow/g, '→').replace(/\\[,;!: ]/g, ' ').replace(/\\[{}]/g, ' ');
  for (let k = 0; k < 3; k++) {
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)').replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  }
  s = s.replace(/\\(arcsin|arccos|arctan|sin|cos|tan|ln|log|lg)/g, '$1')
    .replace(/\^\{([^{}]*)\}/g, (m, e) => (/^[\w.]+$/.test(e) ? `^${e}` : `^(${e})`))
    .replace(/([A-Z])_\{?(\d+)\}?/g, '$1$2')
    .replace(/[₀-₉]/g, (c) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(c)))
    .replace(/（/g, '(').replace(/）/g, ')').replace(/＝/g, '=').replace(/[′’]/g, "'").replace(/[−–—]/g, '-')
    .replace(/＋/g, '+').replace(/｜/g, '|').replace(/　/g, ' ').replace(/[{}]/g, ' ');
  return s.replace(/[ \t]+/g, ' ');
}

// ---------------- 常用片段 ----------------
const PT = "[A-Z]\\d*'?"; // 点名：A、B1、A'
const SEG = `(?:${PT}){2}`; // 线段：AB、BB1
const PRE = "(?<![A-Za-z0-9'+\\-*/·×^²:：|]\\s*)"; // 前面不能紧挨字母、数字、运算符（AB + BC = 10 里的 BC = 10 不算）
const POST = "(?![A-Za-z0-9'])";
const NUM = '(?:\\d+(?:\\.\\d+)?\\s*)?√\\s*\\(?\\s*\\d+(?:\\.\\d+)?\\s*\\)?|\\d+(?:\\.\\d+)?(?:\\s*/\\s*\\d+(?:\\.\\d+)?)?';
const SNUM = `-?\\s*(?:${NUM})`;
const UNIT = '(?:\\s*(?:cm|mm|dm|km|m|厘米|毫米|分米|千米|米)(?![A-Za-z]))?';
const NUM_END = `${UNIT}(?![\\d.]|\\s*[A-Za-z(√+\\-*/·×^:：])`;
const IS = '(?:=|为|是|等于)';
const R = (s) => new RegExp(s, 'g');
const splitPts = (s) => s.match(/[A-Z]\d*'?/g) || [];

export function parseNum(t) {
  t = String(t).replace(/\s+/g, '');
  const neg = t.startsWith('-');
  if (neg) t = t.slice(1);
  let v = null;
  let m = /^(\d+(?:\.\d+)?)?√\(?(\d+(?:\.\d+)?)\)?$/.exec(t);
  if (m) v = (m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]));
  else if ((m = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t))) v = Number(m[1]) / Number(m[2]);
  else if (/^\d+(?:\.\d+)?$/.test(t)) v = Number(t);
  if (v === null || !Number.isFinite(v)) return null;
  return { value: neg ? -v : v, text: (neg ? '-' : '') + t.replace(/[()]/g, '') };
}

const SHAPE4 = '正方形|矩形|长方形|平行四边形|菱形|梯形|四边形';
const SHAPE3 = '等边三角形|正三角形|等腰直角三角形|等腰三角形|直角三角形|三角形|Rt\\s*△|△';
const PARALLELOGRAM_LIKE = new Set(['正方形', '矩形', '长方形', '平行四边形', '菱形']);
// 注意“球”：概率题里的红球、白球不是立体图形，只认球体、球面、外接球这类说法
const SOLID_WORDS = /正方体|长方体|棱锥|棱柱|圆柱|圆锥|球(?:体|面|心)|外接球|内切球|棱切球|球的(?:表面积|体积|半径|截面)|半径(?:为|是)[^，。；]{0,10}的球|四面体|平面\s*[A-Z]|异面直线|二面角|立体|(?<!样本|事件)空间|(?<!標本)空間|立方体|直方体|角錐|角柱|円錐|円柱/;  // 「样本空间」「標本空間」是概率里的说法；后面几个是日文写法

/**
 * 从题目文字提取条件。
 * @returns {{ facts: Array<{check: object, desc: string, kind: string}>, polygons: Array<{type: string, v: string[]}>, params: object }}
 */
export function extractFacts(text) {
  // 识别结果末尾的「【图形】」是模型对原图的描述，不一定准确，只用题目本身的文字
  const s = normalizeProblemText(String(text || '').replace(/【图形】[\s\S]*$/, ''));
  const facts = [];
  const seen = new Set();
  const add = (check, kind, desc) => {
    const key = JSON.stringify(check);
    if (seen.has(key)) return;
    seen.add(key);
    facts.push({ check, kind, desc: desc || describeCheck(check) });
  };
  const dist = (a, b, n) => add({ type: 'dist', a, b, value: n.value, ...(n.text !== String(n.value) ? { valueText: n.text } : {}) }, 'measure');
  const equal = (segs) => add({ type: 'equal', segs }, 'measure');
  const angle = (p, deg) => add({ type: 'angle', pts: p, deg }, 'measure');
  const perp = (l1, l2) => add({ type: 'perp', l1, l2 }, 'measure');
  const parallel = (l1, l2) => add({ type: 'parallel', l1, l2 }, 'measure');
  const on = (P, [X, Y]) => { if (P !== X && P !== Y) add({ type: 'collinear', pts: [X, P, Y] }, 'measure'); };
  const params = {};
  let m;

  // ---- 图形：多边形、立体 ----
  const polygons = [];
  for (m of s.matchAll(R(`(${SHAPE4})\\s*((?:${PT}){4})${POST}`))) polygons.push({ type: m[1], v: splitPts(m[2]) });
  for (m of s.matchAll(R(`(${SHAPE3})\\s*((?:${PT}){3})${POST}`))) polygons.push({ type: m[1].replace(/\s+/g, ''), v: splitPts(m[2]) });
  const sideOf = (shape, verts) => {
    const after = R(`(?:${shape})\\s*${verts}\\s*(?:的)?\\s*(?:边长|棱长)\\s*(?:为|是|等于|=)\\s*(${NUM})${NUM_END}`).exec(s);
    const before = R(`(?:边长|棱长)\\s*(?:为|是|等于)\\s*(${NUM})${UNIT}\\s*的\\s*(?:${shape})\\s*${verts}${POST}`).exec(s);
    return parseNum((after || before || [])[1] || '');
  };
  for (const p of polygons) {
    const [A, B, C, D] = p.v;
    const side = sideOf(p.type.replace('Rt△', 'Rt\\s*△'), p.v.join(''));
    if (p.type === '正方形') { equal([[A, B], [B, C], [C, D], [D, A]]); angle([D, A, B], 90); angle([A, B, C], 90); }
    if (p.type === '矩形' || p.type === '长方形') { angle([D, A, B], 90); angle([A, B, C], 90); angle([B, C, D], 90); }
    if (p.type === '平行四边形') { parallel([A, B], [D, C]); parallel([A, D], [B, C]); }
    if (p.type === '菱形') { equal([[A, B], [B, C], [C, D], [D, A]]); parallel([A, B], [D, C]); }
    if (p.type === '等边三角形' || p.type === '正三角形') equal([[A, B], [B, C], [C, A]]);
    if (side && ['正方形', '菱形', '等边三角形', '正三角形'].includes(p.type)) dist(A, B, side);
  }
  for (m of s.matchAll(R(`(正方体|长方体|正四棱柱|直四棱柱)\\s*((?:${PT}){4})\\s*-\\s*((?:${PT}){4})${POST}`))) {
    const [A, B, C, D] = splitPts(m[2]);
    const [A1, B1, C1, D1] = splitPts(m[3]);
    if (m[1] === '正方体') {
      equal([[A, B], [B, C], [C, D], [D, A], [A, A1], [B, B1], [C, C1], [D, D1]]);
      const side = sideOf('正方体', `${m[2]}\\s*-\\s*${m[3]}`);
      if (side) dist(A, B, side);
    }
    if (m[1] === '正四棱柱') equal([[A, B], [B, C], [C, D], [D, A]]);
    angle([D, A, B], 90); angle([A, B, C], 90);
    angle([A1, A, B], 90); angle([A1, A, D], 90);
  }
  for (m of s.matchAll(R(`(正三棱锥|正四棱锥)\\s*(${PT})\\s*-\\s*((?:${PT}){3,4})${POST}`))) {
    const P = m[2], base = splitPts(m[3]);
    if (m[1] === '正三棱锥' && base.length === 3) { equal([[base[0], base[1]], [base[1], base[2]], [base[2], base[0]]]); equal(base.map((b) => [P, b])); }
    if (m[1] === '正四棱锥' && base.length === 4) {
      const [A, B, C, D] = base;
      equal([[A, B], [B, C], [C, D], [D, A]]); angle([D, A, B], 90); angle([A, B, C], 90); equal(base.map((b) => [P, b]));
    }
  }
  for (m of s.matchAll(R(`(直三棱柱|正三棱柱)\\s*((?:${PT}){3})\\s*-\\s*((?:${PT}){3})${POST}`))) {
    const [A, B, C] = splitPts(m[2]);
    const [A1] = splitPts(m[3]);
    angle([A1, A, B], 90); angle([A1, A, C], 90);
    if (m[1] === '正三棱柱') equal([[A, B], [B, C], [C, A]]);
  }

  // ---- 长度：AB = 5、AB = AC = 5、|AB| = 2√3、AB 的长为 5 ----
  const chainRe = R(`${PRE}\\|?(${SEG})\\|?${POST}((?:\\s*=\\s*\\|?${SEG}\\|?${POST})*)\\s*=\\s*(${NUM})${NUM_END}`);
  const masked = [];
  for (m of s.matchAll(chainRe)) {
    const n = parseNum(m[3]);
    if (!n || n.value <= 0) continue;
    const segs = [m[1], ...(m[2].match(R(SEG)) || [])];
    for (const g of segs) { const [a, b] = splitPts(g); dist(a, b, n); }
    masked.push([m.index, m.index + m[0].length]);
  }
  for (m of s.matchAll(R(`${PRE}(?:线段\\s*)?(${SEG})${POST}\\s*(?:的)?\\s*(?:长度|长)\\s*(?:为|是|等于)?\\s*(${NUM})${NUM_END}`))) {
    const n = parseNum(m[2]);
    if (n && n.value > 0) { const [a, b] = splitPts(m[1]); dist(a, b, n); }
  }
  // 等长：AB = AC（后面没有数）
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}((?:\\s*=\\s*${SEG}${POST})+)(?!\\s*[=+\\-*/·×^²(√\\d])`))) {
    if (masked.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const segs = [m[1], ...(m[2].match(R(SEG)) || [])].map(splitPts);
    if (segs.length >= 2) equal(segs);
  }
  // 点到点的距离：点 P 到圆心 O 的距离为 5
  for (m of s.matchAll(R(`${PRE}(${PT})${POST}\\s*到\\s*(?:圆心|点)?\\s*(${PT})${POST}\\s*的距离\\s*${IS}\\s*(${NUM})${NUM_END}`))) {
    const n = parseNum(m[3]);
    if (n && n.value > 0) dist(m[1], m[2], n);
  }

  // ---- 角：∠ACB = 90°、∠A = 60°、∠C 为直角 ----
  const vertexAngle = (V) => {
    const cands = polygons.filter((p) => p.v.includes(V)).map((p) => {
      const i = p.v.indexOf(V), k = p.v.length;
      return [p.v[(i + k - 1) % k], V, p.v[(i + 1) % k]];
    });
    const uniq = [...new Set(cands.map((c) => [c[0], c[2]].sort().join(',')))];
    return uniq.length === 1 ? cands[0] : null;
  };
  const angleFact = (name, deg) => {
    const p = splitPts(name);
    if (p.length === 3) angle(p, deg);
    else if (p.length === 1) { const t = vertexAngle(p[0]); if (t) angle(t, deg); }
  };
  for (m of s.matchAll(R(`∠\\s*((?:${PT}){1,3})${POST}\\s*${IS}\\s*(\\d+(?:\\.\\d+)?)\\s*(?:°|度)`))) angleFact(m[1], Number(m[2]));
  for (m of s.matchAll(R(`∠\\s*((?:${PT}){1,3})${POST}\\s*(?:为|是)\\s*直角`))) angleFact(m[1], 90);

  // ---- 垂直：DE⊥AC 于点 E、PA⊥平面 ABC ----
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}\\s*⊥\\s*(平面\\s*)?((?:${PT}){2,4})${POST}(?:\\s*(?:于|交[^，。；]{0,4}?于)\\s*(?:点\\s*)?(${PT})${POST})?`))) {
    const l1 = splitPts(m[1]), rest = splitPts(m[3]);
    if (m[2]) {
      if (rest.length < 3) continue;
      const [X, Y, Z] = rest;
      for (const l of [[X, Y], [X, Z], [Y, Z]]) perp(l1, l);
      continue;
    }
    if (rest.length !== 2) continue;
    perp(l1, rest);
    if (m[4]) { on(m[4], rest); on(m[4], l1); }
  }
  // ---- 平行 ----
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}\\s*(?:∥|//)\\s*(${SEG})${POST}`))) parallel(splitPts(m[1]), splitPts(m[2]));

  // ---- 中点 ----
  const mid = (M, g) => { const [a, b] = splitPts(g); if (M !== a && M !== b) add({ type: 'midpoint', m: M, of: [a, b] }, 'measure'); };
  const SIDE = '(?:边|棱|线段|斜边|底边|弦|对角线|腰)?';
  for (m of s.matchAll(R(`${PRE}(${PT})${POST}\\s*(?:为|是)\\s*${SIDE}\\s*(${SEG})${POST}\\s*(?:的)?\\s*中点`))) mid(m[1], m[2]);
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}\\s*(?:边)?\\s*的\\s*中点\\s*(?:为|是)?\\s*(?:点\\s*)?(${PT})${POST}`))) mid(m[2], m[1]);
  for (m of s.matchAll(R(`${PRE}(${PT})\\s*[、,，和与及]\\s*(${PT})${POST}\\s*分别(?:为|是)\\s*${SIDE}\\s*(${SEG})\\s*[、,，和与及]\\s*${SIDE}\\s*(${SEG})${POST}\\s*的\\s*中点`))) { mid(m[1], m[3]); mid(m[2], m[4]); }

  // ---- 点在线上：点 E 在边 BC 上、P 是线段 AB 上一点 ----
  const LINE = '(?:边|线段|直线|射线|棱|斜边|底边|对角线)?';
  for (m of s.matchAll(R(`${PRE}(${PT})${POST}\\s*在\\s*${LINE}\\s*(${SEG})${POST}\\s*(?:的延长线)?\\s*上`))) on(m[1], splitPts(m[2]));
  for (m of s.matchAll(R(`${PRE}(${PT})${POST}\\s*(?:是|为)\\s*${LINE}\\s*(${SEG})${POST}\\s*上\\s*(?:的)?\\s*(?:一|任意一|任一)?\\s*(?:动)?点`))) on(m[1], splitPts(m[2]));

  // ---- 圆：⊙O 的半径为 3、AB 是⊙O 的直径、PA 与⊙O 相切于点 A、点 C 在⊙O 上 ----
  const radius = {};
  const circle = (O, r) => { radius[O] = r; add({ type: 'circle', center: O, r: r.value }, 'measure'); };
  for (m of s.matchAll(R(`(?:⊙|圆)\\s*(${PT})${POST}\\s*(?:的)?\\s*(半径|直径)\\s*(?:长)?\\s*${IS}\\s*(${NUM})${NUM_END}`))) {
    const n = parseNum(m[3]);
    if (n && n.value > 0) circle(m[1], m[2] === '直径' ? { value: n.value / 2, text: String(n.value / 2) } : n);
  }
  for (m of s.matchAll(R(`半径\\s*(?:为|是)\\s*(${NUM})${UNIT}\\s*的\\s*(?:⊙|圆)\\s*(${PT})${POST}`))) { const n = parseNum(m[1]); if (n) circle(m[2], n); }
  for (m of s.matchAll(R(`以\\s*(?:点\\s*)?(${PT})${POST}\\s*为圆心[^。；]{0,12}?(?:半径\\s*(?:为|是|长为)?\\s*(${NUM})|(${NUM})\\s*为半径)`))) { const n = parseNum(m[2] || m[3]); if (n) circle(m[1], n); }
  const onCircle = (P, O) => {
    if (radius[O]) dist(O, P, radius[O]);
    else add({ type: 'onCircle', p: P, center: O }, 'measure');
  };
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}\\s*(?:是|为)\\s*⊙\\s*(${PT})${POST}\\s*的直径`))) { mid(m[2], m[1]); splitPts(m[1]).forEach((P) => onCircle(P, m[2])); }
  const tangent = (g, O, T) => {
    const [X, Y] = splitPts(g);
    if (T !== X && T !== Y) return;
    perp([O, T], [X, Y]);
    onCircle(T, O);
  };
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}\\s*(?:与|和)\\s*⊙\\s*(${PT})${POST}\\s*相切于\\s*(?:点\\s*)?(${PT})${POST}`))) tangent(m[1], m[2], m[3]);
  for (m of s.matchAll(R(`${PRE}(${SEG})${POST}\\s*(?:是|为)\\s*⊙\\s*(${PT})${POST}\\s*的切线[，,]?\\s*(?:点\\s*)?(${PT})${POST}\\s*(?:为|是)\\s*切点`))) tangent(m[1], m[2], m[3]);
  for (m of s.matchAll(R(`((?:${PT}\\s*[、,，]\\s*)*${PT})${POST}\\s*(?:都|均)?\\s*在\\s*⊙\\s*(${PT})${POST}\\s*上`))) splitPts(m[1]).forEach((P) => onCircle(P, m[2]));

  // ---- 坐标：A(1, 2)、点 P(0, 0, 2) ----
  for (m of s.matchAll(R(`${PRE}(${PT})\\s*\\(\\s*(${SNUM})\\s*[,，]\\s*(${SNUM})\\s*(?:[,，]\\s*(${SNUM})\\s*)?\\)`))) {
    const [x, y, z] = [m[2], m[3], m[4]].map((t) => (t === undefined ? undefined : parseNum(t)?.value));
    if (x === undefined || y === undefined || (m[4] !== undefined && z === undefined)) continue;
    add({ type: 'at', p: m[1], x, y, ...(z !== undefined ? { z } : {}) }, 'measure');
  }

  // ---- 立体：圆柱、圆锥、球 ----
  for (const [word, kind] of [['圆柱', 'cylinder'], ['圆锥', 'cone']]) {
    const i = s.indexOf(word);
    if (i < 0) continue;
    const sent = s.slice(i).split(/[。；]/)[0];
    const r = /底面\s*(半径|直径)\s*(?:为|是|等于)\s*([^，。；\s]+)/.exec(sent);
    const h = /高\s*(?:为|是|等于)\s*([^，。；\s]+)/.exec(sent);
    const rv = r ? parseNum(r[2].replace(/(?:cm|厘米|米|m)$/, '')) : null, hv = h ? parseNum(h[1].replace(/(?:cm|厘米|米|m)$/, '')) : null;
    if (rv || hv) add({ type: 'solid', kind, ...(rv ? { r: r[1] === '直径' ? rv.value / 2 : rv.value } : {}), ...(hv ? { h: hv.value } : {}) }, 'shape');
  }
  for (m of s.matchAll(/(?<!外接|内切)球[^，。；]{0,4}?半径\s*(?:为|是|等于)\s*([^，。；\s]+)/g)) {
    const n = parseNum(m[1]);
    if (n) add({ type: 'solid', kind: 'sphere', r: n.value }, 'shape');
  }

  // ---- 动点：点 P 从点 A 出发…运动、动点 P ----
  for (m of s.matchAll(R(`动点\\s*(${PT})${POST}|点\\s*(${PT})${POST}\\s*(?:从|自|由)[^，。；]{0,20}?出发|点\\s*(${PT})${POST}\\s*(?:在|沿)[^，。；]{0,24}?(?:运动|移动|滑动)|(${PT})${POST}\\s*(?:是|为)[^，。；]{0,14}?上\\s*(?:的)?\\s*(?:一)?\\s*动点`))) {
    add({ type: 'moving', p: m[1] || m[2] || m[3] || m[4] }, 'moving');
  }

  // ---- 方程与不等式组 ----
  extractEquations(s, add, params, String(text || ''));

  // ---- 平面图还是立体图 ----
  // 题目给出的点有三个坐标，也是立体图
  if (SOLID_WORDS.test(s) || facts.some((f) => f.check.type === 'at' && f.check.z !== undefined)) add({ type: 'mode', value: '3d' }, 'mode');
  else if (facts.length) add({ type: 'mode', value: '2d' }, 'mode');

  // 概率、统计题应该列表格（用户 2026-11-10 的反馈：「条件概率题有的应该是列出表格更能让人理解」）。
  // 2B 常常不听提示词里的规则，改成一条要核对的条件后，没有表格时会自动请模型改、重新生成时优先选有表格的。
  // 几何概型（区间、面积）画图更合适，不加这一条。
  if (/概率|分布列|数学期望|期望值|方差|列联表|確率|期待値/.test(s) && !/几何概型|区间\s*[[(（]|面积|长度|体积|角度|任取一点|随机地?取一点|投一点|長さ|面積|体積/.test(s)) {
    add({ type: 'kind', kind: 'row', min: 2 }, 'table', '用表格列出各种情况');
  }

  // 方程里的参数如果题目给了值，记在核对条件里
  for (const f of facts) if (f.check.type === 'curve' && f.check.vars.length) {
    const known = Object.fromEntries(f.check.vars.filter((v) => params[v] !== undefined).map((v) => [v, params[v]]));
    if (Object.keys(known).length) f.check.params = known;
  }
  return { facts, polygons, params };
}

// 只在括号外按逗号、分号切开
function splitTop(s, seps) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (depth === 0 && seps.includes(ch)) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

// 用作图引擎编译一条方程：缺少的参数（a、m、k……）先按 1 代入，记下参数名
function compileCurve(src) {
  const vars = [];
  for (let k = 0; k < 5; k++) {
    const sc = buildScene([...vars.map((v) => `${v} = 1`), src], {});
    if (!sc.errors.length) {
      const o = sc.objects[sc.objects.length - 1];
      return o && ['function', 'line', 'implicit'].includes(o.value?.T) ? { vars, value: o.value } : null;
    }
    const miss = /未定义的名称「([a-zα-ω][A-Za-z0-9_]*)」/.exec(sc.errors[0].message)?.[1];
    if (!miss || miss === 'x' || miss === 'y' || vars.includes(miss)) return null;
    // y = f(x) 里的 f 是别处定义的函数，不是参数（单独看这条式子画不出来，不提取）
    if (/^[fgh]$/.test(miss) && new RegExp(`(?<![A-Za-z0-9_])${miss}\\s*\\(\\s*x\\s*\\)`).test(src)) return null;
    // 2ax 里的 ax：参数 a 还没定义时引擎把它当成一个名字，拆成单个字母
    const parts = /^[a-z]{2,3}$/.test(miss) ? [...miss].filter((ch) => ch !== 'x' && ch !== 'y' && !vars.includes(ch)) : [miss];
    if (!parts.length) return null;
    vars.push(...parts);
  }
  return null;
}

// 式子的定义域「x > 0」「0 ≤ x ≤ 3」「x ≠ 0」：
//   不涉及 x（a > 0、k ≠ 0 这类参数条件）→ { params: true }；
//   否则 → { inside(x), lo, hi }（lo、hi 是区间的两端，可能是 ±Infinity）；看不懂 → null
function parseDomain(domain) {
  const d = domain.replace(/≤|＜=/g, '<=').replace(/≥|＞=/g, '>=').replace(/≠/g, '!=').replace(/＜/g, '<').replace(/＞/g, '>');
  if (!/(?<![A-Za-z])x(?![A-Za-z])/.test(d)) return { params: true };
  const parts = d.split(/(<=|>=|!=|<|>)/).map((t) => t.trim());
  const terms = [];
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i] === 'x') { terms.push('x'); continue; }
    const n = parseNum(parts[i]);
    const val = n ? n.value : (() => { const sc = buildScene([`t0 = ${parts[i]}`], {}); return sc.errors.length ? null : sc.values.t0; })();
    if (typeof val !== 'number' || !Number.isFinite(val)) return null;
    terms.push(val);
  }
  if (terms.length < 2) return null;
  const cmp = { '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b, '!=': (a, b) => a !== b };
  let lo = -Infinity, hi = Infinity;
  for (let i = 1; i < terms.length; i++) {
    const [a, op, b] = [terms[i - 1], parts[2 * i - 1], terms[i]];
    if (a === 'x' && typeof b === 'number') { if (op[0] === '<') hi = Math.min(hi, b); else if (op[0] === '>') lo = Math.max(lo, b); }
    if (b === 'x' && typeof a === 'number') { if (op[0] === '<') lo = Math.max(lo, a); else if (op[0] === '>') hi = Math.min(hi, a); }
  }
  const inside = (x) => terms.every((t, i) => i === 0 || cmp[parts[2 * i - 1]](terms[i - 1] === 'x' ? x : terms[i - 1], t === 'x' ? x : t));
  return { inside, lo, hi };
}

// 去掉定义域后图像不变吗：定义域外的点，式子本来就没有意义（√x 在 x < 0 时），才算不变
function domainKeepsGraph(v, dom) {
  if (!v || v.T !== 'function') return false;
  for (const x of [-5.3, -3.3, -2.2, -1.1, -0.35, 0.45, 1.3, 2.15, 3.2, 5.3]) {
    if (dom.inside(x)) continue;
    if (!(x < v.a || x > v.b) && Number.isFinite(v.f(x))) return false; // a、b 可能没有设置（整条实数轴）
  }
  return true;
}

// 只含 x 的条件（定义域）：x ≤ 0、0 < x < 3（不含 y、参数）
const X_CONDITION = /^(?=.*(?<![A-Za-z])x(?![A-Za-z]))(?=.*[<>≤≥≠])[\d\s.+\-*/()√πx<>≤≥≠=]+$/;

const SIMPLE_VALUE = /^-?\s*(?:\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?|(?:\d+(?:\.\d+)?\s*)?√\s*\(?\d+(?:\.\d+)?\)?)$/;

function extractEquations(s, add, params, raw = s) {
  for (const m of s.matchAll(/当\s*([a-z])\s*=\s*(-?[^，。；时\s]+)\s*时/g)) { const n = parseNum(m[2]); if (n) params[m[1]] = n.value; }
  // 「椭圆 C：x²/4 + y²/3 = 1」：名字和方程放在一起
  const t = s.replace(/(?<![A-Za-z0-9])([A-Za-z]\d?)\s*[:：]\s*(?=[^，。；：\n]*[=<>≤≥])/g, '$1:')
    .replace(/[(（][^()（）]*∈[^()（）]*[)）]/g, ' ');
  // 按中文、日文（平假名、片假名、日文标点）切成一段一段的“数学式”（R6-1 的「に対して」曾被当成式子的一部分）
  const runs = t.split(/[一-鿿぀-ヿ　-〿，。．；、？！“”‘’【】《》「」『』・\n]+/);
  // 分段函数：同一个名字定义了不止一次，或写成 \begin{cases}、{ … }。这类函数不提取，免得把某一段当成整条曲线补进图里
  const piecewise = new Set();
  const defCount = {};
  for (const m of t.matchAll(/(?<![A-Za-z])([a-z])\s*\(\s*x\s*\)\s*=/g)) if ((defCount[m[1]] = (defCount[m[1]] || 0) + 1) > 1) piecewise.add(m[1]);
  for (const m of raw.matchAll(/(?<![A-Za-z])([a-z])\s*\(\s*x\s*\)\s*=\s*(?:\\left\s*)?(?:\\begin\s*\{cases\}|\\\{|\{)/g)) piecewise.add(m[1]);
  const ineqs = [];
  for (const run of runs) {
    const runParts = splitTop(run, [',', ';']);
    for (let pi = 0; pi < runParts.length; pi++) {
      let part = runParts[pi].trim().replace(/^[.\s]+|[.\s]+$/g, '');
      // 式子后面括号里的定义域「(x > 0)」「(0 ≤ x ≤ 2)」先拿出来；否则整段会被当成不等式，函数就丢了（R6-1）。
      // 后面再判断：定义域改变了图像（分段函数、限定范围的函数）就不提取，免得把整条曲线补进图里
      let domain = null;
      if (/=/.test(part.replace(/[<>≤≥!]=/g, ''))) {
        const dm = /\s*[(（]([^()（）=]*[<>≤≥≠][^()（）]*)[)）]\s*$/.exec(part);
        if (dm) { domain = dm[1]; part = part.slice(0, dm.index).trim(); }
        // 「f(x) = x² - 2x, 0 ≤ x ≤ 3」：紧跟着的只含 x 的条件也是定义域（这一段照常当作不等式处理）
        else if (pi + 1 < runParts.length && X_CONDITION.test(runParts[pi + 1].trim())) domain = runParts[pi + 1].trim();
      }
      if (!/[=<>≤≥]/.test(part)) continue;
      let name = null;
      const nm = /^([A-Za-z]\d?):\s*(.+)$/.exec(part);
      if (nm) { name = nm[1]; part = nm[2].trim(); }
      const hasXY = /(?<![A-Za-z])[xy](?![A-Za-z])/.test(part);
      if (/[<>≤≥]/.test(part)) {
        // 只收 x、y 的不等式（a > 0 这类参数范围不算）
        if (hasXY && !/[a-wzA-Z]/.test(part.replace(/sqrt|sin|cos|tan|ln|log|abs|pi/g, '')) && !buildScene([`Region(${part})`], {}).errors.length) ineqs.push(part);
        continue;
      }
      const sides = part.split('=');
      if (sides.length !== 2) continue;
      const [L, Rt] = sides.map((x) => x.trim());
      if (!L || !Rt) continue;
      if (/^[a-z]$/.test(L) && L !== 'x' && L !== 'y') { // m = 1 是参数取值；z = 2x + y 是目标函数，都不是曲线
        if (SIMPLE_VALUE.test(Rt)) { const n = parseNum(Rt); if (n) params[L] = n.value; }
        continue;
      }
      if (!hasXY) continue;
      let src = null, fname = name;
      const fm = /^([a-z])\s*\(\s*x\s*\)$/.exec(L);
      const hasY = /(?<![A-Za-z])y(?![A-Za-z])|\dy/.test(Rt);
      if (fm && !hasY) { src = `${fm[1]}(x) = ${Rt}`; fname = fm[1]; }
      else if (L === 'y' && !hasY) src = `${name ? `${name}: ` : ''}y = ${Rt}`;
      else if (L === 'x' && name && !/[xy]/.test(Rt)) src = `${name}: x = ${Rt}`;
      else if (/^[A-Za-z]\w*$/.test(L)) continue; // z = 2x + y、S = … 是定义，不是曲线
      else if (/[x]/.test(part) && /[y]/.test(part)) src = `${name ? `${name}: ` : ''}${L} = ${Rt}`;
      if (!src) continue;
      if (fname && piecewise.has(fname)) continue;
      let c = compileCurve(src);
      if (!c) continue;
      if (domain) {
        // 定义域改变了图像：有限区间上的函数按区间画（Function(式子, a, b)）；其余（x > 1 这类半无限的、看不懂的）不提取
        const dom = parseDomain(domain);
        if (!dom) continue;
        if (!dom.params && !domainKeepsGraph(c.value, dom)) {
          if (!fm || !Number.isFinite(dom.lo) || !Number.isFinite(dom.hi)) continue;
          src = `${fm[1]}(x) = Function(${Rt}, ${dom.lo}, ${dom.hi})`;
          c = compileCurve(src);
          if (!c) continue;
        }
      }
      const desc = `${name ? `${name}：` : ''}${part}${domain ? `（${domain.trim()}）` : ''}`;
      add({ type: 'curve', src, name: fname || null, vars: c.vars, desc }, 'curve', desc);
    }
  }
  if (ineqs.length >= 2 && ineqs.some((q) => /(?<![A-Za-z])y|\dy/.test(q))) {
    add({ type: 'region', src: ineqs.join(', '), desc: ineqs.join('，') }, 'region', `${ineqs.join('，')} 表示的区域`);
  }
}

// ---------------- 核对 ----------------
/**
 * @returns {{ results: Array<{fact, ok: boolean|null, detail: string}>, sat: number, total: number }}
 * ok 为 null 表示无法核对（例如方程里的参数图中没有定义），不计入总数。
 */
export function verifyFacts(scene, facts) {
  const results = facts.map((fact) => {
    const r = runCheck(scene, fact.check);
    const na = fact.check.type === 'curve' && !r.ok && /^图中没有参数/.test(r.detail) && !(fact.check.vars || []).every((v) => fact.check.params?.[v] !== undefined);
    return { fact, ok: na ? null : r.ok, detail: r.detail };
  });
  const counted = results.filter((r) => r.ok !== null);
  return { results, sat: counted.filter((r) => r.ok).length, total: counted.length };
}

// 告诉模型哪些题目条件没有满足
export function describeViolations(results) {
  return results.filter((r) => r.ok === false).map((r) => `${r.fact.desc}（${r.detail}）`);
}

// ---------------- 按题目补全 ----------------
const CURVE_KINDS = new Set(['function', 'line', 'implicit']);
// 直线（或一次函数）与其它曲线分开对待：不能用直线去替换抛物线
function isLinear(v) {
  if (!v) return false;
  if (v.T === 'line') return true;
  if (v.T !== 'function') return false;
  const y0 = v.f(0), k = v.f(1) - y0;
  return Number.isFinite(y0) && Number.isFinite(k) && [-2.3, 1.7, 3.9].every((x) => Math.abs(v.f(x) - (y0 + k * x)) <= 1e-9 * (1 + Math.abs(y0) + Math.abs(k * x)));
}
const tagsOf = (line) => (String(line).match(/#[A-Za-z0-9_]+/g) || []).join(' ');

// 模型自己写的“普通方程”：f(x) = …、l: y = …、x^2 + y^2 = 4（不含 Function、If、Derivative，也不引用别的函数）
function plainEquation(o, scene) {
  if (!o || !CURVE_KINDS.has(o.value?.T)) return false;
  const src = o.src.replace(/#[A-Za-z0-9_]+/g, '').replace(/"[^"]*"/g, '');
  if (!/=/.test(src) || /\b(?:Function|If|Derivative|Integral|Line|Segment|Ray|Perpendicular|Parallel|Tangent|Polygon)\s*\(/.test(src)) return false;
  const rhs = src.split('=').slice(1).join('=');
  return !scene.objects.some((p) => p !== o && p.value?.T === 'function' && new RegExp(`(?<![A-Za-z0-9_])${p.name}\\s*\\(`).test(rhs));
}

function replaceLine(lines, lineNo, text) {
  const out = lines.slice();
  out[lineNo] = text;
  return out;
}

/**
 * 把题目里写明、但图里没有画对的内容补上。每一处补充都会重新核对，确认确实变好了才保留。
 * @returns {{ commands: string[], added: Array<{ src: string, desc: string, replaced?: string }> }}
 */
export function completeFigure(commands, extracted) {
  const { facts, polygons } = extracted;
  let cmds = commands.slice();
  const added = [];
  let scene = buildScene(cmds, {});
  const score = (sc) => verifyFacts(sc, facts).sat;
  const tryChange = (next, info) => {
    const sc = buildScene(next, {});
    if (sc.errors.length > scene.errors.length || score(sc) <= score(scene)) return false;
    cmds = next; scene = sc; added.push(info);
    return true;
  };

  // 1. 平行四边形（矩形、正方形、菱形）只缺一个顶点：由另外三个顶点算出来
  for (const p of polygons) {
    if (!PARALLELOGRAM_LIKE.has(p.type)) continue;
    const missing = p.v.filter((n) => !findPoint(scene, n));
    if (missing.length !== 1 || scene.byName.has(missing[0])) continue;
    const i = p.v.indexOf(missing[0]);
    const [prev, next, opp] = [p.v[(i + 3) % 4], p.v[(i + 1) % 4], p.v[(i + 2) % 4]];
    const line = `${missing[0]} = ${prev} + ${next} - ${opp}`;
    const extra = scene.objects.some((o) => o.value?.T === 'polygon' && o.value.pts.length === 4) ? [] : [`Polygon(${p.v.join(', ')})`];
    tryChange([...cmds, line, ...extra], { src: [line, ...extra].join('；'), desc: `${p.type} ${p.v.join('')} 的顶点 ${missing[0]}` });
  }

  // 2. 题目给出的方程
  for (const f of facts) {
    if (f.check.type !== 'curve') continue;
    const r = runCheck(scene, f.check);
    if (r.ok) continue;
    const c = f.check;
    const known = c.params || {};
    if ((c.vars || []).some((v) => known[v] === undefined && typeof scene.values[v] !== 'number')) continue; // 参数未知，没法补
    const defs = (c.vars || []).filter((v) => typeof scene.values[v] !== 'number' && !scene.byName.has(v)).map((v) => `${v} = ${known[v]}`);
    const body = c.src.replace(/^[A-Za-z]\d?:\s*/, '');
    const refLinear = isLinear(compileCurve(c.src)?.value);
    // 优先替换模型画错的同一条曲线：同名，或者同类的普通方程只有一条且对不上
    let target = c.name ? scene.byName.get(c.name) : null;
    if (target && !plainEquation(target, scene)) target = null;
    if (!target) {
      const others = facts.filter((g) => g.check.type === 'curve' && g !== f).map((g) => g.check);
      const cands = scene.objects.filter((o) => plainEquation(o, scene) && isLinear(o.value) === refLinear
        && !others.some((oc) => runCheck(buildScene([o.src], {}), oc).ok));
      if (cands.length === 1) target = cands[0];
    }
    let done = false;
    if (target && target.lineNo >= 0) {
      const fvar = /^\s*[a-z]\w*\s*\(\s*([a-z])\s*\)\s*=/.exec(target.src)?.[1];
      let line;
      if (fvar && /^[a-z]\(x\) = /.test(c.src)) line = `${target.name}(x) = ${c.src.split('=').slice(1).join('=').trim()}`;
      else if (fvar && /^(?:[A-Za-z]\d?: )?y = /.test(c.src)) line = `${target.name}(x) = ${body.replace(/^y\s*=\s*/, '')}`;
      else line = `${target.auto ? '' : `${target.name}: `}${/^[a-z]\(x\) = /.test(c.src) ? `y = ${c.src.split('=').slice(1).join('=').trim()}` : body}`;
      line = `${line} ${tagsOf(target.src)}`.trim();
      const next = replaceLine(cmds, target.lineNo, line);
      done = tryChange([...next.slice(0, target.lineNo), ...defs, ...next.slice(target.lineNo)], { src: line, desc: c.desc || c.src, replaced: target.src });
    }
    if (!done) {
      const nameFree = c.name && !scene.byName.has(c.name);
      let line = nameFree ? c.src : /^[a-z]\(x\) = /.test(c.src) ? `y = ${c.src.split('=').slice(1).join('=').trim()}` : body;
      tryChange([...cmds, ...defs, line], { src: line, desc: c.desc || c.src });
    }
  }

  // 3. 不等式组表示的区域
  for (const f of facts) {
    if (f.check.type !== 'region' || runCheck(scene, f.check).ok) continue;
    const line = `Region(${f.check.src})`;
    const wrong = scene.objects.find((o) => o.value?.T === 'region' && o.lineNo >= 0);
    if (wrong && tryChange(replaceLine(cmds, wrong.lineNo, `${wrong.auto ? '' : `${wrong.name} = `}${line} ${tagsOf(wrong.src)}`.trim()), { src: line, desc: f.desc, replaced: wrong.src })) continue;
    tryChange([...cmds, line], { src: line, desc: f.desc });
  }
  return { commands: cmds, added };
}
