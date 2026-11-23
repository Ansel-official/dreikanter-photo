/* ==========================================================================
   Dreikanter photo — api.js
   内置脚本 API：window.Dreikanter
   ========================================================================== */
'use strict';

const Dreikanter = {
  version: '1.0.0',
  app: 'Dreikanter photo',

  /* ---------------- 信息 ---------------- */
  get doc() {
    return {
      name: App.doc.name,
      width: App.doc.w,
      height: App.doc.h,
      background: App.doc.bg,
      layers: App.layers.length
    };
  },

  info() {
    const l = activeLayer();
    return {
      name: App.doc.name,
      width: App.doc.w,
      height: App.doc.h,
      layers: App.layers.length,
      activeLayer: l ? l.name : null,
      zoom: Math.round(App.view.zoom * 100) / 100,
      selection: App.selection ? { ...App.selection.bounds } : null,
      history: History.entries.length
    };
  },

  /* ---------------- 文档 ---------------- */
  new(w = 1200, h = 800, opts = {}) {
    newDocument(w, h, { bg: opts.bg || 'transparent', name: opts.name || '未命名' });
    hideWelcome();
    return this.info();
  },

  open() { openFilePicker(false); return '选择文件…'; },

  /* ---------------- 图层 ---------------- */
  layer: {
    list() {
      return App.layers.map((l, i) => ({
        index: i, id: l.id, name: l.name, type: l.type,
        opacity: l.opacity, blend: l.blend, visible: l.visible, active: l.id === App.activeId
      }));
    },
    active() { const l = activeLayer(); return l ? { id: l.id, name: l.name } : null; },
    add(name = '图层') {
      History.begin('新建图层', []);
      const l = addLayer(createLayer(name));
      History.end();
      return l.id;
    },
    duplicate() { duplicateLayer(App.activeId); return activeLayer() ? activeLayer().id : null; },
    remove() { deleteLayer(App.activeId); return this.list(); },
    merge() { mergeDown(App.activeId); return this.list(); },
    flatten() { flattenImage(); return this.list(); },
    select(ref) {
      const l = typeof ref === 'number' ? App.layers[ref] : App.layers.find(x => x.id === ref || x.name === ref);
      if (!l) throw new Error('找不到图层：' + ref);
      App.activeId = l.id; sync(); invalidate();
      return l.name;
    },
    set(props = {}) {
      const l = activeLayer();
      if (!l) throw new Error('没有活动图层');
      History.begin('图层属性', []);
      if (props.name != null) l.name = props.name;
      if (props.opacity != null) l.opacity = clamp(props.opacity > 1 ? props.opacity / 100 : props.opacity, 0, 1);
      if (props.blend != null) l.blend = props.blend;
      if (props.visible != null) l.visible = !!props.visible;
      if (props.x != null) l.x = props.x;
      if (props.y != null) l.y = props.y;
      History.end(); invalidate(); sync();
      return { name: l.name, opacity: l.opacity, blend: l.blend };
    }
  },

  /* ---------------- 调色 ---------------- */
  adjust(p = {}) {
    const l = activeLayer();
    if (!l) throw new Error('没有活动图层');
    History.begin('API 调色', [l.id]);
    const ctx = ctx2d(l.canvas);
    const img = ctx.getImageData(0, 0, l.canvas.width, l.canvas.height);
    const before = App.selection ? FX.cloneData(img) : null;
    if (p.brightness != null || p.contrast != null) FX.brightnessContrast(img, p);
    if (p.saturation != null || p.hue != null || p.lightness != null) FX.saturation(img, p);
    if (p.temp != null || p.tint != null) FX.temperature(img, { temp: (p.temp || 0) / (Math.abs(p.temp) > 1 ? 100 : 1), tint: (p.tint || 0) / (Math.abs(p.tint) > 1 ? 100 : 1) });
    if (p.exposure != null) FX.exposure(img, p);
    if (p.vibrance != null) FX.vibrance(img, p);
    if (p.levels) FX.levels(img, p.levels);
    if (before) blendMasked(img, before, App.selection.mask, l.x, l.y);
    ctx.putImageData(img, 0, 0);
    l.thumbDirty = true;
    History.end(); invalidate(); sync();
    return 'ok';
  },

  filter(name, p = {}) {
    const fn = FX[name];
    if (typeof fn !== 'function') throw new Error('未知滤镜：' + name);
    applyFilterDirect(fn, p, 'API · ' + name);
    return 'ok';
  },

  style(id) {
    if (!STYLES.find(s => s.id === id)) throw new Error('未知风格：' + id);
    applyStyle(id);
    return id;
  },

  /* ---------------- 绘制 ---------------- */
  text(str, opts = {}) {
    const l = createLayer(opts.name || '文字');
    l.type = 'text';
    const size = opts.size || Math.max(20, Math.round(App.doc.w / 14));
    l.text = {
      string: String(str),
      font: opts.font || '"Microsoft YaHei", system-ui',
      size,
      weight: opts.weight || '700',
      align: opts.align || 'left',
      lineHeight: opts.lineHeight || 1.2,
      color: opts.color || App.fg,
      x: opts.x != null ? opts.x : Math.round(App.doc.w * 0.1),
      y: opts.y != null ? opts.y : Math.round(App.doc.h * 0.4),
      spacing: opts.spacing || 0
    };
    History.begin('API 文字', []);
    Text.render(l);
    App.layers.push(l);
    App.activeId = l.id;
    History.end();
    invalidate(); sync();
    return l.id;
  },

  shape(kind, opts = {}) {
    const l = activeLayer();
    if (!l) throw new Error('没有活动图层');
    const x = opts.x != null ? opts.x : 0, y = opts.y != null ? opts.y : 0;
    const w = opts.w != null ? opts.w : App.doc.w, h = opts.h != null ? opts.h : App.doc.h;
    const color = opts.color || App.fg;
    History.begin('API 形状', [l.id]);
    const c = ctx2d(l.canvas);
    c.save();
    c.translate(-l.x, -l.y);
    c.fillStyle = color;
    c.strokeStyle = opts.strokeColor || color;
    c.lineWidth = opts.stroke || 0;
    const p = new Path2D();
    if (kind === 'ellipse') p.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else if (kind === 'line') { c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.strokeStyle = color; c.lineWidth = opts.stroke || 4; c.stroke(); c.restore(); History.end(); invalidate(); sync(); return 'ok'; }
    else if (kind === 'triangle') { p.moveTo(x + w / 2, y); p.lineTo(x + w, y + h); p.lineTo(x, y + h); p.closePath(); }
    else if (kind === 'star') starPath(p, x + w / 2, y + h / 2, w / 2, h / 3.4, 5);
    else if (kind === 'round') roundRect(p, x, y, w, h, opts.radius || Math.min(w, h) / 8);
    else p.rect(x, y, w, h);
    c.fill(p);
    if (opts.stroke > 0) c.stroke(p);
    c.restore();
    l.thumbDirty = true;
    History.end(); invalidate(); sync();
    return 'ok';
  },

  /* ---------------- 选区 / 变换 ---------------- */
  selection: {
    all() { selectAll(); return 'ok'; },
    none() { deselect(); return 'ok'; },
    invert() { invertSelection(); return 'ok'; }
  },

  transform: {
    crop(r) { cropToRect(r); return 'ok'; },
    resize(w, h) { resizeImage(w, h == null ? App.doc.h * (w / App.doc.w) : h); return 'ok'; },
    rotate(deg) { rotateDoc(deg); return 'ok'; },
    flip(horizontal = true) { flipDoc(!!horizontal); return 'ok'; }
  },

  history: {
    undo() { History.undo(); return 'ok'; },
    redo() { History.redo(); return 'ok'; },
    get size() { return History.entries.length; }
  },

  /* ---------------- 导出 ---------------- */
  export(type = 'png', quality = .92, name) {
    const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
    const mime = map[String(type).toLowerCase()] || 'image/png';
    exportImage(mime, quality, name);
    return { type: mime, size: App.doc.w + '×' + App.doc.h };
  },

  /* ---------------- 其它 ---------------- */
  agent(cmd) { return Agent.handle(cmd).reply; },

  /* 指令引擎：与「指令」面板同一套解析 */
  cmd(text) { return Agent.handle(text).reply; },

  /* 指令列表（可供外部 UI 调用） */
  commands() { return COMMANDS.map(c => ({ id: c.id, group: c.group, label: c.label })); },

  runCommand(id) { return Agent.run(id); },

  toast(msg) { toast(String(msg), 'ok'); return 'ok'; },

  on(event, cb) {
    if (typeof cb !== 'function') throw new Error('回调必须是函数');
    if (event === 'change') {
      const prev = App.onChange;
      App.onChange = () => { if (prev) prev(); cb(this.info()); };
    }
    return 'ok';
  }
};

