// 与服务端通信的唯一入口。
// 网页版：页面和接口同源，baseUrl 留空即可。
// 移动端（把 public/ 打包进 App，例如 Capacitor）：页面来自 App 本身，baseUrl 要指向运行服务的电脑，
// 例如 http://192.168.1.5:3000，服务端还需要用 CORS_ORIGINS 允许 App 的来源。
// 接口协议见 docs/api.md。

export const API_VERSION = 1;

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export function normalizeBaseUrl(s) {
  const v = String(s || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `http://${v}`;
}

export function createApi({ baseUrl = '' } = {}) {
  const base = normalizeBaseUrl(baseUrl);
  const url = (p) => `${base}${p}`;
  const offline = () => new ApiError(base
    ? `无法连接到服务 ${base}。请确认电脑上的服务正在运行（npm run lan），手机和电脑在同一个 Wi-Fi，地址和端口正确。`
    : '无法连接到本项目的服务端，请确认 npm start 正在运行。', 'server_unreachable');

  // 流式 POST：服务端返回 NDJSON，每行一个事件；error 事件在读完后以异常抛出
  async function streamPost(path, body, signal, onEvent) {
    let res;
    try {
      res = await fetch(url(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw offline();
    }
    if (!res.ok) {
      let msg = `请求失败（${res.status}）`, code;
      try { const j = await res.json(); msg = j.error || msg; code = j.code; } catch { /* 忽略 */ }
      throw new ApiError(msg, code);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', err = null;
    const handle = (line) => {
      if (!line.trim()) return;
      let ev;
      try { ev = JSON.parse(line); } catch { return; }
      if (ev.t === 'error') err = ev;
      else onEvent(ev);
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
    }
    handle(buf);
    if (err) throw new ApiError(err.message, err.code);
  }

  return {
    baseUrl: base,
    async health(signal) {
      let res;
      try {
        res = await fetch(url('/api/health'), { signal: signal || AbortSignal.timeout(6000) });
      } catch {
        throw offline();
      }
      if (!res.ok) throw new ApiError(`服务返回错误（${res.status}）`, 'server_error');
      const h = await res.json();
      if (h.apiVersion && h.apiVersion > API_VERSION) h.warning = '服务端版本比当前页面新，请刷新页面或更新 App。';
      return h;
    },
    recognize: (body, signal, onEvent) => streamPost('/api/recognize', body, signal, onEvent),
    analyze: (body, signal, onEvent) => streamPost('/api/analyze', body, signal, onEvent),
    repair: (body, signal, onEvent) => streamPost('/api/repair', body, signal, onEvent),
    solve: (body, signal, onEvent) => streamPost('/api/solve', body, signal, onEvent),
  };
}
