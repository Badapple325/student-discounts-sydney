// api/deals-sync.js
// Simple serverless endpoint to fetch deals from Airtable (read-only).
// Protect with ADMIN_KEY if set. Returns Airtable rows as JSON.

// Use global fetch (Node 18+ / serverless runtime) if available
const fetch = global.fetch || require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'method' });

  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) {
    const provided = req.headers['x-admin-key'] || req.query.admin_key;
    if (!provided || provided !== adminKey) {
      return res.status(401).json({ ok:false, error:'unauthorized' });
    }
  }

  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || 'Deals';

  if (!token || !base) {
    return res.status(400).json({ ok:false, error:'missing_airtable_env', need:['AIRTABLE_TOKEN','AIRTABLE_BASE_ID'] });
  }

  try {
    const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`;
    const rows = [];
    let offset;
    do {
      const q = offset ? `${url}?offset=${offset}` : url;
      const r = await fetch(q, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) {
        const text = await r.text();
        return res.status(502).json({ ok:false, error:'airtable_fetch_failed', status:r.status, body:text });
      }
      const data = await r.json();
      (data.records||[]).forEach(rec => rows.push(rec));
      offset = data.offset;
    } while (offset);

    return res.json({ ok:true, count: rows.length, records: rows });
  } catch (e) {
    console.error('deals-sync error', e);
    return res.status(500).json({ ok:false, error:e.message });
  }
};
