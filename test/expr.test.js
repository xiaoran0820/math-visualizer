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
