/* ==========================================================================
   Dreikanter photo — agent.js
   指令引擎：可检索的指令库 + 中文自然语言解析
   ========================================================================== */
'use strict';

/* ---------------- 指令库 ---------------- */
const CMD_GROUPS = [
  {
    name: '文件', items: [
      { id: 'file.new', label: '新建画布…', hint: 'Ctrl N', run: () => Dialogs.newDoc() },
      { id: 'file.open', label: '打开照片…', hint: 'Ctrl O', run: () => openFilePicker(false) },
      { id: 'file.place', label: '置入为图层…', run: () => openFilePicker(true) },
      { id: 'file.xhs', label: '新建 · 小红书 1080×1440', say: ['小红书'], run: () => { newDocument(1080, 1440, { bg: 'transparent', name: '小红书' }); hideWelcome(); } },
      { id: 'file.douyin', label: '新建 · 抖音 1080×1920', say: ['抖音'], run: () => { newDocument(1080, 1920, { bg: 'transparent', name: '抖音' }); hideWelcome(); } },
      { id: 'file.wechat', label: '新建 · 公众号封面 900×383', say: ['公众号', '封面'], run: () => { newDocument(900, 383, { bg: 'transparent', name: '公众号封面' }); hideWelcome(); } },
      { id: 'file.avatar', label: '新建 · 头像 800×800', say: ['头像'], run: () => { newDocument(800, 800, { bg: 'transparent', name: '头像' }); hideWelcome(); } },
      { id: 'file.png', label: '导出 PNG', hint: 'Ctrl S', say: ['导出png', '保存png'], run: () => exportImage('image/png') },
      { id: 'file.jpg', label: '导出 JPEG…', say: ['导出jpg', '导出jpeg'], run: () => Dialogs.exportDoc('image/jpeg') },
      { id: 'file.webp', label: '导出 WEBP…', say: ['导出webp'], run: () => Dialogs.exportDoc('image/webp') },
      { id: 'file.copy', label: '复制合并图像', say: ['复制图像', '拷贝图像'], run: () => copyComposite() },
      { id: 'file.paste', label: '粘贴为图层', say: ['粘贴图像'], run: () => pasteFromClipboard() },
      { id: 'file.demo', label: '载入示例作品', say: ['示例作品', '示例'], run: () => { hideWelcome(); Dialogs.loadDemo(); } },
      { id: 'file.close', label: '关闭图像', run: () => Dialogs.closeDoc() }
    ]
  },
  {
    name: '画布', items: [
      { id: 'img.size', label: '图像大小…', say: ['图像大小'], run: () => Dialogs.imageSize() },
      { id: 'img.canvas', label: '画布大小…', say: ['画布大小'], run: () => Dialogs.canvasSize() },
      { id: 'img.half', label: '缩放 50%', say: ['缩小一半', '缩放到50'], run: () => resizeImage(App.doc.w / 2, App.doc.h / 2) },
      { id: 'img.double', label: '缩放 200%', say: ['放大两倍', '缩放到200'], run: () => resizeImage(App.doc.w * 2, App.doc.h * 2) },
      { id: 'img.trim', label: '裁切透明边缘', say: ['裁切透明边', '适合内容'], run: () => trimTransparent() },
      { id: 'img.rot90', label: '旋转 90° 顺时针', say: ['顺时针旋转', '右转'], run: () => rotateDoc(90) },
      { id: 'img.rot270', label: '旋转 90° 逆时针', say: ['逆时针旋转', '左转'], run: () => rotateDoc(-90) },
      { id: 'img.rot180', label: '旋转 180°', say: ['倒过来'], run: () => rotateDoc(180) },
      { id: 'img.flipH', label: '水平翻转', say: ['水平翻转', '镜像'], run: () => flipDoc(true) },
      { id: 'img.flipV', label: '垂直翻转', say: ['垂直翻转'], run: () => flipDoc(false) },
      { id: 'img.crop11', label: '裁剪 1:1（方形）', say: ['裁成方形', '裁剪方形'], run: () => Agent.cropRatio(1, 1) },
      { id: 'img.crop43', label: '裁剪 4:3', say: ['裁成4:3', '裁剪4:3'], run: () => Agent.cropRatio(4, 3) },
      { id: 'img.crop169', label: '裁剪 16:9', say: ['裁成16:9', '裁剪16:9'], run: () => Agent.cropRatio(16, 9) },
      { id: 'img.crop916', label: '裁剪 9:16', say: ['裁成9:16', '裁剪9:16'], run: () => Agent.cropRatio(9, 16) },
      { id: 'img.cropSel', label: '裁剪到选区', say: ['按选区裁剪'], run: () => cropToSelection() }
    ]
  },
  {
    name: '图层', items: [
      { id: 'layer.new', label: '新建图层', hint: 'Ctrl ⇧ N', say: ['新建图层', '新图层'], run: () => { History.begin('新建图层', []); addLayer(); History.end(); } },
      { id: 'layer.dup', label: '复制图层', hint: 'Ctrl J', say: ['复制图层'], run: () => duplicateLayer(App.activeId) },
      { id: 'layer.del', label: '删除图层', say: ['删除图层'], run: () => deleteLayer(App.activeId) },
      { id: 'layer.merge', label: '向下合并', hint: 'Ctrl E', say: ['向下合并', '合并图层'], run: () => mergeDown(App.activeId) },
      { id: 'layer.flatten', label: '拼合图像', say: ['拼合图像', '拼合'], run: () => flattenImage() },
      { id: 'layer.up', label: '上移一层', say: ['上移一层'], run: () => reorderLayer(App.activeId, 1) },
      { id: 'layer.down', label: '下移一层', say: ['下移一层'], run: () => reorderLayer(App.activeId, -1) },
      { id: 'layer.opacity', label: '不透明度…', say: ['设置不透明度'], run: () => Dialogs.opacity() },
      { id: 'layer.blend', label: '混合模式…', say: ['混合模式'], run: () => Dialogs.blend() },
      { id: 'layer.rename', label: '重命名图层…', say: ['重命名图层'], run: () => { const l = activeLayer(); if (l) Dialogs.renameLayer(l); } },
      { id: 'layer.style', label: '图层样式…', say: ['图层样式', '描边', '投影', '外发光'], run: () => Dialogs.layerStyle() },
      { id: 'layer.toggle', label: '显示 / 隐藏当前图层', say: ['隐藏图层', '显示图层'], run: () => Agent.toggleLayer() }
    ]
  },
  {
    name: '选区', items: [
      { id: 'sel.all', label: '全选', hint: 'Ctrl A', say: ['全选'], run: () => selectAll() },
      { id: 'sel.none', label: '取消选择', hint: 'Ctrl D', say: ['取消选择', '取消选区'], run: () => deselect() },
      { id: 'sel.invert', label: '反向选择', say: ['反向选择', '反选'], run: () => invertSelection() },
      { id: 'sel.feather', label: '羽化选区…', say: ['羽化'], run: () => Dialogs.feather() },
      { id: 'sel.expand', label: '扩展 / 收缩选区…', say: ['扩展选区', '收缩选区'], run: () => Dialogs.expandSel() },
      { id: 'sel.fillFg', label: '填充前景色', hint: 'Alt ⌫', say: ['填充前景色', '填充颜色'], run: () => fillSelection(App.fg) },
      { id: 'sel.fillBg', label: '填充背景色', hint: 'Ctrl ⌫', say: ['填充背景色'], run: () => fillSelection(App.bg) },
      { id: 'sel.clear', label: '清除选区内容', hint: 'Delete', say: ['清除选区', '清空选区'], run: () => clearSelectionPixels() }
    ]
  },
  {
    name: '调色', items: [
      { id: 'adj.bc', label: '亮度 / 对比度…', say: ['亮度对比度'], run: () => Dialogs.adjustBrightness() },
      { id: 'adj.levels', label: '色阶…', say: ['色阶'], run: () => Dialogs.adjustLevels() },
      { id: 'adj.exp', label: '曝光度…', say: ['曝光度'], run: () => Dialogs.adjustExposure() },
      { id: 'adj.hsl', label: '色相 / 饱和度…', say: ['色相饱和度', '色相'], run: () => Dialogs.adjustHSL() },
      { id: 'adj.vib', label: '鲜艳度…', say: ['鲜艳度'], run: () => Dialogs.adjustVibrance() },
      { id: 'adj.temp', label: '色温 / 色调…', say: ['色温色调', '白平衡'], run: () => Dialogs.adjustTemp() },
      { id: 'adj.bw', label: '黑白…', say: ['黑白调整'], run: () => Dialogs.adjustBW() },
      { id: 'adj.bal', label: '颜色平衡…', say: ['颜色平衡'], run: () => Dialogs.adjustBalance() },
      { id: 'adj.gmap', label: '渐变映射…', say: ['渐变映射'], run: () => Dialogs.adjustGradientMap() },
      { id: 'adj.invert', label: '反相', hint: 'Ctrl I', say: ['反相', '负片'], run: () => applyFilterDirect(FX.invert, {}, '反相') },
      { id: 'adj.threshold', label: '阈值…', say: ['阈值'], run: () => Dialogs.adjustThreshold() },
      { id: 'adj.posterize', label: '色调分离…', say: ['色调分离'], run: () => Dialogs.adjustPosterize() },
      { id: 'adj.auto', label: '自动色调', say: ['自动色调', '自动调整'], run: () => Agent.autoTone() },
      { id: 'adj.lightup', label: '提亮 +12', say: ['提亮', '亮一点', '更亮'], run: () => Agent.brightness(12) },
      { id: 'adj.darken', label: '压暗 -12', say: ['压暗', '暗一点'], run: () => Agent.brightness(-12) },
      { id: 'adj.contrast', label: '对比度 +20', say: ['增加对比', '高对比'], run: () => Agent.contrast(20) },
      { id: 'adj.desat', label: '降低饱和 -30', say: ['去饱和', '低饱和'], run: () => Agent.saturation(-30) },
      { id: 'adj.vivid', label: '提高饱和 +25', say: ['提高饱和', '更鲜艳'], run: () => Agent.saturation(25) }
    ]
  },
  {
    name: '滤镜', items: [
      { id: 'fx.blur', label: '高斯模糊…', say: ['高斯模糊'], run: () => Dialogs.fxBlur() },
      { id: 'fx.motion', label: '动感模糊…', say: ['动感模糊'], run: () => Dialogs.fxMotionBlur() },
      { id: 'fx.sharpen', label: '锐化…', say: ['锐化'], run: () => Dialogs.fxSharpen() },
      { id: 'fx.glow', label: '发光…', say: ['发光'], run: () => Dialogs.fxGlow() },
      { id: 'fx.noise', label: '添加杂色…', say: ['添加杂色'], run: () => Dialogs.fxNoise() },
      { id: 'fx.grain', label: '胶片颗粒…', say: ['胶片颗粒', '颗粒'], run: () => Dialogs.fxGrain() },
      { id: 'fx.pixel', label: '像素化…', say: ['像素化', '马赛克'], run: () => Dialogs.fxPixelate() },
      { id: 'fx.vignette', label: '暗角…', say: ['暗角', '晕影'], run: () => Dialogs.fxVignette() },
      { id: 'fx.fade', label: '褪色…', say: ['褪色'], run: () => Dialogs.fxFade() },
      { id: 'fx.emboss', label: '浮雕', say: ['浮雕'], run: () => applyFilterDirect(FX.emboss, {}, '浮雕') },
      { id: 'fx.edges', label: '查找边缘', say: ['查找边缘', '描边效果'], run: () => applyFilterDirect(FX.findEdges, {}, '查找边缘') }
    ]
  },
  {
    name: '相机 LUT', items: [
      { id: 'lut.hasselblad', label: '哈苏 LUT（自然通透）', say: ['哈苏'], run: () => applyFilterDirect(FX.cameraLook, { look: 'hasselblad', intensity: 100 }, 'LUT 哈苏') },
      { id: 'lut.dji', label: '大疆 LUT（干净青调）', say: ['大疆'], run: () => applyFilterDirect(FX.cameraLook, { look: 'dji', intensity: 100 }, 'LUT 大疆') },
      { id: 'lut.insta360', label: '影石 LUT（运动浓彩）', say: ['影石'], run: () => applyFilterDirect(FX.cameraLook, { look: 'insta360', intensity: 100 }, 'LUT 影石') },
      { id: 'lut.leica', label: '徕卡 LUT（浓郁红调）', say: ['徕卡'], run: () => applyFilterDirect(FX.cameraLook, { look: 'leica', intensity: 100 }, 'LUT 徕卡') },
      { id: 'lut.fuji', label: '富士 LUT（经典铬）', say: ['富士'], run: () => applyFilterDirect(FX.cameraLook, { look: 'fuji', intensity: 100 }, 'LUT 富士') },
      { id: 'lut.dialog', label: '相机 LUT…（可调强度）', say: ['相机lut', 'lut'], run: () => Dialogs.cameraLut() },
      { id: 'adj.awb', label: '自动白平衡', say: ['自动白平衡', '白平衡'], run: () => applyFilterDirect(FX.autoWhiteBalance, { strength: 100 }, '自动白平衡') }
    ]
  },
  {
    name: '风格', items: [
      { id: 'style.original', label: '原片', run: () => applyStyle('original') },
      { id: 'style.film', label: '胶片', say: ['胶片'], run: () => applyStyle('film') },
      { id: 'style.mono', label: '黑白', say: ['黑白'], run: () => applyStyle('mono') },
      { id: 'style.teal', label: '青橙', say: ['青橙'], run: () => applyStyle('teal') },
      { id: 'style.cyber', label: '赛博', say: ['赛博', '霓虹'], run: () => applyStyle('cyber') },
      { id: 'style.jp', label: '日系', say: ['日系'], run: () => applyStyle('jp') },
      { id: 'style.moody', label: '暗调', say: ['暗调'], run: () => applyStyle('moody') },
      { id: 'style.faded', label: '褪色', say: ['复古褪色', '旧照片'], run: () => applyStyle('faded') }
    ]
  },
  {
    name: '文字与形状', items: [
      { id: 'txt.add', label: '添加文字…', say: ['添加文字'], run: () => Agent.addText('双击编辑文字', null) },
      { id: 'txt.title', label: '添加大标题', say: ['加大标题', '加标题'], run: () => Agent.addText('标题', Math.round(App.doc.w / 10)) },
      { id: 'shp.rect', label: '画矩形', say: ['画个矩形', '画矩形', '矩形'], run: () => Agent.shape('rect') },
      { id: 'shp.ellipse', label: '画圆形', say: ['画个圆', '画圆', '画椭圆', '圆形'], run: () => Agent.shape('ellipse') },
      { id: 'shp.tri', label: '画三角形', say: ['画个三角', '画三角', '三角形'], run: () => Agent.shape('triangle') },
      { id: 'shp.star', label: '画星形', say: ['画个星', '画星', '星形'], run: () => Agent.shape('star') },
      { id: 'shp.line', label: '画直线', say: ['画线', '画直线'], run: () => Agent.shape('line') },
      { id: 'color.pick', label: '拾色器…', say: ['选颜色', '拾色'], run: () => Dialogs.color(App.fg, c => { App.fg = c; UI.syncColors(); }) },
      { id: 'color.swap', label: '交换前景 / 背景色', hint: 'X', run: () => { const t = App.fg; App.fg = App.bg; App.bg = t; UI.syncColors(); } },
      { id: 'color.reset', label: '复位颜色', hint: 'D', run: () => { App.fg = '#ffffff'; App.bg = '#111111'; UI.syncColors(); } }
    ]
  },
  {
    name: '视图', items: [
      { id: 'view.in', label: '放大', say: ['放大'], run: () => setZoom(App.view.zoom * 1.3) },
      { id: 'view.out', label: '缩小', say: ['缩小'], run: () => setZoom(App.view.zoom / 1.3) },
      { id: 'view.fit', label: '适合屏幕', hint: 'Ctrl 0', say: ['适合屏幕', '适应窗口'], run: () => fitView() },
      { id: 'view.100', label: '实际像素', hint: 'Ctrl 1', say: ['实际像素', '原始大小'], run: () => setZoom(1) },
      { id: 'view.grid', label: '显示 / 隐藏网格', say: ['网格'], run: () => { App.showGrid = !App.showGrid; invalidate(true); } },
      { id: 'view.palette', label: '命令面板…', hint: 'Ctrl K', say: ['命令面板'], run: () => UI.openPalette() },
      { id: 'mode.apsis', label: '切换到 Apsis 模式', say: ['apsis模式', '直觉模式'], run: () => setMode('apsis') },
      { id: 'mode.ps', label: '切换到 Photoshop 模式', say: ['photoshop模式', '经典模式'], run: () => setMode('ps') }
    ]
  },
  {
    name: '历史', items: [
      { id: 'hist.undo', label: '撤销', hint: 'Ctrl Z', say: ['撤销'], run: () => History.undo() },
      { id: 'hist.redo', label: '重做', hint: 'Ctrl ⇧ Z', say: ['重做'], run: () => History.redo() }
    ]
  },
  {
    name: '存档', items: [
      { id: 'arc.new', label: '新建存档', hint: 'Ctrl ⇧ S', say: ['新建存档', '存个档', '保存进度', '快照', '存档'], run: () => Archives.create() },
      { id: 'arc.restore', label: '还原最近存档', say: ['还原存档', '回滚存档', '还原到存档', '撤回存档'], run: () => Archives.restoreLatest() },
      { id: 'arc.remove', label: '删除最近存档', say: ['删除存档'], run: () => { if (Archives.list[0]) Archives.remove(Archives.list[0].id); else toast('还没有存档', 'err'); } },
      { id: 'arc.clear', label: '清空存档', say: ['清空存档'], run: () => Archives.promptClear() },
      { id: 'view.compare', label: '对比原图', hint: '\\', say: ['对比原图', '看看原图', '原图对比'], run: () => setComparing(!App.comparing) }
    ]
  },
  {
    name: '帮助', items: [
      { id: 'help.keys', label: '快捷键一览', run: () => Dialogs.shortcuts() },
      { id: 'help.about', label: '关于 Dreikanter photo', run: () => Dialogs.about() }
    ]
  }
];

