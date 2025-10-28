#!/usr/bin/env node
// Simple smoke test for the import_deals tool
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const csv = path.join(repoRoot, 'deals-export.csv');
if(!fs.existsSync(csv)){
  console.error('deals-export.csv not found in repo root'); process.exit(2);
}

console.log('Running import tool against deals-export.csv (merge)...');
const res = spawnSync('node', [path.join('tools','import_deals.js'), csv, '--merge'], { encoding: 'utf8' });
console.log(res.stdout || '');
if(res.stderr) console.error(res.stderr);
if(res.status !== 0){ console.error('Import script failed with code', res.status); process.exit(res.status||1); }

const dealsFile = path.join(repoRoot, 'deals.json');
if(!fs.existsSync(dealsFile)){ console.error('deals.json not created'); process.exit(3); }
try{
  const j = JSON.parse(fs.readFileSync(dealsFile,'utf8')||'[]');
  console.log('deals.json parsed OK — records:', j.length);
  if(j.length === 0){ console.error('No records found'); process.exit(4); }
}catch(e){ console.error('Error parsing deals.json:', e.message); process.exit(5); }

console.log('Smoke test passed.');
