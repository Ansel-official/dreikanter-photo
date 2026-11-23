/* ==========================================================================
   Dreikanter photo — main.js
   ========================================================================== */
'use strict';

(function boot() {

  function initAccent() {
    const accent = Store.get('accent', null);
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      document.documentElement.style.setProperty('--accent-2', accent);
    }
  }

  function start() {
    if (typeof Settings !== 'undefined') Settings.load();
    if (typeof Guides !== 'undefined') Guides.load();
    Tools.init();
    UI.init();
    if (typeof TouchNav !== 'undefined') TouchNav.init();
    if (typeof Tips !== 'undefined') Tips.init();
    if (typeof Errors !== 'undefined') Errors.init();
    if (typeof A11y !== 'undefined') A11y.init();
    if (typeof Scrub !== 'undefined') Scrub.init();
    if (typeof WorkerFX !== 'undefined') WorkerFX.init();
    if (typeof Perf !== 'undefined') Perf.init();
    if (typeof PWA !== 'undefined') PWA.init();
    if (typeof Session !== 'undefined') Session.init();
    if (typeof A11y !== 'undefined') setTimeout(() => A11y.enhance(), 300);
    initAccent();

    App.onHistory = () => {
      if (typeof UI !== 'undefined' && UI.renderHistory) UI.renderHistory();
    };

    // 载入示例作为背景（欢迎层之下）
    try { Dialogs.loadDemo(true); } catch (e) { console.error(e); }

    if (typeof Settings !== 'undefined' && Settings.data) {
      App.fg = Settings.data.defaultFg || '#ffffff';
      App.bg = Settings.data.defaultBg || '#111111';
      UI.syncColors();
      if (Settings.data.defaultTool && Tools.defs[Settings.data.defaultTool]) Tools.setTool(Settings.data.defaultTool);
      if (typeof scheduleAutosave === 'function') scheduleAutosave();
    }

    if (typeof Archives !== 'undefined') Archives.init();

    const urlMode = new URLSearchParams(location.search).get('mode');
    const mode = urlMode || Store.get('mode', 'ps');
    if (mode === 'apsis') setMode('apsis');

    // 欢迎层初始可见（?editor 可直接进入编辑器）
    const wel = $('#welcome');
    if (wel) {
      if (new URLSearchParams(location.search).has('editor')) wel.classList.add('hide');
      else wel.classList.remove('hide');
    }

    window.addEventListener('resize', debounce(() => {
      layoutFrame();
      invalidate(true);
    }, 120));

    // 缩放显示同步
    setInterval(() => { updateZoomLabel(); }, 700);

    /* 首屏可交互打点：导航开始 → 初始化完成 */
    if (typeof Perf !== 'undefined') Perf.boot = Math.round(performance.now());

    console.log('%cDreikanter photo', 'color:#7b8cff;font-weight:700;font-size:14px', 'v9.0 · © Apsis severs 2026 & Ansel Design 2026');
    console.log('内置 API 可用： Dreikanter.info()');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  window.addEventListener('error', e => {
    if (e.message && !/ResizeObserver/.test(e.message)) {
      console.error('[Dreikanter]', e.message);
    }
  });
})();
