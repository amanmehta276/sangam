/* dashboard.js — Complete Sangam Dashboard Logic */

/* ── State ─────────────────────────────────────── */
let currentUser    = null;
let currentTab     = "feed";
let activeRoom     = null;
let activeRoomName = "";
let chatSocket     = null;
let allRooms       = { system_groups: [], my_groups: [], dms: [] };
let allPosts       = [];

/* ── Colors ─────────────────────────────────────── */
const AV_COLORS = ["#7C3AED","#E8610A","#16A34A","#0288D1","#E91E63","#FF5722","#00796B","#5C6BC0"];
const getColor  = s => AV_COLORS[(s||"A").charCodeAt(0) % AV_COLORS.length];

/* ── Helpers ─────────────────────────────────────── */
function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
}
function formatChatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true });
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  currentUser = Auth.getUser() || {
    id: "demo", name: "Arjun Sharma", roll_number: "CSE22101",
    branch: "CSE", batch_year: 2022, role: "student",
    trust_level: "partial", skills: ["React","Python","DSA"],
  };

  renderHeader();
  await showTab("feed");
  loadNotifBadge();
});

/* ── Render top header ─────────────────────────── */
function renderHeader() {
  const av      = document.getElementById("header-avatar");
  const compAv  = document.getElementById("compose-av");
  const initial = (currentUser.name || "A")[0].toUpperCase();
  const color   = getColor(initial);
  if (av)     { av.textContent = initial; av.style.background = color; }
  if (compAv) { compAv.textContent = initial; compAv.style.background = color; }

  if (["alumni","teacher","admin"].includes(currentUser.role)) {
    document.getElementById("post-job-btn-wrap")?.classList.remove("hidden");
  }
}

/* ════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════ */
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(n => n.classList.remove("active"));

  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.querySelector(`.bnav-item[data-tab="${tab}"]`)?.classList.add("active");

  const fab = document.getElementById("fab-btn");
  if (fab) fab.style.display = tab === "feed" ? "flex" : "none";

  switch (tab) {
    case "feed":    loadFeed();    break;
    case "alumni":  loadAlumni();  break;
    case "jobs":    loadJobs();    break;
    case "chat":    loadChat();    break;
    case "profile": loadProfile(); break;
    case "notifs":  loadNotifs();  break;
  }
}

/* ════════════════════════════════════════
   SEARCH BAR
════════════════════════════════════════ */
function toggleSearch() {
  const sb = document.getElementById("search-bar");
  sb?.classList.toggle("hidden");
  if (!sb?.classList.contains("hidden")) sb.querySelector("input")?.focus();
}
function handleSearch(q) { /* filter current tab */ }

/* ════════════════════════════════════════
   FEED
════════════════════════════════════════ */
const DEMO_POSTS = [
  { id:"1", author:{name:"Rahul Verma",roll_number:"CSE20011",branch:"CSE",batch_year:2020,role:"alumni",trust_level:"verified"}, post_type:"job", content:"Google is hiring — SWE Intern (Summer 2025)\nLooking for strong DSA + problem solving. DM me for a referral. Deadline April 30th.", tags:["SWE Intern","Remote OK","₹80k/mo"], likes:24, created_at:new Date(Date.now()-7200000).toISOString() },
  { id:"2", author:{name:"Priya Singh",roll_number:"EEE22045",branch:"EEE",batch_year:2022,role:"student",trust_level:"new"}, post_type:"question", content:"Anyone who cracked GATE 2024? Looking for a study plan for EEE. Would appreciate guidance from alumni or seniors.", tags:[], likes:11, created_at:new Date(Date.now()-18000000).toISOString() },
  { id:"3", author:{name:"Kiran Mehta",roll_number:"CSE19032",branch:"CSE",batch_year:2019,role:"alumni",trust_level:"verified"}, post_type:"win", content:"Our product just crossed 1 Million users! Hosting a free PM session for juniors next Saturday. Drop a comment to register — limited slots!", tags:[], likes:67, created_at:new Date(Date.now()-86400000).toISOString() },
  { id:"4", author:{name:"Dr. S. Tiwari",roll_number:"TCH001",branch:"CSE",batch_year:2005,role:"teacher",trust_level:"verified"}, post_type:"event", content:"Department Seminar on AI & Machine Learning this Friday, 3PM, Seminar Hall A. All students encouraged to attend. Guest speaker from IIT Raipur.", tags:["AI","ML","Free"], likes:38, created_at:new Date(Date.now()-172800000).toISOString() },
  { id:"5", author:{name:"Sneha Verma",roll_number:"IT22088",branch:"IT",batch_year:2022,role:"student",trust_level:"partial"}, post_type:"tip", content:"Interview tip: Always mention the time & space complexity of your solutions even if interviewer doesn't ask. It signals you think like an engineer.", tags:["DSA","Placement"], likes:102, created_at:new Date(Date.now()-259200000).toISOString() },
];

async function loadFeed(filter = null) {
  const el = document.getElementById("feed-list");
  if (!el) return;
  try { allPosts = await PostsAPI.list(filter); }
  catch { allPosts = DEMO_POSTS; }
  const posts = filter ? allPosts.filter(p => p.post_type === filter) : allPosts;
  el.innerHTML = posts.length ? posts.map(renderPost).join("") : `<div class="feed-loading">No posts yet.</div>`;
  loadStories();
}

/* ── External RSS Jobs (shown in Jobs tab) ───────────────── */
async function loadExternalJobs() {
  try {
    const res   = await fetch(`${API_BASE}/feed/external`);
    const posts = await res.json();
    if (!Array.isArray(posts) || !posts.length) return;

    const el = document.getElementById("jobs-list");
    if (!el) return;

    // only show job-type posts
    const jobs = posts.filter(p => p.post_type === "job");
    if (!jobs.length) return;

    el.insertAdjacentHTML("beforeend", `
      <div style="display:flex;align-items:center;gap:10px;margin:8px 12px 4px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <span style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-3)">🌐 From the Web</span>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`);

    jobs.forEach(p => el.insertAdjacentHTML("beforeend", renderExternalJob(p)));
  } catch (err) {
    console.warn("[Jobs] RSS fetch failed:", err);
  }
}

/* Company logo via Clearbit (free, no key needed) */
function companyLogo(name) {
  if (!name) return null;
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(inc|ltd|llc|corp|technologies|tech|solutions|services|pvt)$/g,"");
  return `https://logo.clearbit.com/${slug}.com`;
}

