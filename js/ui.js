/* ==========================================================================
   Dreikanter photo — ui.js
   菜单栏 / 工具栏 / 选项栏 / 面板 / 状态栏 / 快捷键
   ========================================================================== */
'use strict';

/* 指令面板置顶的常用指令 */
const PINNED = ['style.film', 'img.crop169', 'adj.lightup', 'fx.vignette', 'adj.invert', 'txt.title', 'layer.new', 'file.png'];

const MENUS = [
  {
    label: '文件', items: [
      { label: '新建…', key: 'Ctrl N', fn: () => Dialogs.newDoc() },
      { label: '打开照片…', key: 'Ctrl O', fn: () => openFilePicker(false) },
      { label: '置入为图层…', fn: () => openFilePicker(true) },
      { sep: 1 },
      { label: '新建存档（快照）', key: 'Ctrl Shift S', fn: () => Archives.create() },
      { label: '还原最近存档', fn: () => Archives.restoreLatest() },
      { sep: 1 },
      { label: '导出为 PNG', key: 'Ctrl S', fn: () => exportImage('image/png') },
      { label: '导出为 JPEG…', fn: () => Dialogs.exportDoc('image/jpeg') },
      { label: '导出为 WEBP…', fn: () => Dialogs.exportDoc('image/webp') },
      { label: '批量处理多张照片…', fn: () => Dialogs.batch() },
      { label: '导出当前视图…', fn: () => exportViewport() },
      { sep: 1 },
      { label: '返回主页', key: 'Esc', fn: () => showWelcome() },
      { label: '关闭图像', key: 'Ctrl W', fn: () => Dialogs.closeDoc() }
    ]
  },
  {
    label: '编辑', items: [
      { label: '撤销', key: 'Ctrl Z', fn: () => History.undo() },
      { label: '重做', key: 'Ctrl Shift Z', fn: () => History.redo() },
      { sep: 1 },
      { label: '拷贝合并图层', fn: () => copyComposite() },
      { label: '粘贴为图层', key: 'Ctrl V', fn: () => pasteFromClipboard() },
      { sep: 1 },
      { label: '填充前景色', key: 'Alt ⌫', fn: () => fillSelection(App.fg) },
      { label: '填充背景色', key: 'Ctrl ⌫', fn: () => fillSelection(App.bg) },
      { sep: 1 },
      { label: '拾色器…', fn: () => Dialogs.color(App.fg, c => { App.fg = c; UI.syncColors(); }) },
      { sep: 1 },
      { label: '首选项 / 重置工作区', fn: () => Dialogs.prefs() }
    ]
  },
  {
    label: '图像', items: [
      { label: '图像大小…', key: 'Ctrl Alt I', fn: () => Dialogs.imageSize() },
      { label: '画布大小…', key: 'Ctrl Alt C', fn: () => Dialogs.canvasSize() },
      { sep: 1 },
      { label: '旋转 90° 顺时针', fn: () => rotateDoc(90) },
      { label: '旋转 90° 逆时针', fn: () => rotateDoc(-90) },
      { label: '旋转 180°', fn: () => rotateDoc(180) },
      { label: '水平翻转画布', fn: () => flipDoc(true) },
      { label: '垂直翻转画布', fn: () => flipDoc(false) },
      { sep: 1 },
      { label: '裁剪到选区', fn: () => cropToSelection() },
      { label: '裁切透明边缘', fn: () => trimTransparent() }
    ]
  },
  {
    label: '图层', items: [
      { label: '新建图层', key: 'Ctrl Shift N', fn: () => { History.begin('新建图层', []); addLayer(); History.end(); } },
      { label: '复制图层', key: 'Ctrl J', fn: () => duplicateLayer(App.activeId) },
      { label: '图层样式…', fn: () => Dialogs.layerStyle() },
      { label: '删除图层', fn: () => deleteLayer(App.activeId) },
      { sep: 1 },
      { label: '向下合并', key: 'Ctrl E', fn: () => mergeDown(App.activeId) },
      { label: '拼合图像', fn: () => flattenImage() },
      { sep: 1 },
      { label: '上移一层', key: 'Ctrl ]', fn: () => reorderLayer(App.activeId, 1) },
      { label: '下移一层', key: 'Ctrl [', fn: () => reorderLayer(App.activeId, -1) }
    ]
  },
  {
    label: '选择', items: [
      { label: '全选', key: 'Ctrl A', fn: () => selectAll() },
      { label: '取消选择', key: 'Ctrl D', fn: () => deselect() },
      { label: '反向选择', key: 'Ctrl Shift I', fn: () => invertSelection() },
      { sep: 1 },
      { label: '精修选区（羽化 / 扩展 / 收缩）…', fn: () => Dialogs.refineSelection('feather') },
      { label: '扩展选区…', fn: () => Dialogs.refineSelection('expand') },
      { label: '收缩选区…', fn: () => Dialogs.refineSelection('contract') },
      { sep: 1 },
      { label: '变换选区内容', key: 'Ctrl T', fn: () => Transform.begin() },
      { label: '保存选区', fn: () => saveSelectionSlot() },
      { label: '载入选区…', fn: () => Dialogs.loadSelection() }
    ]
  },
  {
    label: '滤镜', items: [
      { cap: '调整' },
      { label: '亮度 / 对比度…', fn: () => Dialogs.adjustBrightness() },
      { label: '曲线…（RGB / 单通道）', key: 'Ctrl M', fn: () => Dialogs.curves() },
      { label: '色阶…', fn: () => Dialogs.adjustLevels() },
      { label: '曝光度…', fn: () => Dialogs.adjustExposure() },
      { label: '色相 / 饱和度…', fn: () => Dialogs.adjustHSL() },
      { label: '鲜艳度…', fn: () => Dialogs.adjustVibrance() },
      { label: '色温 / 色调…', fn: () => Dialogs.adjustTemp() },
      { label: '黑白…', fn: () => Dialogs.adjustBW() },
      { label: '颜色平衡…', fn: () => Dialogs.adjustBalance() },
      { label: '渐变映射…', fn: () => Dialogs.adjustGradientMap() },
      { label: '反相', key: 'Ctrl I', fn: () => applyFilterDirect(FX.invert, {}, '反相') },
      { label: '阈值…', fn: () => Dialogs.adjustThreshold() },
      { label: '色调分离…', fn: () => Dialogs.adjustPosterize() },
      { sep: 1 },
      { cap: '相机 LUT' },
      { label: '哈苏 · 自然通透', fn: () => applyFilterDirect(FX.cameraLook, { look: 'hasselblad', intensity: 100 }, 'LUT 哈苏') },
      { label: '大疆 · 干净青调', fn: () => applyFilterDirect(FX.cameraLook, { look: 'dji', intensity: 100 }, 'LUT 大疆') },
      { label: '影石 · 运动浓彩', fn: () => applyFilterDirect(FX.cameraLook, { look: 'insta360', intensity: 100 }, 'LUT 影石') },
      { label: '徕卡 · 浓郁红调', fn: () => applyFilterDirect(FX.cameraLook, { look: 'leica', intensity: 100 }, 'LUT 徕卡') },
      { label: '富士 · 经典铬', fn: () => applyFilterDirect(FX.cameraLook, { look: 'fuji', intensity: 100 }, 'LUT 富士') },
      { label: '相机 LUT…（可调强度）', fn: () => Dialogs.cameraLut() },
      { label: '预设…（LUT + 曲线 + 调整）', key: 'Ctrl P', fn: () => Dialogs.presets() },
      { label: '局部调整 · 线性渐变…', fn: () => LocalAdj.begin('linear') },
      { label: '局部调整 · 径向渐变…', fn: () => LocalAdj.begin('radial') },
      { label: '导入 .cube LUT…', fn: () => Dialogs.cubeLut() },
      { label: '自动白平衡', fn: () => applyFilterDirect(FX.autoWhiteBalance, { strength: 100 }, '自动白平衡') },
      { sep: 1 },
      { cap: '模糊与锐化' },
      { label: '高斯模糊…', fn: () => Dialogs.fxBlur() },
      { label: '动感模糊…', fn: () => Dialogs.fxMotionBlur() },
      { label: '锐化…', fn: () => Dialogs.fxSharpen() },
      { label: '发光…', fn: () => Dialogs.fxGlow() },
      { sep: 1 },
      { cap: '纹理与风格' },
      { label: '添加杂色…', fn: () => Dialogs.fxNoise() },
      { label: '胶片颗粒…', fn: () => Dialogs.fxGrain() },
      { label: '像素化…', fn: () => Dialogs.fxPixelate() },
      { label: '暗角…', fn: () => Dialogs.fxVignette() },
      { label: '褪色…', fn: () => Dialogs.fxFade() },
      { label: '浮雕', fn: () => applyFilterDirect(FX.emboss, {}, '浮雕') },
      { label: '查找边缘', fn: () => applyFilterDirect(FX.findEdges, {}, '查找边缘') }
    ]
  },
  {
    label: '视图', items: [
      { label: '放大', key: 'Ctrl +', fn: () => setZoom(App.view.zoom * 1.25) },
      { label: '缩小', key: 'Ctrl -', fn: () => setZoom(App.view.zoom / 1.25) },
      { label: '适合屏幕', key: 'Ctrl 0', fn: () => fitView() },
      { label: '实际像素 100%', key: 'Ctrl 1', fn: () => setZoom(1) },
      { sep: 1 },
      { label: '标尺单位：切换 px / mm / in / % / pt', fn: () => Guides.cycleUnit() },
      { label: '参考线 / 网格 / 标尺…', fn: () => Guides.settings() },
      { label: '新建参考线…', fn: () => Guides.menuNew() },
      { sep: 1 },
      { label: '显示 / 隐藏网格', key: "Ctrl '", fn: () => { App.showGrid = !App.showGrid; invalidateOverlay(); toast(App.showGrid ? '已显示网格' : '已隐藏网格'); } },
      { label: '显示 / 隐藏参考线', key: 'Ctrl ;', fn: () => Guides.toggleShow() },
      { label: '锁定参考线', fn: () => Guides.toggleLock() },
      { label: '显示 / 隐藏标尺', key: 'Ctrl R', fn: () => { Guides.showRulers = !Guides.showRulers; Guides.save(); Guides.applyVisibility(); layoutFrame(); invalidate(); } },
      { label: '移动时吸附参考线', fn: () => { Guides.snap = !Guides.snap; Guides.save(); toast(Guides.snap ? '已开启参考线吸附' : '已关闭参考线吸附'); } },
      { label: '吸附到网格', fn: () => { Guides.snapGrid = !Guides.snapGrid; Guides.save(); toast(Guides.snapGrid ? '已开启网格吸附' : '已关闭网格吸附'); } },
      { label: '清除全部参考线', fn: () => Guides.clear() },
      { sep: 1 },
      { label: '沉浸模式', key: 'Ctrl Shift F', fn: () => Settings.toggleImmersive() },
    ]
  },
  {
    label: '窗口', items: [
      { label: '个性化…', key: 'Ctrl ,', fn: () => Settings.open() },
      { label: '命令面板…', key: 'Ctrl K', fn: () => UI.openPalette() },
      { label: '指令面板', fn: () => UI.togglePanel('commands') },
      { label: 'API 控制台', fn: () => UI.togglePanel('api') },
      { sep: 1 },
      { label: 'Photoshop 模式', fn: () => setMode('ps') },
      { label: 'Apsis 模式', fn: () => setMode('apsis') }
    ]
  },
  {
    label: '帮助', items: [
      { label: '快捷键一览', fn: () => Dialogs.shortcuts() },
      { label: '导出错误日志', fn: () => Errors.export() },
      { label: '关于 Dreikanter photo', fn: () => Dialogs.about() }
    ]
  }
];

