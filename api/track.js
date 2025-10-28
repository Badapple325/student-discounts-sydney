// Simple serverless endpoint to log lightweight events to Vercel logs
// Use POST /api/track with JSON { event: 'signup'|'visit'|'click', data: {...} }

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'method not allowed'});
  try{
    const body = req.body || {};
    console.log('[track]', new Date().toISOString(), JSON.stringify(body));
    // Try to persist to Airtable if configured. Prefer a Personal Access Token (AIRTABLE_TOKEN)
    // but remain backward-compatible with AIRTABLE_API_KEY for older setups.
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Events';
    // Optionally persist to Airtable (captures response for debugging when enabled)
    let airtableDebugResult = null;
    const debugAirtable = String(process.env.DEBUG_AIRTABLE || '').toLowerCase() === '1' || String(process.env.DEBUG || '').toLowerCase() === '1';
    if(AIRTABLE_TOKEN && AIRTABLE_BASE_ID){
      try{
        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
        const record = { fields: {
          ts: new Date().toISOString(),
          event: body.event || '',
          data: JSON.stringify(body.data || body || {})
        }};
        const resp = await fetch(airtableUrl, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type':'application/json' },
          body: JSON.stringify(record)
        });
        // Capture response body (text then try JSON) when debug is enabled
        if(debugAirtable){
          const text = await resp.text();
          try{ airtableDebugResult = JSON.parse(text); }catch(e){ airtableDebugResult = text; }
        }
      }catch(e){
        console.error('[track] airtable forward failed', String(e));
        if(debugAirtable) airtableDebugResult = { error: String(e) };
      }
    }

    // Persist events to a local JSON file for quick export/inspection (fallback)
    try{
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(process.cwd(), 'data');
      if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
      const eventsFile = path.join(dataDir, 'events.json');
      let arr = [];
      if(fs.existsSync(eventsFile)){
        try{ arr = JSON.parse(fs.readFileSync(eventsFile,'utf8')||'[]'); }catch(e){ arr = []; }
      }
      arr.push({ ts: new Date().toISOString(), payload: body });
      try{ fs.writeFileSync(eventsFile, JSON.stringify(arr, null, 2), 'utf8'); }catch(e){ console.error('[track] write failed', String(e)); }
    }catch(e){ console.error('[track] persist failed', String(e)); }

  const baseResponse = { ok: true };
  if(debugAirtable && airtableDebugResult) baseResponse.airtable = airtableDebugResult;
  return res.status(200).json(baseResponse);
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'internal'});
  }
}
