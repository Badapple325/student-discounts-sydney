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
    // also pre-load resources for the test page
    loadResources();
  }catch(e){
    dealsContainer.innerHTML = '<p class="muted">Could not load deals. Make sure deals.json is present.</p>';
    console.error(e);
  }
}

let resources = [];
const resourcesContainer = () => document.getElementById('resources');

async function loadResources(){
  try{
    const res = await fetch('resources.json');
    resources = await res.json();
    renderResources(resources);
  }catch(e){
    const el = resourcesContainer();
    if(el) el.innerHTML = '<p class="muted">Could not load resources.json.</p>';
    console.error(e);
  }
}

function renderResources(list){
  const el = resourcesContainer();
  if(!el) return;
  if(!list || !list.length){ el.innerHTML = '<p class="muted">No resources found.</p>'; return; }
  el.innerHTML = list.map((r, i) => `
    <article class="card">
      <h3>${escapeHtml(r.title)}</h3>
      <div class="meta"><span class="small">${escapeHtml(r.provider)} — ${escapeHtml(r.category)}</span></div>
      <p>${escapeHtml(r.description)}</p>
      <p class="small">${escapeHtml(r.price_display || r.price)}</p>
      <p><a href="#" class="resource-link" data-link="${encodeURIComponent(r.link)}" data-title="${encodeURIComponent(r.title)}">Open resource</a>
      ${r.code? ' <button class="btn btn-ghost" data-copy="' + encodeURIComponent(r.code) + '">Copy code: ' + escapeHtml(r.code) + '</button>' : ''}
      </p>
    </article>
  `).join('');

  // attach click handlers to resource links
  Array.from(document.querySelectorAll('.resource-link')).forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const href = decodeURIComponent(a.getAttribute('data-link'));
      const title = decodeURIComponent(a.getAttribute('data-title') || '');
      // If this is a placeholder link (example.com) don't navigate; show a friendly message
      if(String(href).includes('example.com')){
        alert('This resource has a placeholder link configured and does not navigate externally yet.');
        fetch('/api/track', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ event:'resource_click_placeholder', data:{ title, href } }) }).catch(()=>{});
        return;
      }
      // log resource click
      fetch('/api/track', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ event:'resource_click', data:{ title, href } }) }).catch(()=>{});
      window.open(href, '_blank', 'noopener');
    });
  });

  // attach copy handlers for any resource codes
  Array.from(document.querySelectorAll('button[data-copy]')).forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const code = decodeURIComponent(btn.getAttribute('data-copy'));
      try{ await navigator.clipboard.writeText(code); alert('Copied code: ' + code); fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event:'resource_copy_code', data:{ code } }) }).catch(()=>{}); }catch(e){ alert('Could not copy: ' + code); }
    });
  });
}

// Tab switching between deals and resources
const tabDeals = document.getElementById('tab-deals');
const tabResources = document.getElementById('tab-resources');
if(tabDeals && tabResources){
  tabDeals.addEventListener('click', ()=>{
    document.getElementById('deals').style.display = '';
    document.getElementById('resources').style.display = 'none';
    const rc = document.getElementById('resource-controls'); if(rc) rc.style.display = 'none';
    tabDeals.classList.add('active'); tabResources.classList.remove('active');
  });
  tabResources.addEventListener('click', ()=>{
    document.getElementById('deals').style.display = 'none';
    document.getElementById('resources').style.display = '';
    const rc = document.getElementById('resource-controls'); if(rc) rc.style.display = '';
    tabResources.classList.add('active'); tabDeals.classList.remove('active');
  });
}

// Resource filters
const resourceSearch = document.getElementById('resource-search');
const resourceFilterCat = document.getElementById('resource-filter-cat');
function resourceFilterAndRender(){
  if(!resources || !resources.length) return renderResources([]);
  const q = (resourceSearch && resourceSearch.value || '').toLowerCase().trim();
  const cat = (resourceFilterCat && resourceFilterCat.value) || 'all';
  const out = resources.filter(r => {
    if(cat !== 'all' && r.category !== cat) return false;
    if(q){
      const hay = (r.title + ' ' + r.provider + ' ' + (r.category||'') + ' ' + (r.description||'')).toLowerCase();
      return hay.includes(q);
    }
    return true;
  });
  renderResources(out);
}
if(resourceSearch) resourceSearch.addEventListener('input', resourceFilterAndRender);
if(resourceFilterCat) resourceFilterCat.addEventListener('change', resourceFilterAndRender);

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
      ${d.code? `<p><button class="btn btn-ghost" data-copy="${encodeURIComponent(d.code)}">Copy code: ${escapeHtml(d.code)}</button></p>` : ''}
      ${d.link? `<p><button class="btn btn-primary" data-claim-slug="${encodeURIComponent(slug)}">Claim / Open</button></p>` : ''}
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
