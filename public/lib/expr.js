// 数学表达式的词法分析与语法分析（Pratt 解析器），输出 AST。
// 支持：+ - * / ^、隐式乘法（2x、2(x+1)、a x）、函数调用、点 (x, y[, z])、
// 比较与逻辑运算（用于 If / Region）、度数 30°、字符串 "..."，
// 以及常见 Unicode / LaTeX 写法（π、√、²、≤、\frac{}{}、\sqrt{} 等）。

export class ParseError extends Error {}

const SUBSCRIPTS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };
const GREEK_LATEX = 'alpha beta gamma delta epsilon theta lambda mu rho sigma tau phi omega'.split(' ');
const GREEK_CHARS = 'αβγδεθλμρστφω';

// 把 LaTeX / Unicode 写法统一成 ASCII 表达式（只处理字符串字面量之外的部分）
export function normalizeSource(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === '“') {
      const close = c === '"' ? '"' : '”';
      let j = i + 1;
      while (j < src.length && src[j] !== close && !(close === '”' && src[j] === '"')) {
        if (src[j] === '\\') j++;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    let k = i;
    while (k < src.length && src[k] !== '"' && src[k] !== '“') k++;
    out += normalizeMathPart(src.slice(i, k));
    i = k;
  }
  return out;
}

function replaceBraced(s, cmd, nArgs, fmt) {
  // 把 \cmd{a}{b} 替换成 fmt(a, b)，支持嵌套花括号
  let idx;
  while ((idx = s.indexOf(cmd)) !== -1) {
    let p = idx + cmd.length;
    let opt = null;
    if (s[p] === '[') {
      const end = s.indexOf(']', p);
      if (end === -1) break;
      opt = s.slice(p + 1, end);
      p = end + 1;
    }
    const args = [];
    for (let a = 0; a < nArgs; a++) {
      while (s[p] === ' ') p++;
      if (s[p] !== '{') {
        // 单个字符参数，如 \frac12
        if (p < s.length) { args.push(s[p]); p++; continue; }
        break;
      }
      let depth = 0, q = p;
      for (; q < s.length; q++) {
        if (s[q] === '{') depth++;
        else if (s[q] === '}') { depth--; if (depth === 0) break; }
      }
      if (q >= s.length) return s;
      args.push(s.slice(p + 1, q));
      p = q + 1;
    }
    if (args.length < nArgs) return s;
    s = s.slice(0, idx) + fmt(args, opt) + s.slice(p);
  }
  return s;
}

function normalizeMathPart(s) {
  s = s
    .replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[，]/g, ',').replace(/[＝]/g, '=')
    .replace(/[：]/g, ':').replace(/[；]/g, ';').replace(/[［]/g, '[').replace(/[］]/g, ']')
    .replace(/[−–—]/g, '-').replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/')
    .replace(/≤|⩽/g, '<=').replace(/≥|⩾/g, '>=').replace(/≠/g, '!=')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/π/g, 'pi').replace(/∞/g, 'Infinity')
    .replace(/[₀-₉]+/g, m => '_' + [...m].map(ch => SUBSCRIPTS[ch]).join(''))
    .replace(/√/g, ' sqrt ').replace(/∧/g, '&&').replace(/∨/g, '||').replace(/′/g, "'");
  if (s.includes('\\')) {
    s = s.replace(/\\left|\\right/g, '').replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/')
      .replace(/\\leq?(?![a-z])/g, '<=').replace(/\\geq?(?![a-z])/g, '>=').replace(/\\neq?(?![a-z])/g, '!=')
      .replace(/\\infty/g, 'Infinity').replace(/\\pi/g, 'pi').replace(/\\circ/g, '°').replace(/\\degree/g, '°')
      .replace(/\\(arcsin|arccos|arctan|sin|cos|tan|cot|sec|csc|ln|log|lg|exp)/g, '$1')
      .replace(/\\[,;!: ]/g, ' ');
    GREEK_LATEX.forEach((g, n) => { s = s.replace(new RegExp('\\\\' + g + '(?![a-z])', 'g'), GREEK_CHARS[n]); });
    s = replaceBraced(s, '\\dfrac', 2, a => `((${a[0]})/(${a[1]}))`);
    s = replaceBraced(s, '\\tfrac', 2, a => `((${a[0]})/(${a[1]}))`);
    s = replaceBraced(s, '\\frac', 2, a => `((${a[0]})/(${a[1]}))`);
    s = replaceBraced(s, '\\sqrt', 1, (a, opt) => (opt ? `nroot(${a[0]}, ${opt})` : `sqrt(${a[0]})`));
  }
  s = s.replace(/_\{([A-Za-z0-9]+)\}/g, '_$1').replace(/\^\{/g, '^(').replace(/[{}]/g, m => (m === '{' ? '(' : ')'));
  return s;
}

