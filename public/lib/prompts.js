// 发给模型的提示词与输出格式。服务端（src/app.js）和手机本地运行的模型共用这一份，所以放在 public/lib 下。

export const CATEGORIES = ['函数', '平面几何', '解析几何', '立体几何', '代数方程', '不等式', '数列', '三角函数', '向量', '概率统计', '应用题', '其他'];

// ---------------- 1. 拍照识别 ----------------
export const OCR_SYSTEM = `你是数学题目识别助手。请把图片中的数学题完整、准确地转写出来。
要求：
1. 转写题干和所有小问，保留原有编号（如 (1)(2)）和选择题选项（A. B. C. D.），不要解答。
2. 数学式一律用 LaTeX：行内公式写在 $...$ 中，独立公式写在 $$...$$ 中。例如 $f(x)=x^2-2x$、$\\triangle ABC$、$\\angle A=60^\\circ$、$\\dfrac{1}{2}$。下标必须带花括号，例如 $a_{n+1}$；分式写成 $\\frac{1}{2}$。
3. 原文是什么语言就用什么语言：日文保留日文（假名和汉字照原文），英文保留英文，不要翻译成中文。
4. 如果图片中有几何图形、函数图像或表格，在最后另起一行写「【图形】」，然后描述：有哪些点及其大致位置（上、下、左、右）、哪些点之间连了线、哪些线是虚线、图中标注的数字和角度。这一部分最多 8 行、300 字；没有图形就不要写。
5. 看不清的地方写【?】，不要编造。
6. 只输出题目内容，不要输出任何解释或解答。`;

export function ocrUserText(hint) {
  return `请识别图片中的数学题。${hint ? `\n补充说明：${hint}` : ''}`;
}

// ---------------- 微调过的模型（数形自己训练的，模型名里带 shuxing） ----------------
// 作图语言已经通过训练学会，系统提示只说明输出格式、列出命令的名字：约 250 token（通用的 ANALYZE_SYSTEM 约 2700 token）。
// 手机上第一次计算快得多，上下文也省内存。训练数据和方法见 train/。分析、修正都用这一份。
export const ANALYZE_SYSTEM_TUNED = `你是“数形结合”可视化助手。读懂数学题，只输出一个 JSON：title（10 字以内的题目名称）、category（题型）、knowns（已知条件，数学式写在 $...$ 中）、goal（所求）、layout（作图推演：坐标怎么取，关键点的坐标怎么算）、commands（作图命令）、insight（看图要点，一句话）。
作图命令用数形的作图语言；长度、面积等数值写成实时表达式，由程序计算；概率、统计题用 Table、Row 列表格。可用的命令：
Midpoint Foot Intersect Point Center Circumcenter Incenter Centroid Orthocenter Rotate Reflect Translate Segment Line Ray Vector Perpendicular Parallel PerpendicularBisector AngleBisector Tangent Circle Incircle Arc Sector Semicircle Polygon Polyline Function If Curve Derivative Root Extremum Vertex Angle Text Brace Integral IntegralBetween Region Table Row Slider ShowAxes ZoomIn Sphere Cylinder Cone Distance Length Area Slope xAxis yAxis，标记 #aux #hl #result #eq1 #open #fixed。`;
export const isTunedModel = (name) => /shuxing/i.test(String(name || ''));
export const analyzeSystemFor = (model) => (isTunedModel(model) ? ANALYZE_SYSTEM_TUNED : ANALYZE_SYSTEM);

// 识别结果里的题目文字：去掉最后的【图形】说明和空白
export function ocrBody(text) {
  return String(text || '').replace(/【图形】[\s\S]*$/, '').replace(/\s+/g, '');
}

// 几乎没有识别出题目文字。2026-11-10 R7-1 在模拟器里只识别出「【图形】没有图形。」，题目一个字都没有。
// 这时先换个说法重新识别一次（OCR_RETRY_HINT）；还不行，分析时把原图交给模型补救。
export const tooLittleText = (text) => ocrBody(text).length < 15;

