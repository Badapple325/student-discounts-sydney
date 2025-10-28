// Simple ping endpoint to verify API routing and env visibility.
export default function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try{
    return res.status(200).json({
      ok: true,
      route: '/api/ping',
      ts: new Date().toISOString(),
      vercel_url: process.env.VERCEL_URL || null,
      admin_required: !!process.env.ADMIN_KEY
    });
  }catch(e){
    console.error('[ping] error', String(e));
    return res.status(500).json({ error: 'internal' });
  }
}
