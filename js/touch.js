/* ==========================================================================
   Dreikanter photo — touch.js
   平板 / 手机：双指缩放与平移、面板抽屉、移动端适配
   ========================================================================== */
'use strict';

const TouchNav = {
  pts: new Map(),
  last: null,
  _bound: false,

  init() {
    if (this._bound) return;
    this._bound = true;

    const stage = $('#stage');
    stage.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pts.size === 2) {
        if (typeof Tools !== 'undefined') Tools.cancelDrag();
        this.measure();
      }
    }, true);

    stage.addEventListener('pointermove', e => {
      if (!this.pts.has(e.pointerId)) return;
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pts.size >= 2) this.zoomPan();
    }, true);

    const end = e => {
      this.pts.delete(e.pointerId);
      if (this.pts.size < 2) this.last = null;
    };
    stage.addEventListener('pointerup', end, true);
    stage.addEventListener('pointercancel', end, true);

    /* 面板抽屉（PS 用 #panels，Apsis 用 #inspector） */
    const backdrop = $('#mobileBackdrop');
    const drawer = () => (App.mode === 'apsis' ? $('#inspector') : $('#panels'));
    const toggle = () => {
      const p = drawer();
      if (!p) return;
      const open = p.classList.toggle('open');
      const other = App.mode === 'apsis' ? $('#panels') : $('#inspector');
      if (other) other.classList.remove('open');
      if (backdrop) backdrop.classList.toggle('on', open);
      document.body.classList.toggle('drawer-open', open);
      document.body.classList.toggle('drawer-open', open);
    };
    const mPanels = $('#mPanels');
    if (mPanels) mPanels.onclick = toggle;
    if (backdrop) backdrop.onclick = toggle;
    const mCmd = $('#mCmd');
    if (mCmd) mCmd.onclick = () => UI.openPalette();

    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth > 820) {
        ['panels', 'inspector'].forEach(id => { const p = document.getElementById(id); if (p) p.classList.remove('open'); });
        if (backdrop) backdrop.classList.remove('on');
        document.body.classList.remove('drawer-open');
      }
      layoutFrame();
      invalidate(true);
    }, 160));

    /* 移动端首次进入时收起抽屉 */
    if (window.innerWidth <= 820) {
      const p = $('#panels');
      if (p) p.classList.remove('open');
    }
  },

  measure() {
    const [a, b] = [...this.pts.values()];
    this.last = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2
    };
  },

  zoomPan() {
    const [a, b] = [...this.pts.values()];
    if (!a || !b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    if (!this.last) { this.measure(); return; }
    if (Math.abs(dist - this.last.dist) > 0.5) {
      const zf = dist / (this.last.dist || dist);
      setZoom(App.view.zoom * zf, cx, cy);
    }
    if (Math.abs(cx - this.last.cx) > 0.3 || Math.abs(cy - this.last.cy) > 0.3) {
      panBy(cx - this.last.cx, cy - this.last.cy);
    }
    this.last = { dist, cx, cy };
  }
};
