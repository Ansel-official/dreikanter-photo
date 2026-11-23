/* ==========================================================================
   Dreikanter photo — filters.js
   像素处理 / 调色 / 风格预设
   ========================================================================== */
'use strict';

const FX = {

  /* ---------- 基础 ---------- */
  cloneData(img) {
    return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  },

  brightnessContrast(img, p) {
    const b = (p.brightness || 0) * 2.55;
    const c = (p.contrast || 0);
    const f = (259 * (c + 255)) / (255 * (259 - c));
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = f * (d[i] + b - 128) + 128;
      d[i + 1] = f * (d[i + 1] + b - 128) + 128;
      d[i + 2] = f * (d[i + 2] + b - 128) + 128;
    }
    return img;
  },

  exposure(img, p) {
    const k = Math.pow(2, (p.exposure || 0) / 100);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    }
    return img;
  },

  saturation(img, p) {
    const s = 1 + (p.saturation || 0) / 100;
    const hue = (p.hue || 0) * Math.PI / 180;
    const light = (p.lightness || 0) * 2.55;
    const d = img.data;
    const cos = Math.cos(hue), sin = Math.sin(hue);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
      if (hue) {
        const nr = (.213 + cos * .787 - sin * .213) * r + (.715 - cos * .715 - sin * .715) * g + (.072 - cos * .072 + sin * .928) * b;
        const ng = (.213 - cos * .213 + sin * .143) * r + (.715 + cos * .285 + sin * .140) * g + (.072 - cos * .072 - sin * .283) * b;
        const nb = (.213 - cos * .213 - sin * .787) * r + (.715 - cos * .715 + sin * .715) * g + (.072 + cos * .928 + sin * .072) * b;
        r = nr; g = ng; b = nb;
      }
      d[i] = r + light; d[i + 1] = g + light; d[i + 2] = b + light;
    }
    return img;
  },

  vibrance(img, p) {
    const amt = (p.vibrance || 0) / 100;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const k = 1 + amt * (1 - sat) * 1.6;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      d[i] = l + (r - l) * k;
      d[i + 1] = l + (g - l) * k;
      d[i + 2] = l + (b - l) * k;
    }
    return img;
  },

  temperature(img, p) {
    const t = (p.temp || 0) / 100;   // -1 冷 .. 1 暖
    const g = (p.tint || 0) / 100;   // -1 绿 .. 1 洋红
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] + t * 34 + g * 10;
      d[i + 1] = d[i + 1] - g * 14;
      d[i + 2] = d[i + 2] - t * 34 + g * 6;
    }
    return img;
  },

  levels(img, p) {
    const inB = clamp(p.black || 0, 0, 250);
    const inW = clamp(p.white == null ? 255 : p.white, inB + 2, 255);
    const gamma = p.gamma || 1;
    const outB = p.outBlack || 0, outW = p.outWhite == null ? 255 : p.outWhite;
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      let v = ((i - inB) / (inW - inB));
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      v = Math.pow(v, 1 / gamma);
      lut[i] = outB + v * (outW - outB);
    }
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
    return img;
  },

  blackWhite(img, p) {
    const wr = p.mixR == null ? 30 : p.mixR;
    const wg = p.mixG == null ? 59 : p.mixG;
    const wb = p.mixB == null ? 11 : p.mixB;
    const total = wr + wg + wb || 100;
    const tint = p.tint || '#000000';
    const t = hexToRgb(tint);
    const tone = p.tone == null ? 0 : p.tone;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * wr + d[i + 1] * wg + d[i + 2] * wb) / total;
      d[i] = lerp(v, t.r, tone);
      d[i + 1] = lerp(v, t.g, tone);
      d[i + 2] = lerp(v, t.b, tone);
    }
    return img;
  },

  invert(img) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    return img;
  },

  threshold(img, p) {
    const t = (p.level == null ? 128 : p.level);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = luminance(d[i], d[i + 1], d[i + 2]) >= t ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    return img;
  },

  posterize(img, p) {
    const lv = Math.max(2, p.levels || 6);
    const step = 255 / (lv - 1);
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) lut[i] = Math.round(Math.round(i / step) * step);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
    return img;
  },

  gradientMap(img, p) {
    const a = hexToRgb(p.dark || '#1b1b3a');
    const b = hexToRgb(p.light || '#f0d9b5');
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const t = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      d[i] = lerp(a.r, b.r, t);
      d[i + 1] = lerp(a.g, b.g, t);
      d[i + 2] = lerp(a.b, b.b, t);
    }
    return img;
  },

  colorBalance(img, p) {
    const d = img.data;
    const dr = (p.r || 0) / 100 * 42;
    const dg = (p.g || 0) / 100 * 42;
    const db = (p.b || 0) / 100 * 42;
    const sh = (p.shadows || 0) / 100;
    const hi = (p.highlights || 0) / 100;
    for (let i = 0; i < d.length; i += 4) {
      const l = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      /* 中间调为主，黑白场按比例参与，避免死黑/死白被染色 */
      const wMid = 1 - Math.abs(l - .5) * 1.7;
      const w = clamp(wMid, .35, 1);
      const ws = Math.pow(1 - l, 1.6);
      const wh = Math.pow(l, 1.6);
      const addR = dr * w + sh * -6 * ws + hi * 6 * wh;
      const addG = dg * w + sh * 0 + hi * 0;
      const addB = db * w + sh * 6 * ws + hi * -6 * wh;
      d[i] += addR; d[i + 1] += addG; d[i + 2] += addB;
    }
    return img;
  },

  /* 相机 LUT（哈苏/大疆/影石/徕卡/富士）或导入的 .cube 自定义 LUT */
  cameraLook(img, p) {
    const custom = (typeof CVL !== 'undefined' && p.look) ? CVL.get(p.look) : null;
    const id = (!custom && typeof CAMERA_LOOKS !== 'undefined' && CAMERA_LOOKS[p.look]) ? p.look : 'hasselblad';
    const amt = (p.intensity == null ? 100 : p.intensity) / 100;
    const d = img.data;
    const out = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      if (custom) sampleCube(custom, r, g, b, out);
      else lookPixel(id, r, g, b, out);
      if (amt >= .999) {
        d[i] = out[0] * 255; d[i + 1] = out[1] * 255; d[i + 2] = out[2] * 255;
      } else {
        d[i] = (r + (out[0] - r) * amt) * 255;
        d[i + 1] = (g + (out[1] - g) * amt) * 255;
        d[i + 2] = (b + (out[2] - b) * amt) * 255;
      }
    }
    return img;
  },

  /* 自动白平衡（灰度世界，保留一定强度） */
  autoWhiteBalance(img, p) {
    const d = img.data;
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++;
    }
    if (!n) return img;
    const mr = sr / n, mg = sg / n, mb = sb / n;
    const avg = (mr + mg + mb) / 3;
    let gr = clamp(avg / (mr || 1), .72, 1.38);
    let gg = clamp(avg / (mg || 1), .72, 1.38);
    let gb = clamp(avg / (mb || 1), .72, 1.38);
    const s = (p.strength == null ? 100 : p.strength) / 100;
    gr = 1 + (gr - 1) * s; gg = 1 + (gg - 1) * s; gb = 1 + (gb - 1) * s;
    for (let i = 0; i < d.length; i += 4) {
      d[i] *= gr; d[i + 1] *= gg; d[i + 2] *= gb;
    }
    return img;
  },

  /* ---------- 模糊 / 锐化 ---------- */
  blur(img, p) {
    const radius = Math.max(0.1, p.radius || 4);
    gaussianBlur(img, radius);
    return img;
  },

  motionBlur(img, p) {
    const angle = (p.angle || 0) * Math.PI / 180;
    const dist = Math.max(1, p.distance || 12);
    const w = img.width, h = img.height;
    const src = new Uint8ClampedArray(img.data);
    const d = img.data;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const steps = Math.max(2, Math.round(dist));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let s = 0; s < steps; s++) {
          const t = (s / (steps - 1) - .5) * dist;
          const xx = clamp(Math.round(x + dx * t), 0, w - 1);
          const yy = clamp(Math.round(y + dy * t), 0, h - 1);
          const o = (yy * w + xx) * 4;
          r += src[o]; g += src[o + 1]; b += src[o + 2]; a += src[o + 3];
        }
        const o = (y * w + x) * 4;
        d[o] = r / steps; d[o + 1] = g / steps; d[o + 2] = b / steps; d[o + 3] = a / steps;
      }
    }
    return img;
  },

  sharpen(img, p) {
    const amount = (p.amount == null ? 60 : p.amount) / 100;
    const radius = p.radius || 2;
    if (amount <= 0) return img;
    const blurImg = FX.cloneData(img);
    gaussianBlur(blurImg, radius);
    const d = img.data, b = blurImg.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] + (d[i] - b[i]) * amount * 1.8;
      d[i + 1] = d[i + 1] + (d[i + 1] - b[i + 1]) * amount * 1.8;
      d[i + 2] = d[i + 2] + (d[i + 2] - b[i + 2]) * amount * 1.8;
    }
    return img;
  },

  noise(img, p) {
    const amt = (p.amount || 12) * 2.2;
    const mono = !!p.mono;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (mono) {
        const n = (Math.random() - .5) * amt;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      } else {
        d[i] += (Math.random() - .5) * amt;
        d[i + 1] += (Math.random() - .5) * amt;
        d[i + 2] += (Math.random() - .5) * amt;
      }
    }
    return img;
  },

  pixelate(img, p) {
    const size = Math.max(2, Math.round(p.size || 10));
    const w = img.width, h = img.height;
    const d = img.data;
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
    return img;
  },

  emboss(img) {
    const src = new Uint8ClampedArray(img.data);
    const w = img.width, h = img.height, d = img.data;
    const k = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let j = 0; j < 3; j++) {
          for (let i = 0; i < 3; i++) {
            const xx = clamp(x + i - 1, 0, w - 1), yy = clamp(y + j - 1, 0, h - 1);
            const o = (yy * w + xx) * 4;
            s += (src[o] * .3 + src[o + 1] * .59 + src[o + 2] * .11) * k[j * 3 + i];
          }
        }
        const o = (y * w + x) * 4;
        const v = clamp(128 + s, 0, 255);
        d[o] = d[o + 1] = d[o + 2] = v;
      }
    }
    return img;
  },

  findEdges(img) {
    const src = new Uint8ClampedArray(img.data);
    const w = img.width, h = img.height, d = img.data;
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sx = 0, sy = 0;
        for (let j = 0; j < 3; j++) {
          for (let i = 0; i < 3; i++) {
            const xx = clamp(x + i - 1, 0, w - 1), yy = clamp(y + j - 1, 0, h - 1);
            const o = (yy * w + xx) * 4;
            const v = src[o] * .3 + src[o + 1] * .59 + src[o + 2] * .11;
            sx += v * gx[j * 3 + i]; sy += v * gy[j * 3 + i];
          }
        }
        const m = clamp(Math.hypot(sx, sy) * 1.4, 0, 255);
        const o = (y * w + x) * 4;
        d[o] = d[o + 1] = d[o + 2] = 255 - m;
      }
    }
    return img;
  },

  grain(img, p) {
    const amt = (p.amount || 20);
    const size = Math.max(1, Math.round(p.size || 1));
    const w = img.width, h = img.height, d = img.data;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const n = (Math.random() - .5) * amt * 2.2;
        for (let yy = y; yy < Math.min(y + size, h); yy++) {
          for (let xx = x; xx < Math.min(x + size, w); xx++) {
            const o = (yy * w + xx) * 4;
            d[o] += n; d[o + 1] += n; d[o + 2] += n;
          }
        }
      }
    }
    return img;
  },

  vignette(img, p) {
    const amount = (p.amount == null ? 45 : p.amount) / 100;
    const size = (p.size == null ? 60 : p.size) / 100;
    const w = img.width, h = img.height, d = img.data;
    const cx = w / 2, cy = h / 2;
    const maxR = Math.hypot(cx, cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dr = Math.hypot(x - cx, y - cy) / maxR;
        const t = clamp((dr - size * .55) / (1 - size * .55), 0, 1);
        const f = 1 - amount * t * t;
        const o = (y * w + x) * 4;
        d[o] *= f; d[o + 1] *= f; d[o + 2] *= f;
      }
    }
    return img;
  },

  glow(img, p) {
    const radius = p.radius || 16;
    const intensity = (p.intensity == null ? 40 : p.intensity) / 100;
    const w = img.width, h = img.height;
    const bright = new ImageData(new Uint8ClampedArray(img.data), w, h);
    const bd = bright.data;
    for (let i = 0; i < bd.length; i += 4) {
      const l = luminance(bd[i], bd[i + 1], bd[i + 2]);
      const k = Math.max(0, (l - 150) / 105);
      bd[i] *= k; bd[i + 1] *= k; bd[i + 2] *= k;
    }
    gaussianBlur(bright, radius);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - (255 - d[i]) * (255 - bd[i] * intensity) / 255;
      d[i + 1] = 255 - (255 - d[i + 1]) * (255 - bd[i + 1] * intensity) / 255;
      d[i + 2] = 255 - (255 - d[i + 2]) * (255 - bd[i + 2] * intensity) / 255;
    }
    return img;
  },

  fade(img, p) {
    const amt = (p.amount == null ? 30 : p.amount) / 100;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lerp(d[i], d[i] * .82 + 44, amt);
      d[i + 1] = lerp(d[i + 1], d[i + 1] * .82 + 44, amt);
      d[i + 2] = lerp(d[i + 2], d[i + 2] * .82 + 44, amt);
    }
    return img;
  }
};

