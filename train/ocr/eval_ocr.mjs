// 用手机上的同一份引擎（Mac 版 llm-cli）评测“看图识别”：和 App 一样清理结果、文字太少时换个说法再识别一次。
//   node train/ocr/eval_ocr.mjs <模型根目录> <模型文件夹名> <test|exam> [--lora] [--name 结果名]
// test：train/data/ocr-test.jsonl（程序生成的 150 张，有标准答案）→ 字符准确率
// exam：过去问 73 题的图片 → 结果存成 eval/exam/ocr/<结果名>/<题号>.json（和 scripts/eval.js 的识别缓存同一格式），
//       之后 node scripts/eval.js --set exam --ocr-model <结果名> 就用这份识别结果作图。准确率要对照原图人工核对。
// --lora：启用模型文件夹里的 adapter-ocr.gguf
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OCR_SYSTEM, ocrUserText, ocrRetryHint, tooLittleText, ocrBody, dedupeOcr, cleanModelText } from '../../public/lib/prompts.js';
import { EXAM } from '../../eval/exam.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const [root, model, setName, ...rest] = process.argv.slice(2);
const lora = rest.includes('--lora');
const name = rest.includes('--name') ? rest[rest.indexOf('--name') + 1] : `${model}${lora ? '+ocr' : ''}`;
if (!root || !model || !['test', 'exam'].includes(setName)) { console.error('用法：node train/ocr/eval_ocr.mjs <模型根目录> <模型文件夹名> <test|exam> [--lora] [--name 结果名]'); process.exit(2); }

const items = setName === 'test'
  ? fs.readFileSync(path.join(HERE, '..', 'data', 'ocr-test.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  : EXAM.map((p) => ({ id: p.id, image: path.join(ROOT, 'eval', p.image) }));
const tmp = path.join(HERE, '..', 'logs', 'ocr-tmp');
fs.mkdirSync(tmp, { recursive: true });
const outDir = setName === 'exam' ? path.join(ROOT, 'eval', 'exam', 'ocr', name) : path.join(HERE, '..', 'logs', 'ocr-eval', name);
fs.mkdirSync(outDir, { recursive: true });

function once(image, hint) {
  const req = { model, lora: lora ? 'ocr' : false, messages: [{ role: 'system', content: OCR_SYSTEM }, { role: 'user', content: ocrUserText(hint), image: fs.readFileSync(image).toString('base64') }], maxTokens: 2048, temperature: 0.1 };
  const file = path.join(tmp, 'req.json');
  fs.writeFileSync(file, JSON.stringify(req));
  const res = spawnSync('sh', [path.join(ROOT, 'native', 'local-model', 'tools', 'run.sh'), file], { env: { ...process.env, SHUXING_MODELS_DIR: path.resolve(root) }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = res.stdout || '';
  const stat = /提示 (\d+) token \/ ([\d.]+) 秒，输出 (\d+) token \/ ([\d.]+) 秒/.exec(out);
  // 引擎的日志行（[llama] …）有时不换行，直接接在模型输出的后面：凡是 [llama] 到行尾的内容都去掉
  const text = out.split('\n—— 统计')[0].replace(/\[llama\][^\n]*/g, '').split('\n').join('\n');
  return { text: dedupeOcr(cleanModelText(text)), seconds: stat ? Number(stat[2]) + Number(stat[4]) : NaN, outTokens: stat ? Number(stat[3]) : NaN, promptTokens: stat ? Number(stat[1]) : NaN };
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

let sumAcc = 0, exact = 0, retried = 0, secs = 0, toks = 0, ptoks = 0, n = 0, translated = 0, figMiss = 0, figExtra = 0;
for (const it of items) {
  let r = once(it.image, '');
  let rec = { text: r.text, seconds: r.seconds, retried: false };
  if (tooLittleText(r.text)) {
    const again = once(it.image, ocrRetryHint(''));
    rec = { text: ocrBody(again.text).length > ocrBody(r.text).length ? again.text : r.text, seconds: r.seconds + again.seconds, retried: true };
    retried++;
  }
  n++; secs += rec.seconds || 0; toks += r.outTokens || 0; ptoks += r.promptTokens || 0;
  if (setName === 'exam') fs.writeFileSync(path.join(outDir, `${it.id}.json`), JSON.stringify(rec, null, 1));
  else {
    fs.writeFileSync(path.join(outDir, `${it.id}.txt`), rec.text);
    const a = acc(it.text, rec.text);
    sumAcc += a; if (a === 1) exact++;
    if (it.lang === 'ja' && CJK_ZH_ONLY.test(ocrBody(rec.text))) translated++;
    const hasFig = /【图形】/.test(rec.text) && !/【图形】\s*(?:没有图形|无图形|无|$)/.test(rec.text);
    if (it.figure && !hasFig) figMiss++;
    if (!it.figure && hasFig) figExtra++;
  }
}
const avg = (x) => (n ? (x / n).toFixed(1) : '—');
if (setName === 'test') {
  console.log(`${name} · 生成的评测图 ${n} 张：字符准确率 ${(sumAcc / n * 100).toFixed(1)}%，完全一致 ${exact}，日文被译成中文 ${translated}，有图没描述 ${figMiss}，没图却写了图形 ${figExtra}，重新识别 ${retried}；平均输入 ${avg(ptoks)} token、输出 ${avg(toks)} token、${avg(secs)} 秒（Mac）`);
} else {
  console.log(`${name} · 过去问 ${n} 题：重新识别 ${retried}；平均输入 ${avg(ptoks)} token、输出 ${avg(toks)} token、${avg(secs)} 秒（Mac）；结果在 ${path.relative(ROOT, outDir)}/`);
}
