// JSON Schema → GBNF（手机端 llama.cpp 用）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaToGbnf } from '../public/lib/gbnf.js';
import { ANALYSIS_SCHEMA, REPAIR_SCHEMA, CATEGORIES } from '../public/lib/prompts.js';

test('小 schema 的语法与 llama.cpp 的写法一致', () => {
  const g = schemaToGbnf({ type: 'object', properties: { commands: { type: 'array', items: { type: 'string' } } }, required: ['commands'] });
  assert.equal(g, [
    'root ::= root-object',
    'root-object-commands ::= "[" space (string ("," space string)*)? "]" space',
    'root-object ::= "{" space "\\"commands\\"" space ":" space root-object-commands "}" space',
    'space ::= | " " | "\\n" [ \\t]{0,20}',
    'char ::= [^"\\\\\\x7F\\x00-\\x1F] | [\\\\] (["\\\\bfnrt] | "u" [0-9a-fA-F]{4})',
    'string ::= "\\"" char* "\\"" space',
    '',
  ].join('\n'));
});

test('分析结果的 schema：属性按顺序出现，题型只能取枚举值', () => {
  const g = schemaToGbnf(ANALYSIS_SCHEMA);
  const order = ['title', 'category', 'knowns', 'goal', 'layout', 'commands', 'insight'].map((k) => g.indexOf(`"\\"${k}\\""`));
  assert.ok(order.every((i) => i > 0), '每个属性都出现');
  assert.deepEqual([...order].sort((a, b) => a - b), order, '属性顺序与 schema 一致');
  for (const c of CATEGORIES) assert.ok(g.includes(`"\\"${c}\\""`), `包含题型 ${c}`);
  assert.ok(schemaToGbnf(REPAIR_SCHEMA).startsWith('root ::= '));
});

test('长度上限：maxLength 和 maxItems 转成重复次数', () => {
  const g = schemaToGbnf({ type: 'object', properties: { c: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 60 } }, required: ['c'] });
  assert.ok(g.includes('string-max-160 ::= "\\"" char{0,160} "\\"" space'), g);
  assert.ok(g.includes('(string-max-160 ("," space string-max-160){0,59})?'), g);
});
