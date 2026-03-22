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
  if (!val) return '$0';
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

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── Supabase ────────────────────────────────────────────────── */
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
  if (!res.ok) throw new Error(await res.text());
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
  closeDropdown();
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
  errEl.style.display = 'none';
  errEl.className = '';

  try {
    const res = await fetch(CFG.SUPABASE_URL + '/functions/v1/discord-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': CFG.SUPABASE_ANON_KEY },
      body: JSON.stringify({ code, redirect_uri: CFG.REDIRECT_URI }),
    });

    if (res.status === 404) { showLoginError('Edge function not deployed. Run: supabase functions deploy discord-auth --no-verify-jwt'); return; }
    if (res.status === 401) { showLoginError('Invalid Supabase anon key. Check your config.js.'); return; }

    const data = await res.json();
    if (data.error) { showLoginError('Auth error: ' + data.error); return; }

    saveUser(data.user);
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
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

/* ─── Login / App toggling ────────────────────────────────────── */
function showLogin() {
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  const lp = document.getElementById('page-login');
  lp.style.display = '';
  lp.classList.add('active');
}

function bootApp() {
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-login').classList.remove('active');
  document.getElementById('topbar').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  renderUserPill();
  populateFishDropdown();
  navigateTo('feed');
}

/* ─── User Pill & Dropdown ────────────────────────────────────── */
function renderUserPill() {
  const wrap = document.getElementById('user-pill-wrap');
  if (!currentUser) { wrap.innerHTML = ''; return; }

  wrap.innerHTML = `
    <div class="user-pill-wrap">
      <div class="user-pill" id="pill-btn" onclick="toggleDropdown()">
        <img src="${escHtml(currentUser.avatar)}" alt="" onerror="this.style.display='none'">
        <span class="pill-name">${escHtml(currentUser.username)}</span>
        <i class="fa-solid fa-chevron-down pill-chevron"></i>
      </div>
      <div class="profile-dropdown" id="profile-dropdown">
        <div class="dropdown-header">
          <img src="${escHtml(currentUser.avatar)}" alt="" onerror="this.style.display='none'">
          <div>
            <div class="dh-name">${escHtml(currentUser.username)}</div>
            <div class="dh-sub">FishBook angler</div>
          </div>
        </div>
        <button class="dropdown-item" onclick="navigateTo('profile'); closeDropdown()">
          <i class="fa-solid fa-user"></i> My Profile
        </button>
        <button class="dropdown-item" onclick="navigateTo('log'); closeDropdown()">
          <i class="fa-solid fa-plus"></i> Log a Catch
        </button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" onclick="logout()">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
        </button>
      </div>
    </div>`;
}

function toggleDropdown() {
  const pill = document.getElementById('pill-btn');
  const dd   = document.getElementById('profile-dropdown');
  if (!pill || !dd) return;
  const isOpen = dd.classList.contains('open');
  if (isOpen) {
    dd.classList.remove('open');
    pill.classList.remove('open');
  } else {
    dd.classList.add('open');
    pill.classList.add('open');
  }
}

function closeDropdown() {
  const pill = document.getElementById('pill-btn');
  const dd   = document.getElementById('profile-dropdown');
  if (dd)   dd.classList.remove('open');
  if (pill) pill.classList.remove('open');
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.user-pill-wrap');
  if (wrap && !wrap.contains(e.target)) closeDropdown();
});

/* ─── Navigation ──────────────────────────────────────────────── */
function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#topbar nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  if (page === 'feed')        loadFeed();
  if (page === 'leaderboard') loadLeaderboard();
  if (page === 'profile')     loadProfile(currentUser?.id);
  if (page === 'log')         setupLogPage();
}

