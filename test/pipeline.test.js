import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline, parseAnalysis, better, PIPELINE_PRESETS, looksLooping, repeatingTail, countingLoop } from '../public/lib/pipeline.js';

const ISO = '如图，在△ABC 中，AB = AC = 5，BC = 6，D 为 BC 的中点，DE⊥AC 于点 E，求 DE 的长。';
const GOOD = ['A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'D = Midpoint(B, C)', 'E = Foot(D, Line(A, C))', 'Segment(D, E)'];
const WRONG_E = ['A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'D = Midpoint(B, C)', 'E = (1.5, 2)', 'Segment(D, E)']; // E 在 AC 上，但 DE 不垂直于 AC
const WRONG_A = ['A = (0, 3)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'D = Midpoint(B, C)', 'E = Foot(D, Line(A, C))'];

// 假的接口：按顺序返回预先准备好的输出，并记录每次请求
function fakeApi({ analyses = [], repairs = [] } = {}) {
  const calls = [];
  const reply = (out, onEvent) => {
    if (out instanceof Error) throw out;
    const text = typeof out === 'string' ? out : JSON.stringify(out);
    onEvent({ t: 'delta', v: text.slice(0, 10) });
    onEvent({ t: 'delta', v: text.slice(10) });
    onEvent({ t: 'done', stats: { tokensPerSecond: 100 } });
  };
  return {
    calls,
    async analyze(body, signal, onEvent) {
      calls.push({ kind: 'analyze', body });
      if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      reply(analyses.shift(), onEvent);
    },
    async repair(body, signal, onEvent) {
      calls.push({ kind: 'repair', body });
      reply(repairs.shift(), onEvent);
    },
  };
}
const analysis = (commands) => ({ title: 't', category: '平面几何', knowns: [], goal: '', layout: '', commands, insight: '' });

test('第一版就符合题意：只调用一次模型', async () => {
  const api = fakeApi({ analyses: [analysis(GOOD)] });
  const r = await runPipeline({ text: ISO, api });
  assert.equal(r.calls, 1);
  assert.equal(r.best.source, 'first');
  assert.equal(r.best.sat, r.best.total);
  assert.equal(api.calls[0].body.temperature, 0.2);
});

test('条件不满足：把具体问题发给模型修正，修正后更好就采用', async () => {
  const api = fakeApi({ analyses: [analysis(WRONG_E)], repairs: [{ commands: GOOD }] });
  const events = [];
  const r = await runPipeline({ text: ISO, api, onEvent: (e) => events.push(e.type) });
  assert.equal(r.best.source, 'repair');
  assert.equal(r.calls, 2);
  const rep = api.calls.find((c) => c.kind === 'repair').body;
  assert.ok(rep.issues.some((s) => s.startsWith('DE ⊥ AC')), rep.issues.join('；'));
  assert.deepEqual(rep.errors, []);
  assert.ok(events.includes('facts') && events.includes('repair-done') && events.includes('best'));
});

test('修正没有变好：重新生成，保留最好的一版', async () => {
  const api = fakeApi({ analyses: [analysis(WRONG_A), analysis(WRONG_E), analysis(GOOD)], repairs: [{ commands: WRONG_A }] });
  const r = await runPipeline({ text: ISO, api, options: { maxAnalyses: 3 } });
  assert.equal(r.best.source, 'retry2');
  assert.equal(r.calls, 4);
  assert.deepEqual(api.calls.map((c) => c.kind), ['analyze', 'repair', 'analyze', 'analyze']);
  assert.deepEqual(api.calls.filter((c) => c.kind === 'analyze').map((c) => c.body.temperature), [0.2, 0.7, 0.7]);
  assert.equal(r.attempts.find((a) => a.kind === 'repair').accepted, false);
});

test('次数用完时返回满足条件最多的一版', async () => {
  const api = fakeApi({ analyses: [analysis(WRONG_A), analysis(WRONG_E)], repairs: ['{"commands": []}'] });
  const r = await runPipeline({ text: ISO, api, options: { maxAnalyses: 2 } });
  assert.equal(r.best.source, 'retry1');
  assert.ok(r.best.sat < r.best.total);
});

test('题目里写明的方程由程序补上，不需要再调用模型', async () => {
  const api = fakeApi({ analyses: [analysis(['l: y = x + 1', 'A = Intersect(l, xAxis)'])] });
  const r = await runPipeline({ text: '已知椭圆 C：x²/4 + y²/3 = 1，直线 l：y = x + 1，求弦长。', api });
  assert.equal(r.calls, 1);
  assert.equal(r.best.added.length, 1);
  assert.equal(r.best.sat, r.best.total);
});

test('旧流程（baseline）：不核对条件，只在命令出错时修正，按原来的严格规则判定', async () => {
  const api = fakeApi({ analyses: [analysis(['A = (0, 0)', 'B = Foo(A)'])], repairs: [{ commands: ['A = (0, 0)', 'B = (1, 1)'] }] });
  const r = await runPipeline({ text: ISO, api, options: PIPELINE_PRESETS.baseline });
  assert.equal(r.extracted, null);
  assert.equal(r.best.source, 'repair');
  assert.deepEqual(api.calls.find((c) => c.kind === 'repair').body.issues, []);
  const api2 = fakeApi({ analyses: [analysis(WRONG_E)] });
  const r2 = await runPipeline({ text: ISO, api: api2, options: PIPELINE_PRESETS.baseline });
  assert.equal(r2.calls, 1); // 没有错误就不修正（不知道图对不对）
});

test('之后的尝试失败不影响已有结果；第一次失败、或被取消时报错', async () => {
  const api = fakeApi({ analyses: [analysis(WRONG_E), new Error('网络断了')], repairs: ['{"commands": []}'] });
  const r = await runPipeline({ text: ISO, api, options: { maxAnalyses: 3 } });
  assert.equal(r.best.source, 'first');
  await assert.rejects(runPipeline({ text: ISO, api: fakeApi({ analyses: [new Error('连不上')] }) }), /连不上/);
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(runPipeline({ text: ISO, api: fakeApi({ analyses: [analysis(GOOD)] }), signal: ac.signal }), /aborted/);
  await assert.rejects(runPipeline({ text: ISO, api: fakeApi({ analyses: ['不是 JSON'] }), options: { maxAnalyses: 1 } }), /没有返回有效的分析结果/);
});

test('解析模型输出：截断的 JSON、被吃掉的反斜杠、行号', () => {
  const a = parseAnalysis('{"title": "\\frac{1}{2}", "commands": ["1. A = (0, 0)", "B = (\\frac{1}{2}, 0)", "Text(');
  assert.equal(a.title, '\\frac{1}{2}');
  assert.equal(a.commands[0], 'A = (0, 0)');
  assert.equal(a.commands[1], 'B = (\\frac{1}{2}, 0)');
  assert.equal(parseAnalysis('{"title": "x"}'), null);
});

test('比较两版：先看能否画图，再看满足的条件，最后看错误', () => {
  const c = (drawable, sat, errors) => ({ drawable, sat, total: 5, errors: new Array(errors).fill({}) });
  assert.ok(better(c(true, 0, 9), c(false, 0, 0)));
  assert.ok(better(c(true, 4, 3), c(true, 3, 0)));
  assert.ok(better(c(true, 4, 0), c(true, 4, 1)));
  assert.ok(!better(c(true, 4, 1), c(true, 4, 1)));
});

test('发现重复：同一条命令连写 3 遍就停止生成，用已经写出的部分', async () => {
  const good = ['A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)'];
  let streamed = 0;
  const api = {
    async analyze(body, signal, onEvent) {
      onEvent({ t: 'delta', v: '{"title":"t","category":"平面几何","knowns":[],"goal":"","layout":"","commands":[' });
      const cmds = [...good, ...Array(50).fill('Row(答案, 10, 45, 120)')];
      for (let i = 0; i < cmds.length; i++) {
        if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        streamed++;
        onEvent({ t: 'delta', v: `${i ? ',' : ''}${JSON.stringify(cmds[i])}` });
        await new Promise((r) => setTimeout(r, 0));
      }
      onEvent({ t: 'delta', v: '],"insight":""}' });
      onEvent({ t: 'done', stats: {} });
    },
    async repair() { throw new Error('不应该修正'); },
  };
  const r = await runPipeline({ text: '画一个三角形 ABC', api, options: { maxAnalyses: 1, facts: false } });
  assert.ok(streamed < 15, `重复后应尽快停止，实际生成了 ${streamed} 条`);
  assert.equal(r.attempts[0].looped, true);
  assert.deepEqual(r.best.commands.slice(0, 4), good);
});

test('文字原样重复也能发现；正常输出不会被误判', () => {
  const loop = '{"layout":"' + '当 a=1 时切点横坐标为 1，不满足条件。'.repeat(30);
  assert.equal(looksLooping(loop), true);
  const normal = JSON.stringify({ title: '等腰三角形', commands: ['A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'D = Midpoint(B, C)', 'Segment(A, D)', 'E = Foot(D, Line(A, C))', 'Segment(D, E)'] });
  assert.equal(looksLooping(normal), false);
  assert.equal(repeatingTail(['a', 'b', 'a', 'b', 'a', 'b']), true);
  assert.equal(repeatingTail(['a', 'b', 'c', 'a', 'b', 'c']), false);
});

test('时间预算：超过预算后不再修正、不再重新生成', async () => {
  const api = fakeApi({ analyses: [analysis(WRONG_E), analysis(GOOD)], repairs: [{ commands: GOOD }] });
  const r = await runPipeline({ text: ISO, api, options: { maxAnalyses: 3, timeBudgetMs: 0 } });
  assert.equal(r.calls, 1);
  assert.equal(r.budgetHit, true);
  assert.equal(r.best.source, 'first');
});

test('数数式的重复（编号一直往上加）能发现；正方体的 12 条棱不算重复', () => {
  const counting = Array.from({ length: 40 }, (_, i) => `${String.fromCharCode(65 + (i % 26))}' = Intersect(f(x), ${i % 2 ? 'yAxis' : 'xAxis'}, ${Math.floor(i / 2) + 1}) #aux`);
  assert.equal(countingLoop(counting), true);
  const cube = ['A = (2, 0, 0)', 'B = (2, 2, 0)', 'C = (0, 2, 0)', 'D = (0, 0, 0)', 'A1 = (2, 0, 2)', 'B1 = (2, 2, 2)', 'C1 = (0, 2, 2)', 'D1 = (0, 0, 2)',
    ...['AB', 'BC', 'CD', 'DA', 'A1B1', 'B1C1', 'C1D1', 'D1A1', 'AA1', 'BB1', 'CC1', 'DD1'].map((e) => `Segment(${e.match(/[A-Z]\d*/g).join(', ')})`)];
  assert.equal(countingLoop(cube), false);
  assert.equal(looksLooping(JSON.stringify({ title: '正方体', commands: cube })), false);
});

test('review 修正：散点图的 20 个数据点不算重复；数数式的重复仍能发现', () => {
  const scatter = Array.from({ length: 20 }, (_, i) => `P${i + 1} = (${i + 1}, ${2 + 0.5 * i + (i % 3)})`);
  assert.equal(countingLoop(scatter), false);
  assert.equal(looksLooping(JSON.stringify({ title: '散点图', commands: scatter })), false);
  const runaway = Array.from({ length: 45 }, (_, i) => `P${i} = (${i}, ${i * 0.5})`);
  assert.equal(countingLoop(runaway), true);
});
