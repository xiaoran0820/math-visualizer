// HTTP 接口：NDJSON 协议、参数校验、并发上限、错误事件、客户端断开（注入假的模型，不需要 Ollama）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { LlmError } from '../src/llm.js';

const fakeConfig = { provider: 'ollama', visionModel: 'fake-model', textModel: '', solveThink: false };

async function withServer(deps, fn) {
  const app = createApp({ config: fakeConfig, listModels: async () => ({ connected: true, models: [{ name: 'fake-model', vision: true }] }), ...deps });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(url);
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

const post = (url, body, signal) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
const events = async (res) => (await res.text()).trim().split('\n').map((l) => JSON.parse(l));

test('NDJSON：start → delta → done', async () => {
  async function* chatStream() {
    yield { type: 'content', text: '{"a":' };
    yield { type: 'content', text: '1}' };
    yield { type: 'done', stats: { outputTokens: 2 } };
  }
  await withServer({ chatStream }, async (url) => {
    const res = await post(`${url}/api/analyze`, { text: '1+1' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /ndjson/);
    const evs = await events(res);
    assert.deepEqual(evs.map((e) => e.t), ['start', 'delta', 'delta', 'done']);
    assert.equal(evs.filter((e) => e.t === 'delta').map((e) => e.v).join(''), '{"a":1}');
    assert.equal(evs[0].model, 'fake-model');
  });
});

test('参数校验：空题目、无效图片返回 400', async () => {
  await withServer({ chatStream: async function* () {} }, async (url) => {
    assert.equal((await post(`${url}/api/analyze`, { text: '  ' })).status, 400);
    assert.equal((await post(`${url}/api/recognize`, { image: 'data:image/png;base64,@@@' })).status, 400);
    assert.equal((await post(`${url}/api/repair`, { text: 'x' })).status, 400);
  });
});

test('并发上限：超出时返回 429 和中文说明，之前的请求结束后恢复', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  async function* chatStream() {
    await gate;
    yield { type: 'content', text: 'ok' };
  }
  await withServer({ chatStream, maxConcurrent: 2 }, async (url) => {
    const a = post(`${url}/api/analyze`, { text: 'a' });
    const b = post(`${url}/api/analyze`, { text: 'b' });
    await new Promise((r) => setTimeout(r, 50));
    const c = await post(`${url}/api/analyze`, { text: 'c' });
    assert.equal(c.status, 429);
    const body = await c.json();
    assert.equal(body.code, 'busy');
    assert.match(body.error, /最多同时 2 个/);
    release();
    await Promise.all([(await a).text(), (await b).text()]);
    const d = await post(`${url}/api/analyze`, { text: 'd' });
    assert.equal(d.status, 200);
    await d.text();
  });
});

test('模型异常转成带错误码的 error 事件', async () => {
  async function* chatStream() {
    yield { type: 'content', text: '部分' };
    throw new LlmError('本地模型输出中途停顿超过 60 秒，已中止。', 'timeout');
  }
  await withServer({ chatStream }, async (url) => {
    const evs = await events(await post(`${url}/api/solve`, { text: 'x' }));
    const err = evs.at(-1);
    assert.equal(err.t, 'error');
    assert.equal(err.code, 'timeout');
  });
});

test('客户端断开时，正在进行的模型调用会被中止并释放名额', async () => {
  let aborted = false;
  async function* chatStream({ signal }) {
    yield { type: 'content', text: '...' };
    await new Promise((resolve) => signal.addEventListener('abort', () => { aborted = true; resolve(); }, { once: true }));
  }
  await withServer({ chatStream, maxConcurrent: 1 }, async (url) => {
    const ac = new AbortController();
    const res = await post(`${url}/api/analyze`, { text: 'x' }, ac.signal);
    const reader = res.body.getReader();
    await reader.read();
    ac.abort();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(aborted, true);
    const again = await post(`${url}/api/analyze`, { text: 'y' }, AbortSignal.timeout(300)).catch(() => null);
    assert.ok(again && again.status === 200, '名额应已释放');
  });
});

test('health 返回接口版本、模型列表和是否本机', async () => {
  await withServer({ chatStream: async function* () {} }, async (url) => {
    const h = await (await fetch(`${url}/api/health`)).json();
    assert.equal(h.apiVersion, 1);
    assert.equal(h.connected, true);
    assert.equal(h.defaultModel, 'fake-model');
    assert.equal(typeof h.local, 'boolean');
  });
});

test('CORS：只允许明确列出的来源（打包成 App 时使用）', async () => {
  await withServer({ chatStream: async function* () {}, corsOrigins: 'capacitor://localhost, https://localhost' }, async (url) => {
    const ok = await fetch(`${url}/api/health`, { headers: { Origin: 'capacitor://localhost' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'capacitor://localhost');
    const pre = await fetch(`${url}/api/analyze`, { method: 'OPTIONS', headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(pre.status, 204);
    const other = await fetch(`${url}/api/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
  await withServer({ chatStream: async function* () {} }, async (url) => {
    const res = await fetch(`${url}/api/health`, { headers: { Origin: 'capacitor://localhost' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null, '默认不开放跨域');
  });
});

test('重新生成用的温度、修正时附带的“不符合题目的条件”会传给模型', async () => {
  const seen = [];
  async function* chatStream(params) {
    seen.push(params);
    yield { type: 'content', text: '{"commands":[]}' };
    yield { type: 'done', stats: {} };
  }
  await withServer({ chatStream }, async (url) => {
    await events(await post(`${url}/api/analyze`, { text: '1+1', temperature: 0.7 }));
    await events(await post(`${url}/api/analyze`, { text: '1+1', temperature: 9 }));
    await events(await post(`${url}/api/analyze`, { text: '1+1' }));
    assert.deepEqual(seen.map((p) => p.options.temperature), [0.7, 1.2, 0.2]);
    await events(await post(`${url}/api/repair`, { text: '题', commands: ['A = (0, 0)'], errors: [], issues: ['AB = 5（图中 AB = 4.2）'] }));
    const user = seen[3].messages.find((m) => m.role === 'user').content;
    assert.match(user, /不符合题目中的这些条件：\n- AB = 5（图中 AB = 4\.2）/);
    assert.doesNotMatch(user, /其中这些命令有错误/);
  });
});
