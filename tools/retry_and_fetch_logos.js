#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const ROOT = path.join(__dirname, '..');
const QA = path.join(__dirname, 'tmp', 'logo-qa.csv');
const DEALS = path.join(ROOT, 'deals.json');
const ASSETS_DIR = path.join(ROOT, 'assets', 'logos');
const REPORT = path.join(__dirname, 'tmp', 'retry-logo-report.json');

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

function httpGet(urlStr, opts={}){
  return new Promise((resolve) => {
    try{
      const urlObj = new URL(urlStr);
      const lib = urlObj.protocol === 'http:' ? http : https;
      const req = lib.get(urlStr, opts, (res) => {
        const chunks = [];
        res.on('data', c=>chunks.push(c));
        res.on('end', ()=>{
          const buf = Buffer.concat(chunks);
          resolve({ ok: true, status: res.statusCode, headers: res.headers, body: buf });
        });
      });
      req.on('error', (e)=> resolve({ ok:false, error: String(e) }));
      req.setTimeout(10000, ()=>{ req.abort(); resolve({ ok:false, error:'timeout' }); });
    }catch(e){ resolve({ ok:false, error: String(e) }); }
  });
}

function extFromContentType(ct, fallbackUrl){
  if(!ct) ct = '';
  ct = ct.toLowerCase();
  if(ct.includes('svg')) return 'svg';
  if(ct.includes('png')) return 'png';
  if(ct.includes('jpeg')||ct.includes('jpg')) return 'jpg';
  if(fallbackUrl){
    const m = fallbackUrl.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    if(m) return m[1].toLowerCase();
  }
  return 'png';
}

function saveBuffer(buf, out){
  fs.writeFileSync(out, buf);
}

function candidateClearbit(host){
  if(!host) return null;
  return `https://logo.clearbit.com/${host}?size=128`;
}

function findOgImage(html){
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]+name=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  return m? m[1] : null;
}
function findIconLink(html){
  const m = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*href=["']([^"']+)["']/i);
  return m? m[1] : null;
}

async function tryDownloadUrl(url, headers){
  const opts = { headers };
  const res = await httpGet(url, opts);
  if(!res.ok) return { ok:false, reason: res.error };
  if(res.status !== 200) return { ok:false, reason: res.status };
  const ct = (res.headers['content-type'] || '') + '';
  return { ok:true, buf: res.body, ct };
}

function normalizeUrl(u, base){
  if(!u) return null;
  try{ return new URL(u, base).toString(); }catch(e){ return null; }
}

