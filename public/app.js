import { buildScene } from './lib/scene.js';
import { render2d } from './lib/render2d.js';
import { render3d } from './lib/render3d.js';
import { renderMarkdown, renderInline, esc } from './lib/markdown.js';
import { parsePartialJSON, PARTIAL } from './lib/partial-json.js';
import { ImageEditor } from './lib/image.js';
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
  run: null,
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
};

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
  $('stopBtn').addEventListener('click', cancelRun);
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
  $('solveBtn').addEventListener('click', solve);
  $('modelSelect').addEventListener('change', (e) => { app.model = e.target.value; store.set('model', app.model); });

  setMode(store.get('mode', 'photo'));
  checkHealth();
  setInterval(() => { if (!app.health?.connected) checkHealth(); }, 15000);

  let lastW = window.innerWidth;
  window.addEventListener('resize', debounce(() => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    if (app.commands.length) drawFigure(app.commands);
  }, 250));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (app.commands.length) drawFigure(app.commands); });
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
async function checkHealth() {
  let h;
  try {
    h = await fetch('/api/health').then((r) => r.json());
  } catch {
    h = { connected: false, models: [], error: '无法连接到本项目的服务端，请确认 npm start 正在运行。' };
  }
  app.health = h;
  const sel = $('modelSelect');
  const dot = $('modelDot');
  const banner = $('banner');
  if (!h.connected) {
    dot.className = 'dot bad';
    sel.innerHTML = '<option>未连接本地模型</option>';
    sel.disabled = true;
    banner.innerHTML = `<b>还没有连接到本地模型。</b>${esc(h.error || '')} 在此之前，可以先点击左侧的示例题查看可视化效果。 <a href="#" id="bannerHelp">查看安装步骤</a>`;
    banner.hidden = false;
    $('bannerHelp')?.addEventListener('click', (e) => { e.preventDefault(); openHelp('help'); });
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

function cancelRun() {
  if (app.run) app.run.ac.abort();
}

function setRunning(on) {
  $('runBtn').disabled = on;
  $('stopBtn').hidden = !on;
  $('reanalyzeBtn').disabled = on;
}

async function start({ image = null, text = '', hint = '', skipOcr = false }) {
  cancelRun();
  resetResults();
  app.source = 'model';
  app.example = null;
  markExample(null);
  app.image = image;
  app.hint = hint;
  const ac = new AbortController();
  app.run = { ac };
  setRunning(true);
  const needOcr = !!image && !skipOcr;
  $('empty').hidden = true;
  $('progress').hidden = false;
  setStep('ocr', needOcr ? 'wait' : 'skip');
  setStep('analyze', 'wait');
  setStep('repair', 'skip');
  if (window.innerWidth < 900) $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  let failed = 'ocr';
  try {
    let problem = text;
    if (needOcr) problem = await recognize(image, hint, ac.signal);
    else showProblem(problem);
    app.problem = problem;
    failed = 'analyze';
    await analyze(problem, image, hint, ac.signal);
  } catch (e) {
    if (ac.signal.aborted) {
      setStep(failed, 'error', '已停止');
    } else {
      setStep(failed, 'error', '失败');
      showError(e);
    }
  } finally {
    setRunning(false);
    if (app.run?.ac === ac) app.run = null;
  }
}

function setStep(name, status, meta = '') {
  const el = document.querySelector(`.step[data-step="${name}"]`);
  if (!el) return;
  el.className = `step ${status === 'wait' ? '' : status}`;
  el.querySelector('.meta').textContent = meta;
}

function ticker(step) {
  const t0 = performance.now();
  let extra = '';
  const id = setInterval(() => setStep(step, 'active', `${((performance.now() - t0) / 1000).toFixed(1)} 秒${extra}`), 200);
  return {
    note(s) { extra = s ? ` · ${s}` : ''; },
    stop() { clearInterval(id); return (performance.now() - t0) / 1000; },
  };
}

async function streamPost(url, body, signal, onEvent) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new Error('无法连接到本项目的服务端，请确认 npm start 正在运行。');
  }
  if (!res.ok) {
    let msg = `请求失败（${res.status}）`;
    try { msg = (await res.json()).error || msg; } catch { /* 忽略 */ }
    throw new Error(msg);
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
  if (err) { const e = new Error(err.message); e.code = err.code; throw e; }
}

async function recognize(image, hint, signal) {
  const tk = ticker('ocr');
  let text = '';
  showProblem('', true);
  const render = throttle(() => showProblem(text, true), 120);
  try {
    await streamPost('/api/recognize', { image, hint, model: app.model }, signal, (ev) => {
      if (ev.t === 'delta') { text += ev.v; tk.note(`${text.length} 字`); render(); }
    });
  } finally {
    render.cancel();
  }
  const secs = tk.stop();
  text = cleanText(text);
  if (!text) throw new Error('没有识别出题目内容。可以换一张更清晰的照片，或在图上框选题目区域后重试。');
  showProblem(text);
  setStep('ocr', 'done', `${secs.toFixed(1)} 秒`);
  return text;
}

function cleanText(t) {
  return String(t).replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').replace(/<\/?think>/g, '').trim();
}

async function analyze(problem, image, hint, signal) {
  const tk = ticker('analyze');
  let buf = '';
  let shownCount = -1;
  let stats = null;
  const live = throttle(() => {
    const a = parsePartialJSON(buf);
    if (!a || typeof a !== 'object') return;
    applyAnalysis(a, false);
    const cmds = completeCommands(a.commands);
    if (cmds.length !== shownCount && cmds.length) {
      shownCount = cmds.length;
      tk.note(`已生成 ${cmds.length} 条作图命令`);
      drawFigure(cmds, { live: true });
    }
  }, 350);
  try {
    await streamPost('/api/analyze', { text: problem, image, hint, model: app.model }, signal, (ev) => {
      if (ev.t === 'delta') { buf += ev.v; live(); }
      if (ev.t === 'done') stats = ev.stats;
    });
  } finally {
    live.cancel();
  }
  const secs = tk.stop();
  let a = null;
  try { a = JSON.parse(buf); } catch { a = parsePartialJSON(buf); }
  if (!a || !Array.isArray(a.commands)) throw new Error('本地模型没有返回有效的分析结果，请重试，或换一个更大的模型。');
  a.commands = a.commands.map(String).filter((c) => c.trim());
  app.analysis = a;
  applyAnalysis(a, true);
  const speed = stats?.tokensPerSecond ? ` · ${Math.round(stats.tokensPerSecond)} 字元/秒` : '';
  setStep('analyze', 'done', `${secs.toFixed(1)} 秒${speed}`);
  if (app.scene?.errors?.length) await repair(problem, a.commands, app.scene.errors, signal);
}

// 小模型偶尔会写错命令：把错误信息发回模型，自动修正一次
async function repair(problem, commands, errors, signal) {
  const tk = ticker('repair');
  let buf = '';
  try {
    await streamPost('/api/repair', {
      text: problem, commands, model: app.model,
      errors: errors.map((e) => ({ line: e.line, src: e.src, message: e.message })),
    }, signal, (ev) => { if (ev.t === 'delta') buf += ev.v; });
  } catch (e) {
    tk.stop();
    if (signal.aborted) throw e;
    setStep('repair', 'error', '修正失败');
    return;
  }
  const secs = tk.stop();
  let fixed = null;
  try { fixed = JSON.parse(buf).commands; } catch { fixed = parsePartialJSON(buf)?.commands; }
  fixed = Array.isArray(fixed) ? fixed.map(String).map((c) => c.replace(/^\s*\d+[.、)]\s*/, '').trim()).filter(Boolean) : [];
  const before = { errors: errors.length, objects: app.scene.objects.length };
  const trial = fixed.length ? buildScene(fixed, {}) : null;
  const better = trial && (trial.objects.length > before.objects || (trial.objects.length === before.objects && trial.errors.length < before.errors));
  if (!better) {
    setStep('repair', 'error', `${secs.toFixed(1)} 秒 · 未能修正，可在“作图命令”里手动修改`);
    return;
  }
  app.analysis.commands = fixed;
  drawFigure(fixed);
  const left = app.scene.errors.length;
  setStep('repair', left ? 'error' : 'done', `${secs.toFixed(1)} 秒 · ${left ? `还有 ${left} 处错误` : '已修正'}`);
}

