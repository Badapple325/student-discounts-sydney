#!/usr/bin/env node
// Generate suggested links for placeholders by running a DuckDuckGo HTML search per row.
// Usage: node tools/auto_fill_suggestions.js [placeholders-to-fill.csv]

const fs = require('fs');
const path = require('path');

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const out = [];
  for(let i=1;i<lines.length;i++){
    const cols = [];
    let field = '';
    let inQuote = false;
    const raw = lines[i];
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

async function fetchSearch(query){
  const url = 'https://duckduckgo.com/html?q=' + encodeURIComponent(query + ' Sydney');
  try{
    const res = await fetch(url, { headers: { 'User-Agent': 'student-discounts-bot/1.0' } });
    const text = await res.text();
    return { url, text };
  }catch(e){ return { url, error: String(e) }; }
}

function extractFirstUddg(text){
  // find first duckduckgo uddg link and decode it
  const m = text.match(/duckduckgo\.com\/l\/\?uddg=([^"'&>\s]+)/i);
  if(!m) return null;
  try{ return decodeURIComponent(m[1]); }catch(e){ return null; }
}

function extractFirstHttp(text){
  // Fallback: extract first obvious http(s) URL from HTML results, prefer non-aggregators
  const blacklist = [/facebook\.com/,/twitter\.com/,/instagram\.com/,/tripadvisor\.com/,/yelp\.com/,/google\.com/,/bing\.com/,/duckduckgo\.com/,/wikipedia\.org/,/yellowpages/];
  const urls = [];
    // simpler URL extractor (avoid tricky escapes); stops at quote or angle bracket
    const re = /https?:\/\/[^"'<>]+/ig;
  let m;
  while((m = re.exec(text))){
    const u = m[0].replace(/&amp;/g,'&');
    urls.push(u);
  }
  for(const u of urls){
    try{
      const urlObj = new URL(u);
      const host = urlObj.hostname.toLowerCase();
      if(blacklist.some(rx=>rx.test(host))) continue;
      // skip long query redirects from common aggregators
      if(host.includes('search')||host.includes('maps')||host.includes('google')) continue;
      return u;
    }catch(e){ continue; }
  }
  return null;
}

async function main(){
  const repoRoot = process.cwd();
  const csvPath = process.argv[2] || path.join(repoRoot,'placeholders-to-fill.csv');
  if(!fs.existsSync(csvPath)){ console.error('CSV not found:', csvPath); process.exit(1); }
  const csvText = fs.readFileSync(csvPath,'utf8');
  const rows = parseCSV(csvText);
  if(rows.length===0){ console.error('No rows'); process.exit(1); }

  const outRows = [['id','title','current_link','suggested_link','confidence_note','source']];

  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    const id = r.id || r.ID || '';
    const title = r.title || r.Title || r.retailer || '';
    const current = r.current_link || r.currentLink || '';
    if(!id){ console.warn('Skipping row without id at line', i+2); continue; }
    process.stdout.write(`Searching (${i+1}/${rows.length}): ${title}\n`);
    const queries = [];
    const retailer = r.retailer || r.Retailer || '';
    // build a few query variants to improve recall
    queries.push(title);
    if(retailer && retailer.toLowerCase() !== title.toLowerCase()) queries.push(title + ' ' + retailer);
    queries.push(title + ' official site');
    if(retailer) queries.push(retailer + ' official site');

    let suggested = '';
    let note = '';
    let source = '';
    let page = null;
    let found = null;
    for(const q of queries){
      page = await fetchSearch(q);
      source = page.url;
      if(page.error){ note = 'fetch error: '+page.error; continue; }
      // try uddg redirect
      const first = extractFirstUddg(page.text);
      if(first){ found = first; note = 'candidate (uddg)'; break; }
      // fallback: first http URL in HTML that's not an aggregator
      const direct = extractFirstHttp(page.text);
      if(direct){ found = direct; note = 'candidate (direct)'; break; }
      // otherwise continue to next query variant
      await new Promise(r=>setTimeout(r,300));
    }
    if(found) suggested = found; else note = note || 'no candidate found';
    outRows.push([id, title, current, suggested, note, source]);
    // be polite
    await new Promise(r=>setTimeout(r, 700));
  }

  const outPath = path.join(repoRoot,'placeholders-to-fill-suggestions.csv');
  const csvOut = outRows.map(r => r.map(c => '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  fs.writeFileSync(outPath, csvOut, 'utf8');
  console.log('\nWrote suggestions to', outPath);
}

main().catch(e=>{ console.error(e); process.exit(1); });
