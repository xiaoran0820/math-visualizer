# 训练数形自己的模型（LoRA 微调，全程本地）

目标：让小模型（Qwen3.5 2B、0.8B）第一次就画对图，少修正、少重新生成；输出更短；系统提示从约 2700 token 缩到约 220 token。全部在这台 Mac 上用 MLX 完成，不用云端。

训练出来的是一个“LoRA”（约 30 MB 的附加权重），加在原来的量化模型上：

- **手机上**：把 `adapter.gguf` 放进模型文件夹（和 `model.gguf` 放在一起）。App 在分析题意、修正命令时启用它，并改用短系统提示（`ANALYZE_SYSTEM_TUNED`）；拍照识别、解题思路仍用原模型，不受训练影响。
- **电脑上（Ollama）**：Ollama 0.40 起不能加载 LoRA，所以把 LoRA 合并进模型再量化，得到一个普通的模型文件。模型名里带 `shuxing` 时，服务端自动用短系统提示。

## 目录

| 路径 | 内容 |
|---|---|
| `gen/` | 训练数据生成器：41 类题型随机出题（第三版加了 `more4.js` 的 6 类），参考答案由程序算出，逐题用 App 的引擎校验（`gen/build.js`），再整理成对话数据（`gen/dataset.js`，最后打印每个命令出现在多少道题里） |
| `data/mlx-v2/` | 第二版训练数据（`train.jsonl`、`valid.jsonl`、`meta.json`）；`data/mlx-v2a/` 是补足少见命令之前的版本（0.8B 用的），`data/mlx/` 是最近一次生成的 |
| `lora-2b.yaml`、`lora-2b-v2.yaml`、`lora-2b-v3.yaml`、`lora-0.8b.yaml` | 作图（分析题意）的训练配置（2B 第一～三版、0.8B） |
| `ocr/` | 第三版新增的“看图识别”训练：`texts.mjs`（试卷式题目文字）、`render.swift`（WebKit + KaTeX 渲染成图片）、`augment.py`（做成拍照/扫描的样子）、`make-data.mjs`（生成 `data/ocr/`、`data/ocr-test.jsonl`）、`eval_ocr.mjs`（用手机引擎评测识别） |
| `lora-ocr.yaml`、`train_ocr.py`、`vlm_processor.py` | 识别 LoRA 的训练配置和入口（mlx-vlm；先把循环层换成核对过的分块算法，图片处理器换成不依赖 PyTorch 的版本） |
| `after-v3.sh` | 第三版训练结束后的全部转换和评测 |
| `test_chunked_vlm.py` | 核对换进 mlx-vlm 的分块算法和它自带的逐 token 算法一致（输出、状态、梯度） |
| `train_lora.py` | 启动训练；把 Qwen3.5 的循环层换成分块并行算法（`chunked_delta.py`），否则每步 20 秒 |
| `chunked_delta.py`、`test_chunked_delta.py` | 分块并行算法，以及它和 MLX 原来逐 token 算法的核对（输出、状态、梯度） |
| `verify_mapping.py` | 核对原始权重里的线性层和 GGUF 里的张量是否一一对应（LoRA 只能加在一一对应的层上） |
| `make_model.sh` | LoRA → `out/<名字>/adapter.gguf`（手机用）和 `out/<名字>/model.gguf`（合并后重新量化，Ollama 用） |
| `eval_model.sh` | 在 Ollama 里建模型并评测（Ollama 只在评测期间运行）；题集可选 `dev`（开发集）、`holdout`（保留题）、`fresh`（新题型集，`eval/fresh.js`） |
| `cli_eval.mjs` | 用手机上的同一份引擎（Mac 版 llm-cli）跑题集的第一次分析，核对“原模型 + `adapter.gguf`”这种手机上的用法 |
| `adapter_to_gguf.py`、`merge_lora.py` | 上面两个脚本用到的转换程序（只用 llama.cpp 的 gguf-py，不需要 PyTorch） |
| `pfetch.py`、`fetch-ms.sh` | 下载原始权重（ModelScope，8 段并行、可续传、SHA-256 校验） |
| `base/` | 原始权重；`.venv/` Python 虚拟环境（mlx-lm）；`adapters/` 训练结果；`out/` 做好的模型；`logs/` 训练日志 |

## 步骤

