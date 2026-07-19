/* ============================================================
   dashboard.js — Sangam Dashboard (rewritten for new HTML/CSS)
   ============================================================ */

var _DASH_BACKEND_URL = (typeof API_ORIGIN !== "undefined") ? API_ORIGIN : "https://sangam-z93f.onrender.com";

function fixAvatarUrl(url) {
  if (!url) return "";
  if (url.startsWith("/uploads/") || (!url.startsWith("http") && !url.startsWith("data:")))
    return _DASH_BACKEND_URL + (url.startsWith("/") ? url : "/" + url);
  return url;
}

/* ── Global State ────────────────────────────────────────── */
let currentUser    = null;
let currentTab     = "home";
let allPosts       = [];
let activeRoom     = null;   // {id, type, name, dm_roll}
let allRooms       = { system_groups:[], my_groups:[], dms:[] };
let chatPollTimer  = null;
let chatLastMsgTime = null;

/* ── Colors ──────────────────────────────────────────────── */
const AV_COLORS = ["#1D4ED8","#2563EB","#16A34A","#0288D1","#E91E63","#FF5722","#00796B","#5C6BC0"];
const getColor  = s => AV_COLORS[(s||"A").charCodeAt(0) % AV_COLORS.length];

/* ── Helpers ─────────────────────────────────────────────── */
function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return Math.floor(diff/60)  + "m ago";
  if (diff < 86400) return Math.floor(diff/3600) + "h ago";
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}
function formatChatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
}

/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  currentUser = Auth.getUser() || {
    id:"demo", name:"Arjun Sharma", roll_number:"CSE22101",
    branch:"CSE", batch_year:2022, role:"student", trust_level:"partial",
    skills:["React","Python","DSA"],
  };

  try {
    const saved = JSON.parse(localStorage.getItem("sangam_profile_data")||"null");
    if (saved) currentUser = {...currentUser,...saved};
  } catch(e){}

  renderHeader();
  showTab("home");
  loadNotifBadge();
});

/* ── Header ──────────────────────────────────────────────── */
function renderHeader() {
  const av      = document.getElementById("header-avatar");
  const initial = (currentUser.name||"A")[0].toUpperCase();

  let url = fixAvatarUrl(currentUser.avatar_url || localStorage.getItem("sangam_profile_avatar"));

  if (!av) return;
  if (url) {
    av.innerHTML = `<img src="${escHtml(url)}" alt=""
      style="width:100%;height:100%;border-radius:50%;object-fit:cover"
      onerror="this.parentElement.textContent='${initial}';this.parentElement.style.background='${getColor(initial)}'">`;
    av.style.background = "none";
  } else {
    av.textContent = initial;
    av.style.background = getColor(initial);
  }

  const ca = document.getElementById("compose-av");
  if (ca) { ca.textContent = initial; ca.style.background = getColor(initial); }

  if (["alumni","teacher","admin"].includes(currentUser.role)) {
    document.getElementById("post-job-btn-wrap")?.classList.remove("hidden");
  }
  if (currentUser.role === "admin") {
    document.getElementById("admin-sidebar-link").style.display = "block";
  }
}

/* ════════════════════════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════════════════════════ */
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.querySelector(`.bnav-item[data-tab="${tab}"]`)?.classList.add("active");

  const fab = document.getElementById("fab-btn");
  if (fab) fab.style.display = tab === "feed" ? "flex" : "none";

  if (tab !== "chat") stopChatPolling();

  switch (tab) {
    case "home":    break;
    case "feed":    loadFeed();    break;
    case "alumni":  loadAlumni();  break;
    case "jobs":    loadJobs();    break;
    case "chat":    loadChat();    break;
    case "profile": loadProfile(); break;
    case "notifs":  loadNotifs();  break;
  }
}

/* ════════════════════════════════════════════════════════════
   SEARCH
════════════════════════════════════════════════════════════ */
function toggleSearch() {
  const sb = document.getElementById("search-bar");
  if (!sb) return;
  sb.classList.toggle("hidden");
  if (!sb.classList.contains("hidden")) sb.querySelector("input")?.focus();
}
function handleSearch(q) {
  q = (q || "").trim().toLowerCase();
  if (currentTab === "feed") {
    const el = document.getElementById("feed-list");
    if (!el) return;
    const posts = q
      ? allPosts.filter(p =>
          (p.content || "").toLowerCase().includes(q) ||
          (p.author?.name || "").toLowerCase().includes(q) ||
          (p.tags || []).some(t => t.toLowerCase().includes(q)))
      : allPosts;
    el.innerHTML = posts.length ? posts.map(renderPost).join("") : `<div class="feed-loading">No results for "${escHtml(q)}".</div>`;
  } else if (currentTab === "alumni") {
    searchAlumni(q);
  } else if (currentTab === "jobs") {
    searchJobs(q);
  } else {
    // Default: search alumni directory since it's the most common lookup
    showTab("alumni");
    searchAlumni(q);
  }
}

