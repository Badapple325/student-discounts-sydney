const fs = require('fs');
const path = require('path');

const csvPath = path.join(process.cwd(),'user-supplied-new-deals.csv');
const dealsPath = path.join(process.cwd(),'deals.json');
const outDir = path.join(process.cwd(),'tools','tmp');
if(!fs.existsSync(csvPath)){ console.error('user-supplied-new-deals.csv not found'); process.exit(1); }
if(!fs.existsSync(dealsPath)){ console.error('deals.json not found'); process.exit(1); }
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

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

const rows = parseCSV(csv);
const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8')||'[]');
const existingIds = new Set(deals.map(d=>d.id));

const rowsWithLinks = [];
const rowsMissingLinks = [];
for(const r of rows){
  const link = (r.link || '').trim();
  if(!link) rowsMissingLinks.push(r); else rowsWithLinks.push(r);
}

let appended = 0;
let skippedExisting = 0;

for(const r of rowsWithLinks){
  // normalize id
  let id = (r.id || r.ID || '').trim();
  if(!id){
    // build slug from title
    const base = (r.title || r.retailer || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    id = base || ('new-deal-' + Date.now());
  }
  if(!id.endsWith('-1')) id = id + '-1';
  if(existingIds.has(id)){
    skippedExisting++;
    continue;
  }
  const newDeal = {
    retailer: r.retailer || r.title || '',
    category: r.category || 'all',
    university: r.university || 'all',
    universityLabel: '',
    description: r.notes || '',
    link: r.link,
    how: r.how || '',
    code: r.code || '',
    id: id,
    title: r.title || r.retailer || '',
    placeholder: false
  };
  deals.push(newDeal);
  existingIds.add(id);
  appended++;
}

// write missing links CSV into tools/tmp
const missingPath = path.join(outDir,'missing-links.csv');
if(rowsMissingLinks.length > 0){
  const hdrs = Object.keys(rowsMissingLinks[0]);
  const lines = [hdrs.map(h=>`"${h}"`).join(',')];
  for(const r of rowsMissingLinks){
    const vals = hdrs.map(h => `"${(r[h]||'').replace(/"/g,'""')}"`);
    // escape double quotes properly
    lines.push(vals.join(','));
  }
  fs.writeFileSync(missingPath, lines.join('\n'),'utf8');
}

const bak = dealsPath + '.bak.' + Date.now();
fs.copyFileSync(dealsPath,bak);
fs.writeFileSync(dealsPath, JSON.stringify(deals,null,2),'utf8');

console.log('Appended', appended, 'new deals, skippedExisting:', skippedExisting, 'missingLinks:', rowsMissingLinks.length);
console.log('Backup created at', bak);
if(rowsMissingLinks.length>0) console.log('Missing-link rows saved to', missingPath);
process.exit(0);
