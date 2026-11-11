# 过去问集（日本旧帝大近年理系数学）

用真实的入学考试题衡量“拍照 → 识别 → 作图”的效果。题集定义在 [`eval/exam.js`](../exam.js)，共 73 道题。

## 来源

2026-11-11 从各大学官网下载（用户同意后下载）。各校官网公开的年份不同：

| 大学 | 年度（一般选拔前期，理系数学） | 题数 |
|---|---|---|
| 東京大学 | 2024、2025、2026 | 18 |
| 京都大学 | 2025、2026（官网只公开两年） | 12 |
| 大阪大学 | 2026（官网只公开这一年） | 5 |
| 名古屋大学 | 2024、2025、2026 | 12 |
| 東北大学 | 2026（官网只公开这一年） | 6 |
| 九州大学 | 2025、2026 | 10 |
| 北海道大学 | 2025、2026（2024 年度已于 2024-09-30 下架） | 10 |

文件（`pdf/`，SHA-256 取前 16 位）：

| 文件 | 来源 | 大小 | SHA-256 |
|---|---|---|---|
| todai-2024.pdf | https://www.u-tokyo.ac.jp/content/400263415.pdf | 673,723 | 3bb670efd8ae0ae9 |
| todai-2025.pdf | https://www.u-tokyo.ac.jp/content/400287588.pdf | 529,265 | 03889aecf7b4823e |
| todai-2026.pdf | https://www.u-tokyo.ac.jp/content/400239118.pdf | 886,413 | 3110990be23b329a |
| kyodai-2025.pdf | https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_3M04-9acd1fcb2bd4a749430c5d4444aa5419.pdf | 100,993 | 58753e7ec596f78b |
| kyodai-2026.pdf | https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR08_eqdocumentsR08_3M04-67eab9889126ec2b1c07384f2e5e4fff.pdf | 69,234 | 413490b49064c1c9 |
| handai-2026.pdf | https://www.osaka-u.ac.jp/ja/admissions/faculty/general/files/xq7bkl/@@download/file | 3,083,687 | b75b4a77f91b5f4f |
| meidai-2024.pdf | https://www.nagoya-u.ac.jp/admissions/exam/upload/3-1_r6mondai_math-ri.pdf | 85,440 | 35eac307785fe994 |
| meidai-2025.pdf | https://www.nagoya-u.ac.jp/admissions/exam/upload/3-1_r7mondai_math-ri.pdf | 95,355 | a7ba0812410a8ee8 |
| meidai-2026.pdf | https://www.nagoya-u.ac.jp/admissions/exam/upload/3-2_r8mondai_math_ri.pdf | 86,510 | 9ec8406aa737acfb |
| tohokudai-2026.pdf | https://admissions.tohoku.ac.jp/ja/adcms/wp-content/uploads/2026/05/eq_2026mathematics_s.pdf | 843,883 | f525eb819871f89b |
| kyudai-2025.pdf | https://www.kyushu-u.ac.jp/f/61066/2025_sugaku_rikei_kyudai.pdf | 1,373,961 | 11fd85fc31d95b96 |
| kyudai-2026.pdf | https://www.kyushu-u.ac.jp/f/65328/2026_sugaku_rikei_kyudai.pdf | 1,761,821 | 6412aae66b04f882 |
| hokudai-2025.pdf | https://www.hokudai.ac.jp/admission/R07_Aexam_MathB.pdf | 565,375 | 9f54323f9cb87005 |
| hokudai-2026.pdf | https://www.hokudai.ac.jp/admission/R08_Aexam_MathB.pdf | 331,599 | 150ae008b2c23b74 |
| todai-2026-ans.pdf | https://www.u-tokyo.ac.jp/content/400239145.pdf | 514,507 | 3504a7752c9fd2d6 |
| kyodai-2025-ans.pdf | https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR07_eqdocumentsR07_3M04-fa877291099b827b01bb54be3f57c828.pdf | 191,570 | 2b00683cd278bca6 |
| kyodai-2026-ans.pdf | https://www.kyoto-u.ac.jp/sites/default/files/inline-files/admissionsundergradpast_eqR08_eqdocumentsR08_3_M04-c07252a84dded205bf1b783c16958a54.pdf | 238,870 | defff8cc25abad3a |
| meidai-2024-ans.pdf | https://www.nagoya-u.ac.jp/admissions/exam/upload/3_r6ito__math-ri.pdf | 159,985 | f5737397292882f1 |
| meidai-2025-ans.pdf | https://www.nagoya-u.ac.jp/admissions/exam/upload/3_r7ito__math-ri.pdf | 29,728 | 296cc8564bd85d56 |
| meidai-2026-ans.pdf | https://www.nagoya-u.ac.jp/admissions/exam/upload/3_r8ito_math_1.pdf | 24,035 | 71bde7e2786797ad |
| tohokudai-2026-ans.pdf | https://admissions.tohoku.ac.jp/ja/adcms/wp-content/uploads/2026/05/2026mathematics.pdf | 548,660 | 1f681e3d05f29aa0 |
| kyudai-2025-ans.pdf | https://www.kyushu-u.ac.jp/f/61089/2025_ito_sugaku_kyudai.pdf | 97,073 | 4852488b781dbf31 |
| kyudai-2026-ans.pdf | https://www.kyushu-u.ac.jp/f/65351/2026_ito_sugaku_kyudai.pdf | 48,467 | 20941d64c65cd535 |
| hokudai-2025-ans.pdf | https://www.hokudai.ac.jp/admission/06_R7zenki_math_b_answer.pdf | 123,415 | 5079bdb60feefca3 |
| hokudai-2026-ans.pdf | https://www.hokudai.ac.jp/admission/06_R8zenki_math_b_answer.pdf | 278,073 | 9b84de3c25aa2f2f |

