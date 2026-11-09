// 极简 Markdown + KaTeX 渲染。所有普通文本都会先转义，模型输出不会被当作 HTML 执行。

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const cache = new Map();
function katexHtml(tex, display) {
  const key = (display ? 'D' : 'I') + tex;
  if (cache.has(key)) return cache.get(key);
  let html;
  const k = globalThis.katex;
  if (!k) html = `<code>${esc(tex)}</code>`;
  else {
    try {
      html = k.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' });
    } catch {
      html = `<code>${esc(tex)}</code>`;
    }
  }
  if (cache.size > 800) cache.clear();
  cache.set(key, html);
  return html;
}

// 把文本切成 [普通文本, 公式] 片段；支持 $$..$$、$..$、\[..\]、\(..\)
function splitMath(src) {
  const parts = [];
  let i = 0, buf = '';
  const push = (tex, display) => { if (buf) parts.push({ text: buf }); buf = ''; parts.push({ tex, display }); };
  while (i < src.length) {
    if (src.startsWith('$$', i)) {
      const j = src.indexOf('$$', i + 2);
      if (j > i) { push(src.slice(i + 2, j), true); i = j + 2; continue; }
    }
    if (src.startsWith('\\[', i)) {
      const j = src.indexOf('\\]', i + 2);
      if (j > i) { push(src.slice(i + 2, j), true); i = j + 2; continue; }
    }
    if (src.startsWith('\\(', i)) {
      const j = src.indexOf('\\)', i + 2);
      if (j > i) { push(src.slice(i + 2, j), false); i = j + 2; continue; }
    }
    if (src[i] === '$' && src[i - 1] !== '\\') {
      const j = src.indexOf('$', i + 1);
      if (j > i + 1 && !src.slice(i + 1, j).includes('\n\n')) { push(src.slice(i + 1, j), false); i = j + 1; continue; }
    }
    buf += src[i++];
  }
  if (buf) parts.push({ text: buf });
  return parts;
}

function inlineFormat(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/【([^】]{1,12})】/g, '<span class="tag-mark">【$1】</span>');
}

// 行内渲染：公式 + 加粗，不处理段落
export function renderInline(src) {
  return splitMath(String(src ?? ''))
    .map((p) => (p.tex !== undefined ? katexHtml(p.tex, p.display) : inlineFormat(p.text)))
    .join('');
}

// 段落级渲染
export function renderMarkdown(src) {
  src = String(src ?? '').replace(/\r\n/g, '\n');
  // 先把公式替换为占位符，避免公式里的 * _ 等被当成 Markdown
  const math = [];
  const holder = splitMath(src)
    .map((p) => {
      if (p.tex === undefined) return p.text;
      math.push(katexHtml(p.tex, p.display));
      return `\u0000${math.length - 1}\u0000`;
    })
    .join('');
  const restore = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, n) => math[+n]);
  const lines = holder.split('\n');
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map((l) => restore(inlineFormat(l))).join('<br>')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const start = list.type === 'ol' && list.start > 1 ? ` start="${list.start}"` : '';
      out.push(`<${list.type}${start}>${list.items.map((it) => `<li>${restore(inlineFormat(it))}</li>`).join('')}</${list.type}>`);
    }
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ol = /^\s*(\d+)[.、)]\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const h = /^\s*#{1,4}\s+(.*)$/.exec(line);
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (h) { flushPara(); flushList(); out.push(`<h4>${restore(inlineFormat(h[1]))}</h4>`); continue; }
    if (ol || ul) {
      flushPara();
      const type = ol ? 'ol' : 'ul';
      if (!list || list.type !== type) { flushList(); list = { type, items: [], start: ol ? Number(ol[1]) : 1 }; }
      list.items.push(ol ? ol[2] : ul[1]);
      continue;
    }
    if (list) { list.items[list.items.length - 1] += `\n${line.trim()}`; continue; }
    para.push(line);
  }
  flushPara();
  flushList();
  return out.join('');
}
