/* ==========================================================================
   Dreikanter photo — perf.js
   Worker 滤镜管线 / 长任务监控 / 资源回收 / 导出队列
   ========================================================================== */
'use strict';

/* ---------------- Worker 滤镜 ---------------- */
const WorkerFX = {
  worker: null,
  ready: false,
  seq: 0,
  pending: new Map(),

  init() {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return;
    try {
      this.worker = new Worker('js/filter-worker.js');
      this.worker.onmessage = e => {
        const { id, bitmap, error } = e.data;
        const job = this.pending.get(id);
        this.pending.delete(id);
        if (!job) return;
        if (error) job.reject(new Error(error));
        else job.resolve(bitmap);
      };
      this.worker.onerror = () => { this.ready = false; };
      this.ready = true;
    } catch (e) {
      this.ready = false;
    }
  },

  opFor(fn) {
    if (typeof FX === 'undefined') return null;
    if (fn === FX.blur) return 'blur';
    if (fn === FX.sharpen) return 'sharpen';
    if (fn === FX.pixelate) return 'pixelate';
    if (fn === FX.noise) return 'noise';
    if (fn === FX.invert) return 'invert';
    return null;
  },

  /** 用 ImageData 起一条 worker 任务，返回 Promise<ImageBitmap> */
  run(op, imageData, params) {
    if (!this.ready || !this.worker) return Promise.reject(new Error('worker unavailable'));
    const oc = new OffscreenCanvas(imageData.width, imageData.height);
    const c = oc.getContext('2d');
    c.putImageData(imageData, 0, 0);
    const bmp = oc.transferToImageBitmap();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, op, bitmap: bmp, params: params || {} }, [bmp]);
    });
  }
};

/* ---------------- 长任务监控 ---------------- */
const Perf = {
  longTasks: [],
  boot: 0,
  observer: null,
  init() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      this.observer = new PerformanceObserver(list => {
        list.getEntries().forEach(e => {
          this.longTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) });
          if (this.longTasks.length > 50) this.longTasks.shift();
        });
      });
      this.observer.observe({ entryTypes: ['longtask'] });
    } catch (e) { /* 不支持则忽略 */ }
  },
  summary() {
    if (!this.longTasks.length) return '无 >50ms 长任务';
    const max = Math.max(...this.longTasks.map(t => t.duration));
    const total = this.longTasks.reduce((s, t) => s + t.duration, 0);
    return this.longTasks.length + ' 个长任务 · 最长 ' + max + 'ms · 合计 ' + total + 'ms';
  },
  clear() { this.longTasks.length = 0; }
};

/* ---------------- 资源回收 ---------------- */
const Resources = {
  urls: new Set(),
  timers: new Set(),
  trackUrl(url) { this.urls.add(url); return url; },
  releaseUrl(url) {
    if (!url) return;
    try { URL.revokeObjectURL(url); } catch (e) { }
    this.urls.delete(url);
  },
  releaseAll() {
    [...this.urls].forEach(u => this.releaseUrl(u));
  },
  /** 关闭/切换文档时释放像素引用，等待 GC */
  releaseDoc(session) {
    if (!session) return;
    try {
      session.layers = null;
      session.history = null;
      session.selection = null;
      session.doc = null;
    } catch (e) { }
  },
  memory() {
    if (!performance.memory) return null;
    return {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
      peak: Math.round(performance.memory.totalJSHeapSize / 1048576)
    };
  }
};

