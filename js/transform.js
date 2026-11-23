/* ==========================================================================
   Dreikanter photo — transform.js
   自由变换：缩放 / 旋转 / 斜切，数值输入，一次操作一步历史
   ========================================================================== */
'use strict';

const Transform = {
  active: false,
  layer: null,
  target: 'layer',        // layer | selection
  src: null,              // 被变换的像素（选中区域或整层）
  base: null,             // 变换后仍保留的底图（选区外 / 空）
  live: null,             // 实时合成结果（doc 尺寸）
  snapshot: null,         // 取消用快照
  box: null,              // {x,y,w,h} doc 坐标
  orig: null,             // 起始 box
  angle: 0,
  skewX: 0,
  skewY: 0,
  ratio: true,
  _drag: null,
  _hover: null,

  /* ---------------- 开始 / 结束 ---------------- */
  begin() {
    if (this.active) return false;
    if (!App.doc.w) return false;
    const l = activeLayer();
    if (!l) { toast('没有可变换的图层', 'err'); return false; }
    if (l.locked) { toast('图层已锁定', 'err'); return false; }

    this.layer = l;
    this.snapshot = cloneCanvas(l.canvas);
    const sel = App.selection;

    if (sel) {
      this.target = 'selection';
      const b = sel.bounds;
      const w = Math.max(1, Math.round(b.w)), h = Math.max(1, Math.round(b.h));
      this.box = { x: b.x, y: b.y, w, h };
      /* 取出选区内的像素 */
      const cut = makeCanvas(w, h);
      const cc = ctx2d(cut);
      cc.drawImage(l.canvas, -b.x, -b.y);
      cc.globalCompositeOperation = 'destination-in';
      cc.drawImage(sel.mask, -b.x, -b.y);
      this.src = cut;
      /* 底图：挖掉选区 */
      this.base = cloneCanvas(l.canvas);
      const bc = ctx2d(this.base);
      bc.save();
      bc.globalCompositeOperation = 'destination-out';
      bc.drawImage(sel.mask, 0, 0);
      bc.restore();
    } else {
      this.target = 'layer';
      this.box = { x: l.x, y: l.y, w: l.canvas.width, h: l.canvas.height };
      this.src = cloneCanvas(l.canvas);
      this.base = makeCanvas(App.doc.w, App.doc.h);
    }

    this.orig = { ...this.box };
    this.live = makeCanvas(App.doc.w, App.doc.h);
    this.angle = 0; this.skewX = 0; this.skewY = 0;
    this.active = true;
    this.render();
    App.previewId = l.id;
    App.previewCanvas = this.live;
    invalidate();
    if (typeof UI !== 'undefined') { UI.renderOptions(); UI.updateStatus(); }
    toast('自由变换：拖角缩放 · 角外旋转 · Ctrl 拖边斜切 · Enter 提交 / Esc 取消');
    return true;
  },

  commit() {
    if (!this.active) return;
    const l = this.layer;
    History.begin('自由变换', [l.id]);
    const c = makeCanvas(App.doc.w, App.doc.h);
    ctx2d(c).drawImage(this.live, 0, 0);
    l.canvas = c;
    l.x = 0; l.y = 0;
    l.thumbDirty = true;
    History.end();
    this._end();
    sync(); invalidate();
    toast('已应用变换', 'ok');
  },

  cancel() {
    if (!this.active) return;
    const l = this.layer;
    l.canvas = this.snapshot;
    l.thumbDirty = true;
    this._end();
    sync(); invalidate();
    toast('已取消变换');
  },

  _end() {
    this.active = false;
    this._drag = null;
    this._hover = null;
    App.previewId = null;
    App.previewCanvas = null;
    document.getElementById('overlay').style.cursor = '';
    if (typeof UI !== 'undefined') { UI.renderOptions(); UI.updateStatus(); }
  },

  /* ---------------- 渲染 ---------------- */
  render() {
    const c = ctx2d(this.live);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.live.width, this.live.height);
    if (this.base) c.drawImage(this.base, 0, 0);
    const b = this.box;
    const sx = b.w / Math.max(1, this.orig.w);
    const sy = b.h / Math.max(1, this.orig.h);
    c.save();
    c.translate(b.x + b.w / 2, b.y + b.h / 2);
    c.rotate(this.angle * Math.PI / 180);
    if (this.skewX) c.transform(1, Math.tan(this.skewX * Math.PI / 180), 0, 1, 0, 0);
    if (this.skewY) c.transform(1, 0, Math.tan(this.skewY * Math.PI / 180), 1, 0, 0);
    c.scale(sx, sy);
    c.translate(-this.orig.w / 2, -this.orig.h / 2);
    if (this.target === 'layer') c.drawImage(this.src, 0, 0, this.orig.w, this.orig.h, 0, 0, this.orig.w, this.orig.h);
    else c.drawImage(this.src, 0, 0);
    c.restore();
    /* 边界外拉伸补边（旋转后四角） */
    invalidate();
  },

  /* ---------------- 几何 ---------------- */
  center() { return { x: this.box.x + this.box.w / 2, y: this.box.y + this.box.h / 2 }; },

  corners() {
    const b = this.box, c = this.center();
    const a = this.angle * Math.PI / 180;
    const pts = [
      { x: b.x, y: b.y }, { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }
    ];
    return pts.map(p => {
      const dx = p.x - c.x, dy = p.y - c.y;
      return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
    });
  },

  handles() {
    const b = this.box, c = this.center();
    const a = this.angle * Math.PI / 180;
    const raw = [
      ['nw', b.x, b.y], ['n', b.x + b.w / 2, b.y], ['ne', b.x + b.w, b.y],
      ['e', b.x + b.w, b.y + b.h / 2], ['se', b.x + b.w, b.y + b.h],
      ['s', b.x + b.w / 2, b.y + b.h], ['sw', b.x, b.y + b.h], ['w', b.x, b.y + b.h / 2]
    ];
    return raw.map(([id, x, y]) => {
      const dx = x - c.x, dy = y - c.y;
      return { id, x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
    });
  },

  rotHandle() {
    const b = this.box, c = this.center();
    const a = this.angle * Math.PI / 180;
    const dx = 0, dy = -b.h / 2 - 26 / App.view.zoom;
    return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
  },

  hit(pt) {
    const tol = 9 / App.view.zoom;
    const rh = this.rotHandle();
    if (Math.hypot(pt.x - rh.x, pt.y - rh.y) <= tol * 1.4) return { type: 'rotate' };
    for (const hd of this.handles()) {
      if (Math.hypot(pt.x - hd.x, pt.y - hd.y) <= tol) return { type: 'scale', handle: hd.id };
    }
    const c = this.center();
    const inside = this.pointInQuad(pt);
    if (inside) return { type: 'move' };
    /* 角外一圈 = 旋转 */
    const rh2 = 34 / App.view.zoom;
    for (const hd of this.handles()) {
      if (hd.id.length === 2 && Math.hypot(pt.x - hd.x, pt.y - hd.y) <= rh2) return { type: 'rotate' };
    }
    return null;
  },

  pointInQuad(pt) {
    const q = this.corners();
    let inside = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const xi = q[i].x, yi = q[i].y, xj = q[j].x, yj = q[j].y;
      if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  },

  setSize(w, h, keepRatio) {
    const b = this.box;
    w = Math.max(1, w); h = Math.max(1, h);
    if (keepRatio) {
      const r = this.orig.w / this.orig.h;
      if (Math.abs(w / h - r) > 1e-6) h = w / r;
    }
    const c = this.center();
    b.w = w; b.h = h;
    b.x = c.x - w / 2; b.y = c.y - h / 2;
    this.render();
  },

  /* ---------------- 拖拽 ---------------- */
  down(pt, e) {
    const h = this.hit(pt);
    if (!h) return false;
    this._drag = {
      kind: h.type, handle: h.handle,
      start: pt, box: { ...this.box }, angle: this.angle,
      center: this.center(), skewX: this.skewX, skewY: this.skewY
    };
    return true;
  },

  move(pt, e) {
    const d = this._drag;
    if (!d) return false;
    const cx = d.center.x, cy = d.center.y;
    if (d.kind === 'move') {
      this.box.x = d.box.x + (pt.x - d.start.x);
      this.box.y = d.box.y + (pt.y - d.start.y);
    } else if (d.kind === 'rotate') {
      let a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      this.angle = a;
    } else if (d.kind === 'scale') {
      if (e.ctrlKey || e.metaKey) {
        /* 斜切：拖边 = 沿该方向斜切 */
        const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
        if (d.handle === 'n' || d.handle === 's') this.skewX = clamp(d.skewX + dx * 0.25, -60, 60);
        else this.skewY = clamp(d.skewY + dy * 0.25, -60, 60);
      } else {
        this._scaleByHandle(d, pt, e.shiftKey || this.ratio);
      }
    }
    this.render();
    this.syncBar();
    return true;
  },

  up() {
    this._drag = null;
  },

  _scaleByHandle(d, pt, keepRatio) {
    const a = -d.angle * Math.PI / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    /* 把指针转到未旋转坐标系 */
    const rx = (pt.x - d.center.x) * cos - (pt.y - d.center.y) * sin;
    const ry = (pt.x - d.center.x) * sin + (pt.y - d.center.y) * cos;
    const ox = d.box.w / 2, oy = d.box.h / 2;
    let w = d.box.w, h = d.box.h;
    const id = d.handle;
    if (id.includes('e')) w = Math.max(4, (rx + ox) * 2);
    if (id.includes('w')) w = Math.max(4, (ox - rx) * 2);
    if (id.includes('s')) h = Math.max(4, (ry + oy) * 2);
    if (id.includes('n')) h = Math.max(4, (oy - ry) * 2);
    if (keepRatio && id.length === 2) {
      const r = d.box.w / d.box.h;
      if (w / h > r) h = w / r; else w = h * r;
    }
    this.box.w = w; this.box.h = h;
    this.box.x = d.center.x - w / 2;
    this.box.y = d.center.y - h / 2;
  },

  /* ---------------- 覆盖层 ---------------- */
  drawOverlay(ctx, z) {
    if (!this.active) return;
    const q = this.corners();
    ctx.save();
    ctx.strokeStyle = 'rgba(120,170,255,.95)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(q[0].x * z, q[0].y * z);
    for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x * z, q[i].y * z);
    ctx.closePath();
    ctx.stroke();
    /* 三分参考 */
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    for (let i = 1; i < 3; i++) {
      const a = this._lerpQ(q, i / 3, 0), b = this._lerpQ(q, i / 3, 1);
      ctx.beginPath(); ctx.moveTo(a.x * z, a.y * z); ctx.lineTo(b.x * z, b.y * z); ctx.stroke();
      const c = this._lerpQ(q, 0, i / 3), d2 = this._lerpQ(q, 1, i / 3);
      ctx.beginPath(); ctx.moveTo(c.x * z, c.y * z); ctx.lineTo(d2.x * z, d2.y * z); ctx.stroke();
    }
    /* 手柄 */
    const hs = this.handles();
    ctx.fillStyle = '#0d1016';
    ctx.strokeStyle = 'rgba(150,190,255,.95)';
    hs.forEach(hd => {
      const s = 4;
      ctx.beginPath();
      ctx.rect(hd.x * z - s, hd.y * z - s, s * 2, s * 2);
      ctx.fill(); ctx.stroke();
    });
    /* 旋转手柄 */
    const rh = this.rotHandle();
    const top = this._lerpQ(q, .5, 0);
    ctx.beginPath(); ctx.moveTo(top.x * z, top.y * z); ctx.lineTo(rh.x * z, rh.y * z); ctx.stroke();
    ctx.beginPath(); ctx.arc(rh.x * z, rh.y * z, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    /* 数值标签 */
    const txt = `${Math.round(this.box.w)} × ${Math.round(this.box.h)}` + (this.angle ? ` · ${Math.round(this.angle)}°` : '');
    ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
    const tw = ctx.measureText(txt).width + 10;
    const bx = q[0].x * z, by = q[0].y * z - 20;
    ctx.fillStyle = 'rgba(10,12,16,.82)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, tw, 15, 3); else ctx.rect(bx, by, tw, 15);
    ctx.fill();
    ctx.fillStyle = '#cfe0ff';
    ctx.fillText(txt, bx + 5, by + 11);
    ctx.restore();
  },

  _lerpQ(q, tx, ty) {
    const top = { x: q[0].x + (q[1].x - q[0].x) * tx, y: q[0].y + (q[1].y - q[0].y) * tx };
    const bot = { x: q[3].x + (q[2].x - q[3].x) * tx, y: q[3].y + (q[2].y - q[3].y) * tx };
    return { x: top.x + (bot.x - top.x) * ty, y: top.y + (bot.y - top.y) * ty };
  },

  /* ---------------- 数值栏 ---------------- */
  syncBar() {
    if (!this.active) return;
    const w = document.getElementById('tfW'), hh = document.getElementById('tfH'), a = document.getElementById('tfA');
    if (w) w.value = Math.round(this.box.w);
    if (hh) hh.value = Math.round(this.box.h);
    if (a) a.value = Math.round(this.angle);
  }
};
