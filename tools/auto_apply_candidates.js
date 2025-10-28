#!/usr/bin/env node
// Read placeholders-to-fill-suggestions.csv and try to auto-fill missing suggested_link
// Writes small-apply-auto.csv with columns id,current_link,new_link for candidates found

const fs = require('fs');
const path = require('path');

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const out = [];
  for(let i=1;i<lines.length;i++){
    const raw = lines[i];
    const cols = [];
    let field = '';
    let inQuote = false;
    for(let j=0;j<raw.length;j++){
      const ch = raw[j];
      const next = raw[j+1];
      if(ch === '"'){
        if(inQuote && next === '"'){ field += '"'; j++; continue; }
        inQuote = !inQuote; continue;
      }
      if(ch === ',' && !inQuote){ cols.push(field); field=''; continue; }
      field += ch;
    }
    cols.push(field);
    const row = {};
    for(let k=0;k<headers.length;k++) row[headers[k]] = (cols[k]||'').trim().replace(/^"|"$/g,'');
    out.push(row);
  }
  return out;
}

async function fetchUrl(url){
  try{
    const res = await fetch(url,{ headers: { 'User-Agent': 'student-discounts-bot/1.0' } });
    const text = await res.text();
    return { url, text };
  }catch(e){ return { url, error: String(e) }; }
}

function extractUddg(text){
  const m = text.match(/duckduckgo\.com\/l\/\?uddg=([^"'&>\s]+)/i);
  if(!m) return null;
  try{ return decodeURIComponent(m[1]); }catch(e){ return null; }
}

function extractHttpCandidates(text){
  const urls = [];
  const re = /https?:\/\/[^"'<>\s]+/ig;
  let m;
  while((m = re.exec(text))){
    const u = m[0].replace(/&amp;/g,'&');
    urls.push(u);
  }
  return urls;
}

function chooseCandidate(urls, title, retailer){
  if(!urls || urls.length===0) return null;
  const blacklist = [/facebook\.com/,/instagram\.com/,/twitter\.com/,/maps\.google/,/google\.com\/maps/,/youtube\.com/,/tiktok\.com/,/duckduckgo\.com/,/bing\.com/];
  const preferKeywords = (s)=>{
    const low = s.toLowerCase();
    const t = (title||'').toLowerCase();
    const r = (retailer||'').toLowerCase();
    // prefer URLs that contain part of title or retailer
    if(t && t.split(/\s+/).some(w=>w.length>3 && low.includes(w))) return 2;
    if(r && r.split(/\s+/).some(w=>w.length>3 && low.includes(w))) return 2;
    // prefer https
    if(low.startsWith('https://')) return 1;
    return 0;
  };
  // filter blacklist
  const filtered = urls.filter(u=>{
    try{ const urlObj = new URL(u); const host = urlObj.hostname.toLowerCase();
      if(blacklist.some(rx=>rx.test(host))) return false; return true;
    }catch(e){ return false; }
  });
  if(filtered.length===0) return null;
  // score and pick highest
  let best = filtered[0]; let bestScore = -1;
  for(const u of filtered){
    const score = preferKeywords(u);
    if(score > bestScore){ bestScore = score; best = u; }
  }
  return best;
}

async function main(){
  const repoRoot = process.cwd();
  const suggestPath = path.join(repoRoot,'placeholders-to-fill-suggestions.csv');
  if(!fs.existsSync(suggestPath)){ console.error('Suggestions CSV not found:', suggestPath); process.exit(1); }
  const text = fs.readFileSync(suggestPath,'utf8');
  const rows = parseCSV(text);
  if(rows.length===0){ console.error('No rows in suggestions'); process.exit(1); }

  const out = [];
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    const id = r.id || r.ID || '';
    const title = r.title || '';
    const current = r.current_link || '';
    const suggested = r.suggested_link || '';
    const source = r.source || '';
    process.stdout.write(`Processing (${i+1}/${rows.length}): ${id} - ${title}\n`);
    if(suggested && suggested.trim().length>0){
      // already suggested, skip
      await new Promise(res=>setTimeout(res,200));
      continue;
    }
    // attempt to fetch the DuckDuckGo source URL if present, otherwise do a fresh search
    let page = null;
    if(source && source.includes('duckduckgo.com')){
      page = await fetchUrl(source);
    }else{
      const q = encodeURIComponent((title + ' ' + (r.retailer||'') + ' Sydney').trim());
      const url = 'https://duckduckgo.com/html?q=' + q;
      page = await fetchUrl(url);
    }
    let found = null; let note = '';
    if(page.error){ note = 'fetch error: '+page.error; }
    else{
      // try uddg redirect first
      const uddg = extractUddg(page.text);
      if(uddg) { found = uddg; note = 'uddg'; }
      else{
        const cands = extractHttpCandidates(page.text);
        const pick = chooseCandidate(cands, title, r.retailer||'');
        if(pick){ found = pick; note = 'direct'; }
        else note = 'no-candidate';
      }
    }
    if(found){
      out.push({ id, current, new_link: found, confidence: note });
      process.stdout.write(`  -> Found: ${found} (${note})\n`);
    }else{
      process.stdout.write(`  -> No candidate (${note})\n`);
    }
    // polite delay
    await new Promise(res=>setTimeout(res,600));
  }

  if(out.length===0){ console.log('No candidates found to auto-apply.'); process.exit(0); }

  const csvPath = path.join(repoRoot,'small-apply-auto.csv');
  const hdr = 'id,current_link,new_link\r\n';
  const lines = out.map(o=> `${o.id},"${o.current}","${o.new_link}"\r\n`).join('');
  fs.writeFileSync(csvPath, hdr + lines, 'utf8');
  console.log('\nWrote', csvPath, 'with', out.length, 'candidates');
}

main().catch(e=>{ console.error(e); process.exit(1); });
