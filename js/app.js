/* =========================================
   SANGAM - Main Application (app.js)
   Pure Vanilla JS PWA
   ========================================= */

'use strict';

/* =========================================
   1. APP STATE
   ========================================= */
const AppState = {
  currentPage: 'home',
  activeFeedTab: 'all',
  feedFilter: { batch: 'all', role: 'all' },
  likedPosts: new Set(),
  sidebarOpen: false
};

/* =========================================
   2. DOM HELPERS
   ========================================= */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const el = (tag, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/* =========================================
   3. PWA — SERVICE WORKER REGISTRATION
   ========================================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');
      console.log('[App] Service Worker registered:', reg.scope);
    } catch (err) {
      console.warn('[App] SW registration failed:', err);
    }
  });
}

/* =========================================
   4. PWA — INSTALL PROMPT
   ========================================= */
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = $('#install-banner');
  if (banner) banner.classList.add('show');
});

function handleInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(choice => {
    if (choice.outcome === 'accepted') showToast('✅ Sangam installed!');
    deferredInstallPrompt = null;
    const banner = $('#install-banner');
    if (banner) banner.classList.remove('show');
  });
}

function dismissInstallBanner() {
  const banner = $('#install-banner');
  if (banner) banner.classList.remove('show');
}

/* =========================================
   5. TOAST NOTIFICATIONS
   ========================================= */
