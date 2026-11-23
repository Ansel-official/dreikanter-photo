/* ==========================================================================
   Dreikanter photo — dialogs.js
   模态框 / 调色对话框 / 颜色选择器 / 示例文档
   ========================================================================== */
'use strict';

function modal({ title, sub, body, actions = [], width = 390, onClose }) {
  const veil = h('div', { class: 'modal-veil' });
  const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const close = () => {
    veil.remove();
    document.removeEventListener('keydown', esc, true);
    if (onClose) onClose();
  };
  const head = h('div', { class: 'modal-head' },
    h('span', {}, title),
    sub ? h('span', { class: 'mh-sub' }, sub) : '',
    h('button', { class: 'modal-close', onclick: close, html: icon('close', 13) })
  );
  const bodyEl = h('div', { class: 'modal-body' });
  addKids(bodyEl, [body].flat(5).filter(Boolean));
  const foot = h('div', { class: 'modal-foot' });
  actions.forEach(a => {
    foot.append(h('button', {
      class: 'btn ' + (a.primary ? 'primary' : a.ghost ? 'ghost' : ''),
      onclick: () => {
        const r = a.onClick ? a.onClick() : undefined;
        if (r !== false) close();
      }
    }, a.label));
  });
  const box = h('div', { class: 'modal', style: { width: width + 'px' }, role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, head, bodyEl, actions.length ? foot : '');
  veil.append(box);
  setTimeout(() => {
    const f = box.querySelector('input:not([type=hidden]):not([type=color]), select, textarea') ||
      box.querySelector('.modal-foot .btn.primary') || box.querySelector('.modal-close');
    if (f) f.focus();
  }, 40);
  veil.addEventListener('mousedown', e => { if (e.target === veil) close(); });
  document.addEventListener('keydown', esc, true);
  $('#modalroot').append(veil);
  return { close, body: bodyEl, veil };
}

function fieldEl(label, control, hint) {
  return h('div', { class: 'field' }, h('label', {}, label), control, hint ? h('div', { class: 'hint' }, hint) : '');
}

function numInput(value, { min, max, step = 1, onChange } = {}) {
  return h('input', {
    type: 'number', value, min, max, step,
    oninput: e => { if (onChange) onChange(parseFloat(e.target.value)); }
  });
}

const Dialogs = {

  /* ---------------- 新建 ---------------- */
  newDoc() {
    const presets = [
      ['1600 × 1000 · 横版', 1600, 1000],
      ['1080 × 1440 · 小红书', 1080, 1440],
      ['1080 × 1920 · 抖音 / 竖屏', 1080, 1920],
      ['900 × 383 · 公众号封面', 900, 383],
      ['1080 × 1080 · 方图', 1080, 1080],
      ['1920 × 1080 · 高清', 1920, 1080],
      ['2480 × 3508 · A4 300dpi', 2480, 3508],
      ['800 × 800 · 头像', 800, 800]
    ];
    const sd = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : {};
    const wIn = numInput(sd.newW || 1600, { min: 1, max: 20000 });
    const hIn = numInput(sd.newH || 1000, { min: 1, max: 20000 });
    const nameIn = h('input', { type: 'text', value: '未命名', spellcheck: 'false' });
    const bgs = [['transparent', '透明'], ['#ffffff', '白色'], ['#000000', '黑色'], ['#1a1a1a', '深灰'], ['#f4efe6', '米色']];
    const bgSel = h('select', {}, ...bgs.map(([v, l]) => h('option', { value: v, selected: (sd.newBg || 'transparent') === v }, l)));
    const dpiIn = numInput(sd.newDpi || 72, { min: 1, max: 2400 });
    const presetSel = h('select', {
      onchange: e => {
        const p = presets[parseInt(e.target.value)];
        if (p) { wIn.value = p[1]; hIn.value = p[2]; }
      }
    }, ...presets.map((p, i) => h('option', { value: i }, p[0])));

    const m = modal({
      title: '新建画布', sub: 'Dreikanter photo', width: 420,
      body: [
        fieldEl('预设', presetSel),
        h('div', { class: 'field-row' }, fieldEl('宽度 px', wIn), fieldEl('高度 px', hIn)),
        h('div', { class: 'field-row' }, fieldEl('分辨率 DPI', dpiIn), fieldEl('名称', nameIn)),
        fieldEl('背景', bgSel),
        h('div', { class: 'hint' }, 'DPI 影响标尺的 mm / in / pt 换算与印刷尺寸；屏幕用途保持 72 即可。')
      ],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '创建', primary: true, onClick: () => {
            const w = clamp(parseInt(wIn.value) || 1600, 1, 20000);
            const hh = clamp(parseInt(hIn.value) || 1000, 1, 20000);
            const dpi = clamp(parseInt(dpiIn.value) || 72, 1, 2400);
            newDocument(w, hh, { bg: bgSel.value, name: nameIn.value || '未命名', dpi });
            hideWelcome();
            UI.updateStatus();
            toast(`已新建 ${w} × ${hh} 画布 · ${dpi} ppi`, 'ok');
          }
        }
      ]
    });
    setTimeout(() => wIn.focus(), 50);
  },

  /* ---------------- 导出 ---------------- */
  exportDoc(type) {
    if (!App.doc.w) { toast('没有可导出的文档', 'err'); return; }
    const isJpg = type === 'image/jpeg';
    const ext = isJpg ? '.jpg' : type === 'image/webp' ? '.webp' : '.png';
    const sd = (typeof Settings !== 'undefined' && Settings.data) ? Settings.data : {};
    const base0 = baseName(App.doc.name);
    const nameIn = h('input', { type: 'text', value: base0 });
    const tplIn = h('input', { type: 'text', value: sd.nameTemplate || '{name}-{size}-{date}-{time}', spellcheck: 'false' });
    const prefixIn = h('input', { type: 'text', value: sd.exportPrefix || '', spellcheck: 'false', placeholder: '可选，如 2026_' });
    const q0 = sd.exportQuality || 92;
    const qIn = h('input', { type: 'range', min: 40, max: 100, value: q0, class: 'opt-range', style: { width: '100%' } });
    const qVal = h('span', { class: 'val' }, String(q0));
    qIn.oninput = () => qVal.textContent = qIn.value;
    const multi = h('input', { type: 'checkbox' });
    const preview = h('div', { class: 'hint mono' }, '');
    const refreshName = () => {
      Settings.data.nameTemplate = tplIn.value || '{name}-{size}-{date}-{time}';
      Settings.data.exportPrefix = prefixIn.value;
      preview.textContent = exportName(nameIn.value || 'image', null, 1) + ext;
    };
    [nameIn, tplIn, prefixIn].forEach(el => el.oninput = refreshName);
    refreshName();
    const sizeLine = h('div', { class: 'hint' }, '输出尺寸 ' + fmtInt(App.doc.w) + ' × ' + fmtInt(App.doc.h) + ' px · ' + (App.doc.dpi || 72) + ' ppi');
    const issues = exportPreflight();
    const warn = issues.length
      ? h('div', { class: 'hint', style: { color: '#e8b35a' } }, '导出前检查：' + issues.join(' · '))
      : h('div', { class: 'hint', style: { color: '#5fbf8f' } }, '导出前检查通过');
    const PRESETS = [
      ['original', '原始尺寸'],
      ['xhs', '小红书 1080 × 1440'],
      ['douyin', '抖音 1080 × 1920'],
      ['wechat', '公众号封面 900 × 383'],
      ['avatar', '头像 800 × 800']
    ];
    const presetSel = h('select', {}, ...PRESETS.map(([v, l]) => h('option', { value: v }, l)));

    modal({
      title: '导出图像', sub: isJpg ? 'JPEG' : type === 'image/webp' ? 'WEBP' : 'PNG', width: 420,
      body: [
        fieldEl('文件名（基础名）', nameIn),
        h('div', { class: 'field-row' },
          fieldEl('命名模板', tplIn, '可用 {name} {size} {date} {time} {w} {h}'),
          fieldEl('前缀', prefixIn)),
        h('div', { class: 'hint mono' }, '预览：' + preview.textContent),
        isJpg || type === 'image/webp'
          ? fieldEl('品质', h('div', { class: 'opacity-line' }, qIn, qVal))
          : h('div', { class: 'hint' }, 'PNG 支持透明通道，无损压缩。'),
        h('label', { class: 'opt-check' }, multi, '同时导出 1× / 2× / 0.5× 三个版本'),
        fieldEl('平台尺寸（裁切填满）', presetSel),
        sizeLine,
        warn
      ],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '加入导出队列', primary: true, onClick: () => {
            Settings.set('nameTemplate', tplIn.value || '{name}-{size}-{date}-{time}', false);
            Settings.set('exportPrefix', prefixIn.value, false);
            const q = parseInt(qIn.value) / 100;
            const BOX = { xhs: [1080, 1440], douyin: [1080, 1920], wechat: [900, 383], avatar: [800, 800] };
            const dims = BOX[presetSel.value];
            const box = dims ? { w: dims[0], h: dims[1] } : null;
            const base = baseName(nameIn.value || base0);
            const jobs = [];
            if (multi.checked) [2, 1, .5].forEach(sc => {
              const suffix = sc === 2 ? '@2x' : sc === .5 ? '@0.5x' : '';
              jobs.push({ type, quality: q, name: exportName(base + suffix, box, sc) + ext, scale: sc, box });
            });
            else jobs.push({ type, quality: q, name: exportName(base, box, 1) + ext, scale: 1, box });
            jobs.forEach(j => ExportQueue.push(j));
            UI.renderExportQueue();
            UI.togglePanel('exportq', true);
            toast('已加入导出队列：' + jobs.length + ' 项', 'ok');
          }
        }
      ]
    });
  },

  /* ---------------- 图像 / 画布大小 ---------------- */
  imageSize() {
    if (!App.doc.w) return;
    let ratio = App.doc.h / App.doc.w;
    const wIn = numInput(App.doc.w, { min: 1, max: 20000 });
    const hIn = numInput(App.doc.h, { min: 1, max: 20000 });
    const dpiIn = numInput(App.doc.dpi || 72, { min: 1, max: 2400 });
    /* 物理尺寸随 DPI 联动：改了 DPI，像素尺寸按物理尺寸换算 */
    let lockPhys = false;
    const phys = () => ({
      w: (App.doc.w / (App.doc.dpi || 72)),
      h: (App.doc.h / (App.doc.dpi || 72))
    });
    wIn.oninput = () => { hIn.value = Math.round((parseInt(wIn.value) || 1) * ratio); };
    hIn.oninput = () => { wIn.value = Math.round((parseInt(hIn.value) || 1) / ratio); };
    dpiIn.oninput = () => {
      if (!lockPhys) return;
      const p = phys();
      const d = clamp(parseInt(dpiIn.value) || 72, 1, 2400);
      wIn.value = Math.round(p.w * d);
      hIn.value = Math.round(p.h * d);
    };
    const lockCk = h('input', {
      type: 'checkbox',
      onchange: e => { lockPhys = e.target.checked; }
    });
    modal({
      title: '图像大小', sub: '重采样全部图层', width: 400,
      body: [
        h('div', { class: 'field-row' }, fieldEl('宽度 px', wIn), fieldEl('高度 px', hIn)),
        h('div', { class: 'field-row' }, fieldEl('分辨率 DPI', dpiIn), fieldEl('保持物理尺寸', lockCk)),
        h('div', { class: 'hint' }, `当前 ${fmtInt(App.doc.w)} × ${fmtInt(App.doc.h)} px · ${App.doc.dpi || 72} ppi → ${Units.fmt(App.doc.w, 'mm', 'x')} × ${Units.fmt(App.doc.h, 'mm', 'y')}`)
      ],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '应用', primary: true, onClick: () => {
            const d = clamp(parseInt(dpiIn.value) || 72, 1, 2400);
            resizeImage(parseInt(wIn.value) || App.doc.w, parseInt(hIn.value) || App.doc.h);
            if (d !== App.doc.dpi) {
              App.doc.dpi = d;
              if (typeof Docs !== 'undefined') Docs.markDirty();
            }
            UI.updateStatus();
            toast('图像大小已更改', 'ok');
          }
        }
      ]
    });
  },

  canvasSize() {
    if (!App.doc.w) return;
    const wIn = numInput(App.doc.w, { min: 1, max: 20000 });
    const hIn = numInput(App.doc.h, { min: 1, max: 20000 });
    let anchor = [.5, .5];
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,26px)', gap: '3px' } });
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      const b = h('button', {
        style: {
          height: '22px', borderRadius: '3px', background: (x === 1 && y === 1) ? 'var(--accent)' : '#333',
          border: '1px solid #444', cursor: 'pointer'
        },
        onclick: () => {
          anchor = [x / 2, y / 2];
          $$('button', grid).forEach((el, i) => el.style.background = (i === y * 3 + x) ? 'var(--accent)' : '#333');
        }
      });
      grid.append(b);
    }
    modal({
      title: '画布大小', sub: '不缩放图层内容', width: 380,
      body: [
        h('div', { class: 'field-row' }, fieldEl('宽度 px', wIn), fieldEl('高度 px', hIn)),
        fieldEl('定位锚点', grid)
      ],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '应用', primary: true, onClick: () => {
            resizeCanvas(parseInt(wIn.value) || App.doc.w, parseInt(hIn.value) || App.doc.h, anchor[0], anchor[1]);
            toast('画布大小已更改', 'ok');
          }
        }
      ]
    });
  },

  /* 通用数值对话框 */
  value({ title, label, min = 0, max = 100, step = 1, value = 0, unit = '', onApply }) {
    const valEl = h('span', { class: 'val' }, value + unit);
    const inp = h('input', { type: 'range', min, max, step, value });
    const sync = () => {
      valEl.textContent = inp.value + unit;
      inp.style.setProperty('--p', ((inp.value - min) / (max - min) * 100) + '%');
    };
    inp.addEventListener('input', sync);
    sync();
    modal({
      title, width: 360,
      body: [h('div', { class: 'slider-row' },
        h('div', { class: 'slider-top' }, h('label', {}, label), valEl),
        inp)],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '应用', primary: true, onClick: () => {
            const v = parseFloat(inp.value);
            if (onApply) onApply(v);
          }
        }
      ]
    });
  },

  opacity() {
    const l = activeLayer();
    if (!l) { toast('没有可编辑图层', 'err'); return; }
    this.value({
      title: '图层不透明度', label: '不透明度', min: 0, max: 100, value: Math.round(l.opacity * 100), unit: '%',
      onApply: v => {
        History.begin('不透明度', []);
        l.opacity = v / 100;
        History.end(); invalidate(); sync();
        toast('不透明度 ' + v + '%', 'ok');
      }
    });
  },

  blend() {
    const l = activeLayer();
    if (!l) { toast('没有可编辑图层', 'err'); return; }
    const sel = h('select', {}, ...BLEND_MODES.map(([v, label]) => h('option', { value: v, selected: l.blend === v }, label)));
    modal({
      title: '混合模式', width: 340,
      body: [fieldEl('模式', sel)],
      actions: [
        { label: '取消', ghost: true },
        {
          label: '应用', primary: true, onClick: () => {
            History.begin('混合模式', []);
            l.blend = sel.value;
            History.end(); invalidate(); sync();
            toast('混合模式：' + BLEND_LABEL[sel.value], 'ok');
          }
        }
      ]
    });
  },

  /* 图层样式：描边 / 投影 / 外发光 */
  layerStyle(l) {
    l = l || activeLayer();
    if (!l) { toast('请先选择一个图层', 'err'); return; }
    const before = l.effects ? JSON.parse(JSON.stringify(l.effects)) : null;
    const fx = l.effects ? JSON.parse(JSON.stringify(l.effects)) : {};
    ['stroke', 'shadow', 'glow'].forEach(k => { fx[k] = fx[k] || { on: false }; });
    History.begin('图层样式', [l.id]);

    const apply = () => { l.effects = fx; invalidate(); sync(); };
    const body = [];

    const block = (title, key, controls) => {
      const cb = h('input', {
        type: 'checkbox', checked: !!fx[key].on,
        onchange: e => { fx[key].on = e.target.checked; apply(); }
      });
      const wrap = h('div', { class: 'fx-block' }, h('label', { class: 'opt-check' }, cb, title));
      controls.forEach(c => {
        if (c.type === 'color') {
          const inp = h('input', {
            type: 'color', value: fx[key][c.key] || c.def,
            style: { height: '24px', width: '52px', background: '#1f1f1f', border: '1px solid #454545', borderRadius: '4px' },
            oninput: e => { fx[key][c.key] = e.target.value; apply(); }
          });
          wrap.append(h('div', { class: 'fx-line' }, h('span', { class: 'opt-label' }, c.label), inp));
        } else {
          const val = h('span', { class: 'val' }, (fx[key][c.key] == null ? c.def : fx[key][c.key]));
          const inp = h('input', {
            type: 'range', min: c.min, max: c.max, step: c.step || 1, value: fx[key][c.key] == null ? c.def : fx[key][c.key],
            oninput: () => {
              fx[key][c.key] = parseFloat(inp.value);
              val.textContent = inp.value;
              inp.style.setProperty('--p', ((inp.value - c.min) / (c.max - c.min) * 100) + '%');
              apply();
            }
          });
          inp.style.setProperty('--p', (((fx[key][c.key] == null ? c.def : fx[key][c.key]) - c.min) / (c.max - c.min) * 100) + '%');
          wrap.append(h('div', { class: 'slider-row' },
            h('div', { class: 'slider-top' }, h('label', {}, c.label), val), inp));
        }
      });
      body.push(wrap);
    };

    block('描边', 'stroke', [
      { key: 'size', label: '大小', min: 1, max: 40, def: 4 },
      { key: 'color', label: '颜色', type: 'color', def: '#ffffff' }
    ]);
    block('投影', 'shadow', [
      { key: 'dx', label: '水平偏移', min: -60, max: 60, def: 8 },
      { key: 'dy', label: '垂直偏移', min: -60, max: 60, def: 12 },
      { key: 'blur', label: '模糊', min: 0, max: 60, def: 14 },
      { key: 'opacity', label: '不透明度', min: 0, max: 1, step: .01, def: .55 },
      { key: 'color', label: '颜色', type: 'color', def: '#000000' }
    ]);
    block('外发光', 'glow', [
      { key: 'size', label: '大小', min: 1, max: 80, def: 24 },
      { key: 'opacity', label: '强度', min: 0, max: 1, step: .01, def: .85 },
      { key: 'color', label: '颜色', type: 'color', def: '#7b8cff' }
    ]);

    modal({
      title: '图层样式', sub: l.name, width: 420,
      body,
      actions: [
        {
          label: '清除全部', ghost: true, onClick: () => {
            l.effects = null;
            if (History.pending) History.pending = null;
            invalidate(); sync();
            toast('已清除样式');
          }
        },
        {
          label: '取消', ghost: true, onClick: () => {
            l.effects = before;
            if (History.pending) History.pending = null;
            invalidate(); sync();
          }
        },
        {
          label: '确定', primary: true, onClick: () => {
            if (History.pending) History.end();
            invalidate(); sync();
            toast('图层样式已应用', 'ok');
          }
        }
      ]
    });
  },

  renameLayer(l) {
    const inp = h('input', { type: 'text', value: l.name });
    modal({
      title: '重命名图层', width: 340,
      body: [fieldEl('名称', inp)],
      actions: [{ label: '取消', ghost: true }, { label: '确定', primary: true, onClick: () => { l.name = inp.value || l.name; sync(); } }]
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  },

  /* ---------------- 选区 ---------------- */
  /* 选区精修：羽化 / 扩展 / 收缩，带实时预览 */
  refineSelection(mode0) {
    if (!App.selection) { toast('请先建立选区', 'err'); return; }
    let mode = mode0 || 'feather';
    const mkRange = (v, min, max) => h('input', { type: 'range', class: 'opt-range', min, max, value: v, style: { width: '100%' } });
    const range = mkRange(6, 0, 100);
    const num = numInput(6, { min: 0, max: 200 });
    const valLine = h('div', { class: 'hint' }, '');
    const tabs = h('div', { class: 'seg small' });
    const defs = [['feather', '羽化'], ['expand', '扩展'], ['contract', '收缩']];
    const opts = () => ({ feather: mode === 'feather' ? (parseInt(num.value) || 0) : 0, expand: mode === 'expand' ? (parseInt(num.value) || 0) : mode === 'contract' ? -(parseInt(num.value) || 0) : 0 });
    let raf = 0;
    const preview = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!App.selection) return;
        App.selPreviewMask = selectionPreview(App.selection, opts());
        invalidateOverlay();
        const b = App.selection.bounds;
        valLine.textContent = '当前选区 ' + Math.round(b.w) + ' × ' + Math.round(b.h) + ' px · ' + (opts().feather ? '羽化 ' : opts().expand >= 0 ? '扩展 ' : '收缩 ') + Math.abs(parseInt(num.value) || 0) + ' px';
      });
    };
    defs.forEach(([v, label]) => {
      const btn = h('button', {
        class: mode === v ? 'active' : '',
        onclick: () => {
          mode = v;
          [...tabs.children].forEach(c => c.classList.toggle('active', c === btn));
          preview();
        }
      }, label);
      tabs.append(btn);
    });
    range.oninput = () => { num.value = range.value; preview(); };
    num.oninput = () => { range.value = clamp(parseInt(num.value) || 0, 0, 100); preview(); };
    modal({
      title: '精修选区', sub: '羽化 / 扩展 / 收缩', width: 380,
      body: [
        tabs,
        fieldEl('半径 px', range),
        h('div', { class: 'field-row' }, fieldEl('精确值', num), fieldEl('提示', h('div', { class: 'hint' }, '画布上以浅蓝叠加显示预览'))),
        valLine
      ],
      onClose: () => {
        cancelAnimationFrame(raf);
        App.selPreviewMask = null;
        invalidateOverlay();
      },
      actions: [
        { label: '取消', ghost: true },
        {
          label: '应用', primary: true, onClick: () => {
            applySelectionRefine(opts());
            toast('选区已更新', 'ok');
          }
        }
      ]
    });
    preview();
  },

  feather() { this.refineSelection('feather'); },

  expandSel() { this.refineSelection('expand'); },

  /* 载入选区 */
  loadSelection() {
    const slots = App.selSlots || [];
    if (!slots.length) { toast('还没有保存过选区', 'err'); return; }
    const list = h('div', { class: 'arc-list' });
    slots.forEach((s, i) => {
      list.append(h('button', {
        class: 'btn', style: { margin: '0 0 6px', width: '100%' },
        onclick: () => { loadSelectionSlot(i); m.close(); }
      }, '选区 ' + (i + 1) + ' · ' + Math.round(s.bounds.w) + ' × ' + Math.round(s.bounds.h) + ' px · ' + fmtTime(s.at)));
    });
    const m = modal({ title: '载入选区', width: 360, body: [list], actions: [{ label: '取消', ghost: true }] });
    App.selPreviewMask = null;
  },

  /* ---------------- 调整对话框 ---------------- */
  adjust(title, fields, fn, sub) {
    if (!App.doc.w) return;
    if (!Adjust.start()) { toast('请选择一个图层', 'err'); return; }
    const vals = {};
    fields.forEach(f => vals[f.key] = f.def);
    const body = [];
    const controls = {};
    fields.forEach(f => {
      if (f.type === 'color') {
        const inp = h('input', { type: 'color', value: f.def, style: { height: '27px', width: '100%', background: '#1f1f1f', border: '1px solid #454545', borderRadius: '5px' } });
        inp.oninput = () => { vals[f.key] = inp.value; requestPreview(); };
        controls[f.key] = { el: fieldEl(f.label, inp), set: v => inp.value = v };
        body.push(controls[f.key].el);
      } else if (f.type === 'select') {
        const sel = h('select', {}, ...(f.options || []).map(([v, l]) => h('option', { value: v, selected: v === f.def }, l)));
        sel.onchange = () => { vals[f.key] = sel.value; requestPreview(); };
        controls[f.key] = { el: fieldEl(f.label, sel), set: v => sel.value = v };
        body.push(controls[f.key].el);
      } else if (f.type === 'check') {
        const inp = h('input', { type: 'checkbox', checked: !!f.def });
        inp.onchange = () => { vals[f.key] = inp.checked; requestPreview(); };
        controls[f.key] = { el: h('label', { class: 'opt-check' }, inp, f.label), set: v => inp.checked = v };
        body.push(controls[f.key].el);
      } else {
        const val = h('span', { class: 'val' }, f.def);
        const inp = h('input', {
          type: 'range', min: f.min, max: f.max, step: f.step || 1, value: f.def,
          oninput: () => {
            const v = parseFloat(inp.value);
            vals[f.key] = v; val.textContent = v;
            inp.style.setProperty('--p', ((v - f.min) / (f.max - f.min) * 100) + '%');
            requestPreview();
          }
        });
        inp.style.setProperty('--p', ((f.def - f.min) / (f.max - f.min) * 100) + '%');
        controls[f.key] = {
          el: h('div', { class: 'slider-row' }, h('div', { class: 'slider-top' }, h('label', {}, f.label), val), inp),
          set: v => { inp.value = v; val.textContent = v; }
        };
        body.push(controls[f.key].el);
      }
    });
    let raf = 0;
    const requestPreview = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; Adjust.preview(fn, vals); });
    };
    Adjust.preview(fn, vals);
    modal({
      title, sub: sub || '实时预览', width: 400,
      body,
      actions: [
        {
          label: '取消', ghost: true, onClick: () => { Adjust.cancel(); }
        },
        {
          label: '确定', primary: true, onClick: () => { Adjust.commit(title); toast(title + ' 已应用', 'ok'); }
        }
      ],
      onClose: () => { if (Adjust.layer) Adjust.cancel(); }
    });
  },

  cameraLut(preset) {
    const ids = (typeof LOOK_IDS !== 'undefined') ? LOOK_IDS : ['hasselblad'];
    this.adjust('相机 LUT', [
      {
        key: 'look', label: '风格', type: 'select', def: preset || 'hasselblad',
        options: ids.map(id => [id, CAMERA_LOOKS[id].name + ' · ' + CAMERA_LOOKS[id].en])
      },
      { key: 'intensity', label: '强度', min: 0, max: 100, def: 100 }
    ], FX.cameraLook, '哈苏 / 大疆 / 影石 / 徕卡 / 富士');
  },

  adjustBrightness() {
    this.adjust('亮度 / 对比度', [
      { key: 'brightness', label: '亮度', min: -100, max: 100, def: 0 },
      { key: 'contrast', label: '对比度', min: -100, max: 100, def: 0 }
    ], FX.brightnessContrast);
  },
  adjustLevels() {
    this.adjust('色阶', [
      { key: 'black', label: '输入黑场', min: 0, max: 250, def: 0 },
      { key: 'white', label: '输入白场', min: 5, max: 255, def: 255 },
      { key: 'gamma', label: '中间调 Gamma', min: 0.1, max: 4, step: 0.01, def: 1 },
      { key: 'outBlack', label: '输出黑场', min: 0, max: 255, def: 0 },
      { key: 'outWhite', label: '输出白场', min: 0, max: 255, def: 255 }
    ], FX.levels);
  },
  adjustExposure() {
    this.adjust('曝光度', [{ key: 'exposure', label: '曝光', min: -100, max: 100, def: 0 }], FX.exposure);
  },
  adjustHSL() {
    this.adjust('色相 / 饱和度', [
      { key: 'hue', label: '色相', min: -180, max: 180, def: 0 },
      { key: 'saturation', label: '饱和度', min: -100, max: 100, def: 0 },
      { key: 'lightness', label: '明度', min: -100, max: 100, def: 0 }
    ], FX.saturation);
  },
  adjustVibrance() {
    this.adjust('鲜艳度', [{ key: 'vibrance', label: '鲜艳度', min: -100, max: 100, def: 0 }], FX.vibrance);
  },
  adjustTemp() {
    this.adjust('色温 / 色调', [
      { key: 'temp', label: '色温（冷 → 暖）', min: -100, max: 100, def: 0 },
      { key: 'tint', label: '色调（绿 → 洋红）', min: -100, max: 100, def: 0 }
    ], FX.temperature);
  },
  adjustBW() {
    this.adjust('黑白', [
      { key: 'mixR', label: '红', min: 0, max: 100, def: 30 },
      { key: 'mixG', label: '绿', min: 0, max: 100, def: 59 },
      { key: 'mixB', label: '蓝', min: 0, max: 100, def: 11 },
      { key: 'tone', label: '色调浓度', min: 0, max: 100, def: 0 }
    ], FX.blackWhite);
  },
  adjustBalance() {
    this.adjust('颜色平衡', [
      { key: 'r', label: '红色偏移', min: -100, max: 100, def: 0 },
      { key: 'g', label: '绿色偏移', min: -100, max: 100, def: 0 },
      { key: 'b', label: '蓝色偏移', min: -100, max: 100, def: 0 }
    ], FX.colorBalance);
  },
  adjustGradientMap() {
    this.adjust('渐变映射', [
      { key: 'dark', label: '暗部颜色', type: 'color', def: '#1b1b3a' },
      { key: 'light', label: '亮部颜色', type: 'color', def: '#f0d9b5' }
    ], FX.gradientMap);
  },
  adjustThreshold() {
    this.adjust('阈值', [{ key: 'level', label: '阈值色阶', min: 1, max: 255, def: 128 }], FX.threshold);
  },
  adjustPosterize() {
    this.adjust('色调分离', [{ key: 'levels', label: '色阶数', min: 2, max: 32, def: 6 }], FX.posterize);
  },
  fxBlur() {
    this.adjust('高斯模糊', [{ key: 'radius', label: '半径', min: 0.1, max: 80, step: 0.1, def: 6 }], FX.blur);
  },
  fxMotionBlur() {
    this.adjust('动感模糊', [
      { key: 'angle', label: '角度', min: -180, max: 180, def: 0 },
      { key: 'distance', label: '距离', min: 1, max: 120, def: 20 }
    ], FX.motionBlur);
  },
  fxSharpen() {
    this.adjust('锐化', [
      { key: 'amount', label: '数量', min: 0, max: 200, def: 60 },
      { key: 'radius', label: '半径', min: 0.5, max: 8, step: 0.1, def: 2 }
    ], FX.sharpen);
  },
  fxNoise() {
    this.adjust('添加杂色', [
      { key: 'amount', label: '数量', min: 1, max: 80, def: 12 },
      { key: 'mono', label: '单色', type: 'check', def: false }
    ], FX.noise);
  },
  fxGrain() {
    this.adjust('胶片颗粒', [
      { key: 'amount', label: '数量', min: 1, max: 90, def: 22 },
      { key: 'size', label: '颗粒大小', min: 1, max: 4, def: 1 }
    ], FX.grain);
  },
  fxPixelate() {
    this.adjust('像素化', [{ key: 'size', label: '单元格', min: 2, max: 100, def: 12 }], FX.pixelate);
  },
  fxVignette() {
    this.adjust('暗角', [
      { key: 'amount', label: '强度', min: 0, max: 100, def: 45 },
      { key: 'size', label: '范围', min: 0, max: 100, def: 60 }
    ], FX.vignette);
  },
  fxFade() {
    this.adjust('褪色', [{ key: 'amount', label: '数量', min: 0, max: 100, def: 30 }], FX.fade);
  },
  fxGlow() {
    this.adjust('发光', [
      { key: 'radius', label: '半径', min: 1, max: 80, def: 16 },
      { key: 'intensity', label: '强度', min: 0, max: 100, def: 40 }
    ], FX.glow);
  },

  /* ---------------- 颜色选择器 ---------------- */
  color(initial, cb) {
    let { h: hh, s, v } = rgbToHsv(...Object.values(hexToRgb(initial)));
    let hex = initial;
    const sv = h('canvas', { width: 320, height: 160, style: { display: 'block', width: '100%', height: '100%' } });
    const cursor = h('div', { class: 'cursor' });
    const svWrap = h('div', { class: 'picker-sv' }, sv, cursor);
    const hueCursor = h('div', { class: 'cursor' });
    const hueWrap = h('div', { class: 'picker-hue' }, hueCursor);
    const hexIn = h('input', { class: 'color-hex', value: hex.toUpperCase(), style: { width: '100%' } });

    const draw = () => {
      const c = ctx2d(sv);
      const W = 320, H = 160;
      const base = hsvToRgb(hh, 1, 1);
      c.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
      c.fillRect(0, 0, W, H);
      const gw = c.createLinearGradient(0, 0, W, 0);
      gw.addColorStop(0, 'rgba(255,255,255,1)');
      gw.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gw; c.fillRect(0, 0, W, H);
      const gb = c.createLinearGradient(0, 0, 0, H);
      gb.addColorStop(0, 'rgba(0,0,0,0)');
      gb.addColorStop(1, 'rgba(0,0,0,1)');
      c.fillStyle = gb; c.fillRect(0, 0, W, H);
      cursor.style.left = (s * 100) + '%';
      cursor.style.top = ((1 - v) * 100) + '%';
      hueCursor.style.left = (hh / 360 * 100) + '%';
    };
    const sync = () => {
      const rgb = hsvToRgb(hh, s, v);
      hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      hexIn.value = hex.toUpperCase();
      draw();
      if (cb) cb(hex);
    };
    const pickSV = e => {
      const r = svWrap.getBoundingClientRect();
      s = clamp((e.clientX - r.left) / r.width, 0, 1);
      v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
      sync();
    };
    const pickHue = e => {
      const r = hueWrap.getBoundingClientRect();
      hh = clamp((e.clientX - r.left) / r.width, 0, 1) * 360;
      sync();
    };
    let dragging = null;
    svWrap.addEventListener('pointerdown', e => { dragging = 'sv'; try { svWrap.setPointerCapture(e.pointerId); } catch (err) { } pickSV(e); });
    hueWrap.addEventListener('pointerdown', e => { dragging = 'hue'; try { hueWrap.setPointerCapture(e.pointerId); } catch (err) { } pickHue(e); });
    svWrap.addEventListener('pointermove', e => { if (dragging === 'sv') pickSV(e); });
    hueWrap.addEventListener('pointermove', e => { if (dragging === 'hue') pickHue(e); });
    window.addEventListener('pointerup', () => dragging = null);
    hexIn.onchange = () => {
      if (/^#?[0-9a-f]{6}$/i.test(hexIn.value)) {
        const v2 = hexIn.value.startsWith('#') ? hexIn.value : '#' + hexIn.value;
        const c = rgbToHsv(...Object.values(hexToRgb(v2)));
        hh = c.h; s = c.s; v = c.v;
        sync();
      }
    };

    draw();
    modal({
      title: '拾色器', sub: 'H ' + Math.round(hh) + '°', width: 360,
      body: [h('div', { class: 'picker-wrap' }, svWrap, hueWrap, hexIn)],
      actions: [
        { label: '取消', ghost: true, onClick: () => { if (cb) cb(initial); } },
        { label: '确定', primary: true, onClick: () => { if (cb) cb(hex); } }
      ],
      onClose: () => { }
    });
  },

  /* ---------------- 其它 ---------------- */
  prefs() {
    const accent = Store.get('accent', '#3d8ef0');
    const inp = h('input', { type: 'color', value: accent, style: { height: '27px', width: '60px', background: 'none', border: '1px solid #444', borderRadius: '4px' } });
    modal({
      title: '首选项', width: 380,
      body: [
        h('div', { class: 'field' }, h('label', {}, '界面强调色'), inp),
        h('div', { class: 'hint' }, '强调色会影响选区、按钮与高亮。Apsis 模式另有独立配色，可在其「自定义」中调整。'),
        h('div', { class: 'hint' }, '提示：Apsis 模式支持强调色 / 圆角 / 密度 / 快捷坞自定义，设置自动保存在本地。'),
        h('button', {
          class: 'btn ghost', style: { marginTop: '4px' },
          onclick: () => {
            Store.set('accent', null); localStorage.removeItem('dreikanter.accent');
            document.documentElement.style.setProperty('--accent', '#3d8ef0');
            toast('已恢复默认强调色');
          }
        }, '恢复默认')
      ],
      actions: [
        { label: '关闭', ghost: true },
        {
          label: '保存', primary: true, onClick: () => {
            Store.set('accent', inp.value);
            document.documentElement.style.setProperty('--accent', inp.value);
            document.documentElement.style.setProperty('--accent-2', inp.value);
            toast('首选项已保存', 'ok');
          }
        }
      ]
    });
  },

  shortcuts() {
    const rows = [
      ['V / M / L / W', '移动 / 选框 / 套索 / 魔棒'],
      ['B / E / G', '画笔 / 橡皮 / 油漆桶（Shift+G 渐变）'],
      ['T / U / C', '文字 / 形状 / 裁剪'],
      ['I / R / O / H / Z', '吸管 / 模糊 / 减淡加深 / 抓手 / 缩放'],
      ['[ / ]', '调整画笔大小'],
      ['X / D', '交换 / 复位前后景色'],
      ['空格 + 拖拽', '临时抓手平移'],
      ['滚轮 / Ctrl+滚轮', '平移 / 缩放（Apsis 模式滚轮即缩放）'],
      ['Ctrl+Z / Ctrl+Shift+Z', '撤销 / 重做'],
      ['Ctrl+A / Ctrl+D', '全选 / 取消选择'],
      ['Ctrl+J / Ctrl+E', '复制图层 / 向下合并'],
      ['Ctrl+0 / Ctrl+1', '适合屏幕 / 100%'],
      ['Ctrl+K', '命令面板'],
      ['Ctrl+Shift+S', '新建存档（快照）'],
      ['\\（按住）', '对比原图'],
      ['?', '快捷键一览'],
      ['右键（Apsis）', '径向工具菜单'],
      ['Delete / Alt+Delete', '清除 / 填充前景色']
    ];
    modal({
      title: '快捷键', sub: 'Photoshop 模式', width: 460,
      body: [h('div', { class: 'prop-grid', style: { gridTemplateColumns: '150px 1fr', rowGap: '6px' } },
        ...rows.flatMap(([k, v]) => [h('span', { class: 'k', style: { color: '#9a9a9a' } }, k), h('span', { class: 'v', style: { fontFamily: 'var(--font)', fontSize: '11px' } }, v)]))],
      actions: [{ label: '知道了', primary: true }]
    });
  },

  about() {
    const mem = (typeof Resources !== 'undefined' && Resources.memory) ? Resources.memory() : null;
    const perfLine = (typeof Perf !== 'undefined') ? Perf.summary() : '未启用监控';
    modal({
      title: '关于', sub: 'v9.0', width: 460,
      body: [
        h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } },
          h('div', {
            style: { width: '54px', height: '54px', borderRadius: '14px', background: '#171717', border: '1px solid #3b3b3b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' },
            html: `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 2 22 7.4v9.2L12 22 2 16.6V7.4z"/><path d="M12 2v20M2 7.4l10 5.2 10-5.2M2 16.6l10-5.2 10 5.2" opacity=".5"/></svg>`
          }),
          h('div', {},
            h('div', { style: { fontSize: '15px', fontWeight: '600', color: 'var(--c-text)' } }, 'Dreikanter photo'),
            h('div', { style: { fontSize: '10.5px', color: 'var(--c-text-2)', marginTop: '2px' } }, 'v9.0 · 构建 2026-11-08 · 双模式图像工作台'),
            h('div', { style: { fontSize: '10px', color: 'var(--c-text-3)', marginTop: '4px', letterSpacing: '.3px' } }, '© Apsis severs 2026 & Ansel Design 2026')
          )
        ),
        h('div', { class: 'prop-grid', style: { marginTop: '4px' } },
          h('span', { class: 'k' }, '运行模式'),
          h('span', { class: 'v' }, location.protocol === 'file:' ? '本地文件（file://）' : 'Web（PWA 可安装）'),
          h('span', { class: 'k' }, 'Worker'),
          h('span', { class: 'v' }, (typeof WorkerFX !== 'undefined' && WorkerFX.ready) ? '已启用（滤镜后台运算）' : '未启用（回退主线程）'),
          h('span', { class: 'k' }, '首屏可交互'),
          h('span', { class: 'v' }, (typeof Perf !== 'undefined' && Perf.boot) ? (Perf.boot + 'ms') : '打点缺失'),
          h('span', { class: 'k' }, '长任务'),
          h('span', { class: 'v' }, perfLine),
          h('span', { class: 'k' }, '内存'),
          h('span', { class: 'v' }, mem ? ('已用 ' + mem.used + 'MB / 上限 ' + mem.peak + 'MB') : '浏览器未提供')
        ),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' } },
          h('button', { class: 'btn', onclick: () => window.open('CHANGELOG.md', '_blank') }, '查看 CHANGELOG'),
          h('button', { class: 'btn', onclick: () => Errors.export() }, '导出错误日志'),
          h('button', {
            class: 'btn ghost', onclick: () => {
              const txt = 'Dreikanter photo v9.0\n构建 2026-11-08\nUA ' + navigator.userAgent;
              navigator.clipboard.writeText(txt).then(() => toast('版本信息已复制', 'ok')).catch(() => toast('复制失败', 'err'));
            }
          }, '复制版本信息')
        )
      ],
      actions: [{ label: '关闭', primary: true }]
    });
  },

  closeDoc() {
    modal({
      title: '关闭图像', width: 340,
      body: [h('div', { class: 'hint' }, '未导出的修改将丢失。确定关闭当前图像吗？')],
      actions: [
        { label: '取消', ghost: true },
        { label: '关闭', primary: true, onClick: () => closeDoc() }
      ]
    });
  },

  /* ---------------- 示例作品 ---------------- */
  loadDemo(silent) {
    const W = 1600, H = 1000;
    /* 当前就是示例时复用标签，避免重复开标签页 */
    if (typeof Docs !== 'undefined' && App.doc.w && App.doc.name === 'Dreikanter 示例') Docs.dropCurrent();
    newDocument(W, H, { bg: 'transparent', name: 'Dreikanter 示例' });
    const bg = App.layers[0];
    bg.name = '背景';
    const c = ctx2d(bg.canvas);

    // 渐变底
    const g = c.createLinearGradient(0, 0, W * .8, H);
    g.addColorStop(0, '#0a0d1a');
    g.addColorStop(.45, '#141026');
    g.addColorStop(1, '#231428');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // 光晕
    const glow = (x, y, r, col) => {
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    };
    c.globalCompositeOperation = 'screen';
    glow(W * .16, H * .12, W * .55, 'rgba(48,110,235,.38)');
    glow(W * .88, H * .92, W * .5, 'rgba(232,64,140,.30)');
    glow(W * .62, H * .28, W * .3, 'rgba(120,90,255,.18)');
    c.globalCompositeOperation = 'source-over';

    // 细网格
    c.strokeStyle = 'rgba(255,255,255,.028)';
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    // 颗粒
    for (let i = 0; i < 5200; i++) {
      const a = Math.random() * .05;
      c.fillStyle = `rgba(255,255,255,${a})`;
      c.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }

    // 光环图层
    const rings = createLayer('光环');
    const rc = ctx2d(rings.canvas);
    const cx = 1180, cy = 500;
    rc.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      rc.beginPath();
      rc.arc(cx, cy, 130 + i * 46, 0, Math.PI * 2);
      rc.strokeStyle = `rgba(255,255,255,${.16 - i * .016})`;
      rc.lineWidth = i === 0 ? 1.6 : 1;
      rc.stroke();
    }
    const ringGlow = rc.createRadialGradient(cx, cy, 0, cx, cy, 230);
    ringGlow.addColorStop(0, 'rgba(123,140,255,.30)');
    ringGlow.addColorStop(1, 'rgba(123,140,255,0)');
    rc.fillStyle = ringGlow;
    rc.beginPath(); rc.arc(cx, cy, 230, 0, Math.PI * 2); rc.fill();
    // 十字准线
    rc.strokeStyle = 'rgba(255,255,255,.22)';
    rc.beginPath();
    rc.moveTo(cx - 330, cy); rc.lineTo(cx + 330, cy);
    rc.moveTo(cx, cy - 330); rc.lineTo(cx, cy + 330);
    rc.stroke();
    rings.opacity = .95;
    App.layers.push(rings);

    // 三角图层
    const tri = createLayer('三角');
    const tc = ctx2d(tri.canvas);
    const tg = tc.createLinearGradient(980, 760, 1300, 320);
    tg.addColorStop(0, '#ff7a45');
    tg.addColorStop(1, '#ff3d81');
    tc.fillStyle = tg;
    tc.beginPath();
    tc.moveTo(960, 800);
    tc.lineTo(1420, 800);
    tc.lineTo(1190, 300);
    tc.closePath();
    tc.fill();
    tri.blend = 'overlay';
    tri.opacity = .82;
    App.layers.push(tri);

    // 文字图层
    const mk = (name, text, opts) => {
      const l = createLayer(name);
      l.type = 'text';
      l.text = {
        string: text, font: '"Microsoft YaHei", system-ui', size: opts.size, weight: opts.weight || '700',
        align: 'left', lineHeight: opts.lh || 1.2, color: opts.color, x: opts.x, y: opts.y,
        spacing: opts.spacing || 0
      };
      Text.render(l);
      App.layers.push(l);
      return l;
    };
    mk('标题', 'DREIKANTER', { size: 128, weight: '900', color: '#f6f6f9', x: 94, y: 92, spacing: 10 });
    mk('副标题', 'PHOTO · DESIGN · WORKSPACE', { size: 22, weight: '600', color: '#a3b0ff', x: 100, y: 250, spacing: 7 });
    mk('说明', '双模式图像工作台\nPhotoshop 模式 / Apsis 模式', { size: 30, weight: '400', color: 'rgba(255,255,255,.62)', x: 100, y: 690, lh: 1.7, spacing: 2 });
    mk('页脚', '© Apsis severs 2026 & Ansel Design 2026', { size: 16, weight: '400', color: 'rgba(255,255,255,.34)', x: 100, y: 924, spacing: 1.6 });

    // 小标记
    const mark = createLayer('标记');
    const mc = ctx2d(mark.canvas);
    mc.strokeStyle = 'rgba(255,255,255,.35)';
    mc.lineWidth = 1;
    mc.beginPath(); mc.moveTo(94, 300); mc.lineTo(400, 300); mc.stroke();
    mc.fillStyle = 'rgba(255,255,255,.5)';
    mc.font = '500 13px "Courier New", monospace';
    mc.fillText('01 / VISUAL SYSTEM', 94, 328);
    mc.fillText('1600 × 1000  ·  RGB', 94, 350);
    App.layers.push(mark);

    App.activeId = App.layers[App.layers.length - 2].id;
    History.reset();
    fitView();
    captureBaseline();
    sync();
    invalidate(true);
    if (!silent) toast('示例作品已载入 — 试试切换 Apsis 模式', 'ok');
  }
};
