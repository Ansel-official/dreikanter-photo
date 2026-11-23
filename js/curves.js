/* ==========================================================================
   Dreikanter photo — curves.js
   曲线调整：单调三次插值生成 256 级 LUT，RGB / 单通道分别可调
   ========================================================================== */
'use strict';

/* 默认：每个通道都只有两端点（identity） */
function curveIdentity() { return [[0, 0], [1, 1]]; }
function curveCopy(src) { return Object.keys(src).reduce((o, k) => (o[k] = src[k].map(p => [p[0], p[1]]), o), {}); }

/**
 * 单调三次（Fritsch–Carlson）插值 → 256 级查找表
 * @param {Array<[number, number]>} points 归一化控制点，按 x 升序
 * @returns {Uint8Array}
 */
function buildCurveLUT(points) {
  const pts = (points && points.length >= 2 ? points : curveIdentity())
    .map(p => [clamp(p[0], 0, 1), clamp(p[1], 0, 1)])
    .sort((a, b) => a[0] - b[0]);
  /* 去掉重复 x，端点必须覆盖 0 与 1 */
  const xs = [], ys = [];
  pts.forEach(([x, y]) => {
    if (xs.length && Math.abs(x - xs[xs.length - 1]) < 1e-4) ys[ys.length - 1] = y;
    else { xs.push(x); ys.push(y); }
  });
  if (xs[0] > 1e-4) { xs.unshift(0); ys.unshift(0); }
  if (xs[xs.length - 1] < 1 - 1e-4) { xs.push(1); ys.push(1); }

  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]);
  const m = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2;
  /* Fritsch–Carlson：保证不过冲 */
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-9) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    const x = v / 255;
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = Math.max(1e-6, xs[i + 1] - xs[i]);
    const t = clamp((x - xs[i]) / h, 0, 1);
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const y = h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
    lut[v] = Math.round(clamp(y, 0, 1) * 255);
  }
  return lut;
}

/* FX.curves：把四条 LUT 应用到像素 */
FX.curves = function (img, p) {
  const c = (p && p.curves) || {};
  const has = ch => Array.isArray(c[ch]) && c[ch].length >= 2;
  const master = buildCurveLUT(has('rgb') ? c.rgb : curveIdentity());
  const lr = has('r') ? buildCurveLUT(c.r) : null;
  const lg = has('g') ? buildCurveLUT(c.g) : null;
  const lb = has('b') ? buildCurveLUT(c.b) : null;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = master[d[i]], g = master[d[i + 1]], b = master[d[i + 2]];
    if (lr) r = lr[r];
    if (lg) g = lg[g];
    if (lb) b = lb[b];
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return img;
};

/* ---------------- 曲线对话框 ---------------- */
const CurveState = { rgb: curveIdentity(), r: curveIdentity(), g: curveIdentity(), b: curveIdentity() };
const CURVE_CH_LABEL = { rgb: 'RGB', r: '红', g: '绿', b: '蓝' };
const CURVE_CH_COLOR = { rgb: '#d8d8d8', r: '#e2675f', g: '#5fbf8f', b: '#5d8cf0' };

