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
    <div class="jc-tags">${skills}</div>
    <div class="jc-foot">
      ${j.referral ? `<div class="ref-badge">Has Referral</div>` : `<div></div>`}
      <button class="apply-btn" onclick="showToast('Contact the poster via DM!')">Apply</button>
    </div>
  </div>`;
}

function searchJobs(q) { /* filter locally or API */ }

/* ════════════════════════════════════════
   CHAT — WhatsApp style
════════════════════════════════════════ */
async function loadChat() {
  try {
    const data = await ChatAPI.rooms();
    allRooms = data;
    renderRoomList();
    // Auto-open global chat on desktop
    if (window.innerWidth > 600) {
      openRoom("global", "Sangam Community", "Community group");
    }
  } catch {
    // Offline — render demo rooms
    allRooms = {
      system_groups: [
        { id:"global",     name:"Sangam Community",  icon:"globe" },
        { id:"placements", name:"Placements 2025",   icon:"briefcase" },
        { id:"mentorship", name:"Mentorship Connect",icon:"handshake" },
      ],
      my_groups: [],
      dms: [],
    };
    renderRoomList();
  }
}

function renderRoomList() {
  const el = document.getElementById("chat-rooms-list");
  if (!el) return;

  const { system_groups = [], my_groups = [], dms = [] } = allRooms;
  let html = "";

  if (system_groups.length) {
    html += `<div class="room-section-label">Groups</div>`;
    html += system_groups.map(r => roomItem(r.id, r.name, "G", "group")).join("");
  }
  if (my_groups.length) {
    html += `<div class="room-section-label">My Groups</div>`;
    html += my_groups.map(r => roomItem(r.id||r.room, r.name, r.name[0], "mygroup")).join("");
  }
  if (dms.length) {
    html += `<div class="room-section-label">Direct Messages</div>`;
    html += dms.map(d => roomItem(d.id, d.with_name, d.with_name[0], "dm", d.last_message, d.last_time)).join("");
  }

  el.innerHTML = html || `<div class="feed-loading" style="color:rgba(255,255,255,0.4)">No chats yet</div>`;
}

function roomItem(id, name, initial, type, lastMsg = "", lastTime = "") {
  const color = getColor(initial);
  const isActive = activeRoom === id ? " active" : "";
  return `
  <div class="room-item${isActive}" onclick="openRoom('${escHtml(id)}','${escHtml(name)}','${type}')">
    <div class="room-av" style="background:${color}">${initial.toUpperCase()}</div>
    <div class="room-info">
      <div class="room-name">${escHtml(name)}</div>
      ${lastMsg ? `<div class="room-last">${escHtml(lastMsg)}</div>` : ""}
    </div>
    ${lastTime ? `<div class="room-time">${formatTime(lastTime)}</div>` : ""}
  </div>`;
}

async function openRoom(roomId, roomName, sub) {
  activeRoom     = roomId;
  activeRoomName = roomName;

  // Mobile: hide sidebar, show panel
  document.getElementById("chat-sidebar")?.classList.add("hidden-mobile");
  document.getElementById("chat-panel")?.classList.add("visible-mobile");

  // Update panel header
  document.getElementById("cp-name").textContent = roomName;
  document.getElementById("cp-sub").textContent  = sub || "Group";
  document.getElementById("cp-avatar").textContent = (roomName[0] || "G").toUpperCase();

  // Highlight active room
  document.querySelectorAll(".room-item").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".room-item").forEach(el => {
    if (el.textContent.includes(roomName)) el.classList.add("active");
  });

  // Show active chat
  document.getElementById("chat-empty-state").style.display = "none";
  const ac = document.getElementById("active-chat");
  ac.style.display = "flex";

  // Load messages
  await loadMessages(roomId);

  // Connect socket
  connectSocket(roomId);

  // Focus input
  document.getElementById("chat-input")?.focus();
}

async function loadMessages(roomId) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  area.innerHTML = `<div class="msg-system">Loading messages…</div>`;

  let msgs;
  try {
    msgs = await ChatAPI.getMessages(roomId);
  } catch {
    msgs = [
      { id:"d1", sender_id:"other", sender_name:"Rahul Verma", sender_roll:"CSE20011", room:roomId, content:"Hey everyone! Welcome to Sangam.", created_at: new Date(Date.now()-3600000).toISOString() },
      { id:"d2", sender_id:"other", sender_name:"Priya Singh",  sender_roll:"EEE22045", room:roomId, content:"This is a great platform for our college!", created_at: new Date(Date.now()-1800000).toISOString() },
    ];
  }

  if (!msgs.length) {
    area.innerHTML = `<div class="msg-system">No messages yet. Be the first!</div>`;
    return;
  }

  area.innerHTML = renderMessages(msgs);
  area.scrollTop = area.scrollHeight;
}

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

    html += `<div class="msg-row ${isMine ? "mine" : "theirs"}">`;
    if (!isMine) html += `<div class="msg-av-sm" style="background:${color}">${avInitial}</div>`;
    html += `<div class="msg-bubble">`;
    if (!isMine) html += `<span class="msg-sender-name">${escHtml(m.sender_name)}</span>`;

    if (m.media_type === "image" && m.media_url) {
      html += `<img class="msg-img" src="${escHtml(m.media_url)}" alt="image" onclick="window.open(this.src,'_blank')">`;
    } else if (m.media_type === "file" && m.media_url) {
      html += `<a class="msg-file" href="${escHtml(m.media_url)}" target="_blank">📎 ${escHtml(m.content||"File")}</a>`;
    } else if (m.media_type === "video" && m.media_url) {
      html += `<video controls style="max-width:220px;border-radius:10px"><source src="${escHtml(m.media_url)}"></video>`;
    } else {
      html += `<div class="msg-text">${escHtml(m.content||"").replace(/\n/g,"<br>")}</div>`;
    }

    html += `<div class="msg-time">${formatChatTime(m.created_at)}</div>`;
    html += `</div>`;
    if (isMine) html += `<div class="msg-av-sm" style="background:var(--purple)">${(currentUser.name||"U")[0].toUpperCase()}</div>`;
    html += `</div>`;
  });

  return html;
}

function appendMessage(m) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  const temp = document.createElement("div");
  temp.innerHTML = renderMessages([m]);
  while (temp.firstChild) area.appendChild(temp.firstChild);
  area.scrollTop = area.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById("chat-input");
  const content = (input?.value || "").trim();
  if (!content || !activeRoom) return;

  input.value = "";
  input.style.height = "auto";

  // Optimistic local render
  const now = new Date().toISOString();
  appendMessage({
    id: "local-" + Date.now(),
    sender_id:   String(currentUser.id),
    sender_name: currentUser.name,
    sender_roll: currentUser.roll_number,
    room:        activeRoom,
    content,
    created_at:  now,
  });

  // Send via socket or REST
  if (chatSocket?.connected) {
    chatSocket.emit("message", {
      token:   Auth.getToken() || "",
      room:    activeRoom,
      content,
    });
  } else {
    try {
      await ChatAPI.sendMessage(activeRoom, content);
    } catch { /* offline */ }
  }
}

function connectSocket(room) {
  if (typeof io === "undefined") return; // socket.io not loaded
  if (chatSocket) { chatSocket.emit("leave", { room }); }
  const token = Auth.getToken() || "";
  chatSocket = io("http://localhost:5000", { auth: { token: `Bearer ${token}` } });
  chatSocket.emit("join", { token: `Bearer ${token}`, room });
  chatSocket.on("new_message", msg => {
    if (msg.room !== activeRoom) return;
    if (String(msg.sender_id) === String(currentUser.id)) return; // already rendered optimistically
    appendMessage(msg);
  });
}

function backToRoomList() {
  document.getElementById("chat-sidebar")?.classList.remove("hidden-mobile");
  document.getElementById("chat-panel")?.classList.remove("visible-mobile");
}

function filterChatRooms(q) {
  document.querySelectorAll(".room-item").forEach(el => {
    const name = el.querySelector(".room-name")?.textContent || "";
    el.style.display = name.toLowerCase().includes(q.toLowerCase()) ? "" : "none";
  });
}

async function handleFileAttach(input) {
  if (!input.files[0] || !activeRoom) return;
  const file = input.files[0];
  showToast("Uploading file…", "info");
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
    });
    showToast("File sent!", "success");
  } catch { showToast("Upload failed", "error"); }
  input.value = "";
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 110) + "px";
}

function openDMSearch() {
  openModal(`
    <div style="padding-bottom:8px">
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
    setTimeout(() => openRoom(res.room, res.with_user?.name || "DM", "Direct Message"), 300);
  } catch { showToast("Could not start DM", "error"); }
}

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
    openRoom(res.room || `group_${res.id}`, name, "New group");
  } catch { showToast("Could not create group", "error"); }
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