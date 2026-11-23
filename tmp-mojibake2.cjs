const fs=require('fs');
const dec=new TextDecoder('gbk');  // throws if unsupported
function looksMojibake(s){
  if(!/^[\u4e00-\u9fff\uff00-\uffef\u3000-\u303f]+$/.test(s)) return false;
  const bytes=Buffer.from(s,'utf8');
  let back; try{ back=dec.decode(bytes);}catch(e){return false;}
  if(back.includes('\ufffd')) return false;
  if(!/[\u4e00-\u9fff]/.test(back)) return false;
  // Valid GBK decode of UTF-8 bytes of real Chinese rarely produces common chars; require the round trip to be stable
  return back!==s;
}
const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+e.name;if(e.isDirectory()){if(!/^\.|tmp-/.test(e.name))walk(p);}else if(/\.(js|html|css|md|txt|webmanifest)$/.test(e.name))files.push(p);}})('.');
const report=[];
for(const f of files){
  const s=fs.readFileSync(f,'utf8');
  const hits=[...s.matchAll(/[\u4e00-\u9fff]{2,}/g)].map(m=>({txt:m[1],idx:m.index})).filter(h=>looksMojibake(h.txt));
  if(hits.length) report.push({f, n:hits.length, ex:hits.slice(0,6).map(h=>h.txt.slice(0,16))});
}
report.sort((a,b)=>b.n-a.n);
for(const r of report) console.log(r.f.padEnd(22), String(r.n).padStart(3), JSON.stringify(r.ex));
console.log('total files with mojibake:', report.length, ' total hits:', report.reduce((a,b)=>a+b.n,0));