/* ─── Feed ────────────────────────────────────────────────────── */
async function loadFeed() {
  const stream = document.getElementById('catches-stream');
  stream.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading catches…</div>';

  try {
    const catches = await dbQuery('catches?select=*&order=caught_at.desc&limit=50');
    stream.innerHTML = catches.length
      ? catches.map(c => catchCardHTML(c)).join('')
      : '<div class="empty-state"><i class="fa-solid fa-water"></i><p>No catches yet. Be the first to log one!</p></div>';
  } catch (e) {
    stream.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i><p>Error: ${escHtml(e.message)}</p></div>`;
  }
}

function catchCardHTML(c) {
  const rarity  = getRarity(c.price_per_lb);
  const value   = c.estimated_value ?? (c.weight_lbs * c.price_per_lb);
  const tagHTML = rarity !== 'common'
    ? `<span class="rarity-tag ${rarity}">${rarity === 'legendary' ? 'Legendary' : 'Rare'}</span>` : '';

  const thumb = c.photo_url
    ? `<div class="catch-thumb"><img src="${escHtml(c.photo_url)}" alt="" loading="lazy"></div>`
    : `<div class="catch-thumb"><i class="fa-solid fa-fish"></i></div>`;

  return `
    <div class="catch-card ${rarity}">
      ${thumb}
      <div class="catch-info">
        <div class="catch-fish">${escHtml(c.fish_type)} ${tagHTML}</div>
        <div class="catch-meta">
          <span class="catch-user">
            <img src="${escHtml(c.avatar || '')}" alt="" onerror="this.style.display='none'">
            ${escHtml(c.username)}
          </span>
          <span><i class="fa-regular fa-clock"></i>${timeAgo(c.caught_at)}</span>
          <span><i class="fa-solid fa-weight-scale"></i>${c.weight_lbs} lbs</span>
        </div>
      </div>
      <div class="catch-value">
        <div class="amount">${formatMoney(value)}</div>
        <div class="rate">$${c.price_per_lb}/lb</div>
      </div>
    </div>`;
}

/* ─── Log Catch Page ──────────────────────────────────────────── */
function setupLogPage() {
  populateFishDropdown();
  document.getElementById('value-preview').textContent = '—';
}

function populateFishDropdown() {
  const sel = document.getElementById('fish-type-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Select fish —</option>' +
    FISH_PRICES.map(f =>
      `<option value="${escHtml(f.name)}" data-price="${f.price}">${escHtml(f.name)} — $${f.price}/lb</option>`
    ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  // Value preview
  document.addEventListener('change', (e) => {
    if (e.target.id === 'fish-type-select') updateValuePreview();
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'weight-input') updateValuePreview();
  });

  // Photo label
  document.addEventListener('change', (e) => {
    if (e.target.id === 'photo-input') {
      const label = document.getElementById('photo-label-text');
      if (label) label.textContent = e.target.files.length > 0 ? e.target.files[0].name : 'Attach photo (optional)';
    }
  });
});

function updateValuePreview() {
  const sel    = document.getElementById('fish-type-select');
  const weight = parseFloat(document.getElementById('weight-input')?.value) || 0;
  const opt    = sel?.options[sel.selectedIndex];
  const price  = opt ? parseFloat(opt.dataset.price) : 0;
  const prev   = document.getElementById('value-preview');
  if (prev) prev.textContent = price && weight ? formatMoney(price * weight) : '—';
}

async function submitCatch() {
  if (!currentUser) { showToast('Please log in first.', 'error'); return; }

  const fishSel    = document.getElementById('fish-type-select');
  const weightIn   = document.getElementById('weight-input');
  const photoInput = document.getElementById('photo-input');
  const btn        = document.getElementById('submit-btn');

  const fishName = fishSel?.value;
  const weight   = parseFloat(weightIn?.value);
  const fishData = FISH_PRICES.find(f => f.name === fishName);

  if (!fishName || !fishData) { showToast('Please select a fish.', 'error'); return; }
  if (!weight || weight <= 0) { showToast('Please enter a valid weight.', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging…';

  try {
    let photoUrl = null;

    if (photoInput?.files.length > 0) {
      const file = photoInput.files[0];
      const key  = `${currentUser.id}/${Date.now()}.${file.name.split('.').pop()}`;
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

    showToast('Catch logged!', 'success');
    fishSel.value   = '';
    weightIn.value  = '';
    if (photoInput) photoInput.value = '';
    document.getElementById('value-preview').textContent = '—';
    const lbl = document.getElementById('photo-label-text');
    if (lbl) lbl.textContent = 'Attach photo (optional)';

    // Go to feed to see the catch
    setTimeout(() => navigateTo('feed'), 800);
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-anchor"></i> Log Catch';
  }
}

/* ─── Leaderboard ─────────────────────────────────────────────── */
async function loadLeaderboard() {
  const podium = document.getElementById('lb-podium');
  const tbody  = document.getElementById('lb-tbody');
  podium.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  tbody.innerHTML  = '';

  try {
    const rows = await dbQuery('leaderboard_summary?select=*&order=total_value.desc&limit=50');

    if (!rows.length) {
      podium.innerHTML = '<div class="empty-state"><i class="fa-solid fa-trophy"></i><p>No data yet.</p></div>';
      return;
    }

    const top3 = rows.slice(0, 3);
    const positions = top3.length >= 3
      ? [{ data: top3[1], rank: 2, cls: 'second' }, { data: top3[0], rank: 1, cls: 'first' }, { data: top3[2], rank: 3, cls: 'third' }]
      : top3.map((d, i) => ({ data: d, rank: i+1, cls: ['first','second','third'][i] }));

    podium.innerHTML = positions.map(p => podiumCardHTML(p.data, p.rank, p.cls)).join('');

    tbody.innerHTML = rows.map((r, i) => `
      <tr onclick="loadProfile('${escHtml(r.user_id)}'); navigateTo('profile')">
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
      </tr>`).join('');
  } catch (e) {
    podium.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`;
  }
}

