// FishBook — assets/app.js
// Third-party fan tool. Not affiliated with Roblox or West Coast Florida developers.

/* ─── Config ─────────────────────────────────────────────────── */
const CFG = (typeof window.FISHBOOK_CONFIG !== 'undefined') ? window.FISHBOOK_CONFIG : {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  DISCORD_CLIENT_ID: '',
  REDIRECT_URI: window.location.origin,
};

/* ─── Fish Prices ─────────────────────────────────────────────── */
const FISH_PRICES = [
  { name: 'Lady Fish',        price: 18  },
  { name: 'Stingray',         price: 22  },
  { name: 'Sea Trout',        price: 23  },
  { name: 'Black Drum',       price: 27  },
  { name: 'Sheepshead',       price: 28  },
  { name: 'Blue Marlin',      price: 28  },
  { name: 'Mangrove Snapper', price: 31  },
  { name: 'Bluefin Tuna',     price: 33  },
  { name: 'Redfish',          price: 35  },
  { name: 'Black Marlin',     price: 38  },
  { name: 'King Mackerel',    price: 40  },
  { name: 'Gag Grouper',      price: 40  },
  { name: 'Snook',            price: 42  },
  { name: 'Red Grouper',      price: 45  },
  { name: 'Amberjack',        price: 53  },
  { name: 'Wahoo',            price: 54  },
  { name: 'Red Snapper',      price: 57  },
  { name: 'Mahi Mahi',        price: 63  },
  { name: 'Cobia',            price: 67  },
  { name: 'Blacktip Shark',   price: 69  },
  { name: 'Hammerhead Shark', price: 79  },
  { name: 'Sailfish',         price: 80  },
  { name: 'Megalodon',        price: 237 },
  { name: 'Doomsday Fish',    price: 330 },
];

function getRarity(pricePerLb) {
  if (pricePerLb >= 237) return 'legendary';
  if (pricePerLb >= 79)  return 'rare';
  return 'common';
}

function formatMoney(val) {
  if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
  return '$' + Math.round(val).toLocaleString();
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 7)  return days + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

/* ─── Supabase Client ─────────────────────────────────────────── */
function supaFetch(path, opts = {}) {
  return fetch(CFG.SUPABASE_URL + path, {
    ...opts,
    headers: {
      'apikey': CFG.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + CFG.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {}),
    },
  });
}