export const OCR_RETRY_HINT = '上一次几乎没有识别出题目文字。请逐行转写题目的文字（原文是日文、英文就照原文写，不要翻译），包括题号、题干和每个小问，数学式用 LaTeX。图中没有几何图形、函数图像或表格时，不要写【图形】。';

// 2026-11-15：不同的问题给不同的重试提示，比笼统地再说一遍“文字太少”有效。
// 过去问里 4 道影响题意的识别错误：2 道整题译成中文（假名比例 0%）、1 道编造图形描述、1 道漏了方格图。
export const OCR_RETRY_TRUNCATED = '上一次的输出在公式中间断了，题目没有写完。请完整转写题干和每个小问；如果内容太长，先保证题干和已知条件完整，图形描述放在最后，最多 6 行。';
export const OCR_RETRY_TRANSLATED = '上一次把题目翻译成了中文。请保留原文的语言和文字（日文就写日文，假名和汉字照原文），不要翻译；只把数学式写成 LaTeX。';
export const OCR_RETRY_FIGURE = '上一次没有描述图中的图形。如果图中确实有图形或表格，请在最后用【图形】开头，写清各点的位置、哪些点相连、哪些线是虚线、图里的数字和角度；没有图形就不要写。';
export const OCR_RETRY_REPEAT = '上一次有整行内容重复了很多遍，题目没有写完。请只输出一遍，不要重复同一行。';

/**
 * 按质量问题的类型拼重试提示；用户自己的补充说明放在最后，优先听用户的。
 * @param {string|string[]} reasons 'too-little' | 'translated' | 'truncated' | 'repetitive' | 'figure'
 */
export function ocrRetryHintFor(reasons, hint = '') {
  const list = Array.isArray(reasons) ? reasons : [reasons];
  const parts = [];
  if (list.includes('too-little')) parts.push(OCR_RETRY_HINT);
  if (list.includes('translated')) parts.push(OCR_RETRY_TRANSLATED);
  if (list.includes('truncated')) parts.push(OCR_RETRY_TRUNCATED);
  if (list.includes('repetitive')) parts.push(OCR_RETRY_REPEAT);
  if (list.includes('figure')) parts.push(OCR_RETRY_FIGURE);
  return [...parts, hint].filter(Boolean).join('\n');
}
// 模型偶尔在识别结果前面加一句中文开场白（2026-11-15：手机原 2B 的 131 份过去问识别结果里有 4 份，
// 例如“根据图片内容，以下是识别出的数学题：”），会跟着题目一起送去分析。只去掉开头冒号（或“如下”）之前的这种话：
// 以“根据 / 以下 / 下面 / 这是 / 好的 / 图片 / 识别结果 / 转写结果”开头，提到图片、照片、识别、转写、原文或题目，
// 40 字以内，不含公式和假名。题目自己的“根据图中信息，回答下列问题：”“以下是某班学生的成绩：”不算（没有提到这些词）。
const OCR_PREAMBLE = /^\s*((?:根据|以下|下面|这是|好的|图片|识别结果|转写结果)[^\n$：:]{0,38}?)(?:如下[。：:]?|[：:])[ \t]*\n?/;
const OCR_PREAMBLE_WORDS = /图片|照片|识别|转写|原文|题目|数学题/;
export function dropOcrPreamble(text) {
  const s = String(text || '');
  const m = s.match(OCR_PREAMBLE);
  if (!m || !OCR_PREAMBLE_WORDS.test(m[1]) || /[ぁ-ゟ゠-ヿ]/.test(m[1])) return s;
  const rest = s.slice(m[0].length).replace(/^\s+/, '');
  return rest ? rest : s; // 去掉后什么都不剩，就保留原样
}