/* ---------------- 高斯模糊（三次盒式近似） ---------------- */
function gaussianBlur(img, sigma) {
  if (sigma <= 0.2) return img;
  const w = img.width, h = img.height;
  const r = Math.max(1, Math.round(sigma * 0.85));
  const data = img.data;
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(data, w, h, r);
    boxBlurV(data, w, h, r);
  }
  return img;
}

function boxBlurH(src, w, h, r) {
  const tmp = new Uint8ClampedArray(w * 4);
  const inv = 1 / (r * 2 + 1);
  for (let y = 0; y < h; y++) {
    let ar = 0, ag = 0, ab = 0, aa = 0;
    for (let k = -r; k <= r; k++) {
      const xx = clamp(k, 0, w - 1), o = (y * w + xx) * 4;
      ar += src[o]; ag += src[o + 1]; ab += src[o + 2]; aa += src[o + 3];
    }
    for (let x = 0; x < w; x++) {
      const o = x * 4;
      tmp[o] = ar * inv; tmp[o + 1] = ag * inv; tmp[o + 2] = ab * inv; tmp[o + 3] = aa * inv;
      const xa = clamp(x + r + 1, 0, w - 1), xb = clamp(x - r, 0, w - 1);
      const oa = (y * w + xa) * 4, ob = (y * w + xb) * 4;
      ar += src[oa] - src[ob];
      ag += src[oa + 1] - src[ob + 1];
      ab += src[oa + 2] - src[ob + 2];
      aa += src[oa + 3] - src[ob + 3];
    }
    for (let x = 0; x < w * 4; x++) src[y * w * 4 + x] = tmp[x];
  }
}

