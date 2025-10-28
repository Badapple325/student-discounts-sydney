// Admin export endpoint: returns a CSV of logged events in data/events.json
// Protect with ADMIN_KEY environment variable if set: /api/export?key=MYKEY

import fs from 'fs';
import path from 'path';

export default function handler(req, res){
  if(req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try{
    const key = req.query && req.query.key;
    const adminKey = process.env.ADMIN_KEY;
    if(adminKey){
      if(!key || key !== adminKey){
        return res.status(401).json({ error: 'unauthorized' });
      }
    }

    const eventsFile = path.join(process.cwd(), 'data', 'events.json');
    let arr = [];
    if(fs.existsSync(eventsFile)){
      try{ arr = JSON.parse(fs.readFileSync(eventsFile,'utf8')||'[]'); }catch(e){ arr = []; }
    }

    // Build CSV
    const rows = [['ts','event','data']];
    arr.forEach(it => {
      const ts = it.ts || '';
      const payload = it.payload || {};
      const ev = payload.event || '';
      const data = payload.data ? JSON.stringify(payload.data) : '';
      // escape double quotes
      const safeData = String(data).replace(/"/g,'""');
      rows.push([ts, ev, '"' + safeData + '"']);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="events.csv"');
    res.status(200).send(csv);
  }catch(err){
    console.error('[export] error', err);
    res.status(500).json({ error: 'internal' });
  }
}
