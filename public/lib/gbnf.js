// 把输出格式（JSON Schema 的一个子集）转换成 llama.cpp 的 GBNF 语法。
// 手机上直接用 llama.cpp 推理时，用它约束模型“只能输出符合格式的 JSON”，效果等同于 Ollama 的 format 参数。
// 支持：object（按 required 顺序输出全部属性）、string（含 maxLength）、string 的 enum、array（含 maxItems）、number、integer、boolean。
// 规则写法与 llama.cpp 自带的 json-schema-to-grammar 保持一致（space 最多 20 个缩进字符，防止模型无限输出空白）。

const BASE = {
  space: '| " " | "\\n" [ \\t]{0,20}',
  char: '[^"\\\\\\x7F\\x00-\\x1F] | [\\\\] (["\\\\bfnrt] | "u" [0-9a-fA-F]{4})',
  string: '"\\"" char* "\\"" space',
  number: '("-"? ([0-9] | [1-9] [0-9]{0,15})) ("." [0-9]+)? ([eE] [-+]? [0-9]+)? space',
  integer: '("-"? ([0-9] | [1-9] [0-9]{0,15})) space',
  boolean: '("true" | "false") space',
};

const lit = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const jsonLit = (v) => lit(JSON.stringify(v));

export function schemaToGbnf(schema) {
  const rules = new Map();
  const used = new Set();
  const ruleName = (base) => {
    let name = base.replace(/[^A-Za-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'r';
    let k = name, i = 1;
    while (rules.has(k)) k = `${name}-${i++}`;
    return k;
  };

  function visit(s, name) {
    if (s.enum) {
      const r = ruleName(name);
      rules.set(r, `(${s.enum.map(jsonLit).join(' | ')}) space`);
      return r;
    }
    if (s.type === 'string' && s.maxLength) {
      used.add('char');
      const r = `string-max-${s.maxLength}`;
      if (!rules.has(r)) rules.set(r, `"\\"" char{0,${s.maxLength}} "\\"" space`);
      return r;
    }
    switch (s.type) {
      case 'string': case 'number': case 'integer': case 'boolean':
        used.add(s.type);
        if (s.type === 'string') used.add('char');
        return s.type;
      case 'array': {
        const item = visit(s.items || { type: 'string' }, `${name}-item`);
        const r = ruleName(name);
        const rest = s.maxItems ? `{0,${s.maxItems - 1}}` : '*';
        rules.set(r, `"[" space (${item} ("," space ${item})${rest})? "]" space`);
        return r;
      }
      case 'object': {
        const props = s.properties || {};
        const order = s.required || Object.keys(props);
        const parts = order.map((key, i) => {
          const v = visit(props[key], `${name}-${key}`);
          return `${i ? '"," space ' : ''}${jsonLit(key)} space ":" space ${v}`;
        });
        const r = ruleName(name);
        rules.set(r, `"{" space ${parts.join(' ')} "}" space`);
        return r;
      }
      default:
        throw new Error(`gbnf：不支持的类型 ${s.type}`);
    }
  }

  const top = visit(schema, 'root-object');
  used.add('space');
  const lines = [`root ::= ${top}`];
  for (const [k, v] of rules) lines.push(`${k} ::= ${v}`);
  for (const k of ['space', 'char', 'string', 'number', 'integer', 'boolean']) if (used.has(k)) lines.push(`${k} ::= ${BASE[k]}`);
  return `${lines.join('\n')}\n`;
}