function boxBlurV(src, w, h, r) {
  const tmp = new Uint8ClampedArray(h * 4);
  const inv = 1 / (r * 2 + 1);
  for (let x = 0; x < w; x++) {
    let ar = 0, ag = 0, ab = 0, aa = 0;
    for (let k = -r; k <= r; k++) {
      const yy = clamp(k, 0, h - 1), o = (yy * w + x) * 4;
      ar += src[o]; ag += src[o + 1]; ab += src[o + 2]; aa += src[o + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = y * 4;
      tmp[o] = ar * inv; tmp[o + 1] = ag * inv; tmp[o + 2] = ab * inv; tmp[o + 3] = aa * inv;
      const ya = clamp(y + r + 1, 0, h - 1), yb = clamp(y - r, 0, h - 1);
      const oa = (ya * w + x) * 4, ob = (yb * w + x) * 4;
      ar += src[oa] - src[ob];
      ag += src[oa + 1] - src[ob + 1];
      ab += src[oa + 2] - src[ob + 2];
      aa += src[oa + 3] - src[ob + 3];
    }
    for (let y = 0; y < h; y++) {
      const o = (y * w + x) * 4, t = y * 4;
      src[o] = tmp[t]; src[o + 1] = tmp[t + 1]; src[o + 2] = tmp[t + 2]; src[o + 3] = tmp[t + 3];
    }
  }
}

/* ---------------- 选区裁切合成 ---------------- */
function blendMasked(after, before, mask, offX, offY) {
  const w = after.width, h = after.height;
  const ad = after.data, bd = before.data;
  const mw = mask.width, mh = mask.height;
  const md = ctx2d(mask).getImageData(0, 0, mw, mh).data;
  for (let y = 0; y < h; y++) {
    const my = y + (offY || 0);
    if (my < 0 || my >= mh) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        ad[i] = bd[i]; ad[i + 1] = bd[i + 1]; ad[i + 2] = bd[i + 2]; ad[i + 3] = bd[i + 3];
      }
      continue;
    }
    for (let x = 0; x < w; x++) {
      const mx = x + (offX || 0);
      const i = (y * w + x) * 4;
      let m = (mx < 0 || mx >= mw) ? 0 : md[(my * mw + mx) * 4 + 3] / 255;
      if (m >= .999) continue;
      if (m <= .001) {
        ad[i] = bd[i]; ad[i + 1] = bd[i + 1]; ad[i + 2] = bd[i + 2]; ad[i + 3] = bd[i + 3];
        continue;
      }
      ad[i] = bd[i] + (ad[i] - bd[i]) * m;
      ad[i + 1] = bd[i + 1] + (ad[i + 1] - bd[i + 1]) * m;
      ad[i + 2] = bd[i + 2] + (ad[i + 2] - bd[i + 2]) * m;
      ad[i + 3] = bd[i + 3] + (ad[i + 3] - bd[i + 3]) * m;
    }
  }
}

