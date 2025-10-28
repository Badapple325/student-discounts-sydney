#!/usr/bin/env node
// Apply a CSV of id,new_link to update deals.json links
const fs = require('fs');
const path = require('path');

function parseCSV(text){
  // simple parser for id,new_link (no embedded newlines expected)
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

const repoRoot = process.cwd();
const mapCsv = process.argv[2] || path.join(repoRoot,'placeholders-to-fill.csv');
if(!fs.existsSync(mapCsv)){ console.error('Mapping CSV not found:', mapCsv); process.exit(1); }
const mapText = fs.readFileSync(mapCsv,'utf8');
const mappings = parseCSV(mapText);
if(mappings.length === 0){ console.error('No mappings found in CSV'); process.exit(1); }

const dealsFile = path.join(repoRoot,'deals.json');
if(!fs.existsSync(dealsFile)){ console.error('deals.json not found'); process.exit(1); }
const deals = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]');

let updated = 0;
for(const m of mappings){
  const id = m.id || m.ID || ''; const newLink = (m.new_link || m.current_link || m.newLink || '').trim();
  if(!id || !newLink) continue;
  const idx = deals.findIndex(d => d.id === id);
  if(idx === -1) continue;
  // basic validation
  if(!/^https?:\/\//i.test(newLink)) console.warn('Skipping (missing protocol):', id, newLink); else {
    deals[idx].link = newLink;
    // clear placeholder flag
    deals[idx].placeholder = false;
    updated++;
  }
}

if(updated === 0){ console.log('No updates applied'); process.exit(0); }

const bak = dealsFile + '.bak.' + Date.now(); fs.copyFileSync(dealsFile, bak); console.log('Backed up', dealsFile, 'to', bak);
fs.writeFileSync(dealsFile, JSON.stringify(deals,null,2),'utf8');
console.log('Applied', updated, 'link updates to deals.json');
