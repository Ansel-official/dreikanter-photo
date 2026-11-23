/* ==========================================================================
   Dreikanter photo — preset.js
   一键预设：把「LUT + 曲线 + 调整参数」存成命名配方，单图套用 / 批量套用 / 导入导出
   ========================================================================== */
'use strict';

/** 配方 → 像素管线（顺序固定，保证同一配方在任何入口结果一致） */
function applyRecipe(img, r) {
  if (!r) return img;
  if (r.brightness || r.contrast) FX.brightnessContrast(img, { brightness: r.brightness || 0, contrast: r.contrast || 0 });
  if (r.saturation) FX.saturation(img, { saturation: r.saturation });
  if (r.temp) FX.temperature(img, { temp: r.temp / 100 });
  if (r.exposure) FX.exposure(img, { exposure: r.exposure });
  if (r.sharpen) FX.sharpen(img, { amount: r.sharpen });
  if (r.curves) FX.curves(img, { curves: r.curves });
  if (r.lut) FX.cameraLook(img, { look: r.lut, intensity: r.intensity == null ? 100 : r.intensity });
  return img;
}

/** 配方里有哪些步骤（给对话框做摘要） */
function recipeSummary(r) {
  if (!r) return '空配方';
  const out = [];
  if (r.lut) {
    let name = r.lut;
    if (typeof CAMERA_LOOKS !== 'undefined' && CAMERA_LOOKS[r.lut]) name = CAMERA_LOOKS[r.lut].name;
    else if (typeof CVL !== 'undefined' && CVL.get(r.lut)) name = '自定义 LUT';
    out.push(name + (r.intensity !== 100 && r.intensity != null ? ' ' + r.intensity + '%' : ''));
  }
  if (r.curves) out.push('曲线');
  if (r.brightness) out.push('亮度' + (r.brightness > 0 ? '+' : '') + r.brightness);
  if (r.contrast) out.push('对比' + (r.contrast > 0 ? '+' : '') + r.contrast);
  if (r.saturation) out.push('饱和' + (r.saturation > 0 ? '+' : '') + r.saturation);
  if (r.temp) out.push('色温' + (r.temp > 0 ? '+' : '') + r.temp);
  if (r.exposure) out.push('曝光' + (r.exposure > 0 ? '+' : '') + r.exposure);
  if (r.sharpen) out.push('锐化' + r.sharpen);
  return out.length ? out.join(' · ') : '空配方';
}

const Preset = {
  KEY: 'presets',
  list() { return Store.get(this.KEY, []) || []; },

  save(name, recipe) {
    const rows = this.list();
    const id = 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const clean = String(name || '').trim() || ('预设 ' + (rows.length + 1));
    rows.push({ id, name: clean, at: Date.now(), recipe: JSON.parse(JSON.stringify(recipe || {})) });
    Store.set(this.KEY, rows);
    return { id, name: clean };
  },

  remove(id) {
    Store.set(this.KEY, this.list().filter(p => p.id !== id));
    return true;
  },

  get(id) { return this.list().find(p => p.id === id) || null; },

  clear() { Store.set(this.KEY, []); },

  exportJSON() {
    return JSON.stringify({ app: 'Dreikanter photo', kind: 'presets', version: 1, presets: this.list() }, null, 2);
  },

  /** 合并导入；同名覆盖，返回 { added, merged } */
  importJSON(text) {
    let data;
    if (text && typeof text === 'object') data = text;
    else {
      try { data = JSON.parse(String(text || '')); } catch (e) { throw new Error('不是合法 JSON'); }
    }
    const incoming = Array.isArray(data) ? data : (data && data.presets);
    if (!Array.isArray(incoming)) throw new Error('缺少 presets 数组');
    const rows = this.list();
    let added = 0, merged = 0;
    incoming.forEach(p => {
      if (!p || typeof p !== 'object') return;
      const name = String(p.name || '').trim();
      if (!name) return;
      const recipe = p.recipe && typeof p.recipe === 'object' ? p.recipe : {};
      const hit = rows.find(x => x.name === name);
      if (hit) { hit.recipe = recipe; hit.at = Date.now(); merged++; }
      else {
        rows.push({ id: 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, at: Date.now(), recipe });
        added++;
      }
    });
    Store.set(this.KEY, rows);
    return { added, merged };
  },

  /** 套用到当前图层（走选区遮罩，一步历史） */
  applyToLayer(preset) {
    if (!preset || !preset.recipe) return false;
    const l = activeLayer();
    if (!l) { toast('请选择一个图层', 'err'); return false; }
    if (l.locked) { toast('图层已锁定', 'err'); return false; }
    const recipe = preset.recipe;
    applyFilterDirect(img => applyRecipe(img, recipe), {}, '预设 ' + preset.name);
    toast('已套用预设：' + preset.name, 'ok');
    return true;
  }
};

