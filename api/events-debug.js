// Temporary debug endpoint to validate routing for /api/events-like routes.
// Requires the same admin query param `key` if `ADMIN_KEY` is set in env.

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try{
    const adminKey = process.env.ADMIN_KEY;
    // support both `key` and `admin_key` query param for convenience
    const provided = (req.query && (req.query.key || req.query.admin_key));
    if(adminKey){
      if(!provided || provided !== adminKey) return res.status(401).json({ error: 'unauthorized' });
    }

    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    return res.status(200).json({
      ok: true,
      route: '/api/events-debug',
      ts: new Date().toISOString(),
      airtable_configured: !!(AIRTABLE_TOKEN && AIRTABLE_BASE_ID),
      admin_required: !!adminKey
    });
  }catch(err){
    console.error('[events-debug] error', err);
    return res.status(500).json({ error: 'internal' });
  }
}
