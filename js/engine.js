/* ==========================================================================
   Dreikanter photo — engine.js
   Canvas 合成引擎 / 图层 / 选区 / 历史 / 文档变换
   ========================================================================== */
'use strict';

const BLEND_MODES = [
  ['normal', '正常'], ['multiply', '正片叠底'], ['screen', '滤色'], ['overlay', '叠加'],
  ['darken', '变暗'], ['lighten', '变亮'], ['color-dodge', '颜色减淡'], ['color-burn', '颜色加深'],
  ['hard-light', '强光'], ['soft-light', '柔光'], ['difference', '差值'], ['exclusion', '排除'],
  ['hue', '色相'], ['saturation', '饱和度'], ['color', '颜色'], ['luminosity', '明度']
];
const BLEND_MAP = {
  normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten', 'color-dodge': 'color-dodge', 'color-burn': 'color-burn',
  'hard-light': 'hard-light', 'soft-light': 'soft-light', difference: 'difference',
  exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity'
};
const BLEND_LABEL = Object.fromEntries(BLEND_MODES);

const App = {
  doc: { w: 0, h: 0, name: '未命名', bg: 'transparent', dpi: 72 },
  layers: [],
  activeId: null,
  selection: null,          // {mask, path, bounds}
  view: { zoom: 1, cx: 0, cy: 0 },
  fg: '#ffffff',
  bg: '#111111',
  recent: Store.get('recent', []),
  tool: 'move',
  mode: 'ps',
  showGrid: false,
  previewId: null,
  previewCanvas: null,
  cropRect: null,
  cropAngle: 0,
  brushCursor: null,
  pointer: { x: 0, y: 0, inside: false },
  baseline: null,
  comparing: false,
  dirty: true,
  needLayout: true,
  animating: false,
  onChange: null,
  onHistory: null,
  docSerial: 0
};

/* ---------------- 图层 ---------------- */
function activeLayer() { return App.layers.find(l => l.id === App.activeId) || null; }
function layerById(id) { return App.layers.find(l => l.id === id) || null; }
function layerIndex(id) { return App.layers.findIndex(l => l.id === id); }

function createLayer(name, opts = {}) {
  const c = makeCanvas(App.doc.w, App.doc.h);
  const layer = {
    id: uid('L'),
    name: name || '图层',
    type: opts.type || 'raster',
    canvas: c,
    x: 0, y: 0,
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    text: opts.text || null,
    effects: null,
    _ver: 0
  };
  Object.defineProperty(layer, 'thumbDirty', {
    get() { return true; },
    set(v) { if (v) layer._ver++; },
    enumerable: true
  });
  return layer;
}

function addLayer(layer, aboveActive = true) {
  const l = layer || createLayer('图层 ' + (App.layers.length + 1));
  if (aboveActive && App.activeId) {
    const i = layerIndex(App.activeId);
    App.layers.splice(i + 1, 0, l);
  } else {
    App.layers.push(l);
  }
  App.activeId = l.id;
  invalidate(); sync(); drawOverlay();
  return l;
}

function deleteLayer(id) {
  if (App.layers.length <= 1) { toast('至少需要保留一个图层', 'err'); return; }
  const i = layerIndex(id);
  History.begin('删除图层', []);
  App.layers.splice(i, 1);
  if (App.activeId === id) App.activeId = (App.layers[i] || App.layers[i - 1]).id;
  History.end();
  if (typeof A11y !== 'undefined') A11y.say('已删除图层，剩余 ' + App.layers.length + ' 个');
  sync(); invalidate();
  toast('已删除图层', '', { label: '撤销', fn: () => History.undo() });
}

function duplicateLayer(id) {
  const l = layerById(id);
  if (!l) return;
  History.begin('复制图层', []);
  const n = Object.assign({}, l, {
    id: uid('L'), name: l.name + ' 拷贝', canvas: cloneCanvas(l.canvas),
    text: l.text ? { ...l.text } : null, thumbDirty: true
  });
  App.layers.splice(layerIndex(id) + 1, 0, n);
  App.activeId = n.id;
  History.end();
  sync(); invalidate();
}

function mergeDown(id) {
  const i = layerIndex(id);
  if (i <= 0) { toast('下方没有可合并的图层', 'err'); return; }
  History.begin('向下合并', [App.layers[i - 1].id, id]);
  const top = App.layers[i], bottom = App.layers[i - 1];
  const c = ctx2d(bottom.canvas);
  c.save();
  c.globalAlpha = top.opacity;
  c.globalCompositeOperation = BLEND_MAP[top.blend] || 'source-over';
  c.drawImage(top.canvas, top.x - bottom.x, top.y - bottom.y);
  c.restore();
  bottom.thumbDirty = true;
  App.layers.splice(i, 1);
  App.activeId = bottom.id;
  History.end();
  sync(); invalidate();
  toast('已向下合并', '', { label: '撤销', fn: () => History.undo() });
}

function flattenImage() {
  History.begin('拼合图像', []);
  const out = compositeCanvas(false);
  const l = createLayer('背景');
  ctx2d(l.canvas).drawImage(out, 0, 0);
  App.layers = [l];
  App.activeId = l.id;
  History.end();
  sync(); invalidate();
  toast('已拼合图像', '', { label: '撤销', fn: () => History.undo() });
}

function reorderLayer(id, delta) {
  const i = layerIndex(id);
  const j = i + delta;
  if (j < 0 || j >= App.layers.length) return;
  History.begin('调整图层顺序', []);
  const [l] = App.layers.splice(i, 1);
  App.layers.splice(j, 0, l);
  History.end();
  sync(); invalidate();
}

