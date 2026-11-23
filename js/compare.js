/* ==========================================================================
   Dreikanter photo — compare.js
   分屏对比（左原图 / 右当前）+ 参考图叠加（临摹/修图对照）
   ========================================================================== */
'use strict';

const Compare = {
  split: false,
  x: 0.5,              /* 分隔线在视图中的比例 0..1 */
  dragging: false,
  ref: null,           /* 参考图 canvas */
  refName: '',
  refOpacity: 0.5,
  refVisible: false,

  /** 当前分隔线对应的文档 x（用于合成裁剪） */
  splitDocX() {
    const stage = document.getElementById('stage');
    if (!stage || !App.doc.w) return App.doc.w / 2;
    const r = stage.getBoundingClientRect();
    const z = App.view.zoom || 1;
    const docLeft = App.view.cx - r.width / (2 * z);
    return clamp(docLeft + (r.width * this.x) / z, 0, App.doc.w);
  },

  toggleSplit() {
    this.split = !this.split;
    if (typeof UI !== 'undefined' && UI.updateStatus) UI.updateStatus();
    invalidateOverlay();
    invalidate();
    toast(this.split ? '分屏对比：左侧原图 / 右侧当前' : '已关闭分屏对比');
    return this.split;
  },

  setSplitX(v) {
    this.x = clamp(v, 0.05, 0.95);
    invalidateOverlay();
    invalidate();
    return this.x;
  },

  /** 参考图：从 File 载入（等比放进画布） */
  async loadReference(file) {
    if (!file) return false;
    const bmp = await decodeImageFile(file);
    const w = bmp.width || bmp.naturalWidth;
    const h = bmp.height || bmp.naturalHeight;
    if (!w || !h) throw new Error('参考图尺寸无效');
    const cv = makeCanvas(w, h);
    ctx2d(cv).drawImage(bmp, 0, 0);
    if (bmp.close) bmp.close();
    this.ref = cv;
    this.refName = file.name || '参考图';
    this.refVisible = true;
    invalidate();
    toast('已载入参考图：' + this.refName, 'ok');
    return true;
  },

  setRefOpacity(v) {
    this.refOpacity = clamp(v, 0, 1);
    invalidate();
    return this.refOpacity;
  },

  clearReference() {
    this.ref = null;
    this.refName = '';
    this.refVisible = false;
    invalidate();
    toast('已清除参考图');
  },

  /** 参考图画进合成（fit 居中） */
  drawRef(ctx) {
    if (!this.refVisible || !this.ref) return;
    const dw = App.doc.w, dh = App.doc.h;
    const s = Math.min(dw / this.ref.width, dh / this.ref.height);
    const w = this.ref.width * s, h = this.ref.height * s;
    ctx.save();
    ctx.globalAlpha = this.refOpacity;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.ref, (dw - w) / 2, (dh - h) / 2, w, h);
    ctx.restore();
  },

  /** 分屏：把基线裁到分隔线左侧 */
  drawSplit(ctx) {
    if (!this.split || !App.baseline) return;
    const cut = this.splitDocX();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cut, App.doc.h);
    ctx.clip();
    ctx.drawImage(App.baseline, 0, 0, App.doc.w, App.doc.h);
    ctx.restore();
  },

  /** 覆盖层：分隔线 + 标签 */
  drawOverlay(ctx, z) {
    if (!this.split) return;
    const stage = document.getElementById('stage');
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const xp = r.width * this.x;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xp + .5, 0);
    ctx.lineTo(xp + .5, r.height);
    ctx.stroke();
    /* 手柄 */
    ctx.fillStyle = '#0d1016';
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(xp, r.height / 2, 7, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#cfd8ff';
    ctx.font = '9px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('◀', xp - 12, r.height / 2 + 3);
    ctx.fillText('▶', xp + 5, r.height / 2 + 3);
    /* 标签 */
    ctx.fillStyle = 'rgba(10,12,16,.72)';
    ctx.fillRect(8, 26, 62, 16);
    ctx.fillStyle = '#cfd8ff';
    ctx.fillText('原图', 16, 38);
    const w2 = 62;
    ctx.fillStyle = 'rgba(10,12,16,.72)';
    ctx.fillRect(r.width - w2 - 8, 26, w2, 16);
    ctx.fillStyle = '#cfd8ff';
    ctx.fillText('当前', r.width - w2 + 8, 38);
    ctx.restore();
  }
};

/* ---------------- 参考图对话框 ---------------- */
Dialogs.reference = function referenceDialog() {
  const fileIn = h('input', {
    type: 'file', accept: 'image/*', style: { display: 'none' },
    onchange: async e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try { await Compare.loadReference(f); render(); } catch (err) { toast('载入失败：' + err.message, 'err'); }
    }
  });
  const status = h('div', { class: 'hint' }, '');
  const opVal = h('span', { class: 'val' }, String(Math.round(Compare.refOpacity * 100)));
  const opIn = h('input', {
    type: 'range', min: 0, max: 100, value: Math.round(Compare.refOpacity * 100), class: 'opt-range',
    oninput: () => {
      opVal.textContent = opIn.value;
      Compare.setRefOpacity(parseInt(opIn.value) / 100);
    }
  });
  const render = () => {
    status.textContent = Compare.refVisible && Compare.ref
      ? ('当前参考图：' + Compare.refName + '（' + Compare.ref.width + '×' + Compare.ref.height + '）')
      : '还没有参考图';
  };
  const m = modal({
    title: '参考图', sub: '叠加对照', width: 460,
    body: [
      h('div', { class: 'hint' }, '参考图会等比放进画布中央、按透明度叠在最上层，不参与导出，也不进历史。'),
      status,
      h('div', { class: 'exp-bar', style: { margin: '6px 0' } },
        h('button', { class: 'btn', style: { flex: '1' }, onclick: () => fileIn.click() }, '载入参考图…'),
        h('button', {
          class: 'btn ghost', style: { flex: '0 0 auto' },
          onclick: () => { Compare.clearReference(); render(); }
        }, '清除')
      ),
      h('div', { class: 'slider-row' },
        h('div', { class: 'slider-top' }, h('label', {}, '透明度'), opVal), opIn),
      fileIn
    ],
    actions: [{ label: '关闭', ghost: true }]
  });
  render();
  return m;
};


/* ---------------- 分隔线拖拽 ---------------- */
(function bindCompareDrag() {
  const ov = document.getElementById('overlay');
  if (!ov) return;
  let dragging = false;
  ov.addEventListener('pointerdown', e => {
    if (!Compare.split) return;
    const stage = document.getElementById('stage');
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const xp = r.left + r.width * Compare.x;
    if (Math.abs(e.clientX - xp) > 14) return;
    dragging = true;
    Compare.dragging = true;
    try { ov.setPointerCapture(e.pointerId); } catch (err) { }
    e.stopPropagation(); e.preventDefault();
  }, true);
  ov.addEventListener('pointermove', e => {
    if (!dragging) return;
    const stage = document.getElementById('stage');
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    Compare.setSplitX((e.clientX - r.left) / Math.max(1, r.width));
    e.stopPropagation();
  }, true);
  const end = () => { dragging = false; Compare.dragging = false; };
  ov.addEventListener('pointerup', end, true);
  ov.addEventListener('pointercancel', end, true);
})();
