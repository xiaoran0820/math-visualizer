// 本地模型客户端。默认使用 Ollama；也兼容 LM Studio、llama.cpp server、vLLM 等 OpenAI 格式的本地服务。
// 请求只发往 .env 里配置的地址（默认是本机）。若把地址改成其他机器，图片和题目会发送到那台机器。

const withScheme = (u) => (/^https?:\/\//.test(u) ? u : `http://${u}`).replace(/\/+$/, '');
const seconds = (v, d) => (Number(v) > 0 ? Number(v) : d) * 1000;

export const config = {
  provider: (process.env.LLM_PROVIDER || 'ollama').toLowerCase(),
  ollamaHost: withScheme(process.env.OLLAMA_HOST || '127.0.0.1:11434'),
  openaiBase: withScheme(process.env.OPENAI_BASE_URL || 'http://127.0.0.1:1234/v1'),
  openaiKey: process.env.OPENAI_API_KEY || '',
  visionModel: process.env.VISION_MODEL || 'qwen3.5:4b-q4_K_M',
  textModel: process.env.TEXT_MODEL || '',
  numCtx: Number(process.env.NUM_CTX) || 16384,
  solveThink: (process.env.SOLVE_THINK || 'true') !== 'false',
  keepAlive: process.env.KEEP_ALIVE || '30m',
  // 超时（秒）：等待模型开始输出（包括第一次把模型加载进内存）、输出中途停顿、整次调用总时长
  timeouts: {
    firstByteMs: seconds(process.env.LLM_FIRST_BYTE_TIMEOUT, 180),
    idleMs: seconds(process.env.LLM_IDLE_TIMEOUT, 60),
    totalMs: seconds(process.env.LLM_TIMEOUT, 300),
  },
};

export class LlmError extends Error {
  constructor(message, code = 'llm_error') {
    super(message);
    this.code = code;
  }
}

export function endpoint() {
  return config.provider === 'ollama' ? config.ollamaHost : config.openaiBase;
}

// 模型服务是否在本机（用于界面上的隐私说明）
export function isLocalEndpoint(url = endpoint()) {
  try {
    const h = new URL(url).hostname.replace(/^\[|\]$/g, '');
    return h === 'localhost' || h === '::1' || /^127\./.test(h) || h.endsWith('.localhost');
  } catch {
    return false;
  }
}

function unreachable() {
  return config.provider === 'ollama'
    ? new LlmError(`无法连接本地模型服务 Ollama（${config.ollamaHost}）。请先打开 Ollama 应用，或在终端运行 ollama serve。`, 'unreachable')
    : new LlmError(`无法连接本地模型服务（${config.openaiBase}）。请确认 LM Studio / llama.cpp 等服务已经启动。`, 'unreachable');
}

// 把“外部取消”和三种超时合成一个 AbortSignal，并记录是哪一种原因
function deadline(external, t) {
  const ac = new AbortController();
  let reason = null;
  const fire = (r) => { if (!ac.signal.aborted) { reason = r; ac.abort(); } };
  const onExternal = () => fire('client');
  if (external) {
    if (external.aborted) fire('client');
    else external.addEventListener('abort', onExternal, { once: true });
  }
  const total = setTimeout(() => fire('total'), t.totalMs);
  let phase = setTimeout(() => fire('first'), t.firstByteMs);
  return {
    signal: ac.signal,
    get reason() { return reason; },
    // 收到数据：重新开始“空闲”计时
    alive() { clearTimeout(phase); phase = setTimeout(() => fire('idle'), t.idleMs); },
    done() { clearTimeout(total); clearTimeout(phase); external?.removeEventListener('abort', onExternal); },
  };
}

function timeoutError(reason, t) {
  const s = (ms) => Math.round(ms / 1000);
  if (reason === 'first') return new LlmError(`本地模型在 ${s(t.firstByteMs)} 秒内没有开始响应（可能正在加载模型或电脑负载过高），请稍后重试。`, 'timeout');
  if (reason === 'idle') return new LlmError(`本地模型输出中途停顿超过 ${s(t.idleMs)} 秒，已中止。`, 'timeout');
  return new LlmError(`本次请求超过 ${s(t.totalMs)} 秒仍未完成，已中止。可以换一个更快的模型，或调大 LLM_TIMEOUT。`, 'timeout');
}

async function post(url, body, signal) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.openaiKey && config.provider !== 'ollama' ? { Authorization: `Bearer ${config.openaiKey}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw unreachable();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { const j = JSON.parse(text); msg = j.error?.message || j.error || text; } catch { /* 原样使用 */ }
    msg = String(msg);
    if (res.status === 404 || /not found/i.test(msg)) {
      throw new LlmError(`本地没有找到模型「${body.model}」。请先下载：ollama pull ${body.model}`, 'model_missing');
    }
    if (/does not support thinking/i.test(msg)) throw new LlmError(msg, 'no_thinking');
    if (/image|vision|multimodal/i.test(msg)) throw new LlmError(`模型「${body.model}」不支持识别图片，请换用支持视觉的模型（例如 qwen3.5:4b）。`, 'no_vision');
    throw new LlmError(`本地模型返回错误（${res.status}）：${msg.slice(0, 300)}`);
  }
  return res;
}

async function* lines(res, onChunk) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    onChunk();
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) yield line;
    }
  }
  if (buf.trim()) yield buf.trim();
}

// ---------------- Ollama ----------------
async function* ollamaChat({ model, messages, format, think, options, dl }) {
  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content, ...(m.images?.length ? { images: m.images } : {}) })),
    stream: true,
    keep_alive: config.keepAlive,
    options: { num_ctx: config.numCtx, ...options },
  };
  if (format) body.format = format;
  if (think !== undefined) body.think = think;
  const res = await post(`${config.ollamaHost}/api/chat`, body, dl.signal);
  dl.alive();
  for await (const line of lines(res, () => dl.alive())) {
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    if (d.error) throw new LlmError(`本地模型出错：${d.error}`);
    if (d.message?.thinking) yield { type: 'thinking', text: d.message.thinking };
    if (d.message?.content) yield { type: 'content', text: d.message.content };
    if (d.done) {
      yield {
        type: 'done',
        stats: {
          promptTokens: d.prompt_eval_count, outputTokens: d.eval_count,
          seconds: d.total_duration ? d.total_duration / 1e9 : undefined,
          tokensPerSecond: d.eval_duration ? d.eval_count / (d.eval_duration / 1e9) : undefined,
          stop: d.done_reason,
        },
      };
    }
  }
}

// ---------------- OpenAI 兼容（LM Studio / llama.cpp / vLLM） ----------------
async function* openaiChat({ model, messages, format, options, dl }) {
  const body = {
    model,
    stream: true,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.num_predict ?? 4096,
    messages: messages.map((m) => (m.images?.length
      ? { role: m.role, content: [{ type: 'text', text: m.content }, ...m.images.map((b64) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } }))] }
      : { role: m.role, content: m.content })),
  };
  if (format) body.response_format = { type: 'json_schema', json_schema: { name: 'analysis', strict: true, schema: format } };
  let res;
  try {
    res = await post(`${config.openaiBase}/chat/completions`, body, dl.signal);
  } catch (e) {
    // 有些本地服务不支持 json_schema，退回到只靠提示词约束格式
    if (format && e instanceof LlmError && e.code === 'llm_error') {
      delete body.response_format;
      res = await post(`${config.openaiBase}/chat/completions`, body, dl.signal);
    } else throw e;
  }
  dl.alive();
  const t0 = Date.now();
  let outputTokens = 0;
  for await (const line of lines(res, () => dl.alive())) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    let d;
    try { d = JSON.parse(data); } catch { continue; }
    const delta = d.choices?.[0]?.delta || {};
    const think = delta.reasoning_content || delta.reasoning;
    if (think) yield { type: 'thinking', text: think };
    if (delta.content) { outputTokens++; yield { type: 'content', text: delta.content }; }
  }
  yield { type: 'done', stats: { outputTokens, seconds: (Date.now() - t0) / 1000 } };
}

/**
 * 流式调用本地模型，产出 {type:'content'|'thinking'|'done'} 事件。
 * params.signal 用于外部取消；params.timeouts 可以覆盖默认超时（单位毫秒）。
 */
export async function* chatStream(params) {
  const t = { ...config.timeouts, ...(params.timeouts || {}) };
  const run = (p) => (config.provider === 'ollama' ? ollamaChat(p) : openaiChat(p));
  let dl = deadline(params.signal, t);
  try {
    try {
      yield* run({ ...params, dl });
    } catch (e) {
      // 模型不支持“思考”开关时，去掉该参数重试一次
      if (e instanceof LlmError && e.code === 'no_thinking' && params.think !== undefined && config.provider === 'ollama') {
        dl.done();
        dl = deadline(params.signal, t);
        yield* run({ ...params, think: undefined, dl });
      } else throw e;
    }
  } catch (e) {
    if (dl.reason && dl.reason !== 'client') throw timeoutError(dl.reason, t);
    throw e;
  } finally {
    dl.done();
  }
}

// ---------------- 列出本地模型 ----------------
let cache = { at: 0, data: null };
export async function listModels() {
  if (cache.data && Date.now() - cache.at < 15000) return cache.data;
  const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(4000) }).then((r) => r.json());
  let data;
  try {
    if (config.provider === 'ollama') {
      const [ver, tags] = await Promise.all([get(`${config.ollamaHost}/api/version`), get(`${config.ollamaHost}/api/tags`)]);
      const models = await Promise.all((tags.models || []).map(async (m) => {
        let caps = [];
        try {
          const show = await get(`${config.ollamaHost}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m.name }) });
          caps = show.capabilities || [];
        } catch { /* 忽略 */ }
        return { name: m.name, size: m.size, vision: caps.includes('vision'), thinking: caps.includes('thinking'), embedding: caps.includes('embedding') && !caps.includes('completion') };
      }));
      data = { connected: true, version: ver.version, models: models.filter((m) => !m.embedding) };
    } else {
      const res = await get(`${config.openaiBase}/models`, { headers: config.openaiKey ? { Authorization: `Bearer ${config.openaiKey}` } : {} });
      data = { connected: true, models: (res.data || []).map((m) => ({ name: m.id, vision: true })) };
    }
  } catch {
    data = { connected: false, models: [], error: unreachable().message };
  }
  cache = { at: Date.now(), data };
  return data;
}

export function clearModelCache() {
  cache = { at: 0, data: null };
}