function podiumCardHTML(r, rank, cls) {
  const avatarHTML = r.avatar
    ? `<div class="podium-avatar"><img src="${escHtml(r.avatar)}" alt=""></div>`
    : `<div class="podium-avatar"><i class="fa-solid fa-user"></i></div>`;

  return `
    <div class="podium-card ${cls}" onclick="loadProfile('${escHtml(r.user_id)}'); navigateTo('profile')">
      ${cls === 'first' ? '<div class="podium-crown"><i class="fa-solid fa-crown" style="color:#e0ad48"></i></div>' : ''}
      <div class="podium-rank">${rank}</div>
      ${avatarHTML}
      <div class="podium-name">${escHtml(r.username)}</div>
      <div class="podium-value">${formatMoney(r.total_value)}</div>
      <div class="podium-sub">${r.catch_count} catch${r.catch_count !== 1 ? 'es' : ''}</div>
    </div>`;
}

/* ─── Profile ─────────────────────────────────────────────────── */
async function loadProfile(userId) {
  if (!userId) userId = currentUser?.id;
  if (!userId) return;

  const hero = document.getElementById('profile-hero');
  const grid = document.getElementById('profile-catches-grid');
  hero.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  grid.innerHTML = '';

  try {
    const [lb, catches] = await Promise.all([
      dbQuery(`leaderboard_summary?user_id=eq.${encodeURIComponent(userId)}&select=*`),
      dbQuery(`catches?user_id=eq.${encodeURIComponent(userId)}&select=*&order=caught_at.desc`),
    ]);

    const u = lb[0] || {
      username: catches[0]?.username || 'Unknown',
      avatar:   catches[0]?.avatar   || '',
      catch_count: catches.length,
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
        <div class="profile-since">${u.catch_count} catch${u.catch_count !== 1 ? 'es' : ''} logged</div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="stat-val">${u.catch_count}</div><div class="stat-label">Catches</div></div>
        <div class="profile-stat"><div class="stat-val">${formatMoney(u.total_value)}</div><div class="stat-label">Total Earned</div></div>
        <div class="profile-stat"><div class="stat-val">${parseFloat(u.max_weight || 0).toFixed(1)} lbs</div><div class="stat-label">Biggest Catch</div></div>
        <div class="profile-stat"><div class="stat-val">${formatMoney(avgVal)}</div><div class="stat-label">Avg per Catch</div></div>
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
    ? `<div class="profile-catch-img"><img src="${escHtml(c.photo_url)}" alt="" loading="lazy"></div>`
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
        <div style="font-size:11px;color:var(--mist);margin-top:5px">${timeAgo(c.caught_at)}</div>
      </div>
    </div>`;
}

/* ─── Toast ───────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 3200);
}

/* ─── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadUser();

  const code = new URLSearchParams(window.location.search).get('code');

  if (code) {
    showLogin();
    handleOAuthCallback(code);
    return;
  }

  if (currentUser) {
    bootApp();
  } else {
    showLogin();
  }

  document.getElementById('btn-discord-login')?.addEventListener('click', () => {
    window.location.href = getDiscordOAuthURL();
  });

  document.querySelectorAll('#topbar nav a[data-page]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); navigateTo(a.dataset.page); });
  });
});
