// 题目图片编辑：显示预览、旋转 90°、拖动框选题目区域，导出压缩后的 JPEG。

export class ImageEditor {
  constructor(canvas, { onChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.img = null;
    this.rotation = 0; // 0,1,2,3 × 90°
    this.crop = null; // 旋转后图像坐标中的 {x, y, w, h}
    this.onChange = onChange;
    this.drag = null;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    new ResizeObserver(() => this.draw()).observe(canvas.parentElement);
  }

  get hasImage() { return !!this.img; }

  async load(blob) {
    let img;
    try {
      img = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('无法读取这张图片'));
        el.src = URL.createObjectURL(blob);
      });
    }
    this.img = img;
    this.rotation = 0;
    this.crop = null;
    this.draw();
    this.onChange?.();
  }

  clear() {
    this.img = null;
    this.crop = null;
    this.draw();
    this.onChange?.();
  }

  rotate() {
    if (!this.img) return;
    this.rotation = (this.rotation + 1) % 4;
    this.crop = null;
    this.draw();
    this.onChange?.();
  }

  clearCrop() {
    this.crop = null;
    this.draw();
    this.onChange?.();
  }

  // 旋转后的尺寸
  size() {
    const w = this.img.width, h = this.img.height;
    return this.rotation % 2 ? { w: h, h: w } : { w, h };
  }

  // 把旋转后的整张图画到一个离屏 canvas
  rotated(maxSide = Infinity) {
    const { w, h } = this.size();
    const k = Math.min(1, maxSide / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const g = c.getContext('2d');
    g.translate(c.width / 2, c.height / 2);
    g.rotate((this.rotation * Math.PI) / 2);
    const iw = this.img.width * k, ih = this.img.height * k;
    g.drawImage(this.img, -iw / 2, -ih / 2, iw, ih);
    return { canvas: c, scale: k };
  }

  draw() {
    const cv = this.canvas;
    const box = cv.parentElement.getBoundingClientRect();
    if (!this.img) { cv.width = 0; cv.height = 0; return; }
    const { w, h } = this.size();
    const maxW = box.width || 360, maxH = 360;
    const k = Math.min(maxW / w, maxH / h);
    const dpr = window.devicePixelRatio || 1;
    this.view = { k, w: w * k, h: h * k };
    cv.style.width = `${this.view.w}px`;
    cv.style.height = `${this.view.h}px`;
    cv.width = Math.round(this.view.w * dpr);
    cv.height = Math.round(this.view.h * dpr);
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { canvas } = this.rotated(Math.max(this.view.w, this.view.h) * dpr * 1.2);
    g.drawImage(canvas, 0, 0, this.view.w, this.view.h);
    if (this.crop) {
      const r = { x: this.crop.x * k, y: this.crop.y * k, w: this.crop.w * k, h: this.crop.h * k };
      g.fillStyle = 'rgba(15, 23, 42, 0.45)';
      g.beginPath();
      g.rect(0, 0, this.view.w, this.view.h);
      g.rect(r.x, r.y, r.w, r.h);
      g.fill('evenodd');
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.setLineDash([6, 4]);
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.setLineDash([]);
    }
  }

  local(e) {
    const rect = this.canvas.getBoundingClientRect();
    const k = this.view?.k || 1;
    const { w, h } = this.size();
    return {
      x: Math.max(0, Math.min(w, (e.clientX - rect.left) / k)),
      y: Math.max(0, Math.min(h, (e.clientY - rect.top) / k)),
    };
  }

  down(e) {
    if (!this.img) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* 个别 WebView 不支持 */ }
    this.drag = this.local(e);
  }

  move(e) {
    if (!this.drag) return;
    const p = this.local(e);
    this.crop = { x: Math.min(p.x, this.drag.x), y: Math.min(p.y, this.drag.y), w: Math.abs(p.x - this.drag.x), h: Math.abs(p.y - this.drag.y) };
    this.draw();
  }

  up() {
    if (!this.drag) return;
    this.drag = null;
    const { w, h } = this.size();
    if (this.crop && (this.crop.w < w * 0.04 || this.crop.h < h * 0.04)) this.crop = null;
    this.draw();
    this.onChange?.();
  }

  // 导出：旋转 + 框选 + 缩放到长边不超过 maxSide
  toDataURL(maxSide = 1600, quality = 0.9) {
    if (!this.img) return null;
    const { canvas: full } = this.rotated();
    const c = this.crop || { x: 0, y: 0, w: full.width, h: full.height };
    const k = Math.min(1, maxSide / Math.max(c.w, c.h));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(c.w * k));
    out.height = Math.max(1, Math.round(c.h * k));
    const g = out.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(full, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', quality);
  }
}
