// 本地模型客户端：超时与异常（用一个假的 Ollama 服务模拟各种情况）
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chatStream, config, LlmError, isLocalEndpoint } from '../src/llm.js';

let server, base;
const timers = new Set();
const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { model } = JSON.parse(body || '{}');
      const line = (o) => res.write(`${JSON.stringify(o)}\n`);
      if (model === 'missing') { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"model \\"missing\\" not found"}'); return; }
      if (model === 'hang') return; // 永远不响应
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      if (model === 'ok') {
        line({ message: { content: 'Hel' } });
        later(() => { line({ message: { content: 'lo' } }); line({ done: true, eval_count: 2, eval_duration: 1e9 }); res.end(); }, 20);
      } else if (model === 'stall') {
        line({ message: { content: '开始' } }); // 之后不再输出
      } else if (model === 'drip') {
        const tick = () => { if (!res.writableEnded && !res.destroyed) { line({ message: { content: '.' } }); later(tick, 30); } };
        tick();
      }
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  config.provider = 'ollama';
  config.ollamaHost = base;
});

after(() => {
  timers.forEach(clearTimeout);
  server.closeAllConnections?.();
  server.close();
});

const fast = { firstByteMs: 200, idleMs: 200, totalMs: 1500 };
async function collect(params) {
  const out = [];
  for await (const ev of chatStream({ messages: [{ role: 'user', content: 'hi' }], timeouts: fast, ...params })) out.push(ev);
  return out;
}

test('正常流式输出', async () => {
  const evs = await collect({ model: 'ok' });
  assert.equal(evs.filter((e) => e.type === 'content').map((e) => e.text).join(''), 'Hello');
  assert.equal(evs.at(-1).type, 'done');
});

test('模型迟迟不开始响应：首包超时', async () => {
  const t0 = Date.now();
  await assert.rejects(collect({ model: 'hang' }), (e) => e instanceof LlmError && e.code === 'timeout' && /没有开始响应/.test(e.message));
  assert.ok(Date.now() - t0 < 1000);
});

test('输出中途停顿：空闲超时', async () => {
  await assert.rejects(collect({ model: 'stall' }), (e) => e.code === 'timeout' && /停顿/.test(e.message));
});

test('一直在输出但总时间太长：总超时', async () => {
  await assert.rejects(collect({ model: 'drip', timeouts: { firstByteMs: 200, idleMs: 200, totalMs: 400 } }), (e) => e.code === 'timeout' && /超过/.test(e.message));
});

test('模型不存在：提示下载命令', async () => {
  await assert.rejects(collect({ model: 'missing' }), (e) => e.code === 'model_missing' && /ollama pull missing/.test(e.message));
});

test('服务没启动：提示连接失败', async () => {
  const saved = config.ollamaHost;
  config.ollamaHost = 'http://127.0.0.1:9'; // 没有服务的端口
  try {
    await assert.rejects(collect({ model: 'ok' }), (e) => e.code === 'unreachable');
  } finally {
    config.ollamaHost = saved;
  }
});

test('外部取消不会被误报成超时', async () => {
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 50);
  await assert.rejects(collect({ model: 'stall', signal: ac.signal, timeouts: { firstByteMs: 5000, idleMs: 5000, totalMs: 5000 } }), (e) => !(e instanceof LlmError));
});

test('判断模型服务是否在本机', () => {
  assert.equal(isLocalEndpoint('http://127.0.0.1:11434'), true);
  assert.equal(isLocalEndpoint('http://localhost:1234/v1'), true);
  assert.equal(isLocalEndpoint('http://[::1]:11434'), true);
  assert.equal(isLocalEndpoint('http://192.168.1.20:11434'), false);
  assert.equal(isLocalEndpoint('https://example.com/v1'), false);
});
