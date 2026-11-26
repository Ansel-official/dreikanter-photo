/* ==========================================================================
   Dreikanter photo — site.js
   站点级配置：备案信息 / 版权 / 外链。
   --------------------------------------------------------------------------
   ⚠ ICP 备案说明（务必读）：
   本文件只负责「把备案号展示出来」，不能代替你去申请备案。
   中国大陆境内接入的网站，必须先在工信部 ICP/IP 地址/域名信息备案管理系统
   （https://beian.miit.gov.cn）完成备案，拿到形如「京ICP备00000000号-1」的
   备案号后再填到下面 icp 字段；经营性网站还需 ICP 许可证。
   流程与材料见 docs/ICP备案.md。

   配置方式（二选一）：
   1. 直接改本文件的 SITE.icp / SITE.police；
   2. 不想改代码：在浏览器控制台执行
      localStorage.setItem('siteLegal', JSON.stringify({icp:'京ICP备…', police:'京公网安备…'}))
   ========================================================================== */
'use strict';

const SITE = {
  name: 'Dreikanter photo',
  /* ICP 备案号，例如 '京ICP备2026000000号-1'；留空则不显示备案行 */
  icp: '',
  /* 公安联网备案号，例如 '京公网安备 11010802000000号'；留空则不显示 */
  police: '',
  /* 备案号链接，一般不用改 */
  icpUrl: 'https://beian.miit.gov.cn/',
  policeUrl: 'https://beian.mps.gov.cn/',
  copyright: '© Apsis severs 2026 & Ansel Design 2026',
  license: 'MIT',
  repo: 'https://github.com/Ansel-official/dreikanter-photo'
};

const Site = {
  /* 读配置：代码常量 ← localStorage 覆盖（站点运维可后填，不用重新打包） */
  get() {
    const out = { icp: SITE.icp, police: SITE.police };
    try {
      const raw = localStorage.getItem('siteLegal');
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          if (typeof o.icp === 'string') out.icp = o.icp;
          if (typeof o.police === 'string') out.police = o.police;
        }
      }
    } catch (e) { /* 隐私模式 / 存储损坏：忽略 */ }
    return out;
  },

  /* 是否已经填了备案号 */
  hasFiling() {
    const s = this.get();
    return !!(String(s.icp || '').trim() || String(s.police || '').trim());
  },

  /* 生成备案行 DOM（无备案号时返回一条提示，便于自测与本地开发） */
  legalNode(opts) {
    const o = opts || {};
    const s = this.get();
    const wrap = h('div', { class: 'legal-line' + (o.className ? ' ' + o.className : ''), id: o.id || null });
    const mk = (text, href, kind) => {
      const a = h('a', {
        class: 'legal-link',
        href,
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        'data-legal': kind,
        title: text
      }, text);
      return a;
    };
    if (String(s.icp || '').trim()) {
      wrap.append(mk(String(s.icp).trim(), SITE.icpUrl, 'icp'));
    }
    if (String(s.police || '').trim()) {
      wrap.append(mk(String(s.police).trim(), SITE.policeUrl, 'police'));
    }
    if (!wrap.childNodes.length) {
      wrap.append(h('span', { class: 'legal-empty', 'data-legal': 'pending' },
        o.pendingText || 'ICP 备案：待填写（见 docs/ICP备案.md）'));
    }
    wrap.append(h('span', { class: 'legal-copy' }, SITE.copyright));
    return wrap;
  },

  /* 把备案行挂到容器（欢迎页 / 关于框），重复调用安全 */
  mountFooter(el, opts) {
    if (!el) return null;
    el.innerHTML = '';
    const node = this.legalNode(opts);
    el.append(node);
    return node;
  }
};
