// Returns list of events. If Airtable is configured (AIRTABLE_* env vars) it will fetch from Airtable.
// Protected by ADMIN_KEY query parameter if set in environment.

import fs from 'fs';
import path from 'path';

export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try{
    const adminKey = process.env.ADMIN_KEY;
    const provided = req.query && req.query.key;
    if(adminKey){
      if(!provided || provided !== adminKey) return res.status(401).json({ error: 'unauthorized' });
    }

    // Prefer AIRTABLE_TOKEN (PAT) but fall back to AIRTABLE_API_KEY for older setups
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Events';

    if(AIRTABLE_TOKEN && AIRTABLE_BASE_ID){
      try{
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
        const resp = await fetch(url + '?pageSize=100', { headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN } });
        if(!resp.ok) throw new Error('airtable fetch failed');
        const json = await resp.json();
        const out = (json.records||[]).map(r => {
          const f = r.fields || {};
          let data = f.data || f.Data || '';
          try{ data = JSON.parse(data); }catch(e){ /* keep as string */ }
          return { ts: f.ts || f.TS || r.createdTime || '', event: f.event || f.Event || '', data };
        });
        return res.status(200).json(out);
      }catch(e){
        console.error('[events] airtable read failed', String(e));
        // fall through to local file
      }
    }

    // fallback: read local data/events.json
    const eventsFile = path.join(process.cwd(), 'data', 'events.json');
    let arr = [];
    if(fs.existsSync(eventsFile)){
      try{ arr = JSON.parse(fs.readFileSync(eventsFile,'utf8')||'[]'); }catch(e){ arr = []; }
    }
    // normalize payload
    const out = arr.map(it => ({ ts: it.ts, event: (it.payload && it.payload.event) || '', data: (it.payload && it.payload.data) || it.payload || {} }));
    return res.status(200).json(out);
  }catch(err){
    console.error('[events] error', err);
    return res.status(500).json({ error: 'internal' });
  }
}
