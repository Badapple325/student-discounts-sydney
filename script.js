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
  }catch(e){
    dealsContainer.innerHTML = '<p class="muted">Could not load deals. Make sure deals.json is present.</p>';
    console.error(e);
  }
}

function renderDeals(list){
  if(!list.length){
    dealsContainer.innerHTML = '<p class="muted">No deals found.</p>';
    return;
  }
  dealsContainer.innerHTML = list.map(d => `
    <article class="card">
      <h3>${escapeHtml(d.retailer)}</h3>
      <div class="meta">
        <span class="badge">${escapeHtml(d.category)}</span>
        <span class="small">${escapeHtml(d.universityLabel || 'All Sydney unis')}</span>
      </div>
      <p>${escapeHtml(d.description)}</p>
      ${d.link? `<p><a href="${d.link}" target="_blank" rel="noopener">View terms / retailer</a></p>`:''}
      ${d.how? `<p class="muted">How to claim: ${escapeHtml(d.how)}</p>`:''}
    </article>
  `).join('');
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