async function main(){
  if(!fs.existsSync(QA)){ console.error('QA CSV not found at', QA); process.exit(1); }
  if(!fs.existsSync(DEALS)){ console.error('deals.json not found at', DEALS); process.exit(1); }

  const qaRaw = fs.readFileSync(QA,'utf8');
  const rows = parseCsv(qaRaw);
  const deals = JSON.parse(fs.readFileSync(DEALS,'utf8'));
  const byId = Object.fromEntries(deals.map(d=>[d.id, d]));

  const report = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
  };

  for(const r of rows){
    const id = r.id;
    const d = byId[id] || {};
    const retailer = d.retailer || d.title || r.retailer || '';
    const attempts = [];
    let saved = false;

    // 1) if dryrun_logoURL exists, try with headers
    const dry = (r.dryrun_logoURL || '').trim();
    if(dry){
      try{
        const res = await tryDownloadUrl(dry, headers);
        if(res.ok){
          const ext = extFromContentType(res.ct, dry);
          const filename = `${id}.${ext}`;
          const out = path.join(ASSETS_DIR, filename);
          saveBuffer(res.buf, out);
          d.logo = `/assets/logos/${filename}`;
          report.push({ id, retailer, method: 'dryrun_logoURL', status:'downloaded', src: dry, content_type: res.ct, path: d.logo });
          saved = true;
          continue; // next row
        }else{
          attempts.push({ method:'dryrun_logoURL', url: dry, result: res.reason || res.status });
        }
      }catch(e){ attempts.push({ method:'dryrun_logoURL', url: dry, result: String(e) }); }
    }

    // Helper: get host from deal link
    const link = d.link || r.candidate_url || '';
    let host = null;
    try{ if(link){ host = new URL(link).hostname.replace(/^www\./,''); } }catch(e){ /* ignore */ }

    // 2) Try clearbit for host and host without subdomain
    if(host){
      const candidates = [candidateClearbit(host)];
      // try stripping to registered domain (last two labels)
      const parts = host.split('.');
      if(parts.length > 2){ const dom = parts.slice(-2).join('.'); if(dom !== host) candidates.push(candidateClearbit(dom)); }
      for(const c of candidates){
        if(!c) continue;
        try{
          const res = await tryDownloadUrl(c, headers);
          if(res.ok){ const ext = extFromContentType(res.ct, c); const filename = `${id}.${ext}`; const out = path.join(ASSETS_DIR, filename); saveBuffer(res.buf, out); d.logo = `/assets/logos/${filename}`; report.push({ id, retailer, method:'clearbit', status:'downloaded', src: c, content_type: res.ct, path: d.logo }); saved = true; break; }
          else attempts.push({ method:'clearbit', url: c, result: res.reason || res.status });
        }catch(e){ attempts.push({ method:'clearbit', url: c, result: String(e) }); }
      }
      if(saved) continue;
    }

    // 3) Try fetching the site's HTML to look for og:image or icon
    if(link){
      try{
        const pageRes = await httpGet(link, { headers });
        if(pageRes.ok && pageRes.status === 200){
          const html = pageRes.body.toString('utf8');
          const og = findOgImage(html);
          const icon = findIconLink(html);
          const candidates = [og, icon].map(u => normalizeUrl(u, link)).filter(Boolean);
          for(const c of candidates){
            try{
              const res = await tryDownloadUrl(c, headers);
              if(res.ok){ const ext = extFromContentType(res.ct, c); const filename = `${id}.${ext}`; const out = path.join(ASSETS_DIR, filename); saveBuffer(res.buf, out); d.logo = `/assets/logos/${filename}`; report.push({ id, retailer, method:'site-probe', status:'downloaded', src: c, content_type: res.ct, path: d.logo }); saved = true; break; }
              else attempts.push({ method:'site-probe', url: c, result: res.reason || res.status });
            }catch(e){ attempts.push({ method:'site-probe', url: c, result: String(e) }); }
          }
        } else if(pageRes.ok){ attempts.push({ method:'site-probe', url: link, result: pageRes.status }); }
      }catch(e){ attempts.push({ method:'site-probe', url: link, result: String(e) }); }
      if(saved) continue;
    }

    // 4) Try favicon at root
    if(host){
      const favCandidates = [`https://${host}/favicon.ico`, `https://${host}/favicon.png`, `http://${host}/favicon.ico`];
      for(const c of favCandidates){
        try{
          const res = await tryDownloadUrl(c, headers);
          if(res.ok){ const ext = extFromContentType(res.ct, c); const filename = `${id}.${ext}`; const out = path.join(ASSETS_DIR, filename); saveBuffer(res.buf, out); d.logo = `/assets/logos/${filename}`; report.push({ id, retailer, method:'favicon', status:'downloaded', src: c, content_type: res.ct, path: d.logo }); saved = true; break; }
          else attempts.push({ method:'favicon', url: c, result: res.reason || res.status });
        }catch(e){ attempts.push({ method:'favicon', url: c, result: String(e) }); }
      }
      if(saved) continue;
    }

    // 5) give up for now; record attempts
    report.push({ id, retailer, method:'none', status:'not-found', attempts });
  }

  // write backup and updated deals.json
  const bak = DEALS + '.bak.' + Date.now();
  fs.copyFileSync(DEALS, bak);
  fs.writeFileSync(DEALS, JSON.stringify(Object.values(byId), null, 2), 'utf8');
  fs.writeFileSync(REPORT, JSON.stringify({ ts: new Date().toISOString(), backup: bak, report }, null, 2));
  console.log('Finished. Backup:', bak, 'Report:', REPORT);
}

main().catch(e=>{ console.error(e); process.exit(1); });