/* ---------------- 应用到图层 ---------------- */
function runFilter(layer, fn, params, label) {
  const ctx = ctx2d(layer.canvas);
  const img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  if (App.selection) {
    const before = FX.cloneData(img);
    fn(img, params || {});
    blendMasked(img, before, App.selection.mask, layer.x, layer.y);
  } else {
    fn(img, params || {});
  }
  ctx.putImageData(img, 0, 0);
  layer.thumbDirty = true;
}

/** 一键滤镜（作用于当前图层，支持选区） */
function applyFilterDirect(fn, params, label) {
  if (typeof Recorder !== 'undefined') Recorder.record(fn, params, label);
  const l = activeLayer();
  if (!l || l.locked) { toast('请选择一个可编辑图层', 'err'); return; }
  History.begin(label, [l.id]);
  try {
    runFilter(l, fn, params, label);
  } catch (e) {
    History.pending = null;
    toast('处理失败：' + e.message, 'err');
    return;
  }
  History.end();
  invalidate(); sync();
  toast(label + ' 已应用', 'ok');
}

/** 应用到所有可见图层 */
function applyFilterAll(fn, params, label) {
  const targets = App.layers.filter(l => l.visible && !l.locked);
  if (!targets.length) return;
  History.begin(label, targets.map(l => l.id));
  targets.forEach(l => runFilter(l, fn, params, label));
  History.end();
  invalidate(); sync();
}

