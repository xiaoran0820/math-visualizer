// 图形标签：点名 A1 → A₁、A' → A′；含 $...$ 的标签用 KaTeX 渲染。
import { esc, renderInline } from './markdown.js';

const CJK = /[㐀-鿿＀-￯]/;

export function nameHtml(name) {
  let base = String(name);
  let primes = '';
  const pm = /'+$/.exec(base);
  if (pm) { primes = '′'.repeat(pm[0].length); base = base.slice(0, -pm[0].length); }
  let m = /^([A-Za-zͰ-Ͽ]+?)_?(\d+)$/.exec(base);
  if (m) return `${esc(m[1])}<sub>${m[2]}</sub>${primes}`;
  m = /^([A-Za-zͰ-Ͽ]+)_([A-Za-z0-9]+)$/.exec(base);
  if (m) return `${esc(m[1])}<sub>${esc(m[2])}</sub>${primes}`;
  return esc(base) + primes;
}

// 返回 { html, cls }，cls 用于区分“数学字母”（斜体衬线）和中文标签
export function labelHtml(text) {
  let s = String(text ?? '');
  if ((s.match(/\$/g) || []).length % 2 === 1) s = s.replace(/\$/g, ''); // 不成对的 $ 直接去掉
  if (!s) return { html: '', cls: 'jxg-label' };
  if (s.includes('$') || s.includes('\\(')) return { html: renderInline(s), cls: 'jxg-label' };
  if (/^[A-Za-zͰ-Ͽ]{1,2}('*|_?\d{1,2}'*)$/.test(s)) return { html: nameHtml(s), cls: 'jxg-label math-name' };
  return { html: renderInline(s), cls: CJK.test(s) ? 'jxg-label cjk' : 'jxg-label' };
}

// SVG 文本（3D 视图用）：返回 <tspan> 片段
export function nameSvg(name) {
  let base = String(name);
  let primes = '';
  const pm = /'+$/.exec(base);
  if (pm) { primes = '′'.repeat(pm[0].length); base = base.slice(0, -pm[0].length); }
  const m = /^([A-Za-zͰ-Ͽ]+?)_?(\d+)$/.exec(base) || /^([A-Za-zͰ-Ͽ]+)_([A-Za-z0-9]+)$/.exec(base);
  if (m) return `${esc(m[1])}<tspan class="sub" dy="4" font-size="0.72em">${esc(m[2])}</tspan>${primes ? `<tspan dy="-4">${primes}</tspan>` : ''}`;
  return esc(base) + primes;
}
