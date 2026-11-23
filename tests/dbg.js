const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const PORT = 9347;
const BASE = 'http://127.0.0.1:8787';
const EDGE = 'C://Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PROFILE = path.join(__dirname, '..', '.tmp-dbg-profile');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { }
  const browser = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 90; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) { tab = list.find(t => t.type === 'page'); if (tab) break; } } catch (e) { }
    await sleep(250);
  }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  const pending = new Map(); let seq = 0;
  const send = (m, p) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') console.log('EXC:', ((m.params.exceptionDetails.exception || {}).description || '').split('\n')[0]);
  };
  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: BASE + '/?editor' });
  await sleep(2700);
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return 'ERR ' + ((r.result.exceptionDetails.exception || {}).description || '').split('\n')[0];
    return r.result && r.result.result ? r.result.result.value : null;
  };

  console.log('begin', await ev(`(() => { hideWelcome(); const ok = Transform.begin(); return ok + ':' + Transform.active + ':' + (Transform.box && Transform.box.w); })()`));
  console.log('opts', await ev(`document.querySelector('#optionsbar').textContent.slice(0,80)`));
  console.log('rotate', await ev(`(() => { Transform.angle = 18; Transform.setSize(1200, 760, false); Transform.render(); return Transform.angle + '/' + Math.round(Transform.box.w); })()`));
  await sleep(300);
  let s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', '.tmp-tf1.png'), Buffer.from(s.result.data, 'base64'));

  console.log('commit', await ev(`(() => { const before = App.layers.length; Transform.commit(); return Transform.active + ':' + before + ':' + App.layers[0].canvas.width + 'x' + App.layers[0].canvas.height + ':hist' + History.entries.length; })()`));
  await sleep(400);
  s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', '.tmp-tf2.png'), Buffer.from(s.result.data, 'base64'));
  console.log('undo', await ev(`(() => { History.undo(); return 'ok'; })()`));
  console.log('sel transform', await ev(`(() => { selectAll(); Transform.begin(); const t = Transform.target; Transform.cancel(); deselect(); return t; })()`));
  ws.close(); browser.kill(); process.exit(0);
})().catch(e => { console.log('err', e.message); process.exit(1); });
