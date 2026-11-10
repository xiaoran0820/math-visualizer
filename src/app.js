// HTTP 接口：静态页面 + 流式模型接口。单独成模块是为了能在测试里注入假的模型。
//
// 流式接口返回 NDJSON（每行一个 JSON 事件）：
//   {"t":"start","model":"..."}           开始
//   {"t":"delta","v":"..."}               模型输出的正文片段
//   {"t":"think","v":"..."}               思考过程片段（解题思路才有）
//   {"t":"done","stats":{...}}            结束
//   {"t":"error","message":"...","code":"timeout|unreachable|model_missing|..."}

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as llm from './llm.js';
import { OCR_SYSTEM, ocrUserText, analyzeSystemFor, ANALYSIS_SCHEMA, analyzeUserText, REPAIR_SCHEMA, repairUserText, SOLVE_SYSTEM, solveUserText } from './prompts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const API_VERSION = 1;

const MODEL_RE = /^[\w.:/@-]{1,120}$/;

// data:image/jpeg;base64,xxxx → xxxx
function imageBase64(image) {
  if (typeof image !== 'string' || !image) return null;
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  const b64 = m ? m[2] : /^[A-Za-z0-9+/=]+$/.test(image) ? image : null;
  if (!b64 || b64.length > 20 * 1024 * 1024) return null;
  return b64;
}

/**
 * @param {object} deps 可替换的依赖（测试用）：chatStream、listModels、config、maxConcurrent、solveTimeoutMs、corsOrigins
 */
