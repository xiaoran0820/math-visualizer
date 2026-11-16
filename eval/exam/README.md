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

---

# 第二组（神户大学、一桥大学、东京科学大学，2026-11-12）

第一组已经用来设计第三版的训练题型、发现识别 LoRA 的问题，再用它衡量下一版就不公平。第二组换了大学，题集定义在 [`eval/exam2.js`](../exam2.js)，共 58 道题，分成开发集、测试集各 29 道。

## 来源

2026-11-12 从各大学官网下载（你选了「全部下载」后下载）。旧帝大以外，Claude 查到官网直接公开理系数学题目 PDF 的只有这三所；千叶、筑波、横滨国立、广岛、大阪公立没有找到公开的学部题目，早稻田的网站拒绝了访问。

| 大学 | 年度 · 日程 | 题数 |
|---|---|---|
| 神戸大学 | 2024、2025、2026 前期（理科系）；2024、2025、2026 后期（理科系） | 30 |
| 一橋大学 | 2025、2026 前期；2025、2026 后期（官网只公开两年） | 20 |
| 東京科学大学 | 2026 前期 理工系 5 题、医学科 3 题（官网只公开这一年） | 8 |

文件（`pdf/`，SHA-256 取前 16 位）：

| 文件 | 来源 | 大小 | SHA-256 |
|---|---|---|---|
| kobe-2024.pdf | https://www.office.kobe-u.ac.jp/stdnt-examinavi/wp-content/uploads/2024/06/03_z_sugaku_ri_R6.pdf | 1,106,737 | ef6d906bdb47f093 |
| kobe-2025.pdf | https://www.office.kobe-u.ac.jp/stdnt-examinavi/wp-content/uploads/2025/05/03_z_sugaku_ri_R7.pdf | 1,033,653 | cf0065c35dd4f602 |
| kobe-2026.pdf | https://www.office.kobe-u.ac.jp/stdnt-examinavi/wp-content/uploads/2026/05/03_z_sugaku_ri_R8.pdf | 1,084,965 | 222269669579ff69 |
| kobe-2024k.pdf | https://www.office.kobe-u.ac.jp/stdnt-examinavi/wp-content/uploads/2024/06/06_k_sugaku_ri_R6.pdf | 1,074,031 | 91e7b49df85d85cb |
| kobe-2025k.pdf | https://www.office.kobe-u.ac.jp/stdnt-examinavi/wp-content/uploads/2025/05/06_k_sugaku_R7.pdf | 1,012,251 | afb2e59ea17bb5be |
| kobe-2026k.pdf | https://www.office.kobe-u.ac.jp/stdnt-examinavi/wp-content/uploads/2026/05/06_k_sugaku_R8.pdf | 996,369 | 1761f1601886083f |
| hitotsubashi-2025.pdf | https://juken.hit-u.ac.jp/admission/info/files/R7_02_suugaku_zenki_mondai.pdf | 712,540 | da3eeaf641ab62ff |
| hitotsubashi-2026.pdf | https://juken.hit-u.ac.jp/admission/info/files/R8_02_suugaku_zenki_mondai.pdf | 658,534 | d18df39684a3d2bd |
| hitotsubashi-2025k.pdf | https://juken.hit-u.ac.jp/admission/info/files/R7_03_suugaku_kouki_mondai.pdf | 733,757 | 424f1d9b3972e3b2 |
| hitotsubashi-2026k.pdf | https://juken.hit-u.ac.jp/admission/info/files/R8_03_suugaku_kouki_mondai.pdf | 663,266 | dcb05fe5edc60f5d |
| isct-2026.pdf | admissions.isct.ac.jp 学部「過去の入試問題」页的“理工学系 数学 問題”（01_R8数学-問題） | 648,637 | b7b75786dc35ab5c |
| isct-2026-med.pdf | 同上页的“数学（医学科）問題”（01_一般_問題_数学（医学科）） | 465,360 | 502fe5ed43f1cca3 |
| isct-2026-dent.pdf | 同上页的“数学（歯学科・保健衛生学科検査技術学専攻）問題” | 467,696 | 754dbe8651175e49 |

- 只下载了题目，没有下载解答和出题意图。
- 东京科学大学的下载链接是带参数的长地址，这里写的是页面上的链接名；页面：https://admissions.isct.ac.jp/ja/013/undergraduate/examination-questions
- `isct-2026-dent.pdf`（齿学科卷）前两题和医学科卷完全相同，第 3 题是医学科第 3 题的变体，为了不重复，没有收进题集。

## 使用上的限制

- 和第一组一样：试题的著作权属于各大学，文件只在本机评测用，不对外发布，不放进 App；题目原文不抄进代码和文档。
- 一桥大学官网有《入学者选拔试题的 2 次利用》说明和报告书格式；东京科学大学（理工学系）有试题二次利用的申请表；神户大学的页面只写了“因著作权关系，部分试题未公开”。以后如果要公开，先按各校规定办理。

## 开发集和测试集

- 按“大学 × 要不要画图”分组，每组用固定种子（20261112）打乱后取一半当开发集；奇数组交替多给开发集、测试集一题。划分在看任何结果之前定下，之后不再改动。
- 开发集（29 道）：可以逐题看结果，用来查原因、改程序。
- 测试集（29 道）：只看汇总，不根据它调整任何东西（和保留集一样）。

## 用法

```sh
node eval/exam/make-images.mjs                      # 两组的题目图片一起生成（需要 macOS）
node eval/exam/ref-check.mjs                        # 两组的检验条件一起自测（131 道）
sh train/eval_model.sh shuxing-2b-v3 exam2-test 2   # 评测第二组的测试集（--set exam2 / exam2-dev / exam2-test）
```

- 裁剪：神户大学、东京科学大学（理工系）的页面四周有裁切标记，`src` 多了左右边界（只取 x 60～760）。58 张图 Claude 逐张看过，题目完整，没有混进别的题和标记。
- 检验条件自测：58 道题每道都写了“画对的图”（`ref-check.mjs`），全部通过；“画错的图”全部被检出。
- 识别：用手机引擎的原模型识别（`ocr/phone-base/`），58 道全部对照原图核对，见 [`ocr-review-exam2.md`](ocr-review-exam2.md)：12 道正确、41 道小错、5 道影响题意。
