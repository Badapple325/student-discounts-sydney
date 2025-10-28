const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const repoRoot = path.resolve(__dirname,'..');
const qaPath = path.join(repoRoot,'tools','tmp','qa-preview.json');
const outCsv = path.join(repoRoot,'tools','tmp','qa-preview-link-check.csv');
if(!fs.existsSync(qaPath)){ console.error('qa-preview.json not found'); process.exit(1); }

function checkUrl(url, timeout=7000){
  return new Promise((resolve)=>{
    try{
      const lib = url.startsWith('https')? https : http;
      const req = lib.request(url, {method:'HEAD', timeout}, (res)=>{
        const ok = res.statusCode && res.statusCode >=200 && res.statusCode < 400;
        resolve({url, status:res.statusCode, ok, headers:res.headers});
      });
      req.on('error', (e)=>{ resolve({url, status:0, ok:false, error:e.message}); });
      req.on('timeout', ()=>{ req.destroy(); resolve({url, status:0, ok:false, error:'timeout'}); });
      req.end();
    }catch(e){ resolve({url, status:0, ok:false, error:e.message}); }
  });
}

async function main(){
  const items = JSON.parse(fs.readFileSync(qaPath,'utf8'));
  const out = ['id,title,link,status,ok,error'];
  for(const it of items){
    const link = it.link || '';
    if(!link){ out.push([it.id, '"'+(it.title||'').replace(/"/g,'""')+'"', '', '', false, 'no-link'].join(',')); continue; }
    const r = await checkUrl(link);
    out.push([it.id, '"'+(it.title||'').replace(/"/g,'""')+'"', r.url, r.status||'', r.ok, r.error||''].join(','));
    await new Promise(r=>setTimeout(r,150));
  }
  fs.writeFileSync(outCsv, out.join('\n'),'utf8');
  console.log('Wrote', outCsv);
}

main().catch(e=>{ console.error(e); process.exit(1); });
