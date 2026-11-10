// 模型异常输出：被截断的 JSON、缺少字段、重复命名、超长命令等，界面都应该尽量画出能画的部分
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePartialJSON, PARTIAL } from '../public/lib/partial-json.js';
import { buildScene } from '../public/lib/scene.js';

test('流式输出到一半：已完成的字段和命令可以先用', () => {
  const a = parsePartialJSON('{"title":"等腰三角形","knowns":["AB=AC"],"commands":["A = (0, 4)","B = (-3, 0)","C = (3, 0)","Polygon(A, B');
  assert.equal(a.title, '等腰三角形');
  assert.deepEqual(a.knowns, ['AB=AC']);
  assert.equal(a.commands[PARTIAL], true, '最后一条命令还没写完');
  assert.deepEqual(a.commands.slice(0, -1), ['A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)']);
});

test('截断在转义符、\\u 编码、数字、键名中间都不会出错', () => {
  assert.equal(parsePartialJSON('{"a":"x\\').a, 'x');
  assert.equal(parsePartialJSON('{"a":"\\u4e2').a, '');
  assert.equal(parsePartialJSON('{"a":"\\u4e2d文"}').a, '中文');
  assert.deepEqual(parsePartialJSON('{"n":12'), {});
  assert.deepEqual(parsePartialJSON('{"title":"x","kno'), { title: 'x' });
  assert.equal(parsePartialJSON(''), null);
  assert.equal(parsePartialJSON('不是 JSON'), null);
});

test('缺少字段、类型不对：作图部分照常工作', () => {
  const a = parsePartialJSON('{"title":"t","commands":"A = (0,0)"}');
  assert.equal(Array.isArray(a.commands), false); // app.js 会把这种情况当作“没有有效结果”给出提示
});

test('重复命名、空行、注释：报出错误行，其余照常绘制', () => {
  const s = buildScene(['A = (0, 0)', '', '// 注释', 'A = (1, 1)', 'B = (2, 2)', 'Segment(A, B)']);
  assert.equal(s.errors.length, 1);
  assert.match(s.errors[0].message, /已经定义过/);
  assert.equal(s.values.A.x, 0, '保留第一次的定义');
  assert.equal(s.objects.filter((o) => o.value?.T === 'line').length, 1);
});

test('超长或乱码命令不会让引擎崩溃', () => {
  const junk = ['A = ((((((((', 'B = )))', 'Segment(A', '"""', 'x'.repeat(5000), '#hl', 'C = (1, 2) #不存在的标记'];
  const s = buildScene(junk);
  assert.ok(s.errors.length >= 4);
  assert.ok(s.values.C, '合法的命令仍然生效');
});
