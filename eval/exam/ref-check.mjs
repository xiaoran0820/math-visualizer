// 过去问集检验条件的自测：给每道题写一份“画对的图”，确认能全部通过；
// 再用一份“故意画错的图”核对每道题，确认会被检出。只检查检验条件本身，不涉及模型。
//   node eval/exam/ref-check.mjs
import { EXAM } from '../exam.js';
import { buildScene } from '../../public/lib/scene.js';
import { runChecks } from '../checks.js';

const REF = {
  'todai-2024-1': ['A = (0, -1, 1)', 'O = (0, 0, 0)', 'P = (1, 1, 0)', 'Segment(O, A)', 'Segment(A, P)'],
  'todai-2024-2': ['f(x) = Function(2x atan(x) - ln(1 + x^2) + ln(2)/2 - pi x/4, 0, 1)'],
  'todai-2024-3': ['P = (2, 1)', 'Q = (-2, -1)', 'l1: y = x', 'l2: y = -x'],
  'todai-2024-4': ['f(x) = -sqrt(2)/4 x^2 + 4sqrt(2)', 't = Slider(0, 4, 1)', 'T = (t, f(t))', 'c = t^3/4 - 3t', 'C1 = (c, 0)', 'Circle(C1, T)'],
  'todai-2024-5': ['A = (1, 0, 0)', 'B = (0, 1, 0)', 'C = (0, 0, 1)', 'D = Midpoint(A, C)', 'Polygon(A, B, D)'],
  'todai-2024-6': ['Table(Row("n", 1, -3, -7), Row("f(n)", 31, 3, 7))'],
  'todai-2025-1': ['A = (0, 0)', 'B = (0, 1)', 'C = (1, 1)', 'D = (1, 0)', 'Curve(3t^2 - 2t^3, 3t(1 - t), t, 0, 1)'],
  'todai-2025-2': ['f(x) = ln(x)', 'g(x) = x - 1'],
  'todai-2025-3': [
    'B = (0, 0)', 'C = (5, 0)', 'A = (3cos(30°), 3sin(30°))', 'D = A + C - B', 'u = (cos(20°), sin(20°))', 'v = (-sin(20°), cos(20°))',
    'F = Intersect(Line(B, B + u), Line(A, A + v))', 'G = Intersect(Line(B, B + u), Line(C, C + v))',
    'H = Intersect(Line(D, D + u), Line(C, C + v))', 'E = Intersect(Line(D, D + u), Line(A, A + v))', 'Polygon(A, B, C, D)', 'Polygon(E, F, G, H)',
  ],
  'todai-2025-6': ['O = (0.5, 0)', 'Circle(O, 0.5)'],
  'todai-2026-1': ['f(x) = sin(x) - x + x^3/6'],
  'todai-2026-2': ['P1 = (1, 1)', 'P2 = (3, 1)', 'P3 = (2, 3)', 'P4 = (3, 5)'],
  'todai-2026-3': ['O = (0, 0, 0)', 'Sphere(O, 5)', 'G = (2, 0, 1)'],
  'todai-2026-4': ['k = 2', 'f(x) = x^3 - k x', 'O = (0, 0)', 'P = (1, f(1))', 'Q = (-1.2, f(-1.2))', 'Tangent(O, f)', 'Tangent(P, f)', 'Tangent(Q, f)'],
  'todai-2026-5': ['O = (0, 0)', 'Circle(O, 1)', 'A = (-3, 0)'],
  'kyodai-2025-3': ['f(x) = x^2 ln(x)', 'g(x) = x^2 ln(x) - 1/(1 + 2ln(x))'],
  'kyodai-2025-4': ['O = (0, 0, 0)', 'A = (2, 0, 0)', 'B = (0, 2, 0)', 'C = (0, 0, 2)', 'L = (1, 0, 0)', 'M = (0, 1, 0)', 'N = (0, 0, 1)', 'Polygon(L, M, N)'],
  'kyodai-2025-5': ['A = (0, 0, sqrt(2)/4)', 't = Slider(-0.7, 0.7, 0.3)', 'P = (cos(t), sin(t), cos(t)/2)', 'Line(A, P)'],
  'kyodai-2026-1': ['a = 2', 'f(x) = Function(1/(x^2 (ln(a/x))^2), 0, 1)', 'y = 3'],
  'kyodai-2026-2': ['O = (0, 0, 0)', 'A = (1, 0, 0)', 'B = (1/2, sqrt(3)/2, 0)', 'C = (1/2, sqrt(3)/6, sqrt(6)/3)', 'P = (0.4, 0, 0)', 'Sphere(P, 0.3)'],
  'kyodai-2026-4': ['A = (0, 0)', 'B = (1, 0)', 'C = (1, 1)', 'D = (0, 1)', 'Polygon(A, B, C, D)', 'Polygon((-1, 0), (2, 0), (0.5, 3sqrt(3)/2))'],
  'kyodai-2026-5': ['a = 1', 'f(x) = Function(sin(x + a), -pi/2, pi/2)', 'g(x) = Function(sin(x - a), -pi/2, pi/2)'],
  'handai-2026-1': ['f(x) = x - x^3', 'l0: y = x', 'l1: y = -2x + 2', 'P = Intersect(l0, l1)'],
  'handai-2026-2': ['O = (0, 0, 0)', 'A = (0, 0, 1)', 'B = (1, 0, 0)', 'C = (cos(60°), sin(60°), 0)', 't = 1', 'D = O + t (B - O)', 'E = O + (2t + 1)(C - O)', 'Polygon(A, D, E)'],
  'handai-2026-4': ['f(x) = e^(-x) cos(x)', 'g(x) = 1 - x'],
  'meidai-2024-1': ['f(x) = Function(sqrt(x) + 2/sqrt(x), 0, 20)'],
  'meidai-2024-3': ['A = (3, 1, 3)', 'B = (4, 2, 2)', 'C = (4, 0, 1)', 'Polygon(A, B, C)'],
  'meidai-2025-1': ['f(x) = ln((e^x + e^(-x))/2)'],
  'meidai-2025-2': ['x^2 - y^2 = 24', 'P = (5, 1)', 'Q = (7, 5)'],
  'meidai-2025-3': ['A = (1, 0)', 'r = 0.5', 'Circle(A, r)'],
  'meidai-2026-1': ['f(x) = Function(1/x, 0, 10)', 'a = 0.5', 'b = 2', 'A = (a, 1/a)', 'B = (b, 1/b)', 'O = (0, 0)', 'Segment(O, A)', 'Segment(O, B)'],
  'meidai-2026-2': ['A = (2, 1, 3)', 'a = 1', 'B = (a + 2, 3, 4)', 'C = (1, 0, 0)', 'D = (-1, 2, 1)', 'E = (-3, 1, 0)', 'Line(D, E)'],
  'meidai-2026-4': ['Region(y - x <= 1, y - x >= -1)', 'A = (0, 0)'],
  'tohokudai-2026-1': ['f(x) = x^2', 'u = 2', 'P = (u, u - 1)', 'T1 = (1, 1)', 'T2 = (3, 9)', 'Line(P, T1)', 'Line(P, T2)'],
  'tohokudai-2026-3': ['f(x) = If(abs(x) <= 1, 8x^3 - 6x^2 + 2, 3x^4 + 8x^3 - 12x^2 + 5)'],
  'tohokudai-2026-4': ['x^2 - y^2 = 16', 'A = (4, 0)', 'B = (4, 2)'],
  'tohokudai-2026-5': ['Curve(e^t cos(t), e^t sin(t), t, 0, pi/2)'],
  'tohokudai-2026-6': ['O = (0, 0, 0)', 'A = (1, 0, 0)', 'B = (0, 1, 0)', 'P = (2, 0, 0)', 'Q = (0, 2, 0)', 'C = (0, 2, 1)', 'D = (0, 2, -1)', 'Sphere((1, 1, 0), 1)'],
  'kyudai-2025-1': ['A = (1, 1, -5)', 'B = (-1, -1, 7)', 'C = (1, -1, 3)', 'Polygon(A, B, C)'],
  'kyudai-2025-2': ['f(x) = tan(x)'],
  'kyudai-2025-4': ['O = (0, 0)', 'Circle(O, 1)', 'A = (1, 0)', 'B = (cos(45°), sin(45°))', 'C = (0, 1)', 'D = (-1, 0)', 'Polygon(A, B, C, D)'],
  'kyudai-2026-1': ['O = (0, 0, 0)', 'Sphere(O, 3)', 'P = (1, 0, sqrt(3))'],
  'kyudai-2026-2': ['Segment(((sqrt(3) - 1)/2, (sqrt(3) - 1)/2), ((sqrt(3) + 1)/2, (sqrt(3) + 1)/2))'],
  'kyudai-2026-5': ['f(x) = (x + 1) ln(4(x + 1)^2 + 1) - 2(x + 1) + atan(2(x + 1)) - (x ln(4x^2 + 1) - 2x + atan(2x))'],
  'hokudai-2025-2': ['c = Circle((0, 0), 1)', 'x^2/2 + y^2/3 = 1', 'P = (sqrt(2), 0)', 'Tangent(P, c)', 'Tangent(P, c, 2)'],
  'hokudai-2025-3': ['a = 0.3', 'n = 2', 'f(x) = Function(e^(a x) sin(n x), 0, 2pi)'],
  'hokudai-2025-4': ['a = 3', 'x^2 + y^2 = 6 - a'],
  'hokudai-2026-1': ['Table(Row("n", 1, 2, 3), Row("a_n", -8, -2/7, 14/5))'],
  'hokudai-2026-2': ['f(x) = -sin(2x)/4 + sin(x)/2 + x^3/48'],
  'hokudai-2026-3': ['O = (0, 0)', 'Circle(O, 1)', 'B = (-1/2, sqrt(3)/2)'],
  'hokudai-2026-4': ['P = (1, 0, 3)', 'Q = (0, 2, 3)', 'h = 4', 'C = (0, 0, h)', 'Polygon(C, P, Q)'],
  // 不需要图的题和只有一两条检验的题：列表格、只写文字，或者画出可选的那张图
  'todai-2025-4': ['a = 2', 'f(x) = x^2 + x - a'],
  'todai-2025-5': ['Table(Row("n", 2, 3, 4), Row("排列", "12", "123", "1234"))'],
  'todai-2026-6': ['Table(Row("n", 2800), Row("f(n)", 16), Row("g(n)", 14))'],
  'kyodai-2025-1': ['O = (0, 0)', 'Circle(O, 2)'],
  'kyodai-2025-2': ['Text("N = 9z^2 = x^6 + y^4", (0, 0))'],
  'kyodai-2025-6': ['Table(Row("k", 1, 2, 3), Row("X_k", 1, 1, 0))'],
  'kyodai-2026-3': ['Text("(x + 1)^(2^(n+1)) - (x^2 + 1)^(2^n)", (0, 0))'],
  'kyodai-2026-6': ['Table(Row("n", 3, 4, 5), Row("E(X)", 3, 3.75, 4.5))'],
  'handai-2026-3': ['c = Circle((0, 0), 1)', 'a = 1', 'l: x + a y = 1'],
  'handai-2026-5': ['Table(Row("a", 1, 2), Row("b", 1, 2), Row("c", 1, 2))'],
  'meidai-2024-2': ['c = 2', 'Z1 = (1, 0)', 'Z2 = (1, sqrt(c - 1))', 'Z3 = (1, -sqrt(c - 1))'],
  'meidai-2024-4': ['Text("f(k)", (0, 0))'],
  'meidai-2025-4': ['Table(Row(1, 2, 3), Row(4, 5, 6))'],
  'meidai-2026-3': ['Table(Row("a", 1, 3), Row("b", 5, 5), Row("c", 24, 8))'],
  'tohokudai-2026-2': ['Table(Row("a", 1), Row("b", 2), Row("c", 3))'],
  'kyudai-2025-3': ['f(x) = 2^x', 'g(x) = x^2 + 3'],
  'kyudai-2025-5': ['a = 3', 'b = 2', 'c = 1', 'f(x) = (x^2 - a x + b)(x - c)'],
  'kyudai-2026-3': ['Text("p_n", (0, 0))'],
  'kyudai-2026-4': ['f(x) = x^4 - 10x^2 + 1'],
  'hokudai-2025-1': ['Table(Row("n", 1, 2, 3), Row("a_n", "α", "αr", "αr^2"))'],
  'hokudai-2025-5': ['Text("k < a < b < c ≤ k + n", (0, 0))'],
  'hokudai-2026-5': ['Table(Row("目", 3, 5, "其他"), Row("倍数", 3, 5, 2))'],
};
const WRONG = ['P = (7, 7)', 'f(x) = 3x + 5', 'Circle((9, 9), 2)'];

let bad = 0, n = 0;
for (const p of EXAM) {
  const wrong = runChecks(buildScene(WRONG, {}), p.checks);
  if (wrong.every((c) => c.ok)) { bad++; console.log(`✗ ${p.id}：画错的图也能通过`); }
  if (!REF[p.id]) continue;
  n++;
  const s = buildScene(REF[p.id], {});
  const r = runChecks(s, p.checks);
  if (s.errors.length || !r.every((c) => c.ok)) {
    bad++;
    console.log(`✗ ${p.id}：${s.errors.map((e) => e.message || e).join('；')} ${r.filter((c) => !c.ok).map((c) => `${c.type}（${c.detail}）`).join('；')}`);
  }
}
console.log(`画对的图 ${n} 题、画错的图 ${EXAM.length} 题，${bad ? `${bad} 处有问题` : '全部符合预期'}`);
