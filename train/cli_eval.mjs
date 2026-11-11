// 用手机上的同一份引擎（Mac 版 llm-cli，native/local-model/tools）跑题集的“第一次分析”，
// 检验“原来的量化模型 + adapter.gguf”这种手机上的用法。只看第一次生成的结果（没有修正、重新生成）。
//
//   node train/cli_eval.mjs <模型根目录> <模型文件夹名> <dev|holdout|fresh> [--lora] [--only id1,id2]
//
// 模型根目录下是 <模型文件夹名>/model.gguf（和可选的 adapter.gguf）。--lora：启用 adapter.gguf，并用短系统提示。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ANALYZE_SYSTEM_TUNED, analyzeSystemFor, analyzeUserText, ANALYSIS_SCHEMA } from '../public/lib/prompts.js';
import { schemaToGbnf } from '../public/lib/gbnf.js';
import { parseAnalysis, evaluateCommands } from '../public/lib/pipeline.js';
import { extractFacts } from '../public/lib/constraints.js';
import { runChecks } from '../eval/checks.js';
import { PROBLEMS } from '../eval/problems.js';
import { HOLDOUT } from '../eval/holdout.js';
import { FRESH } from '../eval/fresh.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [root, name, setName, ...rest] = process.argv.slice(2);
const lora = rest.includes('--lora');
const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1].split(',') : null;
const problems = ({ dev: PROBLEMS, holdout: HOLDOUT, fresh: FRESH }[setName] || []).filter((p) => !only || only.includes(p.id));
if (!root || !name || !problems.length) { console.error('用法：node train/cli_eval.mjs <模型根目录> <模型文件夹名> <dev|holdout|fresh> [--lora]'); process.exit(2); }

const tmp = path.join(HERE, 'logs', 'cli-tmp');
fs.mkdirSync(tmp, { recursive: true });
const grammar = schemaToGbnf(ANALYSIS_SCHEMA);
const system = lora ? ANALYZE_SYSTEM_TUNED : analyzeSystemFor(name);
let correct = 0, clean = 0, tokens = 0, seconds = 0, promptTokens = 0;
for (const p of problems) {
  const req = { model: name, lora, messages: [{ role: 'system', content: system }, { role: 'user', content: analyzeUserText(p.text, '', false) }], grammar, maxTokens: 4096, temperature: 0.2 };
  const file = path.join(tmp, `${p.id}.json`);
  fs.writeFileSync(file, JSON.stringify(req));
  const res = spawnSync('sh', [path.join(HERE, '..', 'native', 'local-model', 'tools', 'run.sh'), file], { env: { ...process.env, SHUXING_MODELS_DIR: path.resolve(root) }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = res.stdout || '';
  const stat = /提示 (\d+) token[^，]*，输出 (\d+) token \/ ([\d.]+) 秒/.exec(out);
  const text = out.split('\n—— 统计')[0].replace(/\[llama\][^\n]*/g, ''); // 日志行有时不换行，接在输出后面
  const analysis = parseAnalysis(text.slice(text.indexOf('{')));
  let ok = false, errors = '-', facts = '-';
  if (analysis) {
    const cand = evaluateCommands(analysis.commands, extractFacts(p.text));
    const checks = runChecks(cand.scene, p.checks);
    ok = checks.every((c) => c.ok);
    errors = cand.errors.length; facts = `${cand.sat}/${cand.total}`;
    if (!cand.errors.length) clean++;
  }
  if (ok) correct++;
  if (stat) { promptTokens += Number(stat[1]); tokens += Number(stat[2]); seconds += Number(stat[3]); }
  if (setName !== 'holdout') console.log(`  ${p.id.padEnd(20)} ${ok ? '✓' : '✗'}  命令出错 ${errors}  题目条件 ${facts}  输出 ${stat ? stat[2] : '?'} token`);
}
const n = problems.length;
console.log(`${name}${lora ? ' + LoRA' : ''} · ${setName} ${n} 题 · 第一次生成：完全正确 ${correct}/${n}，命令无错误 ${clean}/${n}，平均输入 ${Math.round(promptTokens / n)} token、输出 ${Math.round(tokens / n)} token、生成 ${(seconds / n).toFixed(1)} 秒`);