export function createApp(deps = {}) {
  const chatStream = deps.chatStream || llm.chatStream;
  const listModels = deps.listModels || llm.listModels;
  const config = deps.config || llm.config;
  const maxConcurrent = deps.maxConcurrent ?? (Number(process.env.MAX_CONCURRENT) || 2);
  const solveTimeoutMs = deps.solveTimeoutMs ?? (Number(process.env.SOLVE_TIMEOUT) || 600) * 1000;

  const pickModel = (name, fallback) => (typeof name === 'string' && MODEL_RE.test(name) ? name : fallback);
  // 允许跨域访问的来源（打包成手机 App 时需要），默认不开放。例：CORS_ORIGINS=capacitor://localhost,https://localhost
  const corsOrigins = (deps.corsOrigins ?? process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  let active = 0;

  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && corsOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
      if (req.method === 'OPTIONS') return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json({ limit: '25mb' }));
  app.use(express.static(path.join(root, 'public')));
  app.use('/vendor/katex', express.static(path.join(root, 'node_modules/katex/dist')));
  app.use('/vendor/jsxgraph', express.static(path.join(root, 'node_modules/jsxgraph/distrib')));

  // 统一的流式转发：限制并发、客户端断开时中止模型、把异常转成 error 事件
  async function stream(res, params) {
    if (active >= maxConcurrent) {
      res.status(429).json({ error: `本地模型正在处理其他请求（最多同时 ${maxConcurrent} 个），请稍后再试。`, code: 'busy' });
      return;
    }
    active++;
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const send = (obj) => { if (!res.writableEnded) res.write(`${JSON.stringify(obj)}\n`); };
    const ac = new AbortController();
    res.on('close', () => ac.abort());
    const t0 = Date.now();
    try {
      send({ t: 'start', model: params.model });
      for await (const ev of chatStream({ ...params, signal: ac.signal })) {
        if (ev.type === 'content') send({ t: 'delta', v: ev.text });
        else if (ev.type === 'thinking') send({ t: 'think', v: ev.text });
        else if (ev.type === 'done') send({ t: 'done', stats: { ...ev.stats, wallSeconds: (Date.now() - t0) / 1000 } });
      }
    } catch (e) {
      if (!ac.signal.aborted) send({ t: 'error', message: e.message || String(e), code: e.code || 'error' });
    } finally {
      active--;
      res.end();
    }
  }

  app.get('/api/health', async (req, res) => {
    const info = await listModels();
    const names = info.models.map((m) => m.name);
    const preferred = [config.visionModel, config.textModel].filter(Boolean);
    const defaultModel = preferred.find((n) => names.includes(n)) || info.models.find((m) => m.vision)?.name || names[0] || config.visionModel;
    let endpointHost = '';
    try { endpointHost = new URL(llm.endpoint()).host; } catch { /* 忽略 */ }
    res.json({
      apiVersion: API_VERSION,
      provider: config.provider,
      ...info,
      defaultModel,
      configuredModel: config.visionModel,
      local: llm.isLocalEndpoint(),
      endpointHost,
      busy: active >= maxConcurrent,
    });
  });

  app.post('/api/recognize', (req, res) => {
    const { image, hint, model } = req.body || {};
    const b64 = imageBase64(image);
    if (!b64) return res.status(400).json({ error: '没有收到有效的图片（支持 JPG / PNG / WebP，20MB 以内）', code: 'bad_request' });
    stream(res, {
      model: pickModel(model, config.visionModel),
      messages: [
        { role: 'system', content: OCR_SYSTEM },
        { role: 'user', content: ocrUserText(typeof hint === 'string' ? hint.slice(0, 500) : ''), images: [b64] },
      ],
      think: false,
      options: { temperature: 0.1, num_predict: 2048 },
    });
  });

  app.post('/api/analyze', (req, res) => {
    const { text, image, hint, model, temperature } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: '题目内容为空', code: 'bad_request' });
    const b64 = imageBase64(image);
    // 重新生成时用稍高的温度，让模型换个思路；限制在 0～1.2
    const temp = Number.isFinite(temperature) ? Math.min(1.2, Math.max(0, temperature)) : 0.2;
    const m = pickModel(model, config.textModel || config.visionModel);
    stream(res, {
      model: m,
      messages: [
        { role: 'system', content: analyzeSystemFor(m) },
        { role: 'user', content: analyzeUserText(text.slice(0, 6000), typeof hint === 'string' ? hint.slice(0, 500) : '', !!b64), ...(b64 ? { images: [b64] } : {}) },
      ],
      format: ANALYSIS_SCHEMA,
      think: false,
      options: { temperature: temp, num_predict: 4096 },
    });
  });

  app.post('/api/repair', (req, res) => {
    const { text, commands, errors, issues, model } = req.body || {};
    if (typeof text !== 'string' || !Array.isArray(commands) || !Array.isArray(errors)) return res.status(400).json({ error: '参数不完整', code: 'bad_request' });
    const errs = errors.slice(0, 30).map((e) => ({ line: Number(e?.line) || 0, src: String(e?.src || '').slice(0, 300), message: String(e?.message || '').slice(0, 200) }));
    const iss = Array.isArray(issues) ? issues.slice(0, 20).map((x) => String(x).slice(0, 200)) : [];
    const m = pickModel(model, config.textModel || config.visionModel);
    stream(res, {
      model: m,
      messages: [
        { role: 'system', content: analyzeSystemFor(m) },
        { role: 'user', content: repairUserText(text.slice(0, 6000), commands.slice(0, 120).map((c) => String(c).slice(0, 300)), errs, iss) },
      ],
      format: REPAIR_SCHEMA,
      think: false,
      options: { temperature: 0.1, num_predict: 3072 },
    });
  });

  app.post('/api/solve', (req, res) => {
    const { text, commands, model } = req.body || {};
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: '题目内容为空', code: 'bad_request' });
    stream(res, {
      model: pickModel(model, config.textModel || config.visionModel),
      messages: [
        { role: 'system', content: SOLVE_SYSTEM },
        { role: 'user', content: solveUserText(text.slice(0, 6000), Array.isArray(commands) ? commands.slice(0, 120).map(String) : []) },
      ],
      think: config.solveThink,
      options: { temperature: 0.3, num_predict: 8192 },
      timeouts: { totalMs: solveTimeoutMs }, // 解题会先“思考”，允许更长时间
    });
  });

  return app;
}
