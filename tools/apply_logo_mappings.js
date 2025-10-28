#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(__dirname, 'tmp');
const DRY = path.join(TMP, 'logo-mapping-dryrun.csv');
const DEALS = path.join(ROOT, 'deals.json');
const ASSETS = path.join(ROOT, 'assets', 'logos');
const REPORT = path.join(TMP, 'logo-apply-report.json');

if(!fs.existsSync(DRY)){ console.error('Missing dryrun:', DRY); process.exit(2); }
if(!fs.existsSync(DEALS)){ console.error('Missing deals.json'); process.exit(2); }
if(!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });

function parseCSVLine(line){
  const out = [];
  let cur = '';
  let inQuotes = false;
  for(let i=0;i<line.length;i++){
    const c = line[i];
    if(inQuotes){
      if(c==='"'){ if(line[i+1]==='"'){ cur+='"'; i++; } else { inQuotes=false; } }
      else cur+=c;
    } else {
      if(c==='"'){ inQuotes=true; }
      else if(c===','){ out.push(cur); cur=''; }
      else cur+=c;
    }
  }
  out.push(cur);
  return out;
}

function extFromContentType(ct){
  if(!ct) return 'png';
  if(ct.includes('svg')) return 'svg';
  if(ct.includes('png')) return 'png';
  if(ct.includes('jpeg')||ct.includes('jpg')) return 'jpg';
  return 'png';
}

function probeHead(u){
  return new Promise(resolve=>{
    try{
      const req = https.request(u, { method:'HEAD' }, res=>{
        resolve({ status: res.statusCode, ct: res.headers['content-type'] });
      });
      req.on('error', ()=>resolve(null));
      req.end();
    }catch(e){ resolve(null); }
  });
}

function download(u, outPath){
  return new Promise(resolve=>{
    const file = fs.createWriteStream(outPath);
    const req = https.get(u, res=>{
      if(res.statusCode !== 200){ try{ file.close(); fs.unlinkSync(outPath); }catch(e){}; return resolve({ ok:false, status: res.statusCode }); }
      res.pipe(file);
      file.on('finish', ()=> file.close(()=> resolve({ ok:true }))); 
    });
    req.on('error', err=>{ try{ file.close(); fs.unlinkSync(outPath);}catch(e){}; resolve({ ok:false, error: String(err) }); });
  });
}

async function main(){
  const csv = fs.readFileSync(DRY,'utf8').replace(/\r\n/g,'\n').split('\n').filter(Boolean);
  const header = parseCSVLine(csv[0]);
  const rows = csv.slice(1).map(line=>{ const cols = parseCSVLine(line); const obj={}; for(let i=0;i<header.length;i++) obj[header[i]]=cols[i]||''; return obj; });

  const deals = JSON.parse(fs.readFileSync(DEALS,'utf8'));
  const byId = Object.fromEntries(deals.map(d=>[d.id,d]));

  const toApply = rows.filter(r=>{
    const mt = (r.matchType||'').toLowerCase();
    return (r.candidateId && (mt==='host' || mt==='id'));
  });

  const report = [];

  for(const r of toApply){
    const id = r.candidateId;
    const logoURL = (r.logoURL||'').replace(/^"|"$/g,'');
    if(!id){ report.push({ id:null, status:'no-id' }); continue; }
    const deal = byId[id];
    if(!deal){ report.push({ id, status:'no-deal' }); continue; }

    if(!logoURL){ report.push({ id, status:'no-logo-url' }); continue; }

    console.log('Applying', id, 'from', logoURL);
    // probe
    const head = await probeHead(logoURL);
    const ext = head ? extFromContentType(head.ct) : (path.extname(logoURL).split('.').pop()||'png');
    const filename = `${id}.${ext}`;
    const outPath = path.join(ASSETS, filename);
    const res = await download(logoURL, outPath);
    if(res.ok){
      deal.logo = `/assets/logos/${filename}`;
      report.push({ id, status:'downloaded', path: deal.logo });
    } else {
      report.push({ id, status:'download_failed', reason: res.error || res.status });
    }
  }

  // backup and write deals.json
  const bak = DEALS + '.bak.' + Date.now();
  fs.copyFileSync(DEALS, bak);
  fs.writeFileSync(DEALS, JSON.stringify(Object.values(byId), null, 2), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify({ ts: new Date().toISOString(), backup: bak, applied: report }, null, 2));
  console.log('Done. Backup:', bak, 'Report:', REPORT);
}

main().catch(e=>{ console.error(e); process.exit(1); });
