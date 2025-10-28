const fs = require('fs');
const path = require('path');
const dealsPath = path.join(process.cwd(),'deals.json');
if(!fs.existsSync(dealsPath)){ console.error('deals.json missing'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(dealsPath,'utf8'));

const keywordMap = {
  usyd: ['usyd','university of sydney','university of sydney','sydney uni','camperdown','darlington'],
  unsw: ['unsw','university of new south wales','kensington','unsw kensington'],
  uow: ['uow','wollongong','wollongong uni','wollongong'],
  uts: ['uts','university of technology sydney','utS','broadway','ultimo'],
  mq: ['macquarie','macquarie uni','macquarie university','macquarie park']
};

function inferUniForEntry(e){
  const text = [e.id,e.title,e.retailer,e.description,e.how,e.link,e.code,e.category,e.universityLabel]
    .filter(Boolean).join(' ').toLowerCase();
  const matches = {};
  for(const uni of Object.keys(keywordMap)){
    for(const kw of keywordMap[uni]){
      if(text.includes(kw)) matches[uni] = (matches[uni]||0)+1;
    }
  }
  // prefer uni with highest match count; require at least one match
  const keys = Object.keys(matches);
  if(keys.length===0) return null;
  keys.sort((a,b)=>matches[b]-matches[a]);
  // if top is clearly dominant (>1 match or at least one and others zero) accept
  const top = keys[0];
  if(matches[top] >= 1 && (keys.length===1 || matches[top] > matches[1])) return top;
  return null;
}

let changed=0; let total=0; const changedList=[];
for(const e of data){
  total++;
  if(!e.university || e.university === 'all'){
    const inferred = inferUniForEntry(e);
    if(inferred){
      e.university = inferred;
      changed++; changedList.push({id:e.id,title:e.title,uni:inferred});
    }
  }
}

if(changed===0){ console.log('No changes inferred.'); process.exit(0); }
const bak = dealsPath + '.bak.' + Date.now();
fs.copyFileSync(dealsPath,bak);
fs.writeFileSync(dealsPath, JSON.stringify(data,null,2),'utf8');
console.log('Inferred and set university for', changed, 'entries (out of', total, '). Backup:', bak);
for(const c of changedList.slice(0,50)) console.log('-', c.id, c.title, '=>', c.uni);
if(changedList.length>50) console.log('... and', changedList.length-50, 'more');
process.exit(0);
