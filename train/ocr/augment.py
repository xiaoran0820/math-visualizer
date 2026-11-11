"""把渲染出的题目图片做成“拍照/扫描”的样子：纸张底色、亮度对比度、轻微旋转和透视、模糊、噪点、阴影、JPEG 压缩。

    python augment.py <输入目录> <输出目录> <清单.txt>

清单每行一个文件名（不含扩展名）。约三成保持干净（只转成 JPEG），其余随机叠加几种变化。
每张图的随机数由文件名决定，重跑结果一样。输出 <输出目录>/<名字>.jpg。
"""
import hashlib
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


def rng_for(name):
    return np.random.default_rng(int(hashlib.sha256(name.encode()).hexdigest()[:12], 16))


def augment(img, r):
    if r.random() < 0.3:
        return img, int(r.integers(80, 95))
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    # 纸张底色
    # 纸张偏暖白：红 ≥ 绿 ≥ 蓝（不会出现偏粉、偏紫）
    red = r.uniform(0.96, 1.0)
    green = red * r.uniform(0.97, 1.0)
    tint = np.array([red, green, green * r.uniform(0.9, 1.0)], dtype=np.float32)
    a = a * tint
    # 阴影：从一侧渐暗
    if r.random() < 0.35:
        h, w = a.shape[:2]
        g = np.linspace(1.0, r.uniform(0.72, 0.92), w if r.random() < 0.5 else h, dtype=np.float32)
        a = a * (g[None, :, None] if len(g) == w else g[:, None, None])
    # 噪点
    if r.random() < 0.5:
        a = a + r.normal(0, r.uniform(2, 7), a.shape)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    img = ImageEnhance.Brightness(img).enhance(r.uniform(0.88, 1.08))
    img = ImageEnhance.Contrast(img).enhance(r.uniform(0.8, 1.1))
    # 轻微旋转
    if r.random() < 0.6:
        img = img.rotate(r.uniform(-2.0, 2.0), resample=Image.BICUBIC, expand=True, fillcolor=(245, 243, 236))
    # 轻微透视
    if r.random() < 0.4:
        w, h = img.size
        d = 0.02
        src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
        dst = np.float32([[x + r.uniform(-d, d) * w, y + r.uniform(-d, d) * h] for x, y in src])
        m = cv2.getPerspectiveTransform(src, dst)
        img = Image.fromarray(cv2.warpPerspective(np.asarray(img), m, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=(245, 243, 236)))
    # 分辨率变低（拍得远）
    if r.random() < 0.5:
        k = r.uniform(0.6, 0.95)
        w, h = img.size
        img = img.resize((max(64, int(w * k)), max(32, int(h * k))), Image.BILINEAR)
    # 模糊
    if r.random() < 0.5:
        img = img.filter(ImageFilter.GaussianBlur(r.uniform(0.3, 1.1)))
    return img, int(r.integers(45, 90))


def main():
    src, dst, names = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]).read_text().split()
    dst.mkdir(parents=True, exist_ok=True)
    for i, name in enumerate(names):
        img, q = augment(Image.open(src / f"{name}.png"), rng_for(name))
        img.convert("RGB").save(dst / f"{name}.jpg", quality=q)
        if (i + 1) % 500 == 0:
            print(f"已处理 {i + 1}/{len(names)}")
    print(f"完成 {len(names)} 张")


if __name__ == "__main__":
    main()