const UI = {
  openPanels: {},

  init() {
    this.buildMenubar();
    this.buildToolrail();
    this.buildPanels();
    this.bindTop();
    this.bindStatus();
    this.bindKeys();
    this.bindDrop();
    this.bindWelcome();
    this.renderOptions();
    this.markTool();
    this.syncColors();
    this.renderRecent();
    this.afterChange();
    Tools.updateCursor();

    /* 光标取色读数 */
    let _pickT = 0;
    const ovEl = $('#overlay');
    if (ovEl) {
      ovEl.addEventListener('pointermove', e => {
        const now = performance.now();
        if (now - _pickT < 80) return;
        _pickT = now;
        UI.updatePick(screenToDoc(e.clientX, e.clientY));
      });
      ovEl.addEventListener('pointerleave', () => {
        const el = $('#pickReadout');
        if (el) el.textContent = '光标 —';
      });
    }
  },

  /* ---------------- 菜单 ---------------- */
  buildMenubar() {
    const bar = $('#menubar');
    bar.innerHTML = '';
    MENUS.forEach(m => {
      const pop = h('div', { class: 'menu-pop' });
      m.items.forEach(it => {
        if (it.sep) { pop.append(h('div', { class: 'menu-sep' })); return; }
        if (it.cap) { pop.append(h('div', { class: 'menu-cap' }, it.cap)); return; }
        pop.append(h('button', {
          class: 'menu-item',
          onclick: () => { closeAllMenus(); it.fn(); }
        }, h('span', { class: 'mi-label' }, it.label), it.key ? h('span', { class: 'mi-key' }, it.key) : ''));
      });
      const root = h('div', { class: 'menu-root' },
        h('button', {
          onclick: e => {
            e.stopPropagation();
            const open = root.classList.contains('open');
            closeAllMenus();
            if (!open) root.classList.add('open');
          },
          onmouseenter: e => {
            if ($$('.menu-root.open').length && !root.classList.contains('open')) {
              closeAllMenus(); root.classList.add('open');
            }
          }
        }, m.label),
        pop
      );
      bar.append(root);
    });
    document.addEventListener('click', closeAllMenus);

    /* 菜单键盘导航（文档级：焦点在菜单项时也能响应） */
    document.addEventListener('keydown', e => {
      const open = document.querySelector('.menu-root.open');
      if (!open) return;
      const items2 = [...open.querySelectorAll('.menu-item')];
      if (!items2.length) return;
      const i = items2.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items2[(i + 1) % items2.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items2[(i - 1 + items2.length) % items2.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items2[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items2[items2.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeAllMenus(); }
    });
    /* 菜单按钮：↓ 展开并聚焦第一项 */
    $$('.menu-root > button').forEach(btn => {
      btn.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown') return;
        e.preventDefault();
        const root = btn.parentElement;
        closeAllMenus();
        root.classList.add('open');
        const f = root.querySelector('.menu-item');
        if (f) f.focus();
      });
    });
  },

  /* ---------------- 工具栏 ---------------- */
  buildToolrail() {
    const rail = $('#toolrail');
    rail.innerHTML = '';
    const grid = h('div', { class: 'tool-grid' });
    const conf = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : null;
    let order = conf ? Settings.orderFor('tool') : ['move', 'marquee', 'ellipse', 'lasso', 'wand', 'crop', 'picker', 'brush', 'eraser', 'bucket', 'gradient', 'blur', 'dodge', 'burn', 'clone', 'text', 'shape', 'hand', 'zoom'];
    if (conf) order = order.filter(n => !conf.hiddenTools.includes(n));
    const isz = (conf && conf.iconSize) || 16;
    order.forEach(name => {
      const d = Tools.defs[name];
      const btn = h('button', {
        class: 'tool-btn', dataset: { tool: name }, title: `${d.label} (${d.key})`,
        onclick: () => Tools.setTool(name)
      }, h('span', { html: icon(d.icon, isz) }));
      if (name === 'ellipse' || name === 'burn' || name === 'gradient') btn.classList.add('has-variant');
      grid.append(btn);
    });
    rail.append(grid);
    rail.append(h('div', { class: 'rail-sep' }));

    const sw = h('div', { class: 'rail-swatches', title: '前景色 / 背景色（X 交换，D 复位）' },
      h('div', { class: 'sw sw-fg', id: 'railFg' }, h('input', { type: 'color', id: 'railFgInput', oninput: e => { App.fg = e.target.value; UI.syncColors(); } })),
      h('div', { class: 'sw sw-bg', id: 'railBg' }, h('input', { type: 'color', id: 'railBgInput', oninput: e => { App.bg = e.target.value; UI.syncColors(); } })),
      h('button', { class: 'sw-reset', title: '复位黑白', onclick: () => { App.fg = '#ffffff'; App.bg = '#111111'; UI.syncColors(); } }, '◧')
    );
    rail.append(sw);

    const zoomBox = h('div', { class: 'rail-sep' });
    rail.append(zoomBox);
    rail.append(h('button', {
      class: 'tool-btn', title: '适合屏幕 (Ctrl+0)', onclick: () => fitView(),
      style: { marginTop: '2px' }, html: icon('target', 16)
    }));
  },

  markTool() {
    $$('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === Tools.current));
    if (typeof A11y !== 'undefined') A11y.sync();
  },

  syncColors() {
    const set = (id, v) => { const e = $(id); if (e) { e.value = v; if (e.parentElement && e.parentElement.classList.contains('sw')) e.parentElement.style.background = v; } };
    set('#railFgInput', App.fg); set('#railBgInput', App.bg);
    const fg = $('#railFg'), bg = $('#railBg');
    if (fg) fg.style.background = App.fg;
    if (bg) bg.style.background = App.bg;
    $$('.color-chip input[type=color]').forEach(i => i.value = App.fg);
    const hex = $('#colorHex'); if (hex) hex.value = App.fg.toUpperCase();
    const c = hexToRgb(App.fg);
    const sr = $('#colorR'), sg = $('#colorG'), sb = $('#colorB');
    if (sr) sr.value = c.r;
    if (sg) sg.value = c.g;
    if (sb) sb.value = c.b;
    const hsl = rgbToHsl(c.r, c.g, c.b);
    const sh = $('#colorH'), ss = $('#colorS'), sl = $('#colorL');
    if (sh) sh.value = Math.round(hsl.h);
    if (ss) ss.value = Math.round(hsl.s * 100);
    if (sl) sl.value = Math.round(hsl.l * 100);
    const chip = $('#colorChip'); if (chip) chip.style.background = App.fg;
    const bchip = $('#colorChipBg'); if (bchip) bchip.style.background = App.bg;
  },

  renderRecent() {
    const row = $('#recentRow');
    if (!row) return;
    const wrap = $('#recentWrap');
    row.innerHTML = '';
    const list = (App.recent || []).slice(0, 12);
    if (wrap) wrap.style.display = list.length ? 'flex' : 'none';
    if (!list.length) return;
    list.forEach(c => {
      row.append(h('button', {
        class: 'recent-swatch', style: { background: c }, title: c.toUpperCase(),
        onclick: e => { if (e.shiftKey) App.bg = c; else App.fg = c; UI.syncColors(); }
      }));
    });
  },

  /* ---------------- 选项栏 ---------------- */
  renderOptions() {
    const bar = $('#optionsbar');
    if (!bar) return;
    bar.innerHTML = '';
    /* 自由变换：临时接管选项栏 */
    if (typeof Transform !== 'undefined' && Transform.active) {
      this.renderTransformBar(bar);
      return;
    }
    const d = Tools.defs[App.tool];
    if (!d) return;
    bar.append(h('div', { class: 'opt-tool' }, h('span', { html: icon(d.icon, 15) }), h('span', {}, d.label)));
    bar.append(h('div', { class: 'opt-div' }));

    (d.opts || []).forEach(o => bar.append(this.buildOpt(o)));

    if (!d.opts || !d.opts.length) bar.append(h('span', { class: 'opt-label' }, '在画布上直接操作'));

    bar.append(h('div', { class: 'opt-spacer' }));

    if (App.tool === 'crop') {
      bar.append(h('button', { class: 'opt-btn primary', id: 'cropApply', onclick: () => { if (App.cropRect) cropToRect(App.cropRect, App.cropAngle); } }, '应用裁剪'));
      bar.append(h('button', { class: 'opt-btn', onclick: () => { App.cropRect = null; invalidateOverlay(); UI.syncCropButtons(); } }, '取消'));
    }
    if (App.tool === 'zoom') {
      bar.append(h('span', { class: 'opt-label' }, '当前 ' + Math.round(App.view.zoom * 100) + '%'));
      bar.append(h('button', { class: 'opt-btn', onclick: () => fitView() }, '适合屏幕'));
    }
    if (App.tool === 'brush' || App.tool === 'eraser') {
      bar.append(h('button', {
        class: 'opt-btn', onclick: () => { Tools.state[App.tool].hardness = 100; UI.renderOptions(); }
      }, '硬边'));
      bar.append(h('button', {
        class: 'opt-btn', onclick: () => { Tools.state[App.tool].hardness = 0; UI.renderOptions(); }
      }, '柔边'));
    }
    this.syncCropButtons();
  },

  renderTransformBar(bar) {
    const T = Transform;
    bar.append(h('div', { class: 'opt-tool' }, h('span', { html: icon('crop', 15) }), h('span', {}, T.target === 'selection' ? '变换选区' : '自由变换')));
    bar.append(h('div', { class: 'opt-div' }));
    const mk = (label, key, unit, onChange) => {
      const inp = h('input', {
        type: 'number', value: Math.round(key === 'w' ? T.box.w : key === 'h' ? T.box.h : T.angle),
        step: 1, id: 'tf' + (key === 'w' ? 'W' : key === 'h' ? 'H' : 'A'),
        oninput: e => { onChange(parseFloat(e.target.value) || 0); T.render(); }
      });
      return h('div', { class: 'opt-group' }, h('span', { class: 'opt-label' }, label),
        h('div', { class: 'opt-field' }, inp, h('span', { class: 'suffix' }, unit)));
    };
    bar.append(mk('W', 'w', 'px', v => T.setSize(clamp(v, 1, 20000), T.box.h, T.ratio)));
    bar.append(mk('H', 'h', 'px', v => T.setSize(T.box.w, clamp(v, 1, 20000), T.ratio)));
    bar.append(mk('角度', 'a', '°', v => { T.angle = v; }));
    const lock = h('button', {
      class: 'opt-btn' + (T.ratio ? ' primary' : ''), title: '锁定比例',
      onclick: () => { T.ratio = !T.ratio; UI.renderOptions(); }
    }, T.ratio ? '比例锁定' : '自由比例');
    bar.append(lock);
    bar.append(h('button', {
      class: 'opt-btn', title: '重置',
      onclick: () => { T.box = { ...T.orig }; T.angle = 0; T.skewX = 0; T.skewY = 0; T.render(); UI.renderOptions(); }
    }, '重置'));
    bar.append(h('div', { class: 'opt-spacer' }));
    bar.append(h('button', { class: 'opt-btn primary', onclick: () => T.commit() }, '提交 ⏎'));
    bar.append(h('button', { class: 'opt-btn', onclick: () => T.cancel() }, '取消 Esc'));
    bar.append(h('span', { class: 'opt-label', style: { marginLeft: '8px', opacity: '.7' } }, 'Shift 等比 / 15° 吸附 · Ctrl 拖边斜切'));
  },

  buildOpt(o) {
    const val = Tools.state[App.tool][o.key];
    const fire = v => { if (o.onChange) o.onChange(v); };
    if (o.type === 'number') {
      const inp = h('input', {
        type: 'number', id: 'opt-' + o.key, value: val, min: o.min, max: o.max, step: o.step || 1,
        onchange: e => {
          let v = clamp(parseFloat(e.target.value) || 0, o.min, o.max);
          Tools.state[App.tool][o.key] = v;
          e.target.value = v;
          if (App.brushCursor) invalidateOverlay();
          fire(v);
        },
        oninput: e => {
          const v = clamp(parseFloat(e.target.value) || 0, o.min, o.max);
          Tools.state[App.tool][o.key] = v;
        }
      });
      return h('div', { class: 'opt-group' },
        h('span', { class: 'opt-label' }, o.label),
        h('div', { class: 'opt-field' }, inp, h('span', { class: 'suffix' }, o.unit || '')));
    }
    if (o.type === 'range') {
      const out = h('span', { class: 'opt-val', id: 'opt-' + o.key + '-val' }, String(val));
      const inp = h('input', {
        type: 'range', class: 'opt-range', id: 'opt-' + o.key,
        min: o.min, max: o.max, step: o.step || 1, value: val,
        oninput: e => {
          const v = clamp(parseFloat(e.target.value) || 0, o.min, o.max);
          Tools.state[App.tool][o.key] = v;
          out.textContent = v;
          fire(v);
        }
      });
      return h('div', { class: 'opt-group' },
        h('span', { class: 'opt-label' }, o.label),
        h('div', { class: 'opt-field range' }, inp, out));
    }
    if (o.type === 'select') {
      const sel = h('select', {
        class: 'opt-select', id: 'opt-' + o.key,
        onchange: e => { Tools.state[App.tool][o.key] = e.target.value; fire(e.target.value); }
      }, ...o.options.map(([v, l]) => h('option', { value: v, selected: v === val }, l)));
      return h('div', { class: 'opt-group' }, h('span', { class: 'opt-label' }, o.label), sel);
    }
    if (o.type === 'check') {
      return h('label', { class: 'opt-check' },
        h('input', {
          type: 'checkbox', id: 'opt-' + o.key, checked: !!val,
          onchange: e => { Tools.state[App.tool][o.key] = e.target.checked; fire(e.target.checked); }
        }), o.label);
    }
    if (o.type === 'modes') {
      /* 选区模式：新建 / 加 / 减 / 相交 */
      const wrap = h('div', { class: 'opt-modes', role: 'group', 'aria-label': o.label });
      (o.options || []).forEach(([v, label, iconName]) => {
        const b = h('button', {
          class: 'opt-mode' + (val === v ? ' on' : ''), title: label, 'aria-label': label,
          html: icon(iconName, 13),
          onclick: () => {
            Tools.state[App.tool][o.key] = v;
            [...wrap.children].forEach(c => c.classList.toggle('on', c === b));
            fire(v);
          }
        });
        wrap.append(b);
      });
      return h('div', { class: 'opt-group' }, h('span', { class: 'opt-label' }, o.label), wrap);
    }
    return '';
  },

  syncCropButtons() {
    const b = $('#cropApply');
    if (b) b.disabled = !App.cropRect;
  },

  /* ---------------- 面板 ---------------- */
  panel(id, title, iconName, bodyBuilder, collapsed, badge) {
    const body = h('div', { class: 'panel-body' });
    bodyBuilder(body);
    const saved = Store.get('panelState', {})['panel-' + id];
    const isCollapsed = saved == null ? !!collapsed : !!saved;
    const p = h('div', { class: 'panel' + (isCollapsed ? ' collapsed' : ''), id: 'panel-' + id },
      h('div', {
        class: 'panel-head',
        onclick: e => {
          if (e.target.closest('.panel-head')) {
            p.classList.toggle('collapsed');
            UI.savePanelState();
          }
        }
      },
        h('span', { class: 'ph-ico', html: icon(iconName, 13) }),
        h('span', { class: 'ph-title' }, title),
        badge != null ? h('span', { class: 'ph-badge' }, badge) : '',
        h('span', { class: 'ph-caret', html: icon('chevron', 12) })
      ), body);
    return p;
  },

  buildPanels() {
    const root = $('#panels');
    root.innerHTML = '';
    const all = [
      this.panelColor(),
      this.panelCommands(),
      this.panelArchives(),
      this.panelExport(),
      this.panelLayers(),
      this.panelAdjust(),
      this.panelAPI(),
      this.panelHistory(),
      this.panelInfo()
    ];
    const conf = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : null;
    if (conf) {
      const order = Settings.orderFor('panel');
      all.sort((a, b) => order.indexOf(a.id.replace('panel-', '')) - order.indexOf(b.id.replace('panel-', '')));
    }
    const hidden = conf ? conf.hiddenPanels : [];
    all.forEach(p => {
      const id = p.id.replace('panel-', '');
      if (hidden.includes(id) && id !== 'layers') return;
      root.append(p);
    });
    this.renderCommands('');
  },

  panelExport() {
    return this.panel('exportq', '导出队列', 'download', body => {
      const stateLine = h('div', { class: 'hint', id: 'expState' }, '空闲');
      const bar = h('div', { class: 'exp-bar' });
      const btnPause = h('button', { class: 'btn ghost', style: { flex: '1' }, onclick: () => { ExportQueue.paused ? ExportQueue.resume() : ExportQueue.pause(); UI.renderExportQueue(); } }, '暂停');
      const btnClear = h('button', { class: 'btn ghost', style: { flex: '1' }, onclick: () => { ExportQueue.clearFinished(); UI.renderExportQueue(); } }, '清空已完成');
      bar.append(btnPause, btnClear);
      const list = h('div', { class: 'exp-list', id: 'expQueueList' });
      body.append(stateLine, bar, list);
      this._expList = list;
      this._expPause = btnPause;
      ExportQueue.onChange = () => this.renderExportQueue();
      this.renderExportQueue();
    }, true, '0');
  },

  renderExportQueue() {
    const list = document.getElementById('expQueueList');
    const st = ExportQueue.stats();
    const badge = document.querySelector('#panel-exportq .ph-badge');
    if (badge) badge.textContent = String(st.queued + st.running);
    const stateLine = document.getElementById('expState');
    if (stateLine) {
      stateLine.textContent = ExportQueue.paused
        ? '已暂停 · 排队 ' + st.queued + ' · 完成 ' + st.done
        : ExportQueue.running
          ? '导出中 · 完成 ' + st.done + ' / 失败 ' + st.failed
          : st.queued ? '待开始 · 排队 ' + st.queued : '空闲 · 完成 ' + st.done + ' · 失败 ' + st.failed;
    }
    if (this._expPause) this._expPause.textContent = ExportQueue.paused ? '继续' : '暂停';
    if (!list) return;
    list.innerHTML = '';
    if (!ExportQueue.jobs.length) {
      list.append(h('div', { class: 'hint' }, '队列为空 · 导出（Ctrl S）会自动加入这里，支持暂停 / 重排 / 重试。'));
      return;
    }
    const NAMES = { queued: '排队', running: '导出中', done: '完成', failed: '失败' };
    ExportQueue.jobs.forEach((j, i) => {
      const row = h('div', { class: 'exp-row ' + j.status, 'data-job': j.id },
        h('span', { class: 'exp-dot' }),
        h('div', { class: 'exp-main' },
          h('div', { class: 'exp-name', title: j.name || '' }, j.name || '未命名'),
          h('div', { class: 'exp-meta' }, NAMES[j.status] + (j.tries > 1 ? ' · 重试 ' + (j.tries - 1) : '') + (j.error && j.status === 'failed' ? ' · ' + j.error : ''))
        )
      );
      const acts = h('div', { class: 'exp-acts' });
      if (j.status === 'queued') {
        acts.append(
          h('button', { class: 'icon-btn', title: '上移', html: icon('chevron', 11), style: { transform: 'rotate(180deg)' }, onclick: () => { ExportQueue.move(j.id, -1); UI.renderExportQueue(); } }),
          h('button', { class: 'icon-btn', title: '下移', html: icon('chevron', 11), onclick: () => { ExportQueue.move(j.id, 1); UI.renderExportQueue(); } }),
          h('button', { class: 'icon-btn', title: '取消', html: icon('close', 11), onclick: () => { ExportQueue.cancel(j.id); UI.renderExportQueue(); } })
        );
      } else if (j.status === 'failed') {
        acts.append(h('button', { class: 'icon-btn', title: '重试', html: icon('redo', 11), onclick: () => { ExportQueue.retry(j.id); UI.renderExportQueue(); } }));
      }
      row.append(acts);
      list.append(row);
    });
  },

  panelColor() {
    const swatches = ['#000000', '#ffffff', '#f2f2f2', '#8e8e93', '#4a4a4f', '#1c1c1e',
      '#e5484d', '#f08a24', '#f5d90a', '#46a758', '#12a594', '#3d8ef0',
      '#8e4ec6', '#e93d82', '#8b5e3c', '#e8ddc8', '#c9a227', '#0d3b66',
      '#f4a261', '#2a9d8f', '#264653', '#ffd6e0', '#a8dadc', '#457b9d'];
    return this.panel('color', '颜色', 'palette', body => {
      body.append(
        h('div', { class: 'color-hero' },
          h('div', { class: 'color-chip', id: 'colorChip' }, h('input', { type: 'color', value: App.fg, oninput: e => { App.fg = e.target.value; UI.syncColors(); } })),
          h('div', { class: 'color-meta' },
            h('input', {
              class: 'color-hex', id: 'colorHex', value: App.fg.toUpperCase(), spellcheck: 'false',
              onchange: e => {
                const v = e.target.value.trim();
                if (/^#?[0-9a-f]{6}$/i.test(v)) { App.fg = v.startsWith('#') ? v : '#' + v; UI.syncColors(); pushRecentColor(App.fg); }
                else e.target.value = App.fg.toUpperCase();
              }
            }),
            h('div', { class: 'color-row' },
              h('div', { class: 'color-sq', id: 'colorChipBg', style: { background: App.bg } },
                h('input', { type: 'color', value: App.bg, oninput: e => { App.bg = e.target.value; UI.syncColors(); } })),
              h('button', { class: 'icon-btn', title: '交换前景/背景 (X)', html: icon('flip', 13), onclick: () => { const t = App.fg; App.fg = App.bg; App.bg = t; UI.syncColors(); } }),
              h('button', { class: 'icon-btn', title: '复位 (D)', html: icon('contrast', 13), onclick: () => { App.fg = '#ffffff'; App.bg = '#111111'; UI.syncColors(); } })
            )
          )
        )
      );
      /* HEX / RGB / HSL 数值输入 */
      const tri = (ids, labels, maxes, onSet) => {
        const row = h('div', { class: 'color-nums' });
        ids.forEach((id, i) => {
          const inp = h('input', {
            class: 'color-num', id: id, type: 'number', min: 0, max: maxes[i], step: 1,
            onchange: () => onSet(), oninput: () => onSet()
          });
          row.append(h('label', { class: 'color-num-l' }, labels[i]), inp);
        });
        return row;
      };
      const applyRgb = () => {
        const r = clamp(parseInt(($('#colorR') || {}).value) || 0, 0, 255);
        const g = clamp(parseInt(($('#colorG') || {}).value) || 0, 0, 255);
        const b = clamp(parseInt(($('#colorB') || {}).value) || 0, 0, 255);
        App.fg = rgbToHex(r, g, b);
        UI.syncColors();
      };
      const applyHsl = () => {
        const hh = clamp(parseInt(($('#colorH') || {}).value) || 0, 0, 360);
        const ss = clamp(parseInt(($('#colorS') || {}).value) || 0, 0, 100);
        const ll = clamp(parseInt(($('#colorL') || {}).value) || 0, 0, 100);
        const c = hslToRgb(hh, ss / 100, ll / 100);
        App.fg = rgbToHex(c.r, c.g, c.b);
        UI.syncColors();
      };
      body.append(tri(['colorR', 'colorG', 'colorB'], ['R', 'G', 'B'], [255, 255, 255], applyRgb));
      body.append(tri(['colorH', 'colorS', 'colorL'], ['H', 'S', 'L'], [360, 100, 100], applyHsl));
      body.append(h('div', { class: 'exp-bar' },
        h('button', {
          class: 'btn ghost', style: { flex: '1' },
          onclick: () => {
            const txt = App.fg.toUpperCase() + ' · ' + (function () {
              const c = hexToRgb(App.fg);
              return 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')';
            })();
            navigator.clipboard.writeText(txt).then(() => toast('已复制 ' + txt, 'ok')).catch(() => toast('复制失败', 'err'));
          }
        }, '复制颜色值'),
        h('button', {
          class: 'btn ghost', style: { flex: '0 0 auto' },
          onclick: () => { pushRecentColor(App.fg); toast('已加入最近使用', 'ok'); }
        }, '收藏')));
      const grid = h('div', { class: 'swatch-grid' });
      swatches.forEach(c => grid.append(h('div', {
        class: 'swatch', style: { background: c }, title: c.toUpperCase(),
        onclick: e => {
          if (e.shiftKey) App.bg = c; else App.fg = c;
          UI.syncColors();
          pushRecentColor(c);
        }
      })));
      body.append(grid);
      body.append(h('div', { class: 'recent-wrap', id: 'recentWrap', style: { display: 'none' } },
        h('div', { class: 'recent-label' }, '最近使用'),
        h('div', { class: 'recent-row', id: 'recentRow' })
      ));
      body.append(h('div', { class: 'hint', style: { marginTop: '-2px' } }, 'Shift + 点击 = 背景色'));
    }, false);
  },

  panelAdjust() {
    return this.panel('adjust', '快速调整', 'sliders', body => {
      const defs = [
        { k: 'brightness', label: '亮度', min: -100, max: 100, def: 0 },
        { k: 'contrast', label: '对比度', min: -100, max: 100, def: 0 },
        { k: 'saturation', label: '饱和度', min: -100, max: 100, def: 0 },
        { k: 'temp', label: '色温', min: -100, max: 100, def: 0 }
      ];
      const vals = { brightness: 0, contrast: 0, saturation: 0, temp: 0 };
      let session = false;

      const begin = () => {
        if (session) return;
        if (!Adjust.start()) return;
        session = true;
      };
      const combo = (img, p) => {
        if (p.brightness || p.contrast) FX.brightnessContrast(img, p);
        if (p.saturation) FX.saturation(img, { saturation: p.saturation });
        if (p.temp) FX.temperature(img, { temp: p.temp / 100 });
      };
      const run = () => { Adjust.preview(combo, vals); };
      const commit = () => {
        if (!session) return;
        session = false;
        const any = Object.values(vals).some(v => v !== 0);
        if (!any) { Adjust.cancel(); return; }
        Adjust.commit('快速调整');
        Object.keys(vals).forEach(k => vals[k] = 0);
        rows.forEach(r => r.set(0));
      };

      const rows = defs.map(d => {
        const row = this.sliderRow({
          label: d.label, min: d.min, max: d.max, value: d.def,
          onInput: v => { vals[d.k] = v; begin(); run(); },
          onCommit: commit
        });
        return row;
      });
      rows.forEach(r => body.append(r.el));
      body.append(h('div', { class: 'prop-actions' },
        h('button', {
          class: 'btn ghost', style: { height: '24px', fontSize: '10.5px', padding: '0 10px' },
          onclick: () => { applyFilterDirect((img) => { FX.brightnessContrast(img, { brightness: 4, contrast: 12 }); FX.saturation(img, { saturation: 6 }); }, {}, '自动色调'); }
        }, '自动色调'),
        h('button', {
          class: 'btn ghost', style: { height: '24px', fontSize: '10.5px', padding: '0 10px' },
          onclick: () => Dialogs.adjustLevels()
        }, '色阶…')
      ));
      const styles = h('div', { class: 'suggest-row' });
      ['film', 'mono', 'teal', 'jp'].forEach(id => {
        const s = STYLES.find(x => x.id === id);
        styles.append(h('button', { class: 'chip', onclick: () => applyStyle(id) }, s.name));
      });
      body.append(styles);
    }, true);
  },

  sliderRow({ label, min, max, value, step = 1, onInput, onCommit }) {
    const valEl = h('span', { class: 'val' }, value);
    const inp = h('input', {
      type: 'range', min, max, step, value,
      oninput: e => {
        const v = parseFloat(e.target.value);
        valEl.textContent = v;
        inp.style.setProperty('--p', ((v - min) / (max - min) * 100) + '%');
        onInput && onInput(v);
      },
      onchange: () => onCommit && onCommit()
    });
    inp.style.setProperty('--p', ((value - min) / (max - min) * 100) + '%');
    const el = h('div', { class: 'slider-row' },
      h('div', { class: 'slider-top' }, h('label', {}, label), valEl),
      inp
    );
    return {
      el, input: inp,
      set(v) {
        inp.value = v; valEl.textContent = v;
        inp.style.setProperty('--p', ((v - min) / (max - min) * 100) + '%');
      }
    };
  },

  panelLayers() {
    return this.panel('layers', '图层', 'layers', body => {
      const blendSel = h('select', {
        class: 'opt-select', style: { width: '100%' },
        onchange: e => {
          const l = activeLayer(); if (!l) return;
          History.begin('混合模式', []);
          l.blend = e.target.value;
          History.end(); invalidate(); sync();
        }
      }, ...BLEND_MODES.map(([v, l]) => h('option', { value: v }, l)));

      const opVal = h('span', { class: 'val' }, '100%');
      const opInp = h('input', {
        type: 'range', min: 0, max: 100, value: 100, class: 'opt-range',
        oninput: e => {
          const l = activeLayer(); if (!l) return;
          l.opacity = parseFloat(e.target.value) / 100;
          opVal.textContent = Math.round(l.opacity * 100) + '%';
          invalidate();
        },
        onchange: () => { History.begin('不透明度', []); setTimeout(() => { History.end(); sync(); }, 0); }
      });
      body.append(h('div', { class: 'layer-top' }, blendSel));
      body.append(h('div', { class: 'opacity-line' }, h('span', { class: 'opt-label' }, '不透明度'), h('div', { style: { flex: '1' } }, opInp), opVal));
      const list = h('div', { class: 'layer-list', id: 'layerList' });
      body.append(list);
      body.append(h('div', { class: 'layer-actions' },
        h('button', { class: 'icon-btn', title: '图层样式（描边/投影/发光）', html: icon('sparkles', 13), onclick: () => Dialogs.layerStyle() }),
        h('button', { class: 'icon-btn', title: '新建图层', html: icon('plus', 14), onclick: () => { History.begin('新建图层', []); addLayer(); History.end(); } }),
        h('button', { class: 'icon-btn', title: '复制图层 (Ctrl+J)', html: icon('copy', 14), onclick: () => duplicateLayer(App.activeId) }),
        h('button', { class: 'icon-btn', title: '向下合并 (Ctrl+E)', html: icon('merge', 14), onclick: () => mergeDown(App.activeId) }),
        h('button', { class: 'icon-btn', title: '上移', html: icon('chevron', 13), onclick: () => reorderLayer(App.activeId, 1) }),
        h('button', { class: 'icon-btn', title: '删除图层', html: icon('trash', 14), onclick: () => deleteLayer(App.activeId) })
      ));
      body.append(h('div', { class: 'hint', style: { fontSize: '9px', marginTop: '-2px' } }, '双击重命名 · 右键更多操作'));
      body.append(h('div', { class: 'hint', style: { fontSize: '9px', marginTop: '-2px' } }, '双击重命名 · 右键更多操作'));
      this._blendSel = blendSel; this._opInp = opInp; this._opVal = opVal;
    }, false);
  },

  panelArchives() {
    return this.panel('archives', '存档', 'save', body => {
      body.append(
        h('div', { style: { display: 'flex', gap: '6px' } },
          h('button', {
            class: 'btn primary', style: { height: '25px', fontSize: '10.5px', flex: '1' },
            onclick: () => Archives.create()
          }, '+ 新建存档'),
          h('button', {
            class: 'btn ghost', style: { height: '25px', fontSize: '10.5px' },
            onclick: () => Archives.promptClear()
          }, '清空')
        ),
        h('div', { class: 'arc-list', id: 'arcList' }),
        h('div', { class: 'hint', style: { fontSize: '9.5px' } }, '存档保存在本机，重开浏览器仍在；最多 12 个，超出自动淘汰最旧。')
      );
    }, true, '0');
  },

  savePanelState() {
    const st = {};
    $$('.panel').forEach(p => st[p.id] = p.classList.contains('collapsed'));
    Store.set('panelState', st);
  },

  renderArchives() {
    const list = $('#arcList');
    if (!list) return;
    const badge = $('#panel-archives .ph-badge');
    if (badge) badge.textContent = Archives.list.length;
    list.innerHTML = '';
    if (!Archives.list.length) {
      list.append(h('div', { class: 'arc-empty' }, '还没有存档。点「新建存档」保存当前进度，随时可还原。'));
      return;
    }
    Archives.list.forEach(s => {
      const row = h('div', { class: 'arc-item', title: '双击重命名' },
        h('img', { class: 'arc-thumb', src: s.thumb, alt: '' }),
        h('div', { class: 'arc-meta' },
          h('div', { class: 'arc-name' }, s.name),
          h('div', { class: 'arc-sub' }, `${fmtTime(s.time)} · ${s.layers.length} 层 · ${s.w}×${s.h}`)
        ),
        h('div', { class: 'arc-acts' },
          h('button', { class: 'arc-btn', title: '还原到此存档', html: icon('undo', 12), onclick: e => { e.stopPropagation(); Archives.restore(s.id); } }),
          h('button', { class: 'arc-btn danger', title: '删除存档', html: icon('trash', 12), onclick: e => { e.stopPropagation(); Archives.remove(s.id); } })
        )
      );
      row.addEventListener('dblclick', () => Archives.promptRename(s.id));
      list.append(row);
    });
  },

  panelHistory() {
    return this.panel('history', '历史记录', 'history', body => {
      body.append(h('div', { class: 'history-list', id: 'historyList' }));
    }, true);
  },

  panelCommands() {
    return this.panel('commands', '指令', 'bolt', body => {
      body.append(
        h('div', { class: 'macro-row', id: 'macroRow' }),
        h('input', {
          class: 'cmd-search', id: 'cmdSearch', spellcheck: 'false',
          placeholder: '搜索指令，或输入：胶片感，裁成 16:9',
          oninput: e => UI.renderCommands(e.target.value),
          onkeydown: e => {
            if (e.key === 'Enter') { e.preventDefault(); UI.execCommand(e.target.value); }
            e.stopPropagation();
          }
        }),
        h('div', { class: 'cmd-list', id: 'cmdList' }),
        h('div', { class: 'cmd-result', id: 'cmdResult' }, '共 ' + COMMANDS.length + ' 条指令 · 点击执行，或直接输入中文')
      );
      this.renderMacros();
    }, false);
  },

  renderMacros() {
    const row = $('#macroRow');
    if (!row) return;
    row.innerHTML = '';
    const macros = Store.get('macros', []);
    if (!macros.length) {
      row.append(h('span', { class: 'macro-empty' }, '宏：把常用指令存成按钮'));
    }
    macros.forEach((m, i) => {
      row.append(h('button', {
        class: 'chip macro',
        title: m.text + '（右键删除）',
        onclick: () => UI.execCommand(m.text),
        oncontextmenu: e => { e.preventDefault(); UI.deleteMacro(i); }
      }, m.name));
    });
    row.append(h('button', { class: 'chip macro-add', title: '把输入框内容保存为宏', onclick: () => UI.saveMacro() }, '＋'));
  },

  saveMacro() {
    const text = ($('#cmdSearch') && $('#cmdSearch').value || '').trim();
    if (!text) { toast('先在输入框写一条指令再保存为宏', 'err'); return; }
    const inp = h('input', { type: 'text', value: text.slice(0, 8) });
    modal({
      title: '保存为宏', width: 340,
      body: [fieldEl('按钮名称', inp), h('div', { class: 'hint' }, '指令内容：' + text)],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '保存', primary: true, onClick: () => {
            const macros = Store.get('macros', []);
            macros.push({ name: inp.value.trim() || '宏', text });
            Store.set('macros', macros.slice(-12));
            UI.renderMacros();
            toast('宏已保存，点按钮即可一键执行', 'ok');
          }
        }
      ]
    });
    setTimeout(() => inp.select(), 40);
  },

  deleteMacro(i) {
    const macros = Store.get('macros', []);
    macros.splice(i, 1);
    Store.set('macros', macros);
    UI.renderMacros();
    toast('已删除宏');
  },

  renderCommands(q) {
    const list = $('#cmdList');
    if (!list) return;
    list.innerHTML = '';
    const query = String(q || '').trim();
    if (query) {
      list.append(h('button', {
        class: 'cmd-item cmd-run',
        onclick: () => UI.execCommand(query)
      }, h('span', { class: 'ci-label' }, '▸ 执行：' + query), h('span', { class: 'ci-hint' }, 'Enter')));
    }
    const items = Agent.search(query);
    if (!items.length) {
      list.append(h('div', { class: 'cmd-empty' }, '没有匹配的指令'));
      return;
    }
    let last = '';
    if (!query) {
      list.append(h('div', { class: 'cmd-group' }, '常用'));
      PINNED.forEach(id => {
        const c = COMMANDS.find(x => x.id === id);
        if (!c) return;
        list.append(h('button', {
          class: 'cmd-item', dataset: { id: c.id },
          onclick: () => UI.runCommand(c.id)
        }, h('span', { class: 'ci-label' }, c.label), c.hint ? h('span', { class: 'ci-hint' }, c.hint) : ''));
      });
      last = '常用';
    }
    items.forEach(c => {
      if (c.group !== last) {
        list.append(h('div', { class: 'cmd-group' }, c.group));
        last = c.group;
      }
      list.append(h('button', {
        class: 'cmd-item', dataset: { id: c.id },
        onclick: () => UI.runCommand(c.id)
      }, h('span', { class: 'ci-label' }, c.label), c.hint ? h('span', { class: 'ci-hint' }, c.hint) : ''));
    });
  },

  runCommand(id) {
    try {
      const label = Agent.run(id);
      this.setCmdResult('✓ ' + label);
      toast(label, 'ok');
    } catch (e) {
      this.setCmdResult('✕ ' + e.message, true);
      toast(e.message, 'err');
    }
  },

  execCommand(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const exact = COMMANDS.find(c => c.label.replace(/…$/, '') === t);
    if (exact) { this.runCommand(exact.id); return; }
    let res;
    try { res = Agent.handle(t); }
    catch (e) { this.setCmdResult('✕ ' + e.message, true); return; }
    const plain = stripHtml(res.reply).replace(/\s+/g, ' ').trim();
    const bad = /没有匹配|失败/.test(plain);
    this.setCmdResult((bad ? '△ ' : '✓ ') + plain, bad);
    toast(plain.slice(0, 44), bad ? 'err' : 'ok');
  },

  setCmdResult(text, err) {
    const el = $('#cmdResult');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('err', !!err);
  },

  sendAgent(text) { this.execCommand(text); },

  panelAPI() {
    return this.panel('api', 'API 控制台', 'code', body => {
      const tabs = h('div', { class: 'tabs' },
        h('button', { class: 'active', onclick: e => UI.apiTab('console', e.target) }, '控制台'),
        h('button', { onclick: e => UI.apiTab('docs', e.target) }, '文档')
      );
      const consoleBox = h('div', { id: 'apiConsole', style: { display: 'flex', flexDirection: 'column', gap: '7px' } },
        h('textarea', {
          class: 'code-editor', id: 'apiCode', spellcheck: 'false',
          value: "// 内置 API —— 直接操作当前文档\nDreikanter.adjust({ brightness: 6, contrast: 14 });\nDreikanter.addText('HELLO', { x: 80, y: 80, size: 96 });\nreturn Dreikanter.info();"
        }),
        h('div', { style: { display: 'flex', gap: '6px' } },
          h('button', { class: 'btn primary', style: { height: '25px', fontSize: '10.5px', flex: '1' }, onclick: () => UI.runAPI() }, '运行  ⌘↵'),
          h('button', { class: 'btn ghost', style: { height: '25px', fontSize: '10.5px' }, onclick: () => { $('#apiCode').value = ''; } }, '清空')
        ),
        h('div', { class: 'code-out', id: 'apiOut' }, '就绪')
      );
      const docsBox = h('div', { class: 'api-doc', id: 'apiDocs', style: { display: 'none' } });
      body.append(tabs, consoleBox, docsBox);
      this._apiDocs = docsBox;
    }, true);
  },

  panelInfo() {
    return this.panel('info', '信息 / 直方图', 'info', body => {
      const cv = h('canvas', { class: 'hist-canvas', id: 'histCanvas', width: 520, height: 116 });
      body.append(cv);
      const chBar = h('div', { class: 'hist-ch', id: 'histCh' });
      [['rgb', 'RGB'], ['r', 'R'], ['g', 'G'], ['b', 'B'], ['l', '亮度']].forEach(([v, label]) => {
        chBar.append(h('button', {
          class: 'hist-ch-btn' + (((this.hist || {}).ch || 'rgb') === v ? ' on' : ''),
          'data-ch': v,
          onclick: () => {
            this.hist = this.hist || { ch: 'rgb', lo: 0, hi: 255 };
            this.hist.ch = v;
            $$('.hist-ch-btn', chBar).forEach(b => b.classList.toggle('on', b.dataset.ch === v));
            this.drawHistogram();
          }
        }, label));
      });
      body.append(chBar);
      body.append(h('div', { class: 'hist-meta' }, h('span', { id: 'histMetaL' }, 'RGB'), h('span', { id: 'histMetaR' }, '—')));
      body.append(h('div', { class: 'exp-bar', style: { marginTop: '2px' } },
        h('button', {
          class: 'btn ghost', style: { flex: '1' },
          onclick: () => {
            const h2 = this.hist || { lo: 0, hi: 255 };
            if (!h2.lo && h2.hi >= 255) { toast('先把阈值拖进来再应用', 'err'); return; }
            applyFilterDirect(FX.levels, { black: h2.lo, white: h2.hi, gamma: 1 }, '色阶（直方图）');
            toast('已按阈值 ' + h2.lo + '–' + h2.hi + ' 应用色阶', 'ok');
          }
        }, '按阈值应用色阶'),
        h('button', {
          class: 'btn ghost', style: { flex: '0 0 auto' },
          onclick: () => { this.hist = { ch: (this.hist || {}).ch || 'rgb', lo: 0, hi: 255 }; this.drawHistogram(); }
        }, '重置')));
      body.append(h('div', { class: 'pick-readout', id: 'pickReadout' }, '光标 —'));
      const grid = h('div', { class: 'prop-grid', id: 'docInfo' });
      body.append(grid);
      this.bindHistogram(cv);
    }, true);
  },

  bindHistogram(cv) {
    if (!cv || cv.dataset.bound) return;
    cv.dataset.bound = '1';
    const pos = e => {
      const r = cv.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1);
      return Math.round(x * 255);
    };
    let which = null;
    const apply = (v, e) => {
      this.hist = this.hist || { ch: 'rgb', lo: 0, hi: 255 };
      if (which === 'lo') this.hist.lo = Math.min(v, this.hist.hi - 1);
      else this.hist.hi = Math.max(v, this.hist.lo + 1);
      this.drawHistogram();
    };
    cv.addEventListener('pointerdown', e => {
      this.hist = this.hist || { ch: 'rgb', lo: 0, hi: 255 };
      const v = pos(e);
      which = Math.abs(v - this.hist.lo) <= Math.abs(v - this.hist.hi) ? 'lo' : 'hi';
      apply(v, e);
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', e => { if (which) apply(pos(e), e); });
    const end = () => { which = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', () => {
      this.hist = { ch: (this.hist || {}).ch || 'rgb', lo: 0, hi: 255 };
      this.drawHistogram();
    });
  },

  /* ---------------- 面板刷新 ---------------- */
  afterChange() {
    if (typeof A11y !== 'undefined') A11y.sync();
    this.renderLayers();
    this.renderHistory();
    this.renderDocInfo();
    this.updateStatus();
    if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
    const blendSel = this._blendSel, l = activeLayer();
    if (blendSel) blendSel.value = l ? l.blend : 'normal';
    if (this._opInp && l) {
      this._opInp.value = Math.round(l.opacity * 100);
      this._opVal.textContent = Math.round(l.opacity * 100) + '%';
    }
  },

  renderLayers() {
    const list = $('#layerList');
    if (!list) return;
    list.innerHTML = '';
    const layers = [...App.layers].reverse();
    layers.forEach(l => {
      const eye = h('button', {
        class: 'layer-eye' + (l.visible ? '' : ' off'),
        title: l.visible ? '隐藏' : '显示',
        html: icon(l.visible ? 'eye' : 'eyeOff', 12),
        onclick: e => {
          e.stopPropagation();
          History.begin('图层可见性', []);
          l.visible = !l.visible;
          History.end();
          invalidate(); sync();
        }
      });
      const thumb = h('div', { class: 'layer-thumb' });
      thumb.append(layerThumb(l, 30));
      const item = h('div', {
        class: 'layer-item' + (l.id === App.activeId ? ' active' : ''),
        onclick: () => { App.activeId = l.id; sync(); },
        oncontextmenu: e => {
          e.preventDefault();
          App.activeId = l.id; sync();
          contextMenu(e.clientX, e.clientY, [
            { label: '重命名…', fn: () => Dialogs.renameLayer(l) },
            { label: '复制图层', key: 'Ctrl J', fn: () => duplicateLayer(l.id) },
            { sep: 1 },
            { label: '上移一层', fn: () => reorderLayer(l.id, 1) },
            { label: '下移一层', fn: () => reorderLayer(l.id, -1) },
            { sep: 1 },
            { label: l.visible ? '隐藏图层' : '显示图层', fn: () => { History.begin('图层可见性', []); l.visible = !l.visible; History.end(); invalidate(); sync(); } },
            { label: '向下合并', fn: () => mergeDown(l.id) },
            { label: '删除图层', danger: true, fn: () => deleteLayer(l.id) }
          ]);
        },
        ondblclick: () => {
          if (l.type === 'text') { Tools.setTool('text'); Text.open(l); }
          else Dialogs.renameLayer(l);
        }
      },
        eye, thumb,
        h('div', { class: 'layer-name' }, l.name, l.type === 'text' ? h('span', { class: 'ly-type' }, 'T') : '', (typeof layerHasFX === 'function' && layerHasFX(l)) ? h('span', { class: 'ly-type ly-fx' }, 'fx') : ''),
        l.locked ? h('span', { class: 'layer-lock', html: icon('lock', 11) }) : ''
      );
      list.append(item);
    });
  },

  renderHistory() {
    const list = $('#historyList');
    if (!list) return;
    list.innerHTML = '';
    const base = h('div', {
      class: 'hist-item' + (History.idx < 0 ? ' current' : ''),
      onclick: () => History.jump(-1)
    }, h('span', { class: 'hi-dot' }), '打开 / 新建');
    list.append(base);
    History.entries.forEach((e, i) => {
      list.append(h('div', {
        class: 'hist-item' + (i === History.idx ? ' current' : '') + (i > History.idx ? ' future' : ''),
        onclick: () => History.jump(i)
      }, h('span', { class: 'hi-dot' }), e.label));
    });
    list.scrollTop = list.scrollHeight;
  },

  renderDocInfo() {
    const grid = $('#docInfo');
    if (!grid) return;
    grid.innerHTML = '';
    const l = activeLayer();
    const rows = [
      ['文档', App.doc.name],
      ['尺寸', App.doc.w ? `${fmtInt(App.doc.w)} × ${fmtInt(App.doc.h)}` : '—'],
      ['图层', String(App.layers.length)],
      ['当前层', l ? l.name : '—'],
      ['选区', App.selection ? `${fmtInt(App.selection.bounds.w)} × ${fmtInt(App.selection.bounds.h)}` : '无'],
      ['缩放', Math.round(App.view.zoom * 100) + '%'],
      ['模式', App.mode === 'ps' ? 'Photoshop' : 'Apsis']
    ];
    rows.forEach(([k, v]) => {
      grid.append(h('span', { class: 'k' }, k), h('span', { class: 'v', title: v }, v));
    });
  },

  drawHistogram() {
    const cv = $('#histCanvas');
    if (!cv || !App.doc.w) return;
    const ctx = ctx2d(cv);
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const src = compositeCanvas(false);
    const sw = 260, sh = Math.max(1, Math.round(260 * src.height / Math.max(1, src.width)));
    const small = makeCanvas(sw, sh);
    const sc = ctx2d(small);
    sc.imageSmoothingQuality = 'low';
    sc.drawImage(src, 0, 0, sw, sh);
    const d = sc.getImageData(0, 0, sw, sh).data;

    const R = new Uint32Array(256), G = new Uint32Array(256), B = new Uint32Array(256);
    let total = 0, dark = 0, bright = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      R[d[i]]++; G[d[i + 1]]++; B[d[i + 2]]++;
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      if (l < 3) dark++;
      if (l > 252) bright++;
      total++;
    }

    ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = Math.round(W * i / 4) + .5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    if (!total) {
      const ml = $('#histMetaL'), mr = $('#histMetaR');
      if (ml) ml.textContent = '空';
      if (mr) mr.textContent = '—';
      return;
    }

    let mx = 1;
    for (let i = 0; i < 256; i++) mx = Math.max(mx, R[i], G[i], B[i]);

    const area = (arr, color) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * W;
        const y = H - Math.min(1, arr[i] / mx) * (H - 4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    const ch = (this.hist && this.hist.ch) || 'rgb';
    ctx.globalCompositeOperation = 'lighter';
    if (ch === 'rgb') {
      area(R, 'rgba(226,86,86,.50)');
      area(G, 'rgba(86,198,120,.46)');
      area(B, 'rgba(86,140,240,.52)');
    } else if (ch === 'r') area(R, 'rgba(226,86,86,.72)');
    else if (ch === 'g') area(G, 'rgba(86,198,120,.68)');
    else if (ch === 'b') area(B, 'rgba(86,140,240,.72)');
    else if (ch === 'l') { /* 亮度单独画 */ }
    ctx.globalCompositeOperation = 'source-over';

    const L = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      L[l]++;
    }
    let lm = 1;
    for (let i = 0; i < 256; i++) lm = Math.max(lm, L[i]);
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W;
      const y = H - (L[i] / lm) * (H - 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const H2 = this.hist || (this.hist = { ch: 'rgb', lo: 0, hi: 255 });
    /* 阈值外的区域压暗 */
    const x0 = Math.round(H2.lo / 255 * W), x1 = Math.round(H2.hi / 255 * W);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    if (x0 > 0) ctx.fillRect(0, 0, x0, H);
    if (x1 < W) ctx.fillRect(x1, 0, W - x1, H);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.moveTo(x0 + .5, 0); ctx.lineTo(x0 + .5, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 + .5, 0); ctx.lineTo(x1 + .5, H); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '9px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText(String(H2.lo), Math.min(W - 22, x0 + 3), H - 3);
    ctx.fillText(String(H2.hi), Math.max(2, x1 - 20), 10);

    /* 当前阈值下的裁切比例 */
    let clipLo = 0, clipHi = 0;
    for (let i = 0; i < 256; i++) {
      if (i < H2.lo) clipLo += L[i];
      if (i > H2.hi) clipHi += L[i];
    }
    const dk = clipLo / total, br = clipHi / total;
    if (dk > 0.002) { ctx.fillStyle = 'rgba(80,160,255,.6)'; ctx.fillRect(0, 0, 3, H * Math.min(1, dk * 12 + .15)); }
    if (br > 0.002) { ctx.fillStyle = 'rgba(255,120,120,.6)'; ctx.fillRect(W - 3, 0, 3, H * Math.min(1, br * 12 + .15)); }

    const ml = $('#histMetaL'), mr = $('#histMetaR');
    const chName = { rgb: 'RGB', r: '红', g: '绿', b: '蓝', l: '亮度' }[H2.ch] || 'RGB';
    if (ml) ml.textContent = chName + ' · ' + fmtInt(total) + ' px';
    if (mr) {
      const warn = (dk > 0.01 || br > 0.01) ? ' ⚠ 裁切' : '';
      mr.textContent = '阴影 ' + (dk * 100).toFixed(1) + '% · 高光 ' + (br * 100).toFixed(1) + '%' + warn;
      mr.style.color = warn ? '#e8b35a' : '';
    }
  },

  /* ---------------- 光标取色 ---------------- */
  updatePick(pt) {
    const el = $('#pickReadout');
    if (!el) return;
    const x = Math.floor(pt.x), y = Math.floor(pt.y);
    if (!App.doc.w || x < 0 || y < 0 || x >= App.doc.w || y >= App.doc.h) {
      el.textContent = '光标 —';
      return;
    }
    const vc = $('#view');
    if (!vc) return;
    try {
      const vd = App._vdpr || 1;
      const d = ctx2d(vc).getImageData(Math.round(x * vd), Math.round(y * vd), 1, 1).data;
      if (d[3] === 0) { el.textContent = x + ', ' + y + ' · 透明'; return; }
      const hex = rgbToHex(d[0], d[1], d[2]).toUpperCase();
      el.innerHTML = '<span class="pick-dot" style="background:' + hex + '"></span> ' + x + ', ' + y + ' · RGB ' + d[0] + ' ' + d[1] + ' ' + d[2] + ' · ' + hex;
    } catch (e) { }
  },

  /* ---------------- API ---------------- */
  apiTab(which, btn) {
    $$('.tabs button', $('#panel-api')).forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    $('#apiConsole').style.display = which === 'console' ? 'flex' : 'none';
    const docs = $('#apiDocs');
    docs.style.display = which === 'docs' ? 'block' : 'none';
    if (which === 'docs' && !docs.dataset.built) {
      docs.innerHTML = API.docs();
      docs.dataset.built = '1';
    }
  },

  runAPI() {
    const code = $('#apiCode').value;
    const out = $('#apiOut');
    out.innerHTML = '';
    try {
      const result = API.run(code);
      out.textContent = result === undefined ? '✓ 执行完成（无返回值）' : '✓ ' + API.format(result);
    } catch (err) {
      out.innerHTML = `<span class="err">✕ ${err.message}</span>`;
    }
  },

  togglePanel(id) {
    const p = $('#panel-' + id);
    if (!p) return;
    p.classList.remove('collapsed');
    p.scrollIntoView({ behavior: 'smooth', block: 'center' });
    p.style.transition = 'background .4s';
    p.style.background = 'rgba(61,142,240,.09)';
    setTimeout(() => p.style.background = '', 900);
  },

  /* ---------------- 状态栏 ---------------- */
  bindStatus() {
    $('#zoomIn').onclick = () => setZoom(App.view.zoom * 1.25);
    $('#zoomOut').onclick = () => setZoom(App.view.zoom / 1.25);
    $('#zoomFit').onclick = () => fitView();
    $('#zoom100').onclick = () => setZoom(1);
    const ie = $('#immersiveExit');
    if (ie) ie.onclick = () => Settings.toggleImmersive();
    const cmp = $('#compareBtn');
    if (cmp) cmp.onclick = () => setComparing(!App.comparing);
  },

  updateStatus() {
    const dims = $('#docDims');
    if (dims) {
      dims.textContent = App.doc.w
        ? `${fmtInt(App.doc.w)} × ${fmtInt(App.doc.h)} px · ${App.doc.dpi || 72} ppi`
        : '—';
      dims.title = App.doc.w
        ? `标尺单位 ${Guides.unit}：${Units.fmt(App.doc.w, Guides.unit, 'x')} × ${Units.fmt(App.doc.h, Guides.unit, 'y')}`
        : '';
    }
    const dn = $('#apsisDocName');
    if (dn) dn.textContent = App.doc.name;
    const hint = $('#statusHint');
    if (hint && !hint.textContent) hint.textContent = '就绪';
    this.updateZoomLabel();
  },

  updateZoomLabel() {
    const el = $('#zoomLabel');
    if (!el) return;
    const z = App.view.zoom;
    const pct = Math.round(z * 100);
    el.textContent = pct + '%';
    el.title = Math.abs(z - 1) < 0.005 ? '实际像素：1 图像像素 = 1 屏幕像素' : pct + '% · 适合屏幕 Ctrl+0';
    el.classList.toggle('actual', Math.abs(z - 1) < 0.005);
  },

  /* ---------------- 模式 ---------------- */
  bindTop() {
    $$('#modeSwitch button').forEach(b => {
      b.onclick = () => setMode(b.dataset.mode);
    });
    $('#paletteBtn').onclick = () => this.openPalette();
    const msb = $('#menuSheetBtn');
    if (msb) msb.onclick = () => this.openMenuSheet();
    $('#brand').onclick = () => showWelcome();
  },

  /* ---------------- 键盘 ---------------- */
  bindKeys() {
    window.addEventListener('keyup', e => {
      if (e.key === '\\' || e.code === 'Backslash') setComparing(false);
    });
    window.addEventListener('keydown', e => {
      if (isTypingTarget(e.target)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'k') { e.preventDefault(); this.openPalette(); return; }
    if (mod && !e.shiftKey && k === 'p') { e.preventDefault(); Dialogs.presets(); return; }
      if (mod && !e.shiftKey && k === 'm') { e.preventDefault(); Dialogs.curves(); return; }
    if (mod && e.shiftKey && k === 'm') { e.preventDefault(); setMode(App.mode === 'ps' ? 'apsis' : 'ps'); return; }
      if (mod && e.shiftKey && k === 'f') { e.preventDefault(); Settings.toggleImmersive(); return; }
      if (mod && k === ',') { e.preventDefault(); Settings.open(); return; }
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) History.redo(); else History.undo();
        return;
      }
      if (mod && k === 'y') { e.preventDefault(); History.redo(); return; }
      if (mod && e.shiftKey && k === 's') { e.preventDefault(); Archives.create(); return; }
      if (mod && e.shiftKey && k === 'c') { e.preventDefault(); copyComposite(); return; }
      if (mod && k === 's') { e.preventDefault(); exportImage('image/png'); return; }
      if (mod && k === 'o') { e.preventDefault(); openFilePicker(false); return; }
      if (mod && k === 'n') { e.preventDefault(); Dialogs.newDoc(); return; }
      if (mod && k === 'w') { e.preventDefault(); Dialogs.closeDoc(); return; }
      if (mod && k === 'a') { e.preventDefault(); if (App.doc.w) selectAll(); return; }
      if (mod && k === 'd') { e.preventDefault(); deselect(); return; }
      if (mod && k === 'j') { e.preventDefault(); duplicateLayer(App.activeId); return; }
      if (mod && k === 'e') { e.preventDefault(); mergeDown(App.activeId); return; }
      if (mod && k === 'i' && !e.altKey) { e.preventDefault(); applyFilterDirect(FX.invert, {}, '反相'); return; }
      if (mod && k === '0') { e.preventDefault(); fitView(); return; }
      if (mod && k === '1') { e.preventDefault(); setZoom(1); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); setZoom(App.view.zoom * 1.25); return; }
      if (mod && k === '-') { e.preventDefault(); setZoom(App.view.zoom / 1.25); return; }
      if (mod && k === ']') { e.preventDefault(); reorderLayer(App.activeId, 1); return; }
      if (mod && k === '[') { e.preventDefault(); reorderLayer(App.activeId, -1); return; }
      if (mod && k === 'v') { e.preventDefault(); pasteFromClipboard(); return; }
      if (mod && k === 't') { e.preventDefault(); Transform.begin(); return; }
      if (mod && k === ';') { e.preventDefault(); Guides.toggleShow(); return; }
      if (mod && k === "'") { e.preventDefault(); App.showGrid = !App.showGrid; invalidateOverlay(); return; }
      if (mod && k === 'r' && !e.shiftKey) {
        e.preventDefault();
        Guides.showRulers = !Guides.showRulers; Guides.save(); Guides.applyVisibility(); layoutFrame(); invalidate();
        return;
      }

      if (e.key === '\\' || e.code === 'Backslash') { e.preventDefault(); setComparing(true); return; }
      if (e.key === '?') { e.preventDefault(); Dialogs.shortcuts(); return; }
      if (e.key === 'Escape') {
        if (typeof Transform !== 'undefined' && Transform.active) { e.preventDefault(); Transform.cancel(); return; }
        if (document.querySelector('.menu-root.open')) { closeAllMenus(); return; }
        const wel = $('#welcome');
        if (wel && !wel.classList.contains('hide')) {
          if (App.doc.w) { hideWelcome(); return; }
        }
        if (document.body.classList.contains('immersive')) { Settings.data.immersive = false; Settings.apply(true); Settings.save(); return; }
        const rad = $('#radial');
        if (rad && rad.classList.contains('on')) { Apsis.closeRadial(); return; }
        const sheet = $('.sheet');
        if (sheet) { sheet.remove(); return; }
        if (App.mode === 'apsis' && App.selection) { deselect(); return; }
        if (App.cropRect) { App.cropRect = null; invalidateOverlay(); this.syncCropButtons(); }
        else if (App.selection) deselect();
        return;
      }
      if (e.key === 'Enter') {
        if (typeof Transform !== 'undefined' && Transform.active) { e.preventDefault(); Transform.commit(); return; }
        if (App.cropRect) { e.preventDefault(); cropToRect(App.cropRect, App.cropAngle); return; }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (e.altKey) fillSelection(App.fg);
        else if (mod) fillSelection(App.bg);
        else clearSelectionPixels();
        return;
      }
      if (e.key === '[' || e.key === ']') {
        const st = Tools.state[Tools.current];
        if (st && st.size != null) {
          st.size = clamp(Math.round(st.size * (e.key === '[' ? 0.8 : 1.25)), 1, 500);
          this.renderOptions();
        }
        return;
      }
      if (e.key === 'x' && !mod) { const t = App.fg; App.fg = App.bg; App.bg = t; this.syncColors(); return; }
      if (e.key === 'd' && !mod) { App.fg = '#ffffff'; App.bg = '#111111'; this.syncColors(); return; }
      if (e.key.startsWith('Arrow') && !mod) {
        const l = activeLayer();
        if (!l) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') l.x -= step;
        if (e.key === 'ArrowRight') l.x += step;
        if (e.key === 'ArrowUp') l.y -= step;
        if (e.key === 'ArrowDown') l.y += step;
        invalidate(); return;
      }
      if (!mod && !e.altKey) {
        if (k === 'g') { Tools.setTool(e.shiftKey ? 'gradient' : 'bucket'); return; }
        const t = toolForKey(k);
        if (t) { Tools.setTool(t); return; }
      }
    });
  },

  /* ---------------- 拖放 / 粘贴 ---------------- */
  bindDrop() {
    let depth = 0;
    window.addEventListener('dragenter', e => {
      if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
      depth++; $('#dropveil').classList.add('on');
    });
    window.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) $('#dropveil').classList.remove('on');
    });
    window.addEventListener('dragover', e => { e.preventDefault(); });
    window.addEventListener('drop', async e => {
      e.preventDefault();
      depth = 0; $('#dropveil').classList.remove('on');
      const files = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|avif|svg|tiff?|heic|heif)$/i.test(f.name));
      if (!files.length) { toast('未检测到图像文件', 'err'); return; }
      if (App.doc.w) await openImageFile(files[0], { asLayer: true });
      else await openImageFile(files[0]);
      hideWelcome();
    });
    window.addEventListener('paste', async e => {
      const items = [...(e.clipboardData?.items || [])];
      const it = items.find(i => i.type.startsWith('image/'));
      if (!it) return;
      const file = it.getAsFile();
      if (file) { await openImageFile(file, { asLayer: !!App.doc.w }); hideWelcome(); }
    });
  },

  bindWelcome() {
    $('#welNew').onclick = () => { hideWelcome(); Dialogs.newDoc(); };
    $('#welOpen').onclick = () => { hideWelcome(); openFilePicker(false); };
    $('#welDemo').onclick = () => { hideWelcome(); Dialogs.loadDemo(); };
    const close = $('#welClose');
    if (close) close.onclick = () => { if (App.doc.w) hideWelcome(); else toast('先打开或新建一张图吧', 'err'); };
    const resume = $('#welResume');
    if (resume) {
      resume.onclick = async () => {
        if (App.doc.w) { hideWelcome(); return; }
        if (Archives.list.length) {
          hideWelcome();
          await Archives.restore(Archives.list[0].id);
          fitView();
        } else {
          Dialogs.newDoc();
        }
      };
    }
    this.refreshWelcome();
  },

  refreshWelcome() {
    const wrap = $('#welResumeWrap'), btn = $('#welResume'), hint = $('.wel-resume-hint');
    if (!wrap || !btn) return;
    const hasDoc = !!App.doc.w;
    const hasArc = typeof Archives !== 'undefined' && Archives.list.length > 0;
    const session = Store.get('session', null);
    if (!hasDoc && !hasArc && !session) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    if (hasDoc) {
      btn.textContent = '继续编辑「' + (App.doc.name || '未命名') + '」';
      if (hint) hint.textContent = '回到当前画布 · 或从下面新建 / 打开';
    } else if (hasArc) {
      btn.textContent = '打开最近存档「' + Archives.list[0].name + '」';
      if (hint) hint.textContent = fmtTime(Archives.list[0].time) + ' · ' + Archives.list[0].layers.length + ' 个图层';
    } else if (session) {
      btn.textContent = '恢复上次画布 ' + session.w + '×' + session.h + '（视图/工具）';
      btn.onclick = () => {
        hideWelcome();
        newDocument(session.w, session.h, { bg: 'transparent', name: session.name || '未命名' });
        if (session.tool && Tools.defs[session.tool]) Tools.setTool(session.tool);
        App.view.zoom = session.zoom || 1;
        App.view.cx = session.cx || session.w / 2;
        App.view.cy = session.cy || session.h / 2;
        invalidate(true);
        toast('已恢复上次画布的尺寸与视图');
      };
      if (hint) hint.textContent = '仅恢复画布尺寸/缩放/位置，像素内容需从存档或原图恢复';
    }
    const recents = $('#welRecents');
    if (recents) {
      recents.innerHTML = '';
      if (typeof Archives !== 'undefined') {
        Archives.list.slice(0, 3).forEach(s2 => {
          recents.append(h('button', {
            class: 'wel-recent',
            onclick: async () => { hideWelcome(); await Archives.restore(s2.id); fitView(); }
          },
            h('img', { src: s2.thumb, alt: '' }),
            h('span', { class: 'wr-meta' },
              h('b', {}, s2.name),
              h('span', {}, fmtTime(s2.time) + ' · ' + s2.w + '×' + s2.h))
          ));
        });
      }
    }
  },

  /* ---------------- 菜单抽屉（Apsis / 手机） ---------------- */
  openMenuSheet() {
    const old = $('.sheet-menu');
    if (old) { old.remove(); return; }
    const close = () => { const v = $('.sheet-veil'); if (v) v.remove(); };
    const sheet = h('div', { class: 'sheet-menu' });
    sheet.append(h('div', { class: 'ms-head' },
      h('span', {}, '菜单'),
      h('button', { class: 'ms-close', html: icon('close', 14), onclick: close })));
    if (typeof Docs !== 'undefined' && Docs.list.length) {
      sheet.append(h('div', { class: 'ms-group' },
        h('div', { class: 'ms-title' }, '打开的文档'),
        ...Docs.list.map(s2 => h('button', {
          class: 'ms-item' + (s2.id === Docs.activeId ? ' active' : ''),
          onclick: () => { close(); Docs.switchTo(s2.id); }
        }, h('span', {}, s2.name + (s2.dirty ? ' •' : '')), h('span', { class: 'ms-key' }, s2.doc.w + '×' + s2.doc.h)))));
    }
    MENUS.forEach(m => {
      const items = m.items.filter(it => it.fn);
      const group = h('div', { class: 'ms-group' },
        h('div', { class: 'ms-title' }, m.label),
        ...items.map(it => h('button', {
          class: 'ms-item',
          onclick: () => { close(); it.fn(); }
        }, h('span', {}, it.label), it.key ? h('span', { class: 'ms-key' }, it.key) : '')));
      sheet.append(group);
    });
    const veil = h('div', { class: 'sheet-veil', onpointerdown: e => { if (e.target === veil) close(); } }, sheet);
    document.body.append(veil);
  },

  /* ---------------- 命令面板 ---------------- */
  openPalette() {
    if ($('.palette')) return;
    const cmds = [];
    MENUS.forEach(m => m.items.forEach(it => {
      if (it.fn) cmds.push({ label: it.label, group: m.label, key: it.key || '', fn: it.fn });
    }));
    COMMANDS.forEach(c => {
      cmds.push({
        label: c.label.replace(/…$/, ''),
        group: '指令 · ' + c.group,
        key: c.hint || '',
        icon: 'bolt',
        fn: () => { UI.runCommand(c.id); }
      });
    });
    Object.keys(Tools.defs).forEach(name => {
      const d = Tools.defs[name];
      cmds.push({ label: '工具：' + d.label, group: '工具', key: d.key, fn: () => Tools.setTool(name), icon: d.icon });
    });
    STYLES.filter(s => s.id !== 'original').forEach(s => {
      cmds.push({ label: '风格：' + s.name, group: '风格', fn: () => applyStyle(s.id), icon: 'film' });
    });
    cmds.push({ label: '切换 Apsis 模式', group: '视图', fn: () => setMode('apsis'), icon: 'sparkles' });
    cmds.push({ label: '切换 Photoshop 模式', group: '视图', fn: () => setMode('ps'), icon: 'layers' });

    /* 最近使用置顶 */
    const recentLabels = Store.get('cmdRecent', []);
    if (recentLabels.length) {
      const byLabel = new Map(cmds.map(c => [c.label, c]));
      const rec = recentLabels.map(l => byLabel.get(l)).filter(Boolean).slice(0, 6);
      cmds.unshift(...rec.map(c => Object.assign({}, c, { group: '最近使用' })));
    }
    const remember = label => {
      const list2 = Store.get('cmdRecent', []).filter(x => x !== label);
      list2.unshift(label);
      Store.set('cmdRecent', list2.slice(0, 8));
    };

    const input = h('input', { class: 'palette-input', placeholder: '搜索命令、工具、滤镜…', spellcheck: 'false' });
    const list = h('div', { class: 'palette-list' });
    const veil = h('div', { class: 'palette', onclick: e => { if (e.target === veil) veil.remove(); } },
      h('div', { class: 'palette-box' }, input, list));
    document.body.append(veil);
    input.focus();

    let sel = 0, shown = [];
    const render = q => {
      list.innerHTML = '';
      shown = cmds.filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()) || c.group.includes(q));
      shown = shown.slice(0, 60);
      sel = 0;
      let lastGroup = '';
      shown.forEach((c, i) => {
        if (c.group !== lastGroup) {
          list.append(h('div', { class: 'pal-section' }, c.group));
          lastGroup = c.group;
        }
        const item = h('div', {
          class: 'pal-item' + (i === sel ? ' sel' : ''),
          role: 'option',
          onmouseenter: () => { sel = i; mark(); },
          onclick: () => { veil.remove(); remember(c.label); c.fn(); }
        }, h('span', { class: 'pi-ico', html: icon(c.icon || 'chevronRight', 14) }), h('span', { class: 'pi-label', html: highlightMatch(c.label, q) }), c.key ? h('small', {}, c.key) : '');
        list.append(item);
      });
      if (!shown.length) list.append(h('div', { class: 'pal-item' }, '没有匹配的命令'));
    };
    const mark = () => {
      $$('.pal-item', list).forEach((el, i) => el.classList.toggle('sel', i === sel));
    };
    render('');
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); ensureVisible(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); ensureVisible(); }
      if (e.key === 'Enter') { e.preventDefault(); const c = shown[sel]; if (c) { veil.remove(); remember(c.label); c.fn(); } }
      if (e.key === 'Escape') veil.remove();
      e.stopPropagation();
    });
    function ensureVisible() {
      const el = $$('.pal-item', list)[sel];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
    veil.addEventListener('keydown', e => { if (e.key === 'Escape') veil.remove(); });
  }
};