/* ---------------- 导出队列（可暂停 / 取消 / 重排 / 重试） ---------------- */
const ExportQueue = {
  jobs: [],
  running: false,
  paused: false,
  done: 0,
  failed: 0,
  current: null,
  onChange: null,

  push(job) {
    const j = Object.assign({
      id: uid('job'), status: 'queued', tries: 0, error: null, cancelled: false
    }, job);
    this.jobs.push(j);
    this.emit();
    this.run();
    return j.id;
  },

  stats() {
    const c = { queued: 0, running: 0, done: 0, failed: 0 };
    this.jobs.forEach(j => { c[j.status] = (c[j.status] || 0) + 1; });
    return c;
  },

  emit() {
    if (typeof this.onChange === 'function') { try { this.onChange(this); } catch (e) { } }
  },

  pause() {
    this.paused = true;
    this.emit();
    toast('导出队列已暂停');
  },

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.emit();
    this.run();
    toast('导出队列已继续');
  },

  cancel(id) {
    const j = this.jobs.find(x => x.id === id);
    if (!j) return;
    if (j.status === 'running') { j.cancelled = true; this.emit(); return; }
    j.status = 'failed';
    j.error = '已取消';
    this.emit();
  },

  cancelAll() {
    this.jobs.forEach(j => {
      if (j.status === 'queued') { j.status = 'failed'; j.error = '已取消'; }
      if (j.status === 'running') j.cancelled = true;
    });
    this.emit();
  },

  clearFinished() {
    this.jobs = this.jobs.filter(j => j.status === 'queued' || j.status === 'running');
    this.emit();
  },

  move(id, delta) {
    const i = this.jobs.findIndex(j => j.id === id);
    const k = i + delta;
    if (i < 0 || k < 0 || k >= this.jobs.length) return;
    const [j] = this.jobs.splice(i, 1);
    this.jobs.splice(k, 0, j);
    this.emit();
  },

  retry(id) {
    const j = this.jobs.find(x => x.id === id);
    if (!j || j.status !== 'failed') return;
    j.status = 'queued'; j.error = null; j.cancelled = false;
    this.emit();
    this.run();
  },

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); },

  async _exec(job) {
    const max = 3;
    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        /* 测试钩子：模拟前 N 次失败，验证退避重试 */
        if (job.failFirst && attempt <= job.failFirst) throw new Error('模拟编码失败 #' + attempt);
        if (job.cancelled) throw new Error('已取消');
        await exportImageAsync(job);
        job.tries = attempt;
        return;
      } catch (e) {
        job.tries = attempt;
        job.error = e.message;
        if (job.cancelled || attempt === max) throw e;
        /* 指数退避：120 / 240 ms */
        await this._wait(120 * Math.pow(2, attempt - 1));
      }
    }
  },

  async run() {
    if (this.running) return;
    this.running = true;
    const total = this.jobs.filter(j => j.status === 'queued').length;
    if (typeof Progress !== 'undefined') Progress.start('导出队列');
    for (;;) {
      if (this.paused) break;
      const job = this.jobs.find(j => j.status === 'queued');
      if (!job) break;
      job.status = 'running';
      this.current = job;
      this.emit();
      try {
        await this._exec(job);
        if (job.cancelled) { job.status = 'failed'; job.error = '已取消'; }
        else { job.status = 'done'; this.done++; }
      } catch (e) {
        job.status = 'failed';
        job.error = e.message;
        this.failed++;
        toast('导出失败：' + (job.name || '') + ' · ' + e.message, 'err');
      }
      if (typeof Progress !== 'undefined' && total > 1) {
        const fin = this.jobs.filter(j => j.status === 'done' || j.status === 'failed').length;
        if (fin < total) toast('导出中 ' + fin + '/' + total, '');
      }
      this.current = null;
      this.emit();
    }
    this.running = false;
    this.current = null;
    if (typeof Progress !== 'undefined') Progress.done();
    this.emit();
  }
};

/* ---------------- 文件命名模板 ---------------- */
function exportName(base, box, scale) {
  const sd = (Settings && Settings.data) || {};
  const tpl = sd.nameTemplate || '{name}-{size}-{date}-{time}';
  const sc = scale || 1;
  const w = box ? box.w : Math.round((App.doc.w || 0) * sc);
  const h = box ? box.h : Math.round((App.doc.h || 0) * sc);
  const dims = w + 'x' + h;
  const d = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const date = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate());
  const time = p2(d.getHours()) + p2(d.getMinutes());
  const prefix = sd.exportPrefix || '';
  return (prefix + tpl)
    .replace(/\{name\}/g, base || 'image')
    .replace(/\{size\}/g, dims)
    .replace(/\{w\}/g, String(w))
    .replace(/\{h\}/g, String(h))
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/[\\/:*?"<>|]/g, '-');
}

/* ---------------- 轻量会话快照（不含像素） ---------------- */
const Session = {
  init() {
    setInterval(() => this.save(), 5000);
    window.addEventListener('pagehide', () => this.save());
  },
  save() {
    if (!App.doc.w) return;
    Store.set('session', {
      name: App.doc.name || '未命名',
      w: App.doc.w, h: App.doc.h,
      zoom: +App.view.zoom.toFixed(4),
      cx: Math.round(App.view.cx), cy: Math.round(App.view.cy),
      tool: Tools.current, mode: App.mode,
      time: Date.now()
    });
  }
};