function renderExternalJob(p) {
  const source  = escHtml((p.author && p.author.name) || "External");
  const content = escHtml(p.content || "").replace(/\n/g, "<br>");
  const logo    = companyLogo(source);
  const time    = formatTime(p.created_at);

  return `
  <div class="job-card" style="border-radius:14px;margin:0 10px 12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);border:1px solid var(--border);background:var(--white)">
    <!-- Accent bar -->
    <div style="height:3px;background:linear-gradient(90deg,var(--purple),#6366f1)"></div>

    <div style="padding:14px 14px 0">
      <!-- Header row -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div style="width:46px;height:46px;border-radius:10px;background:var(--s2);border:1px solid var(--border);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px">
          ${logo
            ? `<img src="${logo}" alt="" style="width:100%;height:100%;object-fit:contain"
                onerror="this.parentElement.innerHTML='💼'">`
            : "💼"}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${source}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">
            <span style="background:var(--purple-light);color:var(--purple);border-radius:999px;padding:2px 8px;font-weight:600;font-size:10px">External</span>
            &nbsp;·&nbsp;${time}
          </div>
        </div>
        <span style="font-size:10px;font-weight:700;background:#EFF6FF;color:#1D6FD4;border-radius:999px;padding:3px 10px;flex-shrink:0">Job</span>
      </div>

      <!-- Content -->
      <div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:12px">${content}…</div>
    </div>

    <!-- Footer -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--s2);border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-3)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${time}
      </div>
      ${p.source_url ? `
      <a href="${escHtml(p.source_url)}" target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:5px;background:var(--purple);color:#fff;border-radius:999px;padding:7px 16px;font-size:12px;font-weight:700;text-decoration:none;transition:all .2s;box-shadow:0 2px 8px rgba(124,58,237,0.3)"
         onmouseover="this.style.background='var(--purple-2)'"
         onmouseout="this.style.background='var(--purple)'">
        Read More
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>` : ""}
    </div>
  </div>`;
}

function renderPost(p) {
  const a = p.author || {};
  const color   = getColor((a.name||"A")[0]);
  const initial = (a.name||"?")[0].toUpperCase();
  const trust   = {verified:"Verified",partial:"Partial",new:"New"}[a.trust_level] || "";
  const badgeC  = {verified:"vb-g",partial:"vb-b",new:"vb-y"}[a.trust_level] || "";
  const typeLabel = {job:"Job",question:"Question",win:"Win",event:"Event",tip:"Tip",update:"Update"}[p.post_type] || "Update";
  const tags    = (p.tags||[]).map(t => `<span class="ptag ptag-pu">${escHtml(t)}</span>`).join("");
  return `
  <div class="post-card">
    <div class="post-head">
      <div class="post-av" style="background:${color}">${initial}</div>
      <div class="post-meta">
        <div class="post-name">${escHtml(a.name||"?")} <span class="vbadge ${badgeC}">${trust}</span></div>
        <div class="post-sub">${escHtml(a.branch||"")} · Batch ${a.batch_year||""} · ${formatTime(p.created_at)}</div>
      </div>
      <div class="post-type-chip">${typeLabel}</div>
    </div>
    <div class="post-body">${escHtml(p.content||"").replace(/\n/g,"<br>")}</div>
    ${tags ? `<div class="post-body" style="padding-top:0"><div class="tag-row">${tags}</div></div>` : ""}
    <div class="post-divider"></div>
    <div class="post-actions">
      <div class="pact" id="like-${p.id}" onclick="likePost('${p.id}',this)">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="like-count">${p.likes||0}</span>
      </div>
      <div class="pact" onclick="showToast('Comments coming soon!')">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Comment
      </div>
      <div class="pact" onclick="showToast('Shared!')">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Share
      </div>
    </div>
  </div>`;
}

async function likePost(id, el) {
  const countEl = el.querySelector(".like-count");
  try {
    const res = await PostsAPI.like(id);
    if (countEl) countEl.textContent = res.likes;
    el.classList.toggle("liked", res.liked);
  } catch {
    const n = parseInt(countEl?.textContent || "0") + 1;
    if (countEl) countEl.textContent = n;
    el.classList.add("liked");
  }
}

function filterFeed(type, chipEl) {
  document.querySelectorAll(".chips-row .chip").forEach(c => c.classList.remove("on"));
  chipEl?.classList.add("on");
  loadFeed(type);
}

function loadStories() {
  const strip = document.getElementById("stories-strip");
  if (!strip) return;
  const users = (allPosts||[]).map(p => p.author).filter(Boolean).slice(0, 8);
  const existing = strip.innerHTML;
  users.forEach(u => {
    const color   = getColor((u.name||"A")[0]);
    const initial = (u.name||"?")[0].toUpperCase();
    strip.insertAdjacentHTML("beforeend", `
      <div class="story">
        <div class="story-ring"><div class="story-inner" style="background:${color};color:#fff">${initial}</div></div>
        <div class="story-name">${escHtml(u.name?.split(" ")[0]||"")}</div>
      </div>`);
  });
}

/* ════════════════════════════════════════
   ALUMNI
════════════════════════════════════════ */
const DEMO_ALUMNI = [
  { id:"1", name:"Rahul Verma", role:"alumni", branch:"CSE", batch_year:2020, trust_level:"verified", company:"Google", skills:["SWE","DSA","Go"], roll_number:"CSE20011" },
  { id:"2", name:"Kiran Mehta", role:"alumni", branch:"ME",  batch_year:2019, trust_level:"verified", company:"Flipkart PM", skills:["PM","Analytics","SQL"], roll_number:"ME19032" },
  { id:"3", name:"Dr. S. Tiwari", role:"teacher", branch:"CSE", batch_year:2005, trust_level:"verified", company:"CGIT Faculty", skills:["ML","Research"], roll_number:"TCH001" },
  { id:"4", name:"Sneha Patel", role:"alumni", branch:"CSE", batch_year:2017, trust_level:"verified", company:"Microsoft", skills:["Azure","DevOps","Python"], roll_number:"ALUMNI003" },
];

async function loadAlumni(params = {}) {
  const el = document.getElementById("alumni-list");
  if (!el) return;
  let users;
  try { users = await UsersAPI.list({role:"alumni",...params}); }
  catch { users = DEMO_ALUMNI; }
  el.innerHTML = users.length ? users.map(renderAlumni).join("") : `<div class="feed-loading">No alumni found.</div>`;
}

