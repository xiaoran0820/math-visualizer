// 识别质量：不只看字数，还要能发现“公式中间断掉”和“整题被译成中文”。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ocrQuality, ocrScore, pickBetterOcr, ocrRetryHintFor, OCR_RETRY_HINT, ocrLangFor, ocrLangOf, bodyRepeats, dropOcrPreamble, dedupeOcr } from '../public/lib/prompts.js';

const JP = '1. 関数 $f(x)=x^2-2x$ について，次の問いに答えよ。\n(1) $f(x)$ の最小値を求めよ。\n(2) $y=f(x)$ のグラフと直線 $y=k$ の共有点の個数を調べよ。';

// 和 meidai-2025-1 / hokudai-2025-1 一样：整题译成中文，假名比例 0%。
const TRANSLATED = '已知函数 $f(x)=x^2-2x$，求它的最小值。\n(1) 求函数的单调区间。\n(2) 若直线 $y=k$ 与图像有两个交点，求 $k$ 的取值范围。\n(3) 求函数在区间 $[0,3]$ 上的最大值和最小值。\n(4) 讨论方程 $f(x)=m$ 的实根个数，并说明理由。\n(5) 求曲线在点 $(1, -1)$ 处的切线方程。';

test('正常的日文题：不重试，也不会被判成翻译', () => {
  const q = ocrQuality(JP, { lang: 'ja' });
  assert.equal(q.tooLittle, false);
  assert.equal(q.incomplete, false);
  assert.equal(q.likelyTranslated, false);
  assert.equal(q.needsRetry, false);
  assert.ok(q.kanaRatio > 0.1, `kanaRatio=${q.kanaRatio}`);
  assert.equal(q.latexBalanced, true);
});

test('整题译成中文：日文模式下能发现；自动/中文模式不误报', () => {
  const ja = ocrQuality(TRANSLATED, { lang: 'ja' });
  assert.ok(ja.chars >= 120);
  assert.equal(ja.kanaRatio, 0);
  assert.equal(ja.likelyTranslated, true);
  assert.deepEqual(ja.reasons, ['translated']);
  assert.equal(ocrQuality(TRANSLATED, { lang: 'auto' }).likelyTranslated, false);
  assert.equal(ocrQuality(TRANSLATED, { lang: 'zh' }).needsRetry, false);
  assert.ok(ocrScore(TRANSLATED, { lang: 'ja' }) < ocrScore(JP, { lang: 'ja' }));
  assert.match(ocrRetryHintFor(ja.reasons), /不要翻译/);
});

test('公式中间断掉、$ 不配对：算不完整，要重试', () => {
  const cut = '1. 関数 $f(x)=x^2-2x$ について，\n$$y = \\frac{1}{2}x + ';
  const q = ocrQuality(cut, { lang: 'ja' });
  assert.equal(q.incomplete, true);
  assert.ok(q.reasons.includes('truncated'));
  assert.match(ocrRetryHintFor(q.reasons), /中间断了/);

  const odd = ocrQuality('求下列各式中 $x$ 的值，已知 $y=1', { lang: 'zh' });
  assert.equal(odd.latexBalanced, false);
  assert.equal(odd.incomplete, true);
  assert.ok(odd.reasons.includes('truncated'));
});

test('$ 和花括号配对、结尾正常时不算断掉', () => {
  const ok = '求 $x$ 的值，并说明 $\\frac{a_{n+1}}{b_n}$ 的含义。';
  const q = ocrQuality(ok, { lang: 'zh' });
  assert.equal(q.latexBalanced, true);
  assert.equal(q.incomplete, false);
  assert.equal(q.needsRetry, false);
});

test('两遍识别选质量更好的，而不是更长的', () => {
  const good = '求 $x$ 的值，并说明 $\\frac{a_{n+1}}{b_n}$ 的含义。';
  const bad = `${'求 $x$ 的值，$y=1\n'.repeat(20)}`;
  assert.equal(ocrQuality(bad, { lang: 'zh' }).repetitive, true);
  assert.match(ocrRetryHintFor(['repetitive']), /重复/);
  assert.equal(pickBetterOcr(good, bad, { lang: 'zh' }), true);
  assert.equal(pickBetterOcr(bad, good, { lang: 'zh' }), false);
  assert.equal(pickBetterOcr('', good), false);
  assert.equal(pickBetterOcr(good, ''), true);
});

test('【图形】太长算跑偏；正文提到图形却没有描述时给出提醒', () => {
  const longFigure = `求 $x$ 的值。\n\n【图形】\n${'- 点 A 在上方，点 B 在下方，线段 AB 是虚线\n'.repeat(12)}`;
  assert.equal(ocrQuality(longFigure).figureRunaway, true);

  const missing = ocrQuality('如图，在 $\\triangle ABC$ 中，$AB=AC=5$，求 $BC$ 的长。', { lang: 'zh' });
  assert.equal(missing.bodyMentionsFigure, true);
  assert.equal(missing.hasFigure, false);
  assert.equal(missing.figureMissing, true);

  const withFigure = ocrQuality('如图，在 $\\triangle ABC$ 中。\n\n【图形】\n点 A 在上方，B、C 在下方。', { lang: 'zh' });
  assert.equal(withFigure.hasFigure, true);
  assert.equal(withFigure.figureMissing, false);
});

