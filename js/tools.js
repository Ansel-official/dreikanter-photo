/* ==========================================================================
   Dreikanter photo — tools.js
   工具集 / 指针交互 / 画笔引擎
   ========================================================================== */
'use strict';

const Tools = {
  current: 'move',
  state: {},
  drag: null,
  spaceDown: false,
  shiftDown: false,
  altDown: false,

  defs: {
    move: {
      label: '移动', icon: 'move', key: 'V', cursor: 'move', group: 'core',
      opts: [{ key: 'auto', label: '自动选择图层', type: 'check', def: false }],
      down(pt, e) {
        if (!App.doc.w) return;
        let l = activeLayer();
        if (!l) return;
        if (Tools.state.move.auto) {
          const hit = hitLayerAt(pt);
          if (hit) { App.activeId = hit.id; sync(); }
          l = activeLayer();
        }
        if (l.locked) { toast('图层已锁定', 'err'); return; }
        History.begin('移动图层', [l.id]);
        Tools.drag = { type: 'move', layer: l, start: pt, ox: l.x, oy: l.y, moved: false };
      },
      move(pt) {
        const d = Tools.drag;
        if (!d) return;
        let nx = d.ox + pt.x - d.start.x;
        let ny = d.oy + pt.y - d.start.y;
        if (typeof Guides !== 'undefined' && Guides.snap) {
          const snapped = Guides.snapMove(d.layer, nx, ny);
          nx = snapped.x; ny = snapped.y;
        }
        d.layer.x = Math.round(nx);
        d.layer.y = Math.round(ny);
        d.moved = true;
        Tools.setHint(`X ${d.layer.x}  Y ${d.layer.y}`);
        invalidate();
      },
      up() {
        const d = Tools.drag;
        if (!d) return;
        if (!d.moved) { History.pending = null; }
        else { History.end(); sync(); }
        Tools.drag = null;
      }
    },

    marquee: {
      label: '矩形选框', icon: 'marquee', key: 'M', cursor: 'crosshair', group: 'select',
      opts: [
        { key: 'mode', label: '模式', type: 'modes', def: 'new', options: [['new', '新建选区', 'marquee'], ['add', '添加到选区（Shift）', 'plus'], ['sub', '从选区减去（Alt）', 'minus'], ['intersect', '与选区交叉（Shift+Alt）', 'target']] },
        { key: 'feather', label: '羽化', type: 'number', min: 0, max: 100, def: 0, unit: 'px' }
      ],
      down(pt, e) { Tools.drag = { type: 'marquee', kind: 'rect', start: pt, cur: pt, alt: !!(e && e.altKey), shift: !!(e && e.shiftKey) }; },
      move(pt, e) {
        const d = Tools.drag; if (!d) return;
        d.cur = pt; d.shift = !!(e && e.shiftKey);
        App.marquee = { kind: 'rect', rect: rectFromPoints(d.start, pt), shift: d.shift };
        invalidateOverlay();
      },
      up(e) {
        const d = Tools.drag; if (!d) return;
        const r = rectFromPoints(d.start, d.cur);
        Tools.drag = null; App.marquee = null;
        if (r.w < 1 || r.h < 1) { deselect(); invalidateOverlay(); return; }
        Tools.makeRectSelection(r, 'rect', Tools.selMode(Tools.state.marquee.mode, e, d));
      }
    },

    ellipse: {
      label: '椭圆选框', icon: 'ellipse', key: 'M', cursor: 'crosshair', group: 'select',
      opts: [
        { key: 'mode', label: '模式', type: 'modes', def: 'new', options: [['new', '新建选区', 'marquee'], ['add', '添加到选区（Shift）', 'plus'], ['sub', '从选区减去（Alt）', 'minus'], ['intersect', '与选区交叉（Shift+Alt）', 'target']] },
        { key: 'feather', label: '羽化', type: 'number', min: 0, max: 100, def: 0, unit: 'px' }
      ],
      down(pt, e) { Tools.drag = { type: 'marquee', kind: 'ellipse', start: pt, cur: pt, alt: !!(e && e.altKey) }; },
      move(pt) {
        const d = Tools.drag; if (!d) return;
        d.cur = pt;
        App.marquee = { kind: 'ellipse', rect: rectFromPoints(d.start, pt) };
        invalidateOverlay();
      },
      up(e) {
        const d = Tools.drag; if (!d) return;
        const r = rectFromPoints(d.start, d.cur);
        Tools.drag = null; App.marquee = null;
        if (r.w < 2 || r.h < 2) { deselect(); invalidateOverlay(); return; }
        Tools.makeRectSelection(r, 'ellipse', Tools.selMode(Tools.state.ellipse.mode, e, d));
      }
    },

    lasso: {
      label: '套索', icon: 'lasso', key: 'L', cursor: 'crosshair', group: 'select',
      opts: [
        { key: 'mode', label: '模式', type: 'modes', def: 'new', options: [['new', '新建选区', 'marquee'], ['add', '添加到选区（Shift）', 'plus'], ['sub', '从选区减去（Alt）', 'minus'], ['intersect', '与选区交叉（Shift+Alt）', 'target']] },
        { key: 'feather', label: '羽化', type: 'number', min: 0, max: 60, def: 0, unit: 'px' }
      ],
      down(pt, e) { Tools.drag = { type: 'lasso', pts: [pt], alt: !!(e && e.altKey) }; },
      move(pt) {
        const d = Tools.drag; if (!d) return;
        const last = d.pts[d.pts.length - 1];
        if (Math.hypot(pt.x - last.x, pt.y - last.y) > 1.5) d.pts.push(pt);
        App.marquee = { kind: 'lasso', points: d.pts };
        invalidateOverlay();
      },
      up(e) {
        const d = Tools.drag; if (!d) return;
        Tools.drag = null; App.marquee = null;
        if (d.pts.length < 3) { invalidateOverlay(); return; }
        Tools.makeLassoSelection(d.pts, Tools.selMode(Tools.state.lasso.mode, e, d));
        invalidateOverlay();
      }
    },

    wand: {
      label: '魔棒', icon: 'wand', key: 'W', cursor: 'crosshair', group: 'select',
      opts: [
        { key: 'mode', label: '模式', type: 'modes', def: 'new', options: [['new', '新建选区', 'marquee'], ['add', '添加到选区（Shift）', 'plus'], ['sub', '从选区减去（Alt）', 'minus'], ['intersect', '与选区交叉（Shift+Alt）', 'target']] },
        { key: 'tolerance', label: '容差', type: 'range', min: 0, max: 120, def: 24 },
        { key: 'contiguous', label: '连续', type: 'check', def: true },
        { key: 'sample', label: '取样', type: 'select', def: 'all', options: [['all', '所有图层'], ['layer', '当前图层']] }
      ],
      down(pt, e) {
        if (!App.doc.w) return;
        const st = Tools.state.wand;
        const m = Tools.magicWand(pt, st.tolerance, st.contiguous, st.sample !== 'layer');
        Tools.applySelectionMask(m, Tools.selMode(st.mode, e));
      }
    },

    crop: {
      label: '裁剪', icon: 'crop', key: 'C', cursor: 'crosshair', group: 'crop',
      opts: [
        {
          key: 'ratio', label: '比例', type: 'select', def: 'free',
          options: [['free', '自由'], ['1:1', '1:1'], ['4:3', '4:3'], ['3:2', '3:2'], ['16:9', '16:9'], ['9:16', '9:16'], ['orig', '原图'], ['custom', '自定义']],
          onChange: () => {
            if (App.cropRect) { App.cropRect = Tools.constrainCrop(App.cropRect, Tools.state.crop.ratio); invalidateOverlay(); }
          }
        },
        { key: 'cw', label: '宽比', type: 'number', min: 1, max: 100, def: 5, onChange: () => Tools.reconstrain() },
        { key: 'ch', label: '高比', type: 'number', min: 1, max: 100, def: 4, onChange: () => Tools.reconstrain() },
        {
          key: 'angle', label: '拉直', type: 'number', min: -45, max: 45, def: 0, unit: '°',
          onChange: v => { App.cropAngle = clamp(v, -45, 45); invalidateOverlay(); }
        },
        {
          key: 'guide', label: '辅助线', type: 'select', def: 'thirds',
          options: [['thirds', '三分线'], ['golden', '黄金分割'], ['grid', '四宫格'], ['none', '无']],
          onChange: () => invalidateOverlay()
        }
      ],
      down(pt, e) {
        const r = App.cropRect;
        if (r) {
          const hit = Tools.cropHit(pt, r, App.cropAngle || 0);
          if (hit) {
            Tools.drag = {
              type: 'crop', mode: hit.type, handle: hit.handle,
              start: pt, box: { ...r }, angle: App.cropAngle || 0,
              center: { x: r.x + r.w / 2, y: r.y + r.h / 2 }
            };
            return;
          }
        }
        Tools.drag = { type: 'crop', mode: 'new', start: pt, cur: pt };
        App.cropAngle = Tools.state.crop.angle || 0;
        App.cropRect = { x: pt.x, y: pt.y, w: 1, h: 1 };
      },
      move(pt, e) {
        const d = Tools.drag;
        if (!d) return;
        if (d.mode === 'new') {
          d.cur = pt;
          let r = rectFromPoints(d.start, pt);
          r = Tools.constrainCrop(r, Tools.state.crop.ratio);
          if (e && e.shiftKey && Tools.state.crop.ratio === 'free') {
            const s = Math.max(r.w, r.h);
            r.w = s; r.h = s;
          }
          App.cropRect = r;
        } else if (d.mode === 'move') {
          App.cropRect = {
            x: d.box.x + (pt.x - d.start.x), y: d.box.y + (pt.y - d.start.y),
            w: d.box.w, h: d.box.h
          };
        } else if (d.mode === 'rotate') {
          const a = Math.atan2(pt.y - d.center.y, pt.x - d.center.x) * 180 / Math.PI + 90;
          let ang = a;
          const norm = ((ang + 180) % 360 + 360) % 360 - 180;
          ang = clamp(norm, -45, 45);
          if (e && e.shiftKey) ang = Math.round(ang / 5) * 5;
          App.cropAngle = ang;
          Tools.state.crop.angle = Math.round(ang * 10) / 10;
          const inp = document.getElementById('opt-angle');
          if (inp) inp.value = Math.round(ang * 10) / 10;
        } else {
          Tools.cropResize(d, pt, e);
        }
        invalidateOverlay();
        UI.syncCropButtons && UI.syncCropButtons();
      },
      up() {
        Tools.drag = null;
        if (App.cropRect && (App.cropRect.w < 3 || App.cropRect.h < 3)) App.cropRect = null;
        invalidateOverlay();
        UI.syncCropButtons && UI.syncCropButtons();
      }
    },

    picker: {
      label: '吸管', icon: 'picker', key: 'I', cursor: 'crosshair', group: 'core',
      opts: [
        { key: 'sample', label: '取样', type: 'select', def: 'all', options: [['all', '所有图层'], ['layer', '当前图层']] },
        { key: 'avg', label: '平均', type: 'select', def: '1', options: [['1', '1×1'], ['3', '3×3'], ['5', '5×5']] }
      ],
      down(pt, e) {
        const st = Tools.state.picker;
        const hex = Tools.pickColor(pt, st.sample === 'layer', parseInt(st.avg || '1', 10));
        if (!hex) return;
        if (e.altKey) App.bg = hex; else App.fg = hex;
        UI.syncColors && UI.syncColors();
        toast('已取样 ' + hex.toUpperCase() + (st.avg !== '1' ? '（' + st.avg + '×' + st.avg + ' 平均）' : ''));
      }
    },

    brush: {
      label: '画笔', icon: 'brush', key: 'B', cursor: 'none', group: 'paint', brush: true,
      opts: [
        { key: 'size', label: '大小', type: 'number', min: 1, max: 500, def: 32, unit: 'px' },
        { key: 'hardness', label: '硬度', type: 'number', min: 0, max: 100, def: 78, unit: '%' },
        { key: 'opacity', label: '不透明度', type: 'number', min: 1, max: 100, def: 100, unit: '%' },
        { key: 'flow', label: '流量', type: 'number', min: 1, max: 100, def: 100, unit: '%' },
        { key: 'sym', label: '对称', type: 'select', def: 'none', options: [['none', '无'], ['h', '水平'], ['v', '垂直'], ['both', '双轴']] }
      ],
      down(pt, e) {
        Tools.beginPaint(pt, e, 'brush');
      },
      move(pt, e) { Tools.paintTo(pt, e); },
      up() { Tools.endPaint(); }
    },

    eraser: {
      label: '橡皮擦', icon: 'eraser', key: 'E', cursor: 'none', group: 'paint', brush: true,
      opts: [
        { key: 'size', label: '大小', type: 'number', min: 1, max: 500, def: 40, unit: 'px' },
        { key: 'hardness', label: '硬度', type: 'number', min: 0, max: 100, def: 70, unit: '%' },
        { key: 'opacity', label: '不透明度', type: 'number', min: 1, max: 100, def: 100, unit: '%' }
      ],
      down(pt, e) { Tools.beginPaint(pt, e, 'erase'); },
      move(pt, e) { Tools.paintTo(pt, e); },
      up() { Tools.endPaint(); }
    },

    bucket: {
      label: '油漆桶', icon: 'bucket', key: 'G', cursor: 'crosshair', group: 'paint',
      opts: [
        { key: 'tolerance', label: '容差', type: 'number', min: 0, max: 120, def: 20 },
        { key: 'contiguous', label: '连续', type: 'check', def: true },
        { key: 'opacity', label: '不透明度', type: 'number', min: 1, max: 100, def: 100, unit: '%' }
      ],
      down(pt) {
        const l = activeLayer();
        if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
        History.begin('油漆桶', [l.id]);
        Tools.bucketFill(pt, Tools.state.bucket);
        History.end();
        invalidate(); sync();
      }
    },

    gradient: {
      label: '渐变', icon: 'gradient', key: 'G', cursor: 'crosshair', group: 'paint',
      opts: [
        { key: 'type', label: '类型', type: 'select', def: 'linear', options: [['linear', '线性'], ['radial', '径向'], ['angle', '角度'], ['reflect', '对称']] },
        { key: 'mode', label: '填充', type: 'select', def: 'fgbg', options: [['fgbg', '前景到背景'], ['fgt', '前景到透明']] },
        { key: 'opacity', label: '不透明度', type: 'number', min: 1, max: 100, def: 100, unit: '%' }
      ],
      down(pt) {
        const l = activeLayer();
        if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
        History.begin('渐变', [l.id]);
        Tools.drag = { type: 'gradient', layer: l, start: pt, cur: pt };
      },
      move(pt) {
        const d = Tools.drag; if (!d) return;
        d.cur = pt; App.gradPreview = { a: d.start, b: pt };
        invalidateOverlay();
      },
      up() {
        const d = Tools.drag; if (!d) return;
        Tools.drag = null; App.gradPreview = null;
        Tools.paintGradient(d.layer, d.start, d.cur, Tools.state.gradient);
        History.end();
        invalidate(); sync();
      }
    },

    blur: {
      label: '模糊工具', icon: 'blur', key: 'R', cursor: 'none', group: 'retouch', brush: true,
      opts: [
        { key: 'size', label: '大小', type: 'number', min: 4, max: 400, def: 60, unit: 'px' },
        { key: 'strength', label: '强度', type: 'number', min: 1, max: 100, def: 40, unit: '%' }
      ],
      down(pt) { Tools.beginRetouch(pt); },
      move(pt) { Tools.retouchTo(pt); },
      up() { Tools.endRetouch('模糊'); }
    },

    dodge: {
      label: '减淡', icon: 'dodge', key: 'O', cursor: 'none', group: 'retouch', brush: true,
      opts: [
        { key: 'size', label: '大小', type: 'number', min: 4, max: 400, def: 70, unit: 'px' },
        { key: 'strength', label: '曝光', type: 'number', min: 1, max: 100, def: 22, unit: '%' },
        { key: 'range', label: '范围', type: 'select', def: 'mid', options: [['shadow', '阴影'], ['mid', '中间调'], ['high', '高光']] }
      ],
      down(pt) { Tools.beginRetouch(pt); },
      move(pt) { Tools.retouchTo(pt); },
      up() { Tools.endRetouch('减淡'); }
    },

    burn: {
      label: '加深', icon: 'burn', key: 'O', cursor: 'none', group: 'retouch', brush: true,
      opts: [
        { key: 'size', label: '大小', type: 'number', min: 4, max: 400, def: 70, unit: 'px' },
        { key: 'strength', label: '曝光', type: 'number', min: 1, max: 100, def: 22, unit: '%' },
        { key: 'range', label: '范围', type: 'select', def: 'mid', options: [['shadow', '阴影'], ['mid', '中间调'], ['high', '高光']] }
      ],
      down(pt) { Tools.beginRetouch(pt); },
      move(pt) { Tools.retouchTo(pt); },
      up() { Tools.endRetouch('加深'); }
    },

    clone: {
      label: '仿制图章', icon: 'copy', key: 'S', cursor: 'none', group: 'retouch', brush: true,
      opts: [
        { key: 'size', label: '大小', type: 'number', min: 4, max: 400, def: 60, unit: 'px' },
        { key: 'hardness', label: '硬度', type: 'number', min: 0, max: 100, def: 60, unit: '%' },
        { key: 'opacity', label: '不透明度', type: 'number', min: 1, max: 100, def: 100, unit: '%' },
        { key: 'sample', label: '取样', type: 'select', def: 'all', options: [['all', '所有图层'], ['layer', '当前图层']] }
      ],
      down(pt, e) {
        if (e.altKey) {
          Tools.cloneSource = { x: pt.x, y: pt.y };
          toast('取样完成，松开 Alt 开始涂抹', 'ok');
          invalidateOverlay();
          return;
        }
        if (!Tools.cloneSource) { toast('先按住 Alt 点击取样位置', 'err'); return; }
        const l = activeLayer();
        if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
        const srcCanvas = Tools.state.clone.sample === 'layer' ? l.canvas : compositeCanvas(false);
        History.begin('仿制图章', [l.id]);
        const c = ctx2d(l.canvas);
        c.save();
        c.translate(-l.x, -l.y);
        if (App.selection) c.clip(App.selection.path);
        const size = Tools.state.clone.size;
        Tools.drag = {
          type: 'clone', layer: l, ctx: c, srcCanvas, size,
          dx: pt.x - Tools.cloneSource.x, dy: pt.y - Tools.cloneSource.y,
          stamp: makeStamp(size, Tools.state.clone.hardness / 100, '#ffffff')
        };
        Tools.cloneStampAt(pt);
      },
      move(pt) { if (Tools.drag && Tools.drag.type === 'clone') Tools.cloneStampAt(pt); },
      up() {
        if (!Tools.drag || Tools.drag.type !== 'clone') return;
        try { Tools.drag.ctx.restore(); } catch (e) { }
        Tools.drag = null;
        History.end(); sync();
      }
    },

    text: {
      label: '文字', icon: 'text', key: 'T', cursor: 'text', group: 'vector',
      opts: [
        { key: 'font', label: '字体', type: 'select', def: 'system-ui', options: [['system-ui', '系统默认'], ['"Microsoft YaHei"', '微软雅黑'], ['"PingFang SC"', '苹方'], ['SimHei', '黑体'], ['SimSun', '宋体'], ['Georgia', 'Georgia'], ['Impact', 'Impact'], ['"Courier New"', 'Courier']] },
        { key: 'size', label: '字号', type: 'number', min: 6, max: 500, def: 64, unit: 'px' },
        { key: 'weight', label: '字重', type: 'select', def: '700', options: [['300', '细'], ['400', '常规'], ['600', '半粗'], ['700', '粗'], ['900', '特粗']] },
        { key: 'align', label: '对齐', type: 'select', def: 'left', options: [['left', '左'], ['center', '中'], ['right', '右']] },
        { key: 'lineHeight', label: '行距', type: 'number', min: 80, max: 220, def: 120, unit: '%' }
      ],
      down(pt) {
        const exists = App.layers.find(l => l.type === 'text' && l.text && pointInTextBox(pt, l));
        if (exists) { App.activeId = exists.id; Text.open(exists); sync(); return; }
        Text.createAt(pt);
      }
    },

    shape: {
      label: '形状', icon: 'shape', key: 'U', cursor: 'crosshair', group: 'vector',
      opts: [
        { key: 'kind', label: '形状', type: 'select', def: 'rect', options: [['rect', '矩形'], ['ellipse', '椭圆'], ['line', '直线'], ['triangle', '三角'], ['star', '星形']] },
        { key: 'fill', label: '填充', type: 'check', def: true },
        { key: 'stroke', label: '描边', type: 'number', min: 0, max: 40, def: 0, unit: 'px' },
        { key: 'radius', label: '圆角', type: 'number', min: 0, max: 200, def: 0, unit: 'px' }
      ],
      down(pt) {
        Tools.drag = { type: 'shape', start: pt, cur: pt };
      },
      move(pt, e) {
        const d = Tools.drag; if (!d) return;
        d.cur = pt;
        if (e.shiftKey) {
          const dx = pt.x - d.start.x, dy = pt.y - d.start.y;
          const m = Math.max(Math.abs(dx), Math.abs(dy));
          d.cur = { x: d.start.x + Math.sign(dx || 1) * m, y: d.start.y + Math.sign(dy || 1) * m };
        }
        App.shapePreview = { start: d.start, cur: d.cur, kind: Tools.state.shape.kind, radius: Tools.state.shape.radius };
        invalidateOverlay();
      },
      up() {
        const d = Tools.drag; if (!d) return;
        Tools.drag = null;
        App.shapePreview = null;
        Tools.commitShape(d.start, d.cur, Tools.state.shape);
        invalidateOverlay();
      }
    },

    hand: {
      label: '抓手', icon: 'hand', key: 'H', cursor: 'grab', group: 'nav',
      opts: [],
      down(pt, e) {
        Tools.drag = { type: 'pan', lastX: e.clientX, lastY: e.clientY };
        $('#overlay').style.cursor = 'grabbing';
      },
      move(pt, e) {
        const d = Tools.drag; if (!d) return;
        panBy(e.clientX - d.lastX, e.clientY - d.lastY);
        d.lastX = e.clientX; d.lastY = e.clientY;
      },
      up() { Tools.drag = null; $('#overlay').style.cursor = 'grab'; }
    },

    zoom: {
      label: '缩放', icon: 'zoom', key: 'Z', cursor: 'zoom-in', group: 'nav',
      opts: [],
      down(pt, e) {
        const dir = e.altKey ? -1 : 1;
        setZoom(App.view.zoom * (dir > 0 ? 1.35 : 1 / 1.35), e.clientX, e.clientY);
      }
    }
  },

  init() {
    for (const name in this.defs) {
      const d = this.defs[name];
      Tools.state[name] = {};
      (d.opts || []).forEach(o => { Tools.state[name][o.key] = o.def; });
    }
    Tools.state.brush.color = '#ffffff';

    const ov = $('#overlay');
    ov.addEventListener('pointerdown', e => this.pointerDown(e));
    ov.addEventListener('pointermove', e => this.pointerMove(e));
    ov.addEventListener('pointerup', e => this.pointerUp(e));
    ov.addEventListener('pointercancel', e => this.pointerUp(e));
    ov.addEventListener('pointerleave', () => { App.pointer.inside = false; invalidateOverlay(); });
    ov.addEventListener('pointerenter', () => { App.pointer.inside = true; });
    ov.addEventListener('dblclick', e => this.dblClick(e));
    ov.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (App.mode === 'apsis') Apsis.openRadial(e.clientX, e.clientY);
    });

    const stage = $('#stage');
    stage.addEventListener('wheel', e => {
      if (!App.doc.w) return;
      e.preventDefault();
      const zoomMode = e.ctrlKey || e.metaKey || App.mode === 'apsis';
      if (zoomMode) {
        setZoom(App.view.zoom * (1 - e.deltaY * 0.0016), e.clientX, e.clientY);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });

    $('#stage').addEventListener('pointerdown', e => {
      if (e.button === 1 || (this.spaceDown && e.button === 0)) {
        e.preventDefault();
        this._pan = { x: e.clientX, y: e.clientY };
        try { $('#stage').setPointerCapture(e.pointerId); } catch (err) { }
      }
    });
    $('#stage').addEventListener('pointermove', e => {
      if (!this._pan) return;
      panBy(e.clientX - this._pan.x, e.clientY - this._pan.y);
      this._pan = { x: e.clientX, y: e.clientY };
    });
    $('#stage').addEventListener('pointerup', () => { this._pan = null; });

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) {
        this.spaceDown = true;
        if (!this.drag) $('#overlay').style.cursor = 'grab';
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        this.spaceDown = false;
        this.updateCursor();
      }
    });
  },

  setTool(name) {
    if (!this.defs[name]) return;
    if (this.drag) this.cancelDrag();
    App.cropRect = (name === 'crop') ? App.cropRect : null;
    this.current = name;
    App.tool = name;
    this.updateCursor();
    UI.renderOptions();
    UI.markTool();
    if (typeof Apsis !== 'undefined') Apsis.markDock();
    const d = this.defs[name];
    Tools.setHint(d.label + ' — ' + (d.opts && d.opts.length ? '调整顶部选项' : '在画布上操作'));
    if (typeof A11y !== 'undefined') A11y.say('工具：' + d.label);
  },

  updateCursor() {
    const ov = $('#overlay');
    if (!ov) return;
    const t = this.defs[this.current];
    ov.style.cursor = this.spaceDown ? 'grab' : (t ? t.cursor : 'default');
  },

  setHint(txt) {
    const el = $('#statusHint');
    if (el) el.textContent = txt;
  },

  /* ---------- 指针分发 ---------- */
  pointerDown(e) {
    if (!App.doc.w) return;
    if (e.button === 2) return;
    if (this.spaceDown) return;
    const pt = screenToDoc(e.clientX, e.clientY);
    App.pointer = { ...pt, inside: true };
    if (typeof LocalAdj !== 'undefined' && LocalAdj.active) {
      try { $('#overlay').setPointerCapture(e.pointerId); } catch (err) { }
      this._down = true;
      LocalAdj.down(pt);
      invalidateOverlay();
      return;
    }
    /* 自由变换优先接管画布 */
    if (typeof Transform !== 'undefined' && Transform.active) {
      try { $('#overlay').setPointerCapture(e.pointerId); } catch (err) { }
      this._down = true;
      Transform.down(pt, e);
      invalidateOverlay();
      return;
    }
    const t = this.defs[this.current];
    if (!t) return;
    try { $('#overlay').setPointerCapture(e.pointerId); } catch (err) { }
    this._down = true;
    try { t.down.call(t, pt, e); } catch (err) { console.error(err); toast('操作失败：' + err.message, 'err'); }
    invalidateOverlay();
  },

  pointerMove(e) {
    if (!App.doc.w) return;
    const pt = screenToDoc(e.clientX, e.clientY);
    App.pointer = { ...pt, inside: true };
    const cp = $('#cursorPos');
    if (cp) cp.textContent = `${Math.round(pt.x)}, ${Math.round(pt.y)}`;
    if (typeof LocalAdj !== 'undefined' && LocalAdj.active) {
      if (this._down) LocalAdj.move(pt);
      invalidateOverlay();
      return;
    }
    if (typeof Transform !== 'undefined' && Transform.active) {
      if (this._down) Transform.move(pt, e);
      else {
        const hit = Transform.hit(pt);
        const ov = $('#overlay');
        ov.style.cursor = !hit ? 'default'
          : hit.type === 'rotate' ? 'grab'
            : hit.type === 'move' ? 'move'
              : (hit.handle === 'n' || hit.handle === 's') ? 'ns-resize'
                : (hit.handle === 'e' || hit.handle === 'w') ? 'ew-resize' : 'nwse-resize';
      }
      invalidateOverlay();
      return;
    }
    const t = this.defs[this.current];
    if (t && t.brush) {
      const size = Tools.state[this.current].size || 30;
      App.brushCursor = { x: pt.x, y: pt.y, r: size / 2 };
    } else if (App.brushCursor) {
      App.brushCursor = null;
    }
    if (this._down && t && t.move) {
      try { t.move.call(t, pt, e); } catch (err) { console.error(err); }
    }
    invalidateOverlay();
  },

  pointerUp(e) {
    if (!this._down) { invalidateOverlay(); return; }
    this._down = false;
    if (typeof LocalAdj !== 'undefined' && LocalAdj.active) {
      LocalAdj.up();
      invalidateOverlay();
      return;
    }
    if (typeof Transform !== 'undefined' && Transform.active) {
      Transform.up();
      invalidateOverlay();
      return;
    }
    const t = this.defs[this.current];
    if (t && t.up) { try { t.up.call(t, e); } catch (err) { console.error(err); } }
    invalidateOverlay();
  },

  cancelDrag() {
    if (this.drag && this.drag.type === 'paint') this.endPaint();
    this.drag = null; this._down = false;
    App.marquee = null; App.shapePreview = null; App.gradPreview = null;
    invalidateOverlay();
  },

  dblClick(e) {
    if (this.current === 'crop' && App.cropRect) { cropToRect(App.cropRect, App.cropAngle); return; }
    if (this.current === 'text') {
      const pt = screenToDoc(e.clientX, e.clientY);
      const l = App.layers.find(x => x.type === 'text' && x.text && pointInTextBox(pt, x));
      if (l) { App.activeId = l.id; Text.open(l); sync(); }
    }
  },

  /* ---------- 选区 ---------- */
  /** 修饰键优先：Shift 加选 / Alt 减选 / Shift+Alt 交叉 */
  selMode(base, e, drag) {
    const shift = e ? e.shiftKey : !!(drag && drag.shift);
    const alt = e ? e.altKey : !!(drag && drag.alt);
    if (shift && alt) return 'intersect';
    if (shift) return 'add';
    if (alt) return 'sub';
    return base || 'new';
  },

  makeRectSelection(r, kind, mode) {
    const feather = Tools.state.marquee.feather || 0;
    const m = makeCanvas(App.doc.w, App.doc.h);
    const c = ctx2d(m);
    if (feather > 0) c.filter = `blur(${feather}px)`;
    c.fillStyle = '#fff';
    if (kind === 'ellipse') {
      c.beginPath();
      c.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      c.fillRect(r.x, r.y, r.w, r.h);
    }
    this.applySelectionMask(m, mode || Tools.state.marquee.mode);
  },

  makeLassoSelection(pts, mode) {
    const feather = Tools.state.lasso.feather || 0;
    const m = makeCanvas(App.doc.w, App.doc.h);
    const c = ctx2d(m);
    if (feather > 0) c.filter = `blur(${feather}px)`;
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.closePath();
    c.fill();
    this.applySelectionMask(m, mode || Tools.state.lasso.mode);
  },

  applySelectionMask(newMask, mode) {
    if (!mode) mode = 'new';
    if (mode === 'new' || !App.selection) {
      if (mode === 'sub' && !App.selection) return;
      setSelectionFromMask(newMask);
      return;
    }
    const m = makeCanvas(App.doc.w, App.doc.h);
    const c = ctx2d(m);
    c.drawImage(App.selection.mask, 0, 0);
    if (mode === 'add') c.globalCompositeOperation = 'source-over';
    else if (mode === 'sub') c.globalCompositeOperation = 'destination-out';
    else if (mode === 'intersect') c.globalCompositeOperation = 'destination-in';
    else c.globalCompositeOperation = 'source-over';
    c.drawImage(newMask, 0, 0);
    setSelectionFromMask(m);
  },

  magicWand(pt, tolerance, contiguous, allLayers) {
    const src = allLayers === false && activeLayer() ? activeLayer().canvas : compositeCanvas(false);
    const w = src.width, h = src.height;
    const data = ctx2d(src).getImageData(0, 0, w, h).data;
    const sx = clamp(Math.floor(pt.x), 0, w - 1), sy = clamp(Math.floor(pt.y), 0, h - 1);
    const si = (sy * w + sx) * 4;
    const sr = data[si], sg = data[si + 1], sb = data[si + 2], sa = data[si + 3];
    const tol = tolerance * tolerance * 3;
    const out = makeCanvas(w, h);
    const oc = ctx2d(out);
    const mask = oc.createImageData(w, h);
    const md = mask.data;
    const match = i => {
      const dr = data[i] - sr, dg = data[i + 1] - sg, db = data[i + 2] - sb, da = data[i + 3] - sa;
      return dr * dr + dg * dg + db * db + da * da <= tol;
    };
    if (!contiguous) {
      for (let i = 0; i < data.length; i += 4) if (match(i)) md[i + 3] = 255;
    } else {
      const visited = new Uint8Array(w * h);
      const stack = [sy * w + sx];
      while (stack.length) {
        const p = stack.pop();
        if (visited[p]) continue;
        visited[p] = 1;
        const i = p * 4;
        if (!match(i)) continue;
        md[i + 3] = 255;
        const x = p % w, y = (p - x) / w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }
    }
    oc.putImageData(mask, 0, 0);
    return out;
  },

  /* 吸管：size = 1 / 3 / 5，取方形区域的平均色 */
  pickColor(pt, layerOnly, size) {
    const src = layerOnly && activeLayer() ? activeLayer().canvas : compositeCanvas(false);
    size = clamp(Math.round(size || 1), 1, 9);
    if (size === 1) {
      const x = clamp(Math.floor(pt.x), 0, src.width - 1), y = clamp(Math.floor(pt.y), 0, src.height - 1);
      const d = ctx2d(src).getImageData(x, y, 1, 1).data;
      if (d[3] === 0) return null;
      return rgbToHex(d[0], d[1], d[2]);
    }
    const half = Math.floor(size / 2);
    const x0 = clamp(Math.floor(pt.x) - half, 0, Math.max(0, src.width - size));
    const y0 = clamp(Math.floor(pt.y) - half, 0, Math.max(0, src.height - size));
    const w = Math.min(size, src.width - x0), h = Math.min(size, src.height - y0);
    if (w < 1 || h < 1) return null;
    const d = ctx2d(src).getImageData(x0, y0, w, h).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const a = d[i + 3] / 255;
      r += d[i] * a; g += d[i + 1] * a; b += d[i + 2] * a; n += a;
    }
    if (!n) return null;
    return rgbToHex(Math.round(r / n), Math.round(g / n), Math.round(b / n));
  },

  /* ---------- 画笔 ---------- */
  beginPaint(pt, e, kind) {
    const l = activeLayer();
    if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
    const st = Tools.state[this.current];
    const isErase = kind === 'erase';
    History.begin(isErase ? '橡皮擦' : '画笔', [l.id]);
    const c = ctx2d(l.canvas);
    c.save();
    c.translate(-l.x, -l.y);
    if (App.selection) c.clip(App.selection.path);
    const size = st.size || 30;
    const opacity = (st.opacity == null ? 100 : st.opacity) / 100;
    const flow = (st.flow == null ? 100 : st.flow) / 100;
    const hardness = (st.hardness == null ? 80 : st.hardness) / 100;
    const stamp = makeStamp(size, hardness, isErase ? '#000' : (App.fg || '#fff'));
    this.drag = {
      type: 'paint', layer: l, ctx: c, stamp, size,
      alpha: opacity, flow, last: pt, pressure: e.pressure > 0 && e.pointerType === 'pen' ? e.pressure : 1,
      erase: isErase, spacing: Math.max(1, size * 0.1), acc: 0
    };
    c.globalCompositeOperation = isErase ? 'destination-out' : 'source-over';
    this.stampAt(l, pt, stamp, size, opacity * flow * this.drag.pressure, isErase);
    invalidate();
  },

  paintTo(pt, e) {
    const d = this.drag;
    if (!d || d.type !== 'paint') return;
    const dist = Math.hypot(pt.x - d.last.x, pt.y - d.last.y);
    const steps = Math.max(1, Math.floor(dist / d.spacing));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = { x: lerp(d.last.x, pt.x, t), y: lerp(d.last.y, pt.y, t) };
      this.stampAt(d.layer, p, d.stamp, d.size, d.alpha * d.flow, d.erase);
    }
    d.last = pt;
    invalidate();
  },

  stampAt(layer, pt, stamp, size, alpha, erase) {
    const c = ctx2d(layer.canvas);
    const sym = Tools.state[Tools.current].sym || 'none';
    const pts = [pt];
    if (sym === 'h' || sym === 'both') pts.push({ x: App.doc.w - pt.x, y: pt.y });
    if (sym === 'v' || sym === 'both') pts.push({ x: pt.x, y: App.doc.h - pt.y });
    if (sym === 'both') pts.push({ x: App.doc.w - pt.x, y: App.doc.h - pt.y });
    c.globalAlpha = clamp(alpha, 0, 1);
    pts.forEach(p => c.drawImage(stamp, p.x - size / 2, p.y - size / 2, size, size));
    c.globalAlpha = 1;
    layer.thumbDirty = true;
  },

  endPaint() {
    const d = this.drag;
    if (!d || d.type !== 'paint') return;
    try { d.ctx.restore(); } catch (err) { }
    this.drag = null;
    History.end();
    invalidate(); sync();
  },

  /* ---------- 油漆桶 / 渐变 ---------- */
  bucketFill(pt, st) {
    const l = activeLayer();
    if (!l) return;
    const w = l.canvas.width, h = l.canvas.height;
    const c = ctx2d(l.canvas);
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    const sx = clamp(Math.floor(pt.x - l.x), 0, w - 1);
    const sy = clamp(Math.floor(pt.y - l.y), 0, h - 1);
    const si = (sy * w + sx) * 4;
    const sr = d[si], sg = d[si + 1], sb = d[si + 2], sa = d[si + 3];
    const col = hexToRgb(App.fg);
    const alpha = (st.opacity == null ? 100 : st.opacity) / 100;
    const tol = st.tolerance * st.tolerance * 3;
    const match = i => {
      const dr = d[i] - sr, dg = d[i + 1] - sg, db = d[i + 2] - sb, da = d[i + 3] - sa;
      return dr * dr + dg * dg + db * db + da * da <= tol;
    };
    const paint = i => {
      d[i] = lerp(d[i], col.r, alpha);
      d[i + 1] = lerp(d[i + 1], col.g, alpha);
      d[i + 2] = lerp(d[i + 2], col.b, alpha);
      d[i + 3] = lerp(d[i + 3], 255, alpha);
    };
    if (!st.contiguous) {
      for (let i = 0; i < d.length; i += 4) if (match(i)) paint(i);
    } else {
      const visited = new Uint8Array(w * h);
      const stack = [sy * w + sx];
      while (stack.length) {
        const p = stack.pop();
        if (visited[p]) continue;
        visited[p] = 1;
        const i = p * 4;
        if (!match(i)) continue;
        paint(i);
        const x = p % w, y = (p - x) / w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - w);
        if (y < h - 1) stack.push(p + w);
      }
    }
    if (App.selection) {
      const before = new ImageData(new Uint8ClampedArray(ctx2d(l.canvas).getImageData(0, 0, w, h).data), w, h);
      blendMasked(img, before, App.selection.mask, l.x, l.y);
    }
    c.putImageData(img, 0, 0);
    l.thumbDirty = true;
  },

  paintGradient(layer, a, b, st) {
    const c = ctx2d(layer.canvas);
    c.save();
    c.translate(-layer.x, -layer.y);
    if (App.selection) c.clip(App.selection.path);
    c.globalAlpha = (st.opacity == null ? 100 : st.opacity) / 100;
    const fg = App.fg, bg = App.bg;
    let grad;
    if (st.type === 'radial') {
      const r = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      grad = c.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
    } else if (st.type === 'angle') {
      grad = c.createConicGradient(Math.atan2(b.y - a.y, b.x - a.x), a.x, a.y);
    } else if (st.type === 'reflect') {
      grad = c.createLinearGradient(a.x * 2 - b.x, a.y * 2 - b.y, b.x, b.y);
    } else {
      grad = c.createLinearGradient(a.x, a.y, b.x, b.y);
    }
    grad.addColorStop(0, fg);
    grad.addColorStop(1, st.mode === 'fgt' ? rgbaStr(fg, 0) : bg);
    c.fillStyle = grad;
    c.fillRect(-layer.x, -layer.y, App.doc.w, App.doc.h);
    c.restore();
    layer.thumbDirty = true;
  },

  cloneStampAt(pt) {
    const d = this.drag;
    if (!d || d.type !== 'clone') return;
    const size = d.size, r = size / 2;
    const tmp = makeCanvas(size, size);
    const tc = ctx2d(tmp);
    try {
      tc.drawImage(d.srcCanvas, pt.x - d.dx - r, pt.y - d.dy - r, size, size, 0, 0, size, size);
    } catch (e) { return; }
    tc.globalCompositeOperation = 'destination-in';
    tc.drawImage(d.stamp, 0, 0, size, size);
    d.ctx.globalAlpha = (Tools.state.clone.opacity || 100) / 100;
    d.ctx.drawImage(tmp, pt.x - r, pt.y - r);
    d.ctx.globalAlpha = 1;
    d.layer.thumbDirty = true;
    invalidate();
  },

  /* ---------- 涂抹式修饰 ---------- */
  beginRetouch(pt) {
    const l = activeLayer();
    if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
    History.begin(this.current === 'blur' ? '模糊' : (this.current === 'dodge' ? '减淡' : '加深'), [l.id]);
    this.drag = { type: 'retouch', layer: l, last: pt, lastT: 0 };
    this.retouchAt(pt);
  },
  retouchTo(pt) {
    const d = this.drag;
    if (!d || d.type !== 'retouch') return;
    const now = performance.now();
    if (now - d.lastT < 32) return;
    d.lastT = now;
    this.retouchAt(pt);
    d.last = pt;
  },
  retouchAt(pt) {
    const l = activeLayer();
    const st = Tools.state[this.current];
    const r = Math.max(3, (st.size || 60) / 2);
    const strength = (st.strength || 20) / 100;
    const x0 = clamp(Math.floor(pt.x - l.x - r), 0, l.canvas.width - 1);
    const y0 = clamp(Math.floor(pt.y - l.y - r), 0, l.canvas.height - 1);
    const w = Math.min(Math.ceil(r * 2), l.canvas.width - x0);
    const hgt = Math.min(Math.ceil(r * 2), l.canvas.height - y0);
    if (w <= 0 || hgt <= 0) return;
    const cx = pt.x - l.x, cy = pt.y - l.y;
    const c = ctx2d(l.canvas);
    const img = c.getImageData(x0, y0, w, hgt);
    if (this.current === 'blur') {
      const copy = FX.cloneData(img);
      gaussianBlur(copy, Math.max(0.8, r * 0.12 * strength * 3));
      const d = img.data, s = copy.data;
      for (let y = 0; y < hgt; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x0 + x - cx) / r, dy = (y0 + y - cy) / r;
          const t = clamp(1 - Math.hypot(dx, dy), 0, 1);
          const k = t * t * strength;
          const i = (y * w + x) * 4;
          d[i] = lerp(d[i], s[i], k);
          d[i + 1] = lerp(d[i + 1], s[i + 1], k);
          d[i + 2] = lerp(d[i + 2], s[i + 2], k);
          d[i + 3] = lerp(d[i + 3], s[i + 3], k);
        }
      }
    } else {
      const sign = this.current === 'dodge' ? 1 : -1;
      const range = st.range || 'mid';
      const d = img.data;
      for (let y = 0; y < hgt; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x0 + x - cx) / r, dy = (y0 + y - cy) / r;
          const t = clamp(1 - Math.hypot(dx, dy), 0, 1);
          const i = (y * w + x) * 4;
          const lum = (d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722) / 255;
          let wgt = t * t * strength;
          if (range === 'shadow') wgt *= clamp(1 - lum * 1.6, 0, 1);
          else if (range === 'high') wgt *= clamp(lum * 1.6 - .4, 0, 1);
          else wgt *= clamp(1 - Math.abs(lum - .5) * 1.5, 0, 1);
          for (let k = 0; k < 3; k++) {
            const v = d[i + k];
            d[i + k] = sign > 0 ? v + (255 - v) * wgt : v - v * wgt;
          }
        }
      }
    }
    c.putImageData(img, x0, y0);
    l.thumbDirty = true;
    invalidate();
  },
  endRetouch(label) {
    if (!this.drag || this.drag.type !== 'retouch') return;
    this.drag = null;
    History.end(label);
    sync();
  },

  /* ---------- 形状 ---------- */
  commitShape(a, b, st) {
    const l = activeLayer();
    if (!l || l.locked) { toast('请选择可编辑图层', 'err'); return; }
    const r = rectFromPoints(a, b);
    if (r.w < 2 && r.h < 2) return;
    History.begin('形状', [l.id]);
    const c = ctx2d(l.canvas);
    c.save();
    c.translate(-l.x, -l.y);
    if (App.selection) c.clip(App.selection.path);
    c.fillStyle = App.fg;
    c.strokeStyle = App.bg;
    c.lineWidth = st.stroke || 0;
    const path = new Path2D();
    if (st.kind === 'rect') {
      if (st.radius > 0) roundRect(path, r.x, r.y, r.w, r.h, Math.min(st.radius, Math.min(r.w, r.h) / 2));
      else path.rect(r.x, r.y, r.w, r.h);
    } else if (st.kind === 'ellipse') {
      path.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    } else if (st.kind === 'line') {
      path.moveTo(a.x, a.y); path.lineTo(b.x, b.y);
    } else if (st.kind === 'triangle') {
      path.moveTo(r.x + r.w / 2, r.y); path.lineTo(r.x + r.w, r.y + r.h);
      path.lineTo(r.x, r.y + r.h); path.closePath();
    } else if (st.kind === 'star') {
      starPath(path, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 2, Math.min(r.w, r.h) / 4.2, 5);
    }
    if (st.kind === 'line') {
      c.strokeStyle = App.fg;
      c.lineWidth = Math.max(1, st.stroke || 4);
      c.stroke(path);
    } else {
      if (st.fill) c.fill(path);
      if (st.stroke > 0) c.stroke(path);
    }
    c.restore();
    l.thumbDirty = true;
    History.end();
    invalidate(); sync();
  },

  /* ---------- 覆盖层预览 ---------- */
  drawPreview(ctx, z) {
    const ants = (p) => {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.stroke(p);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(0,0,0,.9)';
      ctx.stroke(p);
      ctx.restore();
    };
    if (App.marquee) {
      const m = App.marquee;
      ctx.save();
      ctx.scale(z, z);
      const p = new Path2D();
      if (m.kind === 'lasso' && m.points && m.points.length > 1) {
        p.moveTo(m.points[0].x, m.points[0].y);
        for (let i = 1; i < m.points.length; i++) p.lineTo(m.points[i].x, m.points[i].y);
        p.closePath();
      } else if (m.rect) {
        if (m.kind === 'ellipse') p.ellipse(m.rect.x + m.rect.w / 2, m.rect.y + m.rect.h / 2, m.rect.w / 2, m.rect.h / 2, 0, 0, Math.PI * 2);
        else p.rect(m.rect.x, m.rect.y, m.rect.w, m.rect.h);
      }
      ctx.lineWidth = 1 / z;
      ants(p);
      ctx.restore();
    }
    if (App.shapePreview) {
      const s = App.shapePreview;
      const r = rectFromPoints(s.start, s.cur);
      ctx.save();
      ctx.scale(z, z);
      const p = new Path2D();
      if (s.kind === 'rect') {
        if (s.radius > 0) roundRect(p, r.x, r.y, r.w, r.h, Math.min(s.radius, Math.min(r.w, r.h) / 2));
        else p.rect(r.x, r.y, r.w, r.h);
      } else if (s.kind === 'ellipse') p.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
      else if (s.kind === 'line') { p.moveTo(s.start.x, s.start.y); p.lineTo(s.cur.x, s.cur.y); }
      else if (s.kind === 'triangle') { p.moveTo(r.x + r.w / 2, r.y); p.lineTo(r.x + r.w, r.y + r.h); p.lineTo(r.x, r.y + r.h); p.closePath(); }
      else if (s.kind === 'star') starPath(p, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 2, Math.min(r.w, r.h) / 4.2, 5);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([3 / z, 3 / z]);
      ctx.stroke(p);
      ctx.restore();
    }
    if (Tools.current === 'clone' && Tools.cloneSource) {
      const s2 = Tools.cloneSource;
      ctx.save();
      ctx.strokeStyle = 'rgba(123,200,255,.95)';
      ctx.lineWidth = 1;
      const cx = s2.x * z, cy = s2.y * z;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (App.gradPreview) {
      const g = App.gradPreview;
      ctx.save();
      ctx.scale(z, z);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath(); ctx.moveTo(g.a.x, g.a.y); ctx.lineTo(g.b.x, g.b.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(g.a.x, g.a.y, 3 / z, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (App.textBox && App.textBox.editing) {
      const t = App.textBox;
      ctx.save();
      ctx.strokeStyle = 'rgba(123,140,255,.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(t.x * z - 2, t.y * z - 2, t.w * z + 4, t.h * z + 4);
      ctx.restore();
    }
  },

  cropTargetRatio() {
    const st = this.state.crop || {};
    const r = st.ratio || 'free';
    if (r === 'free') return 0;
    if (r === 'orig') return App.doc.w / Math.max(1, App.doc.h);
    if (r === 'custom') return (st.cw || 5) / Math.max(1, st.ch || 4);
    const [a, b] = String(r).split(':').map(Number);
    return (a && b) ? a / b : 0;
  },

  reconstrain() {
    if (!App.cropRect) return;
    App.cropRect = this.constrainCrop(App.cropRect, this.state.crop.ratio);
    invalidateOverlay();
  },

  cropHit(pt, r, angle) {
    const tol = 10 / App.view.zoom;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const a = (angle || 0) * Math.PI / 180;
    const rot = (x, y) => {
      const dx = x - cx, dy = y - cy;
      return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
    };
    const top = rot(cx, r.y);
    const rhS = { x: top.x + Math.sin(a) * 26 / App.view.zoom, y: top.y - Math.cos(a) * 26 / App.view.zoom };
    if (Math.hypot(pt.x - rhS.x, pt.y - rhS.y) <= tol * 1.3) return { type: 'rotate' };
    const pts = [
      ['nw', r.x, r.y], ['n', cx, r.y], ['ne', r.x + r.w, r.y],
      ['e', r.x + r.w, cy], ['se', r.x + r.w, r.y + r.h],
      ['s', cx, r.y + r.h], ['sw', r.x, r.y + r.h], ['w', r.x, cy]
    ];
    for (const [id, x, y] of pts) {
      const p = rot(x, y);
      if (Math.hypot(pt.x - p.x, pt.y - p.y) <= tol) return { type: 'resize', handle: id };
    }
    const q = cropQuad(r, angle || 0);
    let inside = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      if (((q[i].y > pt.y) !== (q[j].y > pt.y)) && (pt.x < (q[j].x - q[i].x) * (pt.y - q[i].y) / (q[j].y - q[i].y) + q[i].x)) inside = !inside;
    }
    return inside ? { type: 'move' } : null;
  },

  cropResize(d, pt, e) {
    const a = -d.angle * Math.PI / 180;
    const dx0 = pt.x - d.center.x, dy0 = pt.y - d.center.y;
    const rx = dx0 * Math.cos(a) - dy0 * Math.sin(a);
    const ry = dx0 * Math.sin(a) + dy0 * Math.cos(a);
    const hw = d.box.w / 2, hh = d.box.h / 2;
    let left = -hw, right = hw, top = -hh, bot = hh;
    const id = d.handle || 'se';
    if (id.includes('w')) left = Math.min(rx, right - 4);
    if (id.includes('e')) right = Math.max(rx, left + 4);
    if (id.includes('n')) top = Math.min(ry, bot - 4);
    if (id.includes('s')) bot = Math.max(ry, top + 4);
    let w = Math.max(4, right - left), h = Math.max(4, bot - top);
    let ncx = (left + right) / 2, ncy = (top + bot) / 2;
    const target = this.cropTargetRatio();
    if (target) {
      if (id.length === 2) {
        if (w / h > target) {
          w = h * target;
          if (id.includes('w')) left = right - w; else right = left + w;
        } else {
          h = w / target;
          if (id.includes('n')) top = bot - h; else bot = top + h;
        }
        ncx = (left + right) / 2; ncy = (top + bot) / 2;
      } else {
        if (id === 'e' || id === 'w') { h = w / target; top = -h / 2; bot = h / 2; ncy = 0; }
        else { w = h * target; left = -w / 2; right = w / 2; ncx = 0; }
      }
    }
    const ar = d.angle * Math.PI / 180;
    const cx = d.center.x + (ncx * Math.cos(ar) - ncy * Math.sin(ar));
    const cy = d.center.y + (ncx * Math.sin(ar) + ncy * Math.cos(ar));
    App.cropRect = { x: cx - w / 2, y: cy - h / 2, w, h };
  },

  constrainCrop(r, ratio) {
    if (!ratio || ratio === 'free') return r;
    let target;
    if (ratio === 'orig') target = App.doc.w / Math.max(1, App.doc.h);
    else if (ratio === 'custom') target = (this.state.crop.cw || 5) / Math.max(1, this.state.crop.ch || 4);
    else {
      const [rw, rh] = String(ratio).split(':').map(Number);
      target = rw / rh;
    }
    if (!target || !isFinite(target)) return r;
    let { w, h } = r;
    if (w / h > target) w = h * target; else h = w / target;
    return { x: r.x, y: r.y, w, h };
  }
};

/* ---------------- 画笔印章 ---------------- */
function makeStamp(size, hardness, color) {
  size = Math.max(1, Math.ceil(size));
  const c = makeCanvas(size, size);
  const x = ctx2d(c);
  const r = size / 2;
  x.clearRect(0, 0, size, size);
  if (hardness >= .985) {
    x.fillStyle = color;
    x.beginPath();
    x.arc(r, r, r - .3, 0, Math.PI * 2);
    x.fill();
  } else {
    const inner = Math.max(0, r * hardness);
    const g = x.createRadialGradient(r, r, inner * .92, r, r, r);
    const rgb = hexToRgb(color);
    g.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
    g.addColorStop(clamp(inner / r, 0, .96), `rgba(${rgb.r},${rgb.g},${rgb.b},${hardness >= .985 ? 1 : .92})`);
    g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    x.fillStyle = g;
    x.beginPath();
    x.arc(r, r, r, 0, Math.PI * 2);
    x.fill();
  }
  return c;
}

function roundRect(path, x, y, w, hh, r) {
  r = Math.min(r, w / 2, hh / 2);
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + hh - r);
  path.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh);
  path.lineTo(x + r, y + hh);
  path.quadraticCurveTo(x, y + hh, x, y + hh - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  path.closePath();
}

function starPath(path, cx, cy, outer, inner, points) {
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + i * Math.PI / points;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
}

function hitLayerAt(pt) {
  for (let i = App.layers.length - 1; i >= 0; i--) {
    const l = App.layers[i];
    if (!l.visible || l.locked) continue;
    const x = Math.floor(pt.x - l.x), y = Math.floor(pt.y - l.y);
    if (x < 0 || y < 0 || x >= l.canvas.width || y >= l.canvas.height) continue;
    const d = ctx2d(l.canvas).getImageData(x, y, 1, 1).data;
    if (d[3] > 8) return l;
  }
  return null;
}

function pointInTextBox(pt, layer) {
  if (!layer.text) return false;
  const t = layer.text;
  const mctx = ctx2d(layer.canvas);
  mctx.save();
  mctx.font = `${t.weight || 700} ${t.size}px ${t.font}`;
  const m = mctx.measureText(t.string.split('\n')[0]);
  mctx.restore();
  const w = Math.max(20, m.width);
  const hh = t.size * (t.lineHeight || 1.2) * t.string.split('\n').length;
  let x = t.x;
  if (t.align === 'center') x -= w / 2;
  if (t.align === 'right') x -= w;
  return pointInRect(pt, { x, y: t.y, w, h: hh });
}

function isTypingTarget(t) {
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/* ---------------- 文字 ---------------- */
const Text = {
  createAt(pt) {
    if (!App.doc.w) return;
    History.begin('新建文字', []);
    const st = Tools.state.text;
    const l = createLayer('文字');
    l.type = 'text';
    l.text = {
      string: '双击编辑文字',
      font: st.font || 'system-ui',
      size: st.size || 64,
      weight: st.weight || '700',
      align: st.align || 'left',
      lineHeight: (st.lineHeight || 120) / 100,
      color: App.fg,
      x: Math.round(pt.x),
      y: Math.round(pt.y)
    };
    addLayer(l);
    this.render(l);
    History.end('新建文字');
    setTimeout(() => this.open(l), 30);
  },

  render(layer) {
    const t = layer.text;
    if (!t) return;
    const c = ctx2d(layer.canvas);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    c.save();
    c.translate(layer.x, layer.y);
    c.font = `${t.weight || 700} ${t.size}px ${t.font}`;
    if ('letterSpacing' in c) { try { c.letterSpacing = (t.spacing || 0) + 'px'; } catch (e) { } }
    c.fillStyle = t.color;
    c.textBaseline = 'top';
    c.textAlign = t.align || 'left';
    const lines = String(t.string).split('\n');
    const lh = t.size * (t.lineHeight || 1.2);
    lines.forEach((line, i) => c.fillText(line, t.x, t.y + i * lh));
    c.restore();
    layer.thumbDirty = true;
    invalidate();
    if (this.editing === layer) this.syncEditor();
  },

  open(layer) {
    if (!layer || !layer.text) return;
    const ed = $('#textEditor');
    const frame = $('#docframe');
    if (!ed || !frame) return;
    this.editing = layer;
    layer.visible = false;
    const t = layer.text;
    const z = App.view.zoom;
    ed.style.display = 'block';
    ed.style.left = (t.x * z) + 'px';
    ed.style.top = (t.y * z) + 'px';
    ed.style.fontFamily = t.font;
    ed.style.fontSize = (t.size * z) + 'px';
    ed.style.fontWeight = t.weight;
    ed.style.lineHeight = (t.lineHeight || 1.2);
    ed.style.color = t.color;
    ed.style.textAlign = t.align;
    ed.style.background = 'rgba(18,18,18,.55)';
    ed.textContent = t.string;
    ed.focus();
    const range = document.createRange();
    range.selectNodeContents(ed);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    this._input = () => {
      t.string = ed.innerText.replace(/\n$/, '');
      this.renderHidden(layer);
    };
    this._blur = () => this.close();
    ed.addEventListener('input', this._input);
    ed.addEventListener('blur', this._blur);
    ed.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); ed.blur(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ed.blur(); }
      e.stopPropagation();
    });
    App.textBox = { editing: true, x: t.x, y: t.y, w: 100, h: t.size * z };
    invalidateOverlay();
  },

  renderHidden(layer) {
    const t = layer.text;
    if (!t) return;
    const c = ctx2d(layer.canvas);
    c.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    c.save();
    c.font = `${t.weight || 700} ${t.size}px ${t.font}`;
    if ('letterSpacing' in c) { try { c.letterSpacing = (t.spacing || 0) + 'px'; } catch (e) { } }
    c.fillStyle = t.color;
    c.textBaseline = 'top';
    c.textAlign = t.align || 'left';
    const lines = String(t.string).split('\n');
    lines.forEach((line, i) => c.fillText(line, t.x, t.y + i * t.size * (t.lineHeight || 1.2)));
    c.restore();
    layer.thumbDirty = true;
    invalidate();
  },

  close() {
    const ed = $('#textEditor');
    const layer = this.editing;
    if (!ed) return;
    ed.style.display = 'none';
    if (this._input) ed.removeEventListener('input', this._input);
    if (this._blur) ed.removeEventListener('blur', this._blur);
    App.textBox = null;
    this.editing = null;
    if (!layer) return;
    layer.visible = true;
    if (!String(layer.text.string).trim()) {
      App.layers = App.layers.filter(l => l.id !== layer.id);
      if (App.activeId === layer.id) App.activeId = (App.layers[0] || {}).id;
    } else {
      this.render(layer);
    }
    if (History.pending) History.end('文字');
    sync(); invalidate();
  },

  syncEditor() {
    const ed = $('#textEditor');
    const layer = this.editing;
    if (!ed || !layer) return;
    const z = App.view.zoom;
    ed.style.left = (layer.text.x * z) + 'px';
    ed.style.top = (layer.text.y * z) + 'px';
    ed.style.fontSize = (layer.text.size * z) + 'px';
  }
};
