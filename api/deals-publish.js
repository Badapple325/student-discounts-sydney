// api/deals-publish.js
// Receives a POST from Airtable automation when a record is published.
// Protect with ADMIN_KEY env var if set.

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method' });

  // Authentication alternatives (backwards-compatible):
  // 1) x-admin-key header or admin_key query param (single key in ADMIN_KEY or comma-separated in ADMIN_KEYS)
  // 2) Basic Auth header matching ADMIN_BASIC_USER / ADMIN_BASIC_PASS (if set)
  // This keeps the existing simple ADMIN_KEY flow while allowing safer rotation/multiple keys.

  const envKey = process.env.ADMIN_KEY || '';
  const envKeys = (process.env.ADMIN_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envKey) envKeys.push(envKey);

  const basicUser = process.env.ADMIN_BASIC_USER || '';
  const basicPass = process.env.ADMIN_BASIC_PASS || '';

  // Helper: constant-time compare is not necessary here but keep simple equality checks.
  const providedKey = req.headers['x-admin-key'] || req.query.admin_key || '';

  let authorized = false;

  if (envKeys.length > 0) {
    // Accept if provided key matches any configured key
    if (providedKey && envKeys.includes(providedKey)) authorized = true;
  }

  // Basic Auth fallback if configured
  if (!authorized && basicUser && basicPass) {
    const auth = req.headers['authorization'] || '';
    if (auth.toLowerCase().startsWith('basic ')) {
      try {
        const b64 = auth.slice(6).trim();
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        const [u, p] = decoded.split(':');
        if (u === basicUser && p === basicPass) authorized = true;
      } catch (e) {
        // ignore parse errors
      }
    }
  }

  if (!authorized && (envKeys.length > 0 || (basicUser && basicPass))) {
    return res.status(401).json({ ok:false, error:'unauthorized' });
  }

  try {
    const body = req.body || {};
    // Basic logging for debugging. In production you might forward this to Airtable sync or trigger a rebuild.
    console.log('Airtable publish webhook received:', JSON.stringify(body));

    // Append a compact audit record to data/publish-audit.log (JSON lines). This is useful for debugging and auditing.
    // NOTE: On serverless platforms this file is ephemeral; this is primarily for internal/dev auditing. Do not log secrets.
    try {
      const fs = require('fs');
      const path = require('path');
      const auditDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(auditDir)) fs.mkdirSync(auditDir, { recursive: true });
      const auditFile = path.join(auditDir, 'publish-audit.log');

      // Determine auth type without logging secrets
      let authType = 'none';
      if (providedKey) authType = 'x-admin-key';
      else if ((req.headers['authorization'] || '').toLowerCase().startsWith('basic ')) authType = 'basic';

      // Scrub body: drop any key named 'admin_key' or 'x-admin-key' if present
      const scrubbed = { ...body };
      if (scrubbed.admin_key) delete scrubbed.admin_key;
      if (scrubbed['x-admin-key']) delete scrubbed['x-admin-key'];

      const record = {
        ts: new Date().toISOString(),
        route: '/api/deals-publish',
        auth: authType,
        ok: true,
        body: scrubbed
      };
      fs.appendFileSync(auditFile, JSON.stringify(record) + '\n');
    } catch (e) {
      // Best-effort audit; don't fail the request because of logging problems
      console.warn('audit write failed', e && e.message);
    }

    // Respond OK to Airtable.
    return res.json({ ok:true, received: true });
  } catch (e) {
    console.error('publish webhook error', e);
    return res.status(500).json({ ok:false, error:e.message });
  }
};