// 识别结果整段重复（2B 偶尔把整道题抄两遍，2026-11-10 R7-1 实测）：只留一遍。
// 只处理“全文就是同一段反复出现”（最后一遍可以不完整）的情况，题目里个别相同的行不受影响。
export function dedupeOcr(text) {
  const lines = String(text).trim().split('\n');
  const norm = lines.map((l) => l.trim());
  const n = norm.length;
  for (let k = 1; k <= (n + 1) / 2; k++) { // 两遍之间常隔一个空行，最后一遍后面没有，所以是 (n + 1) / 2
    if (norm.slice(0, k).join('').length < 20) continue;
    let ok = true;
    for (let i = k; i < n && ok; i++) ok = norm[i] === norm[i % k] || (i === n - 1 && norm[i % k].startsWith(norm[i]));
    if (ok) return lines.slice(0, k).join('\n').trim();
  }
  return String(text).trim();
}

// 【图形】部分跑偏：原题没有图时，模型偶尔在【图形】下反复写同样几行，或者开始解题、编造别的题，一直写到长度上限
// （2026-11-12：过去问第二组 2 道原地打转，一道要 17 秒，平均 3 秒；生成的评测图 1 张写了一大段别的题的解答）。
// 判定：【图形】之后，同一行有内容的文字（去掉开头的列表符号，8 个字以上）出现第 3 次，或者这一部分超过 350 字
// （正常的图形描述：生成图的标准答案最长 77 字，第二组开发集里真实的图最长 259 字）。
// App 边识别边检查，发现就停下；这时的图形描述已经不可信，整段去掉，只留题目文字。
const FIGURE_MARK = '【图形】';
// 2026-11-15 从 600 收紧到 350：正常图最长 259 字，600 只会让小模型在跑偏时多写 3～5 秒。
const FIGURE_MAX = 350;
const loopKey = (line) => line.trim().replace(/^[-*•·]\s*/, '').replace(/\s+/g, ' ');
export function figureRunsAway(text) {
  const s = String(text || '');
  const at = s.indexOf(FIGURE_MARK);
  if (at < 0) return false;
  const figure = s.slice(at + FIGURE_MARK.length);
  if ([...figure.trim()].length > FIGURE_MAX) return true;
  const seen = new Map();
  for (const line of figure.split('\n')) {
    const key = loopKey(line);
    if ([...key].length < 8) continue;
    const n = (seen.get(key) || 0) + 1;
    if (n >= 3) return true;
    seen.set(key, n);
  }
  return false;
}
export function dropRunawayFigure(text) {
  const s = String(text || '');
  return figureRunsAway(s) ? s.slice(0, s.indexOf(FIGURE_MARK)).trim() : s;
}
// 正文整行重复（【图形】之前的题目文字）：边识别边停，避免小模型把同一行写满输出上限。
// 只认 12 字以上的整行，避免把表格里的短行或正常重复的编号误判成跑偏。
export function bodyRepeats(text) {
  const body = String(text || '').replace(/【图形】[\s\S]*$/, '');
  const seen = new Map();
  for (const line of body.split('\n')) {
    const key = line.trim().replace(/^[-*•·]\s*/, '').replace(/\s+/g, ' ');
    if ([...key].length < 12) continue;
    const n = (seen.get(key) || 0) + 1;
    if (n >= 3) return true;
    seen.set(key, n);
  }
  return false;
}
// 边识别边检查：传入到目前为止的识别文字，每多 40 个字查一次，跑偏时调用一次 stop()；返回是否已经跑偏
export function ocrRunawayWatch(stop) {
  let checked = 0, fired = false;
  return (text) => {
    if (fired || text.length - checked < 40) return fired;
    checked = text.length;
    if (figureRunsAway(text) || bodyRepeats(text)) { fired = true; stop(); }
    return fired;
  };
}

// 重新识别时的补充说明：用户自己写的（例如「只识别第 2 题」）放在最后，优先听用户的
export const ocrRetryHint = (hint) => [OCR_RETRY_HINT, hint].filter(Boolean).join('\n');