function showToast(msg, duration = 2600) {
  const container = $('#toast-container');
  const toast = el('div', 'toast', msg);
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* =========================================
   6. NAVIGATION
   ========================================= */
function navigate(page) {
  if (AppState.currentPage === page) return;
  AppState.currentPage = page;

  // Update page views
  $$('.page-view').forEach(v => v.classList.remove('active'));
  const target = $(`#page-${page}`);
  if (target) target.classList.add('active');

  // Update nav items
  $$('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  // Show/hide FAB
  const fab = $('#fab-btn');
  if (fab) fab.style.display = page === 'activity' ? 'flex' : 'none';

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* =========================================
   7. SIDEBAR
   ========================================= */
function toggleSidebar(open) {
  AppState.sidebarOpen = open !== undefined ? open : !AppState.sidebarOpen;
  const sidebar = $('#sidebar');
  const overlay = $('#sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open', AppState.sidebarOpen);
  if (overlay) overlay.classList.toggle('active', AppState.sidebarOpen);
  document.body.style.overflow = AppState.sidebarOpen ? 'hidden' : '';
}

/* =========================================
   8. RENDER: HOME PAGE
   ========================================= */
function renderHome() {
  const container = $('#home-dynamic');
  if (!container) return;

  const { stats, featuredAlumni, announcements, whatWeDo } = SANGAM_DATA;

  container.innerHTML = `
    <!-- Hero Banner -->
    <div class="hero-banner">
      <div class="college-name-tag">Government Engineering College Raipur</div>
      <h1 class="hero-title">
        <span class="text-gradient">Alumni Association</span>
      </h1>
      <p class="hero-slogan">विद्या नित्यं संयोजयति</p>
      <div class="hero-cta">
        <button class="btn btn-primary btn-sm" onclick="showToast('🎉 Welcome to Sangam!')">Join Network</button>
        <button class="btn btn-outline btn-sm" onclick="navigate('activity')">Explore Feed</button>
      </div>
    </div>

    <!-- About -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">About Us</h2>
      </div>
      <div class="about-card">
        <p>The Alumni Association of GEC is a vibrant community of over 12,000 graduates who stay connected through <strong style="color:var(--primary-light)">Sangam</strong> — our unified platform for mentorship, placements, events, and giving back. We bridge the gap between students and industry every single day.</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="section" style="padding-top:0">
      <div class="section-header">
        <h2 class="section-title">Our Impact</h2>
      </div>
      <div class="stats-grid">
        ${stats.map(s => `
          <div class="stat-card">
            <div class="stat-icon">${s.icon}</div>
            <div class="stat-value">${s.value}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- What We Do -->
    <div class="section" style="padding-top:0">
      <div class="section-header">
        <h2 class="section-title">What We Do</h2>
      </div>
      <div class="what-grid">
        ${whatWeDo.map(w => `
          <div class="what-card">
            <div class="what-icon">${w.icon}</div>
            <div class="what-title">${w.title}</div>
            <div class="what-desc">${w.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Featured Alumni -->
    <div class="section" style="padding-top:0">
      <div class="section-header">
        <h2 class="section-title">Featured Alumni</h2>
        <span class="section-link" onclick="navigate('activity')">See all →</span>
      </div>
      <div class="alumni-scroll">
        ${featuredAlumni.map(a => `
          <div class="alumni-card" onclick="showToast('👤 Viewing ${a.name}')">
            <div class="alumni-avatar" style="background:${a.color}">${a.initials}</div>
            <div class="alumni-name">${a.name}</div>
            <div class="alumni-detail">${a.branch} · ${a.batch}</div>
            <div class="alumni-detail">${a.role}</div>
            <span class="alumni-company-tag">${a.company}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Announcements -->
    <div class="section" style="padding-top:0; padding-bottom: var(--space-xl)">
      <div class="section-header">
        <h2 class="section-title">Announcements</h2>
        <span class="section-link">View all →</span>
      </div>
      <div class="announce-list">
        ${announcements.map(a => `
          <div class="announce-card" onclick="showToast('📢 ${a.title}')">
            <div class="announce-left">
              <span class="announce-tag" style="background:${a.tagColor}">${a.tag}</span>
            </div>
            <div class="announce-right">
              <div class="announce-title">${a.title}</div>
              <div class="announce-body">${a.body}</div>
              <div class="announce-date">📅 ${a.date}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* =========================================
   9. RENDER: ACTIVITY FEED
   ========================================= */
function renderFeed() {
  const list = $('#feed-list');
  if (!list) return;

  let posts = [...SANGAM_DATA.posts];

  // Apply tab filter
  if (AppState.activeFeedTab === 'following') {
    posts = posts.filter(p => p.role === 'Alumni');
  }

  // Apply batch filter
  if (AppState.feedFilter.batch !== 'all') {
    posts = posts.filter(p => p.batch === AppState.feedFilter.batch);
  }

  // Apply role filter
  if (AppState.feedFilter.role !== 'all') {
    posts = posts.filter(p => p.role === AppState.feedFilter.role);
  }

  if (posts.length === 0) {
    list.innerHTML = `
      <div style="text-align:center; padding: var(--space-2xl) var(--space-md); color: var(--text-muted);">
        <div style="font-size:48px; margin-bottom:var(--space-md)">🔍</div>
        <div style="font-size:15px; font-weight:600; color:var(--text-secondary)">No posts found</div>
        <div style="font-size:12px; margin-top:6px">Try changing your filters</div>
      </div>
    `;
    return;
  }

  list.innerHTML = posts.map((post, idx) => {
    const isLiked = AppState.likedPosts.has(post.id);
    const likes = isLiked && !post.liked
      ? post.likes + 1
      : !isLiked && post.liked
      ? post.likes - 1
      : post.likes;

    return `
      <div class="post-card" style="animation-delay:${idx * 0.06}s">
        <div class="post-header">
          <div class="post-avatar" style="background:${post.color}">${post.initials}</div>
          <div class="post-meta">
            <div class="post-name">
              ${post.user}
              <span class="role-badge ${post.role.toLowerCase()}">${post.role}</span>
            </div>
            <div class="post-sub">${post.branch} · Batch ${post.batch} · ${post.time}</div>
          </div>
          <span class="post-type-chip ${post.type}">${post.typeLabel}</span>
        </div>
        <div class="post-body">${post.content}</div>
        <div class="post-actions">
          <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${post.id}, this)">
            <span class="a-icon">${isLiked ? '❤️' : '🤍'}</span>
            <span class="like-count">${likes}</span>
          </button>
          <button class="action-btn" onclick="showToast('💬 Comments coming soon!')">
            <span class="a-icon">💬</span>
            <span>${post.comments}</span>
          </button>
          <button class="action-btn" style="margin-left:auto" onclick="showToast('🔗 Link copied!')">
            <span class="a-icon">↗️</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleLike(postId, btn) {
  if (AppState.likedPosts.has(postId)) {
    AppState.likedPosts.delete(postId);
    btn.classList.remove('liked');
    btn.querySelector('.a-icon').textContent = '🤍';
    const post = SANGAM_DATA.posts.find(p => p.id === postId);
    btn.querySelector('.like-count').textContent = post.liked ? post.likes - 1 : post.likes;
    showToast('💔 Unliked');
  } else {
    AppState.likedPosts.add(postId);
    btn.classList.add('liked');
    btn.querySelector('.a-icon').textContent = '❤️';
    const post = SANGAM_DATA.posts.find(p => p.id === postId);
    btn.querySelector('.like-count').textContent = post.liked ? post.likes : post.likes + 1;
    // Heart animation
    btn.style.transform = 'scale(1.3)';
    setTimeout(() => btn.style.transform = '', 200);
    showToast('❤️ Liked!');
  }
}

function switchFeedTab(tab) {
  AppState.activeFeedTab = tab;
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderFeed();
}

function applyFeedFilter(type, value) {
  AppState.feedFilter[type] = value;
  renderFeed();
}

/* =========================================
   10. RENDER: CHAT PAGE
   ========================================= */
function renderChat() {
  const list = $('#chat-list');
  if (!list) return;

  list.innerHTML = SANGAM_DATA.chats.map(chat => `
    <div class="chat-item" onclick="showToast('💬 Opening chat with ${chat.name}...')">
      <div class="chat-avatar-wrap">
        <div class="chat-avatar" style="background:${chat.color}">${chat.initials}</div>
        ${chat.online ? '<span class="online-dot"></span>' : ''}
      </div>
      <div class="chat-info">
        <div class="chat-name">
          ${chat.name}
          ${chat.isGroup ? '<span class="group-icon">GROUP</span>' : ''}
        </div>
        <div class="chat-preview">${chat.lastMessage}</div>
      </div>
      <div class="chat-time-wrap">
        <span class="chat-time">${chat.time}</span>
        ${chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : ''}
      </div>
    </div>
  `).join('');
}

/* =========================================
   11. RENDER: ID CARD
   ========================================= */
function renderCard() {
  const container = $('#card-container');
  if (!container) return;

  const u = SANGAM_DATA.currentUser;
  // Generate barcode-like lines
  const barLines = Array.from({length: 28}, (_, i) => {
    const h = 12 + Math.random() * 20;
    return `<span style="height:${h}px;opacity:${0.4+Math.random()*0.6}"></span>`;
  }).join('');

  container.innerHTML = `
    <div class="id-card">
      <div class="card-top-band"></div>
      <div class="card-header">
        <div class="college-logo-card">🏛</div>
        <div class="college-name-card">Government Engineering College<br>Alumni & Student Network</div>
      </div>
      <div class="card-watermark">GEC</div>
      <div class="card-body">
        <div class="card-photo-section">
          <div class="card-photo" style="background:${u.color}">${u.initials}</div>
          <div class="card-name-section">
            <div class="card-user-name">${u.name}</div>
            <span class="card-role-badge">🎓 ${u.role}</span>
          </div>
        </div>
        <div class="card-divider"></div>
        <div class="card-fields">
          <div class="card-field">
            <span class="field-label">Branch</span>
            <span class="field-value">CSE</span>
          </div>
          <div class="card-field">
            <span class="field-label">Year</span>
            <span class="field-value">3rd Year</span>
          </div>
          <div class="card-field">
            <span class="field-label">Batch</span>
            <span class="field-value">2022–2026</span>
          </div>
          <div class="card-field">
            <span class="field-label">Roll No.</span>
            <span class="field-value">GEC-CSE-22-047</span>
          </div>
          <div class="card-field">
            <span class="field-label">Valid Till</span>
            <span class="field-value">May 2026</span>
          </div>
        </div>
      </div>
      <div class="card-barcode">
        <div class="barcode-lines">${barLines}</div>
        <div class="card-id-number">GEC · 22 · CSE · 047</div>
      </div>
    </div>

    <div class="card-actions">
      <button class="btn btn-primary" style="flex:1" onclick="showToast('📲 Card shared!')">
        ↗ Share Card
      </button>
      <button class="btn btn-outline btn-icon-only" onclick="showToast('📥 Downloading...')">
        ⬇
      </button>
      <button class="btn btn-outline btn-icon-only" onclick="showToast('🔗 QR Code coming soon!')">
        ⬛
      </button>
    </div>
  `;
}

/* =========================================
   12. RENDER: PROFILE PAGE
   ========================================= */
function renderProfile() {
  const container = $('#profile-dynamic');
  if (!container) return;

  const u = SANGAM_DATA.currentUser;

  container.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" style="background:${u.color}">${u.initials}</div>
        <div class="profile-edit-badge" onclick="showToast('📷 Change photo')">✏️</div>
      </div>
      <div class="profile-name">${u.name}</div>
      <div class="profile-detail">${u.branch}</div>
      <div class="profile-detail">${u.year}</div>
      <span class="profile-role-tag">🎓 ${u.role} · Batch ${u.batch}</span>
    </div>

    <div class="profile-stats-row">
      <div class="pstat">
        <div class="pstat-val">${u.posts}</div>
        <div class="pstat-label">Posts</div>
      </div>
      <div class="pstat">
        <div class="pstat-val">${u.connections}</div>
        <div class="pstat-label">Connections</div>
      </div>
      <div class="pstat">
        <div class="pstat-val">${u.followers}</div>
        <div class="pstat-label">Followers</div>
      </div>
    </div>

    <div class="profile-bio">${u.bio}</div>

    <div class="skills-wrap">
      <div class="section-title" style="margin-bottom:var(--space-sm)">Skills</div>
      <div class="skills-list">
        ${u.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
        <span class="skill-tag" style="border-style:dashed;cursor:pointer;" onclick="showToast('➕ Add skill')">+ Add skill</span>
      </div>
    </div>

    <div class="profile-actions">
      <button class="btn btn-primary" style="flex:1" onclick="showToast('✏️ Opening edit mode...')">
        ✏️ Edit Profile
      </button>
      <button class="btn btn-outline" onclick="showToast('🔗 Profile link copied!')">
        Share ↗
      </button>
    </div>

    <!-- User Posts Preview -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Your Posts</h2>
        <span class="section-link" onclick="navigate('activity')">View all →</span>
      </div>
      <div style="
        background: var(--bg-card);
        border: 1px dashed var(--border);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        cursor: pointer;
      " onclick="navigate('activity')">
        <div style="font-size:32px; margin-bottom:8px">📝</div>
        Share your first post on the activity feed!
      </div>
    </div>
  `;
}

/* =========================================
   13. SIDEBAR SETUP
   ========================================= */
function setupSidebar() {
  const sidebar = $('#sidebar');
  if (!sidebar) return;

  const items = [
    { section: 'Explore', items: [
      { icon: '🏛', label: 'About College', action: () => showToast('🏛 Opening About...') },
      { icon: '📚', label: 'Branches', action: () => showToast('📚 Viewing branches...') },
      { icon: '👨‍🏫', label: 'Faculties', action: () => showToast('👨‍🏫 Faculty directory...') },
      { icon: '📢', label: 'Updates', action: () => { navigate('home'); toggleSidebar(false); } }
    ]},
    { section: 'Community', items: [
      { icon: '🤝', label: 'Mentorship', action: () => showToast('🤝 Find a mentor...') },
      { icon: '💼', label: 'Placements', action: () => showToast('💼 Placement cell...') },
      { icon: '🎉', label: 'Events', action: () => showToast('🎉 Upcoming events...') },
      { icon: '💰', label: 'Scholarships', action: () => showToast('💰 Apply now...') }
    ]},
    { section: 'Info', items: [
      { icon: '⚙️', label: 'Settings', action: () => showToast('⚙️ Settings...') },
      { icon: '👨‍💻', label: 'About Developer (VyomTech)', action: () => showToast('🚀 VyomTech — Building Sangam with ❤️') },
      { icon: '📄', label: 'Privacy Policy', action: () => showToast('📄 Privacy Policy') }
    ]}
  ];

  // Build sidebar nav
  const nav = sidebar.querySelector('.sidebar-nav');
  if (!nav) return;

  nav.innerHTML = items.map(section => `
    <div class="sidebar-section-label">${section.section}</div>
    ${section.items.map((item, i) => `
      <div class="sidebar-item" data-section="${section.section}" data-index="${i}">
        <div class="s-icon">${item.icon}</div>
        <span>${item.label}</span>
      </div>
    `).join('')}
  `).join('');

  // Attach click handlers
  nav.querySelectorAll('.sidebar-item').forEach(el => {
    el.addEventListener('click', () => {
      const secName = el.dataset.section;
      const idx = parseInt(el.dataset.index);
      const section = items.find(s => s.section === secName);
      if (section) {
        section.items[idx].action();
        toggleSidebar(false);
      }
    });
  });
}

/* =========================================
   14. EVENT BINDINGS
   ========================================= */
function bindEvents() {
  // Bottom nav
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  // Hamburger
  const hamburger = $('#hamburger-btn');
  if (hamburger) hamburger.addEventListener('click', () => toggleSidebar());

  // Sidebar overlay
  const overlay = $('#sidebar-overlay');
  if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));

  // Feed tab buttons
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchFeedTab(btn.dataset.tab));
  });

  // Feed filters
  const batchFilter = $('#filter-batch');
  if (batchFilter) batchFilter.addEventListener('change', e => applyFeedFilter('batch', e.target.value));

  const roleFilter = $('#filter-role');
  if (roleFilter) roleFilter.addEventListener('change', e => applyFeedFilter('role', e.target.value));

  // FAB
  const fab = $('#fab-btn');
  if (fab) fab.addEventListener('click', () => showToast('✍️ Create new post...'));

  // Notification bell
  const notifBtn = $('#notif-btn');
  if (notifBtn) notifBtn.addEventListener('click', () => showToast('🔔 You have 3 new notifications'));

  // Search btn
  const searchBtn = $('#search-btn');
  if (searchBtn) searchBtn.addEventListener('click', () => showToast('🔍 Search coming soon'));

  // Install banner
  const installBtn = $('#install-btn');
  if (installBtn) installBtn.addEventListener('click', handleInstall);
  const dismissBtn = $('#install-dismiss');
  if (dismissBtn) dismissBtn.addEventListener('click', dismissInstallBanner);
}

/* =========================================
   15. INITIALIZE
   ========================================= */
function init() {
  console.log('[Sangam] Initializing app...');

  // Render all pages
  renderHome();
  renderFeed();
  renderChat();
  renderCard();
  renderProfile();
  setupSidebar();
  bindEvents();

  // Set initial page
  navigate('home');

  console.log('[Sangam] App ready ✅');
}

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* =========================================
   SANGAM - app_patch.js
   Add this AFTER app.js in your HTML
   
   Changes:
   1. renderJobs() — new Jobs & Internships page
   2. renderProfile() — overrides original, adds Jobs/Internship button
   3. Desktop nav binding
   ========================================= */

/* =========================================
   JOBS & INTERNSHIP DATA (mock)
   ========================================= */
const JOBS_DATA = [
  {
    id: 1,
    title: 'Frontend Developer Intern',
    company: 'Google',
    logo: '🟢',
    logoColor: '#4285F4',
    type: 'internship',
    typeLabel: 'Internship',
    location: 'Bengaluru',
    duration: '6 months',
    stipend: '₹50,000/mo',
    desc: 'Work on core Google Search UI components. Must know React, TypeScript. Great mentorship from senior engineers.',
    postedBy: 'Priya Sharma',
    posterInitials: 'PS',
    posterColor: '#6c63ff',
    deadline: 'Deadline: Feb 28, 2025',
    skills: ['React', 'TypeScript', 'CSS']
  },
  {
    id: 2,
    title: 'Machine Learning Engineer',
    company: 'Microsoft',
    logo: '🪟',
    logoColor: '#00A4EF',
    type: 'fulltime',
    typeLabel: 'Full-time',
    location: 'Hyderabad',
    duration: 'Full-time',
    stipend: '₹18-24 LPA',
    desc: 'Join the Azure AI team to build next-gen ML models for enterprise customers. Strong Python/PyTorch skills required.',
    postedBy: 'Rohan Gupta',
    posterInitials: 'RG',
    posterColor: '#f77f00',
    deadline: 'Open till filled',
    skills: ['Python', 'PyTorch', 'Azure']
  },
  {
    id: 3,
    title: 'Design Engineering Intern',
    company: 'Tesla',
    logo: '🔋',
    logoColor: '#CC0000',
    type: 'internship',
    typeLabel: 'Internship',
    location: 'Remote',
    duration: '3 months',
    stipend: '₹40,000/mo',
    desc: 'Help our team on EV battery thermal management simulations. Solid knowledge of CAD tools and thermodynamics needed.',
    postedBy: 'Sneha Patel',
    posterInitials: 'SP',
    posterColor: '#7b2d8b',
    deadline: 'Deadline: Mar 10, 2025',
    skills: ['CAD', 'SolidWorks', 'MATLAB']
  },
  {
    id: 4,
    title: 'Backend Developer (Node.js)',
    company: 'Razorpay',
    logo: '💳',
    logoColor: '#3395FF',
    type: 'fulltime',
    typeLabel: 'Full-time',
    location: 'Bengaluru',
    duration: 'Full-time',
    stipend: '₹12-18 LPA',
    desc: 'Build scalable payment APIs serving millions of transactions. Node.js, PostgreSQL, and Redis expertise preferred.',
    postedBy: 'Alumni Cell',
    posterInitials: 'AC',
    posterColor: '#4cc9f0',
    deadline: 'Open till Mar 30, 2025',
    skills: ['Node.js', 'PostgreSQL', 'Redis']
  },
  {
    id: 5,
    title: 'Research Intern — Satellite Systems',
    company: 'ISRO',
    logo: '🛸',
    logoColor: '#FF6B35',
    type: 'internship',
    typeLabel: 'Internship',
    location: 'Ahmedabad',
    duration: '2 months',
    stipend: '₹15,000/mo',
    desc: 'Assist in analysis of satellite telemetry data for the NISAR mission. Strong signal processing background needed.',
    postedBy: 'Arjun Mehta',
    posterInitials: 'AM',
    posterColor: '#f72585',
    deadline: 'Deadline: Feb 15, 2025',
    skills: ['MATLAB', 'Signal Processing', 'Python']
  },
  {
    id: 6,
    title: 'Data Analyst — Part Time',
    company: 'Zomato',
    logo: '🍕',
    logoColor: '#E23744',
    type: 'parttime',
    typeLabel: 'Part-time',
    location: 'Remote',
    duration: 'Ongoing',
    stipend: '₹20,000/mo',
    desc: 'Analyze food delivery patterns and create dashboards for operational teams. Excel, SQL, Power BI experience helpful.',
    postedBy: 'Placement Committee',
    posterInitials: 'PC',
    posterColor: '#06d6a0',
    deadline: 'Open till filled',
    skills: ['SQL', 'Power BI', 'Excel']
  }
];

/* =========================================
   ACTIVE JOB FILTER STATE
   ========================================= */
let activeJobFilter = 'all';

/* =========================================
   RENDER: JOBS & INTERNSHIPS PAGE
   ========================================= */
function renderJobs(filter) {
  filter = filter || activeJobFilter;
  activeJobFilter = filter;

  const container = document.getElementById('jobs-dynamic');
  if (!container) return;

  const filtered = filter === 'all'
    ? JOBS_DATA
    : JOBS_DATA.filter(j => j.type === filter);

  const filters = [
    { key: 'all', label: '🌐 All' },
    { key: 'internship', label: '🎓 Internships' },
    { key: 'fulltime', label: '💼 Full-time' },
    { key: 'parttime', label: '⏰ Part-time' }
  ];

  container.innerHTML = `
    <div class="jobs-header">
      <div class="jobs-header-title">Jobs & Internships</div>
      <div class="jobs-header-sub">💼 ${JOBS_DATA.length} opportunities posted by alumni</div>
    </div>

    <div class="jobs-filter-tabs">
      ${filters.map(f => `
        <div class="job-filter-chip ${filter === f.key ? 'active' : ''}"
             onclick="renderJobs('${f.key}')">${f.label}</div>
      `).join('')}
    </div>

    ${filtered.length === 0 ? `
      <div class="jobs-empty">
        <div style="font-size:48px; margin-bottom:12px">🔍</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-secondary)">No listings found</div>
        <div style="font-size:12px;margin-top:6px">Try a different filter</div>
      </div>
    ` : `
      <div class="jobs-list">
        ${filtered.map(job => `
          <div class="job-card" onclick="showToast('🔗 Opening ${job.title} at ${job.company}...')">
            <div class="job-card-top">
              <div class="job-company-logo">${job.logo}</div>
              <div class="job-info">
                <div class="job-title">${job.title}</div>
                <div class="job-company">${job.company}</div>
                <div class="job-meta-row">
                  <span class="job-meta-chip">📍 ${job.location}</span>
                  <span class="job-meta-chip">⏱ ${job.duration}</span>
                  <span class="job-meta-chip">💰 ${job.stipend}</span>
                </div>
              </div>
              <span class="job-type-badge ${job.type}">${job.typeLabel}</span>
            </div>
            <div class="job-desc">${job.desc}</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--space-md)">
              ${job.skills.map(s => `<span class="skill-tag" style="font-size:10px;padding:4px 10px;">${s}</span>`).join('')}
            </div>
            <div class="job-card-bottom">
              <div class="job-posted-by">
                <div class="job-poster-avatar" style="background:${job.posterColor}">${job.posterInitials}</div>
                <span>by ${job.postedBy}</span>
              </div>
              <span class="job-deadline">${job.deadline}</span>
              <button class="job-apply-btn" onclick="event.stopPropagation(); showToast('✅ Application sent!')">Apply</button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;
}

/* =========================================
   OVERRIDE: RENDER PROFILE PAGE
   (adds Jobs/Internship shortcut button)
   ========================================= */
function renderProfile() {
  const container = document.getElementById('profile-dynamic');
  if (!container) return;
  const u = SANGAM_DATA.currentUser;

  container.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" style="background:${u.color}">${u.initials}</div>
        <div class="profile-edit-badge" onclick="showToast('📷 Change photo')">✏️</div>
      </div>
      <div class="profile-name">${u.name}</div>
      <div class="profile-detail">${u.branch}</div>
      <div class="profile-detail">${u.year}</div>
      <span class="profile-role-tag">🎓 ${u.role} · Batch ${u.batch}</span>
    </div>

    <div class="profile-stats-row">
      <div class="pstat">
        <div class="pstat-val">${u.posts}</div>
        <div class="pstat-label">Posts</div>
      </div>
      <div class="pstat">
        <div class="pstat-val">${u.connections}</div>
        <div class="pstat-label">Connections</div>
      </div>
      <div class="pstat">
        <div class="pstat-val">${u.followers}</div>
        <div class="pstat-label">Followers</div>
      </div>
    </div>

    <div class="profile-bio">${u.bio}</div>

    <!-- ✅ JOBS & INTERNSHIP SHORTCUT BUTTON -->
    <div class="profile-jobs-section">
      <button class="profile-jobs-btn" onclick="navigate('jobs')">
        <div class="profile-jobs-btn-left">
          <div class="profile-jobs-icon">💼</div>
          <div>
            <div class="profile-jobs-text-main">Jobs &amp; Internships</div>
            <div class="profile-jobs-text-sub">Browse ${JOBS_DATA.length} opportunities posted by alumni</div>
          </div>
        </div>
        <span class="profile-jobs-arrow">›</span>
      </button>
    </div>

    <div class="skills-wrap">
      <div class="section-title" style="margin-bottom:var(--space-sm)">Skills</div>
      <div class="skills-list">
        ${u.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
        <span class="skill-tag" style="border-style:dashed;cursor:pointer;" onclick="showToast('➕ Add skill')">+ Add skill</span>
      </div>
    </div>

    <div class="profile-actions">
      <button class="btn btn-primary" style="flex:1" onclick="showToast('✏️ Opening edit mode...')">
        ✏️ Edit Profile
      </button>
      <button class="btn btn-outline" onclick="showToast('🔗 Profile link copied!')">
        Share 🔗
      </button>
    </div>

    <div class="section">
      <div class="section-header">
        <h2 class="section-title">Your Posts</h2>
        <span class="section-link" onclick="navigate('activity')">View all ›</span>
      </div>
      <div style="
        background: var(--bg-card);
        border: 1px dashed var(--border);
        border-radius: var(--radius-xl);
        padding: var(--space-xl);
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        cursor: pointer;
      " onclick="navigate('activity')">
        <div style="font-size:32px; margin-bottom:8px">✍️</div>
        Share your first post on the activity feed!
      </div>
    </div>
  `;
}

/* =========================================
   BIND DESKTOP NAV ITEMS
   ========================================= */
function bindDesktopNav() {
  const items = document.querySelectorAll('.desktop-nav-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      navigate(item.dataset.page);
    });
  });
}

/* =========================================
   PATCH navigate() to also update desktop nav
   ========================================= */
const _origNavigate = window.navigate;
window.navigate = function(page) {
  // Call original
  if (typeof _origNavigate === 'function') _origNavigate(page);

  // Sync desktop nav active state
  document.querySelectorAll('.desktop-nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  // Render jobs page when navigating there
  if (page === 'jobs') {
    renderJobs(activeJobFilter);
  }
};

/* =========================================
   INIT PATCH — runs after main app init
   ========================================= */
document.addEventListener('DOMContentLoaded', function() {
  // Small delay to let original init() run first
  setTimeout(() => {
    // Re-render profile with jobs button
    renderProfile();
    // Render jobs page
    renderJobs('all');
    // Bind desktop nav
    bindDesktopNav();
  }, 100);
});