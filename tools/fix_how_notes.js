const fs = require('fs');
const path = require('path');

const repo = process.cwd();
const dealsPath = path.join(repo,'deals.json');
const outDir = path.join(repo,'tools','tmp');
if(!fs.existsSync(dealsPath)){ console.error('deals.json missing'); process.exit(1); }
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8'));

// build canonical how map by title: prefer non-placeholder entries and entries with id ending -1
const byTitle = {};
for(const d of deals){
  const t = (d.title||'').trim();
  if(!t) continue;
  if(!byTitle[t]) byTitle[t]=[];
  if(d.how && d.how.trim()) byTitle[t].push({how:d.how.trim(), placeholder:!!d.placeholder, id:d.id});
}

const canonical = {};
for(const t of Object.keys(byTitle)){
  const arr = byTitle[t];
  if(arr.length===0) continue;
  // prefer an entry where id ends with -1
  let pick = arr.find(x=>/[-_]1$/.test(x.id));
  if(!pick) pick = arr.find(x=>!x.placeholder) || arr[0];
  canonical[t] = pick.how;
}

// suspicious phrases that look misplaced (gym/workshop/drop-off/check-in counters etc.)
const suspicious = [
  'gym', 'desk', 'drop-off', 'haircut', 'show student id at counter', 'show student concession card', 'book online and mention student discount', 'day pass', 'check-in', 'at check-in', 'drop-off', 'book online', 'show student id on arrival'
].map(s=>s.toLowerCase());

function hostnameOf(link){ try{ return new URL(link).hostname.replace(/^www\./,''); }catch(e){ return ''; } }

const domainTemplates = {
  'adobe.com': "Register with your student email on Adobe's student offers page.",
  'apple.com': "Verify with your student/education account on Apple's education store.",
  'microsoft.com': "Use your student email to verify on the Microsoft Store for Education.",
  'spotify.com': "Verify student status on Spotify Student page.",
  'samsung.com': "Follow Samsung's student offer page and verify with your student email.",
  'studentedge.org': "Visit the Student Edge deal page and sign in/verify as instructed.",
  'theiconic.com.au': "Verify with student email or upload student ID on The Iconic's student page.",
  'cottonon.com': "Verify with student email on Cotton On's student offers.",
};

const changes = [];
for(let i=0;i<deals.length;i++){
  const d = deals[i];
  const cur = (d.how||'').trim();
  if(!cur) continue;
  const curLower = cur.toLowerCase();
  const hasSusp = suspicious.some(p=>curLower.includes(p));
  if(!hasSusp) continue;
  const domain = hostnameOf(d.link||'');
  let replacement = '';
  for(const k of Object.keys(domainTemplates)){
    if(domain.includes(k)) { replacement = domainTemplates[k]; break; }
  }
  if(!replacement){
    // fall back to a safe generic replacement
    replacement = 'Verify student status on the retailer\'s student offers page (register with student email or upload student ID).';
  }
  if(cur === replacement) continue;
  changes.push({id:d.id,title:d.title||'',old:cur,new:replacement});
  deals[i].how = replacement;
}

if(changes.length===0){ console.log('No suspicious how notes found to fix.'); process.exit(0); }

const bak = dealsPath + '.bak.' + Date.now(); fs.copyFileSync(dealsPath,bak);
fs.writeFileSync(dealsPath, JSON.stringify(deals,null,2),'utf8');
const outCsv = path.join(outDir,'how-fixes.csv');
const lines = ['id,title,old,new'];
for(const c of changes){ lines.push([c.id,'"'+(c.title||'').replace(/"/g,'""')+'"','"'+(c.old||'').replace(/"/g,'""')+'"','"'+(c.new||'').replace(/"/g,'""')+'"'].join(',')); }
fs.writeFileSync(outCsv, lines.join('\n'),'utf8');
console.log('Applied', changes.length, 'how-note fixes. Backup at', bak, 'details at', outCsv);

for(const c of changes.slice(0,40)){
  console.log(c.id,'|',c.title,'|',c.old,'->',c.new);
}

process.exit(0);