// ---------------- 识别质量 ----------------
// 题目文字里“指向一张已有的图或表”的说法。只认这些：单独一个“図”“グラフ”“图”太宽——
// “図示せよ”“グラフをかけ”“画出函数的图像”是要学生自己画；“曲線で囲まれた図形”是文字定义的区域；
// 模型自己加的“根据图片内容”说的是照片。这些情况原题都没有图（2026-11-15：131 份真实识别结果里，旧规则 8 份提醒缺图）。
const FIGURE_REF = new RegExp([
  '(?:下|次|右|左|上)の(?:図|グラフ|表)', // 下の図、右のグラフ、次の表
  '(?:下|次|右|左|上)図', // 下図、右図
  '図\\s*[0-9０-９]', // 図1、図 2
  '図(?:の|に|で|は|中|を参照|において|より)', // 図のように、図に示す、図中（“図形”“図示”不算）
  '如(?:下|右|左|上)?图', '(?:下|右|左|上)图', '图\\s*[0-9０-９]', '图(?:中|所示)', '见图', // 如图、下图、图中、见图
  '(?:如下|下|右|左)表', '表格', '表\\s*[0-9０-９：:]', // 下表、表格、表1、表：
].join('|'));

// 题目语言：选“自动”时按上一道题判断。被译成中文的结果没有假名，单看这一次判断不出来；上一道是日文题，这道多半也是。
export function ocrLangFor(setting, lastLang = '') {
  if (setting === 'ja' || setting === 'zh') return setting;
  return lastLang === 'ja' ? 'ja' : 'auto';
}
// 识别完记下这道题的语言：假名多的是日文；一个假名都没有的算中文（重新识别后仍没有假名也算，
// 这样从日文题换成中文题时只多识别一次）；字太少或介于两者之间时不改。
export function ocrLangOf(q, lastLang = '') {
  if (!q || q.tooLittle) return lastLang;
  if (q.kanaRatio >= 0.05) return 'ja';
  if (q.kana === 0 && q.chars >= 30) return 'zh';
  return lastLang;
}
// 不只看字数。过去问里 4 道影响题意的错误：2 道整题译成中文（假名比例 0%）、1 道在公式中间断掉、
// 1 道编造/漏掉图形描述。字数检查抓不到这些，所以把“公式是否闭合、有没有被翻译、图形是否可信”也算进来。
// lang: 'ja' 时检查假名比例（日文题正常中位数约 24%，低于 5% 多半是被译成了中文）；
//       'auto' / 'zh' 不检查翻译（中文题本来就没有假名）。
export function ocrQuality(text, { lang = 'auto' } = {}) {
  const raw = String(text || '');
  const at = raw.indexOf('【图形】');
  const bodyRaw = (at >= 0 ? raw.slice(0, at) : raw).trim();
  const body = bodyRaw.replace(/\s+/g, '');
  const chars = [...body].length;
  const kana = (body.match(/[\u3041-\u309f\u30a0-\u30ff]/g) || []).length;
  const kanaRatio = chars ? kana / chars : 0;
  // $ 和花括号是否配对（跳过 \$、\{ 这类转义）
  let dollars = 0, braces = 0, escaped = false;
  for (const ch of bodyRaw) {
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '$') dollars++;
    else if (ch === '{') braces++;
    else if (ch === '}') braces--;
  }
  const latexBalanced = dollars % 2 === 0 && braces === 0;
  const trimmed = bodyRaw.trim();
  const endsCleanly = !trimmed || /[。．.!?！？）)\]】」』$]\s*$/.test(trimmed);
  const incomplete = !latexBalanced || /\\$/.test(trimmed) || /[=+\-*/^]\s*$/.test(trimmed);
  const lines = trimmed ? trimmed.split('\n').filter((l) => l.trim()).length : 0;
  // 整行重复（小模型偶尔把同一行写几十遍）：整段抄两遍由 dedupeOcr 处理，这里只抓“某一行出现 3 次以上”。
  // 和边识别边停用同一个判断（12 字以上的行），免得 8～11 字的行重复时中途不停、事后却又重新识别一遍。
  const repetitive = bodyRepeats(raw);
  const questions = (bodyRaw.match(/[（(]\s*[1-9１-９]\s*[)）]/g) || []).length;
  const hasFigure = at >= 0;
  const figure = hasFigure ? raw.slice(at + 4).trim() : '';
  const figureChars = [...figure].length;
  const figureRunaway = hasFigure && figureRunsAway(raw);
  const bodyMentionsFigure = FIGURE_REF.test(bodyRaw);
  const tooLittle = chars < 15;
  // 自动模式只有在已经出现假名时才按日文评分；被译成中文的结果没有假名，必须由用户把语言设成日文才检查。
  const effectiveLang = lang === 'auto' && kanaRatio >= 0.03 ? 'ja' : lang;
  const likelyTranslated = effectiveLang === 'ja' && chars >= 120 && kana < 5 && kanaRatio < 0.05;
  const reasons = [];
  if (tooLittle) reasons.push('too-little');
  if (likelyTranslated) reasons.push('translated');
  if (!tooLittle && incomplete) reasons.push('truncated');
  if (repetitive) reasons.push('repetitive');
  return {
    chars, kana, kanaRatio, lines, questions,
    latexBalanced, endsCleanly, incomplete, repetitive,
    tooLittle, likelyTranslated,
    hasFigure, figureChars, figureRunaway,
    bodyMentionsFigure,
    figureMissing: bodyMentionsFigure && !hasFigure,
    effectiveLang, reasons, needsRetry: reasons.length > 0,
  };
}

