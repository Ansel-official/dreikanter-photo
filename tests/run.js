#!/usr/bin/env node
/* ==========================================================================
   Dreikanter photo — tests/run.js
   用 headless Edge + CDP 真实驱动浏览器内自检，并可选生成三张截图。
   用法：node tests/run.js [--shots]
   前置：本机已启动静态服务（默认 http://127.0.0.1:8787）
   ========================================================================== */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9345;
const BASE = process.env.DRK_BASE || 'http://127.0.0.1:8787';
const EDGE = process.env.DRK_BROWSER || 'C://Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = path.join(__dirname, '..', '.tmp-test-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { }
  const browser = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1600,1000', 'about:blank'
  ], { stdio: 'ignore' });

  let tab = null;
  for (let i = 0; i < 90; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      if (list.length) { tab = list.find(t => t.type === 'page'); if (tab) break; }
    } catch (e) { }
    await sleep(250);
  }
  if (!tab) { console.log('无法连接浏览器'); browser.kill(); process.exit(1); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map();
  let seq = 0;
  const send = (method, params) => new Promise(res => {
    const id = ++seq;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  /* 预热一次：模拟 PWA 二次启动（脚本已在磁盘缓存），避免冷盘抖动污染首屏指标 */
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(1800);
  await send('Page.navigate', { url: BASE + '/?test' });

  let ready = false;
  for (let i = 0; i < 80; i++) {
    const r = await send('Runtime.evaluate', { expression: 'typeof window.__TESTS', returnByValue: true });
    if (r.result && r.result.result && r.result.result.value === 'object') { ready = true; break; }
    await sleep(250);
  }
  if (!ready) { console.log('自检脚本未加载'); browser.kill(); process.exit(1); }

  const t0 = Date.now();
  const r = await send('Runtime.evaluate', { expression: 'window.__TESTS.run()', awaitPromise: true, returnByValue: true, timeout: 300000 });
  const res = r.result && r.result.result && r.result.result.value;
  if (!res || !res.items) {
    console.log('执行异常', JSON.stringify(r.result || {}).slice(0, 500));
    browser.kill(); process.exit(1);
  }

  const fails = res.items.filter(i => !i.pass);
  console.log(`\nDreikanter photo — 自检 ${res.pass}/${res.total}  ${res.ms}ms  墙钟 ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  res.items.forEach(i => {
    console.log(`${i.pass ? '✓' : '✗'} ${i.name}${i.info ? '  [' + i.info + ']' : ''}`);
  });
  if (fails.length) { console.log('\n失败项：'); fails.forEach(f => console.log('  ✗ ' + f.name + '  ' + (f.info || ''))); }
  if (res.errors && res.errors.length) { console.log('\n运行时错误：'); res.errors.forEach(e => console.log('  ' + e)); }

  /* --------- v19.0：多端布局检查（375 手机 / 768 平板 / 1280 桌面） --------- */
  const adaptFails = [];
  const checkViewport = async (w, h, label) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: w < 600
    });
    await sleep(450);
    const rr = await send('Runtime.evaluate', {
      expression: `(() => {
        const de = document.documentElement;
        const over = de.scrollWidth - window.innerWidth;
        const small = [];
        document.querySelectorAll('button').forEach(el => {
          const label = (el.textContent || '').trim();
          if (!label) return;                       /* 纯图标按钮另行检查，这里只看带文字的 */
          if (el.closest('.swatch-grid')) return;   /* 色板是刻意的小方块 */
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.height < 23.5) small.push((el.id || el.className || '?') + ':' + Math.round(r.height));
        });
        return { over, w: window.innerWidth, h: window.innerHeight, small: small.slice(0, 5), smallCount: small.length };
      })()`, returnByValue: true
    });
    const v = rr.result && rr.result.result && rr.result.result.value;
    await send('Emulation.clearDeviceMetricsOverride');
    await sleep(200);
    if (!v) { adaptFails.push(label + ' 读取失败'); return; }
    if (v.over > 2) adaptFails.push(label + ' 横向溢出 ' + v.over + 'px');
    if (v.smallCount) adaptFails.push(label + ' 命中区过小 ' + v.smallCount + ' 个：' + v.small.join(','));
    console.log(`  适配 ${label}: ${v.w}×${v.h} 溢出 ${Math.max(0, v.over)}px 小目标 ${v.smallCount}`);
  };
  for (const [w, h, label] of [[375, 667, '手机'], [768, 1024, '平板'], [1280, 800, '桌面']]) {
    await checkViewport(w, h, label);
  }
  if (adaptFails.length) {
    console.log('\n适配问题：');
    adaptFails.forEach(f => console.log('  ✗ ' + f));
  } else {
    console.log('  适配 三档视口全部通过');
  }

  if (process.argv.includes('--shots')) {
    /* v18.1：先给起始页留一张（自检跑完后界面停在编辑器，这里再切回去） */
    await send('Runtime.evaluate', {
      expression: "(() => { const o=document.getElementById('testOut'); if(o) o.remove(); if (typeof showWelcome === 'function') showWelcome(); const tr=document.getElementById('toastroot'); if(tr) tr.innerHTML=''; return 'ok'; })()",
      returnByValue: true
    });
    await sleep(600);
    {
      const s0 = await send('Page.captureScreenshot', { format: 'png' });
      if (s0.result && s0.result.data) {
        fs.writeFileSync(path.join(__dirname, '..', 'final-welcome.png'), Buffer.from(s0.result.data, 'base64'));
        console.log('已保存 final-welcome.png');
      }
    }
    await send('Runtime.evaluate', { expression: "(() => { hideWelcome(); return 'ok'; })()", returnByValue: true });

    const shot = async (file, clip) => {
      await sleep(700);
      const s = await send('Page.captureScreenshot', clip ? { format: 'png', clip } : { format: 'png' });
      if (s.result && s.result.data) fs.writeFileSync(path.join(__dirname, '..', file), Buffer.from(s.result.data, 'base64'));
      console.log('已保存 ' + file);
    };
    const clean = async () => {
      await send('Runtime.evaluate', {
        expression: `(() => {
          if (typeof Transform !== 'undefined' && Transform.active) Transform.cancel();
          Guides.clear(); Guides.setUnit('px'); Guides.show = true; Guides.snapGrid = false;
          App.showGrid = false;
          const tr = document.getElementById('toastroot'); if (tr) tr.innerHTML = '';
          fitView(); invalidateOverlay(); return 'ok';
        })()`, returnByValue: true
      });
      await sleep(320);
    };

    await send('Page.navigate', { url: BASE + '/?editor' }); await sleep(2600);
    await clean();
    await send('Runtime.evaluate', { expression: "hideWelcome(); fitView(); App.showGrid=false; 'ok'", returnByValue: true });
    await shot('final.png');

    /* v10 细节图 1：标尺（mm）+ 参考线（含 30° 斜参考线）+ 网格 */
    await send('Runtime.evaluate', {
      expression: `(() => {
        hideWelcome();
        Guides.setUnit('mm');
        Guides.data = { x: [420, 1180], y: [260, 700], angled: [{ x: 800, y: 520, a: 30 }] };
        Guides.color = '#4fd1ff'; Guides.style = 'dashed';
        Guides.grid.size = 100; Guides.grid.sub = 4; Guides.grid.color = '#78aaff'; Guides.grid.opacity = .45;
        App.showGrid = true; Guides.show = true;
        fitView(); setZoom(0.78); Guides.syncCorner(); invalidateOverlay();
        return 'ok';
      })()`, returnByValue: true
    });
    await shot('final-guides.png');

    /* v10 细节图 2：自由变换（8 手柄 + 旋转环 + 数值栏） */
    await clean();
    await send('Runtime.evaluate', {
      expression: `(() => {
        const l = App.layers[App.layers.length - 1];
        App.activeId = l.id; sync();
        Transform.begin();
        Transform.setSize(App.doc.w * .78, App.doc.h * .78, false);
        Transform.angle = -7; Transform.render(); Transform.syncBar(); UI.renderOptions();
        fitView(); invalidateOverlay();
        return 'ok';
      })()`, returnByValue: true
    });
    await shot('final-transform.png');

    /* v13 细节图 3：曲线 */
    await clean();
    await send('Runtime.evaluate', {
      expression: `(() => {
        newDocument(900, 600, { bg: '#6b7a8f' });
        const c = ctx2d(activeLayer().canvas);
        const g = c.createLinearGradient(0, 0, 900, 600);
        g.addColorStop(0, '#20344a'); g.addColorStop(0.62, '#7d6a86'); g.addColorStop(1, '#e6d3b3');
        c.fillStyle = g; c.fillRect(0, 0, 900, 600);
        fitView(); sync(); Dialogs.curves();
        setTimeout(() => {
          const b = [...document.querySelectorAll('.modal button')].find(x => /S 曲线/.test(x.textContent));
          if (b) b.click();
        }, 260);
        return 'ok';
      })()`, returnByValue: true
    });
    await sleep(1200);
    await shot('final-curves.png');
    await send('Runtime.evaluate', {
      expression: "const mb = document.querySelector('.modal'); if (mb) { const c2 = mb.querySelector('.modal-close'); if (c2) c2.click(); } 'ok'",
      returnByValue: true
    });
    await sleep(600);

    /* v13 细节图 4：批量处理 */
    await send('Runtime.evaluate', {
      expression: `(async () => {
        const mk = async (w, h, col, name) => {
          const cv = makeCanvas(w, h); const x = ctx2d(cv);
          x.fillStyle = col; x.fillRect(0, 0, w, h);
          const b = await new Promise(r => cv.toBlob(r, 'image/png'));
          return new File([b], name, { type: 'image/png' });
        };
        Batch.clear(); Batch.download = false;
        Batch.addFiles([
          await mk(300, 200, '#3a5f8a', 'IMG_2031.png'),
          await mk(240, 240, '#8a5f3a', 'IMG_2032.png'),
          await mk(400, 300, '#5f8a3a', 'IMG_2033.png')
        ]);
        Dialogs.batch();
        return 'ok';
      })()`, awaitPromise: true, returnByValue: true
    });
    await sleep(900);
    await shot('final-batch.png');
    await send('Runtime.evaluate', {
      expression: "const mb = document.querySelector('.modal'); if (mb) { const c2 = mb.querySelector('.modal-close'); if (c2) c2.click(); } Batch.clear(); 'ok'",
      returnByValue: true
    });
    await send('Page.navigate', { url: BASE + '/?editor' }); await sleep(2400);
    await clean();

    await clean();

    /* v15 细节图：局部调整范围 */
    await send('Runtime.evaluate', {
      expression: `(() => {
        newDocument(900, 600, { bg: '#20334a' });
        const c = ctx2d(activeLayer().canvas);
        const g = c.createRadialGradient(450, 300, 20, 450, 300, 520);
        g.addColorStop(0, '#e8c48a'); g.addColorStop(0.45, '#7a5f86'); g.addColorStop(1, '#16202e');
        c.fillStyle = g; c.fillRect(0, 0, 900, 600);
        fitView(); sync();
        LocalAdj.active = true;
        LocalAdj.region = { type: 'radial', cx: 450, cy: 300, r: 190 };
        invalidateOverlay();
        const tr = document.getElementById('toastroot'); if (tr) tr.innerHTML = '';
        return 'ok';
      })()`, returnByValue: true
    });
    await sleep(800);
    await shot('final-local.png');
    await send('Runtime.evaluate', { expression: "LocalAdj.cancel(); 'ok'", returnByValue: true });
    await sleep(300);

    /* v18 细节图：分屏对比（左原图 / 右当前，已套徕卡） */
    await send('Runtime.evaluate', {
      expression: `(() => { Dialogs.loadDemo(true); return 'ok'; })()`, returnByValue: true
    });
    await sleep(1300);
    await send('Runtime.evaluate', {
      expression: `(() => {
        hideWelcome();
        applyFilterDirect(FX.cameraLook, { look: 'leica', intensity: 100 }, 'LUT 徕卡');
        Compare.split = true; Compare.x = 0.52;
        fitView(); invalidateOverlay(); invalidate();
        const tr = document.getElementById('toastroot'); if (tr) tr.innerHTML = '';
        return 'ok';
      })()`, returnByValue: true
    });
    await sleep(900);
    await shot('final-compare.png');
    await send('Runtime.evaluate', { expression: "Compare.split = false; invalidateOverlay(); invalidate(); 'ok'", returnByValue: true });
    await sleep(200);

    await send('Runtime.evaluate', { expression: "Settings.set('theme','light',false); fitView(); 'ok'", returnByValue: true });
    await sleep(600);
    await shot('final-light.png');
    await send('Runtime.evaluate', { expression: "Settings.set('theme','dark',false); 'ok'", returnByValue: true });

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await sleep(400);
    await send('Runtime.evaluate', { expression: "Settings.set('theme','dark',false); Guides.clear(); App.showGrid=false; 'ok'", returnByValue: true });
    await send('Page.navigate', { url: BASE + '/?editor' }); await sleep(2800);
    await send('Runtime.evaluate', {
      expression: "hideWelcome(); fitView(); App.showGrid=false; Guides.clear(); document.getElementById('toastroot').innerHTML=''; 'ok'",
      returnByValue: true
    });
    await shot('final-mobile.png', { x: 0, y: 0, width: 390, height: 844, scale: 2 });
  }

  ws.close(); browser.kill();
  /* 清理临时浏览器档案，避免每次运行留下几十 MB */
  await sleep(600);
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { }
  process.exit(fails.length || adaptFails.length ? 1 : 0);
})().catch(e => { console.log('运行器错误：', e.message); process.exit(1); });