/* ---------------- 风格预设 ---------------- */
const STYLES = [
  {
    id: 'original', name: '原片', color: '#8a8a94',
    fn: () => { }
  },
  {
    id: 'film', name: '胶片', color: '#c9a227',
    fn: (img) => {
      FX.brightnessContrast(img, { brightness: 2, contrast: -6 });
      FX.temperature(img, { temp: .12, tint: .04 });
      FX.fade(img, { amount: 26 });
      FX.saturation(img, { saturation: -8 });
      FX.grain(img, { amount: 13, size: 1 });
      FX.vignette(img, { amount: 26, size: 55 });
    }
  },
  {
    id: 'mono', name: '黑白', color: '#d8d8de',
    fn: (img) => {
      FX.blackWhite(img, { mixR: 34, mixG: 50, mixB: 16 });
      FX.brightnessContrast(img, { brightness: 1, contrast: 14 });
      FX.grain(img, { amount: 10, size: 1 });
    }
  },
  {
    id: 'teal', name: '青橙', color: '#2fa8a0',
    fn: (img) => {
      FX.temperature(img, { temp: .16, tint: -.06 });
      FX.colorBalance(img, { r: 8, g: 2, b: -6 });
      FX.brightnessContrast(img, { brightness: 0, contrast: 12 });
      FX.vibrance(img, { vibrance: 16 });
    }
  },
  {
    id: 'cyber', name: '赛博', color: '#a855f7',
    fn: (img) => {
      FX.temperature(img, { temp: -.14, tint: .22 });
      FX.saturation(img, { saturation: 26, hue: -8 });
      FX.brightnessContrast(img, { brightness: -4, contrast: 22 });
      FX.glow(img, { radius: 18, intensity: 26 });
    }
  },
  {
    id: 'jp', name: '日系', color: '#9fc4d8',
    fn: (img) => {
      FX.brightnessContrast(img, { brightness: 8, contrast: -16 });
      FX.temperature(img, { temp: -.05, tint: -.03 });
      FX.saturation(img, { saturation: -6, lightness: 4 });
      FX.fade(img, { amount: 16 });
    }
  },
  {
    id: 'moody', name: '暗调', color: '#4b5563',
    fn: (img) => {
      FX.exposure(img, { exposure: -12 });
      FX.brightnessContrast(img, { brightness: -4, contrast: 20 });
      FX.vignette(img, { amount: 52, size: 48 });
      FX.temperature(img, { temp: .06, tint: -.04 });
    }
  },
  {
    id: 'faded', name: '褪色', color: '#b9a89a',
    fn: (img) => {
      FX.fade(img, { amount: 52 });
      FX.saturation(img, { saturation: -22 });
      FX.brightnessContrast(img, { brightness: 4, contrast: -10 });
    }
  }
];

