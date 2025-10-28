const fs = require('fs');
const path = require('path');
const repo = process.cwd();
const mappingsPath = process.argv[2] || path.join(repo,'user-supplied-mappings.csv');
const newDealsPath = path.join(repo,'user-supplied-new-deals.csv');
const dealsPath = path.join(repo,'deals.json');
if(!fs.existsSync(mappingsPath)){ console.error('mappings not found:', mappingsPath); process.exit(1); }
if(!fs.existsSync(dealsPath)){ console.error('deals.json not found'); process.exit(1); }

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  const headers = lines[0].replace(/\uFEFF/g,'').split(',').map(h=>h.replace(/^"|"$/g,'').trim());
  return lines.slice(1).map(l=>{
    const cols = [];
    let field=''; let inQuote=false;
    for(let i=0;i<l.length;i++){
      const ch = l[i]; const next = l[i+1];
      if(ch==='"'){ if(inQuote && next==='"'){ field+='"'; i++; continue;} inQuote=!inQuote; continue; }
      if(ch===',' && !inQuote){ cols.push(field); field=''; continue; }
      field+=ch;
    }
    cols.push(field);
    const obj = {};
    for(let i=0;i<headers.length;i++) obj[headers[i]] = (cols[i]||'').replace(/^"|"$/g,'').trim();
    return obj;
  });
}

function slugify(s){ return (s||'').toString().toLowerCase().replace(/&/g,' and ').replace(/[\s\/_,:\.]+/g,'-').replace(/[^a-z0-9\-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,''); }

const mappings = parseCSV(fs.readFileSync(mappingsPath,'utf8'));
const deals = JSON.parse(fs.readFileSync(dealsPath,'utf8')||'[]');
let newDealsMap = {};
if(fs.existsSync(newDealsPath)){
  const nd = parseCSV(fs.readFileSync(newDealsPath,'utf8'));
  for(const r of nd) newDealsMap[(r.id||'').toLowerCase()] = r;
}

function findBySlug(slug){
  return deals.find(d => (d.id||'').toLowerCase() === slug || (d.id||'').toLowerCase() === slug+'-1' || (d.id||'').toLowerCase() === slug.replace(/-1$/,''));
}

function fuzzyFind(title){
  const t = (title||'').toLowerCase();
  const tokens = t.split(/[^a-z0-9]+/).filter(Boolean).slice(0,5);
  if(!tokens.length) return null;
  // build university counts (for minor balancing) and normalize later
  const uniCounts = {};
  for(const dd of deals){ const u = (dd.university||'all'); uniCounts[u] = (uniCounts[u]||0)+1; }
  const maxUni = Math.max(...Object.values(uniCounts));
  let best = null; let bestScore = 0;
  for(const d of deals){
    const hay = ((d.retailer||'') + ' ' + (d.title||'')).toLowerCase();
    let score=0;
    for(const tok of tokens){ if(hay.includes(tok)) score++; }
    if(score<=0) continue;
    // small bonus for university match if provided via fuzzyFind.preferredUni
    if(fuzzyFind.preferredUni && fuzzyFind.preferredUni.length){
      const pu = fuzzyFind.preferredUni;
      if((d.university||'').toLowerCase() === pu) score += 2; // strong bias
      else if((d.university||'').toLowerCase() === 'all') score += 1; // slight bias
    }
    // minor balancing: prefer deals in less-represented unis (inverse of count)
    const ucount = uniCounts[d.university||'all'] || 1;
    const balanceBonus = 1 - (ucount / (maxUni||ucount));
    score += balanceBonus * 0.5;
    if(score > bestScore){ bestScore = score; best = d; }
  }
  return best;
}

// helper to infer university from a new-deal row or free text
function inferUniversityFromRow(r){
  if(!r) return null;
  const txt = ((r.university||'') + ' ' + (r.notes||'') + ' ' + (r.title||'') + ' ' + (r.retailer||'')).toLowerCase();
  const mapping = {
    'usyd': ['usyd','sydney uni','university of sydney'],
    'unsw': ['unsw','university of new south wales','university of nsw'],
    'uow': ['uow','wollongong','university of wollongong'],
    'uts': ['uts','university of technology sydney','university of technology'],
    'mq': ['macquarie','macquarie uni','macquarie university']
  };
  for(const key of Object.keys(mapping)){
    for(const kw of mapping[key]) if(txt.includes(kw)) return key;
  }
  return null;
}

const outRows = [['id','current_link','new_link','confidence_note','source']];
let remapped=0; let kept=0; let unresolved=0;
for(const m of mappings){
  const idRaw = (m.id||'').trim();
  let id = idRaw;
  const newLink = (m.new_link||m.newLink||m['new_link']||'').trim();
  if(!id){ outRows.push([idRaw,m.current_link||'', newLink, m.confidence_note||'', m.source||'']); continue; }
  const exists = deals.find(d=>d.id===id);
  if(exists){ outRows.push([id, exists.link||'', newLink, m.confidence_note||'', m.source||'']); kept++; continue; }
  // try slug match
  const slug = slugify(idRaw.replace(/-1$/,''));
  const bySlug = findBySlug(slug);
  if(bySlug){ outRows.push([bySlug.id, bySlug.link||'', newLink, 'fuzzy-match (slug)', 'user-supplied']); remapped++; continue; }
  // try title from newDeals map
  const nd = newDealsMap[idRaw.toLowerCase()];
  if(nd && nd.title){
    // infer preferred university from the new-deal row if possible
    const inferred = inferUniversityFromRow(nd);
    if(inferred) fuzzyFind.preferredUni = inferred;
    const ff = fuzzyFind(nd.title);
    fuzzyFind.preferredUni = null;
    if(ff){ outRows.push([ff.id, ff.link||'', newLink, 'fuzzy-match (title, uni-aware)', 'user-supplied']); remapped++; continue; }
  }
  // try fuzzy using id name tokens
  const guessTitle = idRaw.replace(/-/g,' ');
  // try fuzzy using id name tokens, with optional uni inference from mapping row
  const inferredFromMap = inferUniversityFromRow(m);
  if(inferredFromMap) fuzzyFind.preferredUni = inferredFromMap;
  const ff2 = fuzzyFind(guessTitle);
  fuzzyFind.preferredUni = null;
  if(ff2){ outRows.push([ff2.id, ff2.link||'', newLink, 'fuzzy-match (id tokens, uni-aware)', 'user-supplied']); remapped++; continue; }
  // unresolved - keep as-is (new-deal)
  outRows.push([id, m.current_link||'', newLink, m.confidence_note||'', m.source||'']); unresolved++;
}

const outPath = path.join(repo,'user-supplied-mappings-fuzzy.csv');
fs.writeFileSync(outPath, outRows.map(r=>r.map(c=>'"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),'utf8');
console.log('Wrote', outPath, '- remapped:', remapped, 'kept:', kept, 'unresolved:', unresolved);