`-ans` 是各校公开的解答例或出题意图（阪大理系没有公开）。检验条件只用题目给出的条件，没有用到它们；留着供以后核对。

## 使用上的限制

- 试题的著作权属于各大学。这些文件只在本机评测用，不对外发布，不放进 App。
- 东大、阪大、九大等有“入试问题二次利用”的规定（发布、汇编、上传网络等需要申请或报告）。以后如果要公开（比如放到 GitHub、App 或网上），先按各校规定办理。
- 题目原文不抄进代码和文档：`eval/exam.js` 里只有出处、Claude 写的题目概要和检验条件；评测时由模型从图片识别文字。

## 目录

| 路径 | 内容 |
|---|---|
| `pdf/` | 下载的原始 PDF |
| `images/` | 每题一张图片（150 DPI），由 `make-images.mjs` 按 `eval/exam.js` 里的 `src` 裁出 |
| `ocr/<模型>/` | 评测时识别出的题目文字（第一次评测时生成，之后复用；内容接近原文，同样不对外发布） |
| `tools/pdftool.swift` | 渲染、裁剪 PDF 的小工具（只用 macOS 自带的 PDFKit） |
| `ref-check.mjs` | 检验条件的自测：73 道题的“画对的图”都能通过，“画错的图”都会被检出 |
| `ocr-review.md` | 识别结果逐题核对（73 道全部对照原图）：23 道正确、43 道小错、7 道影响题意 |

## 用法

```sh
node eval/exam/make-images.mjs          # 重新生成题目图片（需要 macOS）
node eval/exam/ref-check.mjs            # 自测检验条件
sh train/eval_model.sh qwen3.5:2b-q4_K_M exam 2     # 评测（会先识别图片，结果缓存在 ocr/）
```

## 规则

- 只用来衡量，不根据它的结果调整规则或训练数据（和保留集一样，只看总数和各题型的总数）。
- 检验的是“题目给出的条件画对了没有”：给出的点、曲线、长度、角度、立体；题目要求求出或图示的东西（轨迹、区域、最值）是答案，不检验。
- 不需要图的题（整数、组合、概率等，共 22 道）：列了表格，或者没有画无关的图形，就算通过。
- 所有模型用同一份识别结果作图（默认由 qwen3.5:2b-q4_K_M 识别，手机上识别用的也是原 2B），这样比较的只是作图能力；识别本身的好坏另外看。