// 两遍识别结果谁更好：先看质量分，同分再看题目文字长度。
export function ocrScore(text, { lang = 'auto' } = {}) {
  const q = ocrQuality(text, { lang });
  let s = Math.min(10, q.chars / 20);
  if (q.latexBalanced) s += 6;
  if (q.incomplete) s -= 8; // 断在公式中间的长结果不能因为“字多”赢过干净的短结果
  if (q.endsCleanly) s += 2;
  if (q.lines >= 2) s += 1;
  if (q.effectiveLang === 'ja') s += q.likelyTranslated ? -12 : q.kanaRatio >= 0.05 ? 5 : 0;
  s += Math.min(3, q.questions);
  if (q.figureRunaway) s -= 6;
  if (q.repetitive) s -= 8; // 同一行写几十遍：字多不代表识别得好
  if (q.tooLittle) s -= 10;
  return s;
}

export function pickBetterOcr(a, b, opts = {}) {
  if (!a) return false;
  if (!b) return true;
  const sa = ocrScore(a, opts), sb = ocrScore(b, opts);
  if (Math.abs(sa - sb) > 0.01) return sa > sb;
  return ocrBody(a).length > ocrBody(b).length;
}

// 去掉模型输出外面的代码块标记和思考标签（App 显示识别结果、解题思路前都先这样处理；评测脚本用同一份）
export const cleanModelText = (t) => String(t).replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '').replace(/<\/?think>/g, '').trim();

// ---------------- 2. 分析题意并生成作图命令 ----------------
// 长度上限远高于正常输出，作用是防止小模型陷入重复输出的循环（Ollama 和手机端的 GBNF 都会强制执行）
export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 30 },
    category: { type: 'string', enum: CATEGORIES },
    knowns: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 10 },
    goal: { type: 'string', maxLength: 200 },
    layout: { type: 'string', maxLength: 500 },
    commands: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 60 },
    insight: { type: 'string', maxLength: 240 },
  },
  required: ['title', 'category', 'knowns', 'goal', 'layout', 'commands', 'insight'],
  additionalProperties: false,
};

