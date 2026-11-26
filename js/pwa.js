/* ==========================================================================
   Dreikanter photo — pwa.js
   Service Worker 注册 / 安装提示 / 离线提示（file:// 自动跳过）
   ========================================================================== */
'use strict';

const PWA = {
  deferred: null,
  registration: null,

  init() {
    /* 只有 http(s) 才做 PWA：file:// 与 HarmonyOS 的 resource://rawfile 都不注册 SW */
    if (!/^https?:$/.test(location.protocol)) return;
    this.register();
    this.bindInstall();
    window.addEventListener('online', () => toast('网络已恢复', 'ok'));
    window.addEventListener('offline', () => toast('当前离线，将使用本地缓存', 'err'));
    if (!navigator.onLine) setTimeout(() => toast('当前离线，已加载本地缓存', 'err'), 1200);
  },

  register() {
    if (!('serviceWorker' in navigator)) return;
    /* 开发逃生舱：地址加 ?nosw=1，或 localStorage.devNoSW=1，
       就不再注册 SW 并注销已有的——改完 JS 刷新即可见，不受 cache-first 影响 */
    try {
      const off = new URL(location.href).searchParams.get('nosw') === '1' || localStorage.getItem('devNoSW') === '1';
      if (off) {
        navigator.serviceWorker.getRegistrations()
          .then(rs => rs.forEach(r => r.unregister()))
          .catch(() => { });
        return;
      }
    } catch (e) { /* 老浏览器没有 URL API：继续走正常注册 */ }
    navigator.serviceWorker.register('sw.js').then(reg => {
      this.registration = reg;
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('发现新版本，刷新后生效', 'ok');
          }
        });
      });
    }).catch(() => { });
  },

  bindInstall() {
    const btn = document.getElementById('installBtn');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferred = e;
      if (btn) btn.style.display = '';
    });
    if (btn) {
      btn.onclick = async () => {
        if (!this.deferred) { toast('当前浏览器不支持自动安装，可用地址栏菜单添加到桌面', 'err'); return; }
        this.deferred.prompt();
        try {
          const res = await this.deferred.userChoice;
          if (res.outcome === 'accepted') toast('已添加到桌面', 'ok');
        } catch (e) { }
        this.deferred = null;
        btn.style.display = 'none';
      };
    }
    window.addEventListener('appinstalled', () => {
      if (btn) btn.style.display = 'none';
      toast('安装完成，可从桌面启动', 'ok');
    });
  }
};
