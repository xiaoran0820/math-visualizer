// 高中数学 10000 题库（你用 ChatGPT 生成，放在 train/real/inbox/，不对外发布）：按题型分出测试集和训练题。
// 2026-11-13 在看任何结果之前分好，之后不再改（输出文件已存在且内容不同时，拒绝覆盖）：
// - 测试集：每个专题随机取 2 个题型，共 40 个题型；每个题型取 2 道骨架不同的题，共 80 题。
//   这 40 个题型的题一道也不进训练。用途：衡量“没见过的题型”能不能做对；只看汇总，不根据它调整任何东西。
// - 训练题：其余 160 个题型，每个题型取 5 道骨架尽量不同的题，共 800 题；之后由模型生成作图命令，逐题核对后才用。
// 种子 20261113。输出 eval/bank-split.json（只有编号，没有题目文字）。
//   node train/bank/split.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng, shuffle } from '../gen/util.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BANK_FILE = path.join(ROOT, 'train', 'real', 'inbox', '高中数学题库_10000题.jsonl');
const OUT = path.join(ROOT, 'eval', 'bank-split.json');
const SEED = 20261113;
const TEST_PER_TOPIC = 2, TEST_PER_FAMILY = 2, TRAIN_PER_FAMILY = 5;

const bank = fs.readFileSync(BANK_FILE, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
// 题目骨架：数字、单个字母换成占位符，去掉空白
const skel = (t) => t.replace(/\d+(\.\d+)?/g, '#').replace(/(?<![A-Za-z\\])[A-Za-z](?![A-Za-z])/g, 'v').replace(/\s+/g, '');

const byFamily = new Map();
for (const p of bank) {
  if (!byFamily.has(p.family_id)) byFamily.set(p.family_id, []);
  byFamily.get(p.family_id).push(p);
}
const families = [...byFamily.keys()].sort();
const byTopic = new Map();
for (const fid of families) {
  const t = byFamily.get(fid)[0].topic;
  if (!byTopic.has(t)) byTopic.set(t, []);
  byTopic.get(t).push(fid);
}

const r = rng(SEED);
const testFamilies = [];
for (const fids of byTopic.values()) testFamilies.push(...shuffle(r, fids).slice(0, TEST_PER_TOPIC));
testFamilies.sort();
const TEST = new Set(testFamilies);

// 从一个题型里取 n 道题：打乱后先取骨架没出现过的，不够再按打乱后的顺序补
function choose(ps, n) {
  const order = shuffle(r, ps);
  const out = [];
  const seen = new Set();
  for (const p of order) {
    if (out.length === n) break;
    const s = skel(p.question);
    if (!seen.has(s)) { seen.add(s); out.push(p); }
  }
  for (const p of order) { if (out.length === n) break; if (!out.includes(p)) out.push(p); }
  return out.map((p) => p.id).sort();
}
const test = [], train = [];
for (const fid of families) {
  if (TEST.has(fid)) test.push(...choose(byFamily.get(fid), TEST_PER_FAMILY));
  else train.push(...choose(byFamily.get(fid), TRAIN_PER_FAMILY));
}

const result = {
  note: '高中数学题库按题型分组（2026-11-13，看结果之前分好，不再改）。test 只看汇总；testFamilies 的题都不进训练。',
  seed: SEED,
  bank: path.relative(ROOT, BANK_FILE),
  testFamilies,
  test,
  train,
};
const text = JSON.stringify(result, null, 1) + '\n';
if (fs.existsSync(OUT) && fs.readFileSync(OUT, 'utf8') !== text) {
  console.error(`${path.relative(ROOT, OUT)} 已经存在且内容不同，不覆盖（分组定下后不再改）。`);
  process.exit(1);
}
fs.writeFileSync(OUT, text);

const byId = Object.fromEntries(bank.map((p) => [p.id, p]));
const count = (ids, key) => ids.reduce((m, id) => ((m[byId[id][key]] = (m[byId[id][key]] || 0) + 1), m), {});
console.log(`测试题型 ${testFamilies.length} 个，测试题 ${test.length} 道（难度：${JSON.stringify(count(test, 'difficulty'))}）`);
console.log(`训练题型 ${families.length - testFamilies.length} 个，训练候选 ${train.length} 道（难度：${JSON.stringify(count(train, 'difficulty'))}）`);
for (const fid of testFamilies) {
  const p = byFamily.get(fid)[0];
  console.log(`  ${fid} ${p.topic}｜${p.knowledge_point}｜${p.difficulty}`);
}
