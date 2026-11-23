/* ==========================================================================
   Dreikanter photo — batch.js
   批量处理：多张照片套同一套配方（LUT / 调整 / 锐化 / 尺寸 / 格式）后导出
   · 串行执行，单项失败不中断整批
   · 可取消、可单独重试，状态在「批量处理」对话框里实时刷新
   ========================================================================== */
'use strict';

const Batch = {
  items: [],
  running: false,
  cancelled: false,
  current: null,
  download: true,
  onUpdate: null,
  recipe: {
    lut: '', intensity: 100,
    brightness: 0, contrast: 0, saturation: 0, temp: 0, sharpen: 0,
    maxEdge: 0, format: 'image/jpeg', quality: .9, prefix: 'drk-'
  },

  stats() {
    const c = { total: this.items.length, queued: 0, running: 0, done: 0, failed: 0, skipped: 0 };
    this.items.forEach(it => { c[it.status] = (c[it.status] || 0) + 1; });
    return c;
  },

  emit() {
    if (typeof this.onUpdate === 'function') { try { this.onUpdate(this); } catch (e) { } }
  },

  /** 加入文件（File / Blob 列表） */
  addFiles(list) {
    const arr = Array.from(list || []);
    let added = 0;
    arr.forEach(f => {
      if (!f) return;
      const okType = /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|gif|bmp|avif|svg|tiff?)$/i.test(f.name || '');
      if (!okType) return;
      this.items.push({
        id: uid('batch'), file: f, name: f.name || ('image-' + (this.items.length + 1) + '.png'),
        size: f.size || 0, status: 'queued', error: null, out: null
      });
      added++;
    });
    this.emit();
    return added;
  },

  remove(id) {
    this.items = this.items.filter(it => it.id !== id);
    this.emit();
  },

  clear() {
    if (this.running) return false;
    this.items = [];
    this.emit();
    return true;
  },

  retry(id) {
    const it = this.items.find(x => x.id === id);
    if (!it || it.status !== 'failed') return false;
    it.status = 'queued'; it.error = null;
    this.emit();
    return true;
  },

  cancel() {
    if (!this.running) return false;
    this.cancelled = true;
    this.emit();
    return true;
  },

  outName(item, w, h) {
    const r = this.recipe;
    const base = String(item.name || 'image').replace(/\.[^.]+$/, '');
    const ext = r.format === 'image/png' ? 'png' : r.format === 'image/webp' ? 'webp' : 'jpg';
    return (r.prefix || '') + base + '-' + w + 'x' + h + '.' + ext;
  },

  /** 单张：解码 → 配方 → 编码 */
  async _process(item) {
    const r = this.recipe;
    const bmp = await decodeImageFile(item.file);
    const w0 = bmp.width || bmp.naturalWidth || 0;
    const h0 = bmp.height || bmp.naturalHeight || 0;
    if (!w0 || !h0) throw new Error('读不到尺寸');
    let w = w0, h = h0;
    if (r.maxEdge > 0 && Math.max(w, h) > r.maxEdge) {
      const s = r.maxEdge / Math.max(w, h);
      w = Math.max(1, Math.round(w * s));
      h = Math.max(1, Math.round(h * s));
    }
    const cv = makeCanvas(w, h);
    const c = ctx2d(cv);
    c.imageSmoothingQuality = 'high';
    c.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();

    const img = c.getImageData(0, 0, w, h);
    if (r.brightness || r.contrast) FX.brightnessContrast(img, { brightness: r.brightness, contrast: r.contrast });
    if (r.saturation) FX.saturation(img, { saturation: r.saturation });
    if (r.temp) FX.temperature(img, { temp: r.temp / 100 });
    if (r.sharpen) FX.sharpen(img, { amount: r.sharpen });
    if (r.lut) FX.cameraLook(img, { look: r.lut, intensity: r.intensity });
    c.putImageData(img, 0, 0);

    const blob = await canvasToBlob(cv, r.format, r.quality);
    if (!blob) throw new Error('编码失败');
    const name = this.outName(item, w, h);
    if (this.download) downloadBlob(blob, name);
    item.out = { w, h, bytes: blob.size, name };
    return item.out;
  },

  async run() {
    if (this.running) return;
    if (!this.items.some(it => it.status === 'queued' || it.status === 'failed')) {
      toast('没有待处理的图片', 'err');
      return;
    }
    this.running = true;
    this.cancelled = false;
    if (typeof Progress !== 'undefined') Progress.start('批量处理');
    for (const it of this.items) {
      if (this.cancelled) { if (it.status === 'queued') it.status = 'skipped'; continue; }
      if (it.status === 'done') continue;
      it.status = 'running'; it.error = null; this.current = it;
      this.emit();
      try {
        await this._process(it);
        it.status = 'done';
      } catch (e) {
        it.status = 'failed';
        it.error = e.message || String(e);
      }
      this.current = null;
      this.emit();
    }
    this.running = false;
    const c = this.stats();
    if (typeof Progress !== 'undefined') Progress.done();
    this.emit();
    if (c.done) toast('批量完成：成功 ' + c.done + ' 张' + (c.failed ? '，失败 ' + c.failed + ' 张' : ''), c.failed ? 'err' : 'ok');
  }
};

