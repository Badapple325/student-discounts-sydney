const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname,'..');
const missingCsv = path.join(repoRoot,'tools','tmp','missing-links.csv');
const suggCsv = path.join(repoRoot,'tools','tmp','missing-links-suggestions.csv');
const dealsPath = path.join(repoRoot,'deals.json');
const outCsv = path.join(repoRoot,'tools','tmp','missing-links-appended.csv');

if(!fs.existsSync(missingCsv)){ console.error('missing-links.csv not found'); process.exit(1); }
if(!fs.existsSync(suggCsv)){ console.error('missing-links-suggestions.csv not found'); process.exit(1); }
if(!fs.existsSync(dealsPath)){ console.error('deals.json not found'); process.exit(1); }

function parseQuotedCSV(text){
  // naive but OK for these small CSVs: split lines and extract quoted fields
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').trim());
  const rows = [];
  for(const ln of lines.slice(1)){
    // match quoted fields: "(.*?)"(?:,|$)
    const vals = [];
    let rest = ln;
    while(rest.length){
      rest = rest.trim();
      if(rest[0]==='"'){
        const m = rest.match(/^\"([^\"]*)\"(?:,)?(.*)$/);
        if(!m) break;
        vals.push(m[1]); rest = m[2] || ''; continue;
      } else {
        const m = rest.match(/^([^,]*)(?:,)?(.*)$/);
        if(!m) break;
        vals.push(m[1]); rest = m[2] || ''; continue;
      }
    }
    const obj = {};
    for(let i=0;i<headers.length;i++) obj[headers[i]] = vals[i]||'';
    rows.push(obj);
  }
  return rows;
}

const missing = parseQuotedCSV(fs.readFileSync(missingCsv,'utf8'));
const suggLines = fs.readFileSync(suggCsv,'utf8').split(/\r?\n/).filter(Boolean).slice(1);
const suggMap = {};
for(const line of suggLines){
  const parts = line.split(',');
  const id = parts[0];
  const url = parts[2];
  const ok = parts[4] && parts[4].trim().toLowerCase()==='true';
  if(!suggMap[id]) suggMap[id] = [];
  suggMap[id].push({url,ok});
}

const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8'));
const ids = new Set(deals.map(d=>d.id));

function inferUni(notes){
  if(!notes) return 'all';
  const s = notes.toLowerCase();
  if(s.includes('macquarie')) return 'mq';
  if(s.includes('uts')) return 'uts';
  if(s.includes('unsw')) return 'unsw';
  if(s.includes('usyd')) return 'usyd';
  return 'all';
}

const appended = ['id,title,retailer,link,university'];
let added = 0;
for(const row of missing){
  const id = row.id;
  const title = row.title || row.retailer || '';
  const retailer = row.retailer || title;
  const notes = row.notes || '';
  const candidates = suggMap[id] || [];
  let pick = candidates.find(c=>c.ok) || candidates[0] || null;
  if(!pick) { appended.push([id, '"'+title.replace(/"/g,'""')+'"', '"'+retailer.replace(/"/g,'""')+'"', '', inferUni(notes)].join(',')); continue; }
  // ensure unique id
  let nid = id;
  let suffix = 1;
  while(ids.has(nid)){ nid = id + '-' + suffix; suffix++; }
  ids.add(nid);
  const uni = inferUni(notes);
  const newDeal = {
    retailer: retailer,
    category: row.category || 'Food',
    university: uni,
    universityLabel: '',
    description: '',
    link: pick.url,
    how: '',
    code: '',
    id: nid,
    title: title,
    placeholder: false
  };
  deals.push(newDeal);
  appended.push([nid, '"'+title.replace(/"/g,'""')+'"', '"'+retailer.replace(/"/g,'""')+'"', '"'+pick.url.replace(/"/g,'""')+'"', uni].join(','));
  added++;
}

if(added===0){ console.log('No new rows appended (nothing to apply)'); process.exit(0); }

const ts = Date.now();
const bak = dealsPath + '.bak.' + ts;
fs.copyFileSync(dealsPath, bak);
fs.writeFileSync(dealsPath, JSON.stringify(deals,null,2),'utf8');
fs.writeFileSync(outCsv, appended.join('\n'),'utf8');
console.log('Appended', added, 'new deals; backup created:', bak, 'details in', outCsv);
