// Simple serverless endpoint to log lightweight events to Vercel logs
// Use POST /api/track with JSON { event: 'signup'|'visit'|'click', data: {...} }

export default async function handler(req, res){
  if(req.method !== 'POST') return res.status(405).json({error:'method not allowed'});
  try{
    const body = req.body || {};
    console.log('[track]', new Date().toISOString(), JSON.stringify(body));
    // You can expand this to write to Airtable/Sheets if credentials are provided later.
    return res.status(200).json({ok:true});
  }catch(err){
    console.error(err);
    return res.status(500).json({error:'internal'});
  }
}