function completeCommands(cmds) {
  if (!Array.isArray(cmds)) return [];
  const list = cmds[PARTIAL] ? cmds.slice(0, -1) : cmds.slice();
  return list.map(String).filter((c) => c.trim());
}

// ====================== 结果展示 ======================
function resetResults() {
  stopPlayers();
  app.view?.destroy();
  app.view = null;
  app.scene = null;
  app.analysis = null;
  app.commands = [];
  for (const k of Object.keys(app.sceneState)) delete app.sceneState[k];
  ['problemCard', 'figureCard', 'analysisCard', 'commandsCard', 'solutionCard', 'errorBox'].forEach((id) => { $(id).hidden = true; });
  $('figure').innerHTML = '';
  $('sliders').innerHTML = '';
  $('figTools').innerHTML = '';
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
  const drawable = scene.objects.filter((o) => !['number', 'boolean', 'string'].includes(o.kind) && !o.tags.has('hidden'));
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
  const hasDrag = scene.objects.some((o) => (o.role === 'free' || o.role === 'glider') && !o.tags.has('fixed') && !o.tags.has('hidden'));
  $('figTip').textContent = scene.mode === '3d'
    ? '按住拖动可以旋转，滚轮缩放，双击回到默认视角。'
    : `${hasDrag ? '蓝色的点可以拖动；' : ''}滚轮缩放，按住空白处拖动可以平移。`;
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
      app.view?.update();
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
    app.view?.update();
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
  cancelRun();
  resetResults();
  app.source = 'example';
  app.example = ex;
  app.image = null;
  app.problem = ex.problem;
  markExample(ex.id);
  $('empty').hidden = true;
  $('progress').hidden = true;
  showProblem(ex.problem);
  applyAnalysis(JSON.parse(JSON.stringify(ex.analysis)), true);
  if (window.innerWidth < 900) $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ====================== 解题思路 ======================
async function solve() {
  const out = $('solution');
  const btn = $('solveBtn');
  if (app.source === 'example' && app.example?.solution) {
    out.innerHTML = renderMarkdown(app.example.solution);
    btn.disabled = true;
    return;
  }
  if (!app.health?.connected) { showError(Object.assign(new Error('还没有连接到本地模型，无法生成解题思路。'), { code: 'unreachable' })); return; }
  btn.disabled = true;
  btn.textContent = '生成中…';
  const think = $('thinking');
  let text = '', thoughts = '';
  out.innerHTML = '';
  const ac = new AbortController();
  const render = throttle(() => { out.innerHTML = renderMarkdown(text); }, 150);
  try {
    await streamPost('/api/solve', { text: app.problem, commands: app.commands, model: app.model }, ac.signal, (ev) => {
      if (ev.t === 'think') {
        thoughts += ev.v;
        think.hidden = false;
        think.textContent = thoughts.slice(-1200);
        think.scrollTop = think.scrollHeight;
      }
      if (ev.t === 'delta') { think.hidden = true; text += ev.v; render(); }
    });
    render.flush();
    think.hidden = true;
    out.innerHTML = renderMarkdown(cleanText(text)) + '<p class="muted" style="font-size:12px;margin-top:10px">由本地模型生成，仅供参考，请注意核对。</p>';
    btn.textContent = '重新生成';
  } catch (e) {
    showError(e);
    btn.textContent = '生成解题思路';
  } finally {
    btn.disabled = false;
  }
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

### 手机拍照
运行 \`npm run lan\`，手机连同一个 Wi-Fi，打开终端里显示的“手机访问”地址即可直接拍照上传。

### 换模型
右上角可以切换已下载的模型。电脑内存较大时可以换更大的模型（如 \`qwen3.5:9b\`），作图更准确，但速度会慢一些。`;

const SYNTAX = `每行一条命令，格式和 GeoGebra 类似。

- **点**：\`A = (2, 3)\`、\`M = Midpoint(A, B)\`、\`H = Foot(P, Line(A, B))\`、\`P = Intersect(a, b, 1)\`、\`P = Point(c, (1, 2))\`（可拖动的动点）
- **线**：\`Segment(A, B)\`、\`Line(A, B)\`、\`Ray(A, B)\`、\`Vector(A, B)\`、\`Perpendicular(P, l)\`、\`Parallel(P, l)\`、\`l: y = 2x + 1\`
- **圆与曲线**：\`c = Circle(O, 2)\`、\`Arc(O, A, B)\`、\`f(x) = x^2 - 2x\`、\`g(x) = Function(x^2, 0, 2)\`、\`E: x^2/4 + y^2/3 = 1\`
- **多边形**：\`Polygon(A, B, C)\`
- **标注**：\`Angle(B, A, C) "α"\`、\`Text("AB = {Distance(A, B)}", (1, 3))\`、\`Brace(A, B, "360 千米")\`
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