export const ANALYZE_SYSTEM = `你是“数形结合”可视化助手。读懂用户给出的数学题，输出一个 JSON：先分析题意，再用“作图命令”画出最能帮助理解这道题的图形（函数图像、几何图形、立体图形、线段图），概率、统计题列出表格。

# 输出字段
- title：10 个字以内的题目名称
- category：题型
- knowns：已知条件列表，每条一句，数学式写在 $...$ 中
- goal：所求问题，一句话
- layout：作图推演。先选坐标系，再算出每个关键点的坐标并写出计算过程（如“B(-3,0)、C(3,0)，由 AB=5 得 A(0,4)”），保证图形满足题目中所有的长度、角度、比例关系
- commands：作图命令数组，每个元素是一条命令（语法见下文）
- insight：观察要点，1~2 句话，告诉用户看图、拖动点或调节滑块时应该注意什么，不要写出完整答案

# 作图命令（与 GeoGebra 相似）
每条命令形如「名称 = 定义」，名称只用字母、数字和 '（如 A、B1、P、l1、f）。末尾可以写 "标签文字" 和 #标记。
点：
  A = (2, 3)                    坐标点；坐标可以含参数，如 P = (t, t^2)
  A = (1, 0, 2)                 三维点（出现三维点就进入立体模式）
  M = Midpoint(A, B)            中点
  P = A + 2/3*(B - A)           向量运算，可求定比分点
  H = Foot(P, Line(A, B))       垂足
  P = Intersect(a, b)           交点；有两个交点时写 Intersect(a, b, 1) 或 Intersect(a, b, 2)
  P = Point(c, (x0, y0))        在图形 c 上可拖动的动点，初始位置在 (x0, y0) 附近
  O = Center(c)，Circumcenter(A, B, C)，Incenter(A, B, C)，Centroid(A, B, C)
  A' = Rotate(A, 90°, O)，Reflect(A, l)，Translate(A, (2, 0))
线：
  Segment(A, B)，Line(A, B)，Ray(A, B)，Vector(A, B)
  Perpendicular(P, l)，Parallel(P, l)，PerpendicularBisector(A, B)，AngleBisector(A, B, C)
  Tangent(1, f)                 函数 f 在 x=1 处的切线
  Root(f, 1)  Extremum(f, 1)  Vertex(f)   函数的第 1 个零点、第 1 个极值点、抛物线顶点（由程序计算，不要自己算坐标）
  x 轴写 xAxis，y 轴写 yAxis，例如 Intersect(f, xAxis, 1)
  l: y = 2x + 1                 直线方程；竖直线写 l: x = 3
圆与曲线：
  c = Circle(O, 2)，Circle(O, A)，Circle(A, B, C)，Arc(O, A, B)
  f(x) = x^2 - 2x + 1           函数
  g(x) = Function(x^2, 0, 2)    限定定义域 [0, 2] 的函数
  h(x) = If(x < 0, -x, x^2)     分段函数
  E: x^2/4 + y^2/3 = 1          任意方程的曲线（圆锥曲线等）
  Curve(2cos(t), sin(t), t, 0, 2pi)  参数曲线
  Polygon(A, B, C)              多边形（立体模式下表示一个面）
标注：
  Angle(B, A, C) "α"            角的记号，顶点写在中间；直角会自动画成直角符号
  Text("AB = {Distance(A, B)}", (1, 3))   文字，{ } 中的表达式会实时计算
  Brace(A, B, "360 千米")        线段图的大括号标注
  Integral(f, 0, 2)             函数与 x 轴围成的面积
  Region(x + y <= 4, x >= 0, y >= 0)   不等式组表示的区域（线性规划）
表格（概率、统计题）：
  Table(性别与是否近视)          开始一个表格（标题可以省略）
  Row(性别, 近视, 不近视)        每行一条命令，第一行是表头；文字直接写，不加引号
  Row(男生, 0.6*0.3, 0.6*0.7)    数值写算式，由程序计算（写了除号的显示成分数，如 1/8）；含滑块参数时随滑块变化
参数与视图：
  a = Slider(-2, 4, 1)          可拖动的参数：最小值、最大值、初始值
  k = 2                         常数
  ShowAxes(false)               纯几何题、线段图必须关闭坐标轴
  ZoomIn(xmin, ymin, xmax, ymax)   显示范围（一般省略，会自动适配）
立体：
  Sphere(O, r)，Cylinder(A, B, r)，Cone(A, B, r)（A 为底面圆心，B 为顶点）
  ShowAxes(true)                显示空间直角坐标系（用坐标法时）
标记：
  #aux 辅助线  #hl 重点  #result 答案  #eq1 #eq2 等长记号  #open 空心点  #fixed 禁止拖动
表达式：+ - * / ^、sqrt()、abs()、sin()、cos()、tan()、ln()、exp()、pi、度数写 30°；乘号可以省略，如 2x、2a x。

# 作图要求
1. 图形必须和题目一致：先在 layout 中算好坐标，再按算好的坐标作图。
2. 平面几何：关闭坐标轴；顶点按教材习惯摆放（△ABC 的 A 在上方，B 在左下，C 在右下），只画题目提到的点和线，辅助线加 #aux。
3. 函数：画出函数图像，标出零点、极值点、交点等关键点；题目含参数（如 a、k、m）时一定要用 Slider，让用户拖动观察。
4. 立体几何：z 轴向上。正方体 ABCD-A1B1C1D1 以 D 为原点，A 在 x 轴、C 在 y 轴、D1 在 z 轴上，并写出全部 12 条棱；被遮挡的棱会自动画成虚线。
5. 动点问题：用 Slider 表示时间或路程，用 If 写出分段的位置。
6. 应用题：画线段图（关闭坐标轴），用 Brace 标注数量。
7. 只能使用上面列出的命令，不要自创命令名：垂足写 F = Foot(D, Line(A, E))，交点写 Intersect(a, b)。引用的名称必须先定义。
8. #eq1、#eq2 是等长记号：同一组相等的线段用同一个标记，长度不相等的线段不能用同一个标记。直角记号 Angle(D, F, A) 中，直角的顶点 F 写在中间。
9. 图中要显示长度、面积、角度等数值时，一律写成实时表达式，如 Text("DF = {Distance(D, F)}", (1, 7))，由程序计算；不要把自己算出的结果写进图里。Text 里不要写 LaTeX。
10. 概率、统计题（条件概率、分布列、列联表、列举所有可能的结果）用 Table、Row 列出表格，只列表格、不画图；不要画和题目无关的函数图像。表格里的文字不加引号。

# 示例
题目：如图，在△ABC中，AB=AC=5，BC=6，D为BC的中点，DE⊥AC于点E，求DE的长。
输出：
{"title":"等腰三角形中的垂线段","category":"平面几何","knowns":["$AB=AC=5$，$BC=6$","$D$ 为 $BC$ 中点","$DE\\\\perp AC$ 于点 $E$"],"goal":"求 $DE$ 的长","layout":"取 BC 中点 D 为原点，B(-3,0)、C(3,0)；AD⊥BC，AD=√(25-9)=4，所以 A(0,4)。E 是 D 在 AC 上的垂足。","commands":["ShowAxes(false)","A = (0, 4)","B = (-3, 0)","C = (3, 0)","Polygon(A, B, C)","D = Midpoint(B, C)","Segment(A, D) #aux","E = Foot(D, Line(A, C))","Segment(D, E) #hl","Angle(D, E, C)","Segment(A, B) #eq1","Segment(A, C) #eq1"],"insight":"等腰三角形三线合一，$AD\\\\perp BC$；在 $\\\\triangle ADC$ 中用面积法求 $DE$。"}

题目：某校学生中男生占 60%，男生中近视的占 30%，女生中近视的占 20%。随机抽取一名学生，已知他近视，求他是男生的概率。
输出：
{"title":"近视学生是男生的概率","category":"概率统计","knowns":["男生占 60%，女生占 40%","男生近视率 30%，女生近视率 20%"],"goal":"求 P(男生|近视)","layout":"按性别和是否近视列出各种情况的概率，再用条件概率公式。","commands":["Table(性别与是否近视的概率)","Row(性别, 近视, 不近视, 合计)","Row(男生, 0.6*0.3, 0.6*0.7, 0.6)","Row(女生, 0.4*0.2, 0.4*0.8, 0.4)","Row(合计, 0.6*0.3+0.4*0.2, 0.6*0.7+0.4*0.8, 1)","Row(P(男生|近视), 0.6*0.3/(0.6*0.3+0.4*0.2))"],"insight":"看“近视”这一列：近视的学生里男生所占的比例，就是所求的条件概率。"}

题目：已知函数 f(x)=x²-2ax+3，求 f(x) 在区间 [0,2] 上的最小值。
输出：
{"title":"含参二次函数的最值","category":"函数","knowns":["$f(x)=x^2-2ax+3$，对称轴 $x=a$","区间 $[0,2]$"],"goal":"求 $f(x)$ 在 $[0,2]$ 上的最小值","layout":"参数 a 用滑块，范围 -1 到 3；对称轴 x=a；区间 [0,2] 上的部分加粗；最小值点横坐标 m 按 a<0、0≤a≤2、a>2 分段。","commands":["a = Slider(-1, 3, 1)","f(x) = x^2 - 2a x + 3","g(x) = Function(x^2 - 2a x + 3, 0, 2) #hl","l: x = a #aux","m = If(a < 0, 0, If(a > 2, 2, a))","P = (m, f(m)) \\"最小值点\\" #result"],"insight":"拖动滑块 $a$，观察对称轴与区间 $[0,2]$ 的位置关系如何决定最小值的位置。"}`;

