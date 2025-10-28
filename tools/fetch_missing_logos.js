#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const DEALS = path.join(ROOT, 'deals.json');
const ASSETS_DIR = path.join(ROOT, 'assets', 'logos');
const REPORT = path.join(__dirname, 'tmp', 'missing-logo-download-report.json');

if(!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function extFromContentType(ct){
  if(!ct) return 'png';
  if(ct.includes('svg')) return 'svg';
  if(ct.includes('png')) return 'png';
  if(ct.includes('jpeg')||ct.includes('jpg')) return 'jpg';
  return 'png';
}

function probeHead(u){
  return new Promise(resolve=>{
    const r = https.request(u, { method:'HEAD' }, res=>{
      resolve({ status: res.statusCode, ct: res.headers['content-type'] });
    });
    r.on('error', ()=>resolve(null));
    r.end();
  });
}

function download(u, out){
  return new Promise(resolve=>{
    const file = fs.createWriteStream(out);
    const req = https.get(u, res=>{
      if(res.statusCode !== 200){ try{ file.close(); fs.unlinkSync(out);}catch(e){}; return resolve({ ok:false, status: res.statusCode }); }
      res.pipe(file);
      file.on('finish', ()=> file.close(()=> resolve({ ok:true })));
    });
    req.on('error', err=>{ try{ file.close(); fs.unlinkSync(out);}catch(e){}; resolve({ ok:false, error: String(err) }); });
  });
}

function clearbitForHost(h){
  return `https://logo.clearbit.com/${h}?size=128`;
}

function hostFromDeal(d){
  const fields = ['link','url','website'];
  for(const f of fields){
    if(d[f]){
      try{
        const p = new URL(d[f]);
        return p.hostname.replace(/^www\./,'');
      }catch(e){
        // try adding protocol
        try{ const p = new URL('https://'+d[f]); return p.hostname.replace(/^www\./,''); }catch(e2){}
      }
    }
  }
  return null;
}

async function main(){
  const deals = JSON.parse(fs.readFileSync(DEALS,'utf8'));
  const report = [];
  const byId = Object.fromEntries(deals.map(d=>[d.id,d]));

  for(const d of deals){
    if(d.logo && d.logo.startsWith('/assets/logos/')){ continue; }
    const host = hostFromDeal(d);
    if(!host){ report.push({ id: d.id, status: 'no-host' }); continue; }
    const candidate = clearbitForHost(host);
    console.log('Trying', d.id, candidate);
    const head = await probeHead(candidate);
    if(!head || head.status !== 200){ report.push({ id: d.id, status: 'no-logo', candidate, head }); continue; }
    const ext = extFromContentType(head.ct);
    const filename = `${d.id}.${ext}`;
    const outPath = path.join(ASSETS_DIR, filename);
    const res = await download(candidate, outPath);
    if(res.ok){
      byId[d.id].logo = `/assets/logos/${filename}`;
      report.push({ id: d.id, status: 'downloaded', path: `/assets/logos/${filename}` });
    } else {
      report.push({ id: d.id, status: 'download-failed', reason: res.error || res.status });
    }
  }

  // write backup and updated deals.json
  const bak = DEALS + '.bak.' + Date.now();
  fs.copyFileSync(DEALS, bak);
  fs.writeFileSync(DEALS, JSON.stringify(Object.values(byId), null, 2), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify({ ts: new Date().toISOString(), backup: bak, report }, null, 2));
  console.log('Finished. Backup:', bak, 'Report:', REPORT);
}

main().catch(e=>{ console.error(e); process.exit(1); });
