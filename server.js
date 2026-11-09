// 数形 · 数学题可视化 —— 本地服务
// 静态页面 + 三个流式接口：/api/recognize（拍照识别）、/api/analyze（分析并作图）、/api/solve（解题思路）

import express from 'express';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, listModels, chatStream } from './src/llm.js';
import { OCR_SYSTEM, ocrUserText, ANALYZE_SYSTEM, ANALYSIS_SCHEMA, analyzeUserText, REPAIR_SCHEMA, repairUserText, SOLVE_SYSTEM, solveUserText } from './src/prompts.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(here, 'public')));
app.use('/vendor/katex', express.static(path.join(here, 'node_modules/katex/dist')));
app.use('/vendor/jsxgraph', express.static(path.join(here, 'node_modules/jsxgraph/distrib')));

const MODEL_RE = /^[\w.:/@-]{1,120}$/;
function pickModel(name, fallback) {
  return typeof name === 'string' && MODEL_RE.test(name) ? name : fallback;
}

// data:image/jpeg;base64,xxxx → xxxx
function imageBase64(image) {
  if (typeof image !== 'string' || !image) return null;
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(image);
  const b64 = m ? m[2] : /^[A-Za-z0-9+/=]+$/.test(image) ? image : null;
  if (!b64 || b64.length > 20 * 1024 * 1024) return null;
  return b64;
}

async function stream(res, params) {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`);
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
  }
  res.end();
}

app.get('/api/health', async (req, res) => {
  const info = await listModels();
  const names = info.models.map((m) => m.name);
  const preferred = [config.visionModel, config.textModel].filter(Boolean);
  const defaultModel = preferred.find((n) => names.includes(n)) || info.models.find((m) => m.vision)?.name || names[0] || config.visionModel;
  res.json({ provider: config.provider, ...info, defaultModel, configuredModel: config.visionModel });
});

app.post('/api/recognize', (req, res) => {
  const { image, hint, model } = req.body || {};
  const b64 = imageBase64(image);
  if (!b64) return res.status(400).json({ error: '没有收到有效的图片（支持 JPG / PNG / WebP，20MB 以内）' });
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
  const { text, image, hint, model } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: '题目内容为空' });
  const b64 = imageBase64(image);
  stream(res, {
    model: pickModel(model, config.textModel || config.visionModel),
    messages: [
      { role: 'system', content: ANALYZE_SYSTEM },
      { role: 'user', content: analyzeUserText(text.slice(0, 6000), typeof hint === 'string' ? hint.slice(0, 500) : '', !!b64), ...(b64 ? { images: [b64] } : {}) },
    ],
    format: ANALYSIS_SCHEMA,
    think: false,
    options: { temperature: 0.2, num_predict: 4096 },
  });
});

app.post('/api/repair', (req, res) => {
  const { text, commands, errors, model } = req.body || {};
  if (typeof text !== 'string' || !Array.isArray(commands) || !Array.isArray(errors)) return res.status(400).json({ error: '参数不完整' });
  const errs = errors.slice(0, 30).map((e) => ({ line: Number(e.line) || 0, src: String(e.src || '').slice(0, 300), message: String(e.message || '').slice(0, 200) }));
  stream(res, {
    model: pickModel(model, config.textModel || config.visionModel),
    messages: [
      { role: 'system', content: ANALYZE_SYSTEM },
      { role: 'user', content: repairUserText(text.slice(0, 6000), commands.slice(0, 120).map((c) => String(c).slice(0, 300)), errs) },
    ],
    format: REPAIR_SCHEMA,
    think: false,
    options: { temperature: 0.1, num_predict: 3072 },
  });
});

app.post('/api/solve', (req, res) => {
  const { text, commands, model } = req.body || {};
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: '题目内容为空' });
  stream(res, {
    model: pickModel(model, config.textModel || config.visionModel),
    messages: [
      { role: 'system', content: SOLVE_SYSTEM },
      { role: 'user', content: solveUserText(text.slice(0, 6000), Array.isArray(commands) ? commands.map(String) : []) },
    ],
    think: config.solveThink,
    options: { temperature: 0.3, num_predict: 8192 },
  });
});

app.listen(PORT, HOST, () => {
  console.log('\n  数形 · 数学题可视化 已启动');
  console.log(`  本机访问：http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') {
    const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
    if (lan) console.log(`  手机访问（同一 Wi-Fi）：http://${lan.address}:${PORT}`);
  }
  const target = config.provider === 'ollama' ? config.ollamaHost : config.openaiBase;
  console.log(`  本地模型：${config.provider} @ ${target}，默认模型 ${config.visionModel}\n`);
});
