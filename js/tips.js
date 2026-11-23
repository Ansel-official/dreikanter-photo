/* ==========================================================================
   Dreikanter photo — tips.js
   轻量自定义提示气泡（接管 title 属性，避免原生提示又慢又丑）
   ========================================================================== */
'use strict';

const Tips = {
  el: null,
  timer: 0,
  hideTimer: 0,

  init() {
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[title]');
      if (!t) return;
      clearTimeout(this.timer);
      clearTimeout(this.hideTimer);
      this.remove();
      const text = t.getAttribute('title');
      if (!text) return;
      t.setAttribute('data-title', text);
      t.removeAttribute('title');
      this.timer = setTimeout(() => this.show(t, text), 480);
    });

    document.addEventListener('pointerout', e => {
      const t = e.target.closest('[data-title]');
      if (!t) return;
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      clearTimeout(this.timer);
      this.hideTimer = setTimeout(() => this.remove(), 60);
      if (!t.getAttribute('title')) {
        t.setAttribute('title', t.getAttribute('data-title'));
        t.removeAttribute('data-title');
      }
    });

    document.addEventListener('pointerdown', () => this.remove(), true);
    window.addEventListener('blur', () => this.remove());
  },

  show(target, text) {
    const r = target.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const el = h('div', { class: 'tip' }, text);
    document.body.append(el);
    const tw = el.offsetWidth, th = el.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.bottom + 8;
    if (y + th > window.innerHeight - 8) y = Math.max(8, r.top - th - 8);
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    requestAnimationFrame(() => el.classList.add('on'));
    this.el = el;
  },

  remove() {
    clearTimeout(this.timer);
    if (this.el) { this.el.remove(); this.el = null; }
    /* 恢复被临时移除的 title */
    document.querySelectorAll('[data-title]').forEach(t => {
      if (!t.getAttribute('title')) {
        t.setAttribute('title', t.getAttribute('data-title'));
        t.removeAttribute('data-title');
      }
    });
  }
};