/* ---------------- 通用动作 ---------------- */
/* 按键 -> 工具（受个性化快捷键影响） */
function toolForKey(k) {
  const km = (typeof Settings !== 'undefined' && Settings.data && Settings.data.keymap) ? Settings.data.keymap : {};
  for (const t in km) {
    if (km[t] === k && Tools.defs[t]) return t;
  }
  const defs = ['move', 'marquee', 'ellipse', 'lasso', 'wand', 'crop', 'picker', 'brush', 'eraser', 'bucket', 'gradient', 'blur', 'dodge', 'burn', 'clone', 'text', 'shape', 'hand', 'zoom'];
  for (const t of defs) {
    if (km[t]) continue;
    if ((Tools.defs[t].key || '').toLowerCase() === k && t !== 'bucket' && t !== 'gradient') return t;
  }
  return null;
}

function closeAllMenus() {
  $$('.menu-root.open').forEach(r => r.classList.remove('open'));
}

/* 通用右键菜单 */
function closeContextMenu() {
  const m = $('.ctx-menu');
  if (m) m.remove();
}
function contextMenu(x, y, items) {
  closeContextMenu();
  const menu = h('div', { class: 'ctx-menu', style: { left: x + 'px', top: y + 'px' } });
  items.forEach(it => {
    if (it.sep) { menu.append(h('div', { class: 'ctx-sep' })); return; }
    menu.append(h('button', {
      class: 'ctx-item' + (it.danger ? ' danger' : ''),
      onclick: () => { closeContextMenu(); it.fn(); }
    }, h('span', { class: 'ctx-label' }, it.label), it.key ? h('span', { class: 'ctx-key' }, it.key) : ''));
  });
  document.body.append(menu);
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth - 8) menu.style.left = Math.max(8, window.innerWidth - r.width - 8) + 'px';
  if (r.bottom > window.innerHeight - 8) menu.style.top = Math.max(8, window.innerHeight - r.height - 8) + 'px';
  setTimeout(() => {
    document.addEventListener('pointerdown', closeContextMenu, { once: true });
  }, 0);
}

