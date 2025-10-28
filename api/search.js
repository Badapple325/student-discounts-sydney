// Vercel Serverless Function: /api/search
// Requires environment variable PLACES_API_KEY (Google Places Text Search API)

export default async function handler(req, res){
  const { query } = req.query;
  const key = process.env.PLACES_API_KEY;
  if(!key){
    return res.status(500).json({ error: 'PLACES_API_KEY not configured' });
  }
  if(!query){
    return res.status(400).json({ error: 'query parameter is required' });
  }

  const q = encodeURIComponent(query);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${q}&key=${key}`;
  try{
    const r = await fetch(url);
    if(!r.ok){
      const text = await r.text();
      return res.status(502).json({ error: 'Places API error', details: text });
    }
    const json = await r.json();
    const results = (json.results || []).map(p=>({
      name: p.name,
      address: p.formatted_address || p.vicinity,
      rating: p.rating,
      place_id: p.place_id
    }));
    return res.status(200).json({ results });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'internal error', details: String(err) });
  }
}
