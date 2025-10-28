import fs from 'fs';
import path from 'path';

// Admin endpoint to get/update resources.json. Protect using ADMIN_KEY env var.
// If Airtable is configured (AIRTABLE_* env vars + RESOURCES_TABLE_NAME), prefer Airtable as canonical store.
export default async function handler(req, res){
  const adminKey = process.env.ADMIN_KEY;
  const provided = req.query && req.query.key;
  if(adminKey){
    if(!provided || provided !== adminKey) return res.status(401).json({ error: 'unauthorized' });
  }

  const resourcesFile = path.join(process.cwd(), 'resources.json');

  // Support Airtable Personal Access Token (AIRTABLE_TOKEN) and fall back to AIRTABLE_API_KEY
  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const RES_TABLE = process.env.RESOURCES_TABLE_NAME || 'Resources';

  // helper to fetch all airtable records (paginated)
  async function fetchAllAirtable(){
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(RES_TABLE)}`;
    let out = [];
    let offset = null;
    do{
      const q = offset ? `?offset=${offset}` : '';
      const resp = await fetch(url + q, { headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN } });
      if(!resp.ok) throw new Error('airtable fetch failed');
      const j = await resp.json();
      (j.records||[]).forEach(r => out.push(r));
      offset = j.offset || null;
    }while(offset);
    return out;
  }

  if(req.method === 'GET'){
    // Prefer Airtable when available
    if(AIRTABLE_API_KEY && AIRTABLE_BASE_ID){
      try{
        const records = await fetchAllAirtable();
        const arr = records.map(r => r.fields || {}).map(f => ({
          id: f.id || f.ID || f.slug || (f.title ? String(f.title).toLowerCase().replace(/[^a-z0-9]+/g,'-') : ''),
          title: f.title || f.Name || f.name || '',
          provider: f.provider || f.Provider || '',
          category: f.category || f.Category || '',
          price: f.price || f.Price || '',
          price_display: f.price_display || f.Price_display || '',
          link: f.link || f.Link || '',
          description: f.description || f.Description || '',
          code: f.code || f.Code || ''
        }));
        return res.status(200).json(arr);
      }catch(e){
        console.error('[admin-resources] airtable read failed', String(e));
        // fall back to file
      }
    }

    try{
      const txt = fs.readFileSync(resourcesFile,'utf8');
      return res.status(200).json(JSON.parse(txt||'[]'));
    }catch(e){
      console.error('[admin-resources] read failed', String(e));
      return res.status(200).json([]);
    }
  }

  if(req.method === 'POST'){
    try{
      const body = req.body || [];
      if(!Array.isArray(body)) return res.status(400).json({ error: 'expected array' });

      // write to local file first
      fs.writeFileSync(resourcesFile, JSON.stringify(body, null, 2), 'utf8');

      // if Airtable configured, overwrite the table: delete existing records then create new ones in batches
      if(AIRTABLE_TOKEN && AIRTABLE_BASE_ID){
        try{
            const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(RES_TABLE)}`;
          // fetch existing
          const existing = await fetchAllAirtable();
          const ids = existing.map(r => r.id).filter(Boolean);
          // delete in batches of 10
          while(ids.length){
            const chunk = ids.splice(0,10);
              await fetch(url, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ records: chunk.map(id=>({ id })) }) });
          }
          // create new records in chunks of 10
          let i = 0;
          while(i < body.length){
            const chunk = body.slice(i, i+10);
            const records = chunk.map(item => ({ fields: {
              id: item.id || '', title: item.title || '', provider: item.provider || '', category: item.category || '', price: item.price || '', price_display: item.price_display || '', link: item.link || '', description: item.description || '', code: item.code || ''
            }}));
              await fetch(url, { method: 'POST', headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type':'application/json' }, body: JSON.stringify({ records }) });
            i += 10;
          }
        }catch(e){
          console.error('[admin-resources] airtable write failed', String(e));
        }
      }

      return res.status(200).json({ ok: true });
    }catch(e){
      console.error('[admin-resources] write failed', String(e));
      return res.status(500).json({ error: 'internal' });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}
