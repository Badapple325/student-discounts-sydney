const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const repoRoot = path.resolve(__dirname, '..');
const inCsv = path.join(repoRoot,'tools','tmp','missing-links.csv');
const outCsv = path.join(repoRoot,'tools','tmp','missing-links-suggestions.csv');
const outLog = path.join(repoRoot,'tools','tmp','missing-links-log.txt');
if(!fs.existsSync(inCsv)){ console.error('missing-links.csv not found'); process.exit(1); }

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for(const l of lines.slice(1)){
    const cols = l.split(',').map(c=>c.replace(/^"|"$/g,'').trim());
    rows.push({id:cols[0], title:cols[1], retailer:cols[2], link:cols[3], category:cols[4], notes:cols[5]});
  }
  return rows;
}

function slugify(s){ return (s||'').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

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

async function probeCandidates(row){
  const title = row.title || row.retailer || '';
  const slug = slugify(title.replace(/\u00E9/g,'e'));
  const candidates = [];
  // heuristics
  candidates.push(`https://${slug}.com.au`);
  candidates.push(`https://${slug}.com`);
  candidates.push(`https://www.${slug}.com.au`);
  candidates.push(`https://www.${slug}.com`);
  // try removing hyphens
  candidates.push(`https://${slug.replace(/-/g,'')}.com.au`);
  candidates.push(`https://${slug.replace(/-/g,'')}.com`);
  // Facebook/Instagram
  candidates.push(`https://www.facebook.com/${slug}`);
  candidates.push(`https://facebook.com/${slug}`);
  candidates.push(`https://www.instagram.com/${slug}`);
  candidates.push(`https://instagram.com/${slug}`);
  // some chain-specific well-known domains
  const known = {
    'gong-cha': ['https://www.gongcha.com.au','https://gongcha.com.au','https://www.gongcha.com'],
    'gongcha': ['https://www.gongcha.com.au','https://gongcha.com.au']
  };
  for(const k of Object.keys(known)) if(slug.includes(k)) for(const u of known[k]) candidates.push(u);

  const seen = new Set();
  const results = [];
  for(const c of candidates){ if(!seen.has(c)){ seen.add(c); results.push(await checkUrl(c)); } }
  return results;
}

async function main(){
  const rows = parseCSV(fs.readFileSync(inCsv,'utf8'));
  const out = ['id,title,candidate_url,status,ok,error'];
  const log = [];
  for(const r of rows){
    log.push('Probing: '+r.id+' - '+r.title);
    const res = await probeCandidates(r);
    // pick first OK
    const ok = res.find(x=>x.ok);
    if(ok){ out.push([r.id, '"'+(r.title||'').replace(/"/g,'""')+'"', ok.url, ok.status, ok.ok, ok.error||''].join(',')); log.push('Found: '+ok.url+' ('+ok.status+')'); }
    else {
      // append top candidates with statuses
      for(const s of res.slice(0,4)) out.push([r.id,'"'+(r.title||'').replace(/"/g,'""')+'"', s.url, s.status, s.ok, s.error||''].join(','));
      log.push('No ok candidate for '+r.id+'; top checked: '+res.slice(0,4).map(x=>x.url+':'+(x.status||x.error)).join(', '));
    }
    // slight delay to be polite
    await new Promise(r=>setTimeout(r,250));
  }
  fs.writeFileSync(outCsv, out.join('\n'),'utf8');
  fs.writeFileSync(outLog, log.join('\n'),'utf8');
  console.log('Wrote suggestions to', outCsv, 'log:', outLog);
}

main().catch(e=>{ console.error(e); process.exit(1); });
