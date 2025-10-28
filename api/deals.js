// Returns deals list. If Airtable is configured (AIRTABLE_TOKEN + AIRTABLE_BASE_ID)
// it fetches records from Airtable and returns them. Otherwise falls back to local deals.json.

export default async function handler(req, res){
  try{
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Deals';

    if(AIRTABLE_TOKEN && AIRTABLE_BASE_ID){
      try{
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
        const resp = await fetch(url + '?pageSize=100', { headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN } });
        if(!resp.ok) throw new Error('airtable fetch failed: ' + resp.status);
        const json = await resp.json();
        // Map airtable records to deals structure
        const records = (json.records || []).map(r => {
          const f = r.fields || {};
          return {
            id: r.id,
            retailer: f.retailer || f.Retailer || f.name || f.Name || '',
            category: f.category || f.Category || '',
            university: f.university || f.University || 'all',
            universityLabel: f.universityLabel || f.UniversityLabel || f.university_label || '',
            description: f.description || f.Description || '',
            link: f.link || f.Link || '',
            how: f.how || f.How || '',
            code: f.code || f.Code || ''
          };
        });
        return res.status(200).json({ ok:true, results: records });
      }catch(e){
        console.error('[api/deals] airtable error', String(e));
        // fallthrough to local file
      }
    }

    // local fallback
    try{
      const fs = require('fs');
      const path = require('path');
      const file = path.join(process.cwd(),'deals.json');
      if(fs.existsSync(file)){
        const data = JSON.parse(fs.readFileSync(file,'utf8')||'[]');
        return res.status(200).json({ ok:true, results: data });
      }
    }catch(e){ console.error('[api/deals] local fallback failed', String(e)); }

    return res.status(200).json({ ok:true, results: [] });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
}
