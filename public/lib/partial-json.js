// 容错的 JSON 解析：模型还在输出时，也能解析出已经生成的部分。
// 未闭合的字符串会保留已有内容；若数组的最后一个元素是未闭合的字符串，数组会带上 PARTIAL 标记。

export const PARTIAL = Symbol('partial');
const END = Symbol('end');

export function parsePartialJSON(src) {
  let i = 0;
  const s = String(src);
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };

  function value() {
    ws();
    if (i >= s.length) throw END;
    const c = s[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(s.slice(i));
    if (!m) throw END;
    if (i + m[0].length >= s.length && /\d$/.test(m[0])) throw END; // 数字可能还没写完
    i += m[0].length;
    return JSON.parse(m[0]);
  }

  function string() {
    i++;
    let out = '';
    while (i < s.length) {
      const c = s[i];
      if (c === '"') { i++; return out; }
      if (c === '\\') {
        if (i + 1 >= s.length) break;
        const e = s[i + 1];
        if (e === 'u') {
          if (i + 5 >= s.length) break;
          out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16));
          i += 6;
          continue;
        }
        out += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' }[e] ?? e;
        i += 2;
        continue;
      }
      out += c;
      i++;
    }
    const p = new String(out); // eslint-disable-line no-new-wrappers
    p.partial = true;
    throw { partialString: p };
  }

  function array() {
    i++;
    const arr = [];
    for (;;) {
      ws();
      if (i >= s.length) return arr;
      if (s[i] === ']') { i++; return arr; }
      try {
        arr.push(value());
      } catch (e) {
        if (e && e.partialString) { arr.push(String(e.partialString)); arr[PARTIAL] = true; return arr; }
        if (e === END) return arr;
        throw e;
      }
      ws();
      if (s[i] === ',') i++;
      else if (s[i] === ']') { i++; return arr; }
      else if (i >= s.length) return arr;
    }
  }

  function object() {
    i++;
    const obj = {};
    for (;;) {
      ws();
      if (i >= s.length) return obj;
      if (s[i] === '}') { i++; return obj; }
      if (s[i] === ',') { i++; continue; }
      if (s[i] !== '"') return obj;
      let key;
      try { key = string(); } catch { return obj; }
      ws();
      if (s[i] !== ':') return obj;
      i++;
      try {
        obj[key] = value();
      } catch (e) {
        if (e && e.partialString) { obj[key] = String(e.partialString); obj[PARTIAL] = key; return obj; }
        if (e === END) return obj;
        throw e;
      }
    }
  }

  try {
    return value();
  } catch {
    return null;
  }
}
