const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'small-apply-next10-filtered.csv');
if(!fs.existsSync(p)){ console.error('missing',p); process.exit(1); }
const t = fs.readFileSync(p,'utf8');
const lines = t.split(/\r?\n/).filter(l=>l.trim().length>0);
console.log('lines', lines.length);
const headers = lines[0].split(',').map(h=>h.trim());
console.log('headers', headers);
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
  console.log('row', i, cols.length, cols);
}
