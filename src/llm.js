// 本地模型客户端。默认使用 Ollama；也兼容 LM Studio、llama.cpp server、vLLM 等 OpenAI 格式的本地服务。
// 所有请求都只发往本机（或你在 .env 里配置的地址），不会调用任何云端 API。

const withScheme = (u) => (/^https?:\/\//.test(u) ? u : `http://${u}`).replace(/\/+$/, '');

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
};

export class LlmError extends Error {
  constructor(message, code = 'llm_error') {
    super(message);
    this.code = code;
  }
}

function unreachable() {
  return config.provider === 'ollama'
    ? new LlmError(`无法连接本地模型服务 Ollama（${config.ollamaHost}）。请先打开 Ollama 应用，或在终端运行 ollama serve。`, 'unreachable')
    : new LlmError(`无法连接本地模型服务（${config.openaiBase}）。请确认 LM Studio / llama.cpp 等服务已经启动。`, 'unreachable');
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
    try { msg = JSON.parse(text).error?.message || JSON.parse(text).error || text; } catch { /* 原样使用 */ }
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

async function* lines(res) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
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
async function* ollamaChat({ model, messages, format, think, options, signal }) {
  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content, ...(m.images?.length ? { images: m.images } : {}) })),
    stream: true,
    keep_alive: config.keepAlive,
    options: { num_ctx: config.numCtx, ...options },
  };
  if (format) body.format = format;
  if (think !== undefined) body.think = think;
  const res = await post(`${config.ollamaHost}/api/chat`, body, signal);
  for await (const line of lines(res)) {
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
async function* openaiChat({ model, messages, format, options, signal }) {
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
    res = await post(`${config.openaiBase}/chat/completions`, body, signal);
  } catch (e) {
    // 有些本地服务不支持 json_schema，退回到只靠提示词约束格式
    if (format && e instanceof LlmError && e.code === 'llm_error') {
      delete body.response_format;
      res = await post(`${config.openaiBase}/chat/completions`, body, signal);
    } else throw e;
  }
  const t0 = Date.now();
  let outputTokens = 0;
  for await (const line of lines(res)) {
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

export async function* chatStream(params) {
  if (config.provider !== 'ollama') { yield* openaiChat(params); return; }
  try {
    yield* ollamaChat(params);
  } catch (e) {
    // 模型不支持“思考”开关时，去掉该参数重试一次
    if (e instanceof LlmError && e.code === 'no_thinking' && params.think !== undefined) {
      yield* ollamaChat({ ...params, think: undefined });
    } else throw e;
  }
}

// ---------------- 列出本地模型 ----------------
let cache = { at: 0, data: null };
export async function listModels() {
  if (cache.data && Date.now() - cache.at < 15000) return cache.data;
  let data;
  try {
    if (config.provider === 'ollama') {
      const [ver, tags] = await Promise.all([
        fetch(`${config.ollamaHost}/api/version`).then((r) => r.json()),
        fetch(`${config.ollamaHost}/api/tags`).then((r) => r.json()),
      ]);
      const models = await Promise.all((tags.models || []).map(async (m) => {
        let caps = [];
        try {
          const show = await fetch(`${config.ollamaHost}/api/show`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m.name }) }).then((r) => r.json());
          caps = show.capabilities || [];
        } catch { /* 忽略 */ }
        return { name: m.name, size: m.size, vision: caps.includes('vision'), thinking: caps.includes('thinking'), embedding: caps.includes('embedding') && !caps.includes('completion') };
      }));
      data = { connected: true, version: ver.version, models: models.filter((m) => !m.embedding) };
    } else {
      const res = await fetch(`${config.openaiBase}/models`, { headers: config.openaiKey ? { Authorization: `Bearer ${config.openaiKey}` } : {} }).then((r) => r.json());
      data = { connected: true, models: (res.data || []).map((m) => ({ name: m.id, vision: true })) };
    }
  } catch {
    data = { connected: false, models: [], error: unreachable().message };
  }
  cache = { at: Date.now(), data };
  return data;
}