/* ---------------- 批量处理对话框 ---------------- */
Dialogs.batch = function batchDialog() {
  const r = Batch.recipe;
  const listWrap = h('div', { class: 'exp-list', id: 'batchList', style: { maxHeight: '150px' } });
  const statusLine = h('div', { class: 'hint', id: 'batchStatus' }, '');

  const render = () => {
    const c = Batch.stats();
    listWrap.innerHTML = '';
    if (!Batch.items.length) {
      listWrap.append(h('div', { class: 'hint' }, '还没有图片。点「添加图片…」，或把多张照片一次选进来。'));
    }
    Batch.items.forEach(it => {
      const row = h('div', { class: 'exp-row ' + it.status },
        h('span', { class: 'exp-dot ' + it.status }),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { style: { fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, it.name),
          h('div', { class: 'hint', style: { marginTop: '1px' } },
            it.status === 'done' && it.out
              ? it.out.w + '×' + it.out.h + ' · ' + fmtBytes(it.out.bytes) + ' · ' + it.out.name
              : it.status === 'failed' ? (it.error || '失败')
                : it.status === 'running' ? '处理中…'
                  : it.status === 'skipped' ? '已取消' : '排队')
        )
      );
      if (it.status === 'failed') {
        row.append(h('button', {
          class: 'icon-btn', title: '重试', html: icon('redo', 12),
          onclick: () => { Batch.retry(it.id); render(); }
        }));
      }
      listWrap.append(row);
    });
    statusLine.textContent = c.total
      ? '共 ' + c.total + ' 张 · 完成 ' + c.done + ' · 失败 ' + c.failed + (c.queued ? ' · 待处理 ' + c.queued : '') + (Batch.running ? ' · 运行中' : '')
      : '未添加图片';
  };

  const fileInput = h('input', {
    type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' },
    onchange: e => {
      const n = Batch.addFiles(e.target.files);
      e.target.value = '';
      if (n) toast('已加入 ' + n + ' 张图片');
      render();
    }
  });

  const num = (key, label, min, max, step, scale) => {
    const sc = scale || 1;
    const inp = numInput(Math.round(r[key] * sc), {
      min, max, step: step || 1,
      onChange: v => { r[key] = clamp(Number(v) || 0, min, max) / sc; }
    });
    return fieldEl(label, inp);
  };

  const lutOpts = [['', '不套 LUT']]
    .concat((typeof LOOK_IDS !== 'undefined' ? LOOK_IDS : []).map(id => [id, CAMERA_LOOKS[id].name]))
    .concat((typeof CVL !== 'undefined' ? CVL.list() : []).map(c => [c.id, '⌁ ' + c.name]));
  const lutSel = h('select', {
    onchange: e => { r.lut = e.target.value; }
  }, ...lutOpts.map(([v, l]) => h('option', { value: v, selected: v === r.lut }, l)));

  const fmtSel = h('select', {
    onchange: e => { r.format = e.target.value; }
  }, ...[['image/jpeg', 'JPEG'], ['image/png', 'PNG'], ['image/webp', 'WebP']]
    .map(([v, l]) => h('option', { value: v, selected: v === r.format }, l)));

  const prefixInp = h('input', {
    class: 'opt-field', type: 'text', value: r.prefix, placeholder: '文件名前缀',
    oninput: e => { r.prefix = e.target.value; }
  });

  const runBtn = h('button', {
    class: 'btn primary', style: { flex: '1' },
    onclick: () => { Batch.run(); render(); }
  }, '开始处理');
  const cancelBtn = h('button', {
    class: 'btn ghost', style: { flex: '0 0 auto' },
    onclick: () => { Batch.cancel(); render(); }
  }, '取消');

  Batch.onUpdate = render;

  const m = modal({
    title: '批量处理', sub: '同一配方 · 多张照片', width: 520,
    body: [
      h('div', { class: 'exp-bar', style: { marginBottom: '6px' } },
        h('button', { class: 'btn', style: { flex: '1' }, onclick: () => fileInput.click() }, '添加图片…'),
        h('button', {
          class: 'btn ghost', style: { flex: '0 0 auto' },
          onclick: () => { if (Batch.clear()) render(); }
        }, '清空')
      ),
      listWrap,
      statusLine,
      h('div', { class: 'cap-line' }, '统一配方'),
      h('div', { class: 'field-row' }, fieldEl('相机 LUT / .cube', lutSel), num('intensity', 'LUT 强度', 0, 100)),
      h('div', { class: 'field-row' }, num('brightness', '亮度', -100, 100), num('contrast', '对比度', -100, 100)),
      h('div', { class: 'field-row' }, num('saturation', '饱和度', -100, 100), num('temp', '色温', -100, 100)),
      h('div', { class: 'field-row' }, num('sharpen', '锐化', 0, 200), num('maxEdge', '最长边 px（0=原尺寸）', 0, 8000)),
      h('div', { class: 'field-row' }, fieldEl('格式', fmtSel), num('quality', '质量 %', 10, 100, 1, 100)),
      h('div', { class: 'field-row' }, fieldEl('文件名前缀', prefixInp)),
      h('div', { class: 'exp-bar', style: { marginTop: '4px' } }, runBtn, cancelBtn),
      fileInput
    ],
    actions: [{ label: '关闭', ghost: true, onClick: () => { if (!Batch.running) Batch.clear(); } }],
    onClose: () => { Batch.onUpdate = null; }
  });
  render();
  return m;
};
