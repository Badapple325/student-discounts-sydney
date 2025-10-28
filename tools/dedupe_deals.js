const fs = require('fs');
const path = require('path');
const url = require('url');
const repo = process.cwd();
const dealsPath = path.join(repo,'deals.json');
if(!fs.existsSync(dealsPath)){ console.error('deals.json missing'); process.exit(1); }
const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8'));

function normalizeTitle(t){ return (t||'').toLowerCase().replace(/[^a-z0-9\s]+/g,' ').split(/\s+/).filter(Boolean); }
function jaccard(a,b){ const A=new Set(a); const B=new Set(b); const inter=[...A].filter(x=>B.has(x)).length; const uni=[...new Set([...A,...B])].length; return uni===0?0:inter/uni; }
function hostnameOf(l){ try{ const h = new URL(l).hostname.replace(/^www\./,''); return h; }catch(e){ return ''; } }

// parse args
const argv = process.argv.slice(2);
let minSim = 0.6;
for(const a of argv){ if(a.startsWith('--min-sim=')){ const v = parseFloat(a.split('=')[1]); if(!isNaN(v)) minSim = v; } }

// group by hostname
const byHost = {};
for(let i=0;i<deals.length;i++){ const d=deals[i]; const h = hostnameOf(d.link||''); if(!byHost[h]) byHost[h]=[]; byHost[h].push({idx:i, id:d.id, title:d.title, link:d.link}); }

const suggestions = [];
for(const h of Object.keys(byHost)){
  const list = byHost[h];
  if(list.length<2) continue;
  // compare pairs
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const a = normalizeTitle(list[i].title||list[i].id||'');
      const b = normalizeTitle(list[j].title||list[j].id||'');
      const sim = jaccard(a,b);
      if(sim >= minSim){
        suggestions.push({host:h, idA:list[i].id, idB:list[j].id, titleA:list[i].title, titleB:list[j].title, linkA:list[i].link, linkB:list[j].link, sim});
      }
    }
  }
}

const outDir = path.join(repo,'tools','tmp'); if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});
const previewPath = path.join(outDir,'dedupe-suggestions.csv');
const lines = ['canonical_id,duplicate_id,canonical_title,duplicate_title,canonical_link,duplicate_link,similarity'];
for(const s of suggestions){ lines.push([s.idA,s.idB, '"'+s.titleA.replace(/"/g,'""')+'"','"'+s.titleB.replace(/"/g,'""')+'"', '"'+(s.linkA||'').replace(/"/g,'""')+'"','"'+(s.linkB||'').replace(/"/g,'""')+'"', s.sim.toFixed(2)].join(',')); }
fs.writeFileSync(previewPath, lines.join('\n'),'utf8');
console.log('Wrote dedupe preview to', previewPath, '- candidate pairs:', suggestions.length);

if(process.argv.includes('--apply')){
  if(suggestions.length===0){ console.log('No suggestions to apply.'); process.exit(0); }
  // apply conservative merges: for each pair, keep the earlier index (lower idx) as canonical
  const toRemoveIdx = new Set();
  const mapping = [];
  for(const s of suggestions){
    const idxA = deals.findIndex(d=>d.id===s.idA);
    const idxB = deals.findIndex(d=>d.id===s.idB);
    if(idxA===-1||idxB===-1) continue;
    const keep = Math.min(idxA, idxB);
    const remove = (keep===idxA)? idxB : idxA;
    if(toRemoveIdx.has(remove)) continue; // already removed
    toRemoveIdx.add(remove);
    mapping.push({keep:deals[keep].id, remove:deals[remove].id});
  }
  if(toRemoveIdx.size===0){ console.log('Nothing to remove after conservative checks.'); process.exit(0); }
  const bak = dealsPath + '.bak.' + Date.now(); fs.copyFileSync(dealsPath,bak);
  // remove by descending index to avoid reindexing issues
  const removes = Array.from(toRemoveIdx).sort((a,b)=>b-a);
  for(const idx of removes){ console.log('Removing duplicate', deals[idx].id); deals.splice(idx,1); }
  fs.writeFileSync(dealsPath, JSON.stringify(deals,null,2),'utf8');
  const appliedPath = path.join(outDir,'dedupe-applied.csv');
  fs.writeFileSync(appliedPath, mapping.map(m=>m.keep+','+m.remove).join('\n'),'utf8');
  console.log('Applied merges. Backup at', bak, 'Applied mapping written to', appliedPath);
}
