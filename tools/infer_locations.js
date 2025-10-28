const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../deals.json'),'utf8'));
const locs = new Set();
const placeKeywords = ['Newtown','Glebe','Wollongong','Broadway','Kensington','Macquarie','Broadway Shopping Centre','Macquarie Centre','UNSW Kensington Campus'];

rows.forEach(o=>{
  if(o.retailer){
    const m = o.retailer.match(/—\s*(.+)$/);
    if(m) locs.add(m[1].trim());
  }
  if(o.universityLabel) locs.add(o.universityLabel);
  if(o.description) placeKeywords.forEach(k=>{ if(o.description.includes(k)) locs.add(k); });
});

console.log('Unique inferred locations:');
[...locs].forEach(l => console.log('-', l));