function renderAlumni(u) {
  const color   = getColor((u.name||"A")[0]);
  const initial = (u.name||"?")[0].toUpperCase();
  const roleLabel = {alumni:"Alumni",teacher:"Teacher",admin:"Admin",student:"Student"}[u.role] || u.role;
  const skills  = (u.skills||[]).slice(0,3).map(s => `<span class="atag">${escHtml(s)}</span>`).join("");
  return `
  <div class="alumni-card">
    <div class="al-av" style="background:${color}">${initial}</div>
    <div class="al-info">
      <div class="al-name">${escHtml(u.name)} <span class="vbadge vb-g">${roleLabel}</span></div>
      <div class="al-role">${escHtml(u.branch||"")} · Batch ${u.batch_year||""}</div>
      ${u.company ? `<div class="al-company">${escHtml(u.company)}</div>` : ""}
      <div class="al-tags">${skills}</div>
    </div>
    <button class="conn-btn" onclick="startDMWith('${u.roll_number}')">DM</button>
  </div>`;
}

async function searchAlumni(q) {
  if (!q) { loadAlumni(); return; }
  loadAlumni({ q });
}

function filterAlumniBy(key, val) {
  loadAlumni({ [key]: val });
}

/* ════════════════════════════════════════
   JOBS
════════════════════════════════════════ */
const DEMO_JOBS = [
  { id:"1", title:"SWE Intern", company:"Google", location:"Bangalore", job_type:"internship", salary:"₹80k/mo", referral:true, skills:["DSA","Go","System Design"], posted_by:{name:"Rahul Verma"}, created_at:new Date(Date.now()-86400000).toISOString() },
  { id:"2", title:"Product Manager Intern", company:"Flipkart", location:"Remote", job_type:"internship", salary:"₹70k/mo", referral:true, skills:["PM","Analytics","SQL"], posted_by:{name:"Kiran Mehta"}, created_at:new Date(Date.now()-172800000).toISOString() },
  { id:"3", title:"Teaching Assistant", company:"CGIT", location:"On Campus", job_type:"parttime", salary:"₹8k/mo", referral:false, skills:["DSA","Python"], posted_by:{name:"Dr. S. Tiwari"}, created_at:new Date(Date.now()-259200000).toISOString() },
];

async function loadJobs(params = {}) {
  const el = document.getElementById("jobs-list");
  if (!el) return;
  let jobs;
  try { jobs = await JobsAPI.list(params); }
  catch { jobs = DEMO_JOBS; }
  el.innerHTML = jobs.length ? jobs.map(renderJob).join("") : `<div class="feed-loading">No jobs found.</div>`;
  loadExternalJobs();
}

function renderJob(j) {
  const skills = (j.skills||[]).map(s => `<span class="atag">${escHtml(s)}</span>`).join("");
  const poster = (j.posted_by?.name || "Alumni");
  return `
  <div class="job-card">
    <div class="jc-top">
      <div class="jc-logo">🏢</div>
      <div style="flex:1;min-width:0">
        <div class="jc-title">${escHtml(j.title)}</div>
        <div class="jc-company">${escHtml(j.company)} · ${escHtml(j.location||"")}</div>
        <div class="jc-by">Posted by ${escHtml(poster)}</div>
      </div>
      ${j.salary ? `<div style="font-size:13px;font-weight:700;color:var(--green);flex-shrink:0">${escHtml(j.salary)}</div>` : ""}
    </div>
    ${j.description ? `<div class="post-body" style="font-size:13px;padding:6px 14px">${escHtml(j.description).slice(0,200)}...</div>` : ""}
    <div class="jc-tags">${skills}</div>
    <div class="jc-foot">
      ${j.referral ? `<div class="ref-badge">Has Referral</div>` : `<div></div>`}
      ${j.apply_link
        ? `<a href="${escHtml(j.apply_link)}" target="_blank" class="apply-btn" style="text-decoration:none">Apply ↗</a>`
        : `<button class="apply-btn" onclick="showToast('Contact the poster via DM!')">Apply</button>`}
    </div>
  </div>`;
}

function searchJobs(q) { /* filter locally or API */ }

/* ════════════════════════════════════════
   CHAT — Full Featured
════════════════════════════════════════ */

/* ── State ── */
let replyingTo       = null;   // { id, sender_name, content }
let chatLightMode    = false;
let typingTimer      = null;
let ctxTargetMsg     = null;   // message targeted by context menu
let groupMembers     = {};     // roomId → [member list]
let unreadCounts     = {};     // roomId → count
let onlineUsers      = new Set();

/* ══ Load Chat ══ */
async function loadChat() {
  try {
    const data = await ChatAPI.rooms();
    allRooms = data;
    renderRoomList();
    if (window.innerWidth >= 768) {
      openRoom("global", "Sangam Community", "group");
    }
  } catch {
    allRooms = {
      system_groups: [
        { id:"global",     name:"Sangam Community",   icon:"🌍", members:120 },
        { id:"placements", name:"Placements 2025",    icon:"💼", members:84  },
        { id:"mentorship", name:"Mentorship Connect", icon:"🤝", members:47  },
        { id:"cse-batch",  name:"CSE Batch 2022",     icon:"💻", members:62  },
      ],
      my_groups: [],
      dms: [],
    };
    renderRoomList();
    if (window.innerWidth >= 768) {
      openRoom("global", "Sangam Community", "group");
    }
  }
}

/* ══ Render Room List ══ */
function renderRoomList() {
  const el = document.getElementById("chat-rooms-list");
  if (!el) return;

  const { system_groups = [], my_groups = [], dms = [] } = allRooms;
  let html = "";

  if (system_groups.length) {
    html += `<div class="chat-section-label">Groups</div>`;
    html += system_groups.map(r => roomItem(r.id, r.name, r.name[0], "group", "", "", r.members)).join("");
  }
  if (my_groups.length) {
    html += `<div class="chat-section-label">My Groups</div>`;
    html += my_groups.map(r => roomItem(r.id||r.room, r.name, r.name[0], "mygroup", r.last_message, r.last_time)).join("");
  }
  if (dms.length) {
    html += `<div class="chat-section-label">Direct Messages</div>`;
    html += dms.map(d => roomItem(d.id, d.with_name, d.with_name[0], "dm", d.last_message, d.last_time)).join("");
  }

  el.innerHTML = html || `<div style="padding:30px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px">No chats yet</div>`;
}