Dialogs.curves = function curvesDialog() {
  if (!App.doc.w) return;
  if (!Adjust.start()) { toast('请选择一个图层', 'err'); return; }
  const pts = curveCopy(CurveState);
  let channel = 'rgb';
  let drag = null;

  const cw = 300, ch = 220;
  const cv = h('canvas', { width: cw * 2, height: ch * 2, class: 'curve-canvas', style: { width: cw + 'px', height: ch + 'px' } });
  const c2 = ctx2d(cv);
  const info = h('div', { class: 'hint' }, '');

  const toPx = ([x, y]) => [x * cw, ch - y * ch];
  const fromEv = e => {
    const r = cv.getBoundingClientRect();
    return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp(1 - (e.clientY - r.top) / r.height, 0, 1)];
  };

  const draw = () => {
    c2.setTransform(2, 0, 0, 2, 0, 0);
    c2.clearRect(0, 0, cw, ch);
    c2.fillStyle = '#141416';
    c2.fillRect(0, 0, cw, ch);
    /* 网格 */
    c2.strokeStyle = 'rgba(255,255,255,.08)';
    c2.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const x = cw * i / 4, y = ch * i / 4;
      c2.beginPath(); c2.moveTo(x, 0); c2.lineTo(x, ch); c2.stroke();
      c2.beginPath(); c2.moveTo(0, y); c2.lineTo(cw, y); c2.stroke();
    }
    /* 对角参考 */
    c2.strokeStyle = 'rgba(255,255,255,.16)';
    c2.setLineDash([3, 3]);
    c2.beginPath(); c2.moveTo(0, ch); c2.lineTo(cw, 0); c2.stroke();
    c2.setLineDash([]);
    /* 曲线 */
    const lut = buildCurveLUT(pts[channel]);
    c2.strokeStyle = CURVE_CH_COLOR[channel];
    c2.lineWidth = 1.6;
    c2.beginPath();
    for (let v = 0; v < 256; v++) {
      const x = v / 255 * cw, y = ch - (lut[v] / 255) * ch;
      if (v === 0) c2.moveTo(x, y); else c2.lineTo(x, y);
    }
    c2.stroke();
    /* 控制点 */
    pts[channel].forEach((p, i) => {
      const [x, y] = toPx(p);
      c2.fillStyle = i === 0 || i === pts[channel].length - 1 ? '#8a8a94' : CURVE_CH_COLOR[channel];
      c2.strokeStyle = '#0d0d0f';
      c2.lineWidth = 1;
      c2.beginPath();
      c2.rect(x - 3.5, y - 3.5, 7, 7);
      c2.fill(); c2.stroke();
    });
    info.textContent = CURVE_CH_LABEL[channel] + ' · ' + pts[channel].length + ' 个控制点 · 双击删除点，点击空白处添加';
  };

  let raf = 0;
  const requestPreview = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; Adjust.preview(FX.curves, { curves: pts }); });
  };

  const indexAt = (p, tol) => {
    const arr = pts[channel];
    for (let i = 0; i < arr.length; i++) {
      const [x, y] = toPx(arr[i]);
      if (Math.hypot(x - p[0] * cw, y - ch + p[1] * ch) <= tol) return i;
    }
    return -1;
  };

  cv.addEventListener('pointerdown', e => {
    const p = fromEv(e);
    const close = 10 / cv.getBoundingClientRect().width * cw;
    let i = indexAt(p, Math.max(8, close));
    if (i < 0) {
      /* 添加控制点（保持 x 升序） */
      const arr = pts[channel];
      arr.push([p[0], p[1]]);
      arr.sort((a, b) => a[0] - b[0]);
      i = arr.findIndex(q => q[0] === p[0] && q[1] === p[1]);
    }
    drag = { i, moved: false };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有活跃指针 */ }
    e.preventDefault();
    draw(); requestPreview();
  });
  cv.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = fromEv(e);
    const arr = pts[channel];
    const i = drag.i;
    if (i < 0 || i >= arr.length) return;
    const isEnd = i === 0 || i === arr.length - 1;
    if (isEnd) {
      /* 端点只改 y */
      arr[i][1] = p[1];
    } else {
      const minX = arr[i - 1][0] + 0.01, maxX = arr[i + 1][0] - 0.01;
      arr[i][0] = clamp(p[0], minX, maxX);
      arr[i][1] = p[1];
    }
    drag.moved = true;
    draw(); requestPreview();
  });
  const endDrag = () => { drag = null; };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('dblclick', e => {
    const p = fromEv(e);
    const arr = pts[channel];
    const i = indexAt(p, 10);
    if (i > 0 && i < arr.length - 1) {
      arr.splice(i, 1);
      draw(); requestPreview();
    }
  });

  /* 通道切换 */
  const tabs = h('div', { class: 'seg small' });
  ['rgb', 'r', 'g', 'b'].forEach(k2 => {
    tabs.append(h('button', {
      class: 'curve-ch' + (k2 === channel ? ' active' : ''),
      'data-ch': k2,
      onclick: () => {
        channel = k2;
        [...tabs.children].forEach(b => b.classList.toggle('active', b.dataset.ch === k2));
        draw();
      }
    }, CURVE_CH_LABEL[k2]));
  });

  const body = [
    tabs,
    h('div', { class: 'curve-wrap' }, cv),
    info,
    h('div', { class: 'exp-bar' },
      h('button', { class: 'btn ghost', style: { flex: '1' }, onclick: () => { pts[channel] = curveIdentity(); draw(); requestPreview(); } }, '复位当前通道'),
      h('button', { class: 'btn ghost', style: { flex: '1' }, onclick: () => { ['rgb', 'r', 'g', 'b'].forEach(k2 => pts[k2] = curveIdentity()); draw(); requestPreview(); } }, '全部复位'),
      h('button', {
        class: 'btn ghost', style: { flex: '1' },
        onclick: () => {
          /* 常用 S 曲线 */
          pts.rgb = [[0, 0], [0.25, 0.18], [0.75, 0.82], [1, 1]];
          draw(); requestPreview();
        }
      }, 'S 曲线')
    )
  ];

  draw();
  Adjust.preview(FX.curves, { curves: pts });
  modal({
    title: '曲线', sub: 'RGB / 单通道', width: 380,
    body,
    actions: [
      { label: '取消', ghost: true, onClick: () => { Adjust.cancel(); } },
      {
        label: '确定', primary: true, onClick: () => {
          /* 记住曲线，下次打开继续用 */
          ['rgb', 'r', 'g', 'b'].forEach(k2 => CurveState[k2] = pts[k2].map(p => [p[0], p[1]]));
          Adjust.commit('曲线');
          toast('曲线已应用', 'ok');
        }
      }
    ],
    onClose: () => { if (Adjust.layer) Adjust.cancel(); }
  });
};