```sh
# 0. 只需一次：虚拟环境 + 权重
sh train/setup.sh && sh train/fetch-ms.sh

# 1. 生成训练数据（在项目根目录）；第二版用的是种子 11，生成后复制成 data/mlx-v2
node train/gen/dataset.js 30 11 && cp -R train/data/mlx train/data/mlx-v2

# 2. 核对算法和权重（在 train/ 目录）
.venv/bin/python test_chunked_delta.py
.venv/bin/python verify_mapping.py base/Qwen3.5-2B ../ios/iphone-install/models/qwen3.5-2b-q4_K_M/model.gguf

# 3. 训练（2B 约 40 分钟，M4 Pro）；第二版 2B 用 lora-2b-v2.yaml，0.8B 用 lora-0.8b.yaml
.venv/bin/python train_lora.py -c lora-2b-v2.yaml

# 4. 做成模型文件，评测
sh make_model.sh adapters/2b-v1 shuxing-2b-v1          # 第三个参数可以指定中间版本的步数，如 260
sh eval_model.sh shuxing-2b-v1 dev 2                    # 先开发集
sh eval_model.sh shuxing-2b-v1 fresh 2                  # 新题型集：训练里没有的题型，看会不会变差
sh eval_model.sh shuxing-2b-v1 holdout 2                # 最后保留题（只看总数）
BASE_OLLAMA=qwen3.5:0.8b-q8_0 sh eval_model.sh shuxing-0.8b-v1 dev 2   # 0.8B：指定原模型（用它的 Modelfile）

# 5. 手机引擎核对（项目根目录；models-cli 下每个文件夹里是 model.gguf，可选 adapter.gguf）
node train/cli_eval.mjs train/out/models-cli qwen3.5-2b-lora-v1 dev --lora
```

### 第三版：看图识别（mlx-vlm）

```sh
# 1. 识别的训练数据（项目根目录；渲染工具第一次用时编译：xcrun swiftc -O -o train/ocr/build/render train/ocr/render.swift）
node train/ocr/make-data.mjs 2000          # → train/data/ocr/（训练、验证）、train/data/ocr-test.jsonl（评测，带标准答案）

# 2. 核对换进 mlx-vlm 的循环层算法（在 train/ 目录）
.venv/bin/python test_chunked_vlm.py

# 3. 训练（约 70 分钟）；不需要 PyTorch（vlm_processor.py 换了图片处理器）
.venv/bin/python train_ocr.py -c lora-ocr.yaml

# 4. 转成手机用的文件：放进手机上 2B 的模型文件夹，命名为 adapter-ocr.gguf
.venv/bin/python adapter_to_gguf.py adapters/ocr-v1 ../ios/iphone-install/models/qwen3.5-2b-q4_K_M/model.gguf out/ocr-v1/adapter-ocr.gguf

# 5. 评测识别（项目根目录；文件夹里要有 model.gguf、mmproj.gguf、adapter-ocr.gguf）
node train/ocr/eval_ocr.mjs train/out/models-cli qwen3.5-2b-v3 test --lora --name shuxing-ocr-v1
node train/ocr/eval_ocr.mjs train/out/models-cli qwen3.5-2b-v3 exam --lora --name shuxing-ocr-v1
```

第三版的全部转换和评测写在 `after-v3.sh` 里（两段训练结束后自动依次运行）。

## 训练数据怎么保证是对的

- 题目和参考答案都由程序生成：坐标、交点、极值点由程序算，不是人写的，也不是模型写的。
- 每道题用 App 自己的引擎校验三件事：命令全部能执行；从题目文字里提取出的条件全部满足；程序不需要再补画。还要满足输出格式的长度上限。
- 和开发集、保留题太像的题（字的三元组重合超过一半）自动去掉。保留题的内容不参与任何调整。
- 约一成的样本是“修正”：把正确的命令故意改错，附上引擎报的错误，答案是正确的命令。
- 每道题有键盘输入、拍照识别（LaTeX）两种写法，一部分题型还有日文写法。

## 已验证

- 分块并行算法和 MLX 原来的算法：输出、状态、6 个输入的梯度，相对误差都在 1e-6 以内（包括遗忘门小到 1e-14 的情况）；真模型上每一步的损失几乎相同。
- 原始权重和 GGUF 里的张量：2B、0.8B 都一一对应。
- B = 0 的 LoRA：手机引擎直接加载时输出和原模型一字不差；合并后重新量化，320 个张量里 236 个逐字节相同，其余平均相对差约 0.18%。

## 结果（2026-11-11，详见 `docs/model-eval.md` 的“结果三”）

电脑上，Ollama，best3 流程，各跑 2 轮；“保留集”的题没有参与训练，“新题型集”的题型不在训练数据里。

| | 保留集完全正确 | 新题型集完全正确 | 平均耗时（保留集） |
|---|---|---|---|
| 原 2B | 39% | 50% | 13.1 秒 |
| 2B 第一版（`adapters/2b-v1`） | 63% | 59% | 4.3 秒 |
| **2B 第二版（`adapters/2b-v2`）** | **71%** | 56% | 4.2 秒 |
| 原 0.8B | 39% | 38% | 12.9 秒 |
| 0.8B（`adapters/0.8b-v1`） | 50% | 50% | 3.7 秒 |

- 手机上建议用 2B 第二版：把 `out/shuxing-2b-v2/adapter.gguf` 放进手机上 2B 的模型文件夹。
- 手机引擎核对（`cli_eval.mjs`，开发集 19 题，只看第一次生成）：原模型 + 第二版 `adapter.gguf` 完全正确 18/19，原 2B 用长提示 10/19；输入 282 token 对 2806 token。
- 没学过的题型上，微调做到的是“不变差、快约 3 倍”；要让更多题型做对，需要扩大训练数据覆盖的题型。