/* ════════════════════════════════════════════════════════════
   FEED
════════════════════════════════════════════════════════════ */
const DEMO_POSTS = [
  { id:"1", author:{name:"Rahul Verma",roll_number:"CSE20011",branch:"CSE",batch_year:2020,role:"alumni",trust_level:"verified"}, post_type:"job",      content:"Google is hiring — SWE Intern (Summer 2025)\nStrong DSA + problem solving needed. DM me for referral. Deadline April 30.",         tags:["SWE Intern","Remote OK","₹80k/mo"], likes:24, created_at:new Date(Date.now()-7200000).toISOString() },
  { id:"2", author:{name:"Priya Singh",roll_number:"EEE22045",branch:"EEE",batch_year:2022,role:"student",trust_level:"new"},     post_type:"question",  content:"Anyone who cracked GATE 2024? Looking for an EEE study plan. Would love guidance from alumni or seniors.",                              tags:[],                                  likes:11, created_at:new Date(Date.now()-18000000).toISOString() },
  { id:"3", author:{name:"Kiran Mehta",roll_number:"CSE19032",branch:"CSE",batch_year:2019,role:"alumni",trust_level:"verified"},  post_type:"win",       content:"Our product just crossed 1 Million users! 🎉 Hosting a free PM session for juniors next Saturday. Drop a comment to register.",      tags:[],                                  likes:67, created_at:new Date(Date.now()-86400000).toISOString() },
  { id:"4", author:{name:"Dr. S. Tiwari",roll_number:"TCH001",branch:"CSE",batch_year:2005,role:"teacher",trust_level:"verified"}, post_type:"event",     content:"AI & Machine Learning Seminar — this Friday 3PM, Seminar Hall A. Guest speaker from IIT Raipur. All students encouraged to attend.", tags:["AI","ML","Free"],                   likes:38, created_at:new Date(Date.now()-172800000).toISOString() },
  { id:"5", author:{name:"Sneha Verma",roll_number:"IT22088",branch:"IT",batch_year:2022,role:"student",trust_level:"partial"},    post_type:"tip",       content:"Interview tip: Always state the time & space complexity even if not asked. It signals you think like an engineer. 💡",              tags:["DSA","Placement"],                  likes:102,created_at:new Date(Date.now()-259200000).toISOString() },
];

async function loadFeed(filter=null) {
  const el = document.getElementById("feed-list");
  if (!el) return;
  el.innerHTML = `<div class="feed-loading">Loading posts…</div>`;
  try { allPosts = await PostsAPI.list(filter); }
  catch { allPosts = DEMO_POSTS; }
  const posts = filter ? allPosts.filter(p=>p.post_type===filter) : allPosts;
  el.innerHTML = posts.length ? posts.map(renderPost).join("") : `<div class="feed-loading">No posts yet.</div>`;
}

