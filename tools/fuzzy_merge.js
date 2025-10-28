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
const mappingsFile = process.argv[2] || path.join(repo,'user-supplied-mappings.csv');
const newDealsFile = process.argv[3] || path.join(repo,'user-supplied-new-deals.csv');
const dealsFile = path.join(repo,'deals.json');

if(!fs.existsSync(mappingsFile)){ console.error('mappings not found:', mappingsFile); process.exit(1); }
if(!fs.existsSync(dealsFile)){ console.error('deals.json not found'); process.exit(1); }

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length===0) return [];
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

const mappings = parseCSV(fs.readFileSync(mappingsFile,'utf8'));
const newDeals = fs.existsSync(newDealsFile) ? parseCSV(fs.readFileSync(newDealsFile,'utf8')) : [];
const deals = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]');

// build quick lookup by normalized retailer/title
function norm(s){ return (s||'').toString().toLowerCase(); }

const outRows = [['id','current_link','new_link','confidence_note','source']];

for(const m of mappings){
  let id = (m.id||m.ID||'').trim();
  const current = (m.current_link||m.currentLink||m.current||'').trim();
  const newLink = (m.new_link||m.newLink||m.new||'').trim();
  if(!id){ console.log('skip row missing id', m); continue; }
  if(!newLink){ console.log('skip row missing newLink', id); continue; }
  // if id exists as-is, keep
  const exists = deals.find(d => d.id === id);
  if(exists){ outRows.push([id, exists.link||'', newLink, 'user-supplied', 'user-supplied']); continue; }
  // try id without -1
  const alt = id.replace(/-1$/,'');
  const altMatch = deals.find(d => d.id === alt || d.id === alt+'-1');
  if(altMatch){ outRows.push([altMatch.id, altMatch.link||'', newLink, 'fuzzy (id variant)', 'user-supplied']); continue; }
  // try matching by brand/title from newDeals list
  const newDeal = newDeals.find(nd => (nd.id||'') === id);
  const brand = newDeal ? (ndTitle = newDeal.title || newDeal.retailer || '') : '';
  let matched = null;
  if(brand){
    const bnorm = norm(brand);
    matched = deals.find(d => norm(d.retailer).includes(bnorm) || norm(d.title).includes(bnorm) || slugify(d.id).includes(slugify(brand)) );
  }
  // fallback: try matching by slug of id without suffix
  if(!matched){
    const idSlug = slugify(id.replace(/-1$/,''));
    matched = deals.find(d => slugify(d.id).includes(idSlug) || slugify(d.retailer).includes(idSlug) || slugify(d.title).includes(idSlug));
  }
  if(matched){ outRows.push([matched.id, matched.link||'', newLink, 'fuzzy (text match)', 'user-supplied']); continue; }
  // no match — keep original id (will be new deal)
  outRows.push([id, current, newLink, 'user-supplied-new', 'user-supplied']);
}

const outPath = path.join(repo, 'user-supplied-mappings-fuzzy.csv');
fs.writeFileSync(outPath, outRows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),'utf8');
console.log('Wrote', outPath);
