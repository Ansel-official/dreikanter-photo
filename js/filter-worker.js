/* ==========================================================================
   Dreikanter photo — filter-worker.js
   像素级滤镜在 Worker 内通过 OffscreenCanvas 执行，主线程只收 ImageBitmap
   支持：blur / sharpen / pixelate / noise / downsample / invert
   ========================================================================== */
'use strict';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function boxH(src, w, h, r) {
  const tmp = new Uint8ClampedArray(w * 4);
  const inv = 1 / (r * 2 + 1);
  for (let y = 0; y < h; y++) {
    let ar = 0, ag = 0, ab = 0, aa = 0;
    for (let k = -r; k <= r; k++) {
      const x = clamp(k, 0, w - 1), o = (y * w + x) * 4;
      ar += src[o]; ag += src[o + 1]; ab += src[o + 2]; aa += src[o + 3];
    }
    for (let x = 0; x < w; x++) {
      const o = x * 4;
      tmp[o] = ar * inv; tmp[o + 1] = ag * inv; tmp[o + 2] = ab * inv; tmp[o + 3] = aa * inv;
      const xa = clamp(x + r + 1, 0, w - 1), xb = clamp(x - r, 0, w - 1);
      const oa = (y * w + xa) * 4, ob = (y * w + xb) * 4;
      ar += src[oa] - src[ob]; ag += src[oa + 1] - src[ob + 1];
      ab += src[oa + 2] - src[ob + 2]; aa += src[oa + 3] - src[ob + 3];
    }
    for (let x = 0; x < w * 4; x++) src[y * w * 4 + x] = tmp[x];
  }
}

function boxV(src, w, h, r) {
  const tmp = new Uint8ClampedArray(h * 4);
  const inv = 1 / (r * 2 + 1);
  for (let x = 0; x < w; x++) {
    let ar = 0, ag = 0, ab = 0, aa = 0;
    for (let k = -r; k <= r; k++) {
      const y = clamp(k, 0, h - 1), o = (y * w + x) * 4;
      ar += src[o]; ag += src[o + 1]; ab += src[o + 2]; aa += src[o + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = y * 4;
      tmp[o] = ar * inv; tmp[o + 1] = ag * inv; tmp[o + 2] = ab * inv; tmp[o + 3] = aa * inv;
      const ya = clamp(y + r + 1, 0, h - 1), yb = clamp(y - r, 0, h - 1);
      const oa = (ya * w + x) * 4, ob = (yb * w + x) * 4;
      ar += src[oa] - src[ob]; ag += src[oa + 1] - src[ob + 1];
      ab += src[oa + 2] - src[ob + 2]; aa += src[oa + 3] - src[ob + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4, t = y * 4;
      src[o] = tmp[t]; src[o + 1] = tmp[t + 1]; src[o + 2] = tmp[t + 2]; src[o + 3] = tmp[t + 3];
    }
  }
}

function gaussian(data, w, h, sigma, passes) {
  const r = Math.max(1, Math.round(sigma * .85));
  for (let i = 0; i < (passes || 2); i++) { boxH(data, w, h, r); boxV(data, w, h, r); }
}

function applyOp(op, img, p) {
  const d = img.data, w = img.width, h = img.height;
  if (op === 'blur') { gaussian(d, w, h, Math.max(.1, p.radius || 4), 2); return; }
  if (op === 'sharpen') {
    const amount = (p.amount == null ? 60 : p.amount) / 100;
    const copy = new Uint8ClampedArray(d);
    gaussian(copy, w, h, p.radius || 2, 2);
    for (let i = 0; i < d.length; i += 4) {
      d[i] += (d[i] - copy[i]) * amount * 1.8;
      d[i + 1] += (d[i + 1] - copy[i + 1]) * amount * 1.8;
      d[i + 2] += (d[i + 2] - copy[i + 2]) * amount * 1.8;
    }
    return;
  }
  if (op === 'pixelate') {
    const size = Math.max(2, Math.round(p.size || 10));
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let yy = y; yy < Math.min(y + size, h); yy++) {
          for (let xx = x; xx < Math.min(x + size, w); xx++) {
            const o = (yy * w + xx) * 4;
            r += d[o]; g += d[o + 1]; b += d[o + 2]; a += d[o + 3]; n++;
          }
        }
        r /= n; g /= n; b /= n; a /= n;
        for (let yy = y; yy < Math.min(y + size, h); yy++) {
          for (let xx = x; xx < Math.min(x + size, w); xx++) {
            const o = (yy * w + xx) * 4;
            d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
          }
        }
      }
    }
    return;
  }
  if (op === 'noise') {
    const amt = (p.amount || 12) * 2.2;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - .5) * amt;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    return;
  }
  if (op === 'invert') {
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
  }
}

self.onmessage = e => {
  const { id, op, bitmap, params, scale } = e.data;
  try {
    const w = Math.max(1, Math.round(bitmap.width * (scale || 1)));
    const h = Math.max(1, Math.round(bitmap.height * (scale || 1)));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (op === 'downsample') {
      const out = canvas.transferToImageBitmap();
      bitmap.close();
      self.postMessage({ id, bitmap: out }, [out]);
      return;
    }
    const img = ctx.getImageData(0, 0, w, h);
    applyOp(op, img, params || {});
    ctx.putImageData(img, 0, 0);
    const out = canvas.transferToImageBitmap();
    bitmap.close();
    self.postMessage({ id, bitmap: out, w, h }, [out]);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
