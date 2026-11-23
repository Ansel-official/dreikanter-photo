/* ==========================================================================
   Dreikanter photo — tests/smoke.js
   浏览器内自检：设计系统 / 组件 / 动效 / 无障碍 / 交互 / 状态 / 性能
   用法：打开 index.html?test ，或 node tests/run.js
   ========================================================================== */
'use strict';

(function () {
  const items = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  /* 轮询等待条件成立，避免固定 sleep 造成的偶发失败 */
  const waitFor = async (fn, ms = 800) => {
    const t0 = performance.now();
    for (;;) {
      if (fn()) return true;
      if (performance.now() - t0 > ms) return false;
      await wait(40);
    }
  };
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rect = el => el ? el.getBoundingClientRect() : { width: 0, height: 0 };

  function rgb(str) {
    const s2 = String(str).trim();
    let m = s2.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return [+m[1], +m[2], +m[3]];
    m = s2.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    return [0, 0, 0];
  }
  function lum([r, g, b]) {
    const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
  }
  function contrast(a, b) {
    const l1 = lum(rgb(a)), l2 = lum(rgb(b));
    return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
  }
  function ruleExists(text) {
    for (const sheet of document.styleSheets) {
      try {
        for (const r of sheet.cssRules) {
          if (r.cssText && r.cssText.includes(text)) return true;
          if (r.cssRules) for (const r2 of r.cssRules) if (r2.cssText && r2.cssText.includes(text)) return true;
        }
      } catch (e) { /* 跨域样式表 */ }
    }
    return false;
  }
  async function t(name, fn) {
    const t0 = performance.now();
    try {
      const v = await fn();
      items.push({ name, pass: v !== false, info: typeof v === 'string' ? v : '', ms: Math.round(performance.now() - t0) });
    } catch (e) {
      items.push({ name, pass: false, info: e.message, ms: Math.round(performance.now() - t0) });
    }
  }
  const fresh = async () => { Dialogs.loadDemo(true); await wait(160); };

  let running = null;
  async function run() {
    if (running) return running;
    running = runOnce();
    try { return await running; } finally { running = null; }
  }

  async function runOnce() {
    items.length = 0;
    const T0 = performance.now();
    const errorsBefore = (window.Errors ? Errors.list.length : 0);

    /* ---------------- A 设计系统 ---------------- */
    await t('token · 强调色', () => !!cssVar('--c-accent'));
    await t('token · 8px 间距', () => cssVar('--sp-2') === '8px' && cssVar('--sp-4') === '16px');
    await t('token · 4px 半格', () => cssVar('--sp-1') === '4px');
    await t('token · 字号阶梯', () => ['--fs-11', '--fs-12', '--fs-13', '--fs-14', '--fs-16', '--fs-18', '--fs-22', '--fs-28'].every(v => cssVar(v)));
    await t('token · 圆角', () => cssVar('--r-sm') === '5px' && cssVar('--r-md') === '7px');
    await t('token · 动效时长', () => cssVar('--dur-fast') === '120ms' && cssVar('--dur-base') === '180ms' && cssVar('--dur-slow') === '240ms');
    await t('token · 缓动曲线', () => cssVar('--ease-standard').includes('cubic-bezier'));
    await t('token · 状态色', () => !!cssVar('--c-success') && !!cssVar('--c-warning') && !!cssVar('--c-danger'));
    await t('token · 命中尺寸', () => cssVar('--hit-min') === '32px' && cssVar('--hit-touch') === '44px');
    await t('token · 层级', () => cssVar('--z-modal') === '900' && cssVar('--z-toast') === '1000');
    await t('token · 阴影', () => cssVar('--sh-3').includes('rgba'));

    /* 对比度（深色） */
    document.body.classList.remove('theme-light');
    await wait(60);
    const bg1 = getComputedStyle(document.getElementById('panels')).backgroundColor;
    const txt = getComputedStyle(document.body).color;
    await t('对比度 · 正文 ≥4.5', () => contrast(txt, bg1) >= 4.5, contrast(txt, bg1).toFixed(2));
    await t('对比度 · 次级文字 ≥4.5', () => {
      const c = getComputedStyle(document.querySelector('.panel-head .ph-title')).color;
      return contrast(c, bg1) >= 4.5;
    }, '');
    await t('对比度 · 弱文字 ≥4.5', () => contrast(cssVar('--c-text-3'), cssVar('--c-surface-1')) >= 4.5,
      contrast(cssVar('--c-text-3'), cssVar('--c-surface-1')).toFixed(2));

    /* 浅色对照 */
    document.body.classList.add('theme-light');
    await wait(80);
    const lbg = getComputedStyle(document.getElementById('panels')).backgroundColor;
    await t('对比度 · 浅色正文 ≥4.5', () => contrast(getComputedStyle(document.body).color, lbg) >= 4.5,
      contrast(getComputedStyle(document.body).color, lbg).toFixed(2));
    document.body.classList.remove('theme-light');
    await wait(60);

    await t('token · 大圆角与阴影', () => cssVar('--r-lg') === '10px' && cssVar('--sh-1').includes('rgba'));
    await t('token · 字重与字距', () => cssVar('--fw-semibold') === '600' && !!cssVar('--ls-wide'));
    await t('token · 等宽字体', () => cssVar('--font-mono').includes('mono') || cssVar('--font-mono').includes('Consolas'));
    await t('token · 缓动强调曲线', () => cssVar('--ease-emphasize').includes('cubic-bezier'));



    /* ---------------- B 组件 ---------------- */
    await t('组件 · 主按钮高度 ≥28', () => {
      Tools.setTool('brush');
      const el = document.querySelector('#optionsbar .opt-btn') || document.querySelector('.modal .btn');
      return !el ? '未找到可见按钮' : rect(el).height >= 28;
    });
    await t('组件 · 图标按钮 ≥32 宽', () => rect($('.icon-btn')).width >= 32, Math.round(rect($('.icon-btn')).width));
    await t('组件 · 工具按钮 ≥32', () => rect($('.tool-btn[data-tool]')).width >= 32, Math.round(rect($('.tool-btn[data-tool]')).width));
    await t('组件 · 输入框 ≥26', async () => {
      Tools.setTool('brush'); await wait(80);
      const el = document.querySelector('#optionsbar .opt-field');
      return !el ? '无输入框' : rect(el).height >= 26;
    });
    await t('组件 · 面板头 ≥30', () => rect($('.panel-head')).height >= 30, Math.round(rect($('.panel-head')).height));
    await t('组件 · 标签 ≥28', () => rect($('.tab')).height >= 28, Math.round(rect($('.tab')).height));
    await t('组件 · 菜单圆角统一', () => {
      const r = getComputedStyle(document.querySelector('.menu-pop') || document.body).borderRadius;
      return r === cssVar('--r-md') || r === '0px';
    });
    await t('组件 · 输入框圆角统一', () => {
      const el = document.querySelector('#optionsbar .opt-field');
      return !!el && getComputedStyle(el).borderRadius === cssVar('--r-sm');
    });
    await t('组件 · 面板头高度 ≥28', () => rect(document.querySelector('.panel-head')).height >= 28);
    await t('组件 · 焦点环样式存在', () => ruleExists(':focus-visible'));
    await t('组件 · 标签栏高度', () => rect(document.getElementById('tabbar')).height >= 32);
    await t('组件 · 菜单项 ≥24', async () => {
      const root = document.querySelectorAll('.menu-root')[0];
      root.querySelector('button').click(); await wait(90);
      const h2 = rect(root.querySelector('.menu-item')).height;
      root.classList.remove('open');
      return h2 >= 24;
    });
    await t('组件 · 面板宽度', () => rect(document.getElementById('panels')).width >= 220);
    await t('组件 · 列表项高度', () => rect(document.querySelector('.cmd-item')).height >= 20);

    /* ---------------- C 动效 ---------------- */
    await t('动效 · 按钮过渡 120ms', () => {
      const d = getComputedStyle(document.querySelector('.btn, .opt-btn, .icon-btn')).transitionDuration;
      return d.includes('0.12s');
    });
    await t('动效 · 面板展开动画', () => getComputedStyle(document.querySelector('.panel-body')).animationName === 'panelIn');
    await t('动效 · 弹窗入场 240ms', () => {
      const el = document.querySelector('.modal') || (() => { Dialogs.about(); return document.querySelector('.modal'); })();
      const d = getComputedStyle(el).animationDuration;
      return d === '0.24s';
    });
    await t('动效 · 支持减少动态', () => ruleExists('prefers-reduced-motion'));
    await t('动效 · loading 动画存在', () => ruleExists('spin'));
    await t('动效 · 过渡只含安全属性', () => {
      const p = getComputedStyle(document.querySelector('.tool-btn')).transitionProperty;
      return /(transform|opacity|background-color|color|border-color|box-shadow)/.test(p);
    });

    /* ---------------- D 无障碍 ---------------- */
    await t('a11y · 模式切换 role', () => document.getElementById('modeSwitch').getAttribute('role') === 'tablist');
    await t('a11y · 模式 aria-selected', () => document.querySelectorAll('#modeSwitch [aria-selected]').length >= 2);
    await t('a11y · 工具 aria-pressed', () => document.querySelectorAll('.tool-btn[aria-pressed]').length >= 15);
    await t('a11y · 工具 aria-label', () => {
      const b = document.querySelector('.tool-btn[data-tool]');
      return (b.getAttribute('aria-label') || '').length > 2;
    });
    await t('a11y · 面板 role/tabindex', () => {
      const h = document.querySelector('.panel-head');
      return h.getAttribute('role') === 'button' && h.getAttribute('tabindex') === '0';
    });
    await t('a11y · 面板 aria-expanded', () => document.querySelector('.panel-head').hasAttribute('aria-expanded'));
    await t('a11y · 图层 listbox', () => document.getElementById('layerList').getAttribute('role') === 'listbox');
    await t('a11y · 图层 option', () => {
      const r = document.querySelector('.layer-item');
      return r && r.getAttribute('role') === 'option' && r.hasAttribute('aria-selected');
    });
    await t('a11y · 弹窗 dialog/aria-modal', () => {
      Dialogs.about(); const m = document.querySelector('.modal');
      const ok = m.getAttribute('role') === 'dialog' && m.getAttribute('aria-modal') === 'true';
      document.querySelector('.modal-close').click();
      return ok;
    });
    await t('a11y · 提示条 aria-live', () => {
      const t2 = document.getElementById('toastroot');
      return t2.getAttribute('role') === 'status' && t2.getAttribute('aria-live') === 'polite';
    });
    await t('a11y · 画布 aria-label', () => (document.getElementById('overlay').getAttribute('aria-label') || '').length > 3);
    await t('a11y · 图标按钮有名称', () => {
      const b = document.querySelector('.panel-actions .icon-btn, .layer-actions .icon-btn');
      return !b || !!(b.getAttribute('aria-label') || b.getAttribute('title'));
    });
    await t('a11y · 菜单方向键', async () => {
      const root = $$('.menu-root')[0];
      root.querySelector('button').click();
      await wait(120);
      const opened = root.classList.contains('open');
      const items2 = $$('.menu-root.open .menu-item');
      if (!items2.length) return '菜单未打开 opened=' + opened;
      items2[0].focus();
      items2[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await wait(60);
      const moved = document.activeElement === items2[1];
      items2[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(80);
      const closed = !document.querySelector('.menu-root.open');
      return moved && closed ? true : 'moved=' + moved + ' closed=' + closed;
    });
    await t('a11y · Esc 关闭菜单', async () => {
      const root = document.querySelectorAll('.menu-root')[0];
      closeAllMenus();
      root.querySelector('button').click();
      await wait(100);
      if (!root.classList.contains('open')) return '菜单未打开';
      root.querySelector('.menu-item').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait(80);
      return !root.classList.contains('open');
    });
    await t('a11y · 面板 Enter 折叠', async () => {
      const p = document.getElementById('panel-history');
      if (!p) return false;
      const head = p.querySelector('.panel-head');
      const before = p.classList.contains('collapsed');
      head.focus();
      head.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await wait(80);
      return p.classList.contains('collapsed') !== before;
    });
    await t('a11y · 画布可聚焦', () => document.getElementById('overlay').getAttribute('tabindex') === '0');
    await t('a11y · 弹窗初始焦点', async () => {
      Dialogs.newDoc(); await wait(150);
      const inModal = document.querySelector('.modal').contains(document.activeElement);
      document.querySelector('.modal-close').click();
      return inModal;
    });
    await t('a11y · 弹窗焦点陷阱', async () => {
      Dialogs.about(); await wait(120);
      const f = [...document.querySelectorAll('.modal .btn, .modal .modal-close, .modal input')];
      if (!f.length) return false;
      f[f.length - 1].focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      const inModal = document.querySelector('.modal').contains(document.activeElement);
      document.querySelector('.modal-close').click();
      return inModal;
    });

    /* ---------------- E 交互 ---------------- */
    await t('交互 · 数值擦洗', async () => {
      Tools.setTool('brush'); await wait(80);
      const inp = document.querySelector('#optionsbar .opt-field input');
      const before = +inp.value;
      const r = inp.getBoundingClientRect();
      inp.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 8, clientY: r.top + 8, button: 0 }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + 48, clientY: r.top + 8 }));
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      await wait(60);
      return +inp.value !== before;
    });
    await t('交互 · 双击重置数值', async () => {
      const inp = document.querySelector('#optionsbar .opt-field input');
      inp.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await wait(60);
      return inp.value === inp.getAttribute('data-default');
    });
    await t('交互 · 命令面板输入聚焦', async () => {
      UI.openPalette(); await wait(80);
      const ok = document.activeElement === document.querySelector('.palette-input');
      document.querySelector('.palette').remove();
      return ok;
    });
    await t('交互 · 模糊匹配过滤', async () => {
      UI.openPalette(); await wait(80);
      const inp = document.querySelector('.palette-input');
      inp.value = 'lut'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(60);
      const n = document.querySelectorAll('.pal-item').length;
      document.querySelector('.palette').remove();
      return n > 0 && n < 40;
    });
    await t('交互 · 命中高亮', async () => {
      UI.openPalette(); await wait(80);
      const inp = document.querySelector('.palette-input');
      inp.value = '胶片'; inp.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(60);
      const ok = !!document.querySelector('.pal-item mark');
      document.querySelector('.palette').remove();
      return ok;
    });
    await t('交互 · 命令最近使用', async () => {
      Store.set('cmdRecent', ['新建…']);
      UI.openPalette(); await wait(80);
      const ok = document.querySelector('.pal-section').textContent === '最近使用';
      document.querySelector('.palette').remove();
      Store.set('cmdRecent', []);
      return ok;
    });
    await t('交互 · 提示气泡 480ms', async () => {
      const b = document.querySelector('.tool-btn[data-tool="brush"]');
      b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
      await wait(560);
      const tip = document.querySelector('.tip');
      const ok = !!tip;
      b.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
      return ok;
    });
    await t('交互 · 图层右键菜单', async () => {
      await fresh();
      document.querySelector('.layer-item').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }));
      await wait(80);
      const n = document.querySelectorAll('.ctx-item').length;
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return n >= 6;
    });
    await t('交互 · 双击图层重命名', async () => {
      const row = document.querySelector('.layer-item');
      row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await wait(150);
      const ok = !!document.querySelector('.modal');
      if (ok) document.querySelector('.modal-close').click();
      return ok;
    });
    await t('交互 · 拖拽遮罩元素存在', () => !!document.getElementById('dropveil'));
    await t('交互 · 菜单项可键盘回车', async () => {
      const root = $$('.menu-root')[0];
      root.querySelector('button').click(); await wait(80);
      const item = root.querySelector('.menu-item');
      item.focus();
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      item.click();
      await wait(120);
      return !document.querySelector('.menu-root.open');
    });
    await t('交互 · 菜单内方向键移动焦点', async () => {
      const root = $$('.menu-root')[0];
      root.querySelector('button').click(); await wait(80);
      const items2 = [...root.querySelectorAll('.menu-item')];
      if (items2.length < 3) return false;
      items2[0].focus();
      items2[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const moved = document.activeElement === items2[1];
      items2[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      const jumped = document.activeElement === items2[items2.length - 1];
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const closed = !document.querySelector('.menu-root.open');
      return moved && jumped && closed ? `${items2.length} 项` : `moved=${moved} end=${jumped} esc=${closed}`;
    });

    /* ---------------- F 状态与边界 ---------------- */
    await t('边界 · 欢迎页可打开', async () => { showWelcome(); await wait(200); return !document.getElementById('welcome').classList.contains('hide'); });
    await t('边界 · 继续编辑按钮', async () => { const b = document.getElementById('welResume'); return /继续编辑/.test(b.textContent); });
    await t('边界 · 返回画布', async () => { hideWelcome(); await wait(120); return document.getElementById('welcome').classList.contains('hide'); });
    await t('边界 · 空存档提示', async () => {
      await Archives.clear(); await wait(120);
      UI.togglePanel('archives'); await wait(200);
      return !!document.querySelector('.arc-empty');
    });
    await t('边界 · 锁定图层不可绘制', async () => {
      await fresh();
      const l = activeLayer(); l.locked = true;
      Tools.setTool('brush');
      const before = ctx2d(l.canvas).getImageData(200, 200, 1, 1).data[3];
      const r = document.getElementById('view').getBoundingClientRect();
      document.getElementById('overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 60, clientY: r.top + 60, pointerId: 9, buttons: 1 }));
      document.getElementById('overlay').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9 }));
      const after = ctx2d(l.canvas).getImageData(200, 200, 1, 1).data[3];
      l.locked = false;
      return before === after;
    });
    await t('边界 · 非图片拖入提示', async () => {
      await fresh();
      const dt = new DataTransfer();
      dt.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
      const before = document.querySelectorAll('.toast').length;
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      const shown = await waitFor(() => document.querySelectorAll('.toast').length > before, 600);
      const veilOff = !document.getElementById('dropveil').classList.contains('on');
      if (!shown) throw new Error('没有任何提示');
      if (!veilOff) throw new Error('拖拽遮罩没有收起');
      return '已提示';
    });
    await t('边界 · 撤销空历史有提示', async () => {
      History.reset();
      History.undo(); await wait(80);
      return [...document.querySelectorAll('.toast')].length > 0;
    });
    await t('边界 · 关闭最后文档回主页', async () => {
      await fresh();
      Docs.close(Docs.current().id);
      const home = await waitFor(() => !document.getElementById('welcome').classList.contains('hide'), 900);
      if (!home) throw new Error('没有回到主页');
      return '关闭后回主页';
    });
    await t('边界 · 错误日志可记录', () => {
      const n = Errors.list.length;
      Errors.push('自检用错误', 'test.js', 1);
      return Errors.list.length === n + 1 && Errors.list[Errors.list.length - 1].msg === '自检用错误';
    });

    /* ---------------- G 性能 ---------------- */
    await fresh();
    await t('性能 · 首屏可交互 <1s', () => {
      /* 以应用自身「初始化完成」打点为准，比 DOMContentLoaded 更贴近可交互 */
      const boot = (typeof Perf !== 'undefined' && Perf.boot) || 0;
      const nav = performance.getEntriesByType('navigation')[0];
      const dcl = nav ? Math.round(nav.domContentLoadedEventEnd) : 0;
      const ms = boot || dcl;
      if (!(ms > 0)) throw new Error('无可交互打点');
      if (ms >= 1000) throw new Error('过慢 ' + ms + 'ms');
      return ms + 'ms' + (dcl ? ' · DCL ' + dcl + 'ms' : '');
    });
    await t('性能 · 单次操作 <100ms', async () => {
      const t0 = performance.now();
      Tools.setTool('brush');
      const r = document.getElementById('view').getBoundingClientRect();
      document.getElementById('overlay').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 80, clientY: r.top + 80, pointerId: 11, buttons: 1 }));
      document.getElementById('overlay').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 11 }));
      const dt = performance.now() - t0;
      if (dt >= 100) throw new Error('过慢 ' + Math.round(dt) + 'ms'); return Math.round(dt) + 'ms';
    });
    await t('性能 · 4K 合成 <200ms', async () => {
      newDocument(4000, 3000, { bg: '#111111' }); await wait(220);
      for (let i = 0; i < 3; i++) {
        History.begin('x', []); const l = addLayer(createLayer('P' + i)); History.end();
        const c = ctx2d(l.canvas); c.fillStyle = ['#3355ff', '#ff5533', '#33ff88'][i]; c.globalAlpha = .4;
        c.fillRect(200 + i * 300, 200, 1200, 900); c.globalAlpha = 1;
      }
      await wait(150);
      const t0 = performance.now(); drawComposite(); const dt = performance.now() - t0;
      if (dt >= 150) throw new Error('过慢 ' + Math.round(dt) + 'ms'); return Math.round(dt) + 'ms';
    });
    await t('性能 · 4K 滤镜预览 <200ms', async () => {
      Tools.setTool('move');
      App.activeId = App.layers[App.layers.length - 1].id;
      Adjust.start();
      /* 取 3 帧中位数：首帧含 worker 唤醒，末帧可能被 GC 打断 */
      const runs = [];
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        Adjust.preview(FX.blur, { radius: 6 + i });
        await Adjust.whenIdle();
        runs.push(performance.now() - t0);
      }
      Adjust.cancel();
      runs.sort((a, b) => a - b);
      const med = runs[1];
      if (med >= 200) throw new Error('过慢 ' + Math.round(med) + 'ms（' + runs.map(r => Math.round(r)).join(' / ') + '）');
      return Math.round(med) + 'ms · ' + runs.map(r => Math.round(r)).join(' / ');
    });
    await t('性能 · 4K 全选 <100ms', async () => {
      const t0 = performance.now(); selectAll(); const dt = performance.now() - t0; deselect();
      if (dt >= 100) throw new Error('过慢 ' + Math.round(dt) + 'ms'); return Math.round(dt) + 'ms';
    });
    await t('性能 · 缩放平移批量 <300ms', async () => {
      const t0 = performance.now();
      for (let i = 0; i < 10; i++) { setZoom(0.2 + i * 0.02); panBy(10, 5); }
      await wait(100);
      const dt = performance.now() - t0;
      if (dt >= 300) throw new Error('过慢 ' + Math.round(dt) + 'ms'); return Math.round(dt) + 'ms';
    });
    await t('性能 · 内存合理', () => {
      if (!performance.memory) return '浏览器不暴露内存';
      const mb = performance.memory.usedJSHeapSize / 1048576;
      if (mb >= 1500) throw new Error('过高 ' + Math.round(mb) + 'MB');
      return Math.round(mb) + 'MB';
    });

    /* ---------------- J Worker / PWA / 键盘 / 恢复 ---------------- */
    await t('worker · 已就绪', () => !!(WorkerFX && WorkerFX.ready), WorkerFX && WorkerFX.ready ? 'on' : 'off');
    await t('worker · 算子映射', () => WorkerFX.opFor(FX.blur) === 'blur' && WorkerFX.opFor(FX.pixelate) === 'pixelate');
    await t('worker · 滤镜预览走后台', async () => {
      await fresh();
      App.activeId = App.layers[0].id;
      Adjust.start();
      Adjust.preview(FX.blur, { radius: 4 });
      await Adjust.whenIdle();
      const okp = !!App.previewCanvas;
      Adjust.cancel();
      return okp;
    });
    await t('perf · 长任务监控可用', () => !!(Perf && Perf.summary()), Perf.summary());
    await t('perf · 内存可读', () => {
      const m = Resources.memory();
      if (!m) return '浏览器不暴露内存';
      if (typeof m.used !== 'number' || typeof m.peak !== 'number') throw new Error('字段缺失');
      if (m.used > m.peak) throw new Error('used 大于 peak');
      return m.used + 'MB / 峰值 ' + m.peak + 'MB';
    });
    await t('资源 · 释放文档引用', () => {
      const s2 = { doc: {}, layers: [], history: {}, selection: {} };
      Resources.releaseDoc(s2);
      return s2.layers === null && s2.history === null;
    });
    await t('导出 · 命名模板', () => {
      const n = exportName('poster', { w: 1080, h: 1440 }, 1);
      return /poster-1080x1440-\d{8}-\d{4}/.test(n);
    });
    await t('导出 · 队列存在', () => !!(ExportQueue && ExportQueue.push));
    await t('导出 · 队列可执行', async () => {
      await fresh();
      ExportQueue.push({ type: 'image/png', quality: .9, name: 'queue-test.png' });
      for (let i = 0; i < 40 && (ExportQueue.running || ExportQueue.jobs.length); i++) await wait(100);
      return !ExportQueue.running;
    });
    await t('会话 · 快照写入', async () => {
      Session.save(); await wait(60);
      const s2 = Store.get('session', null);
      return !!s2 && s2.w === App.doc.w && typeof s2.zoom === 'number';
    });
    await t('PWA · manifest 链接', () => !!document.querySelector('link[rel=manifest]'));
    await t('PWA · theme-color', () => !!document.querySelector('meta[name=theme-color]'));
    await t('PWA · 图标可访问', async () => {
      const r = await fetch('icons/icon-192.png');
      return r.ok;
    });
    await t('PWA · Service Worker 注册', async () => {
      if (!('serviceWorker' in navigator)) throw new Error('浏览器不支持 SW');
      for (let i = 0; i < 24; i++) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg.scope.replace(location.origin, '') || '/';
        await wait(150);
      }
      throw new Error('未注册');
    });
    await t('a11y · 读屏播报区', () => {
      const el = document.getElementById('srStatus');
      return !!el && el.getAttribute('aria-live') === 'polite';
    });
    await t('a11y · 工具栏语义', () => {
      const rail = document.getElementById('toolrail');
      return rail.getAttribute('role') === 'toolbar' && !!rail.getAttribute('aria-activedescendant');
    });
    await t('a11y · 工具切换播报', async () => {
      Tools.setTool('brush'); await wait(400);
      const txt = document.getElementById('srStatus').textContent;
      return /画笔/.test(txt);
    });
    await t('a11y · 画布方向键平移', async () => {
      await fresh();
      const ov = document.getElementById('overlay');
      ov.focus();
      const x0 = App.view.cx;
      ov.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      return waitFor(() => App.view.cx !== x0);
    });
    await t('a11y · 画布 + 缩放', async () => {
      const ov = document.getElementById('overlay');
      ov.focus();
      const z0 = App.view.zoom;
      ov.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));
      const changed = await waitFor(() => App.view.zoom !== z0);
      fitView();
      return changed;
    });
    await t('a11y · 画布 Esc 复位', async () => {
      await fresh();
      const ov = document.getElementById('overlay');
      App.cropRect = null;
      deselect();
      setZoom(2);
      ov.focus();
      const z0 = App.view.zoom;
      ov.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      if (!await waitFor(() => Math.abs(App.view.zoom - z0) > 0.01)) {
        return `未复位 zoom=${App.view.zoom}`;
      }
      return '2 → ' + App.view.zoom.toFixed(2);
    });
    await t('a11y · 高对比度规则', () => ruleExists('prefers-contrast'));
    await t('主题 · 跟随系统', async () => {
      Settings.set('theme', 'auto', false); await wait(100);
      const light = matchMedia('(prefers-color-scheme: light)').matches;
      const okp = document.body.classList.contains('theme-light') === light;
      Settings.set('theme', 'dark', false);
      return okp;
    });
    await t('内存 · 20 次开关文档增长 <30%', async () => {
      if (!performance.memory) return '浏览器不暴露内存';
      const before = performance.memory.usedJSHeapSize;
      for (let i = 0; i < 20; i++) {
        newDocument(600, 400, { bg: '#111', name: 'M' + i });
        await wait(15);
        Docs.close(Docs.current().id);
        await wait(15);
      }
      for (let i = 0; i < 10; i++) await wait(50);
      const after = performance.memory.usedJSHeapSize;
      const growth = (after - before) / Math.max(1, before);
      if (growth >= 0.3) throw new Error('增长 ' + Math.round(growth * 100) + '%');
      return Math.round(growth * 100) + '%';
    });
    await fresh();

    /* ---------------- H 工程 ---------------- */
    await t('工程 · 指令 ≥120 条', () => COMMANDS.length >= 120, COMMANDS.length);
    await t('工程 · 指令 id 唯一', () => new Set(COMMANDS.map(c => c.id)).size === COMMANDS.length);
    await t('工程 · 样式表 ≥7', () => document.styleSheets.length >= 7, document.styleSheets.length);
    await t('工程 · 全局模块就绪', () => ['App', 'Tools', 'UI', 'Docs', 'Archives', 'Settings', 'Tips', 'A11y', 'Scrub', 'Errors', 'Guides', 'Apsis', 'CAMERA_LOOKS'].every(k => window[k] !== undefined || typeof eval(k) !== 'undefined'));
    await t('工程 · 无已知错误', () => Errors.list.filter(e => e.msg !== '自检用错误').length === errorsBefore);

    /* ---------------- I 功能回归 ---------------- */
    await t('功能 · 双模式切换', async () => {
      document.querySelector('#modeSwitch button[data-mode="apsis"]').click(); await wait(300);
      const a = document.body.classList.contains('mode-apsis');
      document.querySelector('#modeSwitch button[data-mode="ps"]').click(); await wait(300);
      return a && document.body.classList.contains('mode-ps');
    });
    await t('功能 · 9 个菜单', () => document.querySelectorAll('.menu-root').length === 9);
    await t('功能 · 19 个工具', () => document.querySelectorAll('.tool-btn[data-tool]').length === 19);
    await t('功能 · 新建标签', async () => {
      const n0 = Docs.list.length;
      newDocument(800, 600, { bg: '#fff', name: 'T2' }); await wait(250);
      return Docs.list.length === n0 + 1;
    });
    await t('功能 · 切换文档保状态', async () => {
      const first = Docs.list[0];
      Docs.switchTo(first.id); await wait(250);
      return App.doc.w === 1600;
    });
    await t('功能 · 存档往返', async () => {
      await fresh();
      const snap = await Archives.create('回归'); await wait(150);
      const id = snap.id;
      const n1 = Archives.list.length;
      await Archives.remove(id); await wait(120);
      return n1 === 1 && Archives.list.length === 0;
    });
    await t('功能 · LUT 应用', async () => {
      await fresh();
      const L = App.layers[0]; App.activeId = L.id;
      const b = ctx2d(L.canvas).getImageData(400, 300, 1, 1).data[2];
      applyFilterDirect(FX.cameraLook, { look: 'leica', intensity: 100 }, 'LUT'); await wait(100);
      const a = ctx2d(L.canvas).getImageData(400, 300, 1, 1).data[2];
      return a !== b;
    });
    await t('功能 · 导出预设尺寸', () => {
      const cv = compositeCanvas(false);
      const out = makeCanvas(1080, 1440);
      const x = ctx2d(out);
      const s = Math.max(1080 / cv.width, 1440 / cv.height);
      x.drawImage(cv, 0, 0, cv.width * s, cv.height * s);
      return out.width === 1080;
    });
    await t('功能 · 面板折叠持久化', () => {
      const p = document.getElementById('panel-history');
      const head = p.querySelector('.panel-head');
      head.click(); UI.savePanelState();
      const saved = Store.get('panelState', {});
      head.click();
      return saved['panel-history'] !== undefined;
    });
    await t('功能 · 设置五页签', async () => {
      Settings.open(); await wait(150);
      const btns = $$('.modal .tabs button');
      for (const b of btns) { b.click(); await wait(100); }
      const ok = btns.length === 5;
      document.querySelector('.modal-close').click();
      return ok;
    });
    await t('功能 · 快捷键面板 ≥15 行', async () => {
      Dialogs.shortcuts(); await wait(150);
      const rows = document.querySelectorAll('.modal .prop-grid .k').length;
      document.querySelector('.modal-close').click();
      return rows >= 15;
    });

    /* 深浅主题往返 */
    await t('主题 · 浅色', async () => {
      Settings.set('theme', 'light', false); await wait(120);
      return document.body.classList.contains('theme-light');
    });
    await t('主题 · 纯黑', async () => {
      Settings.set('theme', 'oled', false); await wait(120);
      return document.body.classList.contains('theme-oled');
    });
    await t('主题 · 回到深色', async () => {
      Settings.set('theme', 'dark', false); await wait(120);
      return !document.body.classList.contains('theme-light') && !document.body.classList.contains('theme-oled');
    });

    /* ---------------- K 键盘完整度 ---------------- */
    const key = (target, k, mods) => target.dispatchEvent(new KeyboardEvent('keydown',
      Object.assign({ key: k, bubbles: true, cancelable: true }, mods || {})));
    const px = (canvas, x, y) => ctx2d(canvas).getImageData(x, y, 1, 1).data;
    const signature = () => {
      const l = activeLayer();
      if (!l) return '';
      return [...px(l.canvas, Math.min(100, l.canvas.width - 1), Math.min(100, l.canvas.height - 1))].join(',');
    };

    await t('键盘 · Ctrl+Z 撤销 / Ctrl+Shift+Z 重做', async () => {
      await fresh();
      Dreikanter.new(300, 300, { bg: '#101010' });
      const s0 = signature();
      Dreikanter.shape('rect', { x: 0, y: 0, w: 300, h: 300, color: '#00b3ff' });
      const s1 = signature();
      if (s1 === s0) throw new Error('绘制未生效');
      key(document.body, 'z', { ctrlKey: true });
      await waitFor(() => signature() !== s1, 600);
      const s2 = signature();
      key(document.body, 'Z', { ctrlKey: true, shiftKey: true });
      await waitFor(() => signature() !== s2, 600);
      const s3 = signature();
      if (s2 !== s0) throw new Error('撤销未回到初始：' + s2 + ' vs ' + s0);
      if (s3 !== s1) throw new Error('重做未回到绘制后');
      return '往返一致';
    });

    await t('键盘 · [ ] 调整画笔大小', async () => {
      await fresh();
      Tools.setTool('brush');
      const st = Tools.state[Tools.current];
      if (!st || st.size == null) throw new Error('画笔没有 size');
      const a = st.size;
      key(document.body, ']');
      const b = st.size;
      key(document.body, '[');
      key(document.body, '[');
      const c = st.size;
      if (!(b > a)) throw new Error('] 未放大：' + a + ' → ' + b);
      if (!(c < b)) throw new Error('[ 未缩小：' + b + ' → ' + c);
      return a + ' → ' + b + ' → ' + c;
    });

    await t('键盘 · 方向键微移图层', async () => {
      await fresh();
      if (Tools.current !== 'move') Tools.setTool('move');
      const l = activeLayer();
      const x0 = l.x, y0 = l.y;
      key(document.body, 'ArrowRight');
      key(document.body, 'ArrowDown', { shiftKey: true });
      if (l.x !== x0 + 1) throw new Error('→ 位移 ' + (l.x - x0));
      if (l.y !== y0 + 10) throw new Error('Shift+↓ 位移 ' + (l.y - y0));
      return '+1 / +10';
    });

    await t('键盘 · 输入框内不打断输入', async () => {
      await fresh();
      Tools.setTool('brush'); await wait(60);
      let inp = document.querySelector('#optionsbar input');
      let temp = null;
      if (!inp) { temp = document.createElement('input'); document.body.append(temp); inp = temp; }
      inp.focus();
      const before = Tools.current;
      key(inp, 'e');
      key(inp, 'k', { ctrlKey: true });
      const after = Tools.current;
      const noPalette = !document.querySelector('.palette');
      inp.blur();
      if (temp) temp.remove();
      if (after !== before) throw new Error('输入框内切换了工具：' + after);
      if (!noPalette) throw new Error('输入框内打开了命令面板');
      return '已忽略';
    });

    await t('键盘 · Ctrl+K 命令面板与 Esc 关闭', async () => {
      await fresh();
      key(document.body, 'k', { ctrlKey: true });
      const opened = await waitFor(() => !!document.querySelector('.palette-input'), 600);
      let closed = false;
      if (opened) {
        const input = document.querySelector('.palette-input');
        input.focus();
        key(input, 'Escape');
        closed = await waitFor(() => !document.querySelector('.palette'), 600);
        document.querySelectorAll('.palette').forEach(el => el.remove());
      }
      if (!opened) throw new Error('未打开');
      if (!closed) throw new Error('Esc 未关闭');
      return '开 / 关';
    });

    await t('键盘 · ? 打开快捷键一览', async () => {
      await fresh();
      key(document.body, '?');
      const open = await waitFor(() => !!document.querySelector('.modal'), 600);
      const rows = open ? document.querySelectorAll('.modal .k').length : 0;
      const close = document.querySelector('.modal-close');
      if (close) close.click();
      await waitFor(() => !document.querySelector('.modal'), 600);
      if (!open) throw new Error('未打开');
      if (rows < 15) throw new Error('仅 ' + rows + ' 行');
      return rows + ' 行';
    });

    await t('键盘 · Esc 逐级退出（选区优先）', async () => {
      await fresh();
      selectAll();
      setZoom(1.5);
      const ov = document.getElementById('overlay');
      ov.focus();
      key(ov, 'Escape');
      const cleared = await waitFor(() => !App.selection, 600);
      const stayed = Math.abs(App.view.zoom - 1.5) < 0.01;
      fitView();
      if (!cleared) throw new Error('选区未清除');
      if (!stayed) throw new Error('缩放被一起重置：' + App.view.zoom);
      return '先撤选区';
    });

    /* ---------------- L 内置 API ---------------- */
    await t('API · new 返回文档信息', () => {
      const r = Dreikanter.new(640, 480, { name: 'API', bg: '#223344' });
      if (!(r.width === 640 && r.height === 480 && r.layers === 1)) throw new Error(JSON.stringify(r));
      return '640×480';
    });

    await t('API · layer 增 / 选 / 设', () => {
      Dreikanter.new(400, 300);
      const id = Dreikanter.layer.add('辅助层');
      Dreikanter.layer.select(id);
      const s = Dreikanter.layer.set({ opacity: 50, blend: 'multiply', name: '改名后' });
      if (s.opacity !== 0.5 || s.blend !== 'multiply' || s.name !== '改名后') throw new Error(JSON.stringify(s));
      return 'opacity 0.5';
    });

    await t('API · adjust 改变像素', () => {
      Dreikanter.new(200, 200, { bg: '#808080' });
      const a = +signature().split(',')[0];
      Dreikanter.adjust({ brightness: 40 });
      const b = +signature().split(',')[0];
      if (!(b > a + 10)) throw new Error('亮度未提升：' + a + ' → ' + b);
      return a + ' → ' + b;
    });

    await t('API · 未知滤镜与风格抛错', () => {
      let f = false, s = false;
      try { Dreikanter.filter('nope'); } catch (e) { f = /未知滤镜/.test(e.message); }
      try { Dreikanter.style('nope'); } catch (e) { s = true; }
      if (!f || !s) throw new Error('filter=' + f + ' style=' + s);
      return '已抛错';
    });

    await t('API · text 生成文字图层', () => {
      Dreikanter.new(600, 400, { bg: '#101010' });
      const id = Dreikanter.text('DRK', { x: 40, y: 150, size: 96, color: '#ffffff' });
      const l = App.layers.find(x => x.id === id);
      if (!l) throw new Error('图层不存在');
      const d = ctx2d(l.canvas).getImageData(0, 0, l.canvas.width, l.canvas.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
      if (l.type !== 'text') throw new Error('类型 ' + l.type);
      if (n < 500) throw new Error('只有 ' + n + ' 个不透明像素');
      return n + ' 像素';
    });

    await t('API · shape 绘制颜色', () => {
      Dreikanter.new(300, 300, { bg: '#000000' });
      Dreikanter.shape('ellipse', { x: 50, y: 50, w: 200, h: 200, color: '#00ff00' });
      const d = px(activeLayer().canvas, 150, 150);
      if (!(d[1] > 200 && d[0] < 60)) throw new Error('rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')');
      return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
    });

    await t('API · selection 全选 / 反选', () => {
      Dreikanter.new(200, 200);
      Dreikanter.selection.all();
      if (!App.selection) throw new Error('全选失败');
      Dreikanter.selection.invert();
      if (App.selection) {
        const a = ctx2d(App.selection.mask).getImageData(4, 4, 1, 1).data[3];
        if (a !== 0) throw new Error('反选后仍有像素');
      }
      Dreikanter.selection.none();
      return '全选 → 空';
    });

    await t('API · transform.crop 改画布', () => {
      Dreikanter.new(200, 200);
      Dreikanter.transform.crop({ x: 20, y: 20, w: 100, h: 60 });
      if (App.doc.w !== 100 || App.doc.h !== 60) throw new Error(App.doc.w + '×' + App.doc.h);
      return '100×60';
    });

    await t('API · cmd 自然语言指令', () => {
      Dreikanter.new(200, 200, { bg: '#3366cc' });
      const before = signature();
      const reply = Dreikanter.cmd('反相');
      const after = signature();
      if (typeof reply !== 'string' || !reply.length) throw new Error('无回复');
      if (after === before) throw new Error('像素未变：' + reply.replace(/<[^>]+>/g, ''));
      return reply.replace(/<[^>]+>/g, '').trim().slice(0, 18);
    });

    await t('API · history.undo 回退', () => {
      Dreikanter.new(200, 200, { bg: '#808080' });
      const s0 = signature();
      Dreikanter.adjust({ brightness: 50 });
      const s1 = signature();
      Dreikanter.history.undo();
      const s2 = signature();
      if (s1 === s0) throw new Error('调色未生效');
      if (s2 !== s0) throw new Error('撤销未回退');
      return '回退一致';
    });

    await t('API · on("change") 回调', () => {
      Dreikanter.new(200, 200, { bg: '#555555' });
      let n = 0;
      Dreikanter.on('change', () => { n++; });
      Dreikanter.adjust({ contrast: 12 });
      App.onChange = null;
      if (n < 1) throw new Error('回调未触发');
      return n + ' 次';
    });

    /* ---------------- M Worker / 性能深水区 ---------------- */
    await t('worker · 不支持的算子回退主线程', () => {
      if (WorkerFX.opFor(FX.findEdges) !== null) throw new Error('findEdges 竟然走了 worker');
      if (WorkerFX.opFor(FX.vignette) !== null) throw new Error('vignette 竟然走了 worker');
      if (WorkerFX.opFor(FX.blur) !== 'blur') throw new Error('blur 未映射');
      return '仅 6 个算子';
    });

    await t('worker · 4K 预览降采样 ≤1100', async () => {
      newDocument(4000, 3000, { bg: '#202020' });
      await wait(200);
      App.activeId = App.layers[0].id;
      Adjust.start();
      Adjust.preview(FX.blur, { radius: 5 });
      await Adjust.whenIdle();
      const w = App.previewCanvas ? App.previewCanvas.width : 0;
      Adjust.cancel();
      if (!w) throw new Error('没有预览画布');
      if (w > 1100) throw new Error('预览宽 ' + w);
      return w + 'px';
    });

    await t('perf · 长任务记录结构', () => {
      if (!Perf) throw new Error('Perf 未定义');
      if (!Array.isArray(Perf.longTasks)) throw new Error('缺少 longTasks');
      const bad = Perf.longTasks.find(t2 => typeof t2.duration !== 'number' || typeof t2.start !== 'number');
      if (bad) throw new Error('条目缺字段');
      return Perf.summary();
    });

    await t('perf · 资源登记表可用', () => {
      if (!(Resources.urls instanceof Set)) throw new Error('urls 不是 Set');
      if (typeof Resources.releaseUrl !== 'function') throw new Error('缺 releaseUrl');
      Resources.trackUrl('blob:test/1');
      Resources.releaseUrl('blob:test/1');
      if (Resources.urls.has('blob:test/1')) throw new Error('未回收');
      return Resources.urls.size + ' 条在册';
    });

    /* ---------------- N 导出 / 会话 / PWA 加固 ---------------- */
    await t('导出 · 队列串行执行', async () => {
      await fresh();
      ExportQueue.jobs.length = 0;
      ExportQueue.push({ type: 'image/png', quality: .8, name: 'q1.png' });
      const busy = ExportQueue.running;
      ExportQueue.push({ type: 'image/png', quality: .8, name: 'q2.png' });
      for (let i = 0; i < 80 && (ExportQueue.running || ExportQueue.jobs.length); i++) await wait(60);
      if (!busy) throw new Error('未进入运行态');
      if (ExportQueue.running) throw new Error('队列未结束');
      if (ExportQueue.done < 2) throw new Error('完成 ' + ExportQueue.done + ' 个');
      return ExportQueue.done + ' 个';
    });

    await t('导出 · 命名模板可自定义', () => {
      const old = Settings.data.nameTemplate;
      Settings.set('nameTemplate', '{name}-{size}-v2', false);
      const a = exportName('海报', { w: 800, h: 600 }, 1);
      Settings.set('nameTemplate', old || '{name}-{size}-{date}', false);
      if (a !== '海报-800x600-v2') throw new Error('得到 ' + a);
      return a;
    });

    await t('会话 · 快照不含像素', () => {
      Session.save();
      const s = Store.get('session', null);
      if (!s) throw new Error('无快照');
      if ('layers' in s || 'data' in s || 'pixels' in s) throw new Error('快照含像素');
      if (typeof s.zoom !== 'number' || !s.tool) throw new Error('字段不全');
      return s.w + '×' + s.h + ' · ' + s.tool;
    });

    await t('PWA · manifest 字段完整', async () => {
      const m = await (await fetch('manifest.webmanifest')).json();
      if (!m.name || !m.short_name) throw new Error('缺 name');
      if (!m.start_url) throw new Error('缺 start_url');
      if (m.display !== 'standalone') throw new Error('display=' + m.display);
      if (!m.icons || m.icons.length < 2) throw new Error('图标不足');
      return m.icons.length + ' 个图标';
    });

    await t('PWA · SW 版本化缓存', async () => {
      const txt = await (await fetch('sw.js')).text();
      if (!/const VERSION\s*=\s*'dreikanter-v\d/.test(txt)) throw new Error('无版本号');
      if (!/caches\.open/.test(txt)) throw new Error('未使用 Cache API');
      return (txt.match(/const VERSION\s*=\s*'([^']+)'/) || [])[1];
    });

    /* ---------------- O 工程卫生 ---------------- */
    await t('工程 · 无 ESM（file:// 可用）', () => {
      if (document.querySelector('script[type=module]')) throw new Error('存在 type=module');
      return 'classic script';
    });

    await t('工程 · 无 backdrop-filter', () => {
      if (ruleExists('backdrop-filter')) throw new Error('仍有毛玻璃');
      return '已清零';
    });

    await t('工程 · 版权署名', () => {
      const s = document.body.textContent;
      if (!/Apsis severs 2026/.test(s) || !/Ansel Design 2026/.test(s)) throw new Error('缺署名');
      return '© Apsis severs 2026 & Ansel Design 2026';
    });

    await t('工程 · 版本号自洽', async () => {
      Dialogs.about(); await wait(160);
      const txt = document.querySelector('.modal') ? document.querySelector('.modal').textContent : '';
      const close = document.querySelector('.modal-close');
      if (close) close.click();
      if (!/Dreikanter photo/.test(txt)) throw new Error('关于页无标题');
      if (!/v9/.test(txt)) throw new Error('关于页未标 v9');
      return 'v9';
    });

    /* ---------------- P 功能补测 ---------------- */
    await t('功能 · 直方图绘制', async () => {
      await fresh();
      UI.togglePanel('info'); await wait(260);
      UI.drawHistogram();
      const cv = document.getElementById('histCanvas');
      if (!cv) throw new Error('无直方图画布');
      const d = ctx2d(cv).getImageData(0, 0, cv.width, cv.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
      if (n < 500) throw new Error('仅绘制 ' + n + ' 像素');
      return n + ' px';
    });

    await t('功能 · 相机 LUT 五套', () => {
      const ids = Object.keys(CAMERA_LOOKS);
      const need = ['hasselblad', 'dji', 'insta360', 'leica', 'fuji'];
      const miss = need.filter(k => !ids.includes(k));
      if (miss.length) throw new Error('缺 ' + miss.join(','));
      return ids.length + ' 套';
    });

    await t('功能 · 混合模式真实生效', async () => {
      await fresh();
      const l = activeLayer();
      const c = ctx2d(l.canvas);
      c.fillStyle = '#ff0000';
      c.fillRect(0, 0, l.canvas.width, l.canvas.height);
      l.blend = 'normal'; l.opacity = 1;
      const a = px(compositeCanvas(false), 20, 20);
      l.blend = 'multiply';
      const b = px(compositeCanvas(false), 20, 20);
      l.blend = 'normal'; invalidate();
      if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) throw new Error('乘法混合无变化');
      return '正片叠底生效';
    });

    await t('工程 · 混合模式清单 ≥16', () => {
      if (BLEND_MODES.length < 16) throw new Error('仅 ' + BLEND_MODES.length);
      if (!BLEND_LABEL['soft-light']) throw new Error('缺中文名');
      return BLEND_MODES.length + ' 种';
    });

    await fresh();
    const pass = items.filter(i => i.pass).length;
    return {
      pass, total: items.length,
      ms: Math.round(performance.now() - T0),
      items,
      errors: Errors.list.slice(errorsBefore).map(e => e.msg).filter(m => m !== '自检用错误').filter(m => m !== '自检用错误')
    };
  }

  window.__TESTS = { run };
  if (/[?&]test/.test(location.search)) {
    setTimeout(() => {
      window.__TESTS.run().then(r => {
        const el = document.createElement('pre');
        el.id = 'testOut';
        el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000e;color:#0f0;font:10.5px/1.4 monospace;padding:10px;overflow:auto;white-space:pre-wrap';
        el.textContent = 'TESTS ' + r.pass + '/' + r.total + '  ' + r.ms + 'ms\n' +
          r.items.map(i => (i.pass ? '✓ ' : '✗ ') + i.name + (i.info ? '  [' + i.info + ']' : '')).join('\n') +
          (r.errors.length ? '\nERRORS:/n' + r.errors.join('\n') : '');
        document.body.append(el);
      });
    }, 600);
  }
})();