function roomItem(id, name, initial, type, lastMsg="", lastTime="", memberCount=0) {
  const color    = getColor(initial);
  const isActive = activeRoom === id ? " active" : "";
  const unread   = unreadCounts[id] || 0;
  const isOnline = type === "dm" && onlineUsers.has(id);
  const chip     = type === "group" || type === "mygroup"
    ? `<span class="room-chip">GROUP</span>` : "";
  const lastPreview = lastMsg
    ? `<div class="room-last ${unread ? "unread-preview" : ""}">${escHtml(lastMsg)}</div>` : "";
  const onlineDot = isOnline ? `<div class="room-online-dot"></div>` : "";
  const badgeHtml = unread
    ? `<div class="room-badge">${unread > 99 ? "99+" : unread}</div>` : "";
  const timeHtml  = lastTime ? `<div class="room-time">${formatTime(lastTime)}</div>` : "";

  return `
  <div class="room-item${isActive}" onclick="openRoom('${escHtml(id)}','${escHtml(name)}','${type}')">
    <div class="room-av" style="background:${color}">
      ${initial.toUpperCase()}
      ${onlineDot}
    </div>
    <div class="room-info">
      <div class="room-name">${escHtml(name)} ${chip}</div>
      ${lastPreview}
    </div>
    <div class="room-meta">
      ${timeHtml}
      ${badgeHtml}
    </div>
  </div>`;
}

/* ══ Open Room ══ */
async function openRoom(roomId, roomName, sub) {
  activeRoom     = roomId;
  activeRoomName = roomName;

  // Mobile: slide panel in
  document.getElementById("chat-sidebar")?.classList.add("hidden-mobile");
  document.getElementById("chat-panel")?.classList.add("visible-mobile");

  // Header
  const color = getColor((roomName[0]||"G").toUpperCase());
  const av = document.getElementById("cp-avatar");
  if (av) { av.textContent = (roomName[0]||"G").toUpperCase(); av.style.background = color; }
  document.getElementById("cp-name").textContent = roomName;

  const subText = document.getElementById("cp-sub-text");
  const statusDot = document.getElementById("cp-status-dot");
  if (sub === "dm") {
    const isOnline = onlineUsers.has(roomId);
    if (subText) subText.textContent = isOnline ? "Online" : "Offline";
    if (statusDot) { statusDot.className = "chat-status-dot " + (isOnline ? "online" : ""); }
    document.getElementById("group-info-btn").style.display = "none";
  } else {
    if (subText) subText.textContent = sub === "group" ? "Community group" : "Group";
    if (statusDot) statusDot.className = "chat-status-dot";
    document.getElementById("group-info-btn").style.display = "";
  }

  // Highlight room item
  document.querySelectorAll(".room-item").forEach(el => el.classList.remove("active"));
  event?.currentTarget?.classList.add("active");

  // Clear unread
  unreadCounts[roomId] = 0;
  updateNavBadge();

  // Show active-chat
  document.getElementById("chat-empty-state").style.display = "none";
  const ac = document.getElementById("active-chat");
  ac.style.cssText = "display:flex;flex-direction:column;height:100%;position:relative";

  await loadMessages(roomId);
  connectSocket(roomId);
  cancelReply();
  document.getElementById("chat-input")?.focus();
}

/* ══ Load Messages ══ */
async function loadMessages(roomId) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  area.innerHTML = `<div class="msg-system">Loading…</div>`;

  let msgs;
  try { msgs = await ChatAPI.getMessages(roomId); }
  catch {
    const names = ["Rahul Verma","Priya Singh","Kiran Mehta","Dr. S. Tiwari"];
    const texts = [
      "Hey everyone! Welcome to Sangam 👋",
      "This platform is amazing! Just connected with 3 alumni today.",
      "Anyone preparing for placements? Let's form a study group!",
      "Department seminar this Friday — don't miss it!",
      "Just got my Google offer! Happy to help anyone with interview prep 🎉",
      "DSA tip: Practice sliding window problems today 💡",
    ];
    msgs = texts.map((t,i) => ({
      id: "d"+i,
      sender_id: i % 3 === 0 ? String(currentUser.id) : "other"+i,
      sender_name: i % 3 === 0 ? currentUser.name : names[i % names.length],
      sender_roll: "CSE22"+i,
      room: roomId,
      content: t,
      created_at: new Date(Date.now() - (texts.length-i)*600000).toISOString(),
      status: i % 3 === 0 ? (i === texts.length-3 ? "seen" : "delivered") : null,
    }));
  }

  area.innerHTML = msgs.length ? renderMessages(msgs) : `<div class="msg-system">No messages yet. Say hello! 👋</div>`;
  area.scrollTop = area.scrollHeight;
}

/* ══ Render Messages ══ */
function renderMessages(msgs) {
  const myId = String(currentUser.id || "");
  let html = "";
  let lastDate = "";

  msgs.forEach(m => {
    const d = new Date(m.created_at);
    const dateStr = d.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" });
    if (dateStr !== lastDate) {
      html += `<div class="msg-date-divider"><span>${dateStr}</span></div>`;
      lastDate = dateStr;
    }

    const isMine = String(m.sender_id) === myId;
    const color  = getColor((m.sender_name||"A")[0]);
    const avInitial = (m.sender_name||"?")[0].toUpperCase();

    // Ticks
    let ticks = "";
    if (isMine) {
      const cls = m.status === "seen" ? "seen" : m.status === "delivered" ? "delivered" : "";
      ticks = `<span class="msg-ticks ${cls}">${m.status === "seen" ? "✓✓" : m.status === "delivered" ? "✓✓" : "✓"}</span>`;
    }

    // Reply snippet
    let replySnippet = "";
    if (m.reply_to) {
      replySnippet = `<div class="msg-reply-snippet" onclick="scrollToMsg('${m.reply_to.id}')">
        <strong>${escHtml(m.reply_to.sender_name)}</strong>${escHtml(m.reply_to.content||"").slice(0,60)}
      </div>`;
    }

    // Reactions
    const reactions = (m.reactions||[]);
    const reactHtml = reactions.length
      ? `<div class="msg-reactions">${reactions.map(r =>
          `<div class="msg-reaction-chip" onclick="addReaction('${m.id}','${r.emoji}')">${r.emoji}<span>${r.count}</span></div>`
        ).join("")}</div>` : "";

    html += `<div class="msg-row ${isMine ? "mine" : "theirs"}" id="msg-${m.id}"
       oncontextmenu="showContextMenu(event,'${m.id}','${escHtml(m.content||"")}','${escHtml(m.sender_name||"")}')"
       ontouchstart="touchStartCtx(event,'${m.id}','${escHtml(m.content||"")}','${escHtml(m.sender_name||"")}')"
       ontouchend="touchEndCtx()">`;

    if (!isMine) {
      html += `<div class="msg-av-sm" style="background:${color}" title="${escHtml(m.sender_name||"")}">${avInitial}</div>`;
    }

    html += `<div class="msg-bubble">`;
    if (!isMine) html += `<span class="msg-sender-name">${escHtml(m.sender_name)}</span>`;
    html += replySnippet;

    if (m.media_type === "image" && m.media_url) {
      html += `<img class="msg-img" src="${escHtml(m.media_url)}" alt="image" onclick="window.open(this.src,'_blank')">`;
    } else if (m.media_type === "file" && m.media_url) {
      html += `<a class="msg-file" href="${escHtml(m.media_url)}" target="_blank">📎 ${escHtml(m.content||"File")}</a>`;
    } else if (m.media_type === "video" && m.media_url) {
      html += `<video controls style="max-width:220px;border-radius:10px"><source src="${escHtml(m.media_url)}"></video>`;
    } else {
      html += `<div class="msg-text">${escHtml(m.content||"").replace(/\n/g,"<br>")}</div>`;
    }

    html += `<div class="msg-footer"><span class="msg-time">${formatChatTime(m.created_at)}</span>${ticks}</div>`;
    html += `</div>`; // bubble
    html += reactHtml;

    if (isMine) {
      html += `<div class="msg-av-sm" style="background:var(--purple)">${(currentUser.name||"U")[0].toUpperCase()}</div>`;
    }
    html += `</div>`; // row
  });

  return html;
}

