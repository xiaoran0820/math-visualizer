// 手机本地模型客户端：用假插件验证事件转发、输出格式约束、取消和错误处理
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeviceApi } from '../public/lib/api-device.js';

function fakePlugin({ tokens = ['{"a"', ':1}'], fail = null, slow = 0 } = {}) {
  const listeners = new Set();
  const calls = [];
  const cancelled = new Set();
  return {
    calls, cancelled,
    async status() { return { ready: true, model: 'qwen3.5:2b', models: ['qwen3.5:2b'] }; },
    async generate(p) {
      calls.push(p);
      if (fail) throw Object.assign(new Error(fail), { code: 'oom' });
      for (const t of tokens) {
        if (slow) await new Promise((r) => setTimeout(r, slow));
        if (cancelled.has(p.requestId)) throw new Error('cancelled');
        listeners.forEach((fn) => fn({ requestId: p.requestId, text: t }));
        listeners.forEach((fn) => fn({ requestId: 'someone-else', text: 'X' })); // 其他请求的 token 不能混进来
      }
      return { stats: { outputTokens: tokens.length } };
    },
    async cancel({ requestId }) { cancelled.add(requestId); },
    async addListener(ev, fn) { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
    get listenerCount() { return listeners.size; },
  };
}

test('事件格式与服务端接口一致：start → delta → done', async () => {
  const plugin = fakePlugin();
  const api = createDeviceApi({ plugin, model: 'qwen3.5:2b' });
  const evs = [];
  await api.analyze({ text: '1+1' }, undefined, (e) => evs.push(e));
  assert.deepEqual(evs.map((e) => e.t), ['start', 'delta', 'delta', 'done']);
  assert.equal(evs.filter((e) => e.t === 'delta').map((e) => e.v).join(''), '{"a":1}');
  assert.equal(plugin.listenerCount, 0, '结束后要取消监听');
});

test('分析和修正带上 GBNF 语法约束，识别带上图片', async () => {
  const plugin = fakePlugin();
  const api = createDeviceApi({ plugin, model: 'm' });
  await api.analyze({ text: '题目' }, undefined, () => {});
  await api.repair({ text: '题目', commands: ['A = Foo()'], errors: [{ line: 0, src: 'A = Foo()', message: '未知命令' }] }, undefined, () => {});
  await api.recognize({ image: 'data:image/jpeg;base64,QUJD', hint: '' }, undefined, () => {});
  assert.match(plugin.calls[0].grammar, /^root ::= /);
  assert.match(plugin.calls[1].grammar, /commands/);
  assert.equal(plugin.calls[2].messages[1].image, 'QUJD');
  assert.equal(plugin.calls[2].grammar, undefined);
});

test('取消：通知插件停止，并抛出 AbortError', async () => {
  const plugin = fakePlugin({ tokens: ['a', 'b', 'c', 'd'], slow: 20 });
  const api = createDeviceApi({ plugin, model: 'm' });
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 30);
  await assert.rejects(api.solve({ text: 'x' }, ac.signal, () => {}), (e) => e.name === 'AbortError');
  assert.equal(plugin.cancelled.size, 1);
});

test('插件出错时给出可读的错误', async () => {
  const api = createDeviceApi({ plugin: fakePlugin({ fail: '内存不足，模型无法加载' }), model: 'm' });
  await assert.rejects(api.analyze({ text: 'x' }, undefined, () => {}), (e) => e.code === 'oom' && /内存不足/.test(e.message));
  const h = await createDeviceApi({ plugin: fakePlugin(), model: 'm' }).health();
  assert.equal(h.connected, true);
  assert.equal(h.local, true);
});
