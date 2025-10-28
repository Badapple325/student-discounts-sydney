#!/usr/bin/env node
// Export deals with placeholder or missing links to a CSV for manual editing
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const dealsFile = path.join(repoRoot, 'deals.json');
if(!fs.existsSync(dealsFile)){ console.error('deals.json not found'); process.exit(1); }
const deals = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]');

const rows = [['id','title','retailer','current_link','notes']];
for(const d of deals){
  const link = String(d.link||'').trim();
  const isPlaceholder = !link || /example\.com/i.test(link);
  if(isPlaceholder){
    rows.push([d.id || '', (d.title||d.retailer||'').replace(/\n/g,' '), d.retailer||'', link, 'replace with canonical URL']);
  }
}

const outPath = path.join(repoRoot, 'placeholders-to-fill.csv');
const csv = rows.map(r => r.map(c => '"'+String(c||'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
fs.writeFileSync(outPath, csv, 'utf8');
console.log('Wrote', outPath, '- rows:', rows.length-1);