/* ══ Append single message ══ */
function appendMessage(m) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  const temp = document.createElement("div");
  temp.innerHTML = renderMessages([m]);
  while (temp.firstChild) area.appendChild(temp.firstChild);
  area.scrollTop = area.scrollHeight;
}

/* ══ Send Message ══ */
async function sendChatMessage() {
  const input   = document.getElementById("chat-input");
  const content = (input?.value || "").trim();
  if (!content || !activeRoom) return;

  input.value = "";
  input.style.height = "auto";
  input.style.height = "38px";
  input.focus();
  closeEmojiPicker();

  const now = new Date().toISOString();
  const msg = {
    id:          "local-" + Date.now(),
    sender_id:   String(currentUser.id),
    sender_name: currentUser.name,
    sender_roll: currentUser.roll_number,
    room:        activeRoom,
    content,
    created_at:  now,
    status:      "sent",
    reply_to:    replyingTo ? { ...replyingTo } : null,
  };
  cancelReply();
  appendMessage(msg);

  if (chatSocket?.connected) {
    chatSocket.emit("message", {
      token:    Auth.getToken() || "",
      room:     activeRoom,
      content,
      reply_to: replyingTo,
    });
  } else {
    try { await ChatAPI.sendMessage(activeRoom, content); } catch {}
  }
}

/* ══ Socket ══ */
function connectSocket(room) {
  if (typeof io === "undefined") return;
  if (chatSocket) { try { chatSocket.disconnect(); } catch(e){} }
  const token = Auth.getToken() || "";
  chatSocket = io("http://localhost:5000", { auth: { token: `Bearer ${token}` } });
  chatSocket.emit("join", { token: `Bearer ${token}`, room });

  chatSocket.on("new_message", msg => {
    if (msg.room !== activeRoom) {
      unreadCounts[msg.room] = (unreadCounts[msg.room]||0) + 1;
      updateNavBadge();
      renderRoomList();
      return;
    }
    if (String(msg.sender_id) === String(currentUser.id)) return;
    appendMessage(msg);
  });

  chatSocket.on("typing", data => {
    if (data.room !== activeRoom || data.user_id === currentUser.id) return;
    showTypingIndicator(data.name);
  });
  chatSocket.on("stop_typing", data => {
    if (data.room === activeRoom) hideTypingIndicator();
  });
  chatSocket.on("user_online",  id => { onlineUsers.add(id);    updateOnlineStatus(id, true);  });
  chatSocket.on("user_offline", id => { onlineUsers.delete(id); updateOnlineStatus(id, false); });
  chatSocket.on("message_seen", data => { markMessageSeen(data.msg_id); });
}

/* ══ Typing indicator ══ */
let typingShown = false;
function showTypingIndicator(name) {
  hideTypingIndicator();
  typingShown = true;
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  area.insertAdjacentHTML("beforeend",`
    <div class="typing-indicator" id="typing-indicator">
      <div class="msg-av-sm" style="background:#334155;font-size:10px">...</div>
      <div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px">${escHtml(name)} is typing</div>
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`);
  area.scrollTop = area.scrollHeight;
}
function hideTypingIndicator() {
  document.getElementById("typing-indicator")?.remove();
  typingShown = false;
}

/* ══ Typing emit ══ */
function handleTyping() {
  autoGrow(document.getElementById("chat-input"));
  if (!chatSocket?.connected || !activeRoom) return;
  chatSocket.emit("typing", { room: activeRoom, name: currentUser.name, user_id: currentUser.id });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(stopTyping, 2000);
}
function stopTyping() {
  if (chatSocket?.connected && activeRoom) {
    chatSocket.emit("stop_typing", { room: activeRoom });
  }
}

/* ══ Reply ══ */
function setReply(msgId, senderName, content) {
  replyingTo = { id: msgId, sender_name: senderName, content };
  document.getElementById("reply-preview-bar").style.display = "flex";
  document.getElementById("reply-from").textContent = senderName;
  document.getElementById("reply-text").textContent = content.slice(0,80);
  document.getElementById("chat-input")?.focus();
  closeContextMenu();
}
function cancelReply() {
  replyingTo = null;
  document.getElementById("reply-preview-bar").style.display = "none";
}

/* ══ Emoji picker ══ */
function toggleEmojiPicker() {
  const p = document.getElementById("emoji-picker");
  if (!p) return;
  const show = p.style.display === "none" || !p.style.display;
  p.style.display = show ? "flex" : "none";
  if (show) {
    // Wire clicks
    p.querySelectorAll("span").forEach(s => {
      s.onclick = () => {
        const inp = document.getElementById("chat-input");
        if (inp) { inp.value += s.textContent; inp.focus(); autoGrow(inp); }
      };
    });
  }
}
function closeEmojiPicker() {
  const p = document.getElementById("emoji-picker");
  if (p) p.style.display = "none";
}

/* ══ Context menu ══ */
let ctxMsgContent = "";
let ctxMsgSender  = "";
function showContextMenu(e, msgId, content, sender) {
  e.preventDefault();
  ctxTargetMsg  = msgId;
  ctxMsgContent = content;
  ctxMsgSender  = sender;
  const menu = document.getElementById("msg-context-menu");
  if (!menu) return;
  menu.style.display = "block";
  const x = Math.min(e.clientX, window.innerWidth  - 175);
  const y = Math.min(e.clientY, window.innerHeight - 160);
  menu.style.left = x + "px";
  menu.style.top  = y + "px";
}
let _touchTimer = null;
function touchStartCtx(e, msgId, content, sender) {
  _touchTimer = setTimeout(() => showContextMenu(e.touches[0], msgId, content, sender), 500);
}
function touchEndCtx() { clearTimeout(_touchTimer); }
function closeContextMenu() {
  document.getElementById("msg-context-menu").style.display = "none";
}
document.addEventListener("click", () => closeContextMenu());

