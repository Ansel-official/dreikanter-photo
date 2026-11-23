/* ==========================================================================
   Dreikanter photo — settings.js
   全量个性化：外观 / 布局 / 行为 / 快捷键 / 自定义 CSS / 配置导入导出
   ========================================================================== */
'use strict';

const PANEL_DEFS = [
  ['color', '颜色'], ['commands', '指令'], ['archives', '存档'], ['exportq', '导出队列'], ['layers', '图层'],
  ['adjust', '快速调整'], ['api', 'API 控制台'], ['history', '历史记录'], ['info', '信息 / 直方图']
];
const TOOL_ORDER_DEFAULT = ['move', 'marquee', 'ellipse', 'lasso', 'wand', 'crop', 'picker', 'brush', 'eraser', 'bucket', 'gradient', 'blur', 'dodge', 'burn', 'clone', 'text', 'shape', 'hand', 'zoom'];

const Settings = {
  defaults: {
    /* 外观 */
    theme: 'dark',
    accent: '#3d8ef0',
    radius: 5,
    density: 'normal',
    uiScale: 1,
    uiFont: '',
    iconSize: 16,
    railCols: 2,
    panelWidth: 288,
    stageBg: '',
    panelBg: '',
    /* 布局 */
    hiddenPanels: [],
    panelOrder: [],
    hiddenTools: [],
    toolOrder: [],
    hideMenuBar: false,
    hideStatus: false,
    statusItems: { zoom: true, hint: true, dims: true, copyright: true },
    /* 行为 */
    undoLimit: 36,
    autosave: 10,
    defaultTool: 'move',
    defaultFg: '#ffffff',
    defaultBg: '#111111',
    newW: 1600,
    newH: 1000,
    newBg: 'transparent',
    gridSize: 100,
    gridColor: '#78aaff',
    antsColor: '#ffffff',
    snapTolerance: 7,
    defaultExport: 'png',
    exportQuality: 92,
    nameTemplate: '{name}-{size}-{date}-{time}',
    defaultSpace: 'rgb',
    /* 快捷键 / 高级 */
    keymap: {},
    customCss: ''
  },
  data: null,
  accents: ['#3d8ef0', '#7b8cff', '#2dd4bf', '#f97316', '#ec4899', '#a3e635', '#e5e5ea'],

  load() {
    const saved = Store.get('settings', {});
    this.data = Object.assign({}, this.defaults, saved);
    this.data.statusItems = Object.assign({}, this.defaults.statusItems, saved.statusItems || {});
    if (!Array.isArray(this.data.hiddenPanels)) this.data.hiddenPanels = [];
    if (!Array.isArray(this.data.hiddenTools)) this.data.hiddenTools = [];
    if (!Array.isArray(this.data.panelOrder)) this.data.panelOrder = [];
    if (!Array.isArray(this.data.toolOrder)) this.data.toolOrder = [];
    if (typeof this.data.keymap !== 'object' || !this.data.keymap) this.data.keymap = {};
    this.apply(false);
  },

  save() { Store.set('settings', this.data); },

  apply(rebuild = true) {
    const d = this.data;
    const root = document.documentElement;

    const resolvedTheme = d.theme === 'auto'
      ? (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : d.theme;
    document.body.classList.toggle('theme-light', resolvedTheme === 'light');
    document.body.classList.toggle('theme-oled', resolvedTheme === 'oled');
    document.body.classList.toggle('density-compact', d.density === 'compact');
    document.body.classList.toggle('immersive', !!d.immersive);
    document.body.classList.toggle('no-menubar', !!d.hideMenuBar);
    document.body.classList.toggle('no-status', !!d.hideStatus);
    document.body.classList.toggle('hide-zoom', !d.statusItems.zoom);
    document.body.classList.toggle('hide-hint', !d.statusItems.hint);
    document.body.classList.toggle('hide-dims', !d.statusItems.dims);
    document.body.classList.toggle('hide-copy', !d.statusItems.copyright);

    if (App.mode === 'ps' || resolvedTheme !== 'dark') {
      root.style.setProperty('--accent', d.accent);
      root.style.setProperty('--accent-2', d.accent);
    }
    root.style.setProperty('--radius', d.radius + 'px');
    root.style.setProperty('--panel', (d.panelWidth || 288) + 'px');
    root.style.setProperty('--rail-col', d.railCols || 2);
    root.style.setProperty('--rail', (Math.max(1, d.railCols) * 36 + 4) + 'px');
    root.style.setProperty('--icon-size', (d.iconSize || 16) + 'px');
    if (d.uiFont) {
      root.style.setProperty('--font', `"${d.uiFont}", "Inter", "Segoe UI", "Microsoft YaHei", system-ui, sans-serif`);
    } else {
      root.style.removeProperty('--font');
    }
    root.style.zoom = (d.uiScale && d.uiScale !== 1) ? d.uiScale : '';

    if (d.stageBg) root.style.setProperty('--stage-bg', d.stageBg);
    else root.style.removeProperty('--stage-bg');
    if (d.panelBg) {
      root.style.setProperty('--panel-bg', d.panelBg);
      root.style.setProperty('--panel-head-bg', d.panelBg);
    } else {
      root.style.removeProperty('--panel-bg');
      root.style.removeProperty('--panel-head-bg');
    }

    if (typeof History !== 'undefined' && d.undoLimit) History.max = clamp(d.undoLimit, 5, 200);

    /* 自定义 CSS */
    let style = document.getElementById('customCss');
    if (!style) {
      style = document.createElement('style');
      style.id = 'customCss';
      document.head.append(style);
    }
    style.textContent = d.customCss || '';

    if (rebuild) {
      if (typeof UI !== 'undefined' && UI.buildToolrail) {
        UI.buildToolrail();
        UI.buildPanels();
        UI.markTool();
        UI.afterChange();
      }
      if (typeof layoutFrame === 'function') {
        layoutFrame();
        fitView();
        invalidate(true);
      }
    }
  },

  set(key, value, rebuild = true) {
    this.data[key] = value;
    this.apply(rebuild);
    this.save();
  },

  setStatusItem(key, value) {
    this.data.statusItems[key] = value;
    this.apply(false);
    this.save();
  },

  toggleList(key, id) {
    const list = this.data[key] || [];
    this.data[key] = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    this.apply(true);
    this.save();
  },

  /* 面板 / 工具顺序 */
  orderFor(kind) {
    const defs = kind === 'panel' ? PANEL_DEFS.map(p => p[0]) : TOOL_ORDER_DEFAULT.slice();
    const saved = kind === 'panel' ? this.data.panelOrder : this.data.toolOrder;
    if (!saved || !saved.length) return defs;
    return saved.filter(id => defs.includes(id)).concat(defs.filter(id => !saved.includes(id)));
  },

  moveItem(kind, id, delta) {
    const arr = this.orderFor(kind);
    const i = arr.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    if (kind === 'panel') this.data.panelOrder = arr;
    else this.data.toolOrder = arr;
    this.apply(true);
    this.save();
  },

  reset() {
    this.data = JSON.parse(JSON.stringify(this.defaults));
    this.apply(true);
    this.save();
    toast('已恢复全部默认设置', 'ok');
  },

  saveWorkspace() {
    const collapsed = {};
    $$('.panel').forEach(p => collapsed[p.id] = p.classList.contains('collapsed'));
    Store.set('workspace', Object.assign({}, this.data, { collapsed }));
    Store.set('apsis', Apsis.cfg);
    toast('当前工作区已保存为默认', 'ok');
  },

  loadWorkspace() {
    const ws = Store.get('workspace', null);
    if (!ws) { toast('还没有保存过工作区', 'err'); return; }
    this.data = Object.assign({}, this.defaults, ws);
    delete this.data.collapsed;
    this.apply(true);
    this.save();
    if (ws.collapsed) {
      for (const id in ws.collapsed) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('collapsed', !!ws.collapsed[id]);
      }
    }
    toast('已还原保存的工作区', 'ok');
  },

  toggleImmersive() {
    this.data.immersive = !this.data.immersive;
    this.apply(true);
    this.save();
    toast(this.data.immersive ? '已进入沉浸模式，Esc 退出' : '已退出沉浸模式', 'ok');
  },

  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  importJSON(text) {
    try {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object') throw new Error('格式不正确');
      this.data = Object.assign({}, this.defaults, obj);
      this.data.statusItems = Object.assign({}, this.defaults.statusItems, obj.statusItems || {});
      this.apply(true);
      this.save();
      toast('配置已导入', 'ok');
    } catch (e) {
      toast('导入失败：' + e.message, 'err');
    }
  },

  /* ---------------- 设置界面 ---------------- */
  open(tab = 'look') {
    const d = this.data;
    const tabsBar = h('div', { class: 'tabs' });
    const pane = h('div', { class: 'set-pane' });
    const TABS = [['look', '外观'], ['layout', '布局'], ['behavior', '行为'], ['keys', '快捷键'], ['advanced', '高级']];

    const render = which => {
      [...tabsBar.children].forEach((b, i) => b.classList.toggle('active', TABS[i][0] === which));
      pane.innerHTML = '';
      pane.append(which === 'look' ? this.paneLook()
        : which === 'layout' ? this.paneLayout()
          : which === 'behavior' ? this.paneBehavior()
            : which === 'keys' ? this.paneKeys()
              : this.paneAdvanced());
    };
    TABS.forEach(([id, label]) => {
      tabsBar.append(h('button', { onclick: () => render(id) }, label));
    });

    modal({
      title: '个性化', sub: '所有选项即时生效并自动保存', width: 640,
      body: [tabsBar, pane],
      actions: [
        { label: '恢复默认', ghost: true, onClick: () => { this.reset(); render('look'); } },
        { label: '完成', primary: true }
      ]
    });
    render(tab);
  },

  paneLook() {
    const d = this.data;
    const box = h('div', { class: 'set-stack' });

    const themeSeg = h('div', { class: 'seg' },
      ...[['auto', '跟随系统'], ['dark', '深色'], ['light', '浅色'], ['oled', '纯黑']].map(([v, l]) =>
        h('button', {
          class: d.theme === v ? 'active' : '',
          onclick: e => { this.set('theme', v, false); segSet(e.target.parentNode, v, ['dark', 'light', 'oled']); }
        }, l)));

    const accRow = h('div', { class: 'swatches-mini' });
    const renderAcc = () => {
      accRow.innerHTML = '';
      this.accents.forEach(c => accRow.append(h('div', {
        class: 'swatch-mini' + (this.data.accent === c ? ' active' : ''),
        style: { background: c },
        onclick: () => { this.set('accent', c, false); renderAcc(); }
      })));
      accRow.append(h('input', {
        type: 'color', value: this.data.accent,
        style: { width: '26px', height: '26px', borderRadius: '8px', border: '1px solid #4a4a4a', background: 'none', cursor: 'pointer' },
        oninput: e => this.set('accent', e.target.value, false)
      }));
    };
    renderAcc();

    const radius = UI.sliderRow({
      label: '圆角', min: 0, max: 18, value: d.radius,
      onInput: v => { this.data.radius = v; document.documentElement.style.setProperty('--radius', v + 'px'); },
      onCommit: () => this.save()
    });
    const panelW = UI.sliderRow({
      label: '面板宽度', min: 220, max: 400, value: d.panelWidth,
      onInput: v => { this.data.panelWidth = v; document.documentElement.style.setProperty('--panel', v + 'px'); },
      onCommit: () => { this.save(); layoutFrame(); fitView(); invalidate(true); }
    });
    const iconS = UI.sliderRow({
      label: '工具图标大小', min: 12, max: 22, value: d.iconSize,
      onInput: v => { this.data.iconSize = v; this.apply(true); },
      onCommit: () => this.save()
    });
    const cols = UI.sliderRow({
      label: '工具栏列数', min: 1, max: 3, value: d.railCols,
      onInput: v => { this.data.railCols = v; },
      onCommit: () => { this.apply(true); this.save(); }
    });
    const scale = h('select', {
      class: 'opt-select',
      onchange: e => this.set('uiScale', parseFloat(e.target.value))
    }, ...[[.9, '90%'], [1, '100%'], [1.1, '110%'], [1.25, '125%']].map(([v, l]) =>
      h('option', { value: v, selected: d.uiScale === v }, l)));

    const font = h('input', {
      type: 'text', value: d.uiFont, placeholder: '留空使用系统默认字体',
      onchange: e => this.set('uiFont', e.target.value.trim())
    });
    const stageBg = h('input', {
      type: 'color', value: d.stageBg || '#141414',
      style: { width: '40px', height: '26px', background: 'none', border: '1px solid #4a4a4a', borderRadius: '5px' },
      oninput: e => this.set('stageBg', e.target.value, false)
    });
    const panelBg = h('input', {
      type: 'color', value: d.panelBg || '#1f1f1f',
      style: { width: '40px', height: '26px', background: 'none', border: '1px solid #4a4a4a', borderRadius: '5px' },
      oninput: e => this.set('panelBg', e.target.value, false)
    });
    const densSeg = h('div', { class: 'seg' },
      ...[['normal', '标准'], ['compact', '紧凑']].map(([v, l]) =>
        h('button', {
          class: d.density === v ? 'active' : '',
          onclick: e => { this.set('density', v); segSet(e.target.parentNode, v, ['normal', 'compact']); }
        }, l)));

    box.append(
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '主题与色彩'),
        fieldEl('主题', themeSeg),
        fieldEl('强调色', accRow),
        h('div', { class: 'set-row' }, fieldEl('画布底色', stageBg), fieldEl('面板底色', panelBg)),
        h('div', { class: 'hint' }, '面板底色留空（默认值）时跟随主题；高级里还能用 CSS 改任意细节。')
      ),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '尺寸与排版'),
        radius.el, panelW.el, iconS.el, cols.el,
        h('div', { class: 'set-row' }, fieldEl('界面缩放', scale), fieldEl('界面字体', font)),
        fieldEl('面板密度', densSeg)
      )
    );
    return box;
  },

  paneLayout() {
    const d = this.data;
    const box = h('div', { class: 'set-stack' });

    const panelList = h('div', { class: 'order-list' });
    const renderPanels = () => {
      panelList.innerHTML = '';
      this.orderFor('panel').forEach(id => {
        const label = (PANEL_DEFS.find(p => p[0] === id) || [id, id])[1];
        const on = !d.hiddenPanels.includes(id);
        panelList.append(h('div', { class: 'order-row' },
          h('label', { class: 'opt-check' },
            h('input', {
              type: 'checkbox', checked: on,
              onchange: () => { this.toggleList('hiddenPanels', id); renderPanels(); }
            }), label),
          h('div', { class: 'order-btns' },
            h('button', { class: 'icon-btn', onclick: () => { this.moveItem('panel', id, -1); renderPanels(); } }, '↑'),
            h('button', { class: 'icon-btn', onclick: () => { this.moveItem('panel', id, 1); renderPanels(); } }, '↓'))
        ));
      });
    };
    renderPanels();

    const toolList = h('div', { class: 'order-list' });
    const renderTools = () => {
      toolList.innerHTML = '';
      this.orderFor('tool').forEach(id => {
        const def = Tools.defs[id];
        if (!def) return;
        const on = !d.hiddenTools.includes(id);
        toolList.append(h('div', { class: 'order-row' },
          h('label', { class: 'opt-check' },
            h('input', {
              type: 'checkbox', checked: on,
              onchange: () => { this.toggleList('hiddenTools', id); renderTools(); }
            }), def.label),
          h('div', { class: 'order-btns' },
            h('button', { class: 'icon-btn', onclick: () => { this.moveItem('tool', id, -1); renderTools(); } }, '↑'),
            h('button', { class: 'icon-btn', onclick: () => { this.moveItem('tool', id, 1); renderTools(); } }, '↓'))
        ));
      });
    };
    renderTools();

    const statusRow = h('div', { class: 'check-grid' });
    [['zoom', '缩放控件'], ['hint', '中间提示'], ['dims', '尺寸信息'], ['copyright', '版权文字']].forEach(([k, label]) => {
      statusRow.append(h('label', { class: 'opt-check' },
        h('input', {
          type: 'checkbox', checked: !!d.statusItems[k],
          onchange: e => this.setStatusItem(k, e.target.checked)
        }), label));
    });

    box.append(
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '面板'),
        h('div', { class: 'hint' }, '勾选显示，↑↓ 调整顺序；「图层」始终保留。'),
        panelList),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '工具栏'),
        toolList),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '界面元素'),
        h('label', { class: 'opt-check' },
          h('input', {
            type: 'checkbox', checked: !!d.hideMenuBar,
            onchange: e => this.set('hideMenuBar', e.target.checked)
          }), '隐藏菜单栏'),
        h('label', { class: 'opt-check' },
          h('input', {
            type: 'checkbox', checked: !!d.hideStatus,
            onchange: e => this.set('hideStatus', e.target.checked)
          }), '隐藏状态栏'),
        h('div', { class: 'set-title', style: { marginTop: '4px' } }, '状态栏内容'),
        statusRow)
    );
    return box;
  },

  paneBehavior() {
    const d = this.data;
    const box = h('div', { class: 'set-stack' });

    const undo = UI.sliderRow({
      label: '撤销步数上限', min: 10, max: 100, value: d.undoLimit,
      onInput: v => { this.data.undoLimit = v; History.max = v; },
      onCommit: () => this.save()
    });
    const autosave = h('select', {
      class: 'opt-select',
      onchange: e => { this.set('autosave', parseInt(e.target.value)); scheduleAutosave(); }
    }, ...[[0, '关闭'], [5, '每 5 分钟'], [10, '每 10 分钟'], [30, '每 30 分钟']].map(([v, l]) =>
      h('option', { value: v, selected: d.autosave === v }, l)));

    const toolSel = h('select', {
      class: 'opt-select',
      onchange: e => this.set('defaultTool', e.target.value)
    }, ...Object.keys(Tools.defs).map(k => h('option', { value: k, selected: d.defaultTool === k }, Tools.defs[k].label)));

    const fg = h('input', { type: 'color', value: d.defaultFg, style: { width: '40px', height: '26px', background: 'none', border: '1px solid #4a4a4a', borderRadius: '5px' }, oninput: e => this.set('defaultFg', e.target.value, false) });
    const bg = h('input', { type: 'color', value: d.defaultBg, style: { width: '40px', height: '26px', background: 'none', border: '1px solid #4a4a4a', borderRadius: '5px' }, oninput: e => this.set('defaultBg', e.target.value, false) });

    const newW = h('input', { type: 'number', value: d.newW, onchange: e => this.set('newW', clamp(parseInt(e.target.value) || 1600, 1, 20000)) });
    const newH = h('input', { type: 'number', value: d.newH, onchange: e => this.set('newH', clamp(parseInt(e.target.value) || 1000, 1, 20000)) });
    const newBg = h('select', {
      class: 'opt-select',
      onchange: e => this.set('newBg', e.target.value)
    }, ...[['transparent', '透明'], ['#ffffff', '白色'], ['#000000', '黑色'], ['#1a1a1a', '深灰'], ['#f4efe6', '米色']].map(([v, l]) =>
      h('option', { value: v, selected: d.newBg === v }, l)));

    const gridSize = UI.sliderRow({
      label: '网格间距 (px)', min: 20, max: 400, value: d.gridSize,
      onInput: v => { this.data.gridSize = v; invalidate(true); },
      onCommit: () => this.save()
    });
    const gridColor = h('input', { type: 'color', value: d.gridColor, style: { width: '40px', height: '26px', background: 'none', border: '1px solid #4a4a4a', borderRadius: '5px' }, oninput: e => { this.data.gridColor = e.target.value; invalidate(true); } });
    const antsColor = h('input', { type: 'color', value: d.antsColor, style: { width: '40px', height: '26px', background: 'none', border: '1px solid #4a4a4a', borderRadius: '5px' }, oninput: e => { this.data.antsColor = e.target.value; invalidateOverlay(); } });

    const snapTol = UI.sliderRow({
      label: '吸附距离 (px)', min: 2, max: 20, value: d.snapTolerance,
      onInput: v => { this.data.snapTolerance = v; },
      onCommit: () => this.save()
    });

    const expFmt = h('select', {
      class: 'opt-select',
      onchange: e => this.set('defaultExport', e.target.value)
    }, ...[['png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WEBP']].map(([v, l]) =>
      h('option', { value: v, selected: d.defaultExport === v }, l)));
    const expQ = UI.sliderRow({
      label: '导出质量', min: 40, max: 100, value: d.exportQuality,
      onInput: v => { this.data.exportQuality = v; },
      onCommit: () => this.save()
    });
    const tplInp = h('input', {
      type: 'text', value: d.nameTemplate || '{name}-{size}-{date}-{time}',
      onchange: e => this.set('nameTemplate', e.target.value.trim() || '{name}-{size}-{date}-{time}')
    });

    box.append(
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '编辑'),
        undo.el,
        fieldEl('自动存档', autosave),
        fieldEl('启动默认工具', toolSel),
        h('div', { class: 'set-row' }, fieldEl('默认前景色', fg), fieldEl('默认背景色', bg))
      ),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '新建文档默认值'),
        h('div', { class: 'set-row' }, fieldEl('宽度', newW), fieldEl('高度', newH), fieldEl('背景', newBg))
      ),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '画布辅助'),
        gridSize.el,
        h('div', { class: 'set-row' }, fieldEl('网格颜色', gridColor), fieldEl('选区蚂蚁线', antsColor)),
        snapTol.el
      ),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '导出'),
        h('div', { class: 'set-row' }, fieldEl('默认格式', expFmt)),
        expQ.el,
        fieldEl('文件名模板', tplInp, '可用 {name} {size} {date}')
      )
    );
    return box;
  },

  paneKeys() {
    const d = this.data;
    const box = h('div', { class: 'set-stack' });
    const grid = h('div', { class: 'key-grid' });
    const keyUse = {};
    Object.keys(Tools.defs).forEach(n => {
      const k = (d.keymap[n] || Tools.defs[n].key || '').toLowerCase();
      if (!k) return;
      (keyUse[k] = keyUse[k] || []).push(Tools.defs[n].label);
    });
    const conflicts = Object.keys(keyUse).filter(k => keyUse[k].length > 1 && k !== 'g');
    Object.keys(Tools.defs).forEach(name => {
      const def = Tools.defs[name];
      const val = d.keymap[name] || (def.key || '').toLowerCase();
      const inp = h('input', {
        class: 'key-input', maxlength: '2', value: val.toUpperCase(),
        onchange: e => {
          const k = e.target.value.trim().toLowerCase().slice(0, 1);
          e.target.value = k.toUpperCase();
          if (!k) { delete d.keymap[name]; }
          else {
            for (const t in d.keymap) if (d.keymap[t] === k) delete d.keymap[t];
            d.keymap[name] = k;
          }
          this.save();
        }
      });
      grid.append(h('div', { class: 'key-row' }, h('span', {}, def.label), inp));
    });
    box.append(
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '工具快捷键'),
        h('div', { class: 'hint' }, '单字母生效；留空恢复默认。与其他快捷键冲突时以这里为准。'),
        conflicts.length ? h('div', { class: 'hint', style: { color: '#d99' } },
          '⚠ 冲突：' + conflicts.map(k => k.toUpperCase() + ' → ' + keyUse[k].join(' / ')).join('；')) : '',
        grid)
    );
    return box;
  },

  paneAdvanced() {
    const d = this.data;
    const box = h('div', { class: 'set-stack' });
    const ta = h('textarea', {
      class: 'code-editor', style: { height: '150px' }, spellcheck: 'false',
      placeholder: '/* 例：.panel-head{letter-spacing:0} #stage{background:#000} */',
      oninput: e => { d.customCss = e.target.value; this.apply(false); this.save(); }
    });
    ta.value = d.customCss || '';

    const jsonBox = h('textarea', {
      class: 'code-editor', style: { height: '90px' }, spellcheck: 'false'
    });
    jsonBox.value = this.exportJSON();

    box.append(
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '自定义 CSS'),
        h('div', { class: 'hint' }, '想改任何地方都可以写在这里，实时生效，随配置保存。'),
        ta),
      h('div', { class: 'set-block' },
        h('div', { class: 'set-title' }, '配置备份'),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
          h('button', { class: 'btn', onclick: () => { jsonBox.value = this.exportJSON(); toast('已刷新当前配置'); } }, '导出到下方'),
          h('button', { class: 'btn primary', onclick: () => this.importJSON(jsonBox.value) }, '从下方导入'),
          h('button', {
            class: 'btn', onclick: async () => {
              const blob = new Blob([this.exportJSON()], { type: 'application/json' });
              downloadBlob(blob, 'dreikanter-settings.json');
            }
          }, '下载 JSON 文件')
        ),
        jsonBox,
        h('div', { class: 'hint' }, '换电脑时把 JSON 复制过去导入即可，包含面板/工具栏/快捷键/自定义 CSS。')
      )
    );
    return box;
  }
};

function segSet(parent, value, list) {
  const btns = [...parent.querySelectorAll('button')];
  const idx = list.indexOf(value);
  btns.forEach((b, i) => b.classList.toggle('active', i === idx));
}

let _autosaveTimer = 0;
function scheduleAutosave() {
  clearInterval(_autosaveTimer);
  const min = Settings.data && Settings.data.autosave;
  if (!min) return;
  _autosaveTimer = setInterval(async () => {
    if (!App.doc.w || Archives.busy || !App.dirty) return;
    const olds = Archives.list.filter(x => x.name.indexOf('自动存档') === 0);
    for (const o of olds) { try { await Archives.remove(o.id, true); } catch (e) { } }
    Archives.create('自动存档 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
  }, min * 60 * 1000);
}