/* ---------------- 运行器 ---------------- */
const API = {
  obj: Dreikanter,

  run(code) {
    const fn = new Function('Dreikanter', 'D', '"use strict";\n' + code);
    return fn(Dreikanter, Dreikanter);
  },

  format(v) {
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return v;
    try {
      const s = JSON.stringify(v, null, 2);
      return s.length > 1200 ? s.slice(0, 1200) + '\n…' : s;
    } catch (e) { return String(v); }
  },

  docs() {
    const row = (name, desc) => `<div class="api-row"><b>${name}</b><span>${desc}</span></div>`;
    return `
      <h4>文档</h4>
      ${row('Dreikanter.info()', '返回文档与选区信息')}
      ${row('Dreikanter.new(w, h, opts)', '新建画布，opts.bg / opts.name')}
      ${row('Dreikanter.open()', '打开文件选择器')}
      ${row('Dreikanter.doc', '文档属性（只读）')}

      <h4>图层</h4>
      ${row('Dreikanter.layer.list()', '所有图层数组')}
      ${row('Dreikanter.layer.add(name)', '新建图层，返回 id')}
      ${row('Dreikanter.layer.select(id|index|name)', '选中图层')}
      ${row('Dreikanter.layer.set({opacity, blend, visible, name, x, y})', '修改图层属性')}
      ${row('Dreikanter.layer.duplicate() / remove() / merge() / flatten()', '图层操作')}

      <h4>调色与滤镜</h4>
      ${row('Dreikanter.adjust({brightness, contrast})', '亮度 -100…100 / 对比度')}
      ${row('Dreikanter.adjust({saturation, hue, lightness})', '色相 -180…180')}
      ${row('Dreikanter.adjust({temp, tint})', '色温 / 色调 -100…100')}
      ${row('Dreikanter.adjust({exposure, vibrance, levels})', '曝光 / 鲜艳度 / 色阶')}
      ${row('Dreikanter.filter(name, params)', 'blur / sharpen / noise / pixelate / grain / vignette / glow / fade / motionBlur / emboss / findEdges / invert / threshold / posterize / gradientMap / blackWhite / temperature / vibrance')}
      ${row('Dreikanter.style(id)', 'original / film / mono / teal / cyber / jp / moody / faded')}

      <h4>绘制</h4>
      ${row('Dreikanter.text(str, {x, y, size, color, weight, align, spacing})', '创建文字图层')}
      ${row('Dreikanter.shape(kind, {x, y, w, h, color, radius, stroke})', 'kind: rect / round / ellipse / line / triangle / star')}

      <h4>选区与变换</h4>
      ${row('Dreikanter.selection.all() / none() / invert()', '选区操作')}
      ${row('Dreikanter.transform.crop({x,y,w,h})', '裁剪')}
      ${row('Dreikanter.transform.resize(w, h)', '缩放画布')}
      ${row('Dreikanter.transform.rotate(90) / flip(true)', '旋转 / 翻转')}

      <h4>输出与指令</h4>
      ${row('Dreikanter.export("png"|"jpg"|"webp", quality, name)', '导出并下载')}
      ${row('Dreikanter.cmd("胶片感，裁成 16:9")', '以自然语言指令驱动编辑器')}
      ${row('Dreikanter.commands()', '列出全部内置指令')}
      ${row('Dreikanter.runCommand(id)', '按 id 执行指令，如 style.film')}
      ${row('Dreikanter.history.undo() / redo()', '历史记录')}
      ${row('Dreikanter.on("change", fn)', '监听文档变化')}
      <h4>示例</h4>
      <code>Dreikanter.new(1600, 1000, {name:"海报"})

Dreikanter.style("teal")
Dreikanter.text("HELLO", {x:120, y:600, size:180, weight:"900"})
Dreikanter.shape("round", {x:100, y:100, w:300, h:80, radius:40, color:"#7b8cff"})
Dreikanter.export("png")</code>
    `;
  }
};

window.Dreikanter = Dreikanter;
