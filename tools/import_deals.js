#!/usr/bin/env node
// Small CSV->deals.json import tool
// Usage: node tools/import_deals.js path/to/new-deals.csv --merge

const fs = require('fs');
const path = require('path');

function slugify(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function parseSimpleCSV(text){
  // Simple CSV parser: splits lines, supports quoted fields without embedded quotes
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g, ''));
  const out = [];
  for(let i=1;i<lines.length;i++){
    const raw = lines[i];
    // rudimentary split that respects simple quoted fields
    const fields = [];
    let cur = '';
    let inQuote = false;
    for(let ch of raw){
      if(ch === '"') { inQuote = !inQuote; continue; }
      if(ch === ',' && !inQuote){ fields.push(cur); cur=''; continue; }
      cur += ch;
    }
    fields.push(cur);
    const row = {};
    for(let j=0;j<headers.length;j++){ row[headers[j]] = (fields[j]||'').trim().replace(/^"|"$/g,''); }
    out.push(row);
  }
  return out;
}

async function main(){
  const argv = process.argv.slice(2);
  if(argv.length===0){
    console.error('Usage: node tools/import_deals.js new-deals.csv [--merge]'); process.exit(1);
  }
  const csvPath = argv[0];
  const merge = argv.includes('--merge');
  if(!fs.existsSync(csvPath)) { console.error('CSV not found:', csvPath); process.exit(1); }
  const raw = fs.readFileSync(csvPath,'utf8');
  const rows = parseSimpleCSV(raw);
  const out = [];
  for(const r of rows){
    const retailer = r.retailer || r.Retailer || '';
    if(!retailer) continue;
    const item = {
      retailer: retailer,
      category: r.category || r.Category || 'services',
      university: r.university || r.University || 'all',
      universityLabel: r.universityLabel || r.UniversityLabel || r.university_label || '',
      description: r.description || r.Description || '',
      link: r.link || r.Link || '',
      how: r.how || r.How || '',
      code: r.code || r.Code || ''
    };
    item.id = r.id || slugify(item.retailer || item.link || Math.random().toString(36).slice(2,8));
    out.push(item);
  }

  const dealsFile = path.join(process.cwd(),'deals.json');
  let existing = [];
  if(fs.existsSync(dealsFile)){
    try{ existing = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]'); }catch(e){ existing = []; }
  }
  const merged = merge ? [...existing] : [];

  let added = 0, updated = 0, skipped = 0;
  for(const it of out){
    const idx = merged.findIndex(d => d.id === it.id || (d.retailer && d.retailer.toLowerCase()===it.retailer.toLowerCase()));
    if(idx === -1){ merged.push(it); added++; }
    else { merged[idx] = Object.assign({}, merged[idx], it); updated++; }
  }

  // if not merging, overwrite
  const final = merge ? merged : out;
  // backup
  if(fs.existsSync(dealsFile)){
    const bak = dealsFile + '.bak.' + Date.now(); fs.copyFileSync(dealsFile, bak);
    console.log('Backed up existing deals.json to', bak);
  }
  fs.writeFileSync(dealsFile, JSON.stringify(final, null, 2), 'utf8');
  console.log(`Imported ${out.length} rows -> added:${added} updated:${updated}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
