#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const QA = path.join(__dirname, 'tmp', 'logo-qa.csv');
const DEALS = path.join(ROOT, 'deals.json');
const ASSETS_DIR = path.join(ROOT, 'assets', 'logos');
const REPORT = path.join(__dirname, 'tmp', 'logo-apply-report.json');

if(!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

function parseCsv(content){
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',').map(h => h.replace(/^"|"$/g,''));
  return lines.map(l => {
    const parts = [];
    let cur = '';
    let inQuote = false;
    for(let i=0;i<l.length;i++){
      const ch = l[i];
      if(ch === '"') { inQuote = !inQuote; continue; }
      if(ch === ',' && !inQuote){ parts.push(cur); cur=''; continue; }
      cur += ch;
    }
    parts.push(cur);
    const obj = {};
    for(let i=0;i<header.length;i++) obj[header[i]] = (parts[i]||'').replace(/^"|"$/g,'');
    return obj;
  });
}

function extFromContentType(ct){
  if(!ct) return 'png';
  ct = ct.toLowerCase();
  if(ct.includes('svg')) return 'svg';
  if(ct.includes('png')) return 'png';
  if(ct.includes('jpeg')||ct.includes('jpg')) return 'jpg';
  return 'png';
}

function download(url, out){
  return new Promise(resolve => {
    const file = fs.createWriteStream(out);
    const req = https.get(url, res => {
      if(res.statusCode !== 200){ try{ file.close(); fs.unlinkSync(out);}catch(e){}; return resolve({ ok:false, status: res.statusCode }); }
      const ct = res.headers['content-type'] || '';
      const chunks = [];
      res.on('data', c=>chunks.push(c));
      res.on('end', ()=>{
        try{
          fs.writeFileSync(out, Buffer.concat(chunks));
          resolve({ ok:true, ct });
        }catch(e){ try{ fs.unlinkSync(out);}catch(_){}; resolve({ ok:false, error: String(e) }); }
      });
    });
    req.on('error', err => { try{ file.close(); fs.unlinkSync(out);}catch(e){}; resolve({ ok:false, error: String(err) }); });
  });
}

async function main(){
  if(!fs.existsSync(QA)){ console.error('QA CSV not found at', QA); process.exit(1); }
  if(!fs.existsSync(DEALS)){ console.error('deals.json not found at', DEALS); process.exit(1); }

  const qaRaw = fs.readFileSync(QA,'utf8');
  const rows = parseCsv(qaRaw);
  const deals = JSON.parse(fs.readFileSync(DEALS,'utf8'));
  const byId = Object.fromEntries(deals.map(d=>[d.id, d]));

  const applied = [];

  for(const r of rows){
    const id = r.id;
    const dryLogo = (r.dryrun_logoURL||'').trim();
    const suggested = (r.suggested_action||'');
    if(!dryLogo) { applied.push({ id, status: 'no-dryrun-logo' }); continue; }
    // skip if already has local logo
    const d = byId[id] || {};
    if(d.logo && d.logo.startsWith('/assets/logos/')){ applied.push({ id, status: 'already-local', path: d.logo }); continue; }

    // attempt download
    try{
      console.log('Downloading', id, dryLogo);
      // probe HEAD is unreliable on some hosts; attempt GET and determine content-type
      const tmpExt = 'tmp';
      const tmpName = `${id}.${tmpExt}`;
      const outTmp = path.join(ASSETS_DIR, tmpName);
      const res = await download(dryLogo, outTmp);
      if(!res.ok){ applied.push({ id, status: 'download_failed', reason: res.error || res.status }); continue; }
      const ext = extFromContentType(res.ct);
      const filename = `${id}.${ext}`;
      const finalPath = path.join(ASSETS_DIR, filename);
      fs.renameSync(outTmp, finalPath);
      // update deals.json entry
      byId[id].logo = `/assets/logos/${filename}`;
      applied.push({ id, status: 'downloaded', path: byId[id].logo, src: dryLogo, content_type: res.ct });
    }catch(e){ applied.push({ id, status: 'error', error: String(e) }); }
  }

  // write backup & updated deals.json
  const bak = DEALS + '.bak.' + Date.now();
  fs.copyFileSync(DEALS, bak);
  fs.writeFileSync(DEALS, JSON.stringify(Object.values(byId), null, 2), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify({ ts: new Date().toISOString(), backup: bak, applied }, null, 2));
  console.log('Done. Backup:', bak, 'Report:', REPORT);
}

main().catch(e=>{ console.error(e); process.exit(1); });
