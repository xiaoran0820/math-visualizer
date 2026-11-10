import { buildScene } from './lib/scene.js';
import { render2d } from './lib/render2d.js';
import { render3d } from './lib/render3d.js';
import { renderMarkdown, renderInline, esc } from './lib/markdown.js';
import { parsePartialJSON, PARTIAL } from './lib/partial-json.js';
import { ImageEditor } from './lib/image.js';
import { RunController } from './lib/runs.js';
import { createApi, normalizeBaseUrl } from './lib/api.js';
import { createDeviceApi, createOllamaDevicePlugin } from './lib/api-device.js';
import { runPipeline, isPerfect } from './lib/pipeline.js';
import { extractFacts, verifyFacts } from './lib/constraints.js';
import { tooLittleText, ocrBody, ocrRetryHint, dedupeOcr } from './lib/prompts.js';
import { EXAMPLES } from './examples.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d = null) { try { return localStorage.getItem(`mv.${k}`) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`mv.${k}`, v); } catch { /* 隐私模式等情况下忽略 */ } },
};

const app = {
  mode: 'photo',
  model: null,
  health: null,
  editor: null,
  problem: '',
  image: null,
  hint: '',
  analysis: null,
  source: null,
  example: null,
  sceneState: {},
  scene: null,
  view: null,
  players: new Map(),
  commands: [],
  facts: [], // 从题目文字里提取的、可以自动核对的条件（lib/constraints.js）
  added: [], // 程序按题目补画的内容
};

// 模型在哪里运行：
//   默认：连接服务端（网页版同源；手机 App 里填写电脑上服务的地址）
//   ?engine=device：本机模型客户端。打包成 App 后使用原生插件 LocalModel（llama.cpp）；
//                   在电脑浏览器里调试时由 Ollama 扮演这个插件
function makeApi() {
  // 打包成 App 且带有本机模型插件时，默认在手机上运行；否则默认连接服务
  const nativeModel = !!window.Capacitor?.Plugins?.LocalModel && !!window.Capacitor?.isNativePlatform?.();
  const engine = new URLSearchParams(location.search).get('engine') || store.get('engine', nativeModel ? 'device' : 'server');
  if (engine === 'device') {
    const native = window.Capacitor?.Plugins?.LocalModel;
    const plugin = native || createOllamaDevicePlugin({ model: store.get('model') || undefined });
    return createDeviceApi({ plugin, model: store.get('model') || 'qwen3.5:2b-q4_K_M' });
  }
  return createApi({ baseUrl: store.get('server', '') });
}
let api = makeApi();
// 是否运行在打包后的 App 里（Capacitor 会注入 window.Capacitor）
const isNativeApp = () => !!window.Capacitor?.isNativePlatform?.();
// 页面不是由本项目的服务提供时（打包进 App，或 capacitor:// / file:// 打开），必须先设置服务地址
const needsServer = () => api.kind !== 'device' && !api.baseUrl && (isNativeApp() || !/^https?:$/.test(location.protocol));

// 识别/分析流程、解题思路各用一个任务控制器：新任务开始时旧任务自动作废，旧回调不会再改界面
const runs = new RunController({ onRunningChange: (on) => setRunning(on) });
const solves = new RunController({ onRunningChange: (on) => setSolving(on) });

// ====================== 初始化 ======================
function init() {
  app.editor = new ImageEditor($('imgCanvas'), { onChange: updatePhotoUI });

  document.querySelectorAll('.seg-btn').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('pickBtn').addEventListener('click', () => $('fileInput').click());
  $('replaceBtn').addEventListener('click', () => $('fileInput').click());
  $('cameraBtn').addEventListener('click', openCamera);
  $('rotateBtn').addEventListener('click', () => app.editor.rotate());
  $('clearCropBtn').addEventListener('click', () => app.editor.clearCrop());
  for (const id of ['fileInput', 'cameraInput']) {
    $(id).addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) loadImage(f); e.target.value = ''; });
  }
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) loadImage(f);
  });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items || [])].find((x) => x.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    setMode('photo');
    loadImage(item.getAsFile());
  });

  buildSymbols();
  const ta = $('textInput');
  ta.value = store.get('text', '');
  ta.addEventListener('input', () => { store.set('text', ta.value); updateTextPreview(); });
  updateTextPreview();

  $('runBtn').addEventListener('click', runFromInput);
  $('stopBtn').addEventListener('click', () => runs.stop());
  ta.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runFromInput(); });

  buildExamples();
  $('editBtn').addEventListener('click', () => toggleEdit(true));
  $('cancelEditBtn').addEventListener('click', () => toggleEdit(false));
  $('reanalyzeBtn').addEventListener('click', () => {
    const text = $('problemText').value.trim();
    if (!text) return;
    toggleEdit(false);
    start({ text, image: app.image, hint: app.hint, skipOcr: true });
  });
  $('applyCmdBtn').addEventListener('click', applyCommandEdits);
  $('cmdText').addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') applyCommandEdits(); });
  $('syntaxBtn').addEventListener('click', () => openHelp('syntax'));
  $('helpBtn').addEventListener('click', () => openHelp('help'));
  $('settingsBtn').addEventListener('click', openSettings);
  $('serverTestBtn').addEventListener('click', testServer);
  $('settingsForm').addEventListener('submit', saveSettings);
  $('solveBtn').addEventListener('click', solve);
  $('modelSelect').addEventListener('change', (e) => { app.model = e.target.value; store.set('model', app.model); });

  setMode(store.get('mode', 'photo'));
  checkHealth();
  if (needsServer()) openSettings();
  registerServiceWorker();
  setInterval(() => { if (!app.health?.connected) checkHealth(); }, 15000);

  let lastW = window.innerWidth;
  window.addEventListener('resize', debounce(() => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    if (app.commands.length) drawFigure(app.commands);
  }, 250));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (app.commands.length) drawFigure(app.commands); });
}

