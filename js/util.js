/* ==========================================================================
   Dreikanter photo — util.js
   ========================================================================== */
'use strict';

/* 版本号单一来源：关于面板 / 控制台 / 自检 / Service Worker 都从这里取 */
const APP_VERSION = 'v18.0';
const APP_BUILD = '2026-11-23';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** 轻量 DOM 构造 */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  addKids(e, kids);
  return e;
}
function addKids(e, kids) {
  kids.flat(12).forEach(k => {
    if (k == null || k === false) return;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  });
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const round = (v, p = 0) => { const m = Math.pow(10, p); return Math.round(v * m) / m; };
const uid = (pre = 'x') => pre + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}
function ctx2d(canvas, opts) { return canvas.getContext('2d', opts || { willReadFrequently: true }); }

function cloneCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

/* 缩略图缓存：按画布引用与图层版本号复用，避免每次同步都重绘 */
function layerThumb(layer, size) {
  const key = 's' + size;
  const cache = layer._tc || (layer._tc = {});
  const hit = cache[key];
  if (hit && hit.src === layer.canvas && hit.ver === layer._ver) return hit.canvas;
  const cv = thumbCanvas(layer, size);
  cache[key] = { src: layer.canvas, ver: layer._ver, canvas: cv };
  return cv;
}

/** 生成图层缩略图；文字图层按内容裁切，避免缩略图空白 */
function thumbCanvas(layer, size = 30) {
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  let sx = 0, sy = 0, sw = layer.canvas.width, sh = layer.canvas.height;
  if (layer.type === 'text' && layer.text) {
    const t = layer.text;
    const mctx = ctx2d(makeCanvas(4, 4));
    mctx.font = `${t.weight || 700} ${t.size}px ${t.font}`;
    const lines = String(t.string).split('\n');
    let maxW = 1;
    lines.forEach(l => { maxW = Math.max(maxW, mctx.measureText(l).width); });
    const w = maxW + (t.spacing || 0) * Math.max(1, lines[0].length);
    const hh = t.size * (t.lineHeight || 1.2) * lines.length;
    const left = t.x - (t.align === 'center' ? w / 2 : t.align === 'right' ? w : 0);
    sx = clamp(left - t.size * 0.08, 0, Math.max(0, layer.canvas.width - 1));
    sy = clamp(t.y - t.size * 0.08, 0, Math.max(0, layer.canvas.height - 1));
    sw = clamp(w + t.size * 0.16, 1, layer.canvas.width - sx);
    sh = clamp(hh + t.size * 0.16, 1, layer.canvas.height - sy);
  }
  const s = Math.min(size / sw, size / sh);
  const dw = sw * s, dh = sh * s;
  ctx.imageSmoothingQuality = 'high';
  try { ctx.drawImage(layer.canvas, sx, sy, sw, sh, (size - dw) / 2, (size - dh) / 2, dw, dh); } catch (e) { }
  return c;
}

