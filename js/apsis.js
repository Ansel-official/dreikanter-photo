/* ==========================================================================
   Dreikanter photo — apsis.js
   Apsis 模式：意图优先 / 径向菜单 / 卡片图层 / 可自定义
   ========================================================================== */
'use strict';

const APSIS_ACCENTS = ['#7b8cff', '#2dd4bf', '#f97316', '#ec4899', '#a3e635', '#e5e5ea'];
const APSIS_BG = {
  deep: 'radial-gradient(1000px 620px at 50% 45%,#1c1c1f 0%,#111113 55%,#0c0c0e 100%)',
  black: '#0a0a0b',
  warm: 'radial-gradient(1000px 620px at 50% 45%,#221d1a 0%,#16120f 60%,#0e0b09 100%)'
};

const Apsis = {
  mounted: false,
  radialOpen: false,
  cfg: {
    accent: '#7b8cff',
    radius: 16,
    density: 'normal',
    bg: 'deep',
    hud: true,
    dock: ['move', 'marquee', 'brush', 'eraser', 'text', 'shape', 'crop']
  },
  _chat: [],

  loadCfg() {
    const c = Store.get('apsis', null);
    if (c && typeof c === 'object') Object.assign(this.cfg, c);
    if (!Array.isArray(this.cfg.dock) || !this.cfg.dock.length) this.cfg.dock = ['move', 'marquee', 'brush', 'eraser', 'text', 'shape', 'crop'];
  },
  saveCfg() { Store.set('apsis', this.cfg); },

  applyCfg() {
    const root = document.documentElement;
    root.style.setProperty('--accent', this.cfg.accent);
    root.style.setProperty('--accent-2', this.cfg.accent);
    root.style.setProperty('--apsis-radius', this.cfg.radius + 'px');
    root.style.setProperty('--dock-h', this.cfg.density === 'compact' ? '52px' : this.cfg.density === 'loose' ? '70px' : '60px');
    const stage = $('#stage');
    if (stage) stage.style.backgroundImage = APSIS_BG[this.cfg.bg] || APSIS_BG.deep;
    const dock = $('#dock');
    if (dock) dock.style.setProperty('--dkbtn', this.cfg.density === 'compact' ? '38px' : this.cfg.density === 'loose' ? '48px' : '42px');
    document.body.classList.toggle('apsis-hud-off', !this.cfg.hud);
    const hud = $('#stageHud');
    if (hud) hud.style.display = this.cfg.hud ? 'flex' : 'none';
  },

  mount() {
    this.loadCfg();
    this.applyCfg();
    this.buildDock();
    this.buildQuickbar();
    this.buildInspector();
    this.buildHud();
    this.buildIntentChips();
    this.bindOnce();
    this.mounted = true;
    this.refresh();
  },

  unmount() {
    this.mounted = false;
    this.closeRadial();
    const sheet = $('.sheet');
    if (sheet) sheet.remove();
  },

  bindOnce() {
    if (this._bound) return;
    this._bound = true;
    const input = $('#intentInput');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = input.value.trim();
        if (v) { input.value = ''; this.runIntent(v); }
      }
      e.stopPropagation();
    });
    $('#apsisCustomize').onclick = () => this.openSheet();
    $('#apsisHelp').onclick = () => Dialogs.shortcuts();
  },

  /* ---------------- 意图栏 ---------------- */
  buildIntentChips() {
    const wrap = $('#intentChips');
    if (!wrap) return;
    wrap.innerHTML = '';
    const chips = ['胶片感', '裁成 16:9', '加一句标题', '黑白', '提亮一点', '加暗角', '锐化', '反相', '适合屏幕'];
    chips.forEach(t => wrap.append(h('button', { class: 'chip', onclick: () => { $('#intentInput').value = t; this.runIntent(t); } }, t)));
  },

  runIntent(text) {
    this.say('me', text);
    const res = Agent.handle(text);
    if (res && res.reply) this.say('ai', res.reply);
    if (App.mode === 'apsis' && !this.mounted) {
      // 若在 PS 模式使用顶部意图栏（隐藏），仍提示
      toast(res && res.reply ? stripHtml(res.reply) : '已执行');
    }
  },

  runCmd(id) {
    try {
      const label = Agent.run(id);
      this.say('ai', '✓ ' + label);
      toast(label, 'ok');
    } catch (e) {
      this.say('ai', '✕ ' + e.message);
      toast(e.message, 'err');
    }
  },

  say(role, html) {
    this._chat.push({ role, html });
    if (this._chat.length > 20) this._chat.shift();
    this.renderChat();
  },

  renderChat() {
    const log = $('#apsChat');
    if (!log) return;
    log.innerHTML = '';
    if (!this._chat.length) {
      log.append(h('div', { class: 'aps-empty' }, '输入指令，或点上面的快捷指令。'));
      return;
    }
    this._chat.slice(-4).forEach(m => {
      log.append(h('div', { class: 'msg ' + (m.role === 'me' ? 'me' : 'ai') }, h('div', { class: 'bubble', html: m.html })));
    });
    log.scrollTop = log.scrollHeight;
  },

  /* ---------------- 工具坞 ---------------- */
  buildDock() {
    const dock = $('#dock');
    if (!dock) return;
    dock.innerHTML = '';
    const order = ['move', 'marquee', 'lasso', 'wand', 'crop', 'brush', 'eraser', 'bucket', 'gradient', 'blur', 'dodge', 'text', 'shape', 'hand', 'zoom'];
    this.cfg.dock.forEach(id => {
      const d = Tools.defs[id];
      if (!d) return;
      dock.append(h('button', {
        class: 'dock-btn', dataset: { tool: id }, title: d.label,
        onclick: () => { Tools.setTool(id); this.markDock(); }
      }, h('span', { html: icon(d.icon, 19) }), h('span', {}, d.label.replace('工具', '').replace('选框', '选框'))));
    });
    dock.append(h('div', { class: 'dock-sep' }));
    dock.append(h('button', {
      class: 'dock-more', title: '全部工具 / 命令面板 (Ctrl+K)',
      onclick: (e) => this.openRadial(e.clientX, e.clientY)
    }, h('span', { html: icon('dots', 18) })));
    dock.append(h('button', {
      class: 'dock-more', title: '命令面板', onclick: () => UI.openPalette()
    }, h('span', { html: icon('search', 17) })));
    this.markDock();
  },

  markDock() {
    $$('.dock-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === Tools.current));
  },

  /* ---------------- 快速风格条 ---------------- */
  buildQuickbar() {
    const bar = $('#quickbar');
    if (!bar) return;
    bar.innerHTML = '';
    bar.append(h('span', { class: 'quick-label' }, '风格'));
    ['original', 'film', 'mono', 'teal', 'cyber', 'jp', 'moody', 'faded'].forEach(id => {
      const s = STYLES.find(x => x.id === id);
      if (!s) return;
      bar.append(h('button', {
        class: 'quick-chip', dataset: { style: id },
        onclick: () => {
          applyStyle(id);
          $$('.quick-chip', bar).forEach(c => c.classList.toggle('on', c.dataset.style === id));
        }
      }, h('span', { class: 'qc-dot', style: { background: s.color } }), s.name));
    });
    bar.append(h('span', { class: 'quick-label', style: { paddingLeft: '8px' } }, '|'));
    bar.append(h('button', { class: 'quick-chip', onclick: () => Dialogs.cameraLut() }, '相机 LUT'));
    bar.append(h('button', { class: 'quick-chip', onclick: () => UI.openPalette() }, '全部滤镜 →'));
  },

  /* ---------------- 检查器 ---------------- */
  buildInspector() {
    const root = $('#inspector');
    if (!root) return;
    root.innerHTML = '';

    /* 画布卡 */
    const meta = h('div', { class: 'aps-meta', id: 'apsMeta' });
    root.append(h('div', { class: 'insp-card' },
      h('div', { class: 'insp-head' }, '画布', h('span', { class: 'ih-act', id: 'apsZoom' }, '')),
      h('div', { class: 'insp-body' }, meta,
        h('div', { class: 'insp-row' },
          h('button', { class: 'insp-btn', onclick: () => setMode('ps') }, 'Photoshop 模式'),
          h('button', { class: 'insp-btn accent', onclick: () => exportImage('image/png') }, '导出')
        ))
    ));

    /* 图层卡 */
    const deck = h('div', { class: 'deck', id: 'apsDeck' });
    root.append(h('div', { class: 'insp-card' },
      h('div', { class: 'insp-head' }, '图层', h('span', { class: 'ih-act', id: 'apsLayerCount' }, '')),
      h('div', { class: 'insp-body' }, deck,
        h('div', { class: 'insp-row' },
          h('button', { class: 'insp-btn', onclick: () => { History.begin('新建图层', []); addLayer(); History.end(); } }, '+ 新建'),
          h('button', { class: 'insp-btn', onclick: () => duplicateLayer(App.activeId) }, '复制'),
          h('button', { class: 'insp-btn', onclick: () => mergeDown(App.activeId) }, '合并')
        ))
    ));

    /* 调整卡 */
    const adjustBody = h('div', { class: 'insp-body' });
    const vals = { brightness: 0, contrast: 0, saturation: 0, temp: 0 };
    let session = false;
    const begin = () => { if (session) return; if (Adjust.start()) session = true; };
    const combo = (img, p) => {
      if (p.brightness || p.contrast) FX.brightnessContrast(img, p);
      if (p.saturation) FX.saturation(img, { saturation: p.saturation });
      if (p.temp) FX.temperature(img, { temp: p.temp / 100 });
    };
    const preview = () => Adjust.preview(combo, vals);
    const commit = () => {
      if (!session) return;
      session = false;
      if (!Object.values(vals).some(v => v !== 0)) { Adjust.cancel(); return; }
      Adjust.commit('快速调整');
      Object.keys(vals).forEach(k => vals[k] = 0);
      Object.values(rows).forEach(r => r.set(0));
      this.refresh();
    };
    const rows = {};
    [['brightness', '亮度'], ['contrast', '对比度'], ['saturation', '饱和度'], ['temp', '色温']].forEach(([k, label]) => {
      const valEl = h('b', {}, '0');
      const inp = h('input', {
        type: 'range', min: -100, max: 100, value: 0,
        oninput: e => {
          const v = parseFloat(e.target.value);
          vals[k] = v; valEl.textContent = v;
          inp.style.setProperty('--p', ((v + 100) / 2) + '%');
          begin(); if (session) preview();
        },
        onchange: commit
      });
      inp.style.setProperty('--p', '50%');
      adjustBody.append(h('div', { class: 'apsis-slider' },
        h('div', { class: 'as-top' }, h('span', {}, label), valEl), inp));
      rows[k] = {
        el: inp,
        set(v) { inp.value = v; valEl.textContent = v; inp.style.setProperty('--p', ((v + 100) / 2) + '%'); }
      };
    });
    adjustBody.append(h('div', { class: 'insp-row' },
      h('button', { class: 'insp-btn', onclick: () => Dialogs.adjustLevels() }, '色阶'),
      h('button', { class: 'insp-btn', onclick: () => Dialogs.adjustHSL() }, '色彩'),
      h('button', { class: 'insp-btn', onclick: () => applyFilterDirect(FX.invert, {}, '反相') }, '反相')
    ));
    const adjustCard = h('div', { class: 'insp-card' },
      h('div', { class: 'insp-head' }, '调整', h('span', { class: 'ih-act' }, '实时预览')),
      adjustBody
    );

    /* 指令卡 */
    const chat = h('div', { class: 'aps-chat', id: 'apsChat' });
    const quick = h('div', { class: 'suggest-row' });
    ['style.film', 'img.crop169', 'txt.title', 'style.mono', 'adj.lightup', 'fx.vignette'].forEach(id => {
      const c = COMMANDS.find(x => x.id === id);
      if (c) quick.append(h('button', { class: 'chip', onclick: () => this.runCmd(id) }, c.label.replace(/…$/, '')));
    });
    const cinput = h('input', {
      type: 'text', class: 'aps-chat-input', placeholder: '输入指令，例如：亮度 +20',
      onkeydown: e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { e.target.value = ''; this.runIntent(v); } e.stopPropagation(); } }
    });
    root.append(h('div', { class: 'insp-card' },
      h('div', { class: 'insp-head' }, '指令', h('span', { class: 'ih-act' }, COMMANDS.length + ' 条')),
      h('div', { class: 'insp-body' }, quick, chat, cinput)
    ));
    /* 存档卡 */
    const arcList = h('div', { id: 'apsArcList', style: { display: 'flex', flexDirection: 'column', gap: '5px' } });
    const arcCard = h('div', { class: 'insp-card collapsed' },
      h('div', { class: 'insp-head' }, '存档', h('span', { class: 'ih-act', id: 'apsArcCount' }, Archives.list.length + ' 个')),
      h('div', { class: 'insp-body' }, arcList,
        h('div', { class: 'insp-row' },
          h('button', { class: 'insp-btn accent', onclick: () => Archives.create() }, '+ 新建存档'),
          h('button', { class: 'insp-btn', onclick: () => Archives.promptClear() }, '清空')))
    );
    root.append(arcCard);
    root.append(adjustCard);

    /* 卡片可折叠 */
    $$('.insp-card', root).forEach(card => {
      const head = $('.insp-head', card);
      if (!head) return;
      head.append(h('span', { class: 'ih-caret', html: icon('chevron', 11) }));
      head.addEventListener('click', () => card.classList.toggle('collapsed'));
    });
    root.scrollTop = 0;
  },

  refresh() {
    if (!this.mounted) return;
    const meta = $('#apsMeta');
    if (meta) {
      meta.innerHTML = '';
      meta.append(
        h('div', { class: 'aps-docname' }, App.doc.name || '未命名'),
        h('div', { class: 'aps-docsub' }, App.doc.w ? `${fmtInt(App.doc.w)} × ${fmtInt(App.doc.h)} px · ${App.layers.length} 个图层` : '没有打开的文档'),
        h('div', { class: 'aps-docrow' }, '选区：' + (App.selection ? `${fmtInt(App.selection.bounds.w)} × ${fmtInt(App.selection.bounds.h)}` : '无'))
      );
    }
    const zl = $('#apsZoom');
    if (zl) zl.textContent = Math.round(App.view.zoom * 100) + '%';
    const lc = $('#apsLayerCount');
    if (lc) lc.textContent = App.layers.length + ' 层';

    const deck = $('#apsDeck');
    if (deck) {
      deck.innerHTML = '';
      if (!App.layers.length) {
        deck.append(h('div', { class: 'aps-empty' }, '还没有图层'));
      }
      [...App.layers].reverse().forEach(l => {
        const thumb = h('div', { class: 'deck-thumb' }, layerThumb(l, 36));
        deck.append(h('div', {
          class: 'deck-card' + (l.id === App.activeId ? ' active' : ''),
          onclick: () => { App.activeId = l.id; sync(); },
          ondblclick: () => { if (l.type === 'text') { Text.open(l); } else Dialogs.renameLayer(l); }
        },
          thumb,
          h('div', { class: 'deck-meta' },
            h('div', { class: 'deck-name' }, l.name),
            h('div', { class: 'deck-sub' }, `${Math.round(l.opacity * 100)}% · ${BLEND_LABEL[l.blend] || l.blend}${l.type === 'text' ? ' · T' : ''}`)
          ),
          h('button', {
            class: 'deck-eye' + (l.visible ? '' : ' off'),
            html: icon(l.visible ? 'eye' : 'eyeOff', 13),
            'aria-label': (l.visible ? '隐藏图层 ' : '显示图层 ') + (l.name || ''),
            title: l.visible ? '隐藏图层' : '显示图层',
            'aria-pressed': l.visible ? 'true' : 'false',
            onclick: e => {
              e.stopPropagation();
              History.begin('图层可见性', []);
              l.visible = !l.visible;
              History.end(); invalidate(); sync();
            }
          })
        ));
      });
    }
    this.renderChat();
    this.renderArchives();
    this.markDock();
  },

  renderArchives() {
    const box = document.getElementById('apsArcList');
    if (!box) return;
    box.innerHTML = '';
    const cnt = document.getElementById('apsArcCount');
    if (cnt) cnt.textContent = Archives.list.length + ' 个';
    if (!Archives.list.length) {
      box.append(h('div', { class: 'aps-empty' }, '还没有存档。'));
      return;
    }
    Archives.list.slice(0, 4).forEach(s => {
      box.append(h('div', { class: 'arc-item' },
        h('img', { class: 'arc-thumb', src: s.thumb, alt: '' }),
        h('div', { class: 'arc-meta' },
          h('div', { class: 'arc-name' }, s.name),
          h('div', { class: 'arc-sub' }, fmtTime(s.time) + ' · ' + s.layers.length + ' 层')),
        h('div', { class: 'arc-acts' },
          h('button', { class: 'arc-btn', title: '还原', html: icon('undo', 12), onclick: () => Archives.restore(s.id) }),
          h('button', { class: 'arc-btn danger', title: '删除', html: icon('trash', 12), onclick: () => Archives.remove(s.id) }))
      ));
    });
  },

  /* ---------------- HUD ---------------- */
  buildHud() {
    const hud = $('#stageHud');
    if (!hud) return;
    hud.innerHTML = '';
    hud.append(h('div', { class: 'hud-chip' }, h('span', { html: icon('bolt', 13) }), h('span', {}, '右键'), h('span', { class: 'hud-key' }, '径向工具')));
    hud.append(h('div', { class: 'hud-chip' }, h('span', { html: icon('search', 13) }), h('span', {}, 'Ctrl K'), h('span', { class: 'hud-key' }, '全部命令')));
    hud.append(h('div', { class: 'hud-chip' }, h('span', { html: icon('hand', 13) }), h('span', {}, '空格拖拽 / 双指'), h('span', { class: 'hud-key' }, '移动画布')));
    hud.style.display = this.cfg.hud ? 'flex' : 'none';
  },

  /* ---------------- 径向菜单 ---------------- */
  radialItems: [
    { id: 'move', label: '移动', icon: 'move' },
    { id: 'marquee', label: '选框', icon: 'marquee' },
    { id: 'brush', label: '画笔', icon: 'brush' },
    { id: 'eraser', label: '橡皮', icon: 'eraser' },
    { id: 'text', label: '文字', icon: 'text' },
    { id: 'shape', label: '形状', icon: 'shape' },
    { id: 'crop', label: '裁剪', icon: 'crop' },
    { id: 'wand', label: '魔棒', icon: 'wand' }
  ],

  openRadial(x, y) {
    const root = $('#radial');
    if (!root) return;
    root.innerHTML = '';
    root.classList.add('on');
    const ring = h('div', { class: 'radial-ring' });
    const vw = window.innerWidth, vh = window.innerHeight;
    const dx = (x == null ? vw / 2 : x) - vw / 2;
    const dy = (y == null ? vh / 2 : y) - vh / 2;
    ring.style.transform = `translate(${dx}px,${dy}px)`;
    ring.append(h('div', { class: 'radial-center' }, '工具'));
    const R = 116;
    this.radialItems.forEach((it, i) => {
      const ang = -Math.PI / 2 + i * (Math.PI * 2 / this.radialItems.length);
      const bx = Math.cos(ang) * R, by = Math.sin(ang) * R;
      const b = h('button', {
        class: 'radial-item', title: `${it.label} (${Tools.defs[it.id]?.key || ''})`,
        style: { left: bx + 'px', top: by + 'px', transitionDelay: (i * 12) + 'ms' },
        onclick: e => { e.stopPropagation(); Tools.setTool(it.id); this.closeRadial(); }
      }, h('span', { html: icon(it.icon, 18) }), h('span', {}, it.label));
      ring.append(b);
    });
    root.append(ring);
    root.onclick = () => this.closeRadial();
    this.radialOpen = true;
  },

  closeRadial() {
    const root = $('#radial');
    if (root) { root.classList.remove('on'); root.innerHTML = ''; }
    this.radialOpen = false;
  },

  /* ---------------- 自定义 ---------------- */
  openSheet() {
    if ($('.sheet')) { $('.sheet').remove(); return; }
    const sheet = h('div', { class: 'sheet' });
    const close = () => sheet.remove();

    const accRow = h('div', { class: 'swatches-mini' });
    APSIS_ACCENTS.forEach(c => {
      accRow.append(h('div', {
        class: 'swatch-mini' + (c === this.cfg.accent ? ' active' : ''),
        style: { background: c },
        onclick: () => {
          this.cfg.accent = c;
          $$('.swatch-mini', accRow).forEach(s => s.classList.remove('active'));
          const me = $$('.swatch-mini', accRow).find(s => s.style.background === c || s.style.backgroundColor === c);
          if (me) me.classList.add('active');
          this.applyCfg(); this.saveCfg();
        }
      }));
    });

    const radiusVal = h('b', { style: { fontFamily: 'var(--mono)', fontSize: '10px', color: '#cfcfda' } }, this.cfg.radius + 'px');
    const radiusInp = h('input', {
      type: 'range', min: 0, max: 26, value: this.cfg.radius, class: 'set-range',
      oninput: e => { this.cfg.radius = parseInt(e.target.value); radiusVal.textContent = this.cfg.radius + 'px'; this.applyCfg(); },
      onchange: () => this.saveCfg()
    });

    const dens = h('select', {
      class: 'aps-select', style: { width: '132px' },
      onchange: e => { this.cfg.density = e.target.value; this.applyCfg(); this.saveCfg(); }
    }, ...[['compact', '紧凑'], ['normal', '标准'], ['loose', '舒展']].map(([v, l]) => h('option', { value: v, selected: this.cfg.density === v }, l)));

    const bgSel = h('select', {
      class: 'aps-select', style: { width: '132px' },
      onchange: e => { this.cfg.bg = e.target.value; this.applyCfg(); this.saveCfg(); }
    }, ...[['deep', '深空'], ['black', '纯黑'], ['warm', '暖灰']].map(([v, l]) => h('option', { value: v, selected: this.cfg.bg === v }, l)));

    const hudT = h('div', {
      class: 'toggle' + (this.cfg.hud ? ' on' : ''),
      onclick: e => {
        this.cfg.hud = !this.cfg.hud;
        e.currentTarget.classList.toggle('on', this.cfg.hud);
        this.applyCfg(); this.saveCfg();
      }
    });

    const dockRow = h('div', { class: 'suggest-row' });
    const allTools = [['move', '移动'], ['marquee', '选框'], ['lasso', '套索'], ['wand', '魔棒'], ['crop', '裁剪'], ['brush', '画笔'], ['eraser', '橡皮'], ['bucket', '油漆桶'], ['gradient', '渐变'], ['blur', '模糊'], ['dodge', '减淡'], ['text', '文字'], ['shape', '形状'], ['hand', '抓手'], ['zoom', '缩放']];
    allTools.forEach(([id, label]) => {
      const on = this.cfg.dock.includes(id);
      dockRow.append(h('button', {
        class: 'chip' + (on ? ' on' : ''),
        onclick: e => {
          if (this.cfg.dock.includes(id)) {
            if (this.cfg.dock.length <= 3) { toast('至少保留 3 个工具', 'err'); return; }
            this.cfg.dock = this.cfg.dock.filter(x => x !== id);
          } else {
            this.cfg.dock.push(id);
          }
          e.currentTarget.classList.toggle('on');
          this.buildDock(); this.saveCfg();
        }
      }, label));
    });

    sheet.append(
      h('div', { class: 'sheet-head' }, '自定义 Apsis',
        h('button', { class: 'sh-close', html: icon('close', 14), onclick: close })),
      h('div', { class: 'sheet-body' },
        h('div', { class: 'set-block' }, h('div', { class: 'set-title' }, '强调色'), accRow,
          h('div', { class: 'hint', style: { fontSize: '9.5px', color: '#5f5f6b' } }, '影响选区、按钮、高亮与画布柔光')),
        h('div', { class: 'set-block' }, h('div', { class: 'set-title' }, '界面'),
          h('div', { class: 'set-line' }, h('span', {}, '圆角'), radiusInp, radiusVal),
          h('div', { class: 'set-line' }, h('span', {}, '密度'), dens),
          h('div', { class: 'set-line' }, h('span', {}, '画布底色'), bgSel),
          h('div', { class: 'set-line' }, h('span', {}, '显示手势提示'), hudT)
        ),
        h('div', { class: 'set-block' }, h('div', { class: 'set-title' }, '底部工具坞'),
          dockRow),
        h('div', { class: 'set-block' },
          h('button', {
            class: 'insp-btn', onclick: () => {
              this.cfg = { accent: '#7b8cff', radius: 16, density: 'normal', bg: 'deep', hud: true, dock: ['move', 'marquee', 'brush', 'eraser', 'text', 'shape', 'crop'] };
              this.applyCfg(); this.saveCfg(); this.buildDock(); close(); toast('已恢复默认', 'ok');
            }
          }, '恢复默认'))
      )
    );
    $('#app').append(sheet);
    setTimeout(() => {
      const off = e => { if (!sheet.contains(e.target) && !e.target.closest('#apsisCustomize')) { sheet.remove(); document.removeEventListener('pointerdown', off); } };
      document.addEventListener('pointerdown', off);
    }, 40);
  }
};

