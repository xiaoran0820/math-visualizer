// 模拟的本地模型服务（实现 Ollama 接口的一小部分），用于在没有安装模型时调试界面、
// 复现“生成到一半时切换题目 / 停止后重试”等情况。输出内容是固定的，速度可以调节。
//
//   node scripts/mock-llm.js                 # 默认端口 11435，每个片段间隔 40ms
//   MOCK_PORT=11435 MOCK_DELAY=80 node scripts/mock-llm.js
//   然后另开终端：OLLAMA_HOST=127.0.0.1:11435 npm start
//   MOCK_OCR=short node scripts/mock-llm.js  # 复现 R7-1：识别只返回【图形】部分；App 换个说法重新识别时才返回完整题目
import http from 'node:http';
import { OCR_RETRY_HINT } from '../public/lib/prompts.js';

const PORT = Number(process.env.MOCK_PORT) || 11435;
const DELAY = Number(process.env.MOCK_DELAY) || 40;
const OCR_SHORT = process.env.MOCK_OCR === 'short';

const OCR = '如图，在 $\\triangle ABC$ 中，$AB=AC=5$，$BC=6$，$D$ 为 $BC$ 的中点，$DE\\perp AC$ 于点 $E$。求 $DE$ 的长。\n\n【图形】\n等腰三角形 ABC，A 在上方，B 在左下，C 在右下；D 在 BC 中点，E 在 AC 上，DE 与 AC 垂直。';
const ANALYSIS = JSON.stringify({
  title: '等腰三角形中的垂线段（模拟）',
  category: '平面几何',
  knowns: ['$AB=AC=5$，$BC=6$', '$D$ 为 $BC$ 中点', '$DE\\perp AC$ 于点 $E$'],
  goal: '求 $DE$ 的长',
  layout: 'B(-3,0)、C(3,0)，AD=4，所以 A(0,4)。',
  commands: ['ShowAxes(false)', 'A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'D = Midpoint(B, C)', 'Segment(A, D) #aux', 'E = PerpFoot(D, Line(A, C))', 'Segment(D, E) #hl', 'Text("DE = {Distance(D, E)}", (1.6, 4.3))'],
  insight: '这是模拟模型的输出，用于测试界面流程。',
});
const REPAIR = JSON.stringify({ commands: ['ShowAxes(false)', 'A = (0, 4)', 'B = (-3, 0)', 'C = (3, 0)', 'Polygon(A, B, C)', 'D = Midpoint(B, C)', 'Segment(A, D) #aux', 'E = Foot(D, Line(A, C))', 'Segment(D, E) #hl', 'Angle(D, E, C)', 'Text("DE = {Distance(D, E)}", (1.6, 4.3))'] });
const SOLVE_THINK = '先连接 AD，利用三线合一得到 AD⊥BC，再用面积法……';
const SOLVE = '**思路**：三线合一 + 面积法。\n\n1. $AD\\perp BC$，$AD=4$；\n2. $DE=\\dfrac{AD\\cdot DC}{AC}=\\dfrac{12}{5}$。\n\n**答案**：$DE=\\dfrac{12}{5}$（模拟）';

function chunks(s, n = 6) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

const server = http.createServer((req, res) => {
  const json = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.method === 'GET' && req.url === '/api/version') return json({ version: 'mock' });
  if (req.method === 'GET' && req.url === '/api/tags') return json({ models: [{ name: 'mock-vision', size: 1 }] });
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    if (req.url === '/api/show') return json({ capabilities: ['completion', 'vision', 'thinking'] });
    if (req.url !== '/api/chat') { res.writeHead(404); res.end(); return; }
    const p = JSON.parse(body || '{}');
    const system = p.messages?.[0]?.content || '';
    let think = '', text;
    if (system.includes('识别助手')) text = OCR_SHORT && !String(p.messages?.[1]?.content).includes(OCR_RETRY_HINT) ? '【图形】没有图形。' : OCR;
    else if (system.includes('数学老师')) { think = SOLVE_THINK; text = SOLVE; }
    else if (p.format?.properties?.title) text = ANALYSIS;
    else text = REPAIR;
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    const parts = [...chunks(think).map((t) => ({ message: { thinking: t } })), ...chunks(text).map((t) => ({ message: { content: t } }))];
    let i = 0;
    const timer = setInterval(() => {
      if (res.destroyed) { clearInterval(timer); return; }
      if (i < parts.length) { res.write(`${JSON.stringify(parts[i++])}\n`); return; }
      res.end(`${JSON.stringify({ done: true, eval_count: parts.length, eval_duration: parts.length * DELAY * 1e6 })}\n`);
      clearInterval(timer);
    }, DELAY);
    res.on('close', () => clearInterval(timer)); // 注意：req 的 close 在请求体读完时就会触发，要用 res 的
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`模拟模型服务已启动：http://127.0.0.1:${PORT}（片段间隔 ${DELAY}ms${OCR_SHORT ? '，识别只返回【图形】部分' : ''}），按 Ctrl+C 停止`));
