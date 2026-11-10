// 自动修正的采用条件
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeRepair } from '../public/lib/repair.js';

const base = ['ShowAxes(false)', 'A = (0, 8)', 'B = (0, 0)', 'C = (6, 0)', 'D = (6, 8)', 'E = (2, 0)', 'Segment(A, E)'];

test('真正修好的结果会被采用', () => {
  const before = [...base, 'F = PerpFootX(D, Line(A, E))', 'Segment(D, F) #hl'];
  const after = [...base, 'F = Foot(D, Line(A, E))', 'Segment(D, F) #hl'];
  const v = judgeRepair(before, after);
  assert.equal(v.ok, true, v.reason);
  assert.equal(v.after.errors, 0);
});

test('对象变多但错误也变多：不采用（审查报告中的例子）', () => {
  const before = [...base, 'F = Bad1(D)'];
  const after = [...base, 'G = (1, 1)', 'F = Bad1(D)', 'H = Bad2(D)', 'K = Bad3(D)', 'Segment(F, H)'];
  const v = judgeRepair(before, after);
  assert.equal(v.ok, false);
  assert.match(v.reason, /错误没有减少/);
});

test('删掉出错的行“消灭”错误，但图形变少：不采用', () => {
  const before = [...base, 'F = Bad1(D)', 'Segment(D, F)'];
  const after = base.slice(0, 3);
  const v = judgeRepair(before, after);
  assert.equal(v.ok, false);
});

test('修正时改动了原本正确的点：不采用', () => {
  const before = [...base, 'F = Bad1(D)'];
  const after = [...base.map((c) => (c === 'C = (6, 0)' ? 'C = (5, 0)' : c)), 'F = Foot(D, Line(A, E))'];
  const v = judgeRepair(before, after);
  assert.equal(v.ok, false);
  assert.match(v.reason, /改动了原本正确的「C」/);
});

test('模型没有返回命令：不采用', () => {
  assert.equal(judgeRepair([...base, 'F = Bad1(D)'], []).ok, false);
  assert.equal(judgeRepair([...base, 'F = Bad1(D)'], null).ok, false);
});