function debounce(fn, ms = 120) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/* ---------------- 颜色 ---------------- */
function hexToRgb(hex) {
  hex = String(hex || '#000').trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length === 8) hex = hex.slice(0, 6);
  const n = parseInt(hex, 16);
  if (isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const pad2 = n => (n < 10 ? '0' : '') + Math.round(n);
/* 单通道 → 两位十六进制（pad2 是十进制补零，用于时间，不能拿来拼颜色） */
const hex2 = n => {
  const v = Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
  return (v < 16 ? '0' : '') + v.toString(16);
};
function rgbToHex(r, g, b) {
  return '#' + hex2(r) + hex2(g) + hex2(b);
}
function rgbaStr(hex, a = 1) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hh = 0;
  if (d !== 0) {
    if (mx === r) hh = ((g - b) / d) % 6;
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60; if (hh < 0) hh += 360;
  }
  return { h: hh, s: mx === 0 ? 0 : d / mx, v: mx };
}
function hsvToRgb(hh, s, v) {
  hh = ((hh % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) { r = c; g = x; }
  else if (hh < 120) { r = x; g = c; }
  else if (hh < 180) { g = c; b = x; }
  else if (hh < 240) { g = x; b = c; }
  else if (hh < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (mx + mn) / 2, d = mx - mn;
  if (d) {
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) hh = ((g - b) / d) % 6;
    else if (mx === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60; if (hh < 0) hh += 360;
  }
  return { h: hh, s, l };
}
function hslToRgb(hh, s, l) {
  hh = ((hh % 360) + 360) % 360 / 360;
  const hue2 = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (!s) r = g = b = l;
  else {
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    r = hue2(p, q, hh + 1 / 3); g = hue2(p, q, hh); b = hue2(p, q, hh - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function luminance(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

/* ---------------- 提示 ---------------- */
function toast(msg, type = '', action) {
  const root = $('#toastroot');
  if (!root) return;
  const ico = type === 'err'
    ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.4v.2"/></svg>'
    : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4.5 12.5l5 5 10-11"/></svg>';
  const t = h('div', { class: 'toast ' + type }, h('span', { class: 't-ico', html: ico }), h('span', { class: 't-msg' }, msg));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    t.style.transition = 'opacity .25s, transform .25s';
    t.style.opacity = '0'; t.style.transform = 'translateY(6px)';
    setTimeout(() => t.remove(), 260);
  };
  if (action) {
    t.append(h('button', {
      class: 'toast-act',
      onclick: e => { e.stopPropagation(); action.fn(); close(); }
    }, action.label));
  }
  while (root.children.length >= 3) root.firstElementChild.remove();
  while (root.children.length >= 3) root.firstElementChild.remove();
  root.appendChild(t);
  setTimeout(close, action ? 4600 : 2200);
  return t;
}

/* ---------------- 画布 -> Blob ---------------- */
function canvasBlob(canvas, type = 'image/png', quality) {
  return new Promise(resolve => {
    if (!canvas || !canvas.toBlob) { resolve(null); return; }
    canvas.toBlob(b => resolve(b), type, quality);
  });
}

/* ---------------- 数字格式 ---------------- */
const fmtInt = n => Math.round(n).toLocaleString('en-US');
function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function fmtTime(ts) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ---------------- 单位换算（标尺 / 尺寸输入） ---------------- */
const Units = {
  list: [['px', '像素'], ['mm', '毫米'], ['in', '英寸'], ['%', '百分比'], ['pt', '点']],
  dpi() { return (typeof App !== 'undefined' && App.doc && App.doc.dpi) || 72; },
  /** 文档像素 -> 单位值（% 按对应轴的长边计） */
  fromPx(px, unit, axis) {
    const dpi = this.dpi();
    switch (unit) {
      case 'mm': return px / dpi * 25.4;
      case 'in': return px / dpi;
      case 'pt': return px * 72 / dpi;
      case '%': {
        const base = (axis === 'y' ? (App.doc.h || 1) : (App.doc.w || 1));
        return px / base * 100;
      }
      default: return px;
    }
  },
  /** 单位值 -> 文档像素 */
  toPx(v, unit, axis) {
    const dpi = this.dpi();
    switch (unit) {
      case 'mm': return v * dpi / 25.4;
      case 'in': return v * dpi;
      case 'pt': return v * dpi / 72;
      case '%': {
        const base = (axis === 'y' ? (App.doc.h || 1) : (App.doc.w || 1));
        return v / 100 * base;
      }
      default: return v;
    }
  },
  /** 刻度文字：像素与百分比取整，物理单位按量级给小数 */
  label(v, unit) {
    if (Math.abs(v) < 1e-9) return '0';
    if (unit === 'in') return v.toFixed(Math.abs(v) < 10 ? 2 : 1);
    if (unit === 'mm') return Math.abs(v) < 10 ? v.toFixed(1) : String(Math.round(v));
    return String(Math.round(v));
  },
  /** 状态栏/信息面板用：px 值换算成带单位的可读串 */
  fmt(px, unit, axis) {
    if (unit === 'px') return Math.round(px) + ' px';
    return this.label(this.fromPx(px, unit, axis), unit) + ' ' + (unit === '%' ? '%' : unit);
  },
  next(unit) {
    const i = this.list.findIndex(u => u[0] === unit);
    return this.list[(i + 1) % this.list.length][0];
  }
};

/* ---------------- 几何 ---------------- */
function rectFromPoints(a, b) {
  return {
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y)
  };
}
function pointInRect(p, r) {
  return p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
}
function normalizeRect(r) {
  let { x, y, w, h } = r;
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  return { x, y, w, h };
}

/* ---------------- 存储 ---------------- */
const Store = {
  get(k, d) {
    try { const v = localStorage.getItem('dreikanter.' + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('dreikanter.' + k, JSON.stringify(v)); } catch (e) { /* quota */ }
  }
};

/* ---------------- 其它 ---------------- */
function nextFrame(fn) { requestAnimationFrame(() => requestAnimationFrame(fn)); }

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
}

function baseName(name) {
  return String(name || '未命名').replace(/\.[^.]+$/, '');
}

const COLOR_NAMES = {
  '黑': '#000000', '白': '#ffffff', '灰': '#808080', '红': '#e5484d', '橙': '#f08a24',
  '黄': '#f5d90a', '绿': '#46a758', '青': '#12a594', '蓝': '#3d8ef0', '紫': '#8e4ec6',
  '粉': '#e93d82', '棕': '#8b5e3c', '米': '#e8ddc8', '金': '#c9a227'
};

/* 去 HTML 标签，用于把指令回复转成纯文本 */
function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = String(html == null ? '' : html);
  return (d.textContent || '').replace(/\u00a0/g, ' ').trim();
}

/* 记录最近使用的颜色（最多 12 个） */
function pushRecentColor(hex) {
  if (!hex) return;
  hex = String(hex).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) return;
  const list = (App.recent || []).filter(c => c !== hex);
  list.unshift(hex);
  App.recent = list.slice(0, 12);
  Store.set('recent', App.recent);
  if (typeof UI !== 'undefined' && UI.renderRecent) UI.renderRecent();
}

/* 顶部进度条（长任务反馈） */
const Progress = {
  _t: 0,
  start(label) {
    const el = document.getElementById('progress');
    if (!el) return;
    el.classList.add('on');
    el.title = label || '';
    clearTimeout(this._t);
  },
  done() {
    const el = document.getElementById('progress');
    if (!el) return;
    clearTimeout(this._t);
    this._t = setTimeout(() => el.classList.remove('on'), 220);
  }
};

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function highlightMatch(text, q) {
  const t = String(text == null ? '' : text);
  if (!q) return escapeHtml(t);
  const i = t.toLowerCase().indexOf(String(q).toLowerCase());
  if (i < 0) return escapeHtml(t);
  return escapeHtml(t.slice(0, i)) + '<mark>' + escapeHtml(t.slice(i, i + String(q).length)) + '</mark>' + escapeHtml(t.slice(i + String(q).length));
}
