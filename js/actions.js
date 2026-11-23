/* ==========================================================================
   Dreikanter photo — actions.js
   动作录制与重放：把「滤镜 / 调整 / 曲线 / LUT」调用录成步骤，一键重放
   ========================================================================== */
'use strict';

/* FX 函数 → 名字（持久化用） */
function fxNameOf(fn) {
  if (!fn) return null;
  const keys = Object.keys(FX);
  for (let i = 0; i < keys.length; i++) if (FX[keys[i]] === fn) return keys[i];
  return null;
}

const Recorder = {
  active: false,
  replaying: false,
  ops: [],

  start() {
    this.active = true;
    this.ops = [];
    toast('开始录制动作：之后的滤镜/调整都会记下来', 'ok');
    return true;
  },

  cancel() {
    this.active = false;
    this.ops = [];
    toast('已取消录制');
  },

  /** 记录一步（fn 是 FX 函数引用，落库时转名字） */
  record(fn, params, label) {
    if (!this.active || this.replaying) return false;
    const name = fxNameOf(fn);
    if (!name) return false;
    let p = {};
    try { p = JSON.parse(JSON.stringify(params || {})); } catch (e) { p = {}; }
    this.ops.push({ fn: name, params: p, label: label || name });
    return true;
  },

  /** 结束并保存为动作 */
  stop(name) {
    if (!this.active) return null;
    this.active = false;
    const ops = this.ops;
    this.ops = [];
    if (!ops.length) {
      toast('这次没有录到任何步骤', 'err');
      return null;
    }
    const rec = Action.save(name || '动作 ' + (Action.list().length + 1), ops);
    toast('已保存动作：' + rec.name + '（' + ops.length + ' 步）', 'ok');
    return rec;
  },

  replay(ops) {
    if (!Array.isArray(ops) || !ops.length) return 0;
    this.replaying = true;
    let n = 0;
    try {
      ops.forEach(op => {
        const fn = FX[op.fn];
        if (typeof fn !== 'function') return;
        applyFilterDirect(fn, op.params || {}, op.label || op.fn);
        n++;
      });
    } finally {
      this.replaying = false;
    }
    return n;
  }
};

const Action = {
  KEY: 'actions',
  list() { return Store.get(this.KEY, []) || []; },

  save(name, ops) {
    const rows = this.list();
    const id = 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const clean = String(name || '').trim() || ('动作 ' + (rows.length + 1));
    rows.push({ id, name: clean, at: Date.now(), ops: JSON.parse(JSON.stringify(ops || [])) });
    Store.set(this.KEY, rows);
    return { id, name: clean, ops: ops.length };
  },

  remove(id) {
    Store.set(this.KEY, this.list().filter(a => a.id !== id));
    return true;
  },

  get(id) { return this.list().find(a => a.id === id) || null; },

  clear() { Store.set(this.KEY, []); },

  /** 在当前图层重放（一步历史汇总？逐条记录，每条一步） */
  apply(id) {
    const a = this.get(id);
    if (!a) return 0;
    const l = activeLayer();
    if (!l) { toast('请选择一个图层', 'err'); return 0; }
    const n = Recorder.replay(a.ops);
    toast('已重放动作：' + a.name + '（' + n + ' 步）', 'ok');
    return n;
  },

  summary(a) {
    if (!a || !a.ops || !a.ops.length) return '空动作';
    return a.ops.map(o => o.label || o.fn).join(' → ').slice(0, 60);
  }
};

/* ---------------- 动作对话框 ---------------- */
Dialogs.actions = function actionsDialog() {
  const listWrap = h('div', { class: 'exp-list', style: { maxHeight: '190px' } });
  const nameIn = h('input', { class: 'opt-field', type: 'text', placeholder: '动作名称，如「一键胶片感」' });
  const status = h('div', { class: 'hint' }, '');

  const render = () => {
    listWrap.innerHTML = '';
    const rows = Action.list();
    if (!rows.length) listWrap.append(h('div', { class: 'hint' }, '还没有动作。点「开始录制」，做几步调整后回来点「停止并保存」。'));
    rows.forEach(a => {
      listWrap.append(h('div', { class: 'exp-row' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { style: { fontSize: '11px' } }, a.name + ' · ' + a.ops.length + ' 步'),
          h('div', { class: 'hint', style: { marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, Action.summary(a))
        ),
        h('button', { class: 'icon-btn', title: '重放', html: icon('check', 12), onclick: () => { const n = Action.apply(a.id); status.textContent = '重放 ' + n + ' 步'; } }),
        h('button', { class: 'icon-btn', title: '删除', html: icon('close', 12), onclick: () => { Action.remove(a.id); render(); } })
      ));
    });
    status.textContent = Recorder.active ? ('录制中…已记录 ' + Recorder.ops.length + ' 步') : status.textContent;
  };

  const startBtn = h('button', {
    class: 'btn primary', style: { flex: '1' },
    onclick: () => {
      if (Recorder.active) { Recorder.cancel(); }
      else { Recorder.start(); }
      startBtn.textContent = Recorder.active ? '取消录制' : '开始录制';
      startBtn.classList.toggle('ghost', Recorder.active);
      render();
    }
  }, '开始录制');

  const stopBtn = h('button', {
    class: 'btn ghost', style: { flex: '0 0 auto' },
    onclick: () => {
      const rec = Recorder.stop(nameIn.value || '');
      startBtn.textContent = '开始录制';
      startBtn.classList.add('ghost');
      nameIn.value = '';
      render();
    }
  }, '停止并保存');

  const m = modal({
    title: '动作', sub: '录制 / 重放', width: 520,
    body: [
      h('div', { class: 'hint' }, '录制会把之后的滤镜、调整、曲线、LUT 调用记成步骤；停止后保存成动作，可以一键重放到任意图层。'),
      listWrap,
      status,
      h('div', { class: 'cap-line' }, '录制'),
      h('div', { class: 'field-row' }, fieldEl('动作名称', nameIn)),
      h('div', { class: 'exp-bar' }, startBtn, stopBtn)
    ],
    actions: [{ label: '关闭', ghost: true }]
  });
  render();
  return m;
};