function setMode(mode, quiet) {
  if (mode !== 'ps' && mode !== 'apsis') return;
  if (App.mode === mode) return;
  const t0 = performance.now();

  if (typeof Tools !== 'undefined') Tools.cancelDrag();
  closeAllMenus();
  App.cropRect = null;
  App.brushCursor = null;

  // 记住当前模式的视图，切回来时可还原
  App._views = App._views || {};
  App._views[App.mode] = { zoom: App.view.zoom, cx: App.view.cx, cy: App.view.cy };

  App.mode = mode;
  document.body.classList.toggle('mode-ps', mode === 'ps');
  document.body.classList.toggle('mode-apsis', mode === 'apsis');
  $$('#modeSwitch button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

  if (mode === 'ps') {
    Apsis.unmount();
    const a = Store.get('accent', '#3d8ef0');
    document.documentElement.style.setProperty('--accent', a);
    document.documentElement.style.setProperty('--accent-2', a);
    document.documentElement.style.setProperty('--apsis-radius', '16px');
    const stage = $('#stage');
    if (stage) stage.style.backgroundImage = '';
  } else {
    Apsis.mount();
  }
  Store.set('mode', mode);

  // 同步强制一次重排，随后立即适配：不依赖 rAF，切换确定且即时
  void document.body.offsetHeight;
  layoutFrame();
  fitView();
  // 若之前在该模式下查看过，且缩放能放下，则还原视图
  const saved = App._views[mode];
  if (saved && saved.zoom <= App.view.zoom + 1e-6) {
    App.view.zoom = saved.zoom;
    App.view.cx = saved.cx;
    App.view.cy = saved.cy;
    invalidate(true);
  }
  UI.renderOptions();
  UI.markTool();
  UI.afterChange();
  App._lastSwitch = Math.round(performance.now() - t0);
  if (!quiet) console.log('[Dreikanter] 模式切换 ' + mode + ' · ' + App._lastSwitch + 'ms');
}

function openFilePicker(asLayer) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.svg,.tif,.tiff,.heic,.heif,.jfif,image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (f) { await openImageFile(f, { asLayer: !!asLayer && !!App.doc.w }); hideWelcome(); }
  };
  inp.click();
}