function applyStyle(id) {
  const st = STYLES.find(s => s.id === id);
  if (!st) return;
  if (!App.doc.w) return;
  if (id === 'original') { toast('已回到原片'); return; }
  applyFilterAll(st.fn, {}, '风格 · ' + st.name);
  toast(`已套用「${st.name}」`, 'ok');
}

/* ---------------- 对话框调色会话 ---------------- */
const Adjust = {
  layer: null,
  base: null,
  canvas: null,
  maskBefore: null,

  start(layer) {
    layer = layer || activeLayer();
    if (!layer) return false;
    this.layer = layer;
    this.lastFn = null;
    this.lastParams = null;
    const w = layer.canvas.width, h = layer.canvas.height;
    const ctx = ctx2d(layer.canvas);
    this.base = ctx.getImageData(0, 0, w, h);
    /* 大图预览降采样：滑杆依旧即时，确认时再全分辨率重算 */
    const maxDim = 1100;
    this.scale = Math.min(1, maxDim / Math.max(w, h));
    if (this.scale < 1) {
      const sw = Math.max(1, Math.round(w * this.scale));
      const sh = Math.max(1, Math.round(h * this.scale));
      const tmp = makeCanvas(sw, sh);
      const tc = ctx2d(tmp);
      tc.imageSmoothingQuality = 'high';
      tc.drawImage(layer.canvas, 0, 0, sw, sh);
      this.small = tc.getImageData(0, 0, sw, sh);
      this.canvas = makeCanvas(sw, sh);
    } else {
      this.small = this.base;
      this.canvas = makeCanvas(w, h);
    }
    History.begin('调整', [layer.id]);
    App.previewId = layer.id;
    App.previewCanvas = this.canvas;
    return true;
  },

  preview(fn, params) {
    if (!this.layer) return;
    this.lastFn = fn;
    this.lastParams = params;
    const small = this.small || this.base;

    /* 大图 + 支持 Worker 的算子：像素运算放到后台线程 */
    const op = (typeof WorkerFX !== 'undefined' && WorkerFX.ready) ? WorkerFX.opFor(fn) : null;
    if (op && small.width * small.height > 200000) {
      const token = (this._token = (this._token || 0) + 1);
      this._pending = WorkerFX.run(op, small, params).then(bmp => {
        if (token !== this._token) { bmp.close(); return; }
        const c = ctx2d(this.canvas);
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
        c.drawImage(bmp, 0, 0);
        bmp.close();
        App.previewId = this.layer ? this.layer.id : null;
        App.previewCanvas = this.canvas;
        invalidate();
      }).catch(() => this._syncPreview(fn, params));
      return;
    }
    this._syncPreview(fn, params);
  },

  _syncPreview(fn, params) {
    const img = FX.cloneData(this.small || this.base);
    fn(img, params || {});
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.putImageData(img, 0, 0);
    App.previewId = this.layer.id;
    App.previewCanvas = this.canvas;
    invalidate();
  },

  /** 等当前预览（含 Worker）落地 */
  whenIdle() {
    return this._pending || Promise.resolve();
  },

  commit(label) {
    if (!this.layer) return;
    const w = this.layer.canvas.width, h = this.layer.canvas.height;
    const c = ctx2d(this.layer.canvas);
    if (this.lastFn && this.base) {
      const img = FX.cloneData(this.base);
      this.lastFn(img, this.lastParams || {});
      if (App.selection) {
        const before = FX.cloneData(this.base);
        blendMasked(img, before, App.selection.mask, this.layer.x, this.layer.y);
      }
      c.putImageData(img, 0, 0);
    } else {
      c.clearRect(0, 0, w, h);
      c.drawImage(this.canvas, 0, 0, w, h);
    }
    this.layer.thumbDirty = true;
    App.previewId = null; App.previewCanvas = null;
    if (typeof Recorder !== 'undefined') Recorder.record(this.lastFn, this.lastParams, label || '调整');
    History.end(label || '调整');
    this.layer = null;
    invalidate(); sync();
  },

  cancel() {
    App.previewId = null; App.previewCanvas = null;
    if (History.pending) { History.pending = null; }
    this.layer = null;
    invalidate();
  }
};
