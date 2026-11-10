// 异步任务回归测试：连续点击运行、停止后立刻重试、切换示例时旧任务不能改动界面
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunController } from '../public/lib/runs.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

// 模拟一次“请求模型 + 更新界面”的任务，结构与 app.js 中的 start() 一致
function makeHarness() {
  const ui = { running: false, steps: [], content: null, errors: [] };
  const runs = new RunController({ onRunningChange: (on) => { ui.running = on; } });
  async function task(name, delayMs) {
    const run = runs.begin();
    try {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        run.signal.addEventListener('abort', () => { clearTimeout(t); setTimeout(() => reject(new Error('aborted')), 1); }, { once: true });
      });
      if (!run.alive()) return;
      ui.content = name;
      ui.steps.push(`${name}:done`);
    } catch (e) {
      if (!run.alive()) return;
      ui.steps.push(run.signal.aborted ? `${name}:stopped` : `${name}:error`);
      ui.errors.push(e.message);
    } finally {
      runs.finish(run);
    }
  }
  return { ui, runs, task };
}

test('连续点击运行：只有最后一次的结果生效，运行状态正确', async () => {
  const { ui, task } = makeHarness();
  const a = task('A', 30);
  await tick();
  const b = task('B', 30);
  assert.equal(ui.running, true);
  await Promise.all([a, b]);
  assert.equal(ui.content, 'B');
  assert.deepEqual(ui.steps, ['B:done']); // A 被作废后不再写任何界面状态
  assert.equal(ui.running, false);
});

test('停止后立刻重试：旧任务的“已停止”收尾不会关掉新任务的运行状态', async () => {
  const { ui, runs, task } = makeHarness();
  const a = task('A', 50);
  await tick();
  runs.stop(); // 用户点“停止”
  const b = task('B', 40); // 马上又点“运行”，此时 A 的收尾还没执行
  await tick();
  await tick();
  assert.equal(ui.running, true, 'B 运行中，不能被 A 的 finally 关闭');
  await Promise.all([a, b]);
  assert.deepEqual(ui.steps, ['B:done']);
  assert.equal(ui.running, false);
});

test('只点“停止”：任务自己显示“已停止”并收尾', async () => {
  const { ui, runs, task } = makeHarness();
  const a = task('A', 50);
  await tick();
  runs.stop();
  await a;
  assert.deepEqual(ui.steps, ['A:stopped']);
  assert.equal(ui.running, false);
});

test('切换到示例题（作废当前任务）：旧任务不报错、不改界面', async () => {
  const { ui, runs, task } = makeHarness();
  const a = task('A', 50);
  await tick();
  runs.supersede();
  ui.content = 'example';
  await a;
  assert.equal(ui.content, 'example');
  assert.deepEqual(ui.steps, []);
  assert.deepEqual(ui.errors, []);
  assert.equal(ui.running, false);
});

test('同一个任务重复 finish 不会出错', () => {
  const runs = new RunController();
  const r = runs.begin();
  assert.equal(runs.finish(r), true);
  assert.equal(runs.finish(r), false);
  assert.equal(runs.running, false);
});
