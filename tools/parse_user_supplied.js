const fs = require('fs');
const path = require('path');

function slugify(s){
  return (s||'').toString().toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[\s\/_,:\.]+/g,'-')
    .replace(/[^a-z0-9\-]/g,'')
    .replace(/-+/g,'-')
    .replace(/^-|-$/g,'');
}

const repo = process.cwd();
const inFile = process.argv[2] || path.join(repo,'user_block1.csv');
if(!fs.existsSync(inFile)){ console.error('input not found', inFile); process.exit(1); }
const text = fs.readFileSync(inFile,'utf8').split(/\r?\n/).filter(Boolean);
const header = text.shift().split(',').map(h=>h.trim());
const rows = text.map(line=>{
  // naive CSV split on commas (user provided simple CSV)
  const parts = line.split(',');
  return {
    brand: parts[0] || '',
    desc: parts[1] || '',
    category: parts[2] || '',
    redemption: parts[3] || '',
    location: parts[4] || '',
    url: parts.slice(5).join(',') || ''
  }
});

const dealsFile = path.join(repo,'deals.json');
const deals = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]');

const outRows = [['id','current_link','new_link','confidence_note','source']];
const newDeals = [['id','title','retailer','link','category','notes']];

for(const r of rows){
  const brand = (r.brand||'').trim();
  if(!brand) continue;
  let newLink = (r.url||'').trim();
  if(newLink && !/^https?:\/\//i.test(newLink)) newLink = 'https://'+newLink;
  const slug = slugify(brand);
  // try exact id, id-1, or matching retailer/title
  let match = deals.find(d => (d.id||'').toLowerCase() === slug || (d.id||'').toLowerCase() === slug+'-1');
  if(!match){
    match = deals.find(d => ((d.retailer||'').toLowerCase()||'').includes(brand.toLowerCase()) || ((d.title||'').toLowerCase()||'').includes(brand.toLowerCase()));
  }
  let id;
  let current='';
  if(match){ id = match.id; current = match.link || ''; }
  else {
    // create a new id but don't modify deals.json yet
    id = slug + '-1';
    current = '';
    newDeals.push([id, brand, brand, newLink, r.category || '', r.location || '']);
  }
  outRows.push([id, current, newLink, 'user-supplied', 'user-supplied']);
}

const outPath = path.join(repo,'user-supplied-mappings.csv');
fs.writeFileSync(outPath, outRows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\r\n'), 'utf8');
console.log('Wrote', outPath);
const newDealsPath = path.join(repo,'user-supplied-new-deals.csv');
fs.writeFileSync(newDealsPath, newDeals.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),'utf8');
console.log('Wrote', newDealsPath);
