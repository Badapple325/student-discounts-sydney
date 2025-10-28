// Serverless endpoint to receive Formspree webhooks and forward/log them.
// Configure this URL as a webhook in your Formspree project settings.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = req.body || {};
    console.log('[formspree webhook] received at', new Date().toISOString(), JSON.stringify(payload));

    // Optionally forward to /api/track for centralized logging
    try {
      const vercelHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
      if (vercelHost) {
        const trackUrl = vercelHost + '/api/track';
        await fetch(trackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'formspree_submission', data: payload })
        });
      } else {
        // If VERCEL_URL is not present (local dev), call local endpoint if available
        try {
          await fetch('http://127.0.0.1:3000/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'formspree_submission', data: payload })
          });
        } catch (e) {
          console.log('[formspree webhook] local-forward-failed', String(e));
        }
      }
    } catch (err) {
      console.error('[formspree webhook] forward failed', String(err));
    }

    // Respond 200 to acknowledge webhook
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('formspree webhook handler error', err);
    res.status(500).json({ error: 'internal' });
  }
}
