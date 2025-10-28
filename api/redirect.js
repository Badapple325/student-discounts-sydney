import fs from 'fs';
import path from 'path';

// Redirect endpoint that logs a click event then redirects to the deal's link.
// Usage: GET /api/redirect?id=0
export default async function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try{
    const q = req.query || {};
    const slugParam = q.slug || q.SLUG || q.id || q.ID;
    if(typeof slugParam === 'undefined') return res.status(400).json({ error: 'missing id or slug' });
    const rawParam = Array.isArray(slugParam) ? slugParam[0] : slugParam;

    const dataPath = path.join(process.cwd(), 'deals.json');
    const raw = fs.readFileSync(dataPath, 'utf8');
    const deals = JSON.parse(raw || '[]');
    // helper slugify
    const slugify = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

    let deal = null;
    // if numeric id, use index
    const maybeIdx = parseInt(String(rawParam), 10);
    if(!Number.isNaN(maybeIdx)) deal = deals[maybeIdx];
    // otherwise find by explicit id or slugified retailer
    if(!deal){
      const needle = String(rawParam);
      deal = deals.find(d => (d.id && d.id === needle) || (slugify(d.retailer) === needle));
    }
    if(!deal || !deal.link) return res.status(404).json({ error: 'deal not found' });

    // Fire a lightweight tracking POST to /api/track (best-effort)
    try{
      const vercelHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
      const trackUrl = vercelHost ? (vercelHost + '/api/track') : 'http://127.0.0.1:3000/api/track';
      await fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'click_deal', data: { id: maybeIdx, slug: rawParam, retailer: deal.retailer, url: deal.link } })
      });
    }catch(e){
      console.error('[redirect] track forward failed', String(e));
    }

    // Redirect user to the real link
    res.writeHead(302, { Location: deal.link });
    res.end();
  }catch(err){
    console.error('[redirect] error', err);
    res.status(500).json({ error: 'internal' });
  }
}
