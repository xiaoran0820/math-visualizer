// 生成与 App 完全相同的 generate 参数（提示词、语法都来自 public/lib），给 llm-cli 用。
//   node make-request.mjs solve "题目" [作图命令文件] > req.json
//   node make-request.mjs analyze "题目" [原图.png] > req.json
//   node make-request.mjs recognize 图片.png [--retry] > req.json   （--retry：App 识别文字太少时重新识别用的说明）
import fs from 'node:fs';
import { OCR_SYSTEM, ocrUserText, OCR_RETRY_HINT, analyzeSystemFor, ANALYZE_SYSTEM_TUNED, ANALYSIS_SCHEMA, analyzeUserText, SOLVE_SYSTEM, solveUserText } from '../../../public/lib/prompts.js';
import { schemaToGbnf } from '../../../public/lib/gbnf.js';

const [kind, arg, extra] = process.argv.slice(2);
let req;
if (kind === 'solve') {
  const commands = extra ? fs.readFileSync(extra, 'utf8').split('\n').filter(Boolean) : [];
  req = { messages: [{ role: 'system', content: SOLVE_SYSTEM }, { role: 'user', content: solveUserText(arg, commands) }], maxTokens: 6144, temperature: 0.3, think: true };
} else if (kind === 'analyze') {
  // 第三个参数是图片时，和 App 一样把原图也发给模型（App 目前分析时会附上原图）
  const image = extra ? fs.readFileSync(extra).toString('base64') : undefined;
  // 环境变量 SHUXING_MODEL：模型名（带 shuxing 的是微调过的模型，用短的系统提示）；
  // SHUXING_LORA=1：和手机上一样，启用模型文件夹里的 adapter.gguf，并用短的系统提示
  const lora = process.env.SHUXING_LORA === '1';
  req = { model: process.env.SHUXING_MODEL || undefined, lora, messages: [{ role: 'system', content: lora ? ANALYZE_SYSTEM_TUNED : analyzeSystemFor(process.env.SHUXING_MODEL) }, { role: 'user', content: analyzeUserText(arg, '', !!image), image }], grammar: schemaToGbnf(ANALYSIS_SCHEMA), maxTokens: 4096, temperature: 0.2 };
} else if (kind === 'recognize') {
  // SHUXING_LORA=ocr：启用模型文件夹里的 adapter-ocr.gguf（识别用的 LoRA）
  req = { model: process.env.SHUXING_MODEL || undefined, lora: process.env.SHUXING_LORA === 'ocr' ? 'ocr' : false, messages: [{ role: 'system', content: OCR_SYSTEM }, { role: 'user', content: ocrUserText(extra === '--retry' ? OCR_RETRY_HINT : ''), image: fs.readFileSync(arg).toString('base64') }], maxTokens: 2048, temperature: 0.1 };
} else {
  console.error('第一个参数应为 solve、analyze 或 recognize');
  process.exit(2);
}
process.stdout.write(JSON.stringify(req));