/* ---------------- 文档 ---------------- */
function newDocument(w, h, opts = {}) {
  App._views = {};
  App.doc = {
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
    name: opts.name || '未命名',
    bg: opts.bg || 'transparent',
    dpi: clamp(Math.round(opts.dpi || 72), 1, 2400)
  };
  App.layers = [];
  App.selection = null;
  App.previewCanvas = null; App.previewId = null;
  App.cropRect = null;
  App.docSerial++;
  const l = createLayer(opts.bg && opts.bg !== 'transparent' ? '背景' : '图层 1');
  if (opts.bg && opts.bg !== 'transparent') {
    const c = ctx2d(l.canvas);
    c.fillStyle = opts.bg;
    c.fillRect(0, 0, App.doc.w, App.doc.h);
  }
  App.layers.push(l);
  App.activeId = l.id;
  History.reset();
  fitView();
  captureBaseline();
  if (typeof Docs !== 'undefined') Docs.registerCurrent();
  invalidate(true);
  sync();
  return l;
}

function docSizeLabel() { return `${fmtInt(App.doc.w)} × ${fmtInt(App.doc.h)} px`; }

/* ---------------- 视图 ---------------- */
function fitView() {
  const stage = $('#stage');
  if (!stage || !App.doc.w) return;
  const r = stage.getBoundingClientRect();
  const apsis = App.mode === 'apsis';
  const imm = document.body.classList.contains('immersive');
  const narrow = r.width <= 820;
  const padL = imm ? 40 : narrow ? 16 : apsis ? 46 : 74;
  const padR = imm ? 40 : narrow ? 16 : apsis ? 342 : 74;
  const padT = imm ? 40 : narrow ? 14 : apsis ? 206 : 90;
  const padB = imm ? 40 : narrow ? 32 : apsis ? 148 : 90;
  const z = Math.min((r.width - padL - padR) / App.doc.w, (r.height - padT - padB) / App.doc.h);
  App.view.zoom = clamp(z, 0.02, 8);
  App.view.cx = App.doc.w / 2;
  App.view.cy = App.doc.h / 2;
  if (apsis && !imm) {
    App.view.cx += ((padR - padL) / 2) / App.view.zoom;
    App.view.cy += ((padB - padT) / 2) / App.view.zoom;
  }
  invalidate(true, false);
  updateZoomLabel();
}
function updateZoomLabel() {
  if (typeof UI !== 'undefined' && UI.updateZoomLabel) UI.updateZoomLabel();
  else {
    const el = $('#zoomLabel');
    if (el) el.textContent = Math.round(App.view.zoom * 100) + '%';
  }
  document.body.classList.toggle('pixel-view', App.view.zoom >= 2.4);
}
function setZoom(z, ax, ay) {
  const stage = $('#stage');
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  z = clamp(z, 0.02, 16);
  const mx = ax == null ? r.width / 2 : ax - r.left;
  const my = ay == null ? r.height / 2 : ay - r.top;
  const docX = App.view.cx + (mx - r.width / 2) / App.view.zoom;
  const docY = App.view.cy + (my - r.height / 2) / App.view.zoom;
  App.view.zoom = z;
  App.view.cx = docX - (mx - r.width / 2) / z;
  App.view.cy = docY - (my - r.height / 2) / z;
  invalidate(true, false);
  updateZoomLabel();
}
function panBy(dxScreen, dyScreen) {
  App.view.cx -= dxScreen / App.view.zoom;
  App.view.cy -= dyScreen / App.view.zoom;
  invalidate(true, false);
}

function screenToDoc(clientX, clientY) {
  const vc = $('#view');
  if (!vc) return { x: 0, y: 0 };
  const r = vc.getBoundingClientRect();
  return {
    x: (clientX - r.left) / r.width * App.doc.w,
    y: (clientY - r.top) / r.height * App.doc.h
  };
}
function docToScreen(x, y) {
  const vc = $('#view');
  const r = vc.getBoundingClientRect();
  return { x: r.left + x / App.doc.w * r.width, y: r.top + y / App.doc.h * r.height };
}

/* ---------------- 渲染 ---------------- */
let _raf = 0;
/**
 * layout=true 需要重排画布框；content=false 表示只是视图变化（缩放/平移），
 * 此时跳过逐图层合成，是缩放平移流畅的关键。
 */
function invalidate(layout, content = true) {
  if (layout) App.needLayout = true;
  if (content) App.dirty = true;
  if (_raf) return;
  _raf = requestAnimationFrame(() => {
    _raf = 0;
    if (App.needLayout) layoutFrame();
    if (App.dirty) drawComposite();
    drawOverlay();
  });
}
function invalidateOverlay() {
  if (App._oRaf) return;
  App._oRaf = requestAnimationFrame(() => { App._oRaf = 0; drawOverlay(); });
}

function layoutFrame() {
  const stage = $('#stage'), frame = $('#docframe');
  if (!stage || !frame || !App.doc.w) return;
  const r = stage.getBoundingClientRect();
  const z = App.view.zoom;
  const w = App.doc.w * z, hh = App.doc.h * z;
  const left = r.width / 2 - App.view.cx * z;
  const top = r.height / 2 - App.view.cy * z;
  frame.style.width = w + 'px';
  frame.style.height = hh + 'px';
  frame.style.left = left + 'px';
  frame.style.top = top + 'px';

  const vc = $('#view'), oc = $('#overlay');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  /* 显示画布按 devicePixelRatio 放大（上限 16M 像素，超大文档自动降到 1x） */
  const MAXPX = 16e6;
  const vdpr = Math.max(1, Math.min(dpr, 2, Math.sqrt(MAXPX / Math.max(1, App.doc.w * App.doc.h))));
  App._vdpr = vdpr;
  const vw = Math.max(1, Math.round(App.doc.w * vdpr));
  const vh = Math.max(1, Math.round(App.doc.h * vdpr));
  if (vc.width !== vw || vc.height !== vh) { vc.width = vw; vc.height = vh; }
  const ow = Math.max(1, Math.round(w * dpr)), oh = Math.max(1, Math.round(hh * dpr));
  if (oc.width !== ow || oc.height !== oh) { oc.width = ow; oc.height = oh; }
  App._dpr = dpr;
  /* 标尺钉在视口边缘（画布平移时标尺本身不动，只有刻度跟着走） */
  if (typeof Guides !== 'undefined' && Guides.layout) Guides.layout(0, 0, r.width, r.height, dpr);
  App.needLayout = false;
}