export function analyzeUserText(text, hint, hasImage) {
  let s = `题目：\n${text.trim()}`;
  if (hint) s += `\n\n补充说明：${hint}`;
  if (hasImage) s += '\n\n（附图是题目原图，如有图形请参考图中各点的位置作图。）';
  return s;
}

// ---------------- 3. 作图命令出错时自动修正一次 ----------------
export const REPAIR_SCHEMA = {
  type: 'object',
  properties: { commands: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 60 } },
  required: ['commands'],
  additionalProperties: false,
};

// issues：程序核对出的、图形不符合题目的地方（例如“DE ⊥ AC（图中夹角 84.3°）”“缺少点 C”）
export function repairUserText(text, commands, errors, issues = []) {
  const list = commands.map((c, i) => `${i + 1}. ${c}`).join('\n');
  let s = `题目：\n${text.trim()}\n\n你之前给出的作图命令：\n${list}\n\n`;
  if (errors.length) s += `其中这些命令有错误：\n${errors.map((e) => `第 ${e.line + 1} 行「${e.src}」：${e.message}`).join('\n')}\n\n`;
  if (issues.length) s += `程序核对发现，画出的图形不符合题目中的这些条件：\n${issues.map((x) => `- ${x}`).join('\n')}\n\n`;
  const todo = [errors.length ? '修正这些错误' : '', issues.length ? '让图形满足题目条件（点的名字要和题目一致，长度、角度要按题目数据确定坐标）' : ''].filter(Boolean).join('，并');
  return `${s}请只使用系统提示里列出的命令${todo}，保留其它正确的命令，输出修改后的完整命令列表，格式为 {"commands": ["...", "..."]}，每个元素是一条命令，不要带行号。`;
}

// ---------------- 4. 解题思路（可选） ----------------
export const SOLVE_SYSTEM = `你是耐心、严谨的中学数学老师。请为用户给出的题目写出解题过程：
- 第一行以「**思路**：」开头，用一句话点明关键方法；
- 然后分步骤解答，用 1. 2. 3. 编号，每一步简洁清楚；
- 最后一行以「**答案**：」开头写出结论；
- 数学式用 LaTeX，行内写在 $...$ 中，独立公式写在 $$...$$ 中；
- 如果附有作图命令，可以结合图中的点和线来说明。`;

export function solveUserText(text, commands) {
  let s = `题目：\n${text.trim()}`;
  if (Array.isArray(commands) && commands.length) s += `\n\n已画出的图形（作图命令）：\n${commands.slice(0, 80).join('\n')}`;
  return s;
}
