# 训练数形自己的模型（LoRA 微调，全程本地）

目标：让小模型（Qwen3.5 2B，之后 0.8B）第一次就画对图，少修正、少重新生成；训练后的模型用很短的系统提示（`ANALYZE_SYSTEM_TUNED`，约 150 token，通用提示约 2700 token），手机上更快、更省内存。模型名里带 `shuxing` 时，App 自动用短提示（`public/lib/prompts.js` 的 `analyzeSystemFor`）。

## 目录

| 路径 | 内容 |
|---|---|
| `gen/` | 训练数据生成器：21 类题型随机出题，参考答案由程序算出，逐题用 App 的引擎校验 |
| `data/mlx/` | 生成好的训练数据（`train.jsonl`、`valid.jsonl`、`meta.json`） |
| `lora-2b.yaml` | 2B 的训练配置（MLX） |
| `verify_mapping.py` | 核对原始权重里的线性层和 GGUF 里的张量是否一一对应 |
| `merge_lora.py` | 把训练出的 LoRA 合并进原来的 GGUF（没加 LoRA 的张量逐字节照抄） |
| `adapter_to_gguf.py` | 把 LoRA 单独转成 GGUF（手机引擎可以直接加载 `adapter.gguf`；Ollama 0.40 已不支持） |
| `../native/local-model/tools/quantize.sh` | 用 App 同一份 llama.cpp 量化成 Q4_K_M |
| `base/` | 下载的原始权重（ModelScope，和 Hugging Face 同一份文件，SHA-256 校验） |
| `.venv/` | Python 虚拟环境（mlx-lm） |
| `smoke/` | 流程测试用的迷你模型和配置 |

## 步骤

```sh
cd train
sh setup.sh                                  # 只需一次：虚拟环境 + mlx-lm
python3 pfetch.py <URL> <文件> <字节数> 8     # 下载慢时分段并行（fetch-ms.sh 会校验 SHA-256）
node gen/dataset.js 60 7                     # 生成训练数据（在项目根目录运行）
.venv/bin/python verify_mapping.py base/Qwen3.5-2B ../ios/iphone-install/models/qwen3.5-2b-q4_K_M/model.gguf
.venv/bin/python -m mlx_lm lora -c lora-2b.yaml
.venv/bin/python merge_lora.py adapters/2b-v1 <原 model.gguf> out/shuxing-2b-merged.gguf
sh ../native/local-model/tools/quantize.sh out/shuxing-2b-merged.gguf out/shuxing-2b-q4_K_M.gguf
```

评测：用原模型的 Modelfile（`ollama show --modelfile qwen3.5:2b-q4_K_M`）把 `FROM` 换成新文件，`ollama create shuxing-2b`，再 `npm run eval -- --models shuxing-2b`（先开发集，最后保留题）。

## 已验证

- 迷你 Qwen3.5 上训练流程能跑通（只对答案算损失、循环层反向传播、保存 LoRA）。
- B=0 的 LoRA：手机引擎直接加载时输出和原模型一字不差；合并后重新量化，236/320 个张量逐字节相同，其余平均相对差约 0.18%；Ollama 能直接加载合并后的模型。