function drawComposite() {
  const vc = $('#view');
  if (!vc || !App.doc.w) return;
  const ctx = ctx2d(vc);
  const vd = App._vdpr || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, vc.width, vc.height);
  /* HiDPI：按 DPR 放大绘制，图形在 1:1 与高分屏上都清晰 */
  ctx.setTransform(vd, 0, 0, vd, 0, 0);
  ctx.imageSmoothingEnabled = App.view.zoom < 2.4;
  ctx.imageSmoothingQuality = 'high';
  if (App.doc.bg && App.doc.bg !== 'transparent') {
    ctx.fillStyle = App.doc.bg;
    ctx.fillRect(0, 0, App.doc.w, App.doc.h);
  }
  /* 对比原图 */
  if (App.comparing && App.baseline) {
    ctx.drawImage(App.baseline, 0, 0, App.doc.w, App.doc.h);
    App.dirty = false;
    scheduleHistogram();
    return;
  }
  for (const l of App.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    ctx.globalAlpha = clamp(l.opacity, 0, 1);
    ctx.globalCompositeOperation = BLEND_MAP[l.blend] || 'source-over';
    const isPrev = App.previewId === l.id && App.previewCanvas;
    const src = isPrev ? App.previewCanvas : l.canvas;
    if (typeof buildLayerFX === 'function' && layerHasFX(l)) {
      const fxc = buildLayerFX(l);
      if (fxc) { try { ctx.drawImage(fxc, l.x, l.y); } catch (e) { } }
    }
    try {
      if (isPrev && src.width !== l.canvas.width) ctx.drawImage(src, l.x, l.y, l.canvas.width, l.canvas.height);
      else ctx.drawImage(src, l.x, l.y);
    } catch (e) { /* ignore */ }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  App.dirty = false;
  scheduleHistogram();
}

let _histT = 0;
function scheduleHistogram() {
  clearTimeout(_histT);
  _histT = setTimeout(() => {
    if (typeof UI !== 'undefined' && UI.drawHistogram) UI.drawHistogram();
  }, 220);
}

