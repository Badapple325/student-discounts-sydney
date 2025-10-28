#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APPLIED = path.join(__dirname, 'tmp', 'logo-applied.json');
const DEALS = path.join(ROOT, 'deals.json');
const ASSETS_DIR = path.join(ROOT, 'assets', 'logos');
const REPORT = path.join(__dirname, 'tmp', 'logo-download-report.json');

if(!fs.existsSync(APPLIED)){
  console.error('Missing', APPLIED, '- run tools/suggest_logos.js and apply_logo_suggestions.js first');
  process.exit(2);
}

if(!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function download(url, outPath){
  return new Promise((resolve,reject)=>{
    const file = fs.createWriteStream(outPath);
    const req = https.get(url, res=>{
      if(res.statusCode !== 200){ file.close(); fs.unlinkSync(outPath); return resolve({ ok:false, status: res.statusCode }); }
      res.pipe(file);
      file.on('finish', ()=>{ file.close(()=>resolve({ ok:true })); });
    });
    req.on('error', err=>{ try{ file.close(); fs.unlinkSync(outPath); }catch(e){}; resolve({ ok:false, error: String(err) }); });
  });
}

function extFromContentType(ct){
  if(!ct) return 'png';
  if(ct.includes('svg')) return 'svg';
  if(ct.includes('png')) return 'png';
  if(ct.includes('jpeg')||ct.includes('jpg')) return 'jpg';
  return 'png';
}

async function probeContentType(url){
  return new Promise(resolve=>{
    const req = https.request(url, { method:'HEAD' }, res=>{
      const ct = res.headers['content-type'] || '';
      resolve(ct);
    });
    req.on('error', ()=>resolve(null));
    req.end();
  });
}

async function main(){
  const applied = JSON.parse(fs.readFileSync(APPLIED,'utf8'));
  const deals = JSON.parse(fs.readFileSync(DEALS,'utf8'));
  const byId = Object.fromEntries(deals.map(d=>[d.id,d]));
  const report = [];

  // iterate suggestions and download
  for(const s of applied){
    const id = s.id;
    const candidate = s.logo; // e.g. https://logo.clearbit.com/example.com?size=128
    if(!candidate) continue;
    console.log('Processing', id, candidate);
    // probe content-type
    const ct = await probeContentType(candidate).catch(()=>null);
    const ext = extFromContentType(ct);
    const filename = `${id}.${ext}`;
    const outPath = path.join(ASSETS_DIR, filename);

    // download
    const res = await download(candidate, outPath);
    if(res.ok){
      // update deals.json in memory
      if(byId[id]){
        byId[id].logo = `/assets/logos/${filename}`;
      }
      report.push({ id, status: 'downloaded', path: `/assets/logos/${filename}` });
    } else {
      report.push({ id, status: 'failed', reason: res.error || res.status });
    }
  }

  // backup deals.json and write updated
  const bak = DEALS + '.bak.' + Date.now();
  fs.copyFileSync(DEALS, bak);
  fs.writeFileSync(DEALS, JSON.stringify(Object.values(byId), null, 2), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify({ ts: new Date().toISOString(), backup: bak, report }, null, 2));
  console.log('Done. Backup:', bak, 'Report:', REPORT);
}

main().catch(e=>{ console.error(e); process.exit(1); });