test('重试提示按问题类型拼接，用户自己的说明放最后', () => {
  const hint = ocrRetryHintFor(['translated', 'truncated'], '只识别第 2 题');
  assert.match(hint, /不要翻译/);
  assert.match(hint, /中间断了/);
  assert.ok(hint.endsWith('\n只识别第 2 题'));
  assert.equal(ocrRetryHintFor(['too-little']), OCR_RETRY_HINT);
  assert.equal(ocrRetryHintFor([]), '');
});

// 2026-11-15：旧规则看到“図”“グラフ”“图”就提醒缺图，131 份真实识别结果里提醒了 8 份。
// 下面的句子都是自己编的，不是过去问原文。
test('提到图形：只认指向已有图表的说法；要学生自己画的、文字定义的区域都不算', () => {
  for (const s of ['下の図のように、三角形 ABC がある。', '図1 の四角形 ABCD において、', '右図の立体の体積を求めよ。', '如图，在 $\\triangle ABC$ 中，求 $BC$。', '如下表所示，求平均数。', '根据下图回答问题。'])
    assert.equal(ocrQuality(s).bodyMentionsFigure, true, s);
  for (const s of ['不等式 $x^2+y^2 \\le 1$ の表す領域を図示せよ。', '関数 $y=x^2-2x$ のグラフをかけ。', '2 曲線で囲まれた図形の面積を求めよ。', '根据图片内容，以下是题目：求 $x$ 的值。', '画出函数 $y=x^2$ 的图像，并求最小值。'])
    assert.equal(ocrQuality(s).figureMissing, false, s);
  assert.equal(ocrQuality(JP, { lang: 'ja' }).figureMissing, false); // “のグラフと直線”说的是函数的图像，原题没有图
});

test('整行重复：识别后的判断和边识别边停用同一个门槛（12 字以上的行）', () => {
  const short = '次の問いに答えよ。\n' + 'ただしaは実数。\n'.repeat(3); // 8 字的行
  assert.equal(bodyRepeats(short), false);
  assert.equal(ocrQuality(short, { lang: 'ja' }).repetitive, false);
  const long = '次の問いに答えよ。\n' + 'ただし a, b は正の実数とする。\n'.repeat(3);
  assert.equal(bodyRepeats(long), true);
  assert.equal(ocrQuality(long, { lang: 'ja' }).repetitive, true);
});

test('题目语言：“自动”按上一道题判断，上一道是日文题时也能查出被翻译', () => {
  assert.equal(ocrLangFor('ja', ''), 'ja');
  assert.equal(ocrLangFor('zh', 'ja'), 'zh');
  assert.equal(ocrLangFor('auto', ''), 'auto');
  assert.equal(ocrLangFor('auto', 'ja'), 'ja');
  assert.equal(ocrLangFor('auto', 'zh'), 'auto');
  assert.equal(ocrQuality(TRANSLATED, { lang: ocrLangFor('auto', 'ja') }).likelyTranslated, true);
  assert.equal(ocrQuality(TRANSLATED, { lang: ocrLangFor('auto', '') }).likelyTranslated, false);
  // 记下这道题的语言：日文题 → ja；一个假名都没有 → zh；字太少不改
  assert.equal(ocrLangOf(ocrQuality(JP), ''), 'ja');
  assert.equal(ocrLangOf(ocrQuality(TRANSLATED), 'ja'), 'zh');
  assert.equal(ocrLangOf(ocrQuality('求 x'), 'ja'), 'ja');
});

// 2026-11-15：手机原 2B 的 131 份过去问识别结果里有 4 份开头带开场白。下面的句子都是自己编的。
test('去掉识别结果开头的开场白；题目自己的话不动', () => {
  assert.equal(dropOcrPreamble('根据图片内容，以下是识别出的数学题：\n1. 次の問いに答えよ。'), '1. 次の問いに答えよ。');
  assert.equal(dropOcrPreamble('以下是题目：求 $x$ 的值。'), '求 $x$ 的值。');
  assert.equal(dropOcrPreamble('好的，这是图片中题目的转写：\n已知 $a>0$。'), '已知 $a>0$。');
  for (const s of ['根据图中信息，回答下列问题：\n(1) 求 $x$。', '以下是某班学生的成绩：\n85、90、78。', '以下の問いに答えよ：(1) $x$ を求めよ。', '识别下列图形：三角形、正方形。', '以下是题目：'])
    assert.equal(dropOcrPreamble(s), s, s);
  // 先去开场白再去重：整段抄两遍、开场白只在最前面出现一次时，也能认出是重复
  const body = '已知函数 $f(x)=x^2-2x$，求它的最小值。';
  const twice = `以下是题目：\n${body}\n\n${body}`;
  assert.equal(dedupeOcr(dropOcrPreamble(twice)), body);
  assert.notEqual(dedupeOcr(twice), body);
});
