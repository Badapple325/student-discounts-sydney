#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'deals.json');

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

function readDeals() {
  const raw = fs.readFileSync(DATA, 'utf8');
  return JSON.parse(raw);
}

function main() {
  let exitCode = 0;
  let deals;
  try {
    deals = readDeals();
  } catch (e) {
    console.error('ERROR: could not read or parse deals.json:', e.message);
    process.exit(2);
  }

  if (!Array.isArray(deals)) {
    console.error('ERROR: deals.json is not an array');
    process.exit(2);
  }

  const ids = new Set();
  let missingTitle = 0;
  let missingId = 0;
  let badUrl = 0;
  let exampleUrls = 0;

  deals.forEach((d, i) => {
    if (!d || typeof d !== 'object') {
      console.error(`ERROR: item at index ${i} is not an object`);
      exitCode = 1;
      return;
    }
    if (!d.id) { missingId++; exitCode = 1; console.error(`Missing id at index ${i}`); }
    else if (ids.has(d.id)) { exitCode = 1; console.error(`Duplicate id: ${d.id} at index ${i}`); }
    else ids.add(d.id);

    if (!d.title || typeof d.title !== 'string') { missingTitle++; exitCode = 1; console.error(`Missing or invalid title for id=${d.id||'<no-id>'}`); }

    if (d.url) {
      if (typeof d.url !== 'string' || !isUrl(d.url)) { badUrl++; exitCode = 1; console.error(`Invalid url for id=${d.id||'<no-id>'}: ${d.url}`); }
      if (d.url.includes('example.com') || d.url.includes('placeholder')) { exampleUrls++; console.warn(`Warning: placeholder url for id=${d.id||'<no-id>'}: ${d.url}`); }
    }
  });

  console.log('\nValidation summary:');
  console.log(`  total: ${deals.length}`);
  console.log(`  missing id: ${missingId}`);
  console.log(`  missing title: ${missingTitle}`);
  console.log(`  invalid url: ${badUrl}`);
  console.log(`  placeholder/example urls: ${exampleUrls}`);

  if (exitCode !== 0) {
    console.error('\nValidation FAILED. See errors above.');
  } else {
    console.log('\nValidation passed.');
  }

  process.exit(exitCode);
}

if (require.main === module) main();