function showWelcome() {
  const w = $('#welcome');
  if (!w) return;
  w.classList.remove('hide');
  if (typeof UI !== 'undefined' && UI.refreshWelcome) UI.refreshWelcome();
}

async function copyComposite() {
  try {
    const cv = compositeCanvas(true);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('已复制合并图像到剪贴板', 'ok');
  } catch (e) {
    toast('复制失败：浏览器限制', 'err');
  }
}

async function pasteFromClipboard() {
  try {
    const items = await navigator.clipboard.read();
    for (const it of items) {
      const type = it.types.find(t => t.startsWith('image/'));
      if (type) {
        const blob = await it.getType(type);
        const file = new File([blob], '剪贴板.png', { type });
        await openImageFile(file, { asLayer: !!App.doc.w });
        return;
      }
    }
    toast('剪贴板中没有图像', 'err');
  } catch (e) {
    toast('无法读取剪贴板，请使用 Ctrl+V 直接粘贴', 'err');
  }
}

function fillSelection(color) {
  const l = activeLayer();
  if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
  History.begin('填充', [l.id]);
  const c = ctx2d(l.canvas);
  c.save();
  c.translate(-l.x, -l.y);
  c.fillStyle = color;
  if (App.selection) {
    c.fill(App.selection.path);
  } else {
    c.fillRect(l.x, l.y, App.doc.w, App.doc.h);
  }
  c.restore();
  l.thumbDirty = true;
  History.end();
  invalidate(); sync();
  toast('已填充 ' + color.toUpperCase(), 'ok');
}

function clearSelectionPixels() {
  const l = activeLayer();
  if (!l || l.locked) return;
  History.begin('清除', [l.id]);
  const c = ctx2d(l.canvas);
  if (App.selection) {
    c.save();
    c.translate(-l.x, -l.y);
    c.globalCompositeOperation = 'destination-out';
    c.fill(App.selection.path);
    c.restore();
  } else {
    c.clearRect(0, 0, l.canvas.width, l.canvas.height);
  }
  l.thumbDirty = true;
  History.end();
  invalidate(); sync();
  toast('已清除选区内容', '', { label: '撤销', fn: () => History.undo() });
}

function closeDoc() {
  blankState();
  History.reset();
  invalidate(true);
  sync();
  showWelcome();
}
