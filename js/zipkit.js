/* ==========================================================================
   Dreikanter photo — zipkit.js
   最小 ZIP 写入器（store 存储、无压缩、无第三方依赖）。
   用途：把本次会话导出过的图片一键打包下载；只写必要字段，Windows /
   macOS / Linux 的解压工具都能读。
   ========================================================================== */
'use strict';

const ZipKit = {
  _tbl: null,

  /* CRC32 查表（首次使用时构建） */
  table() {
    if (this._tbl) return this._tbl;
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    this._tbl = t;
    return t;
  },

  crc32(bytes) {
    const t = this.table();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },

  /* DOS 时间/日期（zip 传统字段） */
  dosTime(d) {
    const dt = d || new Date();
    const year = Math.max(1980, dt.getFullYear());
    return {
      time: ((dt.getHours() & 31) << 11) | ((dt.getMinutes() & 63) << 5) | ((dt.getSeconds() / 2) & 31),
      date: (((year - 1980) & 127) << 9) | (((dt.getMonth() + 1) & 15) << 5) | (dt.getDate() & 31)
    };
  },

  /**
   * 打包
   * @param {Array<{name:string, blob:Blob}>} entries
   * @returns {Promise<Blob>} application/zip
   */
  async build(entries) {
    const list = (entries || []).filter(e => e && e.blob && e.name);
    if (!list.length) throw new Error('没有可打包的文件');
    const enc = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const now = this.dosTime(new Date());

    for (const e of list) {
      const buf = new Uint8Array(await e.blob.arrayBuffer());
      const name = enc.encode(String(e.name).replace(/^\/+/, ''));
      const crc = this.crc32(buf);

      /* 本地文件头 */
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034B50, true);   /* PK\3\4 */
      lh.setUint16(4, 20, true);           /* 需要版本 2.0 */
      lh.setUint16(6, 0, true);            /* 通用标志 */
      lh.setUint16(8, 0, true);            /* 存储方式：0 = store */
      lh.setUint16(10, now.time, true);
      lh.setUint16(12, now.date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, buf.length, true);
      lh.setUint32(22, buf.length, true);
      lh.setUint16(26, name.length, true);
      lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, buf);

      /* 中央目录项 */
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014B50, true);   /* PK\1\2 */
      ch.setUint16(4, 20, true);           /* 生成版本 */
      ch.setUint16(6, 20, true);           /* 需要版本 */
      ch.setUint16(8, 0, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, now.time, true);
      ch.setUint16(14, now.date, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, buf.length, true);
      ch.setUint32(24, buf.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);

      offset += 30 + name.length + buf.length;
    }

    const cdStart = offset;
    let cdSize = 0;
    central.forEach(c => { cdSize += c.length; });

    /* 中央目录结束记录 */
    const eo = new DataView(new ArrayBuffer(22));
    eo.setUint32(0, 0x06054B50, true);     /* PK\5\6 */
    eo.setUint16(4, 0, true);
    eo.setUint16(6, 0, true);
    eo.setUint16(8, list.length, true);
    eo.setUint16(10, list.length, true);
    eo.setUint32(12, cdSize, true);
    eo.setUint32(16, cdStart, true);
    eo.setUint16(20, 0, true);

    return new Blob([...chunks, ...central, new Uint8Array(eo.buffer)], { type: 'application/zip' });
  },

  /* 从 Blob 里统计条目数（自测与调试用：扫本地文件头） */
  async count(blob) {
    const b = new Uint8Array(await blob.arrayBuffer());
    let n = 0;
    for (let i = 0; i + 4 <= b.length; i++) {
      if (b[i] === 0x50 && b[i + 1] === 0x4B && b[i + 2] === 0x03 && b[i + 3] === 0x04) n++;
    }
    return n;
  }
};