function ctxReply() {
  setReply(ctxTargetMsg, ctxMsgSender, ctxMsgContent);
}
function ctxCopy() {
  navigator.clipboard?.writeText(ctxMsgContent).then(() => showToast("Copied!","success"));
  closeContextMenu();
}
function ctxReact() {
  addReaction(ctxTargetMsg, "❤️");
  closeContextMenu();
}
function ctxDelete() {
  const el = document.getElementById("msg-" + ctxTargetMsg);
  if (el) { el.style.opacity = "0"; el.style.transform = "scale(.8)"; el.style.transition = "all .2s"; setTimeout(() => el.remove(), 200); }
  closeContextMenu();
  showToast("Message deleted","success");
}

/* ══ Reactions ══ */
function addReaction(msgId, emoji) {
  const row = document.getElementById("msg-" + msgId);
  if (!row) return;
  let reactionsDiv = row.querySelector(".msg-reactions");
  if (!reactionsDiv) {
    reactionsDiv = document.createElement("div");
    reactionsDiv.className = "msg-reactions";
    row.querySelector(".msg-bubble")?.after(reactionsDiv);
  }
  const existing = [...reactionsDiv.querySelectorAll(".msg-reaction-chip")]
    .find(c => c.textContent.startsWith(emoji));
  if (existing) {
    const span = existing.querySelector("span");
    span.textContent = parseInt(span.textContent||"1") + 1;
  } else {
    reactionsDiv.insertAdjacentHTML("beforeend",
      `<div class="msg-reaction-chip">${emoji}<span>1</span></div>`);
  }
}

/* ══ Mark seen ══ */
function markMessageSeen(msgId) {
  const row = document.getElementById("msg-" + msgId);
  if (!row) return;
  const ticks = row.querySelector(".msg-ticks");
  if (ticks) { ticks.textContent = "✓✓"; ticks.className = "msg-ticks seen"; }
}

/* ══ Online status ══ */
function updateOnlineStatus(userId, isOnline) {
  const dot = document.getElementById("cp-status-dot");
  const sub = document.getElementById("cp-sub-text");
  if (activeRoom === userId) {
    if (dot) dot.className = "chat-status-dot " + (isOnline ? "online" : "");
    if (sub) sub.textContent = isOnline ? "Online" : "Last seen recently";
  }
}

/* ══ Scroll to message ══ */
function scrollToMsg(msgId) {
  const el = document.getElementById("msg-" + msgId);
  if (el) { el.scrollIntoView({ behavior:"smooth", block:"center" }); el.style.background = "rgba(255,122,24,0.15)"; setTimeout(() => el.style.background = "", 1500); }
}

/* ══ Nav badge ══ */
function updateNavBadge() {
  const total = Object.values(unreadCounts).reduce((a,b) => a+b, 0);
  let badge = document.querySelector(".bnav-item[data-tab='chat'] .chat-nav-badge");
  if (!badge && total > 0) {
    const item = document.querySelector(".bnav-item[data-tab='chat']");
    if (item) { item.style.position = "relative"; item.insertAdjacentHTML("beforeend", `<div class="chat-nav-badge">${total > 99 ? "99+" : total}</div>`); }
  } else if (badge) {
    if (total === 0) badge.remove();
    else badge.textContent = total > 99 ? "99+" : total;
  }
}

/* ══ Back to room list (mobile) ══ */
function backToRoomList() {
  document.getElementById("chat-sidebar")?.classList.remove("hidden-mobile");
  document.getElementById("chat-panel")?.classList.remove("visible-mobile");
  activeRoom = null;
  activeRoomName = "";
  if (chatSocket) { try { chatSocket.disconnect(); } catch(e){} chatSocket = null; }
}

/* ══ Filter rooms ══ */
function filterChatRooms(q) {
  document.querySelectorAll(".room-item").forEach(el => {
    const name = el.querySelector(".room-name")?.textContent || "";
    el.style.display = name.toLowerCase().includes(q.toLowerCase()) ? "" : "none";
  });
}

/* ══ Group Info Drawer ══ */
function openGroupInfo() {
  const overlay = document.getElementById("group-drawer-overlay");
  const drawer  = document.getElementById("group-drawer");
  if (!overlay || !drawer) return;

  document.getElementById("gd-name").textContent  = activeRoomName;
  document.getElementById("gd-avatar").textContent = (activeRoomName[0]||"G").toUpperCase();
  document.getElementById("gd-avatar").style.background = getColor((activeRoomName[0]||"G").toUpperCase());

  const members = groupMembers[activeRoom] || [
    { name:"Rahul Verma", roll:"CSE20011", isAdmin:true },
    { name:"Priya Singh", roll:"EEE22045", isAdmin:false },
    { name:"Kiran Mehta", roll:"CSE19032", isAdmin:false },
    { name:currentUser.name, roll:currentUser.roll_number, isAdmin:false },
  ];
  document.getElementById("gd-count").textContent = `${members.length} members`;

  const list = document.getElementById("gd-members-list");
  list.innerHTML = members.map(m => `
    <div class="gd-member">
      <div class="gd-member-av" style="background:${getColor((m.name||"A")[0])}">${(m.name||"?")[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:#fff">${escHtml(m.name)}
          ${m.isAdmin ? `<span class="gd-admin-badge">Admin</span>` : ""}
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4)">${m.roll||""}</div>
      </div>
    </div>`).join("");

  overlay.classList.add("open");
  drawer.classList.add("open");
}
function closeGroupInfo() {
  document.getElementById("group-drawer-overlay")?.classList.remove("open");
  document.getElementById("group-drawer")?.classList.remove("open");
}

/* ══ Chat options menu ══ */
function openChatOptions(e) {
  showContextMenu(e, null, "", "");
  const menu = document.getElementById("msg-context-menu");
  if (!menu) return;
  menu.innerHTML = `
    <div class="ctx-item" onclick="showToast('Searching in chat…');closeContextMenu()">🔍 Search in Chat</div>
    <div class="ctx-item" onclick="openGroupInfo();closeContextMenu()">ℹ️ Group Info</div>
    <div class="ctx-item" onclick="toggleChatTheme();closeContextMenu()">🌙 Toggle Theme</div>
    <div class="ctx-item danger" onclick="showToast('Left group');closeContextMenu()">🚪 Leave Group</div>`;
}