/* ---------------- 覆盖层 ---------------- */
function drawOverlay() {
  const oc = $('#overlay');
  if (!oc || !App.doc.w) return;
  const ctx = ctx2d(oc);
  const dpr = App._dpr || 1;
  const z = App.view.zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, oc.width, oc.height);
  ctx.scale(dpr, dpr);

  /* 网格 */
  if (typeof Guides !== 'undefined' && Guides.drawGrid) {
    Guides.drawGrid(ctx, z);
  } else if (App.showGrid) {
    const conf = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : {};
    const step = Math.max(8, conf.gridSize || 100);
    if (step * z > 5) {
      ctx.save();
      ctx.globalAlpha = .5;
      ctx.strokeStyle = conf.gridColor || 'rgba(120,170,255,.5)';
      ctx.lineWidth = 1;
      for (let x = step; x < App.doc.w; x += step) {
        ctx.beginPath(); ctx.moveTo(x * z, 0); ctx.lineTo(x * z, App.doc.h * z); ctx.stroke();
      }
      for (let y = step; y < App.doc.h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y * z); ctx.lineTo(App.doc.w * z, y * z); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* 参考线 */
  if (typeof Guides !== 'undefined' && Guides.draw) Guides.draw(ctx, z);

  /* 裁剪框 */
  if (App.cropRect) drawCropOverlay(ctx, z);

  /* 自由变换 */
  if (typeof Transform !== 'undefined' && Transform.active && Transform.drawOverlay) {
    Transform.drawOverlay(ctx, z);
  }

  /* 选区蚂蚁线 */
  if (App.selPreviewMask) {
    ctx.save();
    ctx.globalAlpha = .35;
    ctx.drawImage(App.selPreviewMask, 0, 0, App.doc.w * z, App.doc.h * z);
    ctx.restore();
  }
  if (App.selection && (App.selection.antPath || App.selection.path)) {
    const ap = App.selection.antPath || App.selection.path;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeStyle = (typeof Settings !== 'undefined' && Settings.data && Settings.data.antsColor) ? Settings.data.antsColor : 'rgba(255,255,255,.95)';
    ctx.save();
    ctx.scale(z, z);
    ctx.lineWidth = 1 / z;
    ctx.stroke(ap);
    ctx.restore();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(0,0,0,.95)';
    ctx.lineDashOffset = -((performance.now() / 70) % 8);
    ctx.save();
    ctx.scale(z, z);
    ctx.lineWidth = 1 / z;
    ctx.stroke(ap);
    ctx.restore();
    ctx.restore();
    if (!App.animating) tickAnts();
  }

  /* 工具预览 */
  if (typeof Tools !== 'undefined' && Tools.drawPreview) Tools.drawPreview(ctx, z);

  /* 画笔光标 */
  if (App.brushCursor && App.pointer.inside && !App.cropRect) {
    const { x, y, r } = App.brushCursor;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x * z, y * z, Math.max(2, r * z), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.arc(x * z, y * z, Math.max(2, r * z) + 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
function tickAnts() {
  App.animating = true;
  let last = 0;
  const loop = (t) => {
    if (!App.selection) { App.animating = false; invalidateOverlay(); return; }
    /* 蚂蚁线约 15fps 重绘即可，避免每帧清空整张覆盖层 */
    if (t - last > 64) { last = t; drawOverlay(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function cropQuad(r, angle) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const a = (angle || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  return [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]].map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

function cropLerp(q, tx, ty) {
  const top = { x: q[0].x + (q[1].x - q[0].x) * tx, y: q[0].y + (q[1].y - q[0].y) * tx };
  const bot = { x: q[3].x + (q[2].x - q[3].x) * tx, y: q[3].y + (q[2].y - q[3].y) * tx };
  return { x: top.x + (bot.x - top.x) * ty, y: top.y + (bot.y - top.y) * ty };
}

function drawCropOverlay(ctx, z) {
  const r = App.cropRect;
  const angle = App.cropAngle || 0;
  const q = cropQuad(r, angle);
  const W = App.doc.w * z, H = App.doc.h * z;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(q[0].x * z, q[0].y * z);
  for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x * z, q[i].y * z);
  ctx.closePath();
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(q[0].x * z, q[0].y * z);
  for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x * z, q[i].y * z);
  ctx.closePath();
  ctx.stroke();
  /* 辅助线 */
  const guide = (Tools.state.crop && Tools.state.crop.guide) || 'thirds';
  const ratios = guide === 'golden' ? [0.382, 0.618] : guide === 'grid' ? [0.25, 0.5, 0.75] : guide === 'none' ? [] : [1 / 3, 2 / 3];
  ctx.strokeStyle = 'rgba(255,255,255,.30)';
  ratios.forEach(f => {
    const a = cropLerp(q, f, 0), b = cropLerp(q, f, 1);
    ctx.beginPath(); ctx.moveTo(a.x * z, a.y * z); ctx.lineTo(b.x * z, b.y * z); ctx.stroke();
    const c = cropLerp(q, 0, f), d = cropLerp(q, 1, f);
    ctx.beginPath(); ctx.moveTo(c.x * z, c.y * z); ctx.lineTo(d.x * z, d.y * z); ctx.stroke();
  });
  /* 手柄 */
  ctx.fillStyle = '#0d1016';
  ctx.strokeStyle = 'rgba(255,255,255,.95)';
  const hs = [
    [q[0].x, q[0].y], [(q[0].x + q[1].x) / 2, (q[0].y + q[1].y) / 2], [q[1].x, q[1].y],
    [(q[1].x + q[2].x) / 2, (q[1].y + q[2].y) / 2], [q[2].x, q[2].y],
    [(q[2].x + q[3].x) / 2, (q[2].y + q[3].y) / 2], [q[3].x, q[3].y],
    [(q[3].x + q[0].x) / 2, (q[3].y + q[0].y) / 2]
  ];
  hs.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.rect(x * z - 4, y * z - 4, 8, 8);
    ctx.fill(); ctx.stroke();
  });
  /* 旋转手柄 */
  const top = cropLerp(q, .5, 0);
  const a2 = angle * Math.PI / 180;
  const rh = { x: top.x + Math.sin(a2) * 26 / z, y: top.y - Math.cos(a2) * 26 / z };
  ctx.beginPath();
  ctx.moveTo(top.x * z, top.y * z);
  ctx.lineTo(rh.x * z, rh.y * z);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(rh.x * z, rh.y * z, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  /* 角度徽标 */
  if (Math.abs(angle) > 0.01) {
    const txt = angle.toFixed(1) + '°';
    ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
    const tw = ctx.measureText(txt).width + 10;
    const bx = clamp(q[0].x * z, 4, W - tw - 4), by = clamp(q[0].y * z - 20, 4, H - 20);
    ctx.fillStyle = 'rgba(10,12,16,.84)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, tw, 15, 3); else ctx.rect(bx, by, tw, 15);
    ctx.fill();
    ctx.fillStyle = '#cfe0ff';
    ctx.fillText(txt, bx + 5, by + 11);
  }
  ctx.restore();
}

/* ---------------- 选区 ---------------- */
function setSelectionFromMask(mask) {
  const b = maskBounds(mask);
  if (!b) { deselect(); return; }
  const paths = maskPaths(mask);
  App.selection = { mask, path: paths.fill, fillPath: paths.fill, antPath: paths.ants, bounds: b };
  invalidateOverlay();
  sync();
}
function deselect() {
  if (!App.selection) return;
  App.selection = null;
  invalidateOverlay();
  sync();
}
function selectAll() {
  const w = App.doc.w, h = App.doc.h;
  const m = makeCanvas(w, h);
  const c = ctx2d(m);
  c.fillStyle = '#fff';
  c.fillRect(0, 0, w, h);
  /* 整幅选区直接用矩形路径，避免 1200 万像素两次扫描 */
  const path = new Path2D();
  path.rect(0, 0, w, h);
  App.selection = { mask: m, path, fillPath: path, antPath: path, bounds: { x: 0, y: 0, w, h } };
  invalidateOverlay();
  sync();
  toast('已全选');
}
function invertSelection() {
  const m = makeCanvas(App.doc.w, App.doc.h);
  const c = ctx2d(m);
  c.fillStyle = '#fff';
  c.fillRect(0, 0, m.width, m.height);
  if (App.selection) {
    c.globalCompositeOperation = 'destination-out';
    c.drawImage(App.selection.mask, 0, 0);
  }
  setSelectionFromMask(m);
}

/* ---------------- 选区精修 / 保存 ---------------- */
function refineMask(mask, opts = {}) {
  const feather = Math.max(0, opts.feather || 0);
  const expand = opts.expand || 0;
  const w = mask.width, h = mask.height;
  const out = makeCanvas(w, h);
  const c = ctx2d(out);
  const blur = feather > 0 ? feather / 2 : (expand ? Math.max(1, Math.abs(expand) * .9) : 0);
  if (blur > 0) c.filter = 'blur(' + blur.toFixed(2) + 'px)';
  c.drawImage(mask, 0, 0);
  c.filter = 'none';
  if (expand) {
    const img = c.getImageData(0, 0, w, h);
    const a = img.data;
    const t = expand > 0 ? 96 : 160;
    for (let i = 3; i < a.length; i += 4) a[i] = a[i] > t ? 255 : 0;
    c.putImageData(img, 0, 0);
  }
  return out;
}

/** 预览用：把当前选区按参数生成一张缩略蒙版 */
function selectionPreview(sel, opts) {
  if (!sel) return null;
  const scale = Math.min(1, 900 / Math.max(sel.mask.width, sel.mask.height));
  const w = Math.max(1, Math.round(sel.mask.width * scale));
  const h = Math.max(1, Math.round(sel.mask.height * scale));
  const small = makeCanvas(w, h);
  ctx2d(small).drawImage(sel.mask, 0, 0, w, h);
  return refineMask(small, {
    feather: (opts.feather || 0) * scale,
    expand: Math.round((opts.expand || 0) * scale)
  });
}

function applySelectionRefine(opts) {
  if (!App.selection) { toast('请先建立选区', 'err'); return false; }
  const m = refineMask(App.selection.mask, opts);
  App.selPreviewMask = null;
  setSelectionFromMask(m);
  return true;
}

function saveSelectionSlot() {
  if (!App.selection) { toast('没有可保存的选区', 'err'); return false; }
  if (!Array.isArray(App.selSlots)) App.selSlots = [];
  App.selSlots.push({ mask: cloneCanvas(App.selection.mask), bounds: { ...App.selection.bounds }, at: Date.now() });
  if (App.selSlots.length > 8) App.selSlots.shift();
  toast('已保存选区（' + App.selSlots.length + ' 个）', 'ok');
  return true;
}

function loadSelectionSlot(i) {
  const s = (App.selSlots || [])[i];
  if (!s) return false;
  setSelectionFromMask(cloneCanvas(s.mask));
  toast('已载入选区');
  return true;
}
function maskBounds(mask) {
  const w = mask.width, h = mask.height;
  const d = ctx2d(mask).getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0, row = 0; y < h; y++, row += w) {
    let idx = row * 4 + 3;
    for (let x = 0; x < w; x++, idx += 4) {
      if (d[idx] > 4) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
/**
 * 由选区蒙版生成两条路径：
 *  fill —— 逐行合并的矩形，可正确参与 fill / clip
 *  ants —— 像素边界线段，用于蚂蚁线描边
 */
function maskPaths(mask) {
  const w = mask.width, h = mask.height;
  const d = ctx2d(mask).getImageData(0, 0, w, h).data;
  const A = new Uint8Array(w * h);
  for (let i = 0, j = 3; i < A.length; i++, j += 4) A[i] = d[j];
  const fill = new Path2D();
  const ants = new Path2D();
  for (let y = 0, row = 0; y < h; y++, row += w) {
    let run = -1;
    for (let x = 0; x < w; x++) {
      const sel = A[row + x] > 127;
      if (sel && run < 0) run = x;
      if (!sel && run >= 0) { fill.rect(run, y, x - run, 1); run = -1; }
      if (!sel) continue;
      if (y === 0 || A[row - w + x] <= 127) { ants.moveTo(x, y); ants.lineTo(x + 1, y); }
      if (y === h - 1 || A[row + w + x] <= 127) { ants.moveTo(x, y + 1); ants.lineTo(x + 1, y + 1); }
      if (x === 0 || A[row + x - 1] <= 127) { ants.moveTo(x, y); ants.lineTo(x, y + 1); }
      if (x === w - 1 || A[row + x + 1] <= 127) { ants.moveTo(x + 1, y); ants.lineTo(x + 1, y + 1); }
    }
    if (run >= 0) fill.rect(run, y, w - run, 1);
  }
  return { fill, ants };
}
/** 用当前选区裁剪某个图层上下文（在 draw 前调用，坐标自动加偏移） */
function clipSelection(ctx, layer) {
  if (!App.selection) return false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(-(layer.x || 0), -(layer.y || 0));
  ctx.clip(App.selection.path);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}
/** 按选区把内容合并回图层（先画到临时层） */
function applySelectionMask(layer, before) {
  if (!App.selection) return;
  const tmp = makeCanvas(App.doc.w, App.doc.h);
  const tc = ctx2d(tmp);
  tc.drawImage(layer.canvas, 0, 0);
  tc.globalCompositeOperation = 'destination-in';
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.drawImage(App.selection.mask, -layer.x, -layer.y);
  const keep = makeCanvas(App.doc.w, App.doc.h);
  const kc = ctx2d(keep);
  kc.drawImage(before, 0, 0);
  kc.globalCompositeOperation = 'destination-out';
  kc.drawImage(App.selection.mask, -layer.x, -layer.y);

  const c = ctx2d(layer.canvas);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  c.drawImage(keep, 0, 0);
  c.drawImage(tmp, 0, 0);
  layer.thumbDirty = true;
}

/* ---------------- 历史 ---------------- */
const History = {
  entries: [],
  idx: -1,
  pending: null,
  max: 36,
  bytes: 0,

  reset() {
    this.entries = []; this.idx = -1; this.pending = null; this.bytes = 0;
    if (App.onHistory) App.onHistory();
  },
  begin(label, layerIds) {
    if (this.pending) this.end();
    const ids = layerIds || (activeLayer() ? [activeLayer().id] : []);
    this.pending = { label, ids, pre: this.capture(ids) };
  },
  end(label) {
    if (!this.pending) return;
    const p = this.pending;
    const post = this.capture(p.ids);
    if (p.label === null) { this.pending = null; return; }
    const entry = { label: label || p.label, pre: p.pre, post };
    this.entries.splice(this.idx + 1);
    this.entries.push(entry);
    this.idx = this.entries.length - 1;
    App.dirty = true;
    if (typeof Docs !== 'undefined') Docs.markDirty();
    this.bytes += this.sizeOf(entry);
    this.pending = null;
    while (this.entries.length > this.max || this.bytes > 340 * 1024 * 1024) {
      if (this.entries.length <= 1) break;
      const rm = this.entries.shift();
      this.bytes -= this.sizeOf(rm);
      this.idx--;
    }
    if (App.onHistory) App.onHistory();
  },
  capture(ids) {
    const meta = App.layers.map(l => ({
      id: l.id, name: l.name, type: l.type, x: l.x, y: l.y, opacity: l.opacity,
      blend: l.blend, visible: l.visible, locked: l.locked,
      text: l.text ? { ...l.text } : null, canvas: l.canvas
    }));
    const pixels = {};
    ids.forEach(id => {
      const l = layerById(id);
      if (l) pixels[id] = cloneCanvas(l.canvas);
    });
    return {
      meta, pixels,
      doc: { ...App.doc },
      activeId: App.activeId,
      selection: App.selection
    };
  },
  sizeOf(entry) {
    let n = 0;
    [entry.pre, entry.post].forEach(s => {
      for (const k in s.pixels) n += s.pixels[k].width * s.pixels[k].height * 4;
    });
    return n;
  },
  restore(state) {
    App.doc = { ...state.doc };
    App.layers = state.meta.map(m => {
      const px = state.pixels[m.id];
      const canvas = px ? cloneCanvas(px) : cloneCanvas(m.canvas);
      return { ...m, canvas, thumbDirty: true };
    });
    App.activeId = state.activeId;
    App.selection = state.selection || null;
    App.previewCanvas = null; App.previewId = null;
    App.cropRect = null;
    fitIfSizeChanged(state.doc);
    invalidate(true);
    sync();
    if (App.selection) tickAnts();
    if (App.onHistory) App.onHistory();
  },
  undo() {
    if (this.pending) return;
    if (this.idx < 0) { toast('没有可撤销的操作'); return; }
    const e = this.entries[this.idx];
    this.restore(e.pre);
    this.idx--;
    if (typeof A11y !== 'undefined') A11y.say('已撤销：' + e.label);
  },
  redo() {
    if (this.pending) return;
    if (this.idx >= this.entries.length - 1) { toast('没有可重做的操作'); return; }
    this.idx++;
    this.restore(this.entries[this.idx].post);
    if (typeof A11y !== 'undefined') A11y.say('已重做：' + this.entries[this.idx].label);
    if (App.onHistory) App.onHistory();
  },
  jump(i) {
    if (i === this.idx) return;
    if (i < this.idx) {
      while (this.idx > i) { this.restore(this.entries[this.idx].pre); this.idx--; }
    } else {
      while (this.idx < i) { this.idx++; this.restore(this.entries[this.idx].post); }
    }
    if (App.onHistory) App.onHistory();
  },
  get state() { return { entries: this.entries, idx: this.idx }; }
};

let _lastDocSize = '';
function fitIfSizeChanged(doc) {
  const k = doc.w + 'x' + doc.h;
  if (k !== _lastDocSize) { _lastDocSize = k; fitView(); }
}

/* ---------------- 文档变换 ---------------- */
function bakeTransform(label, makeCanvasFn, mapPoint, newDim) {
  History.begin(label, App.layers.map(l => l.id));
  for (const l of App.layers) {
    const c = makeCanvasFn(l);
    if (l.text && mapPoint) {
      const p = mapPoint(l.text.x, l.text.y);
      l.text.x = p.x; l.text.y = p.y;
    }
    l.canvas = c;
    l.x = 0; l.y = 0;
    l.thumbDirty = true;
  }
  if (newDim) { App.doc.w = newDim.w; App.doc.h = newDim.h; }
  History.end();
  invalidate(true); sync();
  toast(label + ' 完成');
}

function cropToRect(rect, angle) {
  rect = normalizeRect(rect);
  angle = clamp(Number(angle) || 0, -45, 45);
  const rotated = Math.abs(angle) > 0.01;
  const x = rotated ? Math.round(rect.x) : Math.round(clamp(rect.x, 0, App.doc.w));
  const y = rotated ? Math.round(rect.y) : Math.round(clamp(rect.y, 0, App.doc.h));
  const w = Math.round(clamp(rect.w, 1, rotated ? 20000 : App.doc.w - x));
  const h = Math.round(clamp(rect.h, 1, rotated ? 20000 : App.doc.h - y));
  if (w < 2 || h < 2) { toast('裁剪区域太小', 'err'); return; }
  History.begin('裁剪', App.layers.map(l => l.id));
  const rad = angle * Math.PI / 180;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  App.layers.forEach(l => {
    const c = makeCanvas(w, h);
    const cc = ctx2d(c);
    if (rotated) {
      /* 自动补边：整层做 cover 拉伸 + 虚化当底，再把旋转后的画面叠上去 */
      const s = Math.max(w / l.canvas.width, h / l.canvas.height);
      const bw = l.canvas.width * s, bh = l.canvas.height * s;
      cc.save();
      cc.filter = 'blur(10px)';
      cc.globalAlpha = .92;
      cc.drawImage(l.canvas, (w - bw) / 2, (h - bh) / 2, bw, bh);
      cc.restore();
      cc.save();
      cc.translate(w / 2, h / 2);
      cc.rotate(-rad);
      cc.translate(-cx, -cy);
      cc.drawImage(l.canvas, 0, 0);
      cc.restore();
    } else {
      cc.drawImage(l.canvas, -x, -y);
    }
    if (l.text) { l.text.x -= x; l.text.y -= y; }
    l.canvas = c; l.x = 0; l.y = 0; l.thumbDirty = true;
  });
  App.doc.w = w; App.doc.h = h;
  App.selection = null; App.cropRect = null; App.cropAngle = 0;
  History.end();
  _lastDocSize = '';
  fitView(); sync();
  toast(`已裁剪为 ${w} × ${h}` + (rotated ? ` · 拉直 ${angle}°` : ''));
}

function cropToSelection() {
  if (!App.selection) { toast('请先建立选区', 'err'); return; }
  cropToRect(App.selection.bounds);
}

function rotateDoc(deg) {
  const w = App.doc.w, h = App.doc.h;
  const swap = Math.abs(deg) % 180 === 90;
  bakeTransform(`旋转 ${deg}°`, (l) => {
    const c = makeCanvas(swap ? h : w, swap ? w : h);
    const x = ctx2d(c);
    x.save();
    x.translate(c.width / 2, c.height / 2);
    x.rotate(deg * Math.PI / 180);
    x.drawImage(l.canvas, -w / 2, -h / 2);
    x.restore();
    return c;
  }, (x, y) => {
    if (deg === 90) return { x: h - y, y: x };
    if (deg === -90 || deg === 270) return { x: y, y: w - x };
    return { x: w - x, y: h - y };
  }, { w: swap ? h : w, h: swap ? w : h });
  App.selection = null;
  _lastDocSize = '';
  fitView();
  App.layers.forEach(l => { if (l.text) l.type = 'raster', l.text = null; });
  sync();
}

function flipDoc(horizontal) {
  const w = App.doc.w, h = App.doc.h;
  bakeTransform(horizontal ? '水平翻转' : '垂直翻转', (l) => {
    const c = makeCanvas(w, h);
    const x = ctx2d(c);
    x.save();
    x.translate(horizontal ? w : 0, horizontal ? 0 : h);
    x.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
    x.drawImage(l.canvas, 0, 0);
    x.restore();
    return c;
  }, (x, y) => horizontal ? { x: w - x, y } : { x, y: h - y });
  App.selection = null;
  App.layers.forEach(l => { if (l.text) l.type = 'raster', l.text = null; });
}

function resizeImage(nw, nh) {
  nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh));
  const sx = nw / App.doc.w, sy = nh / App.doc.h;
  History.begin('图像大小', App.layers.map(l => l.id));
  App.layers.forEach(l => {
    const c = makeCanvas(nw, nh);
    const x = ctx2d(c);
    x.imageSmoothingQuality = 'high';
    x.drawImage(l.canvas, 0, 0, nw, nh);
    l.canvas = c; l.thumbDirty = true;
    if (l.text) { l.text.size *= (sx + sy) / 2; l.text.x *= sx; l.text.y *= sy; }
  });
  App.doc.w = nw; App.doc.h = nh;
  History.end();
  _lastDocSize = '';
  fitView(); sync();
}

function resizeCanvas(nw, nh, ax = .5, ay = .5) {
  nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh));
  const dx = Math.round((nw - App.doc.w) * ax);
  const dy = Math.round((nh - App.doc.h) * ay);
  History.begin('画布大小', App.layers.map(l => l.id));
  App.layers.forEach(l => {
    const c = makeCanvas(nw, nh);
    ctx2d(c).drawImage(l.canvas, dx, dy);
    l.canvas = c; l.x = 0; l.y = 0; l.thumbDirty = true;
    if (l.text) { l.text.x += dx; l.text.y += dy; }
  });
  App.doc.w = nw; App.doc.h = nh;
  History.end();
  _lastDocSize = '';
  fitView(); sync();
}

function trimTransparent() {
  const cv = compositeCanvas(false);
  const d = ctx2d(cv).getImageData(0, 0, cv.width, cv.height).data;
  let minX = cv.width, minY = cv.height, maxX = -1, maxY = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (d[(y * cv.width + x) * 4 + 3] > 2) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) { toast('画面为空', 'err'); return; }
  cropToRect({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
}

/* ---------------- 合成 / 导出 ---------------- */
/** 记录「原图」用于对比（\ 键或状态栏按钮） */
function captureBaseline() {
  if (!App.doc.w) { App.baseline = null; return; }
  try { App.baseline = compositeCanvas(false); } catch (e) { App.baseline = null; }
}

function setComparing(on) {
  if (!App.baseline) { toast('还没有可对比的原图', 'err'); return; }
  App.comparing = !!on;
  const b = $('#compareBtn');
  if (b) b.classList.toggle('active', App.comparing);
  const hint = $('#statusHint');
  if (hint) hint.textContent = App.comparing ? '对比原图（松开返回）' : '就绪';
  invalidate();
}

function compositeCanvas(flatten = false, bgColor) {
  const c = makeCanvas(App.doc.w, App.doc.h);
  const x = ctx2d(c);
  if (flatten) {
    x.fillStyle = bgColor || (App.doc.bg !== 'transparent' ? App.doc.bg : '#ffffff');
    x.fillRect(0, 0, c.width, c.height);
  } else if (App.doc.bg !== 'transparent') {
    x.fillStyle = App.doc.bg;
    x.fillRect(0, 0, c.width, c.height);
  }
  for (const l of App.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    x.globalAlpha = clamp(l.opacity, 0, 1);
    x.globalCompositeOperation = BLEND_MAP[l.blend] || 'source-over';
    if (typeof buildLayerFX === 'function' && layerHasFX(l)) {
      const fxc = buildLayerFX(l);
      if (fxc) { try { x.drawImage(fxc, l.x, l.y); } catch (e) { } }
    }
    x.drawImage(l.canvas, l.x, l.y);
  }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  return c;
}

/* 导出编码：优先 OffscreenCanvas，回退 toBlob */
async function canvasToBlob(canvas, type, quality) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const oc = new OffscreenCanvas(canvas.width, canvas.height);
      const c = oc.getContext('2d');
      c.drawImage(canvas, 0, 0);
      return await oc.convertToBlob({ type, quality });
    } catch (e) { /* 回退 */ }
  }
  return await new Promise(res => canvas.toBlob(res, type, quality));
}

async function exportImageAsync(job = {}) {
  const type = job.type || 'image/png';
  const quality = job.quality == null ? .92 : job.quality;
  const scale = job.scale || 1;
  const isJpg = type === 'image/jpeg';
  let cv = compositeCanvas(isJpg, isJpg ? (App.doc.bg !== 'transparent' ? App.doc.bg : '#ffffff') : null);
  if (job.box && job.box.w && job.box.h) {
    const out = makeCanvas(job.box.w, job.box.h);
    const x = ctx2d(out);
    if (isJpg) { x.fillStyle = (App.doc.bg !== 'transparent' ? App.doc.bg : '#ffffff'); x.fillRect(0, 0, job.box.w, job.box.h); }
    const s2 = Math.max(job.box.w / cv.width, job.box.h / cv.height);
    const dw = cv.width * s2, dh = cv.height * s2;
    x.imageSmoothingQuality = 'high';
    x.drawImage(cv, (job.box.w - dw) / 2, (job.box.h - dh) / 2, dw, dh);
    cv = out;
  } else if (scale && scale !== 1) {
    const out = makeCanvas(Math.max(1, Math.round(cv.width * scale)), Math.max(1, Math.round(cv.height * scale)));
    const x = ctx2d(out);
    x.imageSmoothingQuality = 'high';
    x.drawImage(cv, 0, 0, out.width, out.height);
    cv = out;
  }
  const blob = await canvasToBlob(cv, type, quality);
  if (!blob) throw new Error('编码失败');
  const ext = type === 'image/jpeg' ? '.jpg' : type === 'image/webp' ? '.webp' : '.png';
  const name = job.name || (exportName(baseName(App.doc.name), job.box, scale) + ext);
  downloadBlob(blob, name);
  return { blob, name };
}

/* 导出前检查：画布过大 / 空图层 / 超出上限 */
function exportPreflight() {
  const issues = [];
  if (!App.doc.w) return ['没有文档'];
  const maxDim = Math.max(App.doc.w, App.doc.h);
  if (maxDim > 8000) issues.push('画布 ' + App.doc.w + '×' + App.doc.h + ' 过大，导出可能较慢');
  if (App.doc.w * App.doc.h > 80e6) issues.push('总像素超过 8000 万，部分浏览器会失败');
  if (!App.layers.length) issues.push('没有图层');
  else {
    /* 用 64×64 缩略采样判断是否全透明，避免逐像素扫描 */
    try {
      const small = makeCanvas(64, 64);
      const sc = ctx2d(small);
      sc.drawImage(compositeCanvas(false), 0, 0, 64, 64);
      const d = sc.getImageData(0, 0, 64, 64).data;
      let any = false;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { any = true; break; }
      if (!any) issues.push('画布内容为空（全透明）');
    } catch (e) { }
  }
  return issues;
}

function exportImage(type = 'image/png', quality = .92, filename, scale = 1, box = null) {
  if (typeof Progress !== 'undefined') Progress.start('正在导出');
  exportImageAsync({ type, quality, name: filename, scale, box }).then(res => {
    if (typeof Progress !== 'undefined') Progress.done();
    App.dirty = false;
    if (typeof Docs !== 'undefined') Docs.markSaved();
    toast(`已导出 ${res.name} · ${fmtBytes(res.blob.size)}`, 'ok');
  }).catch(err => {
    if (typeof Progress !== 'undefined') Progress.done();
    toast('导出失败：' + err.message, 'err');
  });
}

/* ---------------- 图像导入 ---------------- */
const ACCEPT_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg', 'tif', 'tiff', 'heic', 'heif', 'jfif', 'ico'];

async function decodeImageFile(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file); } catch (e) { /* fallback */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('无法解码该图像格式')); };
    img.src = url;
  });
}

