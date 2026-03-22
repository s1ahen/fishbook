// FishBook — app.js
// Third-party fan tool. Not affiliated with Roblox or West Coast Florida developers.

/* ─── Config ─────────────────────────────────────────────────── */
const CFG = (typeof window.FISHBOOK_CONFIG !== 'undefined') ? window.FISHBOOK_CONFIG : {
  SUPABASE_URL: '', SUPABASE_ANON_KEY: '', DISCORD_CLIENT_ID: '',
  REDIRECT_URI: window.location.origin,
};

/* ─── Fish Data ───────────────────────────────────────────────── */
const FISH_PRICES = [
  {name:'Lady Fish',price:18},{name:'Stingray',price:22},{name:'Sea Trout',price:23},
  {name:'Black Drum',price:27},{name:'Sheepshead',price:28},{name:'Blue Marlin',price:28},
  {name:'Mangrove Snapper',price:31},{name:'Bluefin Tuna',price:33},{name:'Redfish',price:35},
  {name:'Black Marlin',price:38},{name:'King Mackerel',price:40},{name:'Gag Grouper',price:40},
  {name:'Snook',price:42},{name:'Red Grouper',price:45},{name:'Amberjack',price:53},
  {name:'Wahoo',price:54},{name:'Red Snapper',price:57},{name:'Mahi Mahi',price:63},
  {name:'Cobia',price:67},{name:'Blacktip Shark',price:69},{name:'Hammerhead Shark',price:79},
  {name:'Sailfish',price:80},{name:'Megalodon',price:237},{name:'Doomsday Fish',price:330},
];

const getRarity = p => p >= 237 ? 'legendary' : p >= 79 ? 'rare' : 'common';
const fmtMoney  = v => !v ? '$0' : v >= 1000 ? '$'+(v/1000).toFixed(1)+'k' : '$'+Math.round(v).toLocaleString();

function timeAgo(d) {
  const m = Math.floor((Date.now()-new Date(d))/60000);
  if(m<1) return 'just now';if(m<60) return m+'m ago';
  const h=Math.floor(m/60);if(h<24) return h+'h ago';
  const dy=Math.floor(h/24);if(dy<7) return dy+'d ago';
  return new Date(d).toLocaleDateString();
}