function renderPost(p) {
  const a       = p.author || {};
  const color   = getColor((a.name||"A")[0]);
  const initial = (a.name||"?")[0].toUpperCase();
  const avatarUrl = fixAvatarUrl(a.avatar_url || "");

  const badgeMap = {verified:"vb-g",partial:"vb-b",new:"vb-y"};
  const badgeC   = badgeMap[a.trust_level] || "";
  const trustL   = {verified:"Verified",partial:"Partial",new:"New"}[a.trust_level]||"";
  const typeL    = {job:"Job",question:"Question",win:"Win 🎉",event:"Event",tip:"Tip",update:"Update"}[p.post_type]||"Post";
  const tags     = (p.tags||[]).map(t=>`<span class="ptag ptag-pu">${escHtml(t)}</span>`).join("");

  const avatarHtml = avatarUrl
    ? `<div class="post-av" style="background:${color};padding:0;overflow:hidden">
         <img src="${escHtml(avatarUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"
           onerror="this.parentElement.style.background='${color}';this.parentElement.innerHTML='${initial}'">
       </div>`
    : `<div class="post-av" style="background:${color}">${initial}</div>`;

  return `
  <div class="post-card">
    <div class="post-head">
      ${avatarHtml}
      <div class="post-meta">
        <div class="post-name">${escHtml(a.name||"?")} ${trustL?`<span class="vbadge ${badgeC}">${trustL}</span>`:""}
        </div>
        <div class="post-sub">${escHtml(a.branch||"")} · Batch ${a.batch_year||""} · ${formatTime(p.created_at)}</div>
      </div>
      <div class="post-type-chip">${typeL}</div>
    </div>
    <div class="post-body">${escHtml(p.content||"").replace(/\n/g,"<br>")}</div>
    ${tags?`<div class="post-body" style="padding-top:0"><div class="tag-row">${tags}</div></div>`:""}
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
  const cnt = el.querySelector(".like-count");
  try {
    const res = await PostsAPI.like(id);
    if (cnt) cnt.textContent = res.likes;
    el.classList.toggle("liked", res.liked);
  } catch {
    if (cnt) cnt.textContent = parseInt(cnt.textContent||"0")+1;
    el.classList.add("liked");
  }
}

function filterFeed(type, chipEl) {
  document.querySelectorAll(".chips-row .chip").forEach(c=>c.classList.remove("on"));
  chipEl?.classList.add("on");
  loadFeed(type);
}
function chipSel(el) {
  el.closest(".chips-row")?.querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));
  el.classList.add("on");
}

/* ════════════════════════════════════════════════════════════
   ALUMNI
════════════════════════════════════════════════════════════ */
const DEMO_ALUMNI = [
  {id:"1",name:"Rahul Verma",  role:"alumni", branch:"CSE",batch_year:2020,trust_level:"verified",company:"Google",       skills:["SWE","DSA","Go"],          roll_number:"CSE20011"},
  {id:"2",name:"Kiran Mehta",  role:"alumni", branch:"ME", batch_year:2019,trust_level:"verified",company:"Flipkart PM",  skills:["PM","Analytics","SQL"],      roll_number:"ME19032"},
  {id:"3",name:"Dr. S. Tiwari",role:"teacher",branch:"CSE",batch_year:2005,trust_level:"verified",company:"CGIT Faculty", skills:["ML","Research"],             roll_number:"TCH001"},
  {id:"4",name:"Sneha Patel",  role:"alumni", branch:"CSE",batch_year:2017,trust_level:"verified",company:"Microsoft",    skills:["Azure","DevOps","Python"],   roll_number:"ALUMNI003"},
];

async function loadAlumni(params={}) {
  const el = document.getElementById("alumni-list");
  if (!el) return;
  el.innerHTML = `<div class="feed-loading">Loading alumni…</div>`;
  let users;
  try { users = await UsersAPI.list({role:"alumni",...params}); }
  catch { users = DEMO_ALUMNI; }
  el.innerHTML = users.length ? users.map(renderAlumni).join("") : `<div class="feed-loading">No alumni found.</div>`;
}

function renderAlumni(u) {
  const color      = getColor((u.name||"A")[0]);
  const initial    = (u.name||"?")[0].toUpperCase();
  const avatarUrl  = fixAvatarUrl(u.avatar_url || "");
  const roleL      = {alumni:"Alumni",teacher:"Teacher",admin:"Admin",student:"Student"}[u.role]||u.role;
  const skills     = (u.skills||[]).slice(0,3).map(s=>`<span class="ptag ptag-pu">${escHtml(s)}</span>`).join("");

  const avatarHtml = avatarUrl
    ? `<div class="alumni-av" style="background:${color};padding:0;overflow:hidden;cursor:pointer" onclick="viewProfile('${u.roll_number}')">
         <img src="${escHtml(avatarUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"
           onerror="this.parentElement.style.background='${color}';this.parentElement.innerHTML='${initial}'">
       </div>`
    : `<div class="alumni-av" style="background:${color};cursor:pointer" onclick="viewProfile('${u.roll_number}')">${initial}</div>`;

  return `
  <div class="alumni-card">
    ${avatarHtml}
    <div class="alumni-info">
      <div class="alumni-name">
        <span onclick="viewProfile('${u.roll_number}')" style="cursor:pointer">${escHtml(u.name)}</span>
        <span class="vbadge vb-g">${roleL}</span>
      </div>
      <div class="alumni-meta">${escHtml(u.branch||"")} · Batch ${u.batch_year||""}</div>
      ${u.company?`<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px">🏢 ${escHtml(u.company)}</div>`:""}
      ${skills?`<div class="alumni-tags" style="margin-top:6px">${skills}</div>`:""}
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
      <button class="btn-outline-sm" onclick="viewProfile('${u.roll_number}')">View</button>
      <button class="btn-outline-sm" onclick="startDMWith('${u.roll_number}')">Message</button>
    </div>
  </div>`;
}

async function searchAlumni(q) { if (!q) loadAlumni(); else loadAlumni({q}); }
function filterAlumniBy(key,val) { loadAlumni({[key]:val}); }

/* ════════════════════════════════════════════════════════════
   JOBS
════════════════════════════════════════════════════════════ */
const DEMO_JOBS = [
  {id:"1",title:"SWE Intern",           company:"Google",   location:"Bangalore",job_type:"internship",salary:"₹80k/mo",referral:true, skills:["DSA","Go","System Design"],posted_by:{name:"Rahul Verma"},  created_at:new Date(Date.now()-86400000).toISOString()},
  {id:"2",title:"Product Manager Intern",company:"Flipkart", location:"Remote",   job_type:"internship",salary:"₹70k/mo",referral:true, skills:["PM","Analytics","SQL"],    posted_by:{name:"Kiran Mehta"},  created_at:new Date(Date.now()-172800000).toISOString()},
  {id:"3",title:"Teaching Assistant",   company:"CGIT",     location:"On Campus",job_type:"parttime",  salary:"₹8k/mo", referral:false,skills:["DSA","Python"],            posted_by:{name:"Dr. S. Tiwari"},created_at:new Date(Date.now()-259200000).toISOString()},
];

async function loadJobs(params={}) {
  const el = document.getElementById("jobs-list");
  if (!el) return;
  el.innerHTML = `<div class="feed-loading">Loading jobs…</div>`;
  let jobs;
  try { jobs = await JobsAPI.list(params); }
  catch { jobs = DEMO_JOBS; }
  el.innerHTML = jobs.length ? jobs.map(renderJob).join("") : `<div class="feed-loading">No jobs found.</div>`;
}

function renderJob(j) {
  const skills = (j.skills||[]).map(s=>`<span class="ptag ptag-pu">${escHtml(s)}</span>`).join("");
  const poster = j.posted_by?.name || "Alumni";
  return `
  <div class="job-card">
    <div class="job-head">
      <div class="job-company-av">🏢</div>
      <div style="flex:1;min-width:0">
        <div class="job-title">${escHtml(j.title)}</div>
        <div class="job-company">${escHtml(j.company)} · ${escHtml(j.location||"")}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px">Posted by ${escHtml(poster)}</div>
      </div>
      ${j.salary?`<div style="font-size:13px;font-weight:600;color:#4ADE80;flex-shrink:0">${escHtml(j.salary)}</div>`:""}
    </div>
    ${j.description?`<div class="job-desc">${escHtml(j.description).slice(0,180)}…</div>`:""}
    ${skills?`<div class="job-tags">${skills}</div>`:""}
    <div class="job-foot">
      ${j.referral?`<span class="ptag ptag-gr">✓ Has Referral</span>`:`<span></span>`}
      ${j.apply_link
        ?`<a href="${escHtml(j.apply_link)}" target="_blank" class="btn-primary" style="text-decoration:none;font-size:12px;padding:7px 16px">Apply ↗</a>`
        :`<button class="btn-primary" style="font-size:12px;padding:7px 16px" onclick="showToast('Contact the poster directly for this opportunity')">Apply</button>`}
    </div>
  </div>`;
}
async function searchJobs(q) { if (!q) loadJobs(); else loadJobs({q}); }

/* ════════════════════════════════════════════════════════════
   CHAT (polling-based — refreshes every 4s while a room is open)
════════════════════════════════════════════════════════════ */
async function loadChat() {
  const el = document.getElementById("chat-rooms-list");
  if (!el) return;
  try {
    allRooms = await ChatAPI.rooms();
    renderRoomList();
  } catch {
    el.innerHTML = `<div class="feed-loading">Could not load chats. Check your connection.</div>`;
  }
}

function renderRoomList() {
  const el = document.getElementById("chat-rooms-list");
  if (!el) return;
  const all = [...allRooms.system_groups, ...allRooms.my_groups, ...allRooms.dms];
  if (!all.length) { el.innerHTML = `<div class="feed-loading">No conversations yet.</div>`; return; }

  el.innerHTML = all.map(r => {
    const isDm  = r.type === "dm";
    const name  = isDm ? (r.dm_with?.name || r.dm_with?.roll_number || "Unknown") : r.name;
    const initial = (name || "?")[0].toUpperCase();
    const color = getColor(initial);
    const preview = r.last_message?.content || (r.type === "system" ? "Say hello 👋" : "No messages yet");
    const active = activeRoom?.id === r.id ? "active" : "";
    return `
    <div class="chat-room-item ${active}" onclick="openRoomFromList('${r.id}')">
      <div class="chat-room-av" style="background:${color}">${escHtml(initial)}</div>
      <div class="chat-room-meta">
        <div class="chat-room-name">${escHtml(name)}</div>
        <div class="chat-room-preview">${escHtml(preview)}</div>
      </div>
    </div>`;
  }).join("");
}

function openRoomFromList(roomId) {
  const all = [...allRooms.system_groups, ...allRooms.my_groups, ...allRooms.dms];
  const room = all.find(r => r.id === roomId);
  if (room) openRoom(room);
}

async function openRoom(room) {
  activeRoom = {
    id:   room.id,
    type: room.type,
    name: room.type === "dm" ? (room.dm_with?.name || room.dm_with?.roll_number) : room.name,
    dm_roll: room.dm_with?.roll_number || null,
  };
  chatLastMsgTime = null;

  document.getElementById("chat-empty-state").style.display = "none";
  document.getElementById("active-chat").style.display = "flex";
  document.getElementById("cp-name").textContent = activeRoom.name || "Chat";
  document.getElementById("cp-sub").textContent  = room.type === "system" ? "Community group"
    : room.type === "group" ? `${(room.members||[]).length} members` : "Direct message";
  const av = document.getElementById("cp-avatar");
  const initial = (activeRoom.name || "?")[0].toUpperCase();
  av.textContent = initial;
  av.style.background = getColor(initial);

  document.getElementById("chat-sidebar").classList.add("hide-mobile");
  document.getElementById("chat-panel").classList.add("show-mobile");

  renderRoomList();

  const area = document.getElementById("chat-messages-area");
  area.innerHTML = `<div class="feed-loading">Loading messages…</div>`;
  try {
    const msgs = await ChatAPI.getMessages(room.id);
    area.innerHTML = "";
    msgs.forEach(appendChatMessage);
    if (msgs.length) chatLastMsgTime = msgs[msgs.length - 1].created_at;
    area.scrollTop = area.scrollHeight;
  } catch {
    area.innerHTML = `<div class="feed-loading">Could not load messages.</div>`;
  }

  startChatPolling();
}

function backToRoomList() {
  document.getElementById("chat-sidebar").classList.remove("hide-mobile");
  document.getElementById("chat-panel").classList.remove("show-mobile");
}

function startChatPolling() {
  stopChatPolling();
  chatPollTimer = setInterval(async () => {
    if (!activeRoom) return;
    try {
      const msgs = await ChatAPI.getMessages(activeRoom.id, chatLastMsgTime);
      if (msgs.length) {
        msgs.forEach(appendChatMessage);
        chatLastMsgTime = msgs[msgs.length - 1].created_at;
        const area = document.getElementById("chat-messages-area");
        area.scrollTop = area.scrollHeight;
      }
    } catch { /* silent — will retry next tick */ }
  }, 4000);
}
function stopChatPolling() {
  if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
}

function appendChatMessage(m) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  const mine = m.sender === currentUser?.roll_number;
  const div = document.createElement("div");
  div.className = `chat-msg ${mine ? "mine" : "theirs"}`;
  div.innerHTML = `
    ${!mine && activeRoom?.type !== "dm" ? `<div class="chat-msg-sender">${escHtml(m.sender_name||m.sender)}</div>` : ""}
    <div>${escHtml(m.content)}</div>
    <div class="chat-msg-time">${formatChatTime(m.created_at)}</div>`;
  area.appendChild(div);
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const content = input.value.trim();
  if (!content || !activeRoom) return;
  input.value = ""; autoGrow(input);
  try {
    const msg = await ChatAPI.sendMessage(activeRoom.id, content);
    appendChatMessage(msg);
    chatLastMsgTime = msg.created_at;
    const area = document.getElementById("chat-messages-area");
    area.scrollTop = area.scrollHeight;
    loadChat(); // refresh room list preview/order
  } catch {
    showToast("Message failed to send", "error");
  }
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 100) + "px";
}

function openActiveRoomProfile() {
  if (activeRoom?.type === "dm" && activeRoom.dm_roll) {
    viewProfile(activeRoom.dm_roll);
  } else {
    showToast(activeRoom?.type === "system" ? "Everyone in Sangam is part of this chat" : "Group chat");
  }
}

async function startDMWith(roll) {
  try {
    const room = await ChatAPI.startDM(roll);
    showTab("chat");
    await loadChat();
    openRoom(room);
  } catch (e) {
    showToast(e.message || "Could not start chat", "error");
  }
}

function openDMSearch() {
  openModal(`
    <div style="color:#fff">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;margin-bottom:14px">New Message</div>
      <input id="dm-search-inp" class="ef-input" placeholder="Search by name or roll number…" oninput="runDMSearch(this.value)" style="margin-bottom:12px">
      <div id="dm-search-results" style="max-height:280px;overflow-y:auto"></div>
    </div>`);
}
async function runDMSearch(q) {
  const el = document.getElementById("dm-search-results");
  q = q.trim();
  if (!q) { el.innerHTML = ""; return; }
  try {
    const users = await ChatAPI.searchUsers(q);
    el.innerHTML = users.length ? users.map(u => `
      <div class="chat-room-item" style="cursor:pointer" onclick="closeModal();startDMWith('${escHtml(u.roll_number)}')">
        <div class="chat-room-av" style="background:${getColor(u.name[0])}">${escHtml(u.name[0].toUpperCase())}</div>
        <div class="chat-room-meta">
          <div class="chat-room-name">${escHtml(u.name)}</div>
          <div class="chat-room-preview">${escHtml(u.roll_number)} · ${escHtml(u.branch||"")}</div>
        </div>
      </div>`).join("") : `<div class="feed-loading">No users found.</div>`;
  } catch { el.innerHTML = `<div class="feed-loading">Search failed.</div>`; }
}

let _newGroupMembers = {};
function openNewGroupModal() {
  _newGroupMembers = {};
  openModal(`
    <div style="color:#fff">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;margin-bottom:14px">New Group</div>
      <input id="ng-name-inp" class="ef-input" placeholder="Group name" style="margin-bottom:10px">
      <input id="ng-search-inp" class="ef-input" placeholder="Add members — search by name or roll…" oninput="runGroupSearch(this.value)" style="margin-bottom:8px">
      <div id="ng-search-results" style="max-height:180px;overflow-y:auto;margin-bottom:10px"></div>
      <div id="ng-selected" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px"></div>
      <div style="display:flex;gap:8px">
        <button class="ef-cancel-btn" onclick="closeModal()">Cancel</button>
        <button class="ef-save-btn" onclick="submitNewGroup()"><i class="ti ti-users"></i> Create Group</button>
      </div>
    </div>`);
}
async function runGroupSearch(q) {
  const el = document.getElementById("ng-search-results");
  q = q.trim();
  if (!q) { el.innerHTML = ""; return; }
  try {
    const users = await ChatAPI.searchUsers(q);
    el.innerHTML = users.map(u => `
      <div class="chat-room-item" style="cursor:pointer;padding:8px 10px" onclick='addGroupMember(${JSON.stringify(u.roll_number)}, ${JSON.stringify(u.name)})'>
        <div class="chat-room-av" style="background:${getColor(u.name[0])};width:32px;height:32px;font-size:13px">${escHtml(u.name[0].toUpperCase())}</div>
        <div class="chat-room-meta"><div class="chat-room-name">${escHtml(u.name)}</div></div>
      </div>`).join("");
  } catch { el.innerHTML = ""; }
}
function addGroupMember(roll, name) {
  _newGroupMembers[roll] = name;
  renderSelectedMembers();
  document.getElementById("ng-search-inp").value = "";
  document.getElementById("ng-search-results").innerHTML = "";
}
function removeGroupMember(roll) {
  delete _newGroupMembers[roll];
  renderSelectedMembers();
}
function renderSelectedMembers() {
  const el = document.getElementById("ng-selected");
  el.innerHTML = Object.entries(_newGroupMembers).map(([roll,name]) => `
    <span class="ptag ptag-pu" style="cursor:pointer" onclick="removeGroupMember('${escHtml(roll)}')">${escHtml(name)} ✕</span>
  `).join("");
}
async function submitNewGroup() {
  const name = document.getElementById("ng-name-inp")?.value.trim();
  const members = Object.keys(_newGroupMembers);
  if (!name) { showToast("Group name required", "error"); return; }
  if (!members.length) { showToast("Add at least one member", "error"); return; }
  try {
    const room = await ChatAPI.createGroup(name, members);
    closeModal();
    showTab("chat");
    await loadChat();
    openRoom(room);
  } catch (e) {
    showToast(e.message || "Could not create group", "error");
  }
}

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════════════════════════ */
async function loadNotifs(){
  const el=document.getElementById("notifs-list");if(!el)return;
  let notifs;
  try{notifs=await NotifsAPI.list();}
  catch{notifs=[{id:"1",notif_type:"system",title:"Welcome to Sangam!",body:"Connect with alumni, find jobs, and chat with your batch.",is_read:false,created_at:new Date().toISOString()}];}
  el.innerHTML=notifs.length?notifs.map(n=>`<div class="notif-item ${n.is_read?"":"unread"}"><div class="notif-icon">${{system:"📢",job:"💼",message:"💬"}[n.notif_type]||"🔔"}</div><div><div class="notif-text">${escHtml(n.title)}</div>${n.body?`<div class="notif-text" style="font-size:13px;color:rgba(255,255,255,0.45);margin-top:3px">${escHtml(n.body)}</div>`:""}<div class="notif-time">${formatTime(n.created_at)}</div></div></div>`).join(""):`<div class="feed-loading">No notifications</div>`;
}
async function markAllRead(){try{await NotifsAPI.readAll();loadNotifs();document.getElementById("notif-dot").style.display="none";}catch{showToast("Could not mark as read","error");}}
async function loadNotifBadge(){try{const n=await NotifsAPI.list();const u=n.filter(x=>!x.is_read).length;const dot=document.getElementById("notif-dot");if(dot)dot.style.display=u?"block":"none";}catch{}}

/* ════════════════════════════════════════════════════════════
   MODALS
════════════════════════════════════════════════════════════ */
function openModal(html){
  const ov=document.getElementById("modal-overlay"),mc=document.getElementById("modal-content");
  if(!ov||!mc)return;
  mc.innerHTML=html; ov.style.display="block"; mc.style.display="block";
}
function closeModal(){
  const ov=document.getElementById("modal-overlay"),mc=document.getElementById("modal-content");
  if(ov)ov.style.display="none"; if(mc)mc.style.display="none";
}

function openPostModal(){
  openModal(`
    <div style="color:#fff">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;margin-bottom:14px">Create Post</div>
      <select id="post-type-sel" class="ef-input" style="margin-bottom:10px">
        <option value="update">Update</option><option value="job">Job Opportunity</option>
        <option value="question">Question</option><option value="win">Achievement/Win</option>
        <option value="event">Event</option><option value="tip">Tip/Advice</option>
      </select>
      <textarea id="post-content-inp" class="ef-input ef-textarea" rows="5" placeholder="What's on your mind?" style="resize:vertical;margin-bottom:10px"></textarea>
      <input id="post-tags-inp" class="ef-input" placeholder="Tags, comma separated" style="margin-bottom:14px">
      <div style="display:flex;gap:8px">
        <button class="ef-cancel-btn" onclick="closeModal()">Cancel</button>
        <button class="ef-save-btn" onclick="submitPost()"><i class="ti ti-send"></i> Post</button>
      </div>
    </div>`);
}
async function submitPost(){
  const type=document.getElementById("post-type-sel")?.value||"update";
  const content=document.getElementById("post-content-inp")?.value.trim();
  const tags=(document.getElementById("post-tags-inp")?.value||"").split(",").map(t=>t.trim()).filter(Boolean);
  if(!content){showToast("Write something first","error");return;}
  try{await PostsAPI.create({post_type:type,content,tags});closeModal();showToast("Posted!","success");loadFeed();}
  catch{showToast("Could not post. Try again.","error");}
}

function openJobModal(){
  openModal(`
    <div style="color:#fff">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;margin-bottom:14px">Post Job / Internship</div>
      <input id="jm-title"    class="ef-input" placeholder="Job title"             style="margin-bottom:10px">
      <input id="jm-company"  class="ef-input" placeholder="Company name"          style="margin-bottom:10px">
      <input id="jm-location" class="ef-input" placeholder="Location / Remote"     style="margin-bottom:10px">
      <select id="jm-type" class="ef-input" style="margin-bottom:10px">
        <option value="internship">Internship</option><option value="fulltime">Full-Time</option>
        <option value="parttime">Part-Time</option><option value="contract">Contract</option>
      </select>
      <input id="jm-salary" class="ef-input" placeholder="Salary / Stipend"        style="margin-bottom:10px">
      <textarea id="jm-desc" class="ef-input" rows="3" placeholder="Description…"  style="resize:vertical;margin-bottom:10px"></textarea>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer;color:rgba(255,255,255,0.7)">
        <input type="checkbox" id="jm-referral"> I can provide a referral
      </label>
      <div style="display:flex;gap:8px">
        <button class="ef-cancel-btn" onclick="closeModal()">Cancel</button>
        <button class="ef-save-btn" onclick="submitJob()"><i class="ti ti-briefcase"></i> Post Job</button>
      </div>
    </div>`);
}
async function submitJob(){
  const payload={title:document.getElementById("jm-title")?.value.trim(),company:document.getElementById("jm-company")?.value.trim(),location:document.getElementById("jm-location")?.value.trim(),job_type:document.getElementById("jm-type")?.value,salary:document.getElementById("jm-salary")?.value.trim(),description:document.getElementById("jm-desc")?.value.trim(),referral:document.getElementById("jm-referral")?.checked};
  if(!payload.title||!payload.company){showToast("Title and company required","error");return;}
  try{await JobsAPI.create(payload);closeModal();showToast("Job posted!","success");loadJobs();}
  catch{showToast("Could not post job","error");}
}

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type="info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show${type?" "+type:""}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove("show"),3000);
}

/* ── Logout ───────────────────────────────────────────────── */
function logout(){ Auth.clear(); window.location.href="auth.html"; }

/* ════════════════════════════════════════════════════════════
   VIEW USER PROFILE — Bottom sheet modal
════════════════════════════════════════════════════════════ */
async function viewProfile(rollNumber) {
  if (!rollNumber) return;

  openModal(`
    <div style="color:#fff;min-height:200px;display:flex;align-items:center;justify-content:center">
      <div style="text-align:center;color:rgba(255,255,255,0.4)">
        <i class="ti ti-loader" style="font-size:28px;animation:spin 1s linear infinite"></i>
        <div style="margin-top:10px;font-size:13px">Loading profile…</div>
      </div>
    </div>`);

  try {
    const u = await UsersAPI.get(rollNumber);
    const color     = getColor((u.name||"A")[0]);
    const initial   = (u.name||"A")[0].toUpperCase();
    const avatarUrl = u.avatar_url ? fixUrl(u.avatar_url) : "";
    const skills    = Array.isArray(u.skills) ? u.skills : (u.skills||"").split(",").map(s=>s.trim()).filter(Boolean);
    const roleL     = {alumni:"Alumni",teacher:"Teacher",admin:"Admin",student:"Student"}[u.role]||u.role;
    const trustL    = {verified:"Verified ✓",partial:"Partial",new:"New"}[u.trust_level]||"";
    const trustC    = {verified:"#4ADE80",partial:"#FCD34D",new:"#F87171"}[u.trust_level]||"#888";
    const isMe      = u.roll_number === currentUser?.roll_number;

    document.getElementById("modal-content").innerHTML = `<div style="color:#fff">
      <div style="height:80px;background:linear-gradient(135deg,#1D4ED8,#2563EB);border-radius:8px 8px 0 0;margin:-18px -18px 0;position:relative;overflow:hidden">
        ${u.wallpaper_url ? `<img src="${escHtml(fixUrl(u.wallpaper_url))}" style="width:100%;height:100%;object-fit:cover">` : ""}
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:-28px;margin-bottom:14px">
        <div style="width:58px;height:58px;border-radius:50%;border:3px solid #13131A;overflow:hidden;background:${color};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;font-family:'Playfair Display',serif;color:#fff;flex-shrink:0">
          ${avatarUrl ? `<img src="${escHtml(avatarUrl)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.textContent='${initial}'">` : initial}
        </div>
        ${isMe ? `<button onclick="closeModal();showTab('profile')"
          style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">
          <i class="ti ti-pencil"></i> Edit Profile
        </button>` : `<button onclick="closeModal();startDMWith('${escHtml(u.roll_number)}')"
          style="background:var(--purple);border:none;color:#fff;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">
          <i class="ti ti-message-2"></i> Message
        </button>`}
      </div>
      <div style="margin-bottom:16px">
        <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:#fff;margin-bottom:4px">${escHtml(u.name||"—")}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-bottom:6px">${escHtml(u.branch||"")} · Batch ${u.batch_year||""} · ${escHtml(roleL)}</div>
        ${trustL ? `<span style="font-size:11px;font-weight:600;color:${trustC}">${trustL}</span>` : ""}
      </div>
      <div style="background:rgba(255,255,255,0.05);border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:rgba(255,255,255,0.5)">
        <span style="font-family:monospace;font-size:13px;color:#fff">${escHtml(u.roll_number||"—")}</span>
        <span style="margin-left:8px">Roll Number</span>
      </div>
      ${u.bio ? `<div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08)">${escHtml(u.bio)}</div>` : ""}
      ${u.company ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <div style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🏢</div>
        <div><div style="font-size:13px;font-weight:600;color:#fff">${escHtml(u.company)}</div><div style="font-size:11px;color:rgba(255,255,255,0.35)">Current employer</div></div>
      </div>` : ""}
      ${skills.length ? `<div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:8px">Skills</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">${skills.map(s=>`<span style="background:rgba(29,78,216,0.15);border:1px solid rgba(29,78,216,0.25);color:#3B82F6;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:600">${escHtml(s)}</span>`).join("")}</div>
      </div>` : ""}
      ${(u.linkedin_url||u.github_url||u.email) ? `<div>
        <div style="font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:10px">Contact & Links</div>
        ${u.linkedin_url ? `<a href="${escHtml(u.linkedin_url)}" target="_blank" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-decoration:none"><i class="ti ti-brand-linkedin" style="font-size:16px;color:#0A66C2;width:20px"></i><span style="font-size:13px;color:rgba(255,255,255,0.6)">LinkedIn</span><i class="ti ti-external-link" style="font-size:12px;color:rgba(255,255,255,0.25);margin-left:auto"></i></a>` : ""}
        ${u.github_url ? `<a href="${escHtml(u.github_url)}" target="_blank" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-decoration:none"><i class="ti ti-brand-github" style="font-size:16px;color:#fff;width:20px"></i><span style="font-size:13px;color:rgba(255,255,255,0.6)">GitHub</span><i class="ti ti-external-link" style="font-size:12px;color:rgba(255,255,255,0.25);margin-left:auto"></i></a>` : ""}
        ${u.email ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 0"><i class="ti ti-mail" style="font-size:16px;color:#3B82F6;width:20px"></i><span style="font-size:13px;color:rgba(255,255,255,0.6)">${escHtml(u.email)}</span></div>` : ""}
      </div>` : ""}
    </div>`;
  } catch(e) {
    document.getElementById("modal-content").innerHTML = `
      <div style="color:rgba(255,255,255,0.4);text-align:center;padding:32px 0">
        <i class="ti ti-user-off" style="font-size:32px"></i>
        <div style="margin-top:10px;font-size:13px">Could not load profile</div>
      </div>`;
  }
}