/* ══ Theme toggle ══ */
function toggleChatTheme() {
  chatLightMode = !chatLightMode;
  document.body.classList.toggle("chat-light-mode", chatLightMode);
  const btn = document.getElementById("theme-toggle-btn");
  if (btn) btn.textContent = chatLightMode ? "🌞" : "🌙";
  showToast(chatLightMode ? "Light mode on" : "Dark mode on", "success");
}

/* ══ Search in chat ══ */
function searchInChat() {
  showToast("Search in chat — coming soon!", "info");
}

/* ══ DM search ══ */
function openDMSearch() {
  openModal(`
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Start a Direct Message</div>
      <input id="dm-search-input" class="profile-input" placeholder="Search by name or roll number…" oninput="searchDMUsers(this.value)">
      <div id="dm-search-results" style="margin-top:12px"></div>
    </div>`);
}

async function searchDMUsers(q) {
  if (!q || q.length < 2) { document.getElementById("dm-search-results").innerHTML = ""; return; }
  const res = document.getElementById("dm-search-results");
  try {
    const users = await ChatAPI.searchUsers(q);
    res.innerHTML = users.map(u => `
      <div onclick="startDMWith('${u.roll_number}')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--r-sm);cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''">
        <div style="width:38px;height:38px;border-radius:50%;background:${getColor(u.name[0])};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${u.name[0]}</div>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(u.name)}</div>
          <div style="font-size:12px;color:var(--text-3)">${u.roll_number} · ${u.branch||""}</div>
        </div>
      </div>`).join("") || `<div style="color:var(--text-3);font-size:13px;padding:8px">No users found</div>`;
  } catch { res.innerHTML = `<div style="color:var(--text-3);font-size:13px">Search offline — try later</div>`; }
}

async function startDMWith(roll) {
  closeModal();
  try {
    const res = await ChatAPI.startDM(roll);
    showTab("chat");
    setTimeout(() => openRoom(res.room, res.with_user?.name || "DM", "dm"), 300);
  } catch { showToast("Could not start DM", "error"); }
}

/* ══ Create Group ══ */
function openNewGroupModal() {
  openModal(`
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Create Group</div>
      <input id="ng-name" class="profile-input" placeholder="Group name…" style="margin-bottom:10px">
      <input id="ng-rolls" class="profile-input" placeholder="Add roll numbers (comma separated)…" style="margin-bottom:14px">
      <button class="profile-save-btn" onclick="createGroup()">Create Group</button>
    </div>`);
}

async function createGroup() {
  const name  = document.getElementById("ng-name")?.value.trim();
  const rolls = (document.getElementById("ng-rolls")?.value || "").split(",").map(r => r.trim()).filter(Boolean);
  if (!name) { showToast("Enter group name", "error"); return; }
  try {
    const res = await ChatAPI.createGroup(name, rolls);
    closeModal();
    showToast(`Group "${name}" created!`, "success");
    await loadChat();
    openRoom(res.room || `group_${res.id}`, name, "mygroup");
  } catch { showToast("Could not create group", "error"); }
}

/* ══ File attach ══ */
async function handleFileAttach(input) {
  if (!input.files[0] || !activeRoom) return;
  const file = input.files[0];
  showToast("Uploading…", "info");
  try {
    const res = await ChatAPI.uploadFile(file, activeRoom);
    appendMessage({
      id:          "local-" + Date.now(),
      sender_id:   String(currentUser.id),
      sender_name: currentUser.name,
      sender_roll: currentUser.roll_number,
      room:        activeRoom,
      content:     file.name,
      media_type:  res.media_type,
      media_url:   res.media_url || res.url,
      created_at:  new Date().toISOString(),
      status:      "sent",
    });
    showToast("Sent!", "success");
  } catch { showToast("Upload failed", "error"); }
  input.value = "";
}

/* ══ autoGrow ══ */
function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
  const area = document.getElementById("chat-messages-area");
  if (area) area.scrollTop = area.scrollHeight;
}

/* ════════════════════════════════════════
   PROFILE
════════════════════════════════════════ */
async function loadProfile() {
  let u = currentUser;
  try { u = await AuthAPI.me(); currentUser = u; Auth.setUser(u); } catch {}

  document.getElementById("profile-name-display").textContent  = u.name || "—";
  document.getElementById("profile-meta-display").textContent  = `${u.branch||""} · Batch ${u.batch_year||""} · ${u.role||""}`;
  document.getElementById("profile-trust-display").textContent = u.trust_level === "verified" ? "⬤ Verified" : "⬤ " + (u.trust_level||"New");
  document.getElementById("profile-av-initial").textContent    = (u.name||"A")[0].toUpperCase();

  if (u.avatar_url) {
    const img = document.getElementById("profile-av-img");
    img.src = u.avatar_url; img.style.display = "block";
    document.getElementById("profile-av-initial").style.display = "none";
  }

  // Info
  document.getElementById("info-roll").textContent   = u.roll_number || "—";
  document.getElementById("info-branch").textContent = u.branch      || "—";
  document.getElementById("info-batch").textContent  = u.batch_year  || "—";
  document.getElementById("info-role").textContent   = u.role        || "—";

  // Edit fields
  document.getElementById("pe-bio").value      = u.bio      || "";
  document.getElementById("pe-company").value  = u.company  || "";
  document.getElementById("pe-linkedin").value = u.linkedin_url || "";
  document.getElementById("pe-github").value   = u.github_url  || "";
  document.getElementById("pe-email").value    = u.email    || "";

  const skills = Array.isArray(u.skills) ? u.skills : (u.skills || "").split(",").filter(Boolean);
  document.getElementById("pe-skills").value = skills.join(", ");
  renderSkillChips(skills);
}

function renderSkillChips(skills) {
  const el = document.getElementById("pe-skills-preview");
  if (!el) return;
  el.innerHTML = skills.filter(Boolean).map(s =>
    `<span class="skill-chip" onclick="removeSkill('${escHtml(s)}')">${escHtml(s)} ×</span>`
  ).join("");
}

function removeSkill(skill) {
  const inp = document.getElementById("pe-skills");
  const skills = inp.value.split(",").map(s => s.trim()).filter(s => s && s !== skill);
  inp.value = skills.join(", ");
  renderSkillChips(skills);
}

document.addEventListener("input", e => {
  if (e.target?.id === "pe-skills") {
    const skills = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
    renderSkillChips(skills);
  }
});

