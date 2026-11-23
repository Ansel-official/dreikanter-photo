const fs=require('fs');
const files=[...fs.readdirSync('js').map(f=>'js/'+f), 'index.html','README.md','CHANGELOG.md','sw.js','tests/smoke.js','tests/run.js','css/base.css','css/apsis.css','css/themes.css','css/mobile.css','css/polish.css','css/ui-kit.css','css/tokens.css'];
const marks=/[\u9358\u9429\u9519\u9409\u9508\u93ad\u9352\u9555\u9510\u93b7\u9435\u9534\u95bf\u9470\u94a5\u95c2\u93a9\u9405\u9518\u93c4]/g;
for(const f of files){
  let s; try{s=fs.readFileSync(f,'utf8');}catch(e){continue;}
  const hits=[...s.matchAll(/([\u4e00-\u9fff]{2,})/g)].filter(m=>/[\u9358\u9429\u9519\u9409\u9508\u93ad\u9352\u9555\u9510\u93b7\u9435\u9534\u95bf\u9470\u94a5\u95c2\u93a9\u9405\u9518\u93c4\u7ed8\u9359\u935a]/.test(m[1]));
  if(hits.length) console.log(f.padEnd(20), hits.length, JSON.stringify(hits.slice(0,4).map(h=>h[1].slice(0,14))));
}
