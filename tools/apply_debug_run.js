const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), process.argv[2] || 'small-apply-next10-filtered.csv');
if(!fs.existsSync(p)){ console.error('Mapping CSV not found:', p); process.exit(1); }
const csv = fs.readFileSync(p,'utf8');
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const out = [];
  for(let i=1;i<lines.length;i++){
    const raw = lines[i];
    const cols = []; let field=''; let inQuote=false;
    for(let j=0;j<raw.length;j++){
      const ch = raw[j]; const next = raw[j+1];
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
const mappings = parseCSV(csv);
console.log('Parsed mappings:', mappings.length);
const dealsFile = path.join(process.cwd(),'deals.json');
if(!fs.existsSync(dealsFile)){ console.error('deals.json not found'); process.exit(1); }
const deals = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]');
let changes = [];
for(const m of mappings){
  const id = m.id || m.ID || '';
  const newLink = (m.new_link || m.current_link || m.newLink || '').trim();
  if(!id){ console.log('skip row missing id', m); continue; }
  if(!newLink){ console.log('skip row missing newLink', id); continue; }
  const idx = deals.findIndex(d => d.id === id);
  if(idx === -1){ console.log('id not found in deals.json:', id); continue; }
  const old = deals[idx].link || '';
  if(old === newLink){ console.log('already matches, skipping:', id, old); continue; }
  changes.push({id, old, new: newLink, idx});
}
if(changes.length === 0){ console.log('No changes detected'); process.exit(0); }
console.log('Planned changes:', changes.length);
for(const c of changes) console.log('-', c.id, c.old, '=>', c.new);
if(process.argv.includes('--apply')){
  const bak = dealsFile + '.bak.' + Date.now(); fs.copyFileSync(dealsFile,bak);
  for(const c of changes) deals[c.idx].link = c.new;
  fs.writeFileSync(dealsFile, JSON.stringify(deals,null,2),'utf8');
  console.log('Applied', changes.length, 'changes; backed up to', bak);
} else {
  console.log('Dry-run mode (no file changes). To apply, re-run with --apply flag.');
}