// ---------------- 词法分析 ----------------
const IDENT_RE = /^[A-Za-z_Ͱ-Ͽ][A-Za-z0-9_Ͱ-Ͽ]*'*/;
const NUM_RE = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
const TWO_CHAR = ['<=', '>=', '==', '!=', '&&', '||'];
const ONE_CHAR = '+-*/^(),=<>!:;°[]|';

export function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === '“') {
      const close = c === '"' ? '"' : '”';
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== close && !(close === '”' && src[j] === '"')) {
        if (src[j] === '\\' && j + 1 < src.length && (src[j + 1] === '"' || src[j + 1] === '\\')) { s += src[j + 1]; j += 2; continue; }
        s += src[j++];
      }
      if (j >= src.length) throw new ParseError('字符串缺少结束引号');
      toks.push({ t: 'str', v: s, pos: i });
      i = j + 1;
      continue;
    }
    const rest = src.slice(i);
    const num = NUM_RE.exec(rest);
    if (num) { toks.push({ t: 'num', v: parseFloat(num[0]), pos: i }); i += num[0].length; continue; }
    const id = IDENT_RE.exec(rest);
    if (id) { toks.push({ t: 'id', v: id[0], pos: i }); i += id[0].length; continue; }
    const two = rest.slice(0, 2);
    if (TWO_CHAR.includes(two)) { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
    if (ONE_CHAR.includes(c)) {
      let v = c;
      if (c === '[') v = '(';
      if (c === ']') v = ')';
      toks.push({ t: 'op', v, pos: i });
      i++;
      continue;
    }
    throw new ParseError(`无法识别的字符「${c}」`);
  }
  toks.push({ t: 'eof', pos: src.length });
  return toks;
}

// ---------------- 语法分析 ----------------
// 绑定强度：= 1, || 2, && 3, 比较 4, + - 5, * / 隐式乘 6, 一元负号 7, ^ 8, ° 9
const CMP_OPS = ['<', '<=', '>', '>=', '==', '!='];

/**
 * 解析一个表达式。
 * @param {string} src
 * @param {{isCallable?: (name: string) => boolean, isPrefixFunc?: (name: string) => boolean}} opts
 * @returns {{ast: object, label: string|null}} label 为表达式后面紧跟的字符串（作为标签）
 */
