/* ==========================================================================
   Dreikanter photo — lut.js
   相机 LUT / 胶片风格：哈苏 · 大疆 · 影石 · 徕卡 · 富士
   解析式色彩映射（比查表更快、无插值断层）
   ========================================================================== */
'use strict';

const CAMERA_LOOKS = {
  hasselblad: {
    name: '哈苏', en: 'Hasselblad Natural', color: '#c9a227',
    desc: '自然通透，肤色偏暖，绿色收敛',
    p: { contrast: .18, sat: .93, lift: .012, gain: [1.02, 1.0, .98], shadow: [1.0, 1.0, 1.035], high: [1.045, 1.012, .975], warmth: .02 }
  },
  dji: {
    name: '大疆', en: 'DJI D-Log Clean', color: '#3d8ef0',
    desc: '干净通透，暗部偏青，高光利落',
    p: { contrast: .28, sat: 1.0, lift: .006, gain: [.99, 1.01, 1.02], shadow: [.965, 1.0, 1.05], high: [1.02, 1.01, .99], warmth: -.008 }
  },
  insta360: {
    name: '影石', en: 'Insta360 Vivid', color: '#22d3a8',
    desc: '运动感强，高饱和高反差，蓝绿突出',
    p: { contrast: .34, sat: 1.16, lift: .004, gain: [1.01, 1.03, 1.0], shadow: [.95, .995, 1.07], high: [1.05, 1.005, .965], warmth: .006 }
  },
  leica: {
    name: '徕卡', en: 'Leica Classic', color: '#c0392b',
    desc: '红调浓郁，黑位扎实，层次细腻',
    p: { contrast: .26, sat: 1.04, lift: 0, gain: [1.045, .995, .985], shadow: [1.005, .995, 1.02], high: [1.03, 1.0, .975], warmth: .012 }
  },
  fuji: {
    name: '富士', en: 'Fujifilm Classic Chrome', color: '#5b8c5a',
    desc: '低饱和青调，高光柔和，胶片褪色感',
    p: { contrast: .14, sat: .8, lift: .045, gain: [1.0, 1.0, .995], shadow: [.945, 1.012, 1.032], high: [1.05, 1.015, .945], warmth: .014 }
  }
};

const LOOK_IDS = Object.keys(CAMERA_LOOKS);

/* 平滑 S 曲线（0..1 输入输出） */
function lookSmooth(v) { return v * v * (3 - 2 * v); }

/**
 * 单像素映射，结果写入 out[0..2]
 * r/g/b 均为 0..1
 */
function lookPixel(id, r, g, b, out) {
  const cfg = CAMERA_LOOKS[id];
  const p = (cfg && cfg.p) || CAMERA_LOOKS.hasselblad.p;

  /* 1 提亮黑位（胶片褪色） */
  if (p.lift) {
    r = r * (1 - p.lift) + p.lift;
    g = g * (1 - p.lift) + p.lift;
    b = b * (1 - p.lift) + p.lift;
  }

  /* 2 通道增益 */
  r *= p.gain[0]; g *= p.gain[1]; b *= p.gain[2];

  /* 3 柔和 S 曲线（按亮度混合，保持色相） */
  if (p.contrast) {
    const l = .2126 * r + .7152 * g + .0722 * b;
    const cl = l + (lookSmooth(Math.min(1, Math.max(0, l))) - l) * (p.contrast * 2.2);
    const k = l > 1e-4 ? cl / l : 1;
    r *= k; g *= k; b *= k;
  }

  /* 4 分离色调：暗部 / 高光 各带一点色偏 */
  const l2 = Math.min(1, Math.max(0, .2126 * r + .7152 * g + .0722 * b));
  const ws = Math.pow(1 - l2, 2.1);
  const wh = Math.pow(l2, 2.1);
  for (let c = 0; c < 3; c++) {
    const t = (p.shadow[c] - 1) * ws * .55 + (p.high[c] - 1) * wh * .55;
    const v = c === 0 ? r : c === 1 ? g : b;
    const nv = v * (1 + t) + t * .06;
    if (c === 0) r = nv; else if (c === 1) g = nv; else b = nv;
  }

  /* 5 饱和度 */
  if (p.sat !== 1) {
    const l = .2126 * r + .7152 * g + .0722 * b;
    r = l + (r - l) * p.sat;
    g = l + (g - l) * p.sat;
    b = l + (b - l) * p.sat;
  }

  /* 6 轻微色温 */
  if (p.warmth) {
    r += p.warmth * .6;
    b -= p.warmth * .6;
  }

  out[0] = r < 0 ? 0 : r > 1 ? 1 : r;
  out[1] = g < 0 ? 0 : g > 1 ? 1 : g;
  out[2] = b < 0 ? 0 : b > 1 ? 1 : b;
  return out;
}

/* 生成 33³ LUT（用于需要查表的场合，如导出预览/未来拓展） */
function buildLookLUT(id, size = 33) {
  const data = new Uint8Array(size * size * size * 3);
  const out = [0, 0, 0];
  let i = 0;
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        lookPixel(id, ri / (size - 1), gi / (size - 1), bi / (size - 1), out);
        data[i++] = out[0] * 255;
        data[i++] = out[1] * 255;
        data[i++] = out[2] * 255;
      }
    }
  }
  return { size, data };
}

/* 由 LUT 表采样（三线性），用于将来导入的 .cube */
function sampleLUT(lut, r, g, b, out) {
  const n = lut.size - 1;
  const fr = r * n, fg = g * n, fb = b * n;
  const r0 = Math.floor(fr), g0 = Math.floor(fg), b0 = Math.floor(fb);
  const r1 = Math.min(n, r0 + 1), g1 = Math.min(n, g0 + 1), b1 = Math.min(n, b0 + 1);
  const tr = fr - r0, tg = fg - g0, tb = fb - b0;
  const at = (ri, gi, bi) => {
    const idx = ((bi * lut.size + gi) * lut.size + ri) * 3;
    return [lut.data[idx], lut.data[idx + 1], lut.data[idx + 2]];
  };
  const c000 = at(r0, g0, b0), c100 = at(r1, g0, b0), c010 = at(r0, g1, b0), c110 = at(r1, g1, b0);
  const c001 = at(r0, g0, b1), c101 = at(r1, g0, b1), c011 = at(r0, g1, b1), c111 = at(r1, g1, b1);
  for (let k = 0; k < 3; k++) {
    const x00 = c000[k] + (c100[k] - c000[k]) * tr;
    const x10 = c010[k] + (c110[k] - c010[k]) * tr;
    const x01 = c001[k] + (c101[k] - c001[k]) * tr;
    const x11 = c011[k] + (c111[k] - c011[k]) * tr;
    const y0 = x00 + (x10 - x00) * tg;
    const y1 = x01 + (x11 - x01) * tg;
    out[k] = (y0 + (y1 - y0) * tb) / 255;
  }
  return out;
}
