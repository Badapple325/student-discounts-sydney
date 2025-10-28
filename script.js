const dealsContainer = document.getElementById('deals');
const search = document.getElementById('search');
const filterUni = document.getElementById('filter-uni');
const filterCat = document.getElementById('filter-cat');

let deals = [];

async function loadDeals(){
  try{
    // Prefer server-backed deals (Airtable) via /api/deals when available, fallback to local deals.json
    let res = await fetch('/api/deals');
    if(!res.ok){
      // fallback
      res = await fetch('deals.json');
    }
    const payload = await res.json();
    // api/deals returns {ok:true, results: [...]}
    deals = Array.isArray(payload.results) ? payload.results : (Array.isArray(payload) ? payload : payload.results || []);
  renderDeals(deals || []);
  }catch(e){
    dealsContainer.innerHTML = '<p class="muted">Could not load deals. Make sure deals.json is present.</p>';
    console.error(e);
  }
}

// Tab switching: only keep Deals tab active (resources removed for launch)
const tabDeals = document.getElementById('tab-deals');
if(tabDeals){
  tabDeals.addEventListener('click', ()=>{
    const dealsEl = document.getElementById('deals');
    const resourcesEl = document.getElementById('resources');
    if(dealsEl) dealsEl.style.display = '';
    if(resourcesEl) resourcesEl.style.display = 'none';
    const rc = document.getElementById('resource-controls'); if(rc) rc.style.display = 'none';
    tabDeals.classList.add('active');
  });
}

