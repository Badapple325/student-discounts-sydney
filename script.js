const dealsContainer = document.getElementById('deals');
const search = document.getElementById('search');
const filterUni = document.getElementById('filter-uni');
const filterCat = document.getElementById('filter-cat');

let deals = [];

async function loadDeals(){
  try{
    const res = await fetch('deals.json');
    deals = await res.json();
    renderDeals(deals);
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
      ${d.link? `<p><a href="/api/redirect?slug=${encodeURIComponent(slug)}" target="_blank" rel="noopener">View terms / retailer</a></p>` : ''}
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
      const ok = confirm('Open retailer page and log your claim intent?');
      if(!ok) return;
      // log claim intent
      try{ await fetch('/api/track', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ event: 'claim_intent', data:{ slug } }) }); }catch(e){}
      // open redirect endpoint
      window.open('/api/redirect?slug=' + encodeURIComponent(slug), '_blank', 'noopener');
    });
  });
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
signupForm.addEventListener('submit', (e)=>{
  // Let external form service handle the POST; show a friendly message
  setTimeout(()=>{
    alert('Thanks — if you used the placeholder Formspree endpoint you will need to replace it with your Formspree or MailerLite embed.');
  }, 300);
});

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