async function dbQuery(path, opts = {}) {
  const res = await supaFetch('/rest/v1/' + path, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

/* ─── State ───────────────────────────────────────────────────── */
let currentUser = null;
let currentPage = 'feed';

/* ─── Auth ────────────────────────────────────────────────────── */
function loadUser() {
  try {
    const raw = localStorage.getItem('fishbook_user');
    if (raw) currentUser = JSON.parse(raw);
  } catch (_) { currentUser = null; }
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem('fishbook_user', JSON.stringify(user));
}

function logout() {
  currentUser = null;
  localStorage.removeItem('fishbook_user');
  window.location.hash = '';
  showLogin();
}

function getDiscordOAuthURL() {
  const params = new URLSearchParams({
    client_id: CFG.DISCORD_CLIENT_ID,
    redirect_uri: CFG.REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  return 'https://discord.com/api/oauth2/authorize?' + params;
}

async function handleOAuthCallback(code) {
  const errEl = document.getElementById('login-error');
  errEl.className = '';
  errEl.style.display = 'none';

  try {
    const res = await fetch(
      CFG.SUPABASE_URL + '/functions/v1/discord-auth',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_ANON_KEY },
        body: JSON.stringify({ code, redirect_uri: CFG.REDIRECT_URI }),
      }
    );

    if (res.status === 404) {
      showLoginError('Edge function not deployed. Run: supabase functions deploy discord-auth --no-verify-jwt');
      return;
    }
    if (res.status === 401) {
      showLoginError('Invalid Supabase anon key. Check your config.js.');
      return;
    }

    const data = await res.json();
    if (data.error) {
      showLoginError('Auth error: ' + data.error);
      return;
    }

    saveUser(data.user);
    // Clean up URL
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    bootApp();
  } catch (e) {
    showLoginError('Network error — edge function unreachable. Is it deployed?');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
  el.className = 'visible';
}

/* ─── UI: Login ───────────────────────────────────────────────── */
function showLogin() {
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  const loginPage = document.getElementById('page-login');
  loginPage.style.display = 'flex';
  loginPage.classList.add('active');
}

/* ─── UI: App ─────────────────────────────────────────────────── */
function bootApp() {
  document.getElementById('topbar').style.display = 'flex';
  document.getElementById('sidebar').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  document.getElementById('page-login').style.display = 'none';

  renderUserPill();
  renderNavMyProfile();
  populateFishDropdown();
  populatePriceList();
  navigateTo(currentPage);
}

function renderUserPill() {
  const wrap = document.getElementById('user-pill-wrap');
  if (!currentUser) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div class="user-pill" onclick="navigateTo('profile')">
      <img src="${escHtml(currentUser.avatar)}" alt="${escHtml(currentUser.username)}" onerror="this.style.display='none'">
      <span class="pill-name">${escHtml(currentUser.username)}</span>
    </div>
    <button class="btn-logout" onclick="logout()"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
  `;
}

function renderNavMyProfile() {
  const el = document.getElementById('nav-my-profile');
  if (currentUser) el.classList.add('visible');
  else el.classList.remove('visible');
}

/* ─── Navigation ──────────────────────────────────────────────── */
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#sidebar nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  if (page === 'feed')        loadFeed();
  if (page === 'leaderboard') loadLeaderboard();
  if (page === 'profile')     loadProfile(currentUser?.id);
}

/* ─── Feed Page ───────────────────────────────────────────────── */
function populateFishDropdown() {
  const sel = document.getElementById('fish-type-select');
  sel.innerHTML = '<option value="">— Select fish —</option>' +
    FISH_PRICES.map(f =>
      `<option value="${escHtml(f.name)}" data-price="${f.price}">${escHtml(f.name)} — $${f.price}/lb</option>`
    ).join('');
}

function populatePriceList() {
  const body = document.getElementById('price-list-body');
  body.innerHTML = FISH_PRICES.map(f => {
    const rarity = getRarity(f.price);
    return `
      <div class="price-row">
        <span class="price-fish ${rarity}">${escHtml(f.name)}</span>
        <span class="price-val">$${f.price}/lb</span>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const fishSel = document.getElementById('fish-type-select');
  const weightIn = document.getElementById('weight-input');
  const valuePreview = document.getElementById('value-preview');
  const photoInput = document.getElementById('photo-input');
  const photoLabel = document.getElementById('photo-label-text');

  function updateValuePreview() {
    const opt = fishSel.options[fishSel.selectedIndex];
    const price = opt ? parseFloat(opt.dataset.price) : 0;
    const weight = parseFloat(weightIn.value) || 0;
    const val = price * weight;
    valuePreview.textContent = val > 0 ? formatMoney(val) : '—';
  }

  fishSel.addEventListener('change', updateValuePreview);
  weightIn.addEventListener('input', updateValuePreview);

  photoInput.addEventListener('change', () => {
    if (photoInput.files.length > 0) {
      photoLabel.textContent = photoInput.files[0].name;
    } else {
      photoLabel.textContent = 'Attach photo (optional)';
    }
  });
});

async function submitCatch() {
  if (!currentUser) { showToast('Please log in first.', 'error'); return; }

  const fishSel   = document.getElementById('fish-type-select');
  const weightIn  = document.getElementById('weight-input');
  const photoInput = document.getElementById('photo-input');
  const btn       = document.getElementById('submit-btn');

  const fishName = fishSel.value;
  const weight   = parseFloat(weightIn.value);
  const fishData = FISH_PRICES.find(f => f.name === fishName);

  if (!fishName || !fishData) { showToast('Please select a fish.', 'error'); return; }
  if (!weight || weight <= 0) { showToast('Please enter a valid weight.', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging catch...';

  try {
    let photoUrl = null;

    // Upload photo if provided
    if (photoInput.files.length > 0) {
      const file = photoInput.files[0];
      const ext  = file.name.split('.').pop();
      const key  = `${currentUser.id}/${Date.now()}.${ext}`;

      const uploadRes = await supaFetch(`/storage/v1/object/catch-photos/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (uploadRes.ok) {
        photoUrl = `${CFG.SUPABASE_URL}/storage/v1/object/public/catch-photos/${key}`;
      }
    }

    await dbQuery('catches', {
      method: 'POST',
      body: JSON.stringify({
        user_id:      currentUser.id,
        username:     currentUser.username,
        avatar:       currentUser.avatar,
        fish_type:    fishName,
        weight_lbs:   weight,
        price_per_lb: fishData.price,
        photo_url:    photoUrl,
      }),
    });

    showToast('Catch logged! Great haul.', 'success');
    fishSel.value   = '';
    weightIn.value  = '';
    document.getElementById('value-preview').textContent = '—';
    photoInput.value = '';
    document.getElementById('photo-label-text').textContent = 'Attach photo (optional)';
    loadFeed();
  } catch (e) {
    showToast('Error logging catch: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-fish"></i> Log Catch';
  }
}

async function loadFeed() {
  const stream = document.getElementById('catches-stream');
  const lbWrap = document.getElementById('mini-lb-list');

  stream.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading catches…</div>';
  lbWrap.innerHTML = '<div class="loading-spinner" style="padding:12px"><div class="spinner"></div></div>';

  try {
    const [catches, lb] = await Promise.all([
      dbQuery('catches?select=*&order=caught_at.desc&limit=40'),
      dbQuery('leaderboard_summary?select=*&order=total_value.desc&limit=5'),
    ]);

    stream.innerHTML = catches.length
      ? catches.map(c => catchCardHTML(c)).join('')
      : '<div class="empty-state"><i class="fa-solid fa-water"></i><p>No catches yet. Log the first one!</p></div>';

    lbWrap.innerHTML = lb.length
      ? lb.map((r, i) => miniLbRowHTML(r, i + 1)).join('')
      : '<div class="empty-state" style="padding:16px"><p>No entries yet.</p></div>';
  } catch (e) {
    stream.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Error loading: ${escHtml(e.message)}</p></div>`;
  }
}

function catchCardHTML(c) {
  const rarity  = getRarity(c.price_per_lb);
  const value   = c.estimated_value ?? (c.weight_lbs * c.price_per_lb);
  const tagHTML = rarity !== 'common'
    ? `<span class="rarity-tag ${rarity}">${rarity === 'legendary' ? 'Legendary' : 'Rare'}</span>` : '';

  const thumb = c.photo_url
    ? `<div class="catch-thumb"><img src="${escHtml(c.photo_url)}" alt="${escHtml(c.fish_type)}" loading="lazy"></div>`
    : `<div class="catch-thumb"><i class="fa-solid fa-fish"></i></div>`;

  return `
    <div class="catch-card ${rarity}">
      ${thumb}
      <div class="catch-info">
        <div class="catch-fish">
          ${escHtml(c.fish_type)}
          ${tagHTML}
        </div>
        <div class="catch-meta">
          <span class="catch-user">
            <img src="${escHtml(c.avatar || '')}" alt="" onerror="this.style.display='none'">
            ${escHtml(c.username)}
          </span>
          <span><i class="fa-regular fa-clock"></i> ${timeAgo(c.caught_at)}</span>
          <span><i class="fa-solid fa-weight-scale"></i> ${c.weight_lbs} lbs</span>
        </div>
      </div>
      <div class="catch-value">
        <div class="amount">${formatMoney(value)}</div>
        <div class="weight">$${c.price_per_lb}/lb</div>
      </div>
    </div>`;
}

function miniLbRowHTML(r, rank) {
  const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  return `
    <div class="mini-lb-row" onclick="loadProfile('${escHtml(r.user_id)}'); navigateTo('profile')" style="cursor:pointer">
      <span class="mini-lb-rank ${rankClass}">${rank}</span>
      <img class="mini-lb-avatar" src="${escHtml(r.avatar || '')}" alt="" onerror="this.src='data:image/svg+xml,<svg/>'">
      <div class="mini-lb-info">
        <div class="mini-lb-name">${escHtml(r.username)}</div>
        <div class="mini-lb-val">${formatMoney(r.total_value)}</div>
      </div>
    </div>`;
}

/* ─── Leaderboard Page ────────────────────────────────────────── */
async function loadLeaderboard() {
  const podium = document.getElementById('lb-podium');
  const tbody  = document.getElementById('lb-tbody');

  podium.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading…</div>';
  tbody.innerHTML  = '';

  try {
    const rows = await dbQuery('leaderboard_summary?select=*&order=total_value.desc&limit=50');

    if (!rows.length) {
      podium.innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>No leaderboard data yet.</p></div>';
      return;
    }

    // Podium (top 3)
    const top3 = rows.slice(0, 3);
    const positions = top3.length >= 3
      ? [{ data: top3[1], rank: 2, cls: 'second' }, { data: top3[0], rank: 1, cls: 'first' }, { data: top3[2], rank: 3, cls: 'third' }]
      : top3.map((d, i) => ({ data: d, rank: i + 1, cls: ['first', 'second', 'third'][i] }));

    podium.innerHTML = positions.map(p => podiumCardHTML(p.data, p.rank, p.cls)).join('');

    // Table
    tbody.innerHTML = rows.map((r, i) => `
      <tr onclick="loadProfile('${escHtml(r.user_id)}'); navigateTo('profile')" style="cursor:pointer">
        <td class="rank-cell">${i + 1}</td>
        <td>
          <div class="lb-user-cell">
            <img src="${escHtml(r.avatar || '')}" alt="" onerror="this.style.display='none'">
            <span class="lb-username">${escHtml(r.username)}</span>
          </div>
        </td>
        <td>${escHtml(r.best_fish || '—')}</td>
        <td>${r.catch_count}</td>
        <td>${parseFloat(r.max_weight || 0).toFixed(1)} lbs</td>
        <td class="lb-total-val">${formatMoney(r.total_value)}</td>
      </tr>
    `).join('');
  } catch (e) {
    podium.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>${escHtml(e.message)}</p></div>`;
  }
}

function podiumCardHTML(r, rank, cls) {
  const crownMap = { first: '<i class="fa-solid fa-crown" style="color:#d4a017"></i>', second: '', third: '' };
  const avatarHTML = r.avatar
    ? `<div class="podium-avatar"><img src="${escHtml(r.avatar)}" alt=""></div>`
    : `<div class="podium-avatar"><i class="fa-solid fa-user"></i></div>`;

  return `
    <div class="podium-card ${cls}" onclick="loadProfile('${escHtml(r.user_id)}'); navigateTo('profile')" style="cursor:pointer">
      ${cls === 'first' ? `<div class="podium-crown">${crownMap.first}</div>` : ''}
      <div class="podium-rank">${rank}</div>
      ${avatarHTML}
      <div class="podium-name">${escHtml(r.username)}</div>
      <div class="podium-value">${formatMoney(r.total_value)}</div>
      <div class="podium-sub">${r.catch_count} catch${r.catch_count !== 1 ? 'es' : ''}</div>
    </div>`;
}

/* ─── Profile Page ────────────────────────────────────────────── */
let profileUserId = null;

async function loadProfile(userId) {
  if (!userId) { userId = currentUser?.id; }
  if (!userId) return;
  profileUserId = userId;

  const hero    = document.getElementById('profile-hero');
  const grid    = document.getElementById('profile-catches-grid');

  hero.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  grid.innerHTML = '';

  try {
    const [lb, catches] = await Promise.all([
      dbQuery(`leaderboard_summary?user_id=eq.${encodeURIComponent(userId)}&select=*`),
      dbQuery(`catches?user_id=eq.${encodeURIComponent(userId)}&select=*&order=caught_at.desc`),
    ]);

    const summary = lb[0];
    const u = summary || {
      username: catches[0]?.username || 'Unknown',
      avatar:   catches[0]?.avatar   || '',
      catch_count: 0,
      total_value: 0,
      max_weight:  0,
    };

    const avgVal = u.catch_count > 0 ? (u.total_value / u.catch_count) : 0;

    hero.innerHTML = `
      <div class="profile-avatar">
        ${u.avatar ? `<img src="${escHtml(u.avatar)}" alt="">` : '<i class="fa-solid fa-user"></i>'}
      </div>
      <div class="profile-info">
        <div class="profile-username">${escHtml(u.username)}</div>
        <div class="profile-since">${catches.length} catch${catches.length !== 1 ? 'es' : ''} logged</div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="stat-val">${u.catch_count}</div>
          <div class="stat-label">Catches</div>
        </div>
        <div class="profile-stat">
          <div class="stat-val">${formatMoney(u.total_value || 0)}</div>
          <div class="stat-label">Total Earned</div>
        </div>
        <div class="profile-stat">
          <div class="stat-val">${parseFloat(u.max_weight || 0).toFixed(1)} lbs</div>
          <div class="stat-label">Biggest Catch</div>
        </div>
        <div class="profile-stat">
          <div class="stat-val">${formatMoney(avgVal)}</div>
          <div class="stat-label">Avg per Catch</div>
        </div>
      </div>`;

    grid.innerHTML = catches.length
      ? catches.map(c => profileCatchCardHTML(c)).join('')
      : '<div class="empty-state"><i class="fa-solid fa-fish"></i><p>No catches yet.</p></div>';
  } catch (e) {
    hero.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`;
  }
}

function profileCatchCardHTML(c) {
  const rarity = getRarity(c.price_per_lb);
  const value  = c.estimated_value ?? (c.weight_lbs * c.price_per_lb);
  const tagHTML = rarity !== 'common'
    ? `<span class="rarity-tag ${rarity}">${rarity === 'legendary' ? 'Legendary' : 'Rare'}</span>` : '';

  const imgHTML = c.photo_url
    ? `<div class="profile-catch-img"><img src="${escHtml(c.photo_url)}" alt="${escHtml(c.fish_type)}" loading="lazy"></div>`
    : `<div class="profile-catch-img"><i class="fa-solid fa-fish"></i></div>`;

  return `
    <div class="profile-catch-card ${rarity}">
      ${imgHTML}
      <div class="profile-catch-body">
        <div class="profile-catch-fish">${escHtml(c.fish_type)} ${tagHTML}</div>
        <div class="profile-catch-meta">
          <span><i class="fa-solid fa-weight-scale"></i> ${c.weight_lbs} lbs</span>
          <span class="profile-catch-val">${formatMoney(value)}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${timeAgo(c.caught_at)}</div>
      </div>
    </div>`;
}

/* ─── Toast ───────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'show ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = ''; }, 3500);
}

/* ─── Escape HTML ─────────────────────────────────────────────── */
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadUser();

  const params = new URLSearchParams(window.location.search);
  const code   = params.get('code');

  if (code) {
    // OAuth callback
    showLogin();
    handleOAuthCallback(code);
    return;
  }

  if (currentUser) {
    bootApp();
  } else {
    showLogin();
  }

  // Discord OAuth button
  document.getElementById('btn-discord-login').addEventListener('click', () => {
    window.location.href = getDiscordOAuthURL();
  });

  // Nav links
  document.querySelectorAll('#sidebar nav a[data-page]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(a.dataset.page);
    });
  });
});
