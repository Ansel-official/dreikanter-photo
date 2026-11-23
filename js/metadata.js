/* ==========================================================================
   Dreikanter photo — metadata.js
   导出时写入 DPI 元数据：JPEG 用 JFIF APP0 密度，PNG 用 pHYs 块
   （纯字节级改写，不重新编码，图像数据一字节不动）
   ========================================================================== */
'use strict';

const DPI_PER_M = 1 / 0.0254;   /* 每米像素数换算：1 英寸 = 25.4mm */

/* ---------------- 只读读取（自检/校验用） ---------------- */
function readJpegDpi(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xFF) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
    if (marker === 0xDA) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xE0 && len >= 16) {
      const tag = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (tag === 'JFIF') {
        const units = bytes[i + 11];
        const x = (bytes[i + 12] << 8) | bytes[i + 13];
        const y = (bytes[i + 14] << 8) | bytes[i + 15];
        return { units, x, y };
      }
    }
    i += 2 + len;
  }
  return null;
}

function readPngPHYs(bytes) {
  if (!bytes || bytes.length < 33) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let k = 0; k < 8; k++) if (bytes[k] !== sig[k]) return null;
  let i = 8;
  while (i + 12 <= bytes.length) {
    const len = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    if (type === 'pHYs') {
      const ppuX = ((bytes[i + 8] << 24) | (bytes[i + 9] << 16) | (bytes[i + 10] << 8) | bytes[i + 11]) >>> 0;
      const ppuY = ((bytes[i + 12] << 24) | (bytes[i + 13] << 16) | (bytes[i + 14] << 8) | bytes[i + 15]) >>> 0;
      return { ppuX, ppuY, unit: bytes[i + 16] };
    }
    i += 12 + len;
  }
  return null;
}

/* ---------------- CRC32（PNG 块校验） ---------------- */
let _crcTable = null;
function crc32(bytes) {
  if (!_crcTable) {
    _crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = _crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* ---------------- 写 DPI ---------------- */
async function writeDpiMetadata(blob, dpi, type) {
  const d = Math.round(dpi || 72);
  if (!blob || d <= 0) return blob;
  const buf = new Uint8Array(await blob.arrayBuffer());
  try {
    if (type === 'image/jpeg') {
      const patched = patchJpegDpi(buf, d);
      return patched ? new Blob([patched], { type }) : blob;
    }
    if (type === 'image/png') {
      const patched = patchPngDpi(buf, d);
      return patched ? new Blob([patched], { type }) : blob;
    }
  } catch (e) { /* 元数据失败不影响导出 */ }
  return blob;
}

function patchJpegDpi(buf, dpi) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  const x = Math.min(65535, Math.max(1, Math.round(dpi)));
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
    if (marker === 0xDA) break;
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (marker === 0xE0 && len >= 16) {
      const tag = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
      if (tag === 'JFIF') {
        const out = buf.slice();
        out[i + 11] = 1;                 /* units: dots per inch */
        out[i + 12] = x >> 8; out[i + 13] = x & 255;
        out[i + 14] = x >> 8; out[i + 15] = x & 255;
        return out;
      }
    }
    i += 2 + len;
  }
  /* 没有 JFIF APP0：自己插一个 18 字节的 */
  const app0 = new Uint8Array([
    0xFF, 0xE0, 0x00, 0x10,
    0x4A, 0x46, 0x49, 0x46, 0x00,     /* 'JFIF\0' */
    0x01, 0x01,                       /* version 1.1 */
    0x01,                             /* units = inch */
    (x >> 8) & 255, x & 255,
    (x >> 8) & 255, x & 255,
    0x00, 0x00                        /* 无缩略图 */
  ]);
  const out = new Uint8Array(buf.length + app0.length);
  out[0] = buf[0]; out[1] = buf[1];
  out.set(app0, 2);
  out.set(buf.subarray(2), 2 + app0.length);
  return out;
}

function patchPngDpi(buf, dpi) {
  if (buf.length < 33) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let k = 0; k < 8; k++) if (buf[k] !== sig[k]) return null;
  /* IHDR 固定是第一个块：8 + 4 + 4 + 13 + 4 = 33 */
  const ihdrLen = ((buf[8] << 24) | (buf[9] << 16) | (buf[10] << 8) | buf[11]) >>> 0;
  const ihdrEnd = 8 + 12 + ihdrLen;
  if (ihdrLen <= 0 || ihdrEnd > buf.length) return null;
  const ppm = Math.max(1, Math.round(dpi * DPI_PER_M));
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9, false);                 /* 数据长度 */
  chunk[4] = 0x70; chunk[5] = 0x48; chunk[6] = 0x59; chunk[7] = 0x73;   /* 'pHYs' */
  dv.setUint32(8, ppm, false);
  dv.setUint32(12, ppm, false);
  chunk[16] = 1;                             /* 单位：米 */
  dv.setUint32(17, crc32(chunk.subarray(4, 17)), false);
  const out = new Uint8Array(buf.length + chunk.length);
  out.set(buf.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(buf.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}
