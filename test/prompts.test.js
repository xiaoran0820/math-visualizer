import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrBody, tooLittleText, ocrUserText, OCR_RETRY_HINT, ocrRetryHint, dedupeOcr, cleanModelText, figureRunsAway, dropRunawayFigure, ocrRunawayWatch, bodyRepeats } from '../public/lib/prompts.js';

test('识别结果几乎没有题目文字时要重新识别（R7-1 只识别出「【图形】没有图形。」）', () => {
  assert.equal(ocrBody('【图形】没有图形。'), '');
  assert.equal(tooLittleText('【图形】没有图形。'), true);
  assert.equal(tooLittleText(''), true);
  assert.equal(tooLittleText('【?】\n\n【图形】\n三角形 ABC'), true);
  // 正常的题目（中文、日文），带不带【图形】都不重试
  const r61 = '1. 関数$f(x)=\\sqrt{x}+\\frac{2}{\\sqrt{x}}(x>0)$に対して，$y=f(x)$のグラフを$C$とする。\n(1) $f(x)$の極値を求めよ。';
  assert.equal(tooLittleText(r61), false);
  assert.equal(tooLittleText('如图，在 $\\triangle ABC$ 中，$AB=AC=5$，$BC=6$，求 $DE$ 的长。\n\n【图形】\n等腰三角形'), false);
  assert.equal(ocrBody('求 $DE$ 的长。\n\n【图形】\nA 在上方'), '求$DE$的长。');
});

test('重新识别时，用户自己的补充说明（只识别第 2 题）放在最后', () => {
  const s = ocrUserText(ocrRetryHint('只识别第 2 题'));
  assert.ok(s.startsWith('请识别图片中的数学题。\n补充说明：上一次几乎没有识别出题目文字'), s);
  assert.ok(s.endsWith('\n只识别第 2 题'), s);
  assert.equal(ocrRetryHint(''), OCR_RETRY_HINT);
  assert.doesNotMatch(OCR_RETRY_HINT, /全部文字/);
});

test('识别结果整段抄了两遍时只留一遍；正常题目不变', () => {
  const one = '【题干】\n1. 以下の問に答えよ。\n(1) 実数 $x$ を変数とする関数 $f(x)$ が……\n(2) 関数 $f(x)=\\log x$ について……';
  assert.equal(dedupeOcr(`${one}\n\n${one}`), one);
  assert.equal(dedupeOcr(`${one}\n\n${one.slice(0, -6)}`), one); // 第二遍没写完
  const normal = '(1) 求 $f(x)$ 的单调区间。\n(2) 求 $f(x)$ 的最小值。\n(3) 求 $f(x)$ 的最小值。';
  assert.equal(dedupeOcr(normal), normal);
  assert.equal(dedupeOcr('求 $x$\n求 $x$'), '求 $x$\n求 $x$'); // 太短，不当作重复
});

test('去掉模型输出外面的代码块标记和思考标签', () => {
  assert.equal(cleanModelText('```markdown\n求 $x$ 的值。\n```'), '求 $x$ 的值。');
  assert.equal(cleanModelText('<think></think>\n题目'), '题目');
});

test('【图形】部分跑偏（同一行反复出现、或写得太长）就整段去掉，题目文字保留', () => {
  const body = '3. 媒介変数 $\\theta$ を用いて\n$$x = \\sin \\theta, \\quad y = \\cos \\theta + |\\sin \\theta|$$\nで表される曲線を $C$ とする。';
  // 2026-11-12 过去问第二组：原题没有图，【图形】下反复列同样的点
  const loop = `${body}\n\n【图形】\n${'- 点 $(0, 1)$\n- 点 $(1, 0)$\n'.repeat(3)}`;
  assert.equal(figureRunsAway(loop), true);
  assert.equal(dropRunawayFigure(loop), body);
  // 只出现两遍不算（真实的图有时会描述两遍）
  const twice = `${body}\n【图形】\n点 A 和点 B 之间有一条线段。\n【图形】\n点 A 和点 B 之间有一条线段。`;
  assert.equal(figureRunsAway(twice), false);
  assert.equal(dropRunawayFigure(twice), twice);
  // 短行（$$、(1) 之类）重复不算
  assert.equal(figureRunsAway(`${body}\n【图形】\n$$\n$$\n$$\n$$`), false);
  // 写得太长：开始解题、编造别的题（生成的评测图 test-00078）
  const long = `${body}\n【图形】\n图中有一个三角形。\n**解：**\n${'由题意，可行域的顶点可以联立方程求得，'.repeat(40)}`;
  assert.equal(figureRunsAway(long), true);
  assert.equal(dropRunawayFigure(long), body);
  // 题目文字本身再长、没有【图形】都不受影响
  const plain = `${body}\n${'(1) 曲線 $C$ の概形をかけ。\n'.repeat(5)}`;
  assert.equal(figureRunsAway(plain), false);
  assert.equal(dropRunawayFigure(plain), plain);
});

test('边识别边检查：跑偏时只停一次，之后不再检查', () => {
  let stops = 0;
  const watch = ocrRunawayWatch(() => { stops++; });
  let text = '1. 題目の本文です。\n【图形】\n';
  assert.equal(watch(text), false);
  for (let i = 0; i < 10; i++) { text += '- 点 $(0, 1)$ と点 $(1, 0)$\n'; watch(text); }
  assert.equal(stops, 1);
  assert.equal(watch(text + 'さらに続く文字列です。'.repeat(10)), true);
  assert.equal(stops, 1);
});

test('正文整行重复 3 次以上也能边识别边停下；短行和只重复两次不误判', () => {
  const line = '已知函数 $f(x)=x^2-2x$，求它的最小值。';
  assert.equal(bodyRepeats(`${line}\n${line}\n${line}`), true);
  assert.equal(bodyRepeats(`${line}\n${line}`), false);
  assert.equal(bodyRepeats('短行\n短行\n短行'), false);
  let stops = 0;
  const watch = ocrRunawayWatch(() => { stops++; });
  let text = '1. 题目开头。\n';
  for (let i = 0; i < 4; i++) { text += `${line}\n`; watch(text); }
  assert.equal(stops, 1);
});