let _openSeq = 0;
async function openImageFile(file, { asLayer = false } = {}) {
  const seq = ++_openSeq;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ACCEPT_EXT.includes(ext) && !/^image\//.test(file.type)) {
    toast('不支持的格式：' + ext, 'err');
    return;
  }
  try {
    const img = await decodeImageFile(file);
    if (seq !== _openSeq) return; /* 已有更新的打开请求，丢弃这次结果 */
    let w = img.width || img.naturalWidth, hh = img.height || img.naturalHeight;
    if (!w || !hh) throw new Error('图像为空');
    if (Math.max(w, hh) > 8000) {
      const down = await new Promise(resolve => {
        const m = modal({
          title: '图片尺寸较大', sub: Math.round(w) + ' × ' + Math.round(hh), width: 380,
          body: [h('div', { class: 'hint' }, '超过 8000px 会显著增加内存与运算时间。建议缩小后再编辑，原始文件不受影响。')],
          actions: [
            { label: '保持原尺寸', ghost: true, onClick: () => resolve(false) },
            { label: '缩小到 4000px', primary: true, onClick: () => resolve(true) }
          ],
          onClose: () => resolve(false)
        });
      });
      if (down) {
        const k = 4000 / Math.max(w, hh);
        w = Math.round(w * k);
        hh = Math.round(hh * k);
      }
    }

    if (asLayer && App.doc.w) {
      History.begin('置入图像', []);
      const l = addLayerRaw('置入 · ' + baseName(file.name));
      const c = ctx2d(l.canvas);
      const s = Math.min(App.doc.w / w, App.doc.h / hh, 1);
      l.x = Math.round((App.doc.w - w * s) / 2);
      l.y = Math.round((App.doc.h - hh * s) / 2);
      c.imageSmoothingQuality = 'high';
      c.drawImage(img, l.x, l.y, w * s, hh * s);
      l.x = 0; l.y = 0;
      History.end();
      sync(); invalidate();
      toast(`已置入 ${file.name}`);
      return;
    }

    App.doc = { w, h: hh, name: file.name, bg: 'transparent' };
    App.layers = [];
    App.selection = null;
    App.docSerial++;
    const l = createLayer(baseName(file.name));
    ctx2d(l.canvas).drawImage(img, 0, 0);
    App.layers.push(l);
    App.activeId = l.id;
    History.reset();
    _lastDocSize = '';
    fitView();
    captureBaseline();
    if (typeof Docs !== 'undefined') Docs.registerCurrent();
    sync(); invalidate(true);
    hideWelcome();
    toast(`已打开 ${file.name} · ${w}×${hh}`, 'ok');
  } catch (err) {
    toast(`无法打开「${file.name}」：${err.message || '解码失败'}`, 'err');
  }
}

function addLayerRaw(name) {
  const l = createLayer(name);
  const i = App.activeId ? layerIndex(App.activeId) : App.layers.length - 1;
  App.layers.splice(i + 1, 0, l);
  App.activeId = l.id;
  App.layers.forEach(x => x.thumbDirty = true);
  return l;
}

/* ---------------- 同步 ---------------- */
function sync() {
  if (typeof App.onChange === 'function') App.onChange();
  if (typeof UI !== 'undefined' && UI.afterChange) UI.afterChange();
  const dn = $('#apsisDocName');
  if (dn) dn.textContent = App.doc.name;
}

function hideWelcome() {
  const w = $('#welcome');
  if (w) w.classList.add('hide');
}

/* ---------------- 初始化空态 ---------------- */
function blankState() {
  App.doc = { w: 0, h: 0, name: '未命名', bg: 'transparent' };
  App.layers = [];
  App.activeId = null;
  App.selection = null;
}