// PWA：只有在安全环境（https 或 localhost）下浏览器才允许注册；打包进 App 时由 App 自己负责离线，不需要它
function registerServiceWorker() {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!('serviceWorker' in navigator) || !secure || !/^https?:$/.test(location.protocol) || isNativeApp()) return;
  navigator.serviceWorker.register('/sw.js').catch(() => { /* 不影响正常使用 */ });
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function throttle(fn, ms) {
  let last = 0, timer = null, pending = null;
  const run = () => { last = performance.now(); timer = null; const a = pending; pending = null; fn(...a); };
  const wrapped = (...a) => {
    pending = a;
    if (timer) return;
    const wait = Math.max(0, ms - (performance.now() - last));
    timer = setTimeout(run, wait);
  };
  wrapped.flush = () => { if (timer) { clearTimeout(timer); run(); } };
  wrapped.cancel = () => { clearTimeout(timer); timer = null; pending = null; };
  return wrapped;
}

// ====================== 本地模型状态 ======================
function updatePrivacy(h) {
  const el = document.querySelector('.privacy');
  if (api.kind === 'device') {
    el.textContent = '模型在这台设备上运行：图片和题目不会离开这台设备。';
    el.classList.remove('warn');
  } else if (h && h.local === false) {
    el.innerHTML = `注意：当前配置的模型服务位于 <b>${esc(h.endpointHost || '其他机器')}</b>，图片和题目会发送到那台机器处理。`;
    el.classList.add('warn');
  } else {
    el.textContent = '默认配置下全部在本机运行：图片和题目只发送给运行本项目的电脑上的本地模型，不会上传到云端。';
    el.classList.remove('warn');
  }
}

async function checkHealth() {
  let h;
  if (needsServer()) {
    h = { connected: false, models: [], error: '请先在“设置”里填写电脑上服务的地址。', needsServer: true };
  } else {
    try {
      h = await api.health();
    } catch (e) {
      h = { connected: false, models: [], error: e.message, serverDown: true };
    }
  }
  app.health = h;
  updatePrivacy(h);
  const sel = $('modelSelect');
  const dot = $('modelDot');
  const banner = $('banner');
  if (!h.connected) {
    dot.className = 'dot bad';
    sel.innerHTML = '<option>未连接本地模型</option>';
    sel.disabled = true;
    banner.innerHTML = `<b>还没有连接到${h.serverDown || h.needsServer ? '服务' : '本地模型'}。</b>${esc(h.error || '')} 在此之前，可以先点击示例题查看可视化效果。 <a href="#" id="bannerHelp">${h.serverDown || h.needsServer ? '打开设置' : '查看安装步骤'}</a>`;
    banner.hidden = false;
    $('bannerHelp')?.addEventListener('click', (e) => { e.preventDefault(); if (h.serverDown || h.needsServer) openSettings(); else openHelp('help'); });
    return;
  }
  dot.className = 'dot ok';
  sel.disabled = false;
  const saved = store.get('model');
  const names = h.models.map((m) => m.name);
  app.model = names.includes(saved) ? saved : h.defaultModel;
  sel.innerHTML = h.models.map((m) => `<option value="${esc(m.name)}"${m.name === app.model ? ' selected' : ''}>${esc(m.name)}${m.vision ? '' : '（不支持图片）'}</option>`).join('');
  sel.title = `本地模型（Ollama ${h.version || ''}）`;
  if (!h.models.length) {
    banner.innerHTML = `<b>Ollama 已运行，但还没有下载模型。</b>请在终端运行 <code>ollama pull ${esc(h.configuredModel || 'qwen3.5:4b-q4_K_M')}</code>，完成后刷新页面。`;
    banner.hidden = false;
  } else if (!h.models.some((m) => m.vision)) {
    banner.innerHTML = '<b>当前的本地模型都不支持识别图片。</b>“输入题目”可以正常使用；要拍照识别，请下载支持视觉的模型，例如 <code>ollama pull qwen3.5:4b-q4_K_M</code>。';
    banner.hidden = false;
  } else {
    banner.hidden = true;
  }
}

// ====================== 输入 ======================
function setMode(mode) {
  app.mode = mode === 'text' ? 'text' : 'photo';
  store.set('mode', app.mode);
  document.querySelectorAll('.seg-btn').forEach((b) => {
    const on = b.dataset.mode === app.mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  $('photoPane').hidden = app.mode !== 'photo';
  $('textPane').hidden = app.mode !== 'text';
  $('runBtn').textContent = app.mode === 'photo' ? '识别并可视化' : '分析并可视化';
  if (app.mode === 'photo') app.editor.draw();
}

async function loadImage(file) {
  try {
    setMode('photo');
    await app.editor.load(file);
  } catch (e) {
    showError(e);
  }
}

function updatePhotoUI() {
  const has = app.editor.hasImage;
  $('dropEmpty').hidden = has;
  $('dropPreview').hidden = !has;
  $('clearCropBtn').hidden = !app.editor.crop;
  if (has) requestAnimationFrame(() => app.editor.draw());
}

const SYMBOLS = ['²', '³', '√', 'π', '≤', '≥', '≠', '±', '∠', '△', '⊥', '∥', '°', '∈', '∞', 'α', 'θ', '·'];
function buildSymbols() {
  const box = $('symbols');
  box.innerHTML = SYMBOLS.map((s) => `<button type="button" data-s="${s}">${s}</button>`).join('') + '<button type="button" data-s="$  $" title="插入 LaTeX 公式">$…$</button>';
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ta = $('textInput');
    const s = b.dataset.s;
    const { selectionStart: a, selectionEnd: z, value } = ta;
    ta.value = value.slice(0, a) + s + value.slice(z);
    const caret = s === '$  $' ? a + 2 : a + s.length;
    ta.focus();
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event('input'));
  });
}

