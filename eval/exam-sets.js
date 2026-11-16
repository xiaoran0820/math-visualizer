// 两组过去问的统一入口：评测脚本和 eval/exam/、train/ocr/ 下的工具都从这里取题。
//   exam        第一组：旧帝大（eval/exam.js，73 题，只用来衡量）
//   exam2       第二组：神户、一桥、东京科学大学（eval/exam2.js，58 题）
//   exam2-dev   第二组的开发集（29 题，可以逐题看）
//   exam2-test  第二组的测试集（29 题，只看汇总）
import { EXAM } from './exam.js';
import { EXAM2 } from './exam2.js';

export const EXAM_SETS = {
  exam: EXAM,
  exam2: EXAM2,
  'exam2-dev': EXAM2.filter((p) => p.split === 'dev'),
  'exam2-test': EXAM2.filter((p) => p.split === 'test'),
};

export const ALL_EXAM = [...EXAM, ...EXAM2];

// 题号的写法（核对记录表格里用）：todai-2024-1、kobe-2024k-3、isct-2026m-2
export const EXAM_ID = '[a-z]+-20\\d\\d[a-z]?-\\d';
