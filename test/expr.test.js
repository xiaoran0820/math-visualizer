// 表达式解析：运算优先级、省略括号/乘号的写法，以及“实际解析结果”的显示
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from '../public/lib/scene.js';
import { parseExpression, toLatex } from '../public/lib/expr.js';

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);
// 用作图引擎求值：f(x) = 表达式
const fn = (expr) => {
  const s = buildScene([`f(x) = ${expr}`]);
  assert.deepEqual(s.errors, [], expr);
  return s.values.f.f;
};
const tex = (expr) => {
  const s = buildScene([`f(x) = ${expr}`]);
  return s.objects[0].tex;
};

test('-x^2 是 -(x^2)，(-x)^2 是 x^2', () => {
  close(fn('-x^2')(3), -9);
  close(fn('(-x)^2')(3), 9);
  assert.equal(parseExpression('-x^2').ast.type, 'neg');
});

test('连续乘方右结合：2^3^2 = 2^(3^2) = 512', () => {
  close(fn('2^3^2')(0), 512);
});

test('省略括号的函数：sin 2x = sin(2x)，sin x cos x = sin(x)·cos(x)', () => {
  close(fn('sin 2x')(0.3), Math.sin(0.6));
  close(fn('sin x cos x')(0.3), Math.sin(0.3) * Math.cos(0.3));
  close(fn('2sin x')(0.3), 2 * Math.sin(0.3));
  close(fn('sin x^2')(1.5), Math.sin(2.25));
  assert.equal(tex('sin 2x'), 'f(x) = \\sin\\left(2x\\right)');
});

test('1/2x 按 (1/2)x 理解，并在解析结果中清楚显示', () => {
  close(fn('1/2x')(4), 2);
  close(fn('1/(2x)')(4), 0.125);
  assert.equal(tex('1/2x'), 'f(x) = \\frac{1}{2}x');
  assert.equal(tex('1/(2x)'), 'f(x) = \\frac{1}{2x}');
});

test('实数范围外没有定义：sqrt(-1)、ln(0) 得到 NaN（不画出来）', () => {
  assert.ok(Number.isNaN(fn('sqrt(x)')(-1)));
  assert.ok(!Number.isFinite(fn('ln(x)')(0)));
  close(fn('x^(1/3)')(-8), -2); // 负数的奇次方根有定义
});

test('隐式乘法与 Unicode / LaTeX 写法', () => {
  close(fn('2(x+1)(x-1)')(3), 16);
  close(fn('x²+√x')(4), 18);
  close(fn('\\frac{1}{2}x^{2}')(2), 2);
  close(fn('|x-3|')(1), 2);
  close(fn('2πx')(1), 2 * Math.PI);
});

test('比较和分段函数', () => {
  const f = fn('If(x < 0, -x, x <= 2, x^2, 4)');
  close(f(-3), 3);
  close(f(1.5), 2.25);
  close(f(5), 4);
});

test('toLatex 输出的括号与原意一致', () => {
  const t = (s) => toLatex(parseExpression(s).ast);
  assert.equal(t('(a+b)^2'), '{\\left(a + b\\right)}^{2}');
  assert.equal(t('a-(b-c)'), 'a - \\left(b - c\\right)');
  assert.equal(t('-(x+1)'), '-\\left(x + 1\\right)');
  assert.equal(t('2^-x'), '{2}^{-x}');
});

test('数或式子后面直接跟绝对值：省略的是乘号；两条竖线连写 || 只在比较式之间才是“或”', () => {
  close(fn('1 - 2/pi |pi/2 - x|')(0.5), 1 - (2 / Math.PI) * Math.abs(Math.PI / 2 - 0.5)); // 2026-11-12 过去问第二组神户 2026 后期第 4 题的写法
  close(fn('x|x|')(-2), -4);
  close(fn('3|x - 1| + |x + 1|')(0), 4);
  close(fn('|x| |x - 2|')(1), 1);
  close(fn('(2|x|)')(-1.5), 3);
  // 嵌套的绝对值：开头、里面、前面有系数
  close(fn('||x| - 1|')(-3), 2);
  close(fn('|x - |x - 2||')(0), 2);
  close(fn('2||x| - 3| + 1')(1), 5);
  // “或”照常
  const s = buildScene(['a = 1', 'b = 0', 'c = If(a > 0 || b > 0, 1, 2)', 'd = If((a < 0) || (b > 0), 1, 2)', 'e = If(a > 1 + 2 || b < 1, 1, 2)']);
  assert.deepEqual(s.errors, []);
  assert.equal(s.values.c, 1);
  assert.equal(s.values.d, 2);
  assert.equal(s.values.e, 1);
});

test('积分定义的函数：被积函数可以直接写式子，积分变量可以是 x、u、t（2026-11-13 第二组开发集）', () => {
  // 以前 F(x) = Integral(f, 0, x) 被误当成点的简写，画成了方程曲线；F(t) = … 报“没定义 t”
  const s = buildScene(['f(x) = abs(cos(x))', 'F(x) = Integral(f, 0, x)', 'G(t) = Integral(f, 0, t)', 'H(t) = Integral(abs(cos(x)), 0, t)']);
  assert.deepEqual(s.errors, []);
  for (const n of ['F', 'G', 'H']) { assert.equal(s.values[n].T, 'function', n); close(s.values[n].f(Math.PI), 2, 1e-6); }
  close(fn('Integral(abs(cos(x)), 0, x)')(Math.PI), 2, 1e-6); // 被积式里的 x 是积分变量
  close(fn('Integral(1/(1 + u^2), -x, x)/2')(1), Math.PI / 4, 1e-6);
  close(fn('Integral(sin(x - t) - t/4, 0, x)')(1), 1 - Math.cos(1) - 1 / 8, 1e-6);
  // 不带自变量时还是一块积分面积
  const a = buildScene(['S = Integral(x^2, 0, 1)', 'T = IntegralBetween(x, x^2, 0, 1)']);
  assert.deepEqual(a.errors, []);
  assert.equal(a.values.S.T, 'integral');
  close(a.values.S.value, 1 / 3, 1e-6);
  close(a.values.T.value, 1 / 6, 1e-6);
  // 点的简写 A(2, 3) 照常
  const b = buildScene(['A(2, 3)']);
  assert.deepEqual(b.errors, []);
  assert.equal(b.values.A.x, 2);
});
