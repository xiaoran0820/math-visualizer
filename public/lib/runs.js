// 任务控制：保证旧任务不会改动新任务的界面。
//
//   begin()      开始新任务：先作废并中止当前任务，再返回新任务的句柄
//   supersede()  作废当前任务（例如切换到示例题）：中止请求，之后它的回调、报错、收尾都不再生效
//   stop()       用户点“停止”：只中止请求，不作废——由任务自己显示“已停止”并收尾
//   finish(run)  任务结束时调用；只有它仍是当前任务时才会关闭“运行中”状态
//
// 每个任务句柄有 run.signal（传给 fetch）和 run.alive()（改界面前先检查）。
export class RunController {
  constructor({ onRunningChange } = {}) {
    this.current = null;
    this.seq = 0;
    this.onRunningChange = onRunningChange;
  }

  begin() {
    this.supersede();
    const ac = new AbortController();
    const run = { id: ++this.seq, signal: ac.signal, abort: () => ac.abort() };
    run.alive = () => this.current === run;
    this.current = run;
    this.onRunningChange?.(true, run);
    return run;
  }

  supersede() {
    const old = this.current;
    if (!old) return;
    this.current = null;
    old.abort();
    this.onRunningChange?.(false, old);
  }

  stop() {
    this.current?.abort();
  }

  finish(run) {
    if (!run || this.current !== run) return false;
    this.current = null;
    this.onRunningChange?.(false, run);
    return true;
  }

  get running() {
    return !!this.current;
  }
}
