/* ==========================================================================
   Dreikanter photo — layerfx.js
   图层样式：描边 / 投影 / 外发光（带版本缓存）
   ========================================================================== */
'use strict';

function layerHasFX(l) {
  const fx = l && l.effects;
  if (!fx) return false;
  return (fx.stroke && fx.stroke.on) || (fx.shadow && fx.shadow.on) || (fx.glow && fx.glow.on);
}

/* 图层 alpha 剪影着色 */
function fxSilhouette(layer, color) {
  const c = makeCanvas(layer.canvas.width, layer.canvas.height);
  const x = ctx2d(c);
  x.drawImage(layer.canvas, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color || '#000000';
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function fxBlur(src, radius) {
  if (!radius || radius <= 0) return src;
  const ctx = ctx2d(src);
  const img = ctx.getImageData(0, 0, src.width, src.height);
  gaussianBlur(img, radius);
  const out = makeCanvas(src.width, src.height);
  ctx2d(out).putImageData(img, 0, 0);
  return out;
}

/* 外描边 = 扩展剪影 - 原图 */
function fxOutline(layer, color, size) {
  const sil = fxSilhouette(layer, color);
  const out = makeCanvas(sil.width, sil.height);
  const x = ctx2d(out);
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    x.drawImage(sil, Math.cos(a) * size, Math.sin(a) * size);
  }
  x.drawImage(sil, 0, 0);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(layer.canvas, 0, 0);
  return out;
}

function buildLayerFX(layer) {
  const fx = layer.effects || {};
  if (!layerHasFX(layer)) return null;
  const key = JSON.stringify(fx);
  const c = layer._fxCache;
  if (c && c.ver === layer._ver && c.key === key && c.src === layer.canvas) return c.canvas;

  const w = layer.canvas.width, h = layer.canvas.height;
  const out = makeCanvas(w, h);
  const oc = ctx2d(out);

  if (fx.shadow && fx.shadow.on) {
    const sil = fxSilhouette(layer, fx.shadow.color || '#000000');
    const blurred = fxBlur(sil, fx.shadow.blur == null ? 14 : fx.shadow.blur);
    oc.globalAlpha = fx.shadow.opacity == null ? .55 : fx.shadow.opacity;
    oc.drawImage(blurred, fx.shadow.dx || 0, fx.shadow.dy || 0);
    oc.globalAlpha = 1;
  }

  if (fx.glow && fx.glow.on) {
    const sil = fxSilhouette(layer, fx.glow.color || '#7b8cff');
    const blurred = fxBlur(sil, fx.glow.size == null ? 24 : fx.glow.size);
    oc.globalCompositeOperation = 'screen';
    oc.globalAlpha = fx.glow.opacity == null ? .85 : fx.glow.opacity;
    oc.drawImage(blurred, 0, 0);
    oc.globalCompositeOperation = 'source-over';
    oc.globalAlpha = 1;
  }

  if (fx.stroke && fx.stroke.on) {
    const o = fxOutline(layer, fx.stroke.color || '#ffffff', fx.stroke.size || 4);
    oc.drawImage(o, 0, 0);
  }

  layer._fxCache = { ver: layer._ver, key, src: layer.canvas, canvas: out };
  return out;
}
