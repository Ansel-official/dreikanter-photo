/* Dreikanter photo — Service Worker（全量静态缓存，版本化） */
'use strict';
const VERSION = 'dreikanter-v19-2026-11-27';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest',
  'css/tokens.css', 'css/base.css', 'css/apsis.css', 'css/themes.css', 'css/mobile.css', 'css/polish.css', 'css/ui-kit.css', 'css/welcome.css',
  'js/site.js', 'js/util.js', 'js/zipkit.js', 'js/icons.js', 'js/metadata.js', 'js/perf.js', 'js/engine.js', 'js/docs.js', 'js/lut.js', 'js/cube.js', 'js/filters.js', 'js/tools.js',
  'js/transform.js', 'js/curves.js', 'js/batch.js', 'js/preset.js', 'js/localadjust.js', 'js/actions.js', 'js/compare.js', 'js/filter-worker.js', 'js/ui.js', 'js/dialogs.js', 'js/layerfx.js', 'js/guides.js', 'js/archive.js',
  'js/apsis.js', 'js/agent.js', 'js/api.js', 'js/touch.js', 'js/tips.js', 'js/quality.js', 'js/settings.js', 'js/pwa.js', 'js/main.js',
  'tests/smoke.js',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(() => { });
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