const updateTextPreview = debounce(() => {
  const v = $('textInput').value;
  const show = /\$|\\\(|\\\[/.test(v);
  $('textPreview').hidden = !show;
  if (show) $('textPreview').innerHTML = renderMarkdown(v);
}, 150);

async function openCamera() {
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch || !navigator.mediaDevices?.getUserMedia) { $('cameraInput').click(); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
  } catch {
    $('fileInput').click();
    return;
  }
  const dlg = $('cameraDialog'), video = $('cameraVideo');
  video.srcObject = stream;
  const stop = () => { stream.getTracks().forEach((t) => t.stop()); video.srcObject = null; };
  $('shootBtn').onclick = () => {
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    c.toBlob((blob) => { if (blob) loadImage(blob); }, 'image/jpeg', 0.92);
    dlg.close();
  };
  $('cameraCancelBtn').onclick = () => dlg.close();
  dlg.addEventListener('close', stop, { once: true });
  dlg.showModal();
}

// ====================== 流程 ======================
function runFromInput() {
  if (app.mode === 'photo') {
    if (!app.editor.hasImage) { showError(new Error('请先拍照或选择一张题目图片。')); return; }
    start({ image: app.editor.toDataURL(1600, 0.9), hint: $('hint').value.trim() });
  } else {
    const text = $('textInput').value.trim();
    if (!text) { showError(new Error('请先输入题目内容。')); $('textInput').focus(); return; }
    start({ text });
  }
}

function setRunning(on) {
  $('runBtn').disabled = on;
  $('stopBtn').hidden = !on;
  $('reanalyzeBtn').disabled = on;
}

async function start({ image = null, text = '', hint = '', skipOcr = false }) {
  const run = runs.begin(); // 先作废上一个任务：它之后的回调、报错、收尾都不会再改动界面
  resetResults();
  app.source = 'model';
  app.example = null;
  markExample(null);
  app.image = image;
  app.hint = hint;
  const needOcr = !!image && !skipOcr;
  $('empty').hidden = true;
  $('progress').hidden = false;
  setStep('ocr', needOcr ? 'wait' : 'skip');
  setStep('analyze', 'wait');
  setStep('check', 'skip');
  if (window.innerWidth < 900) $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  let failed = needOcr ? 'ocr' : 'analyze';
  try {
    let problem = text;
    if (needOcr) problem = await recognize(run, image, hint);
    else showProblem(problem);
    if (!run.alive()) return;
    app.problem = problem;
    failed = 'analyze';
    await runAnalysis(run, problem, analysisImage(problem, image), hint, (step) => { failed = step; });
  } catch (e) {
    if (!run.alive()) return; // 已被新任务取代
    if (run.signal.aborted) {
      setStep(failed, 'error', '已停止');
    } else {
      setStep(failed, 'error', '失败');
      showError(e);
    }
  } finally {
    runs.finish(run); // 只有仍是当前任务时才会关闭“运行中”状态
  }
}

// 分析题意只用识别出的文字（自动评测也是这样测的）：2026-11-10 在 Mac 上实测，附上原图时 2B 的输出多了一倍
// （585 → 1247 token），而且开始重复绕圈子。只有识别结果里几乎没有题目文字时（R7-1 只识别出「【图形】没有图形。」），
// 才把原图交给分析，作为补救（识别时已经重试过一次）。
function analysisImage(problem, image) {
  return image && tooLittleText(problem) ? image : null;
}

function setStep(name, status, meta = '') {
  const el = document.querySelector(`.step[data-step="${name}"]`);
  if (!el) return;
  el.className = `step ${status === 'wait' ? '' : status}`;
  el.querySelector('.meta').textContent = meta;
}

// 步骤计时器：stop() 可以重复调用；任务被取代后自动停止，不会一直在后台刷新
function ticker(step, run) {
  const t0 = performance.now();
  let extra = '', secs = null;
  const show = () => setStep(step, 'active', `${((performance.now() - t0) / 1000).toFixed(1)} 秒${extra}`);
  const id = setInterval(() => { if (run.alive()) show(); else stop(); }, 200);
  function stop() {
    if (secs === null) { clearInterval(id); secs = (performance.now() - t0) / 1000; }
    return secs;
  }
  if (run.alive()) show();
  return { note(s) { extra = s ? ` · ${s}` : ''; }, stop };
}

async function recognize(run, image, hint) {
  const tk = ticker('ocr', run);
  let text = '';
  try {
    text = await recognizeOnce(run, image, hint, tk);
    // 几乎没有识别出题目文字（R7-1 只有「【图形】没有图形。」）：换个说法再识别一次，用题目文字多的那次
    if (run.alive() && tooLittleText(text)) {
      let again = '';
      try {
        again = await recognizeOnce(run, image, ocrRetryHint(hint), tk, '文字太少，重新识别');
      } catch (e) {
        if (run.signal.aborted || !text) throw e; // 重试出错时，用第一次的结果
      }
      if (ocrBody(again).length > ocrBody(text).length) text = again;
    }
  } finally {
    tk.stop();
  }
  const secs = tk.stop();
  if (!run.alive()) return '';
  if (!text) throw new Error('没有识别出题目内容。可以换一张更清晰的照片，或在图上框选题目区域后重试。');
  showProblem(text);
  setStep('ocr', 'done', `${secs.toFixed(1)} 秒`);
  return text;
}

// 识别一次，边生成边显示
async function recognizeOnce(run, image, hint, tk, label = '') {
  let text = '';
  showProblem('', true);
  const render = throttle(() => { if (run.alive()) showProblem(text, true); }, 120);
  try {
    await api.recognize({ image, hint, model: app.model }, run.signal, (ev) => {
      if (!run.alive()) return;
      if (ev.t === 'delta') { text += ev.v; tk.note([label, `${text.length} 字`].filter(Boolean).join(' · ')); render(); }
    });
  } finally {
    render.cancel();
  }
  return dedupeOcr(cleanText(text));
}

function cleanText(t) {
  return String(t).replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').replace(/<\/?think>/g, '').trim();
}

// 分析 → 核对题目条件 → 必要时修正或重新生成（流程在 lib/pipeline.js，评测脚本用的是同一份）
async function runAnalysis(run, problem, image, hint, setFailed) {
  const tk = ticker('analyze', run);
  let latest = '', shownCount = -1, checkTk = null, best = null;
  const live = throttle(() => {
    if (!run.alive()) return;
    const a = parsePartialJSON(latest);
    if (!a || typeof a !== 'object') return;
    applyAnalysis(a, false);
    const cmds = completeCommands(a.commands);
    if (cmds.length !== shownCount && cmds.length) {
      shownCount = cmds.length;
      tk.note(`已生成 ${cmds.length} 条作图命令`);
      drawFigure(cmds, { live: true });
    }
  }, 350);
  const progress = (note) => {
    if (!checkTk) { checkTk = ticker('check', run); setFailed('check'); }
    const sum = best && best.total ? `题目条件 ${best.sat}/${best.total}` : best?.errors.length ? `${best.errors.length} 处命令出错` : '';
    checkTk.note([sum, note].filter(Boolean).join('，'));
  };
  let res;
  try {
    res = await runPipeline({
      text: problem, image, hint, model: app.model, api, signal: run.signal,
      onEvent: (ev) => {
        if (!run.alive()) return;
        if (ev.type === 'facts') app.facts = ev.facts;
        else if (ev.type === 'delta' && ev.attempt === 1) { latest = ev.text; live(); }
        else if (ev.type === 'analyze-done' && ev.attempt === 1) {
          live.cancel();
          const secs = tk.stop();
          const speed = ev.stats?.tokensPerSecond ? ` · ${Math.round(ev.stats.tokensPerSecond)} 字元/秒` : '';
          setStep('analyze', ev.candidate ? 'done' : 'error', ev.candidate ? `${secs.toFixed(1)} 秒${speed}` : '输出格式不对');
        } else if (ev.type === 'best') {
          best = ev.candidate;
          showCandidate(best);
        } else if (ev.type === 'repair-start') progress('正在请模型按核对结果修改');
        else if (ev.type === 'analyze-start' && ev.attempt > 1) progress(`重新生成第 ${ev.attempt} 版`);
      },
    });
  } finally {
    live.cancel();
    tk.stop();
    checkTk?.stop();
  }
  if (!run.alive()) return;
  const b = res.best;
  if (app.shown !== b) showCandidate(b);
  if (!b.total && !b.errors.length && res.calls === 1 && !b.added.length) return; // 没有可核对的条件，命令也没出错
  const parts = [
    b.total ? `题目条件 ${b.sat}/${b.total}` : '',
    b.added.length ? `程序补画 ${b.added.length} 处` : '',
    b.errors.length ? `${b.errors.length} 处命令出错` : '',
    res.calls > 1 ? `共调用模型 ${res.calls} 次` : '',
    checkTk ? `${checkTk.stop().toFixed(1)} 秒` : '',
  ].filter(Boolean);
  setStep('check', isPerfect(b) ? 'done' : 'warn', parts.join(' · ') + (isPerfect(b) ? '' : '，详情见图下方'));
}

// 显示一版作图结果（随时可能被更好的一版替换）
function showCandidate(c) {
  app.shown = c;
  for (const k of Object.keys(app.sceneState)) delete app.sceneState[k];
  app.added = c.added || [];
  applyAnalysis({ ...c.analysis, commands: c.commands }, true);
}

function completeCommands(cmds) {
  if (!Array.isArray(cmds)) return [];
  const list = cmds[PARTIAL] ? cmds.slice(0, -1) : cmds.slice();
  return list.map(String).filter((c) => c.trim());
}

// ====================== 结果展示 ======================
function resetResults() {
  solves.supersede();
  $('solveBtn').textContent = '生成解题思路';
  $('solveBtn').disabled = false;
  stopPlayers();
  app.view?.destroy();
  app.view = null;
  app.scene = null;
  app.analysis = null;
  app.commands = [];
  app.facts = [];
  app.added = [];
  for (const k of Object.keys(app.sceneState)) delete app.sceneState[k];
  ['problemCard', 'figureCard', 'analysisCard', 'commandsCard', 'solutionCard', 'errorBox'].forEach((id) => { $(id).hidden = true; });
  $('figure').innerHTML = '';
  $('sliders').innerHTML = '';
  $('figTools').innerHTML = '';
  $('formulas').hidden = true;
  $('facts').hidden = true;
  $('tables').hidden = true;
  $('tables').innerHTML = '';
  $('figure').hidden = false;
  $('figTip').textContent = '';
  $('insight').hidden = true;
  $('solution').innerHTML = '';
  $('thinking').hidden = true;
  $('cmdErrors').innerHTML = '';
  $('cmdText').value = '';
  $('figCategory').hidden = true;
  $('figTitle').textContent = '图形';
  toggleEdit(false);
}

function showProblem(text, streaming = false) {
  $('problemCard').hidden = false;
  const v = $('problemView');
  v.innerHTML = text ? renderMarkdown(text) : '<span class="muted">正在识别…</span>';
  v.classList.toggle('streaming', streaming);
  $('editBtn').hidden = streaming;
}

function toggleEdit(on) {
  $('problemEdit').hidden = !on;
  $('problemView').hidden = on;
  $('editBtn').hidden = on;
  if (on) {
    $('problemText').value = app.problem;
    $('problemText').focus();
  }
}

function showError(e) {
  const box = $('errorBox');
  let html = esc(e.message || String(e));
  if (e.code === 'model_missing') html += '<br>下载完成后刷新页面即可。';
  if (e.code === 'unreachable') html += '<br><a href="#" data-help>查看安装步骤</a>';
  box.innerHTML = html.replace(/ollama pull (\S+)/, 'ollama pull <code>$1</code>');
  box.hidden = false;
  box.querySelector('[data-help]')?.addEventListener('click', (ev) => { ev.preventDefault(); openHelp('help'); });
  if (e.code === 'unreachable') checkHealth();
}

function applyAnalysis(a, final) {
  $('figureCard').hidden = false;
  if (a.title) $('figTitle').textContent = a.title;
  if (a.category) { $('figCategory').textContent = a.category; $('figCategory').hidden = false; }
  if (Array.isArray(a.knowns) && a.knowns.length || a.goal) {
    $('analysisCard').hidden = false;
    $('knowns').innerHTML = (a.knowns || []).map((k) => `<li>${renderInline(k)}</li>`).join('');
    $('goal').innerHTML = renderInline(a.goal || '');
  }
  $('layoutText').innerHTML = a.layout ? renderMarkdown(a.layout) : '<span class="muted">（无）</span>';
  if (a.insight) { $('insight').hidden = false; $('insight').innerHTML = renderMarkdown(a.insight); }
  if (final) {
    app.analysis = a;
    $('commandsCard').hidden = false;
    $('cmdText').value = (a.commands || []).join('\n');
    drawFigure(a.commands || []);
    $('solutionCard').hidden = false;
    $('solveBtn').textContent = app.source === 'example' ? '查看解题思路' : '生成解题思路';
    $('solveBtn').disabled = false;
  }
}

// ====================== 表格 ======================
// Table("标题") 开始一个表格，后面的 Row(…) 依次是它的行（第一行是表头）；没有 Table 时自动建一个
function collectTables(scene) {
  const tables = [];
  let cur = null;
  for (const o of scene.objects) {
    if (o.tags.has('hidden') || !o.value) continue;
    if (o.value.T === 'table') { cur = { title: o.value.title, rows: [] }; tables.push(cur); }
    else if (o.value.T === 'row') {
      if (!cur) { cur = { title: '', rows: [] }; tables.push(cur); }
      cur.rows.push(o.value.cells);
    }
  }
  return tables.filter((t) => t.rows.length);
}

function renderTables(scene) {
  const box = $('tables');
  const tables = scene ? collectTables(scene) : [];
  box.hidden = !tables.length;
  box.innerHTML = tables.map((t) => {
    const n = Math.max(...t.rows.map((r) => r.length));
    const pad = (r) => [...r, ...Array(n - r.length).fill('')];
    const cell = (c, tag) => `<${tag}>${renderInline(c)}</${tag}>`;
    const [head, ...body] = t.rows;
    return `<div class="mtable-wrap">${t.title ? `<div class="mtable-title">${renderInline(t.title)}</div>` : ''}<table class="mtable">`
      + `<thead><tr>${pad(head).map((c) => cell(c, 'th')).join('')}</tr></thead>`
      + `<tbody>${body.map((r) => `<tr>${pad(r).map((c, i) => cell(c, i === 0 ? 'th' : 'td')).join('')}</tr>`).join('')}</tbody></table></div>`;
  }).join('');
  return tables.length;
}

// 滑块变化后：重算图形和表格里的数
function refreshFigure() {
  if (app.view) app.view.update(); else app.scene?.recompute();
  if (app.scene) renderTables(app.scene);
}

// ====================== 作图 ======================
function drawFigure(commands, { live = false } = {}) {
  stopPlayers();
  app.view?.destroy();
  app.view = null;
  app.commands = commands.slice();
  if (!live) $('cmdText').value = commands.join('\n');
  const scene = buildScene(commands, app.sceneState);
  app.scene = scene;
  if (!live) showCmdErrors(scene.errors);
  const box = $('figure');
  const tableCount = renderTables(scene);
  box.hidden = false;
  const drawable = scene.objects.filter((o) => !['number', 'boolean', 'string', 'table', 'row'].includes(o.kind) && !o.tags.has('hidden'));
  if (!drawable.length && tableCount) {
    // 只有表格（概率、统计题）：不画空白的坐标系
    box.hidden = true;
    box.innerHTML = '';
    $('figTools').innerHTML = '';
    buildSliders(scene);
    showFormulas(scene);
    if (!live) showFacts(scene);
    $('figTip').textContent = scene.sliders().length ? '拖动滑块，表格里的数值会跟着变化。' : '';
    return;
  }
  if (!drawable.length) {
    box.innerHTML = `<div class="placeholder">${live ? '正在生成图形…' : '这道题没有生成可以画的图形。可以在下方“作图命令”里手动补充。'}</div>`;
    $('sliders').innerHTML = '';
    $('figTools').innerHTML = '';
    return;
  }
  try {
    const opts = { onChange: syncSliders };
    app.view = scene.mode === '3d' ? render3d(box, scene, opts) : render2d(box, scene, opts);
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="placeholder">绘图出错：${esc(e.message)}</div>`;
    return;
  }
  buildTools(scene);
  buildSliders(scene);
  showFormulas(scene);
  if (!live) showFacts(scene);
  const hasDrag = scene.objects.some((o) => (o.role === 'free' || o.role === 'glider') && !o.tags.has('fixed') && !o.tags.has('hidden'));
  const touch = matchMedia('(pointer: coarse)').matches;
  $('figTip').textContent = scene.mode === '3d'
    ? (touch ? '单指拖动旋转，双指捏合缩放，双击回到默认视角。' : '按住拖动可以旋转，滚轮缩放，双击回到默认视角。')
    : `${hasDrag ? '蓝色的点可以拖动；' : ''}${touch ? '双指捏合缩放、双指拖动平移。' : '滚轮缩放，按住空白处拖动可以平移。'}`;
}

// “程序理解的公式”：把函数、方程按程序实际的解析结果显示出来，方便核对（例如 1/2x 被理解为 ½x）
function showFormulas(scene) {
  const box = $('formulas');
  const list = scene.objects.filter((o) => o.tex && !o.tags.has('hidden')).slice(0, 8);
  box.hidden = !list.length;
  box.innerHTML = list.length
    ? `<span class="formulas-title">程序理解的公式</span>${list.map((o) => `<span class="formula">${renderInline(`$${o.tex}$`)}</span>`).join('')}`
    : '';
}

// “核对题目条件”：逐条显示题目里的条件在图中是否成立（手动修改命令后会重新核对）
function showFacts(scene) {
  const box = $('facts');
  const facts = app.facts || [];
  if (!facts.length) { box.hidden = true; box.innerHTML = ''; return; }
  const v = verifyFacts(scene, facts);
  const items = v.results.map((r) => {
    const cls = r.ok === true ? 'ok' : r.ok === false ? 'bad' : 'na';
    const mark = r.ok === true ? '✓' : r.ok === false ? '✗' : '–';
    const detail = r.ok === false ? `<span class="fact-detail">${esc(r.detail)}</span>` : r.ok === null ? `<span class="fact-detail">无法核对：${esc(r.detail)}</span>` : '';
    return `<li class="${cls}"><span class="fact-mark">${mark}</span><span>${esc(r.fact.desc)}</span>${detail}</li>`;
  }).join('');
  const added = app.added?.length ? `<p class="facts-added">题目里写明、模型没有画对的部分，已由程序按题目补画：${app.added.map((x) => esc(x.desc)).join('；')}</p>` : '';
  const allOk = v.sat === v.total;
  box.innerHTML = `<details${allOk ? '' : ' open'}><summary>核对题目条件 <b>${v.sat}/${v.total}</b> <span class="${allOk ? 'all-ok' : 'some-bad'}">${allOk ? '全部满足' : `${v.total - v.sat} 条不满足，可以在“作图命令”里修改`}</span></summary><ul>${items}</ul></details>${added}`;
  box.hidden = false;
}

function buildTools(scene) {
  const box = $('figTools');
  const btn = (label, title, fn) => {
    const b = document.createElement('button');
    b.className = 'btn ghost small';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', () => fn(b));
    box.appendChild(b);
    return b;
  };
  box.innerHTML = '';
  if (scene.mode === '3d') {
    btn('正视', '正视图（从前往后看）', () => app.view.setView('front'));
    btn('侧视', '侧视图（从左往右看）', () => app.view.setView('side'));
    btn('俯视', '俯视图（从上往下看）', () => app.view.setView('top'));
    btn('自动旋转', '自动旋转', (b) => b.classList.toggle('on', app.view.toggleSpin()));
  } else {
    btn('放大', '放大', () => app.view.zoom(1.2));
    btn('缩小', '缩小', () => app.view.zoom(1 / 1.2));
  }
  btn('复位', '恢复初始的图形和视角', () => {
    for (const k of Object.keys(app.sceneState)) delete app.sceneState[k];
    drawFigure(app.commands);
  });
}

function sliderText(v, step) {
  const digits = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return Number(v).toFixed(digits);
}

function buildSliders(scene) {
  const box = $('sliders');
  box.innerHTML = '';
  for (const o of scene.sliders()) {
    const { min, max, step } = o.slider;
    const row = document.createElement('div');
    row.className = 'slider-row';
    const id = `sl-${o.name}`;
    row.innerHTML = `<label for="${id}">${o.labelText ? renderInline(o.labelText) : `<i>${esc(o.name)}</i>`}</label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${scene.values[o.name]}">
      <output>${sliderText(scene.values[o.name], step)}</output>
      <button class="play" type="button" title="播放动画" aria-label="播放动画"><svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg></button>`;
    const input = row.querySelector('input'), out = row.querySelector('output'), play = row.querySelector('.play');
    input.addEventListener('input', () => {
      app.sceneState[o.name] = Number(input.value);
      out.textContent = sliderText(input.value, step);
      refreshFigure();
    });
    play.addEventListener('click', () => togglePlay(o, input, out, play));
    box.appendChild(row);
  }
}

function syncSliders() { /* 拖动点不会改变滑块，预留 */ }

const PLAY_ICON = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 16 16"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>';
function togglePlay(o, input, out, btn) {
  if (app.players.has(o.name)) {
    cancelAnimationFrame(app.players.get(o.name).raf);
    app.players.delete(o.name);
    btn.innerHTML = PLAY_ICON;
    return;
  }
  const { min, max, step } = o.slider;
  let v = Number(input.value);
  let dir = v >= max ? -1 : 1;
  let last = performance.now();
  const player = { raf: 0 };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    v += dir * (max - min) * dt / 4;
    if (v >= max) { v = max; dir = -1; }
    if (v <= min) { v = min; dir = 1; }
    app.sceneState[o.name] = v;
    input.value = v;
    out.textContent = sliderText(v, step);
    refreshFigure();
    player.raf = requestAnimationFrame(tick);
  };
  player.raf = requestAnimationFrame(tick);
  app.players.set(o.name, player);
  btn.innerHTML = PAUSE_ICON;
}

function stopPlayers() {
  for (const p of app.players.values()) cancelAnimationFrame(p.raf);
  app.players.clear();
}

function showCmdErrors(errors) {
  $('cmdErrors').innerHTML = errors.map((e) => `<li>第 ${e.line + 1} 行「${esc(e.src)}」：${esc(e.message)}</li>`).join('');
  if (errors.length && app.source === 'model') $('cmdDetails').open = true;
}

function applyCommandEdits() {
  const lines = $('cmdText').value.split('\n').map((s) => s.trim()).filter(Boolean);
  for (const k of Object.keys(app.sceneState)) delete app.sceneState[k];
  if (app.analysis) app.analysis.commands = lines;
  app.added = [];
  $('figureCard').hidden = false;
  drawFigure(lines);
}

// ====================== 示例 ======================
function buildExamples() {
  const box = $('exampleList');
  box.innerHTML = EXAMPLES.map((e) => `<button class="chip" data-id="${e.id}">${esc(e.label)}</button>`).join('');
  box.addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    loadExample(EXAMPLES.find((e) => e.id === b.dataset.id));
  });
}

function markExample(id) {
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
}

function loadExample(ex) {
  runs.supersede();
  resetResults();
  app.source = 'example';
  app.example = ex;
  app.image = null;
  app.problem = ex.problem;
  app.facts = extractFacts(ex.problem).facts;
  markExample(ex.id);
  $('empty').hidden = true;
  $('progress').hidden = true;
  showProblem(ex.problem);
  applyAnalysis(JSON.parse(JSON.stringify(ex.analysis)), true);
  if (window.innerWidth < 900) $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ====================== 解题思路 ======================
function setSolving(on) {
  if (on) $('solveBtn').textContent = '停止生成';
}

async function solve() {
  const out = $('solution');
  const btn = $('solveBtn');
  if (solves.running) { solves.stop(); return; } // 生成过程中再点一次 = 停止
  if (app.source === 'example' && app.example?.solution) {
    out.innerHTML = renderMarkdown(app.example.solution);
    btn.disabled = true;
    return;
  }
  if (!app.health?.connected) { showError(Object.assign(new Error('还没有连接到本地模型，无法生成解题思路。'), { code: 'unreachable' })); return; }
  const run = solves.begin();
  const think = $('thinking');
  let text = '', thoughts = '';
  out.innerHTML = '';
  const render = throttle(() => { if (run.alive()) out.innerHTML = renderMarkdown(text); }, 150);
  const note = (s) => `<p class="muted" style="font-size:12px;margin-top:10px">${s}</p>`;
  try {
    // 不把作图命令交给解题：模型自己算错的坐标（例如画错的交点）会被照抄进解答，只按题目本身解题
    await api.solve({ text: app.problem, model: app.model }, run.signal, (ev) => {
      if (!run.alive()) return;
      if (ev.t === 'think') {
        thoughts += ev.v;
        think.hidden = false;
        think.textContent = thoughts.slice(-1200);
        think.scrollTop = think.scrollHeight;
      }
      if (ev.t === 'delta') { think.hidden = true; text += ev.v; render(); }
    });
    render.cancel();
    if (!run.alive()) return;
    think.hidden = true;
    const answer = cleanText(text);
    if (answer) {
      out.innerHTML = renderMarkdown(answer) + note('由本地模型生成，仅供参考，请注意核对。');
    } else {
      // 小模型偶尔只“思考”、一直没有给出解答：说明情况，并把思考过程放在折叠框里
      out.innerHTML = `<p class="error-text">模型这次没有给出解答${thoughts ? '（只输出了思考过程）' : ''}，可以点“重新生成”再试。</p>`
        + (thoughts ? `<details><summary class="muted">查看思考过程</summary><pre class="thinking-dump">${esc(thoughts.slice(-4000))}</pre></details>` : '');
    }
    btn.textContent = '重新生成';
  } catch (e) {
    render.cancel();
    if (!run.alive()) return; // 已切换到别的题目
    think.hidden = true;
    if (run.signal.aborted) {
      out.innerHTML = renderMarkdown(cleanText(text)) + note('已停止生成。');
      btn.textContent = '重新生成';
    } else {
      showError(e);
      btn.textContent = '生成解题思路';
    }
  } finally {
    solves.finish(run);
  }
}

// ====================== 设置（服务地址） ======================
function engineHelp() {
  const native = !!window.Capacitor?.Plugins?.LocalModel;
  $('engineHelp').textContent = $('engineSelect').value === 'device'
    ? (native ? '使用 App 内置的小模型，不需要电脑，也不需要联网。' : '当前不是手机 App：会直接调用这台电脑上的 Ollama 来模拟“本机模型”，用于调试。')
    : '图片和题目发送给电脑上运行的服务处理。';
}

function openSettings() {
  $('engineSelect').value = api.kind === 'device' ? 'device' : 'server';
  $('engineSelect').onchange = engineHelp;
  engineHelp();
  $('serverInput').value = api.kind === 'device' ? store.get('server', '') : api.baseUrl;
  $('serverStatus').textContent = api.baseUrl ? `当前：${api.baseUrl}` : `当前：与页面相同（${location.origin}）`;
  $('serverStatus').className = 'muted';
  $('settingsDialog').showModal();
}

async function testServer() {
  const st = $('serverStatus');
  const candidate = createApi({ baseUrl: $('serverInput').value });
  st.className = 'muted';
  st.textContent = '正在连接…';
  try {
    const h = await candidate.health();
    st.className = 'ok-text';
    st.textContent = h.connected
      ? `连接成功：${h.models.length} 个本地模型，默认 ${h.defaultModel}${h.warning ? `（${h.warning}）` : ''}`
      : `已连上服务，但服务没有连上本地模型：${h.error || ''}`;
  } catch (e) {
    st.className = 'error-text';
    st.textContent = e.message;
  }
}

function saveSettings(e) {
  e.preventDefault();
  const v = normalizeBaseUrl($('serverInput').value);
  store.set('server', v);
  store.set('engine', $('engineSelect').value);
  api = makeApi();
  $('settingsDialog').close();
  checkHealth();
}

// ====================== 帮助 ======================
const HELP = `### 第一次使用
1. 安装 [Ollama](https://ollama.com)（本地运行大模型的工具），打开它；
2. 在终端下载识图模型（约 3.3 GB）：\`ollama pull qwen3.5:4b-q4_K_M\`
3. 在项目目录运行 \`npm start\`，浏览器打开 http://localhost:3000

### 怎么用
- **拍照 / 图片**：拍照、选择图片、拖入图片或粘贴截图都可以。一张图有多道题时，在预览图上拖动框选要识别的那一道；照片是横的可以点“旋转”。
- **输入题目**：直接输入或粘贴题目，公式可以用 x²、√、π 这些符号，也可以写 LaTeX。
- 识别结果不对时，点题目右上角的“修改”，改好后“重新分析”。
- 图形不理想时，可以在“作图命令”里直接修改，点“重新绘制”。

### 核对题目条件
程序会从题目文字里找出长度、角度、垂直、平行、中点、坐标、方程、不等式组等条件，画完后逐条核对，结果显示在图的下方。
- 有命令出错或条件不满足时，会把具体问题发给模型修改一次；还不满足就重新生成（最多 3 版），保留最符合题意的一版。
- 题目里写明的方程、不等式组、平行四边形的顶点，模型没画对时由程序直接按题目补画。
- 核对只针对题目文字里明确写出的条件，“全部满足”不代表图形一定完美。

### 手机拍照
运行 \`npm run lan\`，手机连同一个 Wi-Fi，打开终端里显示的“手机访问”地址即可直接拍照上传。打包成手机 App 后，在右上角的“设置”里填写这个地址。

### 模型在哪里运行
右上角“设置”里可以选：**连接服务**（模型在电脑上运行，默认）或 **本机**（模型在这台设备上运行；在电脑浏览器里会直接调用 Ollama，打包成手机 App 后使用手机上的模型）。

### 换模型
右上角可以切换已下载的模型。电脑内存较大时可以换更大的模型（如 \`qwen3.5:9b\`），作图更准确，但速度会慢一些。`;

const SYNTAX = `每行一条命令，格式和 GeoGebra 类似。

- **点**：\`A = (2, 3)\`、\`M = Midpoint(A, B)\`、\`H = Foot(P, Line(A, B))\`、\`P = Intersect(a, b, 1)\`、\`P = Point(c, (1, 2))\`（可拖动的动点）
- **线**：\`Segment(A, B)\`、\`Line(A, B)\`、\`Ray(A, B)\`、\`Vector(A, B)\`、\`Perpendicular(P, l)\`、\`Parallel(P, l)\`、\`l: y = 2x + 1\`
- **圆与曲线**：\`c = Circle(O, 2)\`、\`Arc(O, A, B)\`、\`f(x) = x^2 - 2x\`、\`g(x) = Function(x^2, 0, 2)\`、\`E: x^2/4 + y^2/3 = 1\`
- **函数的关键点**（由程序计算）：\`Root(f, 1)\` 第 1 个零点、\`Extremum(f, 1)\` 第 1 个极值点、\`Vertex(f)\` 抛物线顶点、\`Intersect(f, xAxis, 1)\` 与 x 轴的交点
- **二元函数**：\`f(x, y) = 2x + y\`，可以代入点求值 \`f(B)\`（例如线性规划的目标函数）
- **多边形**：\`Polygon(A, B, C)\`
- **标注**：\`Angle(B, A, C) "α"\`、\`Text("AB = {Distance(A, B)}", (1, 3))\`、\`Brace(A, B, "360 千米")\`
- **表格**（概率、统计题）：\`Table(标题)\` 开始一个表格，\`Row(性别, 近视, 不近视)\` 每行一条（第一行是表头，文字不用加引号），\`Row(男生, 0.6*0.3, 0.6*0.7)\` 数值由程序计算，写了除号的显示成分数（如 \`1/8\`），含滑块参数时跟着变化
- **参数**：\`a = Slider(-2, 4, 1)\`（最小值、最大值、初始值），右侧的播放按钮可以生成动画
- **视图**：\`ShowAxes(false)\`、\`ZoomIn(xmin, ymin, xmax, ymax)\`
- **立体**：\`A = (1, 0, 2)\`、\`Sphere(O, r)\`、\`Cylinder(A, B, r)\`、\`Cone(A, B, r)\`
- **标记**（写在行尾）：\`#aux\` 辅助线、\`#hl\` 重点、\`#result\` 结论、\`#eq1\` \`#eq2\` 等长记号、\`#open\` 空心点、\`#fixed\` 不可拖动、\`#hidden\` 只计算不显示

\`{ }\` 里的表达式会实时计算，例如 \`Text("面积 = {Area(Polygon(A, B, C))}", (0, 5))\`。`;

function openHelp(kind) {
  $('helpTitle').textContent = kind === 'syntax' ? '作图命令说明' : '使用说明';
  $('helpBody').innerHTML = renderMarkdown(kind === 'syntax' ? SYNTAX : HELP).replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  $('helpDialog').showModal();
}

init();
