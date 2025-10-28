// tools/export_deals_csv.js
const fs = require('fs');
const path = require('path');

const inFile = path.resolve(__dirname, '../deals.json');
const outFile = path.resolve(__dirname, '../deals-export.csv');

function escapeCell(s = '') {
  if (s === null || s === undefined) return '';
  const str = String(s);
  if (/[,"\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

let rows;
try {
  rows = JSON.parse(fs.readFileSync(inFile, 'utf8'));
} catch (e) {
  console.error('Could not read deals.json at', inFile);
  console.error(e.message);
  process.exit(1);
}

const arr = Array.isArray(rows) ? rows : (rows.deals || []);
const headers = [
  'Discount Name','Retailer','Link','Code','Description','How',
  'Category','Location','University','Published','Placeholder'
];
const lines = [headers.join(',')];

for (const r of arr) {
  const line = [
    r.title || r['Discount Name'] || r.discountName || '',
    r.retailer || '',
    r.link || '',
    r.code || '',
    r.description || r.desc || '',
    r.how || '',
    r.category || '',
    (r.location || r.locations || '').toString(),
    Array.isArray(r.university) ? r.university.join(',') : (r.university || ''),
    r.published ? 'TRUE' : (r.Published ? String(r.Published) : 'FALSE'),
    r.placeholder ? 'TRUE' : (r.Placeholder ? String(r.Placeholder) : 'FALSE')
  ].map(escapeCell).join(',');
  lines.push(line);
}

fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log('Wrote CSV to', outFile);
