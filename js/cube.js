/* ==========================================================================
   Dreikanter photo — cube.js
   自定义 3D LUT（.cube）导入 / 存储 / 三线性采样
   · 解析 Adobe Cube LUT（LUT_3D_SIZE / DOMAIN_MIN|MAX / TITLE）
   · 持久化到 localStorage（base64），总量限 1.6MB，避免撑爆配额
   · 采样器零分配，直接服务 FX.cameraLook 的逐像素循环
   ========================================================================== */
'use strict';

const CVL_MAX_SIZE = 65;          /* .cube 常见 17 / 33 / 65 */
const CVL_STORE_KEY = 'cubeLuts';
const CVL_BUDGET = 1.6 * 1024 * 1024;   /* base64 总字节上限 */

/* ---------------- base64 ---------------- */
function cvlToB64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}
function cvlFromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------------- 解析 ---------------- */
/**
 * 解析 .cube 文本
 * @returns {{size:number, title:string, domainMin:number[], domainMax:number[], data:Uint8Array}}
 */
function parseCube(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('文件为空');
  const lines = text.split(/\r?\n/);
  let size = 0, title = '';
  let dmin = [0, 0, 0], dmax = [1, 1, 1];
  const vals = [];
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li].trim();
    if (!raw || raw[0] === '#') continue;
    const parts = raw.split(/\s+/);
    const head = parts[0].toUpperCase();
    if (head === 'TITLE') { title = raw.replace(/^TITLE\s*/i, '').replace(/^"|"$/g, ''); continue; }
    if (head === 'LUT_3D_SIZE') { size = parseInt(parts[1], 10) || 0; continue; }
    if (head === 'LUT_1D_SIZE') throw new Error('暂不支持 1D .cube，请导出 3D LUT');
    if (head === 'DOMAIN_MIN') { dmin = parts.slice(1, 4).map(Number); continue; }
    if (head === 'DOMAIN_MAX') { dmax = parts.slice(1, 4).map(Number); continue; }
    if (head === 'LUT_3D_INPUT_RANGE') continue;
    if (/^[-+.\d]/.test(raw)) {
      if (parts.length < 3) throw new Error('第 ' + (li + 1) + ' 行数据不完整');
      const r = parseFloat(parts[0]), g = parseFloat(parts[1]), b = parseFloat(parts[2]);
      if (!isFinite(r) || !isFinite(g) || !isFinite(b)) throw new Error('第 ' + (li + 1) + ' 行不是数字');
      vals.push(r, g, b);
    }
    /* 其它未知关键字（如 LUT_3D_INPUT_RANGE 的变体）直接忽略 */
  }
  if (!size) throw new Error('缺少 LUT_3D_SIZE');
  if (size < 2 || size > CVL_MAX_SIZE) throw new Error('LUT 尺寸 ' + size + ' 不支持（2–' + CVL_MAX_SIZE + '）');
  const need = size * size * size * 3;
  if (vals.length < need) {
    throw new Error('数据行不足：需要 ' + (need / 3) + ' 行，实际 ' + Math.floor(vals.length / 3));
  }
  const data = new Uint8Array(need);
  for (let i = 0; i < need; i++) {
    const v = Math.round(vals[i] * 255);
    data[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  for (let k = 0; k < 3; k++) {
    if (!isFinite(dmin[k]) || !isFinite(dmax[k]) || dmax[k] <= dmin[k]) dmax[k] = dmin[k] + 1;
  }
  return { size, title, domainMin: dmin, domainMax: dmax, data };
}

/* ---------------- 三线性采样（零分配） ---------------- */
function sampleCube(lut, r, g, b, out) {
  const S = lut.size, n = S - 1, D = lut.data;
  const S2 = S * S;
  const dmr = lut.domainMin[0], dmg = lut.domainMin[1], dmb = lut.domainMin[2];
  const dr = lut.domainMax[0] - dmr, dg = lut.domainMax[1] - dmg, db = lut.domainMax[2] - dmb;
  let nr = (r - dmr) / dr, ng = (g - dmg) / dg, nb = (b - dmb) / db;
  nr = nr < 0 ? 0 : nr > 1 ? 1 : nr;
  ng = ng < 0 ? 0 : ng > 1 ? 1 : ng;
  nb = nb < 0 ? 0 : nb > 1 ? 1 : nb;
  const fr = nr * n, fg = ng * n, fb = nb * n;
  const r0 = fr | 0, g0 = fg | 0, b0 = fb | 0;
  const r1 = r0 < n ? r0 + 1 : n, g1 = g0 < n ? g0 + 1 : n, b1 = b0 < n ? b0 + 1 : n;
  const tr = fr - r0, tg = fg - g0, tb = fb - b0;
  const i000 = ((b0 * S + g0) * S + r0) * 3, i100 = i000 + 3;
  const i010 = i000 + S * 3, i110 = i010 + 3;
  const i001 = i000 + S2 * 3, i101 = i001 + 3;
  const i011 = i001 + S * 3, i111 = i011 + 3;
  for (let k = 0; k < 3; k++) {
    const c000 = D[i000 + k], c100 = D[i100 + k], c010 = D[i010 + k], c110 = D[i110 + k];
    const c001 = D[i001 + k], c101 = D[i101 + k], c011 = D[i011 + k], c111 = D[i111 + k];
    const x00 = c000 + (c100 - c000) * tr, x10 = c010 + (c110 - c010) * tr;
    const x01 = c001 + (c101 - c001) * tr, x11 = c011 + (c111 - c011) * tr;
    const y0 = x00 + (x10 - x00) * tg, y1 = x01 + (x11 - x01) * tg;
    out[k] = (y0 + (y1 - y0) * tb) / 255;
  }
  return out;
}

/* ---------------- 存储 ---------------- */
const CVL = {
  _cache: new Map(),

  raw() { return Store.get(CVL_STORE_KEY, []) || []; },

  list() {
    return this.raw().map(x => ({ id: x.id, name: x.name, size: x.size, at: x.at }));
  },

  usage() {
    return this.raw().reduce((n, x) => n + (x.b64 ? x.b64.length : 0), 0);
  },

  /** 取解析后的 LUT（首次从 base64 解出后缓存） */
  get(id) {
    if (!id) return null;
    if (this._cache.has(id)) return this._cache.get(id);
    const row = this.raw().find(x => x.id === id);
    if (!row) return null;
    let lut = null;
    try {
      lut = {
        size: row.size,
        title: row.name,
        domainMin: row.domainMin || [0, 0, 0],
        domainMax: row.domainMax || [1, 1, 1],
        data: cvlFromB64(row.b64)
      };
      const need = row.size * row.size * row.size * 3;
      if (lut.data.length !== need) lut = null;
    } catch (e) { lut = null; }
    if (lut) this._cache.set(id, lut);
    return lut;
  },

  /**
   * 导入文本
   * @param {string} name 显示名
   * @param {string} text .cube 内容
   */
  add(name, text) {
    const lut = parseCube(text);
    const rows = this.raw();
    const b64 = cvlToB64(lut.data);
    const total = rows.reduce((n, x) => n + (x.b64 ? x.b64.length : 0), 0) + b64.length;
    if (total > CVL_BUDGET) throw new Error('LUT 存储已满（上限 1.6MB），请先删除不用的 LUT');
    const clean = String(name || lut.title || '自定义 LUT').replace(/\.[^.]+$/, '').trim() || '自定义 LUT';
    const id = 'cube:' + clean.replace(/[^\w\u4e00-\u9fa5]+/g, '-').slice(0, 24) + '-' + Math.random().toString(36).slice(2, 6);
    rows.push({
      id, name: clean, size: lut.size, at: Date.now(),
      domainMin: lut.domainMin, domainMax: lut.domainMax, b64
    });
    Store.set(CVL_STORE_KEY, rows);
    this._cache.set(id, lut);
    return { id, name: clean, size: lut.size, at: Date.now() };
  },

  remove(id) {
    const rows = this.raw().filter(x => x.id !== id);
    Store.set(CVL_STORE_KEY, rows);
    this._cache.delete(id);
    return true;
  },

  clear() {
    Store.set(CVL_STORE_KEY, []);
    this._cache.clear();
  }
};
