#!/usr/bin/env node
// Small CSV->deals.json import tool
// Usage: node tools/import_deals.js path/to/new-deals.csv --merge

const fs = require('fs');
const path = require('path');

function slugify(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function parseSimpleCSV(text){
  // More robust CSV parser that supports quoted fields, escaped quotes ("") and newlines inside quotes.
  // This is intentionally dependency-free and covers common CSV exports.
  const rows = [];
  let cur = '';
  let inQuote = false;
  let field = '';
  const record = [];
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    const next = text[i+1];
    if(ch === '"'){
      if(inQuote && next === '"'){ // escaped quote
        field += '"';
        i++; // skip next
        continue;
      }
      inQuote = !inQuote;
      continue;
    }
    if(ch === ',' && !inQuote){
      record.push(field);
      field = '';
      continue;
    }
    if((ch === '\n' || (ch === '\r' && next === '\n')) && !inQuote){
      // end of record
      if(ch === '\r' && next === '\n') i++; // skip LF after CR
      record.push(field);
      rows.push(record.slice());
      record.length = 0;
      field = '';
      continue;
    }
    field += ch;
  }
  // push last
  if(field.length>0 || record.length>0){ record.push(field); rows.push(record); }

  if(rows.length === 0) return [];
  // trim possible leading/trailing empty header cells and normalize headers
  const headers = rows[0].map(h=>String(h||'').trim().replace(/^"|"$/g,''));
  const out = [];
  for(let r=1;r<rows.length;r++){
    const rowArr = rows[r];
    // skip empty rows
    if(rowArr.every(c => String(c||'').trim().length===0)) continue;
    const row = {};
    for(let j=0;j<headers.length;j++){
      row[headers[j]] = String((rowArr[j]||'')).trim().replace(/^"|"$/g,'');
    }
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
  const warnings = [];
  const seenIds = new Set((function getExistingIds(){
    try{
      const f = path.join(process.cwd(),'deals.json');
      if(fs.existsSync(f)){
        const j = JSON.parse(fs.readFileSync(f,'utf8')||'[]');
        return j.map(x=>x.id).filter(Boolean);
      }
    }catch(e){}
    return [];
  })());
  for(const r of rows){
    const retailer = r.title || r.Title || r.retailer || r.Retailer || '';
    const title = r.title || r.Title || '';
    const link = (r.link || r.Link || '').trim();
    if(!retailer && !title){
      // skip rows missing both primary identifiers but collect a warning
      warnings.push({row: r, reason: 'missing retailer/title'});
      continue;
    }
    const item = {
      title: title || retailer,
      retailer: retailer || title,
      category: r.category || r.Category || 'services',
      university: r.university || r.University || 'all',
      universityLabel: r.universityLabel || r.UniversityLabel || r.university_label || '',
      description: r.description || r.Description || '',
      link: link || '',
      how: r.how || r.How || '',
      code: r.code || r.Code || ''
    };
    // placeholder detection
    item.placeholder = (!item.link || /example\.com/i.test(item.link));
    // generate slug/id from title or retailer
    let baseId = slugify(item.title || item.retailer || item.link || Math.random().toString(36).slice(2,8));
    let uniqueId = baseId;
    let suffix = 1;
    while(seenIds.has(uniqueId)){
      uniqueId = `${baseId}-${suffix++}`;
    }
    seenIds.add(uniqueId);
    item.id = r.id || r.ID || uniqueId;
    // basic URL validation
    if(item.link && !/^https?:\/\//i.test(item.link)) warnings.push({row: r, reason: 'link missing protocol', link: item.link});
    if(item.placeholder) warnings.push({row: r, reason: 'placeholder link or empty'});
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
  if(warnings.length){
    console.warn('\nWarnings during import:');
    warnings.slice(0,20).forEach((w,i)=>{
      console.warn(i+1, '-', w.reason, w.link ? '('+w.link+')' : '');
    });
    if(warnings.length>20) console.warn('and', warnings.length-20, 'more warnings...');
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
