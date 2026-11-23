/* ==========================================================================
   Dreikanter photo — archive.js
   存档（快照）：新建 / 还原 / 删除 / 重命名，本地 IndexedDB 持久化
   ========================================================================== */
'use strict';

const ArchiveStore = {
  db: null,
  failed: false,

  async open() {
    if (this.db) return this.db;
    if (this.failed || !window.indexedDB) throw new Error('浏览器不支持本地存档');
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('dreikanter-photo', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('无法打开存档库'));
    });
    return this.db;
  },

  async all() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly');
      const req = tx.objectStore('snapshots').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async put(snap) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').put(snap);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async del(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async clear() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readwrite');
      tx.objectStore('snapshots').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
};

const Archives = {
  list: [],
  max: 12,
  _inited: false,
  busy: false,

  async init() {
    if (this._inited) return;
    this._inited = true;
    try {
      const all = await ArchiveStore.all();
      this.list = (all || []).sort((a, b) => b.time - a.time);
    } catch (e) {
      console.warn('[Dreikanter] 存档库不可用，仅本次会话有效', e);
      ArchiveStore.failed = true;
    }
    if (typeof UI !== 'undefined' && UI.renderArchives) UI.renderArchives();
  },

  count() { return this.list.length; },

  /** 新建存档 */
  async create(name) {
    if (!App.doc.w) { toast('先打开一张照片再存档', 'err'); return null; }
    if (this.busy) { toast('正在存档，请稍候', 'err'); return null; }
    this.busy = true;
    if (typeof Progress !== 'undefined') Progress.start('正在存档');
    const tip = toast('正在存档…');
    try {
      const layers = [];
      for (const l of App.layers) {
        const blob = await canvasBlob(l.canvas);
        layers.push({
          name: l.name,
          type: l.type,
          blend: l.blend,
          opacity: l.opacity,
          x: l.x, y: l.y,
          visible: l.visible,
          locked: l.locked,
          text: l.text ? { ...l.text } : null,
          blob
        });
      }
      const snap = {
        id: uid('S'),
        name: name || ('存档 ' + (this.list.length + 1)),
        time: Date.now(),
        w: App.doc.w, h: App.doc.h, bg: App.doc.bg,
        docName: App.doc.name,
        active: Math.max(0, App.layers.findIndex(l => l.id === App.activeId)),
        thumb: this.thumbDataURL(),
        layers
      };
      this.list.unshift(snap);
      /* 超出上限时淘汰最旧的 */
      while (this.list.length > this.max) {
        const drop = this.list.pop();
        try { await ArchiveStore.del(drop.id); } catch (e) { }
      }
      try { await ArchiveStore.put(snap); }
      catch (e) { console.warn('[Dreikanter] 存档未落盘', e); }
      if (tip) tip.remove();
      if (typeof Progress !== 'undefined') Progress.done();
      UI.renderArchives();
      if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
      toast('已存档「' + snap.name + '」', 'ok', {
        label: '重命名',
        fn: () => Archives.promptRename(snap.id)
      });
      return snap;
    } catch (e) {
      if (tip) tip.remove();
      if (typeof Progress !== 'undefined') Progress.done();
      toast('存档失败：' + e.message, 'err');
      return null;
    } finally {
      this.busy = false;
    }
  },

  thumbDataURL() {
    const w = 168;
    const h = Math.max(1, Math.round(w * App.doc.h / App.doc.w));
    const c = makeCanvas(w, h);
    const x = ctx2d(c);
    x.fillStyle = '#101010';
    x.fillRect(0, 0, w, h);
    x.imageSmoothingQuality = 'high';
    try { x.drawImage(compositeCanvas(false), 0, 0, w, h); } catch (e) { }
    return c.toDataURL('image/png');
  },

  /** 还原存档 */
  async restore(id) {
    const snap = this.list.find(s => s.id === id);
    if (!snap) return;
    if (typeof Progress !== 'undefined') Progress.start('正在还原存档');
    try {
      const bmps = [];
      for (const l of snap.layers) bmps.push(await createImageBitmap(l.blob));

      History.begin('还原存档', App.layers.map(l => l.id));
      App.doc.w = snap.w;
      App.doc.h = snap.h;
      App.doc.bg = snap.bg || 'transparent';
      if (snap.docName) App.doc.name = snap.docName;
      App.layers = snap.layers.map((l, i) => {
        const c = makeCanvas(snap.w, snap.h);
        const x = ctx2d(c);
        x.drawImage(bmps[i], 0, 0);
        return {
          id: uid('L'),
          name: l.name,
          type: l.type || 'raster',
          canvas: c,
          x: l.x || 0, y: l.y || 0,
          opacity: l.opacity == null ? 1 : l.opacity,
          blend: l.blend || 'normal',
          visible: l.visible !== false,
          locked: !!l.locked,
          text: l.text ? { ...l.text } : null,
          thumbDirty: true
        };
      });
      App.activeId = App.layers[clamp(snap.active || 0, 0, App.layers.length - 1)].id;
      App.selection = null;
      History.end();
      fitView();
      invalidate(true);
      sync();
      if (typeof Progress !== 'undefined') Progress.done();
      toast('已还原「' + snap.name + '」', 'ok', { label: '撤销', fn: () => History.undo() });
    } catch (e) {
      if (typeof Progress !== 'undefined') Progress.done();
      toast('还原失败：' + e.message, 'err');
    }
  },

  /** 删除存档（可撤销） */
  async remove(id, silent) {
    const i = this.list.findIndex(s => s.id === id);
    if (i < 0) return;
    const [snap] = this.list.splice(i, 1);
    try { await ArchiveStore.del(id); } catch (e) { }
    UI.renderArchives();
    if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
    if (silent) return;
    toast('已删除「' + snap.name + '」', '', {
      label: '撤销',
      fn: async () => {
        this.list.splice(Math.min(i, this.list.length), 0, snap);
        try { await ArchiveStore.put(snap); } catch (e) { }
        UI.renderArchives();
        if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
        toast('已恢复「' + snap.name + '」', 'ok');
      }
    });
  },

  async rename(id, name) {
    const s = this.list.find(x => x.id === id);
    if (!s) return;
    s.name = name || s.name;
    try { await ArchiveStore.put(s); } catch (e) { }
    UI.renderArchives();
    if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
  },

  async clear() {
    const backup = this.list.slice();
    this.list = [];
    try { await ArchiveStore.clear(); } catch (e) { }
    UI.renderArchives();
    if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
    toast('已清空 ' + backup.length + ' 个存档', '', {
      label: '撤销',
      fn: async () => {
        this.list = backup;
        for (const s of backup) { try { await ArchiveStore.put(s); } catch (e) { } }
        UI.renderArchives();
        if (typeof Apsis !== 'undefined' && Apsis.refresh) Apsis.refresh();
      }
    });
  },

  promptRename(id) {
    const s = this.list.find(x => x.id === id);
    if (!s) return;
    const inp = h('input', { type: 'text', value: s.name });
    modal({
      title: '重命名存档', width: 340,
      body: [fieldEl('名称', inp)],
      actions: [
        { label: '取消', ghost: true },
        { label: '保存', primary: true, onClick: () => this.rename(id, inp.value.trim()) }
      ]
    });
    setTimeout(() => { inp.focus(); inp.select(); }, 40);
  },

  promptClear() {
    if (!this.list.length) { toast('还没有存档', 'err'); return; }
    modal({
      title: '清空存档', width: 340,
      body: [h('div', { class: 'hint' }, '将删除全部 ' + this.list.length + ' 个存档，删除后可立即撤销。')],
      actions: [
        { label: '取消', ghost: true },
        { label: '清空', primary: true, onClick: () => this.clear() }
      ]
    });
  },

  /** 还原最近一个存档 */
  restoreLatest() {
    if (!this.list.length) { toast('还没有存档', 'err'); return; }
    this.restore(this.list[0].id);
  }
};
