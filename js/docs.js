/* ==========================================================================
   Dreikanter photo — docs.js
   多文档标签：切换 / 关闭 / 脏标记 / 每文档视图与历史
   ========================================================================== */
'use strict';

const Docs = {
  list: [],
  activeId: null,
  max: 6,

  /* 把当前 App 状态登记为一个标签页 */
  registerCurrent() {
    if (!App.doc.w) return;
    const existing = this.list.find(s => s.doc === App.doc);
    if (existing) { this.activeId = existing.id; this.render(); return; }
    const session = {
      id: uid('D'),
      doc: App.doc,
      layers: App.layers,
      activeId: App.activeId,
      selection: App.selection,
      view: { ...App.view },
      baseline: App.baseline,
      history: { entries: History.entries, idx: History.idx },
      dirty: false,
      name: App.doc.name || '未命名'
    };
    this.list.push(session);
    this.activeId = session.id;
    while (this.list.length > this.max) {
      const dead = this.list.find(s => s.id !== this.activeId);
      if (!dead) break;
      this.list = this.list.filter(s => s !== dead);
    }
    this.render();
  },

  current() { return this.list.find(s => s.id === this.activeId) || null; },

  /* 丢弃当前标签（用于「重新载入示例」复用同一个标签） */
  dropCurrent() {
    const s = this.current();
    if (!s) return false;
    this.list = this.list.filter(x => x !== s);
    this.activeId = null;
    return true;
  },

  /* 丢弃当前标签（用于「重新载入示例」复用同一个标签） */
  dropCurrent() {
    const s = this.current();
    if (!s) return false;
    this.list = this.list.filter(x => x !== s);
    this.activeId = null;
    return true;
  },

  /* 保存当前文档的易变状态（切换前调用） */
  stash() {
    const s = this.current();
    if (!s) return;
    s.doc = App.doc;
    s.layers = App.layers;
    s.activeId = App.activeId;
    s.selection = App.selection;
    s.view = { ...App.view };
    s.baseline = App.baseline;
    s.history = { entries: History.entries, idx: History.idx };
    s.name = App.doc.name || '未命名';
  },

  switchTo(id) {
    if (id === this.activeId) return;
    const target = this.list.find(s => s.id === id);
    if (!target) return;
    document.querySelectorAll('.modal-veil').forEach(e => e.remove());
    if (typeof Tools !== 'undefined') Tools.cancelDrag();
    if (typeof Adjust !== 'undefined' && Adjust.layer) Adjust.cancel();
    History.pending = null;
    this.stash();

    App.doc = target.doc;
    App.layers = target.layers;
    App.activeId = target.activeId;
    App.selection = target.selection || null;
    App.baseline = target.baseline || null;
    App.comparing = false;
    App.view = { ...target.view };
    History.entries = target.history.entries;
    History.idx = target.history.idx;
    App.previewId = null; App.previewCanvas = null;
    this.activeId = id;

    if (typeof layoutFrame === 'function') layoutFrame();
    invalidate(true);
    sync();
    this.render();
    if (App.selection) invalidateOverlay();
    toast('切换到「' + (target.name || '未命名') + '」');
  },

  close(id) {
    const i = this.list.findIndex(s => s.id === id);
    if (i < 0) return;
    const s = this.list[i];
    const doClose = () => {
      this.list.splice(i, 1);
      if (typeof Resources !== 'undefined') Resources.releaseDoc(s);
      if (this.activeId === id) {
        const next = this.list[Math.min(i, this.list.length - 1)];
        this.activeId = null;
        if (next) this.switchTo(next.id);
        else this.blank();
      }
      this.render();
    };
    if (s.dirty) {
      const m = modal({
        title: '关闭文档', width: 360,
        body: [h('div', { class: 'hint' }, '「' + (s.name || '未命名') + '」有未导出的修改，关闭后将无法恢复。')],
        actions: [
          { label: '取消', ghost: true },
          { label: '仍然关闭', primary: true, onClick: doClose }
        ]
      });
      return;
    }
    doClose();
  },

  blank() {
    if (typeof closeDoc === 'function') closeDoc();
    this.activeId = null;
    this.render();
    showWelcome();
  },

  markDirty() {
    const s = this.current();
    if (s && !s.dirty) { s.dirty = true; this.render(); }
  },

  markSaved() {
    const s = this.current();
    if (s) { s.dirty = false; this.render(); }
  },

  syncName() {
    const s = this.current();
    if (!s) return;
    s.name = App.doc.name || '未命名';
    const el = document.querySelector('.tab.active .tab-name');
    if (el) el.textContent = s.name;
  },

  render() {
    const bar = document.getElementById('tabbar');
    if (!bar) return;
    bar.innerHTML = '';
    if (this.list.length === 0) { bar.classList.add('empty'); return; }
    bar.classList.remove('empty');

    this.list.forEach(s => {
      const tab = h('button', {
        class: 'tab' + (s.id === this.activeId ? ' active' : ''),
        title: s.name + ' · ' + s.doc.w + '×' + s.doc.h,
        onclick: () => Docs.switchTo(s.id)
      },
        h('span', { class: 'tab-dot' + (s.dirty ? ' on' : '') }),
        h('span', { class: 'tab-name' }, s.name),
        h('span', {
          class: 'tab-x', title: '关闭', onclick: e => { e.stopPropagation(); Docs.close(s.id); }
        }, '×')
      );
      bar.append(tab);
    });

    if (this.list.length < this.max) {
      bar.append(h('button', {
        class: 'tab-new', title: '新建文档', onclick: () => Dialogs.newDoc()
      }, '+'));
    }
    bar.append(h('span', { class: 'tab-spacer' }));
    bar.append(h('span', { class: 'tab-count' }, this.list.length + ' 个文档'));
  }
};
