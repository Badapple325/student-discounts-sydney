// api/deals-publish.js
// Receives a POST from Airtable automation when a record is published.
// Protect with ADMIN_KEY env var if set.

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method' });

  const adminKey = process.env.ADMIN_KEY;
  if (adminKey) {
    const provided = req.headers['x-admin-key'] || req.query.admin_key;
    if (!provided || provided !== adminKey) {
      return res.status(401).json({ ok:false, error:'unauthorized' });
    }
  }

  try {
    const body = req.body || {};
    // Basic logging for debugging. In production you might forward this to Airtable sync or trigger a rebuild.
    console.log('Airtable publish webhook received:', JSON.stringify(body));

    // Optionally write to a local file for audit (only works during dev, not recommended for production serverless write-heavy ops)
    // const fs = require('fs');
    // fs.appendFileSync('./data/publish-log.json', JSON.stringify({ts:Date.now(), body})+'\n');

    // Respond OK to Airtable.
    return res.json({ ok:true, received: true });
  } catch (e) {
    console.error('publish webhook error', e);
    return res.status(500).json({ ok:false, error:e.message });
  }
};
