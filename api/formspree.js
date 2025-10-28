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

    // Also optionally write the submission to Airtable if configured
    // Prefer AIRTABLE_TOKEN (PAT) but remain compatible with AIRTABLE_API_KEY
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const FORM_TABLE = process.env.FORMSPREE_TABLE_NAME || 'FormSubmissions';
    // Optionally write the submission to Airtable and capture response when debugging
    let airtableDebugResult = null;
    const debugAirtable = String(process.env.DEBUG_AIRTABLE || '').toLowerCase() === '1' || String(process.env.DEBUG || '').toLowerCase() === '1';
    if(AIRTABLE_TOKEN && AIRTABLE_BASE_ID){
      try{
        const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(FORM_TABLE)}`;
        const record = { fields: Object.assign({ received_at: new Date().toISOString() }, payload ) };
        const resp = await fetch(airtableUrl, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + AIRTABLE_TOKEN, 'Content-Type':'application/json' },
          body: JSON.stringify({ records: [ record ] })
        });
        if(debugAirtable){
          const text = await resp.text();
          try{ airtableDebugResult = JSON.parse(text); }catch(e){ airtableDebugResult = text; }
        }
      }catch(e){
        console.error('[formspree webhook] airtable forward failed', String(e));
        if(debugAirtable) airtableDebugResult = { error: String(e) };
      }
    }

  // Respond 200 to acknowledge webhook
  const baseResponse = { ok: true };
  if(debugAirtable && airtableDebugResult) baseResponse.airtable = airtableDebugResult;
  res.status(200).json(baseResponse);
  } catch (err) {
    console.error('formspree webhook handler error', err);
    res.status(500).json({ error: 'internal' });
  }
}