/* ---------------- 预设管理对话框 ---------------- */
Dialogs.presets = function presetsDialog() {
  const listWrap = h('div', { class: 'exp-list', style: { maxHeight: '190px' } });
  const nameIn = h('input', { class: 'opt-field', type: 'text', placeholder: '预设名称，如「徕卡青调」' });

  const render = () => {
    listWrap.innerHTML = '';
    const rows = Preset.list();
    if (!rows.length) {
      listWrap.append(h('div', { class: 'hint' }, '还没有预设。用「保存当前批量配方」或导入 JSON。'));
      return;
    }
    rows.forEach(p => {
      listWrap.append(h('div', { class: 'exp-row' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { style: { fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.name),
          h('div', { class: 'hint', style: { marginTop: '1px' } }, recipeSummary(p.recipe))
        ),
        h('button', {
          class: 'icon-btn', title: '套用到当前图层', html: icon('check', 12),
          onclick: () => Preset.applyToLayer(p)
        }),
        h('button', {
          class: 'icon-btn', title: '套用到批量配方', html: icon('download', 12),
          onclick: () => {
            Batch.recipe = Object.assign({}, Batch.recipe, JSON.parse(JSON.stringify(p.recipe)));
            toast('已套用到批量配方：' + p.name, 'ok');
          }
        }),
        h('button', {
          class: 'icon-btn', title: '删除', html: icon('close', 12),
          onclick: () => { Preset.remove(p.id); render(); toast('已删除预设'); }
        })
      ));
    });
  };

  const saveBtn = h('button', {
    class: 'btn primary', style: { flex: '1' },
    onclick: () => {
      const recipe = JSON.parse(JSON.stringify(Batch.recipe || {}));
      if (!recipeSummary(recipe) || recipeSummary(recipe) === '空配方') {
        toast('当前批量配方是空的，先设置几项再保存', 'err');
        return;
      }
      const rec = Preset.save(nameIn.value || '', recipe);
      nameIn.value = '';
      toast('已保存预设：' + rec.name, 'ok');
      render();
    }
  }, '保存当前批量配方为预设');

  const fileOut = () => {
    const blob = new Blob([Preset.exportJSON()], { type: 'application/json' });
    downloadBlob(blob, 'dreikanter-presets.json');
    toast('已导出预设 JSON', 'ok');
  };

  const m = modal({
    title: '预设', sub: 'LUT + 曲线 + 调整', width: 520,
    body: [
      h('div', { class: 'hint' }, '预设 = 一份配方（相机 LUT / .cube、曲线、亮度对比度、饱和度、色温、锐化），可套到当前图层，也可在「批量处理」里一键复用。'),
      listWrap,
      h('div', { class: 'cap-line' }, '从批量配方保存'),
      h('div', { class: 'field-row' }, fieldEl('名称', nameIn)),
      h('div', { class: 'exp-bar' }, saveBtn),
      h('div', { class: 'exp-bar', style: { marginTop: '6px' } },
        h('button', { class: 'btn ghost', style: { flex: '1' }, onclick: fileOut }, '导出 JSON'),
        h('button', {
          class: 'btn ghost', style: { flex: '1' },
          onclick: () => {
            const ta = h('textarea', { class: 'ta', rows: 7, spellcheck: 'false', placeholder: '{ "presets": [ … ] }' });
            const sub2 = modal({
              title: '导入预设 JSON', sub: '合并', width: 460,
              body: [ta, h('div', { class: 'hint' }, '同名预设会被覆盖，其余追加。')],
              actions: [
                { label: '取消', ghost: true },
                {
                  label: '导入', primary: true, onClick: () => {
                    try {
                      const r = Preset.importJSON(ta.value);
                      toast('导入完成：新增 ' + r.added + ' / 覆盖 ' + r.merged, 'ok');
                      sub2.close();
                      render();
                    } catch (e) { toast('导入失败：' + e.message, 'err'); }
                  }
                }
              ]
            });
          }
        }, '导入 JSON')
      )
    ],
    actions: [{ label: '关闭', ghost: true }]
  });
  render();
  return m;
};
