const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const repoRoot = path.resolve(__dirname, '..');
const qaPath = path.join(repoRoot, 'tools', 'tmp', 'qa-preview.json');
const outCsv = path.join(repoRoot, 'tools', 'tmp', 'final-qa-report.csv');

if(!fs.existsSync(qaPath)){ console.error('qa-preview.json not found'); process.exit(1); }

function get(url, timeout=10000){
  return new Promise((resolve)=>{
    try{
      const lib = url.startsWith('https')? https : http;
      const req = lib.get(url, { timeout, headers: { 'User-Agent': 'StudentDiscountsBot/1.0 (+https://example.com)' } }, (res)=>{
        const chunks = [];
        let length = 0;
        res.on('data', (c)=>{ if(length < 20000){ chunks.push(c); length += c.length; } });
        res.on('end', ()=>{
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode, headers: res.headers, finalUrl: res.responseUrl || url, body });
        });
      });
      req.on('error', (e)=> resolve({ error: e.message }));
      req.on('timeout', ()=>{ req.destroy(); resolve({ error: 'timeout' }); });
    }catch(e){ resolve({ error: e.message }); }
  });
}

function extractTitle(html){
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].replace(/\s+/g,' ').trim() : '';
}

async function main(){
  const items = JSON.parse(fs.readFileSync(qaPath,'utf8'));
  const out = ['id,title,orig_link,status,final_url,ok,title_text,content_type,error'];
  for(const it of items){
    const id = it.id || '';
    const title = (it.title||'').replace(/"/g,'""');
    const link = it.link || '';
    if(!link){ out.push([id, '"'+title+'"', '', '', '', false, '', '', 'no-link'].join(',')); continue; }
    // perform GET
    let res;
    try{ res = await get(link); }catch(e){ res = { error: e.message }; }
    if(res.error){ out.push([id, '"'+title+'"', link, '', '', false, '', '', res.error].join(',')); continue; }
    const status = res.status || '';
    const finalUrl = res.finalUrl || link;
    const ok = (status >=200 && status < 400) || (status >=300 && status < 400);
    const ctype = (res.headers && res.headers['content-type']) ? res.headers['content-type'] : '';
    const t = extractTitle(res.body || '');
    out.push([id, '"'+title+'"', '"'+link+'"', status, '"'+finalUrl+'"', ok, '"'+(t.replace(/"/g,'""'))+'"', '"'+ctype+'"', ''].join(','));
    // brief delay
    await new Promise(r=>setTimeout(r,200));
  }
  fs.writeFileSync(outCsv, out.join('\n'),'utf8');
  console.log('Wrote final QA report to', outCsv);
}

main().catch(e=>{ console.error(e); process.exit(1); });
