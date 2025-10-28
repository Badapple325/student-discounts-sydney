#!/usr/bin/env node
// Safe admin-key checker.
// - Reads process.env.ADMIN_KEY (never prints it)
// - Calls /api/ping and prints the JSON
// - If run with --apply, sends a POST to /api/deals-publish with header x-admin-key (prints response)

const BASE = 'https://student-discounts-sydney.vercel.app';

function safeLog(obj) {
  try { console.log(JSON.stringify(obj, null, 2)); }
  catch (e) { console.log(String(obj)); }
}

async function main() {
  const secret = process.env.ADMIN_KEY;
  if (!secret) {
    console.error('ADMIN_KEY not set in this process environment.');
    console.error('Set it in your shell then re-run this script. (Do not paste the secret into chat.)');
    process.exitCode = 2;
    return;
  }

  console.log('ADMIN_KEY present in environment (value hidden).');

  // Use global fetch available in Node 18+. If not available, user will need node >=18.
  if (typeof fetch !== 'function') {
    console.error('Global fetch is not available in this Node runtime. Use Node 18+ or run via `node --experimental-fetch`');
    process.exitCode = 3;
    return;
  }

  try {
    const pingRes = await fetch(`${BASE}/api/ping`);
    const pingJson = await pingRes.json().catch(() => ({ status: pingRes.status }));
    console.log('\n/ping result:');
    safeLog(pingJson);

    if (!pingJson.admin_required) {
      console.log('\nServer reports admin_required: false — no admin-only actions expected.');
      return;
    }

    console.log('\nServer requires admin key. This script will NOT call publish unless you pass --apply.');

    if (process.argv.includes('--apply')) {
      console.log('Calling POST /api/deals-publish with supplied ADMIN_KEY header (value not printed)...');
      const publishRes = await fetch(`${BASE}/api/deals-publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': secret
        },
        body: JSON.stringify({})
      });

      let publishJson;
      try { publishJson = await publishRes.json(); }
      catch (e) { publishJson = { status: publishRes.status, text: await publishRes.text() } }
      console.log('\n/publish result:');
      safeLog(publishJson);
    } else {
      console.log('To attempt an admin action, re-run with: node tools/check_admin_key.js --apply');
    }

  } catch (err) {
    console.error('Network or runtime error while checking endpoints:');
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}

main();
