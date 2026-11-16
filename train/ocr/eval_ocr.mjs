// 用手机上的同一份引擎（Mac 版 llm-cli）评测“看图识别”：和 App 一样清理结果、文字太少时换个说法再识别一次。
//   node train/ocr/eval_ocr.mjs <模型根目录> <模型文件夹名> <test|exam|exam2> [--lora] [--name 结果名] [--only 题号1,题号2]
// test：train/data/ocr-test.jsonl（程序生成的 150 张，有标准答案）→ 字符准确率
// exam：过去问 73 题（exam2：第二组 58 题）的图片 → 结果存成 eval/exam/ocr/<结果名>/<题号>.json（和 scripts/eval.js 的识别缓存同一格式），
//       之后 node scripts/eval.js --set exam --ocr-model <结果名> 就用这份识别结果作图。准确率要对照原图人工核对。
// --lora：启用模型文件夹里的 adapter-ocr.gguf
// 和 App 一样边识别边检查：【图形】部分跑偏（同一行出现第 3 次，或超过 350 字）就结束这次识别，去掉这段描述（结果里记 stopped）。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OCR_SYSTEM, ocrUserText, ocrQuality, ocrRetryHintFor, pickBetterOcr, ocrBody, dedupeOcr, dropOcrPreamble, cleanModelText, dropRunawayFigure, ocrRunawayWatch } from '../../public/lib/prompts.js';
import { EXAM_SETS } from '../../eval/exam-sets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const [root, model, setName, ...rest] = process.argv.slice(2);
const lora = rest.includes('--lora');
const name = rest.includes('--name') ? rest[rest.indexOf('--name') + 1] : `${model}${lora ? '+ocr' : ''}`;
if (!root || !model || !(setName === 'test' || EXAM_SETS[setName])) { console.error('用法：node train/ocr/eval_ocr.mjs <模型根目录> <模型文件夹名> <test|exam|exam2> [--lora] [--name 结果名]'); process.exit(2); }
const isExam = setName !== 'test';
const only = rest.includes('--only') ? rest[rest.indexOf('--only') + 1].split(',') : null;

const items = setName === 'test'
  ? fs.readFileSync(path.join(HERE, '..', 'data', 'ocr-test.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  : EXAM_SETS[setName].map((p) => ({ id: p.id, image: path.join(ROOT, 'eval', p.image) }));
const todo = items.filter((it) => !only || only.includes(it.id));
const tmp = path.join(HERE, '..', 'logs', 'ocr-tmp');
fs.mkdirSync(tmp, { recursive: true });
const outDir = isExam ? path.join(ROOT, 'eval', 'exam', 'ocr', name) : path.join(HERE, '..', 'logs', 'ocr-eval', name);
fs.mkdirSync(outDir, { recursive: true });

// 引擎逐字输出：边读边检查，【图形】部分跑偏就结束进程（和 App 停下这次识别一样）。
// 正常结束时耗时取引擎统计的“读提示 + 生成”；中途停下时没有统计，取实际耗时（含加载模型，偏多一点）。
function once(image, hint) {
  const req = { model, lora: lora ? 'ocr' : false, messages: [{ role: 'system', content: OCR_SYSTEM }, { role: 'user', content: ocrUserText(hint), image: fs.readFileSync(image).toString('base64') }], maxTokens: 3584, temperature: 0.1 };
  const file = path.join(tmp, 'req.json');
  fs.writeFileSync(file, JSON.stringify(req));
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn('sh', [path.join(ROOT, 'native', 'local-model', 'tools', 'run.sh'), file], { env: { ...process.env, SHUXING_MODELS_DIR: path.resolve(root) } });
    let out = '', looped = false;
    // 引擎的日志行（[llama] …）有时不换行，直接接在模型输出的后面：凡是 [llama] 到行尾的内容都去掉
    const watch = ocrRunawayWatch(() => { looped = true; child.kill('SIGKILL'); });
    const body = () => out.split('\n—— 统计')[0].replace(/\[llama\][^\n]*/g, '');
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      out += d;
      if (looped) return;
      watch(body());
    });
    child.stderr.resume();
    child.on('close', () => {
      const wall = (Date.now() - t0) / 1000;
      const stat = /提示 (\d+) token \/ ([\d.]+) 秒，输出 (\d+) token \/ ([\d.]+) 秒/.exec(out);
      resolve({ text: dropRunawayFigure(dedupeOcr(dropOcrPreamble(cleanModelText(body())))), seconds: stat ? Number(stat[2]) + Number(stat[4]) : wall, outTokens: stat ? Number(stat[3]) : NaN, promptTokens: stat ? Number(stat[1]) : NaN, looped });
    });
  });
}