export function parseExpression(src, opts = {}) {
  const toks = tokenize(normalizeSource(src));
  const isCallable = opts.isCallable || (() => false);
  const isPrefixFunc = opts.isPrefixFunc || (() => false);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const isOp = (tok, v) => tok.t === 'op' && tok.v === v;
  const expect = (v) => {
    const tok = next();
    if (!isOp(tok, v)) throw new ParseError(`缺少「${v}」`);
  };
  const startsPrimary = (tok) => tok.t === 'num' || tok.t === 'id' || isOp(tok, '(');

  function parseArgs() {
    // 已经消费了 '('
    const args = [];
    if (isOp(peek(), ')')) { next(); return args; }
    for (;;) {
      args.push(parseExpr(0));
      const tok = next();
      if (isOp(tok, ')')) return args;
      if (!isOp(tok, ',') && !isOp(tok, ';')) throw new ParseError('参数之间缺少逗号或右括号');
    }
  }

  // 不带括号的函数参数：sin 2x → sin(2x)，在遇到下一个函数名或显式运算符时停止
  function parseImplicitArg() {
    let node = parseExpr(8);
    while (startsPrimary(peek()) && !(peek().t === 'id' && (isCallable(peek().v) || isPrefixFunc(peek().v)))) {
      node = { type: 'bin', op: '*', left: node, right: parseExpr(8) };
    }
    return node;
  }

  function parsePrefix() {
    const tok = next();
    if (tok.t === 'num') return { type: 'num', value: tok.v };
    if (tok.t === 'str') return { type: 'str', value: tok.v };
    if (tok.t === 'id') {
      const name = tok.v;
      // 已知命令/函数，或形如 Foo( 的未知命令（交给编译阶段报“未知命令”）
      if (isOp(peek(), '(') && (isCallable(name) || /^[A-Z][a-z]{2,}/.test(name))) {
        next();
        return { type: 'call', name, args: parseArgs() };
      }
      if (isPrefixFunc(name) && startsPrimary(peek())) {
        return { type: 'call', name, args: [parseImplicitArg()] };
      }
      return { type: 'var', name };
    }
    if (isOp(tok, '(')) {
      const items = [parseExpr(0)];
      while (isOp(peek(), ',')) { next(); items.push(parseExpr(0)); }
      expect(')');
      return items.length === 1 ? { type: 'group', arg: items[0] } : { type: 'tuple', items };
    }
    if (isOp(tok, '|')) {
      const arg = parseExpr(0);
      expect('|');
      return { type: 'call', name: 'abs', args: [arg] };
    }
    if (isOp(tok, '-')) return { type: 'neg', arg: parseExpr(7) };
    if (isOp(tok, '+')) return parseExpr(7);
    if (isOp(tok, '!')) return { type: 'not', arg: parseExpr(7) };
    if (tok.t === 'eof') throw new ParseError('表达式不完整');
    throw new ParseError(`意外的符号「${tok.v}」`);
  }

  function parseExpr(minBp) {
    let left = parsePrefix();
    for (;;) {
      const tok = peek();
      if (tok.t === 'op') {
        const v = tok.v;
        if (v === '°') { if (9 < minBp) break; next(); left = { type: 'deg', arg: left }; continue; }
        if (v === '^') { if (8 < minBp) break; next(); left = { type: 'bin', op: '^', left, right: parseExpr(8) }; continue; }
        if (v === '*' || v === '/') { if (6 < minBp) break; next(); left = { type: 'bin', op: v, left, right: parseExpr(7) }; continue; }
        if (v === '+' || v === '-') { if (5 < minBp) break; next(); left = { type: 'bin', op: v, left, right: parseExpr(6) }; continue; }
        if (CMP_OPS.includes(v)) {
          if (4 < minBp) break;
          const ops = [], args = [left];
          while (peek().t === 'op' && CMP_OPS.includes(peek().v)) { ops.push(next().v); args.push(parseExpr(5)); }
          left = { type: 'cmp', ops, args };
          continue;
        }
        if (v === '&&') { if (3 < minBp) break; next(); left = { type: 'logic', op: '&&', left, right: parseExpr(4) }; continue; }
        if (v === '||') { if (2 < minBp) break; next(); left = { type: 'logic', op: '||', left, right: parseExpr(3) }; continue; }
        if (v === '=') { if (1 < minBp) break; next(); left = { type: 'eq', left, right: parseExpr(2) }; continue; }
        if (v === '(' && 6 >= minBp) {
          // 隐式乘法：(x+1)(x-1)、a(x+1)
          left = { type: 'bin', op: '*', left, right: parseExpr(7) };
          continue;
        }
        break;
      }
      if ((tok.t === 'num' || tok.t === 'id') && 6 >= minBp) {
        left = { type: 'bin', op: '*', left, right: parseExpr(7) };
        continue;
      }
      break;
    }
    return left;
  }

  const ast = parseExpr(0);
  let label = null;
  if (peek().t === 'str') label = next().v;
  if (peek().t !== 'eof') {
    const tok = peek();
    throw new ParseError(`多余的内容「${tok.v ?? ''}」`);
  }
  return { ast, label };
}

// 收集 AST 中出现的变量名
export function collectVars(ast, out = new Set()) {
  if (!ast || typeof ast !== 'object') return out;
  if (ast.type === 'var') out.add(ast.name);
  for (const key of ['arg', 'left', 'right']) if (ast[key]) collectVars(ast[key], out);
  for (const key of ['items', 'args']) if (ast[key]) ast[key].forEach(n => collectVars(n, out));
  return out;
}
