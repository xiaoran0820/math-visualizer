// 手机本地模型客户端：接口与 api.js（连接电脑上的服务）完全相同——health / recognize / analyze / repair / solve，
// 事件格式也相同（start / delta / think / done），所以界面、作图引擎和自动修正的判定都不需要区分“在哪里推理”。
//
// 底层是一个“本机模型插件”，需要提供：
//   status()                         → { ready, model, models, error }
//   generate({ requestId, model, messages, grammar, schema, maxTokens, temperature, think }) → { stats }
//   cancel({ requestId })
//   addListener('token', ({ requestId, text, thinking }) => …) → { remove() }
// iOS 上由 Swift 插件实现（llama.cpp + Metal，用 grammar 约束输出格式）；
// 在电脑浏览器里调试时，可以用下面的 createOllamaDevicePlugin 代替（用 schema 约束）。
import {
  OCR_SYSTEM, ocrUserText, analyzeSystemFor, ANALYSIS_SCHEMA, analyzeUserText,
  REPAIR_SCHEMA, repairUserText, SOLVE_SYSTEM, solveUserText,
} from './prompts.js';
import { schemaToGbnf } from './gbnf.js';
import { ApiError } from './api.js';

const GRAMMARS = { analysis: schemaToGbnf(ANALYSIS_SCHEMA), repair: schemaToGbnf(REPAIR_SCHEMA) };
const stripDataUrl = (s) => (s ? String(s).replace(/^data:image\/[\w+.-]+;base64,/, '') : undefined);

export function createDeviceApi({ plugin, model }) {
  let seq = 0;

  async function run(params, signal, onEvent, m = model) {
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
    const requestId = `r${Date.now().toString(36)}-${++seq}`;
    const sub = await plugin.addListener('token', (e) => {
      if (e.requestId === requestId && !signal?.aborted) onEvent({ t: e.thinking ? 'think' : 'delta', v: e.text });
    });
    const onAbort = () => { plugin.cancel({ requestId }).catch(() => {}); };
    signal?.addEventListener('abort', onAbort, { once: true });
    onEvent({ t: 'start', model: m });
    try {
      const res = await plugin.generate({ requestId, model: m, ...params });
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
      onEvent({ t: 'done', stats: res?.stats || {} });
    } catch (e) {
      if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
      throw e instanceof ApiError ? e : new ApiError(e?.message || String(e), e?.code || 'device_error');
    } finally {
      signal?.removeEventListener('abort', onAbort);
      sub.remove();
    }
  }

  return {
    baseUrl: '',
    kind: 'device',
    async health() {
      let st;
      try { st = await plugin.status(); } catch (e) { st = { ready: false, error: e.message }; }
      return {
        apiVersion: 1, provider: 'device', connected: !!st.ready,
        models: (st.models || [st.model || model]).filter(Boolean).map((name) => ({ name, vision: true })),
        defaultModel: st.model || model, configuredModel: model,
        local: true, endpointHost: '本机', error: st.ready ? undefined : st.error || '本机模型还没有准备好',
      };
    },
    recognize: ({ image, hint, model: m }, signal, onEvent) => run({
      messages: [{ role: 'system', content: OCR_SYSTEM }, { role: 'user', content: ocrUserText(hint), image: stripDataUrl(image) }],
      maxTokens: 2048, temperature: 0.1,
    }, signal, onEvent, m || model),
    analyze: ({ text, image, hint, model: m, temperature }, signal, onEvent) => run({
      messages: [{ role: 'system', content: analyzeSystemFor(m || model) }, { role: 'user', content: analyzeUserText(text, hint, !!image), image: stripDataUrl(image) }],
      schema: ANALYSIS_SCHEMA, grammar: GRAMMARS.analysis, maxTokens: 4096, temperature: Number.isFinite(temperature) ? temperature : 0.2,
    }, signal, onEvent, m || model),
    repair: ({ text, commands, errors, issues, model: m }, signal, onEvent) => run({
      messages: [{ role: 'system', content: analyzeSystemFor(m || model) }, { role: 'user', content: repairUserText(text, commands, errors, issues || []) }],
      schema: REPAIR_SCHEMA, grammar: GRAMMARS.repair, maxTokens: 3072, temperature: 0.1,
    }, signal, onEvent, m || model),
    // 手机上默认不“思考”：小模型思考时容易反复说同一句话、迟迟不给解答，而且慢很多（实测 2B 直接作答也能答对）。
    // 打开思考时（think: true）用 Qwen 建议的思考参数，并限制思考长度，超过或原地打转就让模型直接作答。
    solve: ({ text, commands, model: m, think = false }, signal, onEvent) => run({
      messages: [{ role: 'system', content: SOLVE_SYSTEM }, { role: 'user', content: solveUserText(text, commands) }],
      maxTokens: think ? 6144 : 3072, temperature: think ? 0.6 : 0.3, think,
      ...(think ? { presencePenalty: 1.5, thinkBudget: 2048 } : {}),
    }, signal, onEvent, m || model),
  };
}

// ---------------- 调试用替身：在电脑浏览器里用 Ollama 扮演“本机模型插件” ----------------
// 页面地址加上 ?engine=device 即可使用（需要 Ollama 允许该页面的来源，localhost 默认允许）。
export function createOllamaDevicePlugin({ host = 'http://127.0.0.1:11434', model } = {}) {
  const listeners = new Set();
  const running = new Map();
  const emit = (e) => listeners.forEach((fn) => fn(e));
  return {
    async status() {
      const tags = await fetch(`${host}/api/tags`).then((r) => r.json());
      const models = (tags.models || []).map((m) => m.name);
      return { ready: models.length > 0, model: model && models.includes(model) ? model : models[0], models, error: models.length ? undefined : 'Ollama 里还没有模型' };
    },
    async generate({ requestId, model: m, messages, schema, maxTokens, temperature, think }) {
      const ac = new AbortController();
      running.set(requestId, ac);
      try {
        const res = await fetch(`${host}/api/chat`, {
          method: 'POST',
          signal: ac.signal,
          body: JSON.stringify({
            model: m, stream: true, think: !!think, format: schema,
            options: { temperature, num_predict: maxTokens, num_ctx: 16384 },
            messages: messages.map((x) => ({ role: x.role, content: x.content, ...(x.image ? { images: [x.image] } : {}) })),
          }),
        });
        if (!res.ok) throw new Error(`本机模型出错（${res.status}）`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '', stats = {};
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            const d = JSON.parse(line);
            if (d.error) throw new Error(d.error);
            if (d.message?.thinking) emit({ requestId, text: d.message.thinking, thinking: true });
            if (d.message?.content) emit({ requestId, text: d.message.content });
            if (d.done) stats = { outputTokens: d.eval_count, tokensPerSecond: d.eval_duration ? d.eval_count / (d.eval_duration / 1e9) : undefined };
          }
        }
        return { stats };
      } finally {
        running.delete(requestId);
      }
    },
    async cancel({ requestId }) {
      running.get(requestId)?.abort();
    },
    async addListener(event, fn) {
      if (event === 'token') listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
  };
}