// 字符准确率：只比较“有内容的字符”（去掉空白、$ 等排版符号），编辑距离
const chars = (s) => [...String(s).replace(/\$|\\[,;!]|\s+/g, '')];
function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const acc = (truth, got) => { const a = chars(truth), b = chars(got); return a.length ? Math.max(0, 1 - lev(a, b) / a.length) : 0; };
const CJK_ZH_ONLY = /[这个们说为请图题设则对边线于]/; // 日文题里出现这些简体字，多半是被译成了中文

let sumAcc = 0, exact = 0, retried = 0, stopped = 0, secs = 0, toks = 0, ptoks = 0, n = 0, translated = 0, figMiss = 0, figExtra = 0;
for (const it of todo) {
  const lang = it.lang || (isExam ? 'ja' : 'auto');
  const r = await once(it.image, '');
  let text = r.text;
  let q = ocrQuality(text, { lang });
  let rec = { text, seconds: r.seconds, retried: false, ...(r.looped ? { stopped: true } : {}) };
  if (q.needsRetry) {
    const again = await once(it.image, ocrRetryHintFor(q.reasons));
    if (pickBetterOcr(again.text, text, { lang })) text = again.text;
    rec = { text, seconds: r.seconds + again.seconds, retried: true, ...(r.looped || again.looped ? { stopped: true } : {}) };
    retried++;
    q = ocrQuality(text, { lang });
  }
  rec.quality = { chars: q.chars, kanaRatio: Number(q.kanaRatio.toFixed(3)), incomplete: q.incomplete, likelyTranslated: q.likelyTranslated, figureMissing: q.figureMissing };
  if (rec.stopped) stopped++;
  n++; secs += rec.seconds || 0; toks += r.outTokens || 0; ptoks += r.promptTokens || 0;
  if (isExam) fs.writeFileSync(path.join(outDir, `${it.id}.json`), JSON.stringify(rec, null, 1));
  else {
    fs.writeFileSync(path.join(outDir, `${it.id}.txt`), rec.text);
    const a = acc(it.text, rec.text);
    sumAcc += a; if (a === 1) exact++;
    if (it.lang === 'ja' && (q.likelyTranslated || CJK_ZH_ONLY.test(ocrBody(rec.text)))) translated++;
    const hasFig = /【图形】/.test(rec.text) && !/【图形】\s*(?:没有图形|无图形|无|$)/.test(rec.text);
    if (it.figure && !hasFig) figMiss++;
    if (!it.figure && hasFig) figExtra++;
  }
}
const avg = (x) => (n ? (x / n).toFixed(1) : '—');
if (setName === 'test') {
  console.log(`${name} · 生成的评测图 ${n} 张：字符准确率 ${(sumAcc / n * 100).toFixed(1)}%，完全一致 ${exact}，日文被译成中文 ${translated}，有图没描述 ${figMiss}，没图却写了图形 ${figExtra}，重新识别 ${retried}，图形部分跑偏停下 ${stopped}；平均输入 ${avg(ptoks)} token、输出 ${avg(toks)} token、${avg(secs)} 秒（Mac）`);
} else {
  console.log(`${name} · ${setName === 'exam' ? '过去问' : '过去问第二组'} ${n} 题：重新识别 ${retried}，图形部分跑偏停下 ${stopped}；平均输入 ${avg(ptoks)} token、输出 ${avg(toks)} token、${avg(secs)} 秒（Mac）；结果在 ${path.relative(ROOT, outDir)}/`);
}
