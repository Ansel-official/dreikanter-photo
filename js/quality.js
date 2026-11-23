/* ==========================================================================
   Dreikanter photo — quality.js
   可访问性 / 数值擦洗 / 错误日志 / 异步竞态守卫
   ========================================================================== */
'use strict';

/* ---------------- 可访问性 ---------------- */
const A11y = {
  _sayTimer: 0,
  say(text) {
    if (!text) return;
    const el = document.getElementById('srStatus');
    if (!el) return;
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(() => { el.textContent = text; }, 260);
  },

  init() {
    this.enhance();
    this.bindKeys();
    this.bindCanvasKeys();
    this.bindTrap();
    const rail = document.getElementById('toolrail');
    if (rail) rail.setAttribute('role', 'toolbar');
    this.sync();
    const live = document.getElementById('toastroot');
    if (live) { live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); }
    const ov = document.getElementById('overlay');
    if (ov) { ov.setAttribute('role', 'application'); ov.setAttribute('aria-label', '画布：使用工具在此绘制'); ov.setAttribute('tabindex', '0'); }
  },

  enhance() {
    /* 模式切换 */
    const ms = document.getElementById('modeSwitch');
    if (ms) {
      ms.setAttribute('role', 'tablist');
      ms.querySelectorAll('button').forEach(b => {
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false');
      });
    }
    /* 工具按钮 */
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      const d = Tools.defs[b.dataset.tool];
      if (!d) return;
      b.id = 'tool-' + b.dataset.tool;
      b.setAttribute('aria-label', d.label + '（快捷键 ' + d.key + '）');
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
    });
    /* 面板 */
    document.querySelectorAll('.panel').forEach(p => {
      const head = p.querySelector('.panel-head');
      if (!head) return;
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', p.classList.contains('collapsed') ? 'false' : 'true');
      head.setAttribute('aria-controls', p.id + '-body');
      const body = p.querySelector('.panel-body');
      if (body) body.id = p.id + '-body';
    });
    /* 图层列表 */
    const list = document.getElementById('layerList');
    if (list) {
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', '图层列表');
    }
    /* 图标按钮补 aria-label */
    document.querySelectorAll('button[title]:not([aria-label])').forEach(b => {
      b.setAttribute('aria-label', b.getAttribute('title'));
    });
  },

  /* 每次界面刷新后同步动态状态 */
  sync() {
    const rail = document.getElementById('toolrail');
    if (rail && Tools.current) rail.setAttribute('aria-activedescendant', 'tool-' + Tools.current);
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
    });
    document.querySelectorAll('#modeSwitch button').forEach(b => {
      b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(p => {
      const head = p.querySelector('.panel-head');
      if (head) head.setAttribute('aria-expanded', p.classList.contains('collapsed') ? 'false' : 'true');
    });
    const lr = document.getElementById('layerList');
    if (lr) {
      [...lr.children].forEach(row => {
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', row.classList.contains('active') ? 'true' : 'false');
        row.setAttribute('tabindex', '0');
      });
    }
  },

  bindKeys() {
    /* 面板头：Enter / Space 折叠 */
    document.addEventListener('keydown', e => {
      const head = e.target.closest && e.target.closest('.panel-head');
      if (!head) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        head.click();
      }
    });

    /* 菜单方向键 */
    document.addEventListener('keydown', e => {
      const open = document.querySelector('.menu-root.open');
      if (!open) return;
      const items = [...open.querySelectorAll('.menu-item')].filter(x => !x.disabled);
      if (!items.length) return;
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1 + items.length) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); open.classList.remove('open'); open.querySelector('button').focus(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const roots = [...document.querySelectorAll('.menu-root')];
        const k = roots.indexOf(open);
        const next = roots[(k + (e.key === 'ArrowRight' ? 1 : -1) + roots.length) % roots.length];
        open.classList.remove('open');
        next.querySelector('button').click();
        const first = next.querySelector('.menu-item');
        if (first) first.focus();
      }
    });

    /* 图层列表：上下键 + Enter */
    document.addEventListener('keydown', e => {
      const row = e.target.closest && e.target.closest('.layer-item');
      if (!row) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const rows = [...document.querySelectorAll('.layer-item')];
        const i = rows.indexOf(row);
        const next = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
        if (next) { next.focus(); next.click(); }
      }
    });

    /* 菜单按钮键盘展开 */
    document.addEventListener('keydown', e => {
      const btn = e.target.closest && e.target.closest('.menu-root > button');
      if (!btn) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        btn.click();
        const first = btn.parentElement.querySelector('.menu-item');
        if (first) first.focus();
      }
    });
  },

  /* 画布键盘：方向键平移 / +/- 缩放 / 0 适配 / Esc 复位 */
  bindCanvasKeys() {
    const ov = document.getElementById('overlay');
    if (!ov) return;
    ov.addEventListener('keydown', e => {
      const step = e.shiftKey ? 90 : 30;
      if (e.key === 'ArrowLeft') { panBy(step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { panBy(-step, 0); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { panBy(0, step); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { panBy(0, -step); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') { setZoom(App.view.zoom * 1.2); e.preventDefault(); }
      else if (e.key === '-') { setZoom(App.view.zoom / 1.2); e.preventDefault(); }
      else if (e.key === '0') { fitView(); e.preventDefault(); }
      else if (e.key === 'Escape') {
        if (App.cropRect) { App.cropRect = null; invalidateOverlay(); }
        else if (App.selection) deselect();
        else fitView();
        e.preventDefault();
      }
    });
  },

  /* 弹窗焦点陷阱 */
  bindTrap() {
    document.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const veil = document.querySelector('.modal-veil');
      if (!veil) return;
      const list = [...veil.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }
};

/* ---------------- 数值输入擦洗 ---------------- */
const Scrub = {
  init() {
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest('input[type=number]');
      if (!el || el.disabled) return;
      if (!el.hasAttribute('data-scrub')) {
        el.setAttribute('data-scrub', '');
        el.setAttribute('data-default', el.value);
      }
      this.begin(el, e);
    });
    document.addEventListener('dblclick', e => {
      const el = e.target.closest && e.target.closest('input[type=number]');
      if (!el) return;
      const def = el.getAttribute('data-default');
      if (def == null) return;
      el.value = def;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    document.addEventListener('keydown', e => {
      const el = e.target.closest && e.target.closest('input[type=number]');
      if (!el || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      if (!e.shiftKey) return;
      e.preventDefault();
      const step = parseFloat(el.step) || 1;
      const min = el.min === '' ? -Infinity : parseFloat(el.min);
      const max = el.max === '' ? Infinity : parseFloat(el.max);
      let v = (parseFloat(el.value) || 0) + (e.key === 'ArrowUp' ? 10 : -10) * step;
      v = Math.min(max, Math.max(min, v));
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  },

  begin(el, e) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startVal = parseFloat(el.value) || 0;
    const step = parseFloat(el.step) || 1;
    const min = el.min === '' ? -Infinity : parseFloat(el.min);
    const max = el.max === '' ? Infinity : parseFloat(el.max);
    let moved = false;
    const move = ev => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      document.body.classList.add('is-scrubbing');
      const mult = ev.shiftKey ? 10 : 1;
      let v = startVal + Math.round(dx / 2) * step * mult;
      v = Math.min(max, Math.max(min, v));
      if (el.value !== String(v)) {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      ev.preventDefault();
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.classList.remove('is-scrubbing');
      if (moved) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.blur();
      }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
};

/* ---------------- 错误日志 ---------------- */
const Errors = {
  list: [],
  lastToast: 0,
  init() {
    window.addEventListener('error', e => this.push(e.message, e.filename, e.lineno, e.error));
    window.addEventListener('unhandledrejection', e => {
      const r = e.reason;
      this.push(r && r.message ? r.message : String(r), '', 0, r);
    });
  },
  push(msg, file, line, err) {
    if (!msg || /ResizeObserver|Script error/i.test(msg)) return;
    this.list.push({ t: new Date().toISOString(), msg, file: file || '', line: line || 0, stack: err && err.stack ? String(err.stack).slice(0, 600) : '' });
    if (this.list.length > 60) this.list.shift();
    const now = Date.now();
    if (now - this.lastToast > 6000 && typeof toast === 'function') {
      this.lastToast = now;
      toast('出现异常：' + msg + '（可在帮助里导出日志）', 'err');
    }
    console.error('[Dreikanter]', msg, file, line);
  },
  export() {
    const txt = this.list.length
      ? this.list.map(e => `${e.t}  ${e.msg}\n  ${e.file}:${e.line}\n${e.stack ? '  ' + e.stack.replace(/\n/g, '\n  ') : ''}`).join('\n\n')
      : '没有捕获到错误。';
    const blob = new Blob([`Dreikanter photo 错误日志\nUA: ${navigator.userAgent}\n时间: ${new Date().toISOString()}\n\n${txt}`], { type: 'text/plain' });
    downloadBlob(blob, 'dreikanter-errors.txt');
  }
};
