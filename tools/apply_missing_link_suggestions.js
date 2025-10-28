const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname,'..');
const dealsPath = path.join(repoRoot,'deals.json');
const inCsv = path.join(repoRoot,'tools','tmp','missing-links-suggestions.csv');
const outApplied = path.join(repoRoot,'tools','tmp','missing-links-applied.csv');

if(!fs.existsSync(inCsv)){ console.error('suggestions CSV not found:', inCsv); process.exit(1); }
if(!fs.existsSync(dealsPath)){ console.error('deals.json not found'); process.exit(1); }

const csv = fs.readFileSync(inCsv,'utf8').split(/\r?\n/).filter(Boolean).slice(1);
const suggestions = {};
for(const line of csv){
  // id,title,candidate_url,status,ok,error
  const parts = line.split(',');
  const id = parts[0];
  const url = parts[2];
  const ok = parts[4] && parts[4].trim().toLowerCase() === 'true';
  if(ok) suggestions[id] = url;
}

if(Object.keys(suggestions).length===0){ console.log('No OK suggestions to apply'); process.exit(0); }

const ts = Date.now();
const bak = dealsPath + '.bak.' + ts;
fs.copyFileSync(dealsPath, bak);
console.log('Backed up deals.json ->', bak);

const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8'));
const applied = ['id,old_link,new_link'];
let changed = 0;
for(const d of deals){
  if(suggestions[d.id]){
    const old = d.link || '';
    const nw = suggestions[d.id];
    if(old !== nw){
      d.link = nw;
      applied.push([d.id, '"'+old.replace(/"/g,'""')+'"', '"'+nw.replace(/"/g,'""')+'"'].join(','));
      changed++;
    }
  }
}

if(changed===0){ console.log('No changes applied (links already matched)'); process.exit(0); }

fs.writeFileSync(dealsPath, JSON.stringify(deals,null,2),'utf8');
fs.writeFileSync(outApplied, applied.join('\n'),'utf8');
console.log('Applied', changed, 'link updates; wrote', outApplied);
