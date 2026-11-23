/* ==========================================================================
   Dreikanter photo — guides.js
   标尺（多单位）/ 参考线（含任意角度）/ 网格 / 吸附
   ========================================================================== */
'use strict';

const Guides = {
  data: { x: [], y: [], angled: [] },
  show: true,
  showRulers: true,
  lock: false,
  snap: true,
  snapGrid: false,
  unit: 'px',
  color: '#4fd1ff',
  style: 'dashed',
  grid: { size: 100, sub: 2, color: '#78aaff', opacity: .45 },
  angleDraft: null,
  _bound: false,
  _hover: null,

  /* ---------------- 持久化 ---------------- */
  load() {
    const d = Store.get('guides', null);
    this.data = (d && typeof d === 'object') ? d : { x: [], y: [], angled: [] };
    if (!Array.isArray(this.data.x)) this.data.x = [];
    if (!Array.isArray(this.data.y)) this.data.y = [];
    if (!Array.isArray(this.data.angled)) this.data.angled = [];
    this.show = Store.get('guides.show', true);
    this.showRulers = Store.get('guides.rulers', true);
    this.snap = Store.get('guides.snap', true);
    this.snapGrid = Store.get('guides.snapGrid', false);
    this.lock = Store.get('guides.lock', false);
    this.unit = Store.get('guides.unit', 'px');
    this.color = Store.get('guides.color', '#4fd1ff');
    this.style = Store.get('guides.style', 'dashed');
    const g = Store.get('grid', null);
    if (g && typeof g === 'object') this.grid = Object.assign(this.grid, g);
    this.bind();
    this.applyVisibility();
  },

  save() {
    Store.set('guides', this.data);
    Store.set('guides.show', this.show);
    Store.set('guides.rulers', this.showRulers);
    Store.set('guides.snap', this.snap);
    Store.set('guides.snapGrid', this.snapGrid);
    Store.set('guides.lock', this.lock);
    Store.set('guides.unit', this.unit);
    Store.set('guides.color', this.color);
    Store.set('guides.style', this.style);
    Store.set('grid', this.grid);
  },

  /* 标尺只在宽屏 + Photoshop 模式 + 用户开启时出现（窄屏让位给画布） */
  rulersOn() {
    return this.showRulers && App.mode === 'ps' && window.innerWidth > 820;
  },

  applyVisibility() {
    const rx = $('#rulerX'), ry = $('#rulerY'), rc = $('#rulerCorner');
    const on = this.rulersOn();
    if (rx) rx.style.display = on ? 'block' : 'none';
    if (ry) ry.style.display = on ? 'block' : 'none';
    if (rc) rc.style.display = on ? 'block' : 'none';
    this.syncCorner();
    invalidateOverlay();
  },

  syncCorner() {
    const rc = $('#rulerCorner');
    if (!rc) return;
    rc.textContent = this.angleDraft ? Math.round(this.angleDraft.a) + '°' : this.unit;
    rc.title = this.angleDraft ? '参考线角度（Shift 吸附 45°）' : '标尺单位：点击切换（px → mm → in → % → pt）';
    rc.classList.toggle('angled', !!this.angleDraft);
  },

  cycleUnit() {
    this.unit = Units.next(this.unit);
    this.save();
    layoutFrame();
    if (typeof UI !== 'undefined' && UI.updateStatus) UI.updateStatus();
    toast('标尺单位：' + this.unit);
    return this.unit;
  },

  setUnit(u) {
    if (!Units.list.some(x => x[0] === u)) return;
    this.unit = u;
    this.save();
    layoutFrame();
    if (typeof UI !== 'undefined' && UI.updateStatus) UI.updateStatus();
  },

  /* ---------------- 增删 ---------------- */
  addX(v) { this.data.x.push(round(v, 1)); this.save(); invalidateOverlay(); },
  addY(v) { this.data.y.push(round(v, 1)); this.save(); invalidateOverlay(); },
  addAngled(g) { this.data.angled.push({ x: round(g.x, 1), y: round(g.y, 1), a: round(g.a || 0, 1) }); this.save(); invalidateOverlay(); },

  count() { return this.data.x.length + this.data.y.length + this.data.angled.length; },

  clear() {
    this.data = { x: [], y: [], angled: [] };
    this.save(); invalidateOverlay();
    toast('已清除全部参考线');
  },

  toggleShow() {
    this.show = !this.show; this.save(); invalidateOverlay();
    toast(this.show ? '已显示参考线' : '已隐藏参考线');
  },

  toggleLock() {
    this.lock = !this.lock; this.save();
    toast(this.lock ? '参考线已锁定' : '参考线已解锁');
    return this.lock;
  },

  removeNearest(pt) {
    const hit = this.hitGuide(pt);
    if (!hit) return false;
    this._remove(hit);
    return true;
  },

  _remove(hit) {
    if (hit.kind === 'angled') this.data.angled.splice(hit.index, 1);
    else this.data[hit.kind].splice(hit.index, 1);
    this.save(); invalidateOverlay();
  },

  /* ---------------- 命中 ---------------- */
  tol() { return 6 / App.view.zoom; },

  hitGuide(pt) {
    const tol = this.tol();
    for (let i = 0; i < this.data.angled.length; i++) {
      const g = this.data.angled[i];
      if (this.distToAngled(pt, g) <= tol) return { kind: 'angled', index: i, g };
    }
    for (let i = 0; i < this.data.x.length; i++) {
      if (Math.abs(pt.x - this.data.x[i]) <= tol) return { kind: 'x', index: i, v: this.data.x[i] };
    }
    for (let i = 0; i < this.data.y.length; i++) {
      if (Math.abs(pt.y - this.data.y[i]) <= tol) return { kind: 'y', index: i, v: this.data.y[i] };
    }
    return null;
  },

  /* 点到斜参考线（限制在画布内的线段）的距离 */
  segOf(g) {
    const a = g.a * Math.PI / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const w = App.doc.w, h = App.doc.h;
    const ts = [];
    if (Math.abs(dx) > 1e-6) { ts.push((0 - g.x) / dx, (w - g.x) / dx); }
    if (Math.abs(dy) > 1e-6) { ts.push((0 - g.y) / dy, (h - g.y) / dy); }
    const inside = ts.filter(t => {
      const px = g.x + dx * t, py = g.y + dy * t;
      return px >= -0.5 && px <= w + 0.5 && py >= -0.5 && py <= h + 0.5;
    });
    if (!inside.length) return null;
    const t0 = Math.min(...inside), t1 = Math.max(...inside);
    return { x0: g.x + dx * t0, y0: g.y + dy * t0, x1: g.x + dx * t1, y1: g.y + dy * t1 };
  },

  distToAngled(pt, g) {
    const s = this.segOf(g);
    if (!s) return Infinity;
    const vx = s.x1 - s.x0, vy = s.y1 - s.y0;
    const len2 = vx * vx + vy * vy;
    if (!len2) return Math.hypot(pt.x - s.x0, pt.y - s.y0);
    let t = ((pt.x - s.x0) * vx + (pt.y - s.y0) * vy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(pt.x - (s.x0 + vx * t), pt.y - (s.y0 + vy * t));
  },

  /* ---------------- 角度 ---------------- */
  snapAngle(a, force) {
    if (force) return Math.round(a / 45) * 45;
    const near = Math.round(a / 15) * 15;
    return Math.abs(a - near) <= 3 ? near : a;
  },

  angleOf(anchor, pt, force) {
    let a = Math.atan2(pt.y - anchor.y, pt.x - anchor.x) * 180 / Math.PI;
    return this.snapAngle(a, force);
  },

  /* ---------------- 标尺 ---------------- */
  layout(left, top, w, hh, dpr) {
    const rx = $('#rulerX'), ry = $('#rulerY'), rc = $('#rulerCorner');
    if (!rx || !ry) return;
    const on = this.rulersOn();
    rx.style.display = ry.style.display = on ? 'block' : 'none';
    if (rc) rc.style.display = on ? 'block' : 'none';
    if (!on) return;
    const R = 20;
    rx.style.left = '0px';
    rx.style.top = '0px';
    rx.style.width = w + 'px';
    rx.style.height = R + 'px';
    ry.style.left = '0px';
    ry.style.top = R + 'px';
    ry.style.width = R + 'px';
    ry.style.height = Math.max(1, hh - R) + 'px';
    if (rx.width !== Math.round(w * dpr) || rx.height !== Math.round(R * dpr)) {
      rx.width = Math.max(1, Math.round(w * dpr));
      rx.height = Math.round(R * dpr);
      ry.width = Math.round(R * dpr);
      ry.height = Math.max(1, Math.round((hh - R) * dpr));
    }
    this.paintRuler(rx, true, dpr);
    this.paintRuler(ry, false, dpr);
    this.syncCorner();
  },

  /* 单位空间的主刻度步长（保证屏幕间距 ≥46px） */
  stepFor(unit, axis) {
    const z = App.view.zoom;
    const cands = unit === 'in'
      ? [.01, .02, .05, .1, .25, .5, 1, 2, 5, 10, 20]
      : [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
    for (const s of cands) {
      if (Math.abs(Units.toPx(s, unit, axis)) * z >= 46) return s;
    }
    return cands[cands.length - 1];
  },

  /* 主刻度之间是否画细分（≥100% 才画） */
  minorDiv() {
    const z = App.view.zoom;
    if (z >= 4) return 10;
    if (z >= 1) return 5;
    return 0;
  },

  paintRuler(canvas, horizontal, dpr) {
    const c = ctx2d(canvas);
    const W = canvas.width, H = canvas.height;
    const light = document.body.classList.contains('theme-light');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.fillStyle = light ? 'rgba(246,246,248,.96)' : 'rgba(22,22,24,.92)';
    c.fillRect(0, 0, W, H);
    const z = App.view.zoom;
    const unit = this.unit;
    const axis = horizontal ? 'x' : 'y';
    const step = this.stepFor(unit, axis);
    const div = this.minorDiv();
    const len = horizontal ? App.doc.w : App.doc.h;
    const total = Units.fromPx(len, unit, axis);
    const frame = $('#docframe').getBoundingClientRect();
    const stage = $('#stage').getBoundingClientRect();
    const origin = horizontal ? (frame.left - stage.left) : (frame.top - stage.top - 20);
    const pxPerUnit = Math.abs(Units.toPx(1, unit, axis)) * z;
    if (!pxPerUnit || total / step > 4000) return;
    c.strokeStyle = light ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.18)';
    c.fillStyle = light ? '#5f5f69' : '#82828c';
    c.font = `${9 * dpr}px ${getComputedStyle(document.body).fontFamily}`;
    c.lineWidth = dpr;
    const tick = (u, big) => {
      const p = (origin + Units.toPx(u, unit, axis) * z) * dpr;
      if (p < -40 * dpr || p > (horizontal ? W : H) + 40 * dpr) return;
      c.beginPath();
      if (horizontal) {
        c.moveTo(p + .5, H);
        c.lineTo(p + .5, H - (big ? 9 : 4) * dpr);
      } else {
        c.moveTo(W, p + .5);
        c.lineTo(W - (big ? 9 : 4) * dpr, p + .5);
      }
      c.stroke();
      if (!big) return;
      const label = Units.label(u, unit);
      if (horizontal) c.fillText(label, p + 3 * dpr, 9 * dpr);
      else c.fillText(label, 3 * dpr, p + 9 * dpr);
    };
    for (let u = 0; u <= total + step * .001; u += step) {
      tick(u, true);
      if (div) {
        for (let k = 1; k < div; k++) {
          const uu = u + step * k / div;
          if (uu > total) break;
          tick(uu, false);
        }
      }
    }
    c.strokeStyle = light ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.08)';
    if (horizontal) { c.beginPath(); c.moveTo(0, H - .5); c.lineTo(W, H - .5); c.stroke(); }
    else { c.beginPath(); c.moveTo(W - .5, 0); c.lineTo(W - .5, H); c.stroke(); }
  },

  /* ---------------- 网格 ---------------- */
  drawGrid(ctx, z) {
    if (!App.showGrid) return;
    const g = this.grid;
    const step = Math.max(2, g.size || 100);
    const sub = clamp(g.sub || 1, 1, 10);
    const px = step * z;
    if (px < 4) return;
    ctx.save();
    ctx.globalAlpha = clamp(g.opacity == null ? .45 : g.opacity, .05, 1);
    ctx.lineWidth = 1;
    /* 细分线 */
    if (sub > 1 && px / sub >= 5) {
      ctx.strokeStyle = g.color || '#78aaff';
      ctx.globalAlpha *= .45;
      for (let x = 0; x <= App.doc.w; x += step / sub) {
        if (Math.abs(x / step - Math.round(x / step)) < 1e-6) continue;
        ctx.beginPath(); ctx.moveTo(x * z, 0); ctx.lineTo(x * z, App.doc.h * z); ctx.stroke();
      }
      for (let y = 0; y <= App.doc.h; y += step / sub) {
        if (Math.abs(y / step - Math.round(y / step)) < 1e-6) continue;
        ctx.beginPath(); ctx.moveTo(0, y * z); ctx.lineTo(App.doc.w * z, y * z); ctx.stroke();
      }
      ctx.globalAlpha = clamp(g.opacity == null ? .45 : g.opacity, .05, 1);
    }
    ctx.strokeStyle = g.color || '#78aaff';
    for (let x = step; x < App.doc.w; x += step) {
      ctx.beginPath(); ctx.moveTo(x * z, 0); ctx.lineTo(x * z, App.doc.h * z); ctx.stroke();
    }
    for (let y = step; y < App.doc.h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y * z); ctx.lineTo(App.doc.w * z, y * z); ctx.stroke();
    }
    ctx.restore();
  },

  /* ---------------- 参考线绘制 ---------------- */
  draw(ctx, z) {
    if (!this.show || !this.count()) return;
    const col = this.color || '#4fd1ff';
    ctx.save();
    ctx.strokeStyle = col;
    ctx.globalAlpha = this.lock ? .55 : .85;
    ctx.lineWidth = 1;
    if (this.style === 'dashed') ctx.setLineDash([6, 4]); else ctx.setLineDash([]);
    this.data.x.forEach(v => {
      ctx.beginPath(); ctx.moveTo(v * z, 0); ctx.lineTo(v * z, App.doc.h * z); ctx.stroke();
    });
    this.data.y.forEach(v => {
      ctx.beginPath(); ctx.moveTo(0, v * z); ctx.lineTo(App.doc.w * z, v * z); ctx.stroke();
    });
    this.data.angled.forEach(g => {
      const s = this.segOf(g);
      if (!s) return;
      ctx.beginPath();
      ctx.moveTo(s.x0 * z, s.y0 * z);
      ctx.lineTo(s.x1 * z, s.y1 * z);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    /* 角度标签 */
    ctx.font = '10px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = col;
    ctx.globalAlpha = .95;
    this.data.angled.forEach(g => {
      const s = this.segOf(g);
      if (!s) return;
      const mx = (s.x0 + s.x1) / 2 * z, my = (s.y0 + s.y1) / 2 * z;
      const txt = Math.round(g.a) + '°';
      const w = ctx.measureText(txt).width + 8;
      ctx.save();
      ctx.globalAlpha = .82;
      ctx.fillStyle = 'rgba(10,12,16,.78)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(mx - w / 2, my - 16, w, 14, 3); else ctx.rect(mx - w / 2, my - 16, w, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.fillText(txt, mx - w / 2 + 4, my - 6);
      ctx.restore();
    });
    ctx.restore();
  },

  /* ---------------- 吸附 ---------------- */
  closest(value, candidates, tol) {
    let best = null, dist = tol;
    for (const c of candidates) {
      const d = Math.abs(value - c);
      if (d < dist) { dist = d; best = c; }
    }
    return best;
  },

  snapMove(layer, nx, ny) {
    const tolPx = ((typeof Settings !== 'undefined' && Settings.data && Settings.data.snapTolerance) || 7) / App.view.zoom;
    const cx = nx + App.doc.w / 2;
    const cy = ny + App.doc.h / 2;
    let sx = null, sy = null;
    if (this.snap) {
      sx = this.closest(cx, [App.doc.w / 2, ...this.data.x], tolPx);
      sy = this.closest(cy, [App.doc.h / 2, ...this.data.y], tolPx);
    }
    if (this.snapGrid) {
      const gs = Math.max(2, this.grid.size || 100);
      if (sx == null) sx = this.closest(cx, [Math.round(cx / gs) * gs], tolPx);
      if (sy == null) sy = this.closest(cy, [Math.round(cy / gs) * gs], tolPx);
    }
    return { x: sx != null ? sx - App.doc.w / 2 : nx, y: sy != null ? sy - App.doc.h / 2 : ny };
  },

  /* 拖动时的吸附：返回吸附后的 doc 坐标 */
  snapPoint(pt) {
    if (!this.snap) return pt;
    const tol = ((typeof Settings !== 'undefined' && Settings.data && Settings.data.snapTolerance) || 7) / App.view.zoom;
    const gx = this.closest(pt.x, [...this.data.x, 0, App.doc.w / 2, App.doc.w], tol);
    const gy = this.closest(pt.y, [...this.data.y, 0, App.doc.h / 2, App.doc.h], tol);
    return { x: gx != null ? gx : pt.x, y: gy != null ? gy : pt.y };
  },

  /* ---------------- 交互 ---------------- */
  bind() {
    if (this._bound) return;
    this._bound = true;

    const corner = $('#rulerCorner');
    if (corner) corner.addEventListener('click', () => this.cycleUnit());

    const beginFromRuler = axis => e => {
      if (!this.rulersOn()) return;
      e.preventDefault();
      e.stopPropagation();
      const pt = this.snapPoint(screenToDoc(e.clientX, e.clientY));
      const cxp = App.doc.w / 2, cyp = App.doc.h / 2;
      const angled = !!e.altKey;
      let ref = null;
      if (angled) {
        ref = { x: cxp, y: cyp, a: axis === 'x' ? 90 : 0 };
        this.data.angled.push(ref);
      } else if (axis === 'x') {
        ref = { v: Math.round(pt.x) };
        this.data.x.push(ref.v);
      } else {
        ref = { v: Math.round(pt.y) };
        this.data.y.push(ref.v);
      }
      this.dragState = { mode: angled ? 'rotate' : 'move', kind: axis === 'x' ? 'x' : 'y', angled, ref, fromRuler: true };
      if (angled) { this.angleDraft = { x: ref.x, y: ref.y, a: ref.a }; this.syncCorner(); }
      const move = ev => {
        const p = this.snapPoint(screenToDoc(ev.clientX, ev.clientY));
        const d = this.dragState;
        if (!d) return;
        if (d.angled) {
          const a = this.angleOf({ x: d.ref.x, y: d.ref.y }, p, ev.shiftKey);
          d.ref.a = a;
          this.angleDraft = { x: d.ref.x, y: d.ref.y, a };
          this.syncCorner();
        } else if (d.kind === 'x') {
          d.ref.v = Math.round(clamp(p.x, -2000, App.doc.w + 2000));
          d.moved = true;
        } else {
          d.ref.v = Math.round(clamp(p.y, -2000, App.doc.h + 2000));
          d.moved = true;
        }
        invalidateOverlay();
      };
      const up = () => {
        const d = this.dragState;
        this.dragState = null;
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        if (d && !d.angled) {
          const val = d.ref.v;
          const out = d.kind === 'x' ? (val < -8 || val > App.doc.w + 8) : (val < -8 || val > App.doc.h + 8);
          if (out) {
            if (d.kind === 'x') this.data.x = this.data.x.filter(v => v !== val);
            else this.data.y = this.data.y.filter(v => v !== val);
            toast('参考线已删除');
          }
        }
        this.angleDraft = null;
        this.syncCorner();
        this.save();
        invalidateOverlay();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      move(e);
    };
    const rx = $('#rulerX'), ry = $('#rulerY');
    if (rx) rx.addEventListener('pointerdown', beginFromRuler('x'));
    if (ry) ry.addEventListener('pointerdown', beginFromRuler('y'));

    /* 画布上：拖动 / Alt 旋转 / 拖出删除 */
    const oc = $('#overlay');
    if (!oc) return;
    oc.addEventListener('pointerdown', e => {
      if (App.mode !== 'ps' || !this.show || this.lock) return;
      const pt = screenToDoc(e.clientX, e.clientY);
      const hit = this.hitGuide(pt);
      if (!hit) return;
      e.stopPropagation();
      e.preventDefault();
      if (Tools) { Tools._down = false; Tools.drag = null; }
      const startPt = pt;
      let moved = 0;
      let state;
      if (hit.kind === 'angled') {
        state = { mode: e.altKey ? 'rotate' : 'move', hit, g: this.data.angled[hit.index], ox: pt.x, oy: pt.y, ax: this.data.angled[hit.index].x, ay: this.data.angled[hit.index].y };
      } else if (e.altKey) {
        /* Alt 拖动直线参考线 -> 转成斜参考线并绕点击点旋转 */
        const arr = this.data[hit.kind];
        arr.splice(hit.index, 1);
        const g = { x: Math.round(pt.x), y: Math.round(pt.y), a: hit.kind === 'x' ? 90 : 0 };
        this.data.angled.push(g);
        state = { mode: 'rotate', hit: { kind: 'angled', index: this.data.angled.length - 1 }, g, ox: pt.x, oy: pt.y, ax: g.x, ay: g.y };
      } else {
        state = { mode: 'move', hit, ox: pt.x, oy: pt.y, ov: hit.v };
      }
      this.dragState = state;
      if (state.mode === 'rotate') { this.angleDraft = { x: state.g.x, y: state.g.y, a: state.g.a }; this.syncCorner(); }
      const move = ev => {
        const st = this.dragState;
        if (!st) return;
        const p = screenToDoc(ev.clientX, ev.clientY);
        moved = Math.max(moved, Math.hypot(p.x - startPt.x, p.y - startPt.y));
        if (st.mode === 'rotate') {
          st.g.a = this.angleOf({ x: st.ax, y: st.ay }, p, ev.shiftKey);
          this.angleDraft = { x: st.g.x, y: st.g.y, a: st.g.a };
          this.syncCorner();
        } else if (st.hit.kind === 'angled') {
          st.g.x = round(clamp(st.ax + (p.x - st.ox), -App.doc.w, App.doc.w * 2), 1);
          st.g.y = round(clamp(st.ay + (p.y - st.oy), -App.doc.h, App.doc.h * 2), 1);
        } else {
          const q = this.snapPoint(p);
          const v = Math.round(st.hit.kind === 'x' ? q.x : q.y);
          const arr = this.data[st.hit.kind];
          arr[st.hit.index] = clamp(v, -2000, (st.hit.kind === 'x' ? App.doc.w : App.doc.h) + 2000);
        }
        invalidateOverlay();
      };
      const up = () => {
        const st = this.dragState;
        this.dragState = null;
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        this.angleDraft = null;
        this.syncCorner();
        if (!st) return;
        /* 点击不拖动 = 删除 */
        if (moved < 3) {
          if (st.hit.kind === 'angled') this.data.angled.splice(st.hit.index, 1);
          else this.data[st.hit.kind].splice(st.hit.index, 1);
          toast('已删除参考线');
        } else if (st.hit.kind !== 'angled') {
          const val = this.data[st.hit.kind][st.hit.index];
          const out = st.hit.kind === 'x' ? (val < -8 || val > App.doc.w + 8) : (val < -8 || val > App.doc.h + 8);
          if (out) { this.data[st.hit.kind].splice(st.hit.index, 1); toast('参考线已删除'); }
        }
        this.save();
        invalidateOverlay();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }, true);
  },

  /* ---------------- 对话框 ---------------- */
  settings() {
    const unitSel = h('select', {}, ...Units.list.map(([v, l]) => h('option', { value: v, selected: this.unit === v }, l + '（' + v + '）')));
    const colorIn = h('input', { type: 'color', value: this.color });
    const styleSel = h('select', {}, ...[['dashed', '虚线'], ['solid', '实线']].map(([v, l]) => h('option', { value: v, selected: this.style === v }, l)));
    const lockCk = h('input', { type: 'checkbox', checked: this.lock });
    const showCk = h('input', { type: 'checkbox', checked: this.show });
    const snapCk = h('input', { type: 'checkbox', checked: this.snap });
    const snapG = h('input', { type: 'checkbox', checked: this.snapGrid });
    const gSize = numInput(this.grid.size, { min: 2, max: 2000 });
    const gSub = numInput(this.grid.sub, { min: 1, max: 10 });
    const gColor = h('input', { type: 'color', value: this.grid.color });
    const gOp = numInput(Math.round(this.grid.opacity * 100), { min: 5, max: 100, unit: '%' });
    const showGridCk = h('input', { type: 'checkbox', checked: App.showGrid });
    const dpi = numInput(App.doc.dpi || 72, { min: 1, max: 2400, unit: 'ppi' });

    modal({
      title: '参考线 / 网格 / 标尺', sub: '视图', width: 430,
      body: [
        h('div', { class: 'cap-line' }, '标尺'),
        h('div', { class: 'field-row' }, fieldEl('单位', unitSel), fieldEl('文档分辨率 DPI', dpi)),
        h('div', { class: 'field-row' }, fieldEl('显示标尺', showCk), fieldEl('锁定参考线', lockCk)),
        h('div', { class: 'cap-line' }, '参考线'),
        h('div', { class: 'field-row' }, fieldEl('颜色', colorIn), fieldEl('样式', styleSel)),
        h('div', { class: 'hint' }, 'Alt + 从标尺拖拽 = 斜参考线；拖动时按住 Shift 吸附 45°；点击参考线删除。'),
        h('div', { class: 'cap-line' }, '网格'),
        h('div', { class: 'field-row' }, fieldEl('显示网格', showGridCk), fieldEl('吸附网格', snapG)),
        h('div', { class: 'field-row' }, fieldEl('间距 px', gSize), fieldEl('细分', gSub)),
        h('div', { class: 'field-row' }, fieldEl('颜色', gColor), fieldEl('透明度', gOp)),
        h('div', { class: 'field-row' }, fieldEl('移动吸附参考线', snapCk))
      ],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '应用', primary: true, onClick: () => {
            this.unit = unitSel.value;
            this.color = colorIn.value;
            this.style = styleSel.value;
            this.lock = lockCk.checked;
            this.show = showCk.checked;
            this.snap = snapCk.checked;
            this.snapGrid = snapG.checked;
            this.grid = {
              size: clamp(parseInt(gSize.value) || 100, 2, 2000),
              sub: clamp(parseInt(gSub.value) || 1, 1, 10),
              color: gColor.value,
              opacity: clamp((parseInt(gOp.value) || 45) / 100, .05, 1)
            };
            App.showGrid = showGridCk.checked;
            const d = clamp(parseInt(dpi.value) || 72, 1, 2400);
            if (d !== App.doc.dpi) { App.doc.dpi = d; if (typeof Docs !== 'undefined') Docs.markDirty(); }
            this.save();
            this.applyVisibility();
            layoutFrame();
            invalidate(true);
            if (typeof UI !== 'undefined' && UI.updateStatus) UI.updateStatus();
            toast('视图设置已更新');
          }
        }
      ]
    });
  },

  menuNew() {
    const horiz = h('input', { type: 'number', placeholder: '留空不加' });
    const vert = h('input', { type: 'number', placeholder: '留空不加' });
    const ang = h('input', { type: 'number', value: 0, step: 1 });
    modal({
      title: '新建参考线', width: 360,
      body: [
        fieldEl('垂直参考线 X（' + this.unit + '）', horiz),
        fieldEl('水平参考线 Y（' + this.unit + '）', vert),
        fieldEl('斜参考线角度（°，绕画布中心）', ang),
        h('div', { class: 'hint' }, '也可以直接从画布上方 / 左侧标尺拖出；按住 Alt 拖出斜参考线。')
      ],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '添加', primary: true, onClick: () => {
            const x = parseFloat(horiz.value), y = parseFloat(vert.value), a = parseFloat(ang.value);
            if (!isNaN(x)) this.addX(Units.toPx(x, this.unit, 'x'));
            if (!isNaN(y)) this.addY(Units.toPx(y, this.unit, 'y'));
            if (!isNaN(a)) this.addAngled({ x: App.doc.w / 2, y: App.doc.h / 2, a });
          }
        }
      ]
    });
  }
};
