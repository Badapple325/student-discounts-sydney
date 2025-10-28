const fs = require('fs');
const path = require('path');
const repo = process.cwd();
const target = path.join(repo,'tools','tmp');
if(!fs.existsSync(target)) fs.mkdirSync(target,{ recursive:true });
const files = [
  'user_block1.csv','user_block2.csv','user_block3.csv','user_all_blocks.csv',
  'user-supplied-new-deals.csv','user-supplied-mappings.csv','user-supplied-mappings-fuzzy.csv',
  'placeholders-to-fill.csv','placeholders-to-fill-suggestions.csv',
  'small-apply.csv','small-apply-template.csv','small-apply-next10-filtered.csv',
  'small-apply-next10-filtered-fixed.csv','small-apply-high-confidence.csv','small-apply-high-confidence-fixed.csv',
  'small-apply-auto.csv','deals-export.csv','manual-lookup.csv'
];
let moved=0; for(const f of files){ const src = path.join(repo,f); if(fs.existsSync(src)){ const dst = path.join(target,f); fs.renameSync(src,dst); console.log('Moved',f,'-> tools/tmp/'); moved++; } }
console.log('Moved', moved, 'files to tools/tmp/');
process.exit(0);