function escapeHtml(str){
  if(!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function renderDeals(list){
  if(!list.length){
    dealsContainer.innerHTML = '<p class="muted">No deals found.</p>';
    return;
  }

  // Build HTML
  dealsContainer.innerHTML = list.map((d, i) => {
    const slug = d.id || slugify(d.retailer) || String(i);
    return `
    <article class="card">
      <h3>${escapeHtml(d.retailer)}</h3>
      <div class="meta">
        <span class="badge">${escapeHtml(d.category)}</span>
        <span class="small">${escapeHtml(d.universityLabel || 'All Sydney unis')}</span>
      </div>
      <p>${escapeHtml(d.description)}</p>
      ${d.link? (()=>{
        const isPlaceholder = String(d.link||'').includes('example.com');
        return `<p><a class="redirect-link" href="/api/redirect?slug=${encodeURIComponent(slug)}" target="_blank" rel="noopener">View terms / retailer</a> ${isPlaceholder? '<span class="small muted">• Link: placeholder</span>' : ''}</p>`;
      })() : ''}
      <div class="action-row">
        ${d.code? `<button class="small-action" data-copy="${encodeURIComponent(d.code)}" aria-label="Copy promo code for ${escapeHtml(d.retailer)}">Copy code</button>` : ''}
        ${d.link? `<button class="small-action" data-copy-link="${encodeURIComponent(d.link)}" aria-label="Copy link for ${escapeHtml(d.retailer)}">Copy link</button>` : ''}
        ${d.link? `<button class="small-action" data-claim-slug="${encodeURIComponent(slug)}" aria-label="Open or claim deal for ${escapeHtml(d.retailer)}">Claim / Open</button>` : ''}
        <button class="small-action report-action" data-report='${encodeURIComponent(JSON.stringify({id: d.id||slug, retailer: d.retailer||'', link: d.link||''}))}' aria-label="Report broken link for ${escapeHtml(d.retailer)}">Report</button>
      </div>
      ${d.how? `<p class="muted">How to claim: ${escapeHtml(d.how)}</p>` : ''}
    </article>`;
  }).join('');

  // attach copy handlers
    Array.from(document.querySelectorAll('button[data-copy]')).forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const code = decodeURIComponent(btn.getAttribute('data-copy'));
        try{
          await navigator.clipboard.writeText(code);
          alert('Promo code copied: ' + code);
          // log copy event
          fetch('/api/track', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ event: 'copy_code', data: { code } }) }).catch(()=>{});
        }catch(err){
          console.error('copy failed', err);
          alert('Could not copy automatically — please select and copy: ' + code);
        }
      });
    });

    // attach copy-link handlers
    Array.from(document.querySelectorAll('button[data-copy-link]')).forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const link = decodeURIComponent(btn.getAttribute('data-copy-link'));
        try{
          await navigator.clipboard.writeText(link);
          alert('Link copied to clipboard');
          fetch('/api/track', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ event: 'copy_link', data: { link } }) }).catch(()=>{});
        }catch(err){
          console.error('copy link failed', err);
          alert('Could not copy link automatically — please copy manually: ' + link);
        }
      });
    });

    // attach report handlers
    Array.from(document.querySelectorAll('button.report-action')).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        try{
          const payload = JSON.parse(decodeURIComponent(btn.getAttribute('data-report')));
          const subject = encodeURIComponent(`Report: broken or incorrect deal - ${payload.retailer || payload.id}`);
          const body = encodeURIComponent(`I want to report an issue with this deal:\n\nRetailer: ${payload.retailer}\nDeal id: ${payload.id}\nLink: ${payload.link || '<none>'}\n\nDescribe the problem:\n`);
          // open mailto in new window/tab (user composes email)
          window.location.href = `mailto:you@yourdomain.example?subject=${subject}&body=${body}`;
        }catch(e){
          console.error('report action failed', e);
          alert('Could not open report form — please email support.');
        }
      });
    });

  // attach claim handlers
  Array.from(document.querySelectorAll('button[data-claim-slug]')).forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const slug = decodeURIComponent(btn.getAttribute('data-claim-slug'));
      // Find deal details from loaded deals (if present)
      const deal = (deals || []).find(d => (d.id || slugify(d.retailer) || '') === slug) || {};
      const retailer = deal.retailer || '';
      const code = deal.code || '';
      const how = deal.how || '';
      const link = deal.link? deal.link : '/api/redirect?slug=' + encodeURIComponent(slug);

      // populate modal
      const modal = document.getElementById('claim-modal');
      if(!modal) return;
      document.getElementById('claim-retailer').textContent = retailer || 'Deal';
      document.getElementById('claim-code').textContent = code || '—';
      document.getElementById('claim-how').textContent = how || '';
      const openBtn = document.getElementById('claim-open');
      openBtn.setAttribute('href', link);

      // show modal
      modal.classList.add('show');
      modal.setAttribute('aria-hidden','false');

      // track claim intent
      try{ fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event: 'claim_intent', data:{ slug, retailer } }) }).catch(()=>{}); }catch(e){}
      // GA4 event (if available)
      try{ if(window.gtag) window.gtag('event','claim_intent',{event_category:'engagement',event_label:retailer || slug}); }catch(e){}
    });
  });

  // attach redirect link handlers (intercept placeholder links)
  Array.from(document.querySelectorAll('a.redirect-link')).forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const href = a.getAttribute('href') || '';
      const m = /[?&]slug=([^&]+)/.exec(href);
      const slug = m? decodeURIComponent(m[1]) : null;
      const deal = (deals || []).find(d => (d.id || slugify(d.retailer) || '') === slug) || {};
      const external = deal.link || '';
      if(String(external).includes('example.com')){
        // show the claim modal with placeholder info
        const modal = document.getElementById('claim-modal');
        if(modal){
          document.getElementById('claim-retailer').textContent = deal.retailer || 'Deal';
          document.getElementById('claim-code').textContent = deal.code || '—';
          document.getElementById('claim-how').textContent = deal.how || 'No external link configured';
          document.getElementById('claim-open').setAttribute('href', external || '');
          modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
        }else{
          alert('This listing has a placeholder link configured and does not navigate externally yet.');
        }
        fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'redirect_placeholder', data:{ slug, external } }) }).catch(()=>{});
        return;
      }
      // otherwise allow external redirect to the redirect endpoint (open in new tab)
      window.open(href, '_blank', 'noopener');
      fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'redirect', data:{ slug, external } }) }).catch(()=>{});
    });
  });

// Modal behavior: close, copy, open
const modal = document.getElementById('claim-modal');
if(modal){
  modal.querySelector('.modal-close').addEventListener('click', ()=>{ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); });
  modal.addEventListener('click', (e)=>{ if(e.target === modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }});
  const copyBtn = document.getElementById('claim-copy');
  copyBtn && copyBtn.addEventListener('click', async ()=>{
    const code = document.getElementById('claim-code').textContent || '';
    try{ await navigator.clipboard.writeText(code); alert('Copied code: ' + code); fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'claim_copy', data:{ code } }) }).catch(()=>{}); if(window.gtag) window.gtag('event','claim_copy',{event_category:'engagement',event_label:code}); }catch(e){ alert('Could not copy automatically — please select and copy: ' + code); }
  });
  const openBtn = document.getElementById('claim-open');
  openBtn && openBtn.addEventListener('click', (e)=>{
    e.preventDefault();
    const retailer = document.getElementById('claim-retailer').textContent || '';
    const href = openBtn.getAttribute('href') || '';
    // if href is a placeholder (example.com) show a friendly message instead of navigating
    if(String(href).includes('example.com')){
      alert('This listing has a placeholder link configured and does not navigate externally yet.');
      fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'claim_open_placeholder', data:{ retailer, href } }) }).catch(()=>{});
      return;
    }
    // open external link and track
    fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'claim_open', data:{ retailer, href } }) }).catch(()=>{});
    if(window.gtag) try{ window.gtag('event','claim_open',{event_category:'engagement',event_label:retailer}); }catch(e){}
    window.open(href, '_blank', 'noopener');
    // close modal after opening
    setTimeout(()=>{ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }, 300);
  });
}
}