function escHtml(s) {
  if(s==null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ─── Supabase ────────────────────────────────────────────────── */
function supaFetch(path, opts={}) {
  return fetch(CFG.SUPABASE_URL+path, {
    ...opts,
    headers:{'apikey':CFG.SUPABASE_ANON_KEY,'Authorization':'Bearer '+CFG.SUPABASE_ANON_KEY,'Content-Type':'application/json','Prefer':'return=representation',...(opts.headers||{})},
  });
}
async function db(path, opts={}) {
  const r = await supaFetch('/rest/v1/'+path, opts);
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ─── State ───────────────────────────────────────────────────── */
let currentUser = null;
let currentPage = 'feed';
let activeComp  = null; // currently viewed competition

/* ─── Auth ────────────────────────────────────────────────────── */
function loadUser() {
  try { const r=localStorage.getItem('fishbook_user'); if(r) currentUser=JSON.parse(r); } catch(_){}
}
function saveUser(u) { currentUser=u; localStorage.setItem('fishbook_user',JSON.stringify(u)); }
function logout() { currentUser=null; localStorage.removeItem('fishbook_user'); closeDropdown(); showLogin(); }

function discordOAuthURL() {
  return 'https://discord.com/api/oauth2/authorize?'+new URLSearchParams({client_id:CFG.DISCORD_CLIENT_ID,redirect_uri:CFG.REDIRECT_URI,response_type:'code',scope:'identify'});
}

async function handleOAuthCallback(code) {
  const el = document.getElementById('login-error');
  el.style.display='none'; el.className='';
  try {
    const r = await fetch(CFG.SUPABASE_URL+'/functions/v1/discord-auth',{method:'POST',headers:{'Content-Type':'application/json','apikey':CFG.SUPABASE_ANON_KEY},body:JSON.stringify({code,redirect_uri:CFG.REDIRECT_URI})});
    if(r.status===404){showLoginError('Edge function not deployed.'); return;}
    if(r.status===401){showLoginError('Invalid Supabase anon key.'); return;}
    const data=await r.json();
    if(data.error){showLoginError('Auth error: '+data.error); return;}
    saveUser(data.user);
    window.history.replaceState({},document.title,window.location.origin+window.location.pathname);
    bootApp();
  } catch(e){ showLoginError('Network error — edge function unreachable.'); }
}

function showLoginError(m) { const e=document.getElementById('login-error'); e.textContent=m; e.style.display='block'; e.className='visible'; }

/* ─── UI Toggling ─────────────────────────────────────────────── */
function showLogin() {
  document.getElementById('topbar').style.display='none';
  document.getElementById('app').style.display='none';
  const lp=document.getElementById('page-login');
  lp.style.display=''; lp.classList.add('active');
}

function bootApp() {
  document.getElementById('page-login').style.display='none';
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('topbar').style.display='flex';
  document.getElementById('app').style.display='block';
  renderUserPill();
  populateFishDropdown();
  navigateTo('feed');
}

/* ─── User Pill & Dropdown ────────────────────────────────────── */
function renderUserPill() {
  const wrap=document.getElementById('user-pill-wrap');
  if(!currentUser){wrap.innerHTML=''; return;}
  wrap.innerHTML=`
    <div class="user-pill-wrap">
      <div class="user-pill" id="pill-btn" onclick="toggleDropdown()">
        <img src="${escHtml(currentUser.avatar)}" alt="" onerror="this.style.display='none'">
        <span class="pill-name">${escHtml(currentUser.username)}</span>
        <i class="fa-solid fa-chevron-down pill-chevron"></i>
      </div>
      <div class="profile-dropdown" id="profile-dropdown">
        <div class="dropdown-header">
          <img src="${escHtml(currentUser.avatar)}" alt="" onerror="this.style.display='none'">
          <div><div class="dh-name">${escHtml(currentUser.username)}</div><div class="dh-sub">FishBook angler</div></div>
        </div>
        <button class="dropdown-item" onclick="navigateTo('profile');closeDropdown()"><i class="fa-solid fa-user"></i> My Profile</button>
        <button class="dropdown-item" onclick="navigateTo('log');closeDropdown()"><i class="fa-solid fa-plus"></i> Log a Catch</button>
        <button class="dropdown-item" onclick="navigateTo('competitions');closeDropdown()"><i class="fa-solid fa-flag"></i> My Competitions</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" onclick="logout()"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out</button>
      </div>
    </div>`;
}

function toggleDropdown() {
  const p=document.getElementById('pill-btn'), d=document.getElementById('profile-dropdown');
  if(!p||!d) return;
  const open=d.classList.contains('open');
  d.classList.toggle('open',!open); p.classList.toggle('open',!open);
}

function closeDropdown() {
  document.getElementById('pill-btn')?.classList.remove('open');
  document.getElementById('profile-dropdown')?.classList.remove('open');
}

document.addEventListener('click', e => {
  const w=document.querySelector('.user-pill-wrap');
  if(w&&!w.contains(e.target)) closeDropdown();
});

/* ─── Navigation ──────────────────────────────────────────────── */
function navigateTo(page) {
  currentPage=page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('#topbar nav a').forEach(a=>a.classList.toggle('active',a.dataset.page===page));
  const t=document.getElementById('page-'+page);
  if(t) t.classList.add('active');
  if(page==='feed')         loadFeed();
  if(page==='leaderboard')  loadLeaderboard();
  if(page==='profile')      loadProfile(currentUser?.id);
  if(page==='log')          setupLogPage();
  if(page==='competitions') loadCompetitions();
}

/* ─── Feed ────────────────────────────────────────────────────── */
async function loadFeed() {
  const grid=document.getElementById('catches-grid');
  grid.innerHTML='<div class="loading-spinner"><div class="spinner"></div> Loading catches…</div>';
  try {
    const catches=await db('catches?select=*&order=caught_at.desc&limit=60');
    grid.innerHTML=catches.length
      ? catches.map(c=>catchCardHTML(c)).join('')
      : '<div class="empty-state"><i class="fa-solid fa-water"></i><p>No catches yet. Be the first!</p></div>';
  } catch(e) {
    grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>${escHtml(e.message)}</p></div>`;
  }
}

function catchCardHTML(c) {
  const rarity=getRarity(c.price_per_lb);
  const value=c.estimated_value??(c.weight_lbs*c.price_per_lb);
  const rarityBadge=rarity!=='common'?`<div class="rarity-badge ${rarity}">${rarity==='legendary'?'Legendary':'Rare'}</div>`:'';
  const photoHTML=c.photo_url
    ?`<img src="${escHtml(c.photo_url)}" alt="${escHtml(c.fish_type)}" loading="lazy">`
    :`<i class="fa-solid fa-fish no-photo"></i>`;
  return `
    <div class="catch-card ${rarity}" onclick="openCatchModal(${escHtml(JSON.stringify(c))})">
      <div class="catch-photo">${photoHTML}${rarityBadge}</div>
      <div class="catch-card-body">
        <div class="catch-card-fish">${escHtml(c.fish_type)}</div>
        <div class="catch-card-meta">
          <div class="catch-card-weight"><i class="fa-solid fa-weight-scale"></i> ${c.weight_lbs} lbs</div>
          <div style="color:var(--brass-lt);font-weight:700;font-family:'Playfair Display',serif">${fmtMoney(value)}</div>
        </div>
        <div class="catch-card-hint"><i class="fa-solid fa-arrow-up-right-from-square"></i> Tap for details</div>
      </div>
    </div>`;
}

/* ─── Catch Modal ─────────────────────────────────────────────── */
async function openCatchModal(c) {
  const overlay=document.getElementById('catch-modal-overlay');
  const modal=document.getElementById('catch-modal');
  overlay.classList.add('open');

  const rarity=getRarity(c.price_per_lb);
  const value=c.estimated_value??(c.weight_lbs*c.price_per_lb);
  const rarityBadge=rarity!=='common'?`<span class="rarity-badge ${rarity}" style="position:static;display:inline-flex;margin-left:8px">${rarity==='legendary'?'Legendary':'Rare'}</span>`:'';
  const photoHTML=c.photo_url
    ?`<img src="${escHtml(c.photo_url)}" alt="">`
    :`<i class="fa-solid fa-fish no-photo"></i>`;

  modal.innerHTML=`
    <div class="modal-photo">
      ${photoHTML}
      <button class="modal-close" onclick="closeCatchModal()"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="modal-body">
      <div class="modal-fish-name">${escHtml(c.fish_type)}${rarityBadge}</div>
      <div class="modal-caught-by" onclick="loadProfile('${escHtml(c.user_id)}');navigateTo('profile');closeCatchModal()">
        <img src="${escHtml(c.avatar||'')}" alt="" onerror="this.style.display='none'">
        <span>Caught by <strong>${escHtml(c.username)}</strong></span>
        <i class="fa-solid fa-arrow-right" style="font-size:11px;margin-left:auto"></i>
      </div>
      <div class="modal-stats">
        <div class="modal-stat"><div class="msv">${c.weight_lbs} lbs</div><div class="msl">Weight</div></div>
        <div class="modal-stat"><div class="msv">$${c.price_per_lb}/lb</div><div class="msl">Market Price</div></div>
        <div class="modal-stat"><div class="msv">${fmtMoney(value)}</div><div class="msl">Est. Value</div></div>
      </div>
      <div style="font-size:12px;color:var(--mist);margin-bottom:20px"><i class="fa-regular fa-clock" style="margin-right:5px"></i>${timeAgo(c.caught_at)} &bull; ${new Date(c.caught_at).toLocaleDateString()}</div>
      <div class="modal-section-title">Other catches by ${escHtml(c.username)}</div>
      <div class="modal-other-catches" id="modal-other-catches">
        <div class="loading-spinner" style="padding:12px"><div class="spinner"></div></div>
      </div>
    </div>`;

  // Load other catches by same user
  try {
    const others=await db(`catches?user_id=eq.${encodeURIComponent(c.user_id)}&id=neq.${encodeURIComponent(c.id)}&select=*&order=caught_at.desc&limit=10`);
    const el=document.getElementById('modal-other-catches');
    if(!el) return;
    el.innerHTML=others.length
      ? others.map(o=>`
          <div class="other-catch-chip" onclick="closeCatchModal();setTimeout(()=>openCatchModal(${escHtml(JSON.stringify(o))}),200)">
            <div class="oc-fish">${escHtml(o.fish_type)}</div>
            <div class="oc-val">${fmtMoney(o.estimated_value??o.weight_lbs*o.price_per_lb)} &bull; ${o.weight_lbs}lbs</div>
          </div>`).join('')
      : '<div style="color:var(--mist);font-size:13px;padding:8px 0">No other catches yet.</div>';
  } catch(_){}
}

function closeCatchModal() {
  document.getElementById('catch-modal-overlay').classList.remove('open');
}

/* ─── Log Catch Page ──────────────────────────────────────────── */
function setupLogPage() {
  populateFishDropdown();
  const vp=document.getElementById('value-preview');
  if(vp) vp.textContent='—';
}

function populateFishDropdown() {
  const s=document.getElementById('fish-type-select');
  if(!s) return;
  s.innerHTML='<option value="">— Select fish —</option>'+
    FISH_PRICES.map(f=>`<option value="${escHtml(f.name)}" data-price="${f.price}">${escHtml(f.name)} — $${f.price}/lb</option>`).join('');
}

document.addEventListener('DOMContentLoaded',()=>{
  document.addEventListener('change',e=>{ if(e.target.id==='fish-type-select') updateValuePreview(); });
  document.addEventListener('input', e=>{ if(e.target.id==='weight-input') updateValuePreview(); });
  document.addEventListener('change',e=>{
    if(e.target.id==='photo-input'){
      const l=document.getElementById('photo-label-text');
      if(l) l.textContent=e.target.files.length>0?e.target.files[0].name:'Attach photo (optional)';
    }
  });
  // Close modal on overlay click
  document.getElementById('catch-modal-overlay')?.addEventListener('click',e=>{
    if(e.target===document.getElementById('catch-modal-overlay')) closeCatchModal();
  });
});

function updateValuePreview() {
  const s=document.getElementById('fish-type-select');
  const w=parseFloat(document.getElementById('weight-input')?.value)||0;
  const opt=s?.options[s.selectedIndex];
  const p=opt?parseFloat(opt.dataset.price):0;
  const el=document.getElementById('value-preview');
  if(el) el.textContent=p&&w?fmtMoney(p*w):'—';
}

async function submitCatch() {
  if(!currentUser){showToast('Please log in first.','error'); return;}
  const fishSel=document.getElementById('fish-type-select');
  const weightIn=document.getElementById('weight-input');
  const photoInput=document.getElementById('photo-input');
  const btn=document.getElementById('submit-btn');
  const fishName=fishSel?.value;
  const weight=parseFloat(weightIn?.value);
  const fishData=FISH_PRICES.find(f=>f.name===fishName);
  if(!fishName||!fishData){showToast('Please select a fish.','error'); return;}
  if(!weight||weight<=0){showToast('Please enter a valid weight.','error'); return;}
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Logging…';
  try {
    let photoUrl=null;
    if(photoInput?.files.length>0){
      const file=photoInput.files[0];
      const key=`${currentUser.id}/${Date.now()}.${file.name.split('.').pop()}`;
      const up=await supaFetch(`/storage/v1/object/catch-photos/${key}`,{method:'POST',headers:{'Content-Type':file.type},body:file});
      if(up.ok) photoUrl=`${CFG.SUPABASE_URL}/storage/v1/object/public/catch-photos/${key}`;
    }
    const [newCatch]=await db('catches',{method:'POST',body:JSON.stringify({
      user_id:currentUser.id,username:currentUser.username,avatar:currentUser.avatar,
      fish_type:fishName,weight_lbs:weight,price_per_lb:fishData.price,photo_url:photoUrl,
    })});

    // Also submit to selected competitions
    const selected=[...document.querySelectorAll('.comp-tag.selected')].map(t=>t.dataset.compId);
    for(const compId of selected){
      try {
        await db('competition_entries',{method:'POST',body:JSON.stringify({
          competition_id:compId,catch_id:newCatch.id,
          user_id:currentUser.id,username:currentUser.username,avatar:currentUser.avatar,
          fish_type:fishName,weight_lbs:weight,estimated_value:weight*fishData.price,photo_url:photoUrl,
        })});
      } catch(_){}
    }

    showToast('Catch logged!','success');
    fishSel.value=''; weightIn.value='';
    if(photoInput) photoInput.value='';
    document.getElementById('value-preview').textContent='—';
    const l=document.getElementById('photo-label-text');
    if(l) l.textContent='Attach photo (optional)';
    setTimeout(()=>navigateTo('feed'),800);
  } catch(e){showToast('Error: '+e.message,'error');}
  finally{btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-anchor"></i> Log Catch';}
}

async function loadCompTagsForLog() {
  const wrap=document.getElementById('comp-tags-wrap');
  if(!wrap||!currentUser) return;
  try {
    const members=await db(`competition_members?user_id=eq.${encodeURIComponent(currentUser.id)}&select=competition_id`);
    if(!members.length){wrap.innerHTML=''; return;}
    const ids=members.map(m=>m.competition_id).join(',');
    const comps=await db(`competitions?id=in.(${ids})&status=eq.active&select=*`);
    if(!comps.length){wrap.innerHTML=''; return;}
    wrap.innerHTML='<div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mist);margin-bottom:8px">Also submit to competition</div>'+
      comps.map(c=>`<div class="comp-tag" data-comp-id="${escHtml(c.id)}" onclick="this.classList.toggle('selected')"><i class="fa-solid fa-flag"></i>${escHtml(c.name)}</div>`).join('');
  } catch(_){}
}

/* ─── Leaderboard ─────────────────────────────────────────────── */
async function loadLeaderboard() {
  const podium=document.getElementById('lb-podium');
  const tbody=document.getElementById('lb-tbody');
  podium.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
  tbody.innerHTML='';
  try {
    const rows=await db('leaderboard_summary?select=*&order=total_value.desc&limit=50');
    if(!rows.length){podium.innerHTML='<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>No data yet.</p></div>'; return;}
    const top3=rows.slice(0,3);
    const positions=top3.length>=3
      ?[{data:top3[1],rank:2,cls:'second'},{data:top3[0],rank:1,cls:'first'},{data:top3[2],rank:3,cls:'third'}]
      :top3.map((d,i)=>({data:d,rank:i+1,cls:['first','second','third'][i]}));
    podium.innerHTML=positions.map(p=>podiumCardHTML(p.data,p.rank,p.cls)).join('');
    tbody.innerHTML=rows.map((r,i)=>`
      <tr onclick="loadProfile('${escHtml(r.user_id)}');navigateTo('profile')">
        <td class="rank-cell">${i+1}</td>
        <td><div class="lb-user-cell"><img src="${escHtml(r.avatar||'')}" alt="" onerror="this.style.display='none'"><span class="lb-username">${escHtml(r.username)}</span></div></td>
        <td>${escHtml(r.best_fish||'—')}</td>
        <td>${r.catch_count}</td>
        <td>${parseFloat(r.max_weight||0).toFixed(1)} lbs</td>
        <td class="lb-total-val">${fmtMoney(r.total_value)}</td>
      </tr>`).join('');
  } catch(e){podium.innerHTML=`<div class="empty-state"><p>${escHtml(e.message)}</p></div>`;}
}

function podiumCardHTML(r,rank,cls){
  const av=r.avatar?`<div class="podium-avatar"><img src="${escHtml(r.avatar)}" alt=""></div>`:`<div class="podium-avatar"><i class="fa-solid fa-user"></i></div>`;
  return `<div class="podium-card ${cls}" onclick="loadProfile('${escHtml(r.user_id)}');navigateTo('profile')">
    ${cls==='first'?'<div class="podium-crown"><i class="fa-solid fa-crown" style="color:#e0ad48"></i></div>':''}
    <div class="podium-rank">${rank}</div>${av}
    <div class="podium-name">${escHtml(r.username)}</div>
    <div class="podium-value">${fmtMoney(r.total_value)}</div>
    <div class="podium-sub">${r.catch_count} catch${r.catch_count!==1?'es':''}</div>
  </div>`;
}

/* ─── Competitions ────────────────────────────────────────────── */
function genCode() {
  return Math.random().toString(36).substring(2,8).toUpperCase();
}

async function loadCompetitions() {
  const list=document.getElementById('comp-list');
  list.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
  if(!currentUser) return;

  try {
    // Get comps the user owns or is a member of
    const [owned, memberships]=await Promise.all([
      db(`competitions?owner_id=eq.${encodeURIComponent(currentUser.id)}&select=*&order=created_at.desc`),
      db(`competition_members?user_id=eq.${encodeURIComponent(currentUser.id)}&select=competition_id`),
    ]);

    let joined=[];
    if(memberships.length){
      const ids=memberships.map(m=>m.competition_id).join(',');
      joined=await db(`competitions?id=in.(${ids})&owner_id=neq.${encodeURIComponent(currentUser.id)}&select=*&order=created_at.desc`);
    }

    const all=[...owned,...joined];
    list.innerHTML=all.length
      ? all.map(c=>compCardHTML(c)).join('')
      : '<div class="empty-state"><i class="fa-solid fa-flag"></i><p>No competitions yet. Create or join one.</p></div>';
  } catch(e){list.innerHTML=`<div class="empty-state"><p>${escHtml(e.message)}</p></div>`;}
}

function compCardHTML(c) {
  const isOwner=currentUser&&c.owner_id===currentUser.id;
  return `
    <div class="comp-card" onclick="viewComp('${escHtml(c.id)}')">
      <div class="comp-card-top">
        <div class="comp-card-name">${escHtml(c.name)}</div>
        <span class="comp-status-badge ${c.status}">${c.status==='active'?'Active':'Ended'}</span>
      </div>
      ${c.description?`<div class="comp-card-desc">${escHtml(c.description)}</div>`:''}
      <div class="comp-card-meta">
        <span><i class="fa-solid fa-${c.scoring==='value'?'dollar-sign':c.scoring==='weight'?'weight-scale':'fish'}"></i>${c.scoring==='value'?'By Value':c.scoring==='weight'?'By Weight':'By Count'}</span>
        ${isOwner?'<span><i class="fa-solid fa-crown"></i> Your comp</span>':''}
        <span style="margin-left:auto"><span class="comp-code">${escHtml(c.code)}</span></span>
      </div>
    </div>`;
}

async function viewComp(id) {
  try {
    const [comp]=await db(`competitions?id=eq.${encodeURIComponent(id)}&select=*`);
    if(!comp) return;
    activeComp=comp;
    renderCompDetail(comp);
  } catch(e){showToast('Error loading competition','error');}
}

async function renderCompDetail(comp) {
  const wrap=document.getElementById('comp-detail-wrap');
  const isOwner=currentUser&&comp.owner_id===currentUser.id;

  // Get entries + aggregate per user
  const entries=await db(`competition_entries?competition_id=eq.${encodeURIComponent(comp.id)}&select=*&order=entered_at.desc`);
  const members=await db(`competition_members?competition_id=eq.${encodeURIComponent(comp.id)}&select=*`);

  // Aggregate leaderboard
  const userMap={};
  for(const e of entries){
    if(!userMap[e.user_id]) userMap[e.user_id]={user_id:e.user_id,username:e.username,avatar:e.avatar,total_value:0,total_weight:0,catch_count:0,best_fish:null,best_val:0};
    const u=userMap[e.user_id];
    u.total_value+=parseFloat(e.estimated_value||0);
    u.total_weight+=parseFloat(e.weight_lbs||0);
    u.catch_count+=1;
    if((e.estimated_value||0)>u.best_val){u.best_val=e.estimated_value; u.best_fish=e.fish_type;}
  }

  const ranked=Object.values(userMap).sort((a,b)=>{
    if(comp.scoring==='weight') return b.total_weight-a.total_weight;
    if(comp.scoring==='count')  return b.catch_count-a.catch_count;
    return b.total_value-a.total_value;
  });

  const scoreLabel=comp.scoring==='weight'?'Weight':'Catches' && comp.scoring==='value'?'Value':comp.scoring==='weight'?'Weight':'Catches';
  const scoreVal=(u)=>comp.scoring==='weight'?u.total_weight.toFixed(1)+' lbs':comp.scoring==='count'?u.catch_count+' catches':fmtMoney(u.total_value);

  wrap.innerHTML=`
    <div class="comp-detail">
      <div class="comp-detail-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <h2>${escHtml(comp.name)}</h2>
            ${comp.description?`<div class="comp-detail-desc">${escHtml(comp.description)}</div>`:''}
            <div class="comp-detail-meta">
              <span><i class="fa-solid fa-user"></i>Hosted by ${escHtml(comp.owner_name)}</span>
              <span><i class="fa-solid fa-users"></i>${members.length} member${members.length!==1?'s':''}</span>
              <span><i class="fa-solid fa-fish"></i>${entries.length} entr${entries.length!==1?'ies':'y'}</span>
              <span class="comp-status-badge ${comp.status}">${comp.status==='active'?'Active':'Ended'}</span>
            </div>
          </div>
          <button onclick="closeCompDetail()" style="background:none;border:none;color:var(--mist);font-size:18px;cursor:pointer;padding:4px"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div title="Click to copy" onclick="navigator.clipboard.writeText('${escHtml(comp.code)}').then(()=>showToast('Code copied!','success'))" class="comp-big-code">
          <i class="fa-solid fa-copy" style="font-size:14px;margin-right:8px;opacity:.6"></i>${escHtml(comp.code)}
        </div>
        ${isOwner&&comp.status==='active'?`<button onclick="endComp('${escHtml(comp.id)}')" style="margin-top:12px;background:rgba(220,70,70,.15);border:1px solid rgba(220,70,70,.3);color:#e07070;padding:7px 14px;border-radius:6px;font-size:13px;cursor:pointer">End Competition</button>`:''}
      </div>
      <div class="comp-lb-table-wrap">
        ${ranked.length?`
        <table class="comp-lb-table">
          <thead><tr><th>#</th><th>Angler</th><th>Best Fish</th><th>Score</th></tr></thead>
          <tbody>
            ${ranked.map((u,i)=>`
              <tr>
                <td class="rank-cell">${i+1}</td>
                <td><div class="lb-user-cell"><img src="${escHtml(u.avatar||'')}" alt="" onerror="this.style.display='none'"><span class="lb-username">${escHtml(u.username)}</span></div></td>
                <td>${escHtml(u.best_fish||'—')}</td>
                <td class="comp-lb-val">${scoreVal(u)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        `:'<div class="empty-state" style="padding:32px"><i class="fa-solid fa-fish"></i><p>No entries yet.</p></div>'}
      </div>
    </div>`;
  wrap.scrollIntoView({behavior:'smooth',block:'start'});
}

function closeCompDetail() {
  document.getElementById('comp-detail-wrap').innerHTML='';
  activeComp=null;
}

async function createCompetition() {
  if(!currentUser){showToast('Please log in first.','error'); return;}
  const name=document.getElementById('comp-name-input')?.value?.trim();
  const desc=document.getElementById('comp-desc-input')?.value?.trim();
  const scoring=document.getElementById('comp-scoring-select')?.value||'value';
  if(!name){showToast('Please enter a competition name.','error'); return;}
  const btn=document.getElementById('btn-create-comp');
  btn.disabled=true; btn.textContent='Creating…';
  try {
    const code=genCode();
    const [comp]=await db('competitions',{method:'POST',body:JSON.stringify({
      code,name,description:desc||null,
      owner_id:currentUser.id,owner_name:currentUser.username,owner_avatar:currentUser.avatar,
      scoring,status:'active',
    })});
    // Auto-join as member
    await db('competition_members',{method:'POST',body:JSON.stringify({
      competition_id:comp.id,user_id:currentUser.id,username:currentUser.username,avatar:currentUser.avatar,
    })});
    document.getElementById('comp-name-input').value='';
    document.getElementById('comp-desc-input').value='';
    showToast('Competition created! Code: '+code,'success');
    loadCompetitions();
    setTimeout(()=>viewComp(comp.id),400);
  } catch(e){showToast('Error: '+e.message,'error');}
  finally{btn.disabled=false; btn.textContent='Create Competition';}
}

async function joinCompetition() {
  if(!currentUser){showToast('Please log in first.','error'); return;}
  const codeIn=document.getElementById('join-code-input');
  const code=codeIn?.value?.trim()?.toUpperCase();
  if(!code||code.length!==6){showToast('Enter a valid 6-digit code.','error'); return;}
  try {
    const comps=await db(`competitions?code=eq.${encodeURIComponent(code)}&select=*`);
    if(!comps.length){showToast('Competition not found.','error'); return;}
    const comp=comps[0];
    if(comp.status==='ended'){showToast('This competition has ended.','error'); return;}
    await db('competition_members',{method:'POST',body:JSON.stringify({
      competition_id:comp.id,user_id:currentUser.id,username:currentUser.username,avatar:currentUser.avatar,
    })});
    codeIn.value='';
    showToast('Joined "'+comp.name+'"!','success');
    loadCompetitions();
    setTimeout(()=>viewComp(comp.id),400);
  } catch(e){
    if(e.message.includes('unique')) showToast('You\'ve already joined this competition.','error');
    else showToast('Error: '+e.message,'error');
  }
}

async function endComp(id) {
  try {
    await supaFetch(`/rest/v1/competitions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'ended'})});
    showToast('Competition ended.','success');
    loadCompetitions();
    closeCompDetail();
  } catch(e){showToast('Error: '+e.message,'error');}
}

/* ─── Profile ─────────────────────────────────────────────────── */
async function loadProfile(userId) {
  if(!userId) userId=currentUser?.id;
  if(!userId) return;
  const hero=document.getElementById('profile-hero');
  const grid=document.getElementById('profile-catches-grid');
  hero.innerHTML='<div class="loading-spinner"><div class="spinner"></div></div>';
  grid.innerHTML='';
  try {
    const [lb,catches]=await Promise.all([
      db(`leaderboard_summary?user_id=eq.${encodeURIComponent(userId)}&select=*`),
      db(`catches?user_id=eq.${encodeURIComponent(userId)}&select=*&order=caught_at.desc`),
    ]);
    const u=lb[0]||{username:catches[0]?.username||'Unknown',avatar:catches[0]?.avatar||'',catch_count:catches.length,total_value:0,max_weight:0};
    const avg=u.catch_count>0?(u.total_value/u.catch_count):0;
    hero.innerHTML=`
      <div class="profile-avatar">${u.avatar?`<img src="${escHtml(u.avatar)}" alt="">`:'<i class="fa-solid fa-user"></i>'}</div>
      <div class="profile-info">
        <div class="profile-username">${escHtml(u.username)}</div>
        <div class="profile-since">${u.catch_count} catch${u.catch_count!==1?'es':''} logged</div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="stat-val">${u.catch_count}</div><div class="stat-label">Catches</div></div>
        <div class="profile-stat"><div class="stat-val">${fmtMoney(u.total_value)}</div><div class="stat-label">Total Earned</div></div>
        <div class="profile-stat"><div class="stat-val">${parseFloat(u.max_weight||0).toFixed(1)} lbs</div><div class="stat-label">Biggest</div></div>
        <div class="profile-stat"><div class="stat-val">${fmtMoney(avg)}</div><div class="stat-label">Avg/Catch</div></div>
      </div>`;
    grid.innerHTML=catches.length
      ?catches.map(c=>`
        <div class="profile-catch-card ${getRarity(c.price_per_lb)}" onclick="openCatchModal(${escHtml(JSON.stringify(c))})">
          <div class="profile-catch-img">${c.photo_url?`<img src="${escHtml(c.photo_url)}" alt="" loading="lazy">`:'<i class="fa-solid fa-fish"></i>'}</div>
          <div class="profile-catch-body">
            <div class="profile-catch-fish">${escHtml(c.fish_type)}</div>
            <div class="profile-catch-meta">
              <span>${c.weight_lbs} lbs</span>
              <span class="profile-catch-val">${fmtMoney(c.estimated_value??c.weight_lbs*c.price_per_lb)}</span>
            </div>
            <div style="font-size:11px;color:var(--mist);margin-top:4px">${timeAgo(c.caught_at)}</div>
          </div>
        </div>`).join('')
      :'<div class="empty-state"><i class="fa-solid fa-fish"></i><p>No catches yet.</p></div>';
  } catch(e){hero.innerHTML=`<div class="empty-state"><p>${escHtml(e.message)}</p></div>`;}
}

/* ─── Toast ───────────────────────────────────────────────────── */
function showToast(msg,type='success') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='show '+type;
  clearTimeout(t._t); t._t=setTimeout(()=>{t.className='';},3200);
}

/* ─── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',()=>{
  loadUser();
  const code=new URLSearchParams(window.location.search).get('code');
  if(code){showLogin(); handleOAuthCallback(code); return;}
  if(currentUser) bootApp(); else showLogin();

  document.getElementById('btn-discord-login')?.addEventListener('click',()=>{window.location.href=discordOAuthURL();});

  document.querySelectorAll('#topbar nav a[data-page]').forEach(a=>{
    a.addEventListener('click',e=>{e.preventDefault(); navigateTo(a.dataset.page);});
  });
});
