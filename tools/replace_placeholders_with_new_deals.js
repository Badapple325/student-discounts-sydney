const fs = require('fs');
const path = require('path');

const csvPath = path.join(process.cwd(),'user-supplied-new-deals.csv');
const dealsPath = path.join(process.cwd(),'deals.json');
if(!fs.existsSync(csvPath)){ console.error('user-supplied-new-deals.csv not found'); process.exit(1); }
if(!fs.existsSync(dealsPath)){ console.error('deals.json not found'); process.exit(1); }

const csv = fs.readFileSync(csvPath,'utf8');
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const out=[];
  for(let i=1;i<lines.length;i++){
    const raw = lines[i];
    const cols=[]; let field=''; let inQ=false;
    for(let j=0;j<raw.length;j++){
      const ch = raw[j]; const next = raw[j+1];
      if(ch === '"'){
        if(inQ && next === '"'){ field += '"'; j++; continue; }
        inQ = !inQ; continue;
      }
      if(ch === ',' && !inQ){ cols.push(field); field=''; continue; }
      field += ch;
    }
    cols.push(field);
    const row = {};
    for(let k=0;k<headers.length;k++) row[headers[k]] = (cols[k]||'').trim().replace(/^"|"$/g,'');
    out.push(row);
  }
  return out;
}

const newDeals = parseCSV(csv).filter(r=>r.link && r.link.trim().length>0);
if(newDeals.length === 0){ console.error('No new-deal rows with links found in', csvPath); process.exit(1); }

const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8')||'[]');
const placeholderIdx = deals.map((d,i)=>d.placeholder ? i : -1).filter(i=>i!==-1);
console.log('Found', placeholderIdx.length, 'placeholder entries in deals.json');
console.log('Found', newDeals.length, 'new-deal rows with links');

let applied = 0;
let skipped = 0;
let ndIndex = 0;
for(const idx of placeholderIdx){
  if(ndIndex >= newDeals.length) break;
  const nd = newDeals[ndIndex++];
  if(!nd.link || nd.link.trim()===''){ skipped++; continue; }
  const d = deals[idx];
  // Update fields but keep id the same
  d.retailer = nd.retailer || nd.title || d.retailer;
  d.title = nd.title || d.title;
  d.link = nd.link;
  if(nd.category) d.category = nd.category;
  d.placeholder = false;
  applied++;
  console.log('Replaced placeholder', d.id, 'with', d.title, d.link);
}

const bak = dealsPath + '.bak.' + Date.now();
fs.copyFileSync(dealsPath, bak);
fs.writeFileSync(dealsPath, JSON.stringify(deals,null,2),'utf8');
console.log('Applied', applied, 'replacements, skipped', skipped, '; backup at', bak);
process.exit(0);