function filterAndRender(){
  const q = (search.value||'').toLowerCase().trim();
  const uni = filterUni.value;
  const cat = filterCat.value;
  const out = deals.filter(d => {
    if(uni !== 'all' && d.university && d.university !== uni) return false;
    if(cat !== 'all' && d.category !== cat) return false;
    if(q){
      const hay = (d.retailer + ' ' + d.description + ' ' + (d.category||'')).toLowerCase();
      return hay.includes(q);
    }
    return true;
  });
  renderDeals(out);
}

search.addEventListener('input', filterAndRender);
filterUni.addEventListener('change', filterAndRender);
filterCat.addEventListener('change', filterAndRender);

loadDeals();

// Simple form fallback messaging
const signupForm = document.getElementById('signup-form');
if(signupForm){
  signupForm.addEventListener('submit', (e)=>{
    // Let external form service handle the POST; send a lightweight track event for analytics
    try{
      const uni = (document.getElementById('university') && document.getElementById('university').value) || '';
      fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'signup_form_submit', data:{ uni } }) }).catch(()=>{});
      if(window.gtag) window.gtag('event','sign_up',{method:'form',event_category:'engagement',event_label:uni});
    }catch(e){}
    setTimeout(()=>{
      alert('Thanks — if you used the placeholder Formspree endpoint you will need to replace it with your Formspree or MailerLite embed.');
    }, 300);
  });
}

// submit-deal feedback
const submitDeal = document.getElementById('submit-deal');
submitDeal && submitDeal.addEventListener('submit', ()=>{
  setTimeout(()=>alert('Thanks for the submission! We will review and add verified deals.'), 200);
});

// Places search (calls serverless /api/search if present)
const placesQuery = document.getElementById('places-query');
const placesSearchBtn = document.getElementById('places-search');
const placesResults = document.getElementById('places-results');

async function searchPlaces(query){
  if(!query) return;
  try{
    placesSearchBtn.disabled = true;
    placesResults.innerHTML = '<p class="muted">Searching...</p>';
    const res = await fetch('/api/search?query=' + encodeURIComponent(query));
    if(!res.ok) throw new Error('Search failed');
    const data = await res.json();
    if(!Array.isArray(data.results) || data.results.length === 0){
      placesResults.innerHTML = '<p class="muted">No places found.</p>';
      return;
    }
    placesResults.innerHTML = data.results.map(p => `
      <article class="card">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="meta"><span class="small">${escapeHtml(p.address || '')}</span></div>
        ${p.rating? `<p class="small">Rating: ${p.rating}</p>` : ''}
        ${p.place_id? `<p><a href="https://www.google.com/maps/place/?q=place_id:${p.place_id}" target="_blank" rel="noopener">Open in Google Maps</a></p>` : ''}
      </article>
    `).join('');
  }catch(e){
    console.error(e);
    placesResults.innerHTML = '<p class="muted">Search failed — ensure PLACES_API_KEY is configured on the deployment.</p>';
  }finally{placesSearchBtn.disabled = false}
}

placesSearchBtn && placesSearchBtn.addEventListener('click', ()=>{
  const q = (placesQuery && placesQuery.value) || '';
  searchPlaces(q.trim());
});

// UTM capture: fill hidden fields from URL parameters so we can track campaign origin without GA
function getParam(name){
  const m = new RegExp('(?:[?&])'+name+'=([^&]*)').exec(location.search);
  return m? decodeURIComponent(m[1].replace(/\+/g,' ')) : '';
}
function fillUtmFields(){
  const utms = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  utms.forEach(k=>{
    const val = getParam(k);
    // main signup
    const el = document.getElementById(k);
    if(el && val) el.value = val;
    // submit-deal form fields have prefix submit_
    const el2 = document.getElementById('submit_'+k);
    if(el2 && val) el2.value = val;
  });
}

// populate utm fields on load
document.addEventListener('DOMContentLoaded', fillUtmFields);
