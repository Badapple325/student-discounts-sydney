#!/usr/bin/env node
// tools/pull_airtable.js
// Pulls records from Airtable and writes cleaned `deals.json` locally.
// Usage: set AIRTABLE_TOKEN and AIRTABLE_BASE_ID in your environment, then run:
// node tools/pull_airtable.js

const fs = require('fs');
const path = require('path');
// Use global fetch when available (Node 18+). Do not require node-fetch dependency.
const fetch = global.fetch || (async () => { throw new Error('global fetch not available; please run in Node 18+ or install node-fetch'); })();

const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const base = process.env.AIRTABLE_BASE_ID;
const table = process.env.AIRTABLE_TABLE_NAME || 'Deals';

if (!token || !base) {
  console.error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID environment variables.');
  console.error('Set them and re-run. Example (PowerShell):');
  console.error('  $env:AIRTABLE_TOKEN="pat_xxx"; $env:AIRTABLE_BASE_ID="appxxx"; node .\\tools\\pull_airtable.js');
  process.exit(1);
}

async function fetchAll() {
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`;
  const rows = [];
  let offset;
  do {
    const q = offset ? `${url}?offset=${offset}` : url;
    const r = await fetch(q, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Airtable fetch failed: ${r.status} ${t}`);
    }
    const data = await r.json();
    (data.records||[]).forEach(rec => rows.push(rec));
    offset = data.offset;
  } while (offset);
  return rows;
}

function mapRecord(rec) {
  const f = rec.fields || {};
  return {
    id: rec.id,
    retailer: f.Retailer || f.retailer || f['Discount Name'] || f['Discount_Name'] || '',
    title: f['Discount Name'] || f.DiscountName || f.title || '',
    link: f.Link || f.link || '',
    code: f.Code || f.code || '',
    description: f.Description || f.description || '',
    how: f.How || f.how || '',
    category: f.Category || f.category || '',
    location: f.Location || f.location || '',
    university: f.University || f.university || f.UniversityLabel || f.universityLabel || '',
    published: !!f.Published,
    placeholder: !!f.Placeholder,
  };
}

async function run() {
  console.log('Fetching records from Airtable table', table);
  const records = await fetchAll();
  console.log('Fetched', records.length, 'records');

  const mapped = records.map(mapRecord);

  const outFile = path.resolve(__dirname, '../deals.json');
  const backup = path.resolve(__dirname, '../deals.json.bak');
  if (fs.existsSync(outFile)) fs.copyFileSync(outFile, backup);

  fs.writeFileSync(outFile, JSON.stringify(mapped, null, 2), 'utf8');
  console.log('Wrote', outFile, ' (backup at', backup, ')');
  console.log('Done. Review the file, then commit and push if happy.');
}

run().catch(e => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
