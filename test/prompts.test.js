import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrBody, tooLittleText, ocrUserText, OCR_RETRY_HINT, ocrRetryHint, dedupeOcr, cleanModelText } from '../public/lib/prompts.js';

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
