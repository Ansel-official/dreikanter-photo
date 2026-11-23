/* ==========================================================================
   Dreikanter photo — localadjust.js
   局部调整：线性渐变 / 径向渐变蒙版 + 配方（LUT、调整、曲线…）只作用在蒙版内
   一次性应用（一步历史），支持反相与羽化
   ========================================================================== */
'use strict';

const LocalAdj = {
  active: false,
  mode: 'linear',
  drag: null,
  region: null,
  invert: false,
  feather: 0.35,

  begin(mode) {
    if (!App.doc.w) { toast('请先打开图像', 'err'); return false; }
    if (!activeLayer()) { toast('请选择一个图层', 'err'); return false; }
    this.mode = mode === 'radial' ? 'radial' : 'linear';
    this.active = true;
    this.drag = null;
    this.region = null;
    this.invert = false;
    App.previewId = null;
    App.previewCanvas = null;
    toast(this.mode === 'radial' ? '拖拽定出径向范围（从中心向外）' : '拖拽画一条渐变方向线');
    invalidateOverlay();
    if (typeof UI !== 'undefined' && UI.renderOptions) UI.renderOptions();
    return true;
  },

  cancel() {
    this.active = false;
    this.drag = null;
    this.region = null;
    App.previewId = null;
    App.previewCanvas = null;
    invalidateOverlay();
    if (typeof UI !== 'undefined' && UI.renderOptions) UI.renderOptions();
  },

  down(pt) {
    this.drag = { a: pt, b: pt };
    this.region = this.build(this.drag);
    invalidateOverlay();
    return true;
  },

  move(pt) {
    if (!this.drag) return false;
    this.drag.b = pt;
    this.region = this.build(this.drag);
    invalidateOverlay();
    return true;
  },

  up() {
    if (!this.drag) return false;
    this.drag = null;
    if (!this.region) { this.cancel(); return false; }
    this.open();
    return true;
  },

  build(d) {
    if (this.mode === 'radial') {
      const r = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
      return { type: 'radial', cx: d.a.x, cy: d.a.y, r: Math.max(4, r) };
    }
    const len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
    if (len < 2) return null;
    return { type: 'linear', x1: d.a.x, y1: d.a.y, x2: d.b.x, y2: d.b.y };
  },

  /** 生成图层的蒙版画布（layer 坐标系） */
  maskFor(layer) {
    const w = layer.canvas.width, h = layer.canvas.height;
    const m = makeCanvas(w, h);
    const c = ctx2d(m);
    const reg = this.region;
    if (!reg) return m;
    const ox = layer.x || 0, oy = layer.y || 0;
    const lo = this.invert ? 0 : 1, hi = this.invert ? 1 : 0;
    let g;
    if (reg.type === 'linear') {
      g = c.createLinearGradient(reg.x1 - ox, reg.y1 - oy, reg.x2 - ox, reg.y2 - oy);
      g.addColorStop(0, 'rgba(255,255,255,' + lo + ')');
      g.addColorStop(1, 'rgba(255,255,255,' + hi + ')');
    } else {
      const f = clamp(this.feather, 0.05, 0.95);
      g = c.createRadialGradient(reg.cx - ox, reg.cy - oy, 0, reg.cx - ox, reg.cy - oy, reg.r);
      g.addColorStop(0, 'rgba(255,255,255,' + lo + ')');
      g.addColorStop(f, 'rgba(255,255,255,' + lo + ')');
      g.addColorStop(1, 'rgba(255,255,255,' + hi + ')');
    }
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    return m;
  },

  /** 参数对话框：实时预览 + 应用 */
  open() {
    const l = activeLayer();
    if (!l || l.locked) { toast('请选择一个可编辑图层', 'err'); this.cancel(); return; }
    const w = l.canvas.width, h = l.canvas.height;
    const base = ctx2d(l.canvas).getImageData(0, 0, w, h);
    const mask = this.maskFor(l);
    const preview = makeCanvas(w, h);
    const vals = { brightness: 0, contrast: 0, saturation: 0, temp: 0, exposure: 0, sharpen: 0, lut: '', intensity: 100 };

    const render = () => {
      const img = FX.cloneData(base);
      try { applyRecipe(img, vals); } catch (e) { }
      if (mask) blendMasked(img, base, mask, 0, 0);
      const c = ctx2d(preview);
      c.clearRect(0, 0, w, h);
      c.putImageData(img, 0, 0);
      App.previewId = l.id;
      App.previewCanvas = preview;
      invalidate();
    };

    let raf = 0;
    const req = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; render(); });
    };

    const slider = (key, label, min, max) => {
      const val = h('span', { class: 'val' }, '0');
      const inp = h('input', {
        type: 'range', min, max, step: 1, value: 0,
        oninput: () => {
          vals[key] = parseFloat(inp.value);
          val.textContent = inp.value;
          inp.style.setProperty('--p', ((inp.value - min) / (max - min) * 100) + '%');
          req();
        }
      });
      inp.style.setProperty('--p', '50%');
      return h('div', { class: 'slider-row' }, h('div', { class: 'slider-top' }, h('label', {}, label), val), inp);
    };

    const lutOpts = [['', '不套 LUT']]
      .concat((typeof LOOK_IDS !== 'undefined' ? LOOK_IDS : []).map(id => [id, CAMERA_LOOKS[id].name]))
      .concat((typeof CVL !== 'undefined' ? CVL.list() : []).map(c => [c.id, '⌁ ' + c.name]));
    const lutSel = h('select', { onchange: e => { vals.lut = e.target.value; req(); } },
      ...lutOpts.map(([v, l2]) => h('option', { value: v }, l2)));

    const inv = h('input', { type: 'checkbox', onchange: e => { this.invert = e.target.checked; remask(); } });
    const feather = h('input', {
      type: 'range', min: 5, max: 95, value: Math.round(this.feather * 100), class: 'opt-range',
      oninput: e => { this.feather = parseInt(e.target.value) / 100; remask(); }
    });
    let maskRef = mask;
    const remask = () => {
      maskRef = this.maskFor(l);
      render();
    };

    render();
    const m = modal({
      title: this.mode === 'radial' ? '局部调整 · 径向' : '局部调整 · 线性',
      sub: recipeSummary(vals), width: 420,
      body: [
        h('div', { class: 'hint' }, '只在拖出的区域里生效：白 = 完全应用，黑 = 完全不动。'),
        slider('brightness', '亮度', -100, 100),
        slider('contrast', '对比度', -100, 100),
        slider('saturation', '饱和度', -100, 100),
        slider('temp', '色温', -100, 100),
        slider('exposure', '曝光', -100, 100),
        slider('sharpen', '锐化', 0, 200),
        h('div', { class: 'field-row' }, fieldEl('相机 LUT / .cube', lutSel), fieldEl('强度', numInput(100, { min: 0, max: 100, onChange: v => { vals.intensity = v; req(); } }))),
        h('div', { class: 'field-row' }, h('label', { class: 'opt-check' }, inv, '反相蒙版'), fieldEl('羽化', feather))
      ],
      actions: [
        { label: '取消', ghost: true, onClick: () => { this.cancel(); } },
        {
          label: '应用', primary: true, onClick: () => {
            this.applyTo(l, base, maskRef, vals);
            toast('局部调整已应用', 'ok');
          }
        }
      ],
      onClose: () => {
        if (this.active) { this.active = false; this.region = null; App.previewId = null; App.previewCanvas = null; invalidate(); }
      }
    });
    return m;
  },

  /** 把配方按蒙版合进图层（一步历史） */
  applyTo(layer, base, mask, vals) {
    const img = FX.cloneData(base);
    applyRecipe(img, vals || {});
    if (mask) blendMasked(img, base, mask, 0, 0);
    History.begin('局部调整', [layer.id]);
    ctx2d(layer.canvas).putImageData(img, 0, 0);
    History.end();
    layer.thumbDirty = true;
    this.active = false;
    this.region = null;
    App.previewId = null;
    App.previewCanvas = null;
    invalidate(); sync();
    return true;
  },

  /** 画布上的范围指示 */
  drawOverlay(ctx, z) {
    const reg = this.region;
    if (!reg) return;
    ctx.save();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    if (reg.type === 'linear') {
      ctx.moveTo(reg.x1 * z, reg.y1 * z);
      ctx.lineTo(reg.x2 * z, reg.y2 * z);
    } else {
      ctx.arc(reg.cx * z, reg.cy * z, reg.r * z, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    if (reg.type === 'linear') {
      [[reg.x1, reg.y1], [reg.x2, reg.y2]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x * z, y * z, 3.5, 0, Math.PI * 2); ctx.fill();
      });
    } else {
      ctx.beginPath(); ctx.arc(reg.cx * z, reg.cy * z, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.beginPath();
      ctx.moveTo((reg.cx - reg.r) * z, reg.cy * z);
      ctx.lineTo((reg.cx + reg.r) * z, reg.cy * z);
      ctx.stroke();
    }
    ctx.restore();
  }
};