async function saveProfile() {
  const skills = (document.getElementById("pe-skills")?.value || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const payload = {
    bio:          document.getElementById("pe-bio")?.value || "",
    company:      document.getElementById("pe-company")?.value || "",
    linkedin_url: document.getElementById("pe-linkedin")?.value || "",
    github_url:   document.getElementById("pe-github")?.value || "",
    email:        document.getElementById("pe-email")?.value || "",
    skills,
  };
  try {
    const updated = await UsersAPI.update(payload);
    currentUser = {...currentUser, ...updated};
    Auth.setUser(currentUser);
    showToast("Profile saved!", "success");
    loadProfile();
  } catch { showToast("Save failed. Try again.", "error"); }
}

async function uploadAvatar(input) {
  if (!input.files[0]) return;
  try {
    const res = await UsersAPI.uploadAvatar(input.files[0]);
    document.getElementById("profile-av-img").src = res.avatar_url;
    document.getElementById("profile-av-img").style.display = "block";
    document.getElementById("profile-av-initial").style.display = "none";
    showToast("Avatar updated!", "success");
  } catch { showToast("Upload failed", "error"); }
}

/* ════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════ */
async function loadNotifs() {
  const el = document.getElementById("notifs-list");
  if (!el) return;
  let notifs;
  try { notifs = await NotifsAPI.list(); }
  catch { notifs = [
    { id:"1", notif_type:"system", title:"Welcome to Sangam!", body:"Explore the platform — connect with alumni, find jobs, and chat.", is_read:false, created_at:new Date().toISOString() },
  ]; }
  el.innerHTML = notifs.length ? notifs.map(n => `
    <div class="notif-item ${n.is_read ? "" : "unread"}">
      <div class="notif-icon">${{system:"📢",job:"💼",message:"💬"}[n.notif_type]||"🔔"}</div>
      <div>
        <div class="notif-text">${escHtml(n.title)}</div>
        ${n.body ? `<div class="notif-text" style="font-size:13px;color:var(--text-2)">${escHtml(n.body)}</div>` : ""}
        <div class="notif-time">${formatTime(n.created_at)}</div>
      </div>
    </div>`).join("") : `<div class="feed-loading">No notifications</div>`;
}

async function markAllRead() {
  try { await NotifsAPI.readAll(); loadNotifs(); document.getElementById("notif-dot").style.display = "none"; }
  catch { showToast("Could not mark as read", "error"); }
}

async function loadNotifBadge() {
  try {
    const notifs = await NotifsAPI.list();
    const unread = notifs.filter(n => !n.is_read).length;
    const dot = document.getElementById("notif-dot");
    if (dot) dot.style.display = unread ? "block" : "none";
  } catch {}
}

/* ════════════════════════════════════════
   MODALS
════════════════════════════════════════ */
function openModal(html) {
  document.getElementById("modal-overlay").style.display = "block";
  const mc = document.getElementById("modal-content");
  mc.innerHTML = html;
  mc.style.display = "block";
}
function closeModal() {
  document.getElementById("modal-overlay").style.display = "none";
  document.getElementById("modal-content").style.display = "none";
}

function openPostModal() {
  openModal(`
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Create Post</div>
      <select id="post-type-sel" class="profile-input" style="margin-bottom:10px">
        <option value="update">Update</option>
        <option value="job">Job Opportunity</option>
        <option value="question">Question</option>
        <option value="win">Achievement/Win</option>
        <option value="event">Event</option>
        <option value="tip">Tip/Advice</option>
      </select>
      <textarea id="post-content-inp" class="profile-input" rows="5" placeholder="What's on your mind?" style="resize:vertical;margin-bottom:10px"></textarea>
      <input id="post-tags-inp" class="profile-input" placeholder="Tags (comma separated)" style="margin-bottom:14px">
      <button class="profile-save-btn" onclick="submitPost()">Post</button>
    </div>`);
}

async function submitPost() {
  const type    = document.getElementById("post-type-sel")?.value || "update";
  const content = document.getElementById("post-content-inp")?.value.trim();
  const tags    = (document.getElementById("post-tags-inp")?.value || "").split(",").map(t => t.trim()).filter(Boolean);
  if (!content) { showToast("Write something first", "error"); return; }
  try {
    await PostsAPI.create({ post_type: type, content, tags });
    closeModal();
    showToast("Posted!", "success");
    loadFeed();
  } catch { showToast("Could not post. Try again.", "error"); }
}

function openJobModal() {
  openModal(`
    <div>
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Post Job / Internship</div>
      <input id="jm-title" class="profile-input" placeholder="Job title" style="margin-bottom:10px">
      <input id="jm-company" class="profile-input" placeholder="Company name" style="margin-bottom:10px">
      <input id="jm-location" class="profile-input" placeholder="Location / Remote" style="margin-bottom:10px">
      <select id="jm-type" class="profile-input" style="margin-bottom:10px">
        <option value="internship">Internship</option>
        <option value="fulltime">Full-Time</option>
        <option value="parttime">Part-Time</option>
        <option value="contract">Contract</option>
      </select>
      <input id="jm-salary" class="profile-input" placeholder="Salary / Stipend (optional)" style="margin-bottom:10px">
      <textarea id="jm-desc" class="profile-input" rows="3" placeholder="Description…" style="resize:vertical;margin-bottom:10px"></textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer">
        <input type="checkbox" id="jm-referral"> <span style="font-size:14px;color:var(--text)">I can provide a referral</span>
      </label>
      <button class="profile-save-btn" onclick="submitJob()">Post Job</button>
    </div>`);
}

async function submitJob() {
  const payload = {
    title:    document.getElementById("jm-title")?.value.trim(),
    company:  document.getElementById("jm-company")?.value.trim(),
    location: document.getElementById("jm-location")?.value.trim(),
    job_type: document.getElementById("jm-type")?.value,
    salary:   document.getElementById("jm-salary")?.value.trim(),
    description: document.getElementById("jm-desc")?.value.trim(),
    referral: document.getElementById("jm-referral")?.checked,
  };
  if (!payload.title || !payload.company) { showToast("Title and company required", "error"); return; }
  try {
    await JobsAPI.create(payload);
    closeModal();
    showToast("Job posted!", "success");
    loadJobs();
  } catch { showToast("Could not post job", "error"); }
}

function chipSel(el) {
  el.closest(".chips-row").querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
  el.classList.add("on");
}

/* ── Logout ───────────────────────────────────── */
function logout() {
  Auth.clear();
  window.location.href = "auth.html";
}