const COMMANDS = [];
CMD_GROUPS.forEach(g => g.items.forEach(it => COMMANDS.push(Object.assign({ group: g.name }, it))));

/* 自然语言别名表（长者优先匹配，避免「胶片颗粒」被「胶片」抢走） */
const ALIASES = [];
COMMANDS.forEach(c => (c.say || []).forEach(a => ALIASES.push([a.toLowerCase(), c])));
ALIASES.sort((a, b) => b[0].length - a[0].length);

const Agent = {

  /* ---------------- 入口 ---------------- */
  handle(raw) {
    const text = String(raw || '').trim();
    if (!text) return { reply: '' };
    if (!App.doc.w && !/(新建|打开|导入|示例)/.test(text)) {
      return { reply: '还没有画布。输入「新建 1600×1000」或「打开照片」开始。' };
    }
    const clauses = text
      .replace(/^(请|帮我|帮忙|麻烦|能不能|可以|我想要|我要)+/g, '')
      .split(/[，,。；;]+|然后|接着|之后再|并且|顺便/)
      .map(s => s.trim())
      .filter(Boolean);

    const done = [];
    clauses.forEach(c => {
      let r = null;
      try { r = this.runClause(c); } catch (e) { r = '执行失败：' + e.message; }
      if (r) done.push(r);
    });

    if (!done.length) {
      const hit = this.suggest(text);
      return {
        reply: '<b>没有匹配的指令</b><br>' +
          (hit.length ? '最接近：' + hit.slice(0, 5).map(c => `<code>${c.label}</code>`).join(' ') + '<br>' : '') +
          '<span style="opacity:.65">试试「胶片感」「裁成 16:9」「亮度 +20」「不透明度 60」「画个圆」「导出 PNG」，或用「，/然后」串联。</span>'
      };
    }
    return { reply: '<b>✓ 已执行</b> ' + done.length + ' 项<br>' + done.map(d => '· ' + d).join('<br>') };
  },

  /* ---------------- 单句解析 ---------------- */
  runClause(c) {
    const low = c.toLowerCase();
    const has = (...w) => w.some(x => low.includes(x));
    const num = (def) => { const m = low.match(/([+-]?\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : def; };

    /* 1 文字 */
    const tm = c.match(/(?:标题|文字|写上|写下|添加文字|打上|打字|加一句|加个)[：:\s]*(.+)$/);
    if (tm) {
      let body = tm[1].trim();
      let str = null;
      const qm = body.match(/^[\"“'「](.+?)[\"”'」]/);
      if (qm) str = qm[1];
      else {
        body = body
          .replace(/(?:字号|大小|尺寸)\s*\d{2,4}/g, '')
          .replace(/\d{2,4}\s*(?:px|号)/gi, '')
          .replace(/#[0-9a-f]{6}/gi, '')
          .replace(/(?:颜色|色)$/,'')
          .trim();
        str = body;
      }
      if (str && str.length <= 40) {
        const sm = low.match(/(\d{2,4})\s*(?:px|号)/) || low.match(/(?:字号|大小)\s*(\d{2,4})/);
        const cm2 = c.match(/(#[0-9a-f]{6})/i);
        this.addText(str, sm ? parseInt(sm[1]) : null, cm2 ? cm2[1] : null);
        return `添加文字「${str}」`;
      }
    }

    /* 2 裁剪比例 */
    if (has('裁剪', '裁成', '裁切', '切成')) {
      const m = low.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/);
      if (m) { this.cropRatio(parseInt(m[1]), parseInt(m[2])); return `裁剪为 ${m[1]}:${m[2]}`; }
      if (has('方形', '正方形')) { this.cropRatio(1, 1); return '裁剪为正方形'; }
      if (App.selection) { cropToSelection(); return '按选区裁剪'; }
    }

    /* 3 缩放百分比 */
    const rm = low.match(/(?:缩放到|缩放为|缩到|放大到|调整到|缩放)\s*(\d{1,3})\s*%/);
    if (rm) {
      const p = clamp(parseInt(rm[1]), 1, 800);
      resizeImage(App.doc.w * p / 100, App.doc.h * p / 100);
      return `缩放到 ${p}%`;
    }

    /* 3.5 旋转 / 模式切换 */
    if (has('旋转', '转动', '转一下')) {
      if (has('逆时针', '左转', '-90')) { rotateDoc(-90); return '逆时针旋转 90°'; }
      if (has('180') || has('倒转')) { rotateDoc(180); return '旋转 180°'; }
      rotateDoc(90);
      return '顺时针旋转 90°';
    }
    if (has('apsis') || has('直觉模式')) { setMode('apsis'); return '切换到 Apsis 模式'; }
    if (has('photoshop') || has('经典模式') || has('ps模式')) { setMode('ps'); return '切换到 Photoshop 模式'; }

    /* 4 撤销 / 重做 多步 */
    if (has('撤销', '回退')) {
      const n = clamp(parseInt(num(1)), 1, 30);
      for (let i = 0; i < n; i++) History.undo();
      return `撤销 ${n} 步`;
    }
    if (has('重做')) {
      const n = clamp(parseInt(num(1)), 1, 30);
      for (let i = 0; i < n; i++) History.redo();
      return `重做 ${n} 步`;
    }

    /* 5 不透明度 / 混合模式 */
    if (has('不透明度')) {
      const v = clamp(num(100), 0, 100);
      const l = activeLayer(); if (!l) return null;
      History.begin('不透明度', []); l.opacity = v / 100; History.end(); invalidate(); sync();
      return `不透明度 ${v}%`;
    }
    if (has('混合模式')) {
      const map = { '正常': 'normal', '正片叠底': 'multiply', '滤色': 'screen', '叠加': 'overlay', '柔光': 'soft-light', '强光': 'hard-light', '变亮': 'lighten', '变暗': 'darken', '差值': 'difference', '色相': 'hue', '饱和度': 'saturation', '颜色': 'color', '明度': 'luminosity' };
      for (const k in map) if (low.includes(k)) {
        const l = activeLayer(); if (!l) return null;
        History.begin('混合模式', []); l.blend = map[k]; History.end(); invalidate(); sync();
        return `混合模式「${k}」`;
      }
    }

    /* 6 数值型调色 */
    if (has('亮度', '提亮', '变亮', '压暗', '变暗')) {
      let v = num(0);
      if (!v) v = has('压暗', '变暗') ? -12 : 14;
      if (has('压暗', '变暗')) v = -Math.abs(v);
      this.brightness(v);
      return `亮度 ${v > 0 ? '+' : ''}${v}`;
    }
    if (has('对比度', '反差')) { const v = num(18); this.contrast(v); return `对比度 ${v > 0 ? '+' : ''}${v}`; }
    if (has('去饱和', '降饱和', '低饱和')) { this.saturation(-Math.abs(num(35))); return '降低饱和度'; }
    if (has('饱和', '鲜艳')) { const v = Math.abs(num(22)); this.saturation(v); return `饱和度 +${v}`; }
    if (has('色温', '偏暖', '偏冷')) {
      const v = has('冷') ? -Math.abs(num(26)) : Math.abs(num(26));
      applyFilterDirect(img => FX.temperature(img, { temp: v / 100 }), {}, '色温');
      return `色温${v > 0 ? '偏暖' : '偏冷'} ${Math.abs(v)}`;
    }
    if (has('曝光')) { applyFilterDirect(img => FX.exposure(img, { exposure: num(12) }), {}, '曝光'); return '曝光 ' + num(12); }
    if (has('锐化')) { applyFilterDirect(img => FX.sharpen(img, { amount: Math.abs(num(70)), radius: 2 }), {}, '锐化'); return '锐化'; }
    if (has('模糊')) { applyFilterDirect(img => FX.blur(img, { radius: Math.abs(num(6)) }), {}, '模糊'); return '高斯模糊 ' + Math.abs(num(6)); }
    if (has('噪点', '杂色')) { applyFilterDirect(img => FX.noise(img, { amount: Math.abs(num(14)) }), {}, '杂色'); return '添加杂色'; }
    if (has('颗粒')) { applyFilterDirect(img => FX.grain(img, { amount: Math.abs(num(22)) }), {}, '颗粒'); return '胶片颗粒'; }
    if (has('暗角', '晕影')) { applyFilterDirect(img => FX.vignette(img, { amount: Math.abs(num(46)) }), {}, '暗角'); return '暗角'; }
    if (has('像素化', '马赛克')) { applyFilterDirect(img => FX.pixelate(img, { size: Math.abs(num(12)) }), {}, '像素化'); return '像素化'; }
    if (has('阈值')) { applyFilterDirect(img => FX.threshold(img, { level: clamp(num(128), 1, 255) }), {}, '阈值'); return '阈值'; }
    if (has('色调分离')) { applyFilterDirect(img => FX.posterize(img, { levels: clamp(num(6), 2, 32) }), {}, '色调分离'); return '色调分离'; }

    /* 7 填充颜色 */
    if (has('填充')) {
      const hex = c.match(/#[0-9a-f]{6}/i);
      if (hex) { App.fg = hex[0]; UI.syncColors(); fillSelection(App.fg); return '填充 ' + hex[0]; }
      for (const name in COLOR_NAMES) {
        if (c.includes(name)) {
          App.fg = COLOR_NAMES[name]; UI.syncColors();
          fillSelection(App.fg);
          return `填充${name}色`;
        }
      }
    }

    /* 8 前景色 */
    const fgHex = c.match(/(?:前景色|设色|颜色)\s*(#[0-9a-f]{6})/i);
    if (fgHex) { App.fg = fgHex[1]; UI.syncColors(); return '前景色 ' + fgHex[1]; }

    /* 9 指令别名（最长匹配优先） */
    for (const [alias, cmd] of ALIASES) {
      if (low.includes(alias)) {
        cmd.run();
        return cmd.label.replace(/…$/, '');
      }
    }
    return null;
  },

  /* ---------------- 具体动作 ---------------- */
  cropRatio(rw, rh) {
    const w = App.doc.w, hh = App.doc.h;
    let cw = w, ch = Math.round(w * rh / rw);
    if (ch > hh) { ch = hh; cw = Math.round(hh * rw / rh); }
    cropToRect({ x: Math.round((w - cw) / 2), y: Math.round((hh - ch) / 2), w: cw, h: ch });
  },

  brightness(v) {
    applyFilterDirect(img => FX.brightnessContrast(img, { brightness: v }), {}, `亮度 ${v > 0 ? '+' : ''}${v}`);
  },
  contrast(v) {
    applyFilterDirect(img => FX.brightnessContrast(img, { contrast: v }), {}, `对比度 ${v > 0 ? '+' : ''}${v}`);
  },
  saturation(v) {
    applyFilterDirect(img => FX.saturation(img, { saturation: v }), {}, `饱和度 ${v > 0 ? '+' : ''}${v}`);
  },
  autoTone() {
    applyFilterDirect(img => {
      FX.brightnessContrast(img, { brightness: 4, contrast: 12 });
      FX.vibrance(img, { vibrance: 12 });
    }, {}, '自动色调');
  },

  addText(str, size, color) {
    if (!App.doc.w) return;
    History.begin('添加文字', []);
    const l = createLayer('文字');
    l.type = 'text';
    const fs = size || Math.max(24, Math.round(App.doc.w / 13));
    l.text = {
      string: str,
      font: '"Microsoft YaHei", system-ui',
      size: fs,
      weight: '900',
      align: 'center',
      lineHeight: 1.25,
      color: color || (App.fg === '#ffffff' ? '#ffffff' : App.fg),
      x: Math.round(App.doc.w / 2),
      y: Math.round(App.doc.h * 0.4),
      spacing: 0
    };
    Text.render(l);
    App.layers.push(l);
    App.activeId = l.id;
    History.end();
    invalidate(); sync();
    return l.id;
  },

  shape(kind, box) {
    if (!App.doc.w) return;
    const w = App.doc.w, h = App.doc.h;
    const s = Math.min(w, h) * 0.5;
    const x = box ? box[0] : Math.round((w - s) / 2);
    const y = box ? box[1] : Math.round((h - s) / 2);
    const ww = box ? box[2] : s;
    const hh = box ? box[3] : s;
    Dreikanter.shape(kind === 'rect' ? 'round' : kind, {
      x, y, w: ww, h: hh, color: App.fg,
      radius: kind === 'rect' ? Math.min(ww, hh) / 12 : 0,
      stroke: kind === 'line' ? 12 : 0
    });
  },

  toggleLayer() {
    const l = activeLayer(); if (!l) return;
    History.begin('图层可见性', []);
    l.visible = !l.visible;
    History.end(); invalidate(); sync();
  },

  /* ---------------- 指令列表 ---------------- */
  search(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.group.includes(q) ||
      (c.say || []).some(a => a.includes(q))
    );
  },

  suggest(text) {
    const t = String(text || '').toLowerCase();
    const scored = COMMANDS.map(c => {
      let s = 0;
      const l = c.label.toLowerCase();
      for (const ch of new Set(t)) if (l.includes(ch)) s++;
      (c.say || []).forEach(a => { if (t.includes(a) || a.includes(t.slice(0, 2))) s += 3; });
      return [s, c];
    }).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]);
    return scored.map(x => x[1]);
  },

  run(id) {
    const c = COMMANDS.find(x => x.id === id);
    if (!c) throw new Error('未知指令：' + id);
    c.run();
    return c.label.replace(/…$/, '');
  },

  help() {
    return '<b>指令台</b><br>' +
      '<code>胶片感</code> <code>裁成 16:9</code> <code>亮度 +20</code> <code>不透明度 60</code><br>' +
      '<code>加标题 "DREIKANTER" 字号 140</code> <code>画个圆</code> <code>旋转 90</code><br>' +
      '<code>导出 PNG</code> <code>撤销 3 步</code> <code>切换 Apsis 模式</code><br>' +
      '<code>新建存档</code> <code>还原存档</code> <code>对比原图</code><br>' +
      '<span style="opacity:.65">共 ' + COMMANDS.length + ' 条指令，可在「指令」面板搜索点击，或用「，/然后」串联多步。</span>';
  }
};
