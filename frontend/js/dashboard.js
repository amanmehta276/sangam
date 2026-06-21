/* ============================================================
   dashboard.js — Sangam Dashboard (rewritten for new HTML/CSS)
   ============================================================ */

/* ── Global State ────────────────────────────────────────── */
let currentUser    = null;
let currentTab     = "home";
let activeRoom     = null;
let activeRoomName = "";
let chatSocket     = null;
let allRooms       = { system_groups:[], my_groups:[], dms:[] };
let allPosts       = [];
let replyingTo     = null;
let chatLightMode  = false;
let typingTimer    = null;
let ctxTargetMsg   = null;
let ctxMsgContent  = "";
let ctxMsgSender   = "";
let groupMembers   = {};
let unreadCounts   = {};
let onlineUsers    = new Set();

/* ── Colors ──────────────────────────────────────────────── */
const AV_COLORS = ["#7C3AED","#9333EA","#16A34A","#0288D1","#E91E63","#FF5722","#00796B","#5C6BC0"];
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
function formatRoomTime(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
  if ((now - d) / 86400000 < 7)
    return d.toLocaleDateString("en-IN",{weekday:"short"});
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  // Load or use demo user
  currentUser = Auth.getUser() || {
    id:"demo", name:"Arjun Sharma", roll_number:"CSE22101",
    branch:"CSE", batch_year:2022, role:"student", trust_level:"partial",
    skills:["React","Python","DSA"],
  };

  // Merge locally saved profile data
  try {
    const saved = JSON.parse(localStorage.getItem("sangam_profile_data")||"null");
    if (saved) currentUser = {...currentUser,...saved};
  } catch(e){}

  renderHeader();
  showTab("home");   // ← always open home first
  loadNotifBadge();

  window.addEventListener("popstate", e => {
    if (e.state?.chatRoom) backToRoomList();
  });
});

/* ── Header ──────────────────────────────────────────────── */
function renderHeader() {
  const av      = document.getElementById("header-avatar");
  const initial = (currentUser.name||"A")[0].toUpperCase();

  // Avatar URL — server value hamesha priority, localStorage sirf fallback.
  // fixUrl() (defined in profile.js) handles every relative-path shape the
  // backend might return, not just "/uploads/..." — keeps this in sync with
  // loadProfile()/updateIDCard() instead of duplicating partial logic here.
  let url = currentUser.avatar_url
    ? fixUrl(currentUser.avatar_url)
    : fixUrl(localStorage.getItem("sangam_profile_avatar"));

  if (!av) return;
  if (url) {
    av.innerHTML = `<img src="${escHtml(url)}" alt="" 
      style="width:100%;height:100%;border-radius:50%;object-fit:cover"
      onerror="this.parentElement.innerHTML='${initial}';this.parentElement.style.background='${getColor(initial)}'">`;
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

  // Hide all tabs, deactivate all nav items
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(n => n.classList.remove("active"));
  document.body.classList.remove("chat-panel-open");

  // Activate chosen tab
  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.querySelector(`.bnav-item[data-tab="${tab}"]`)?.classList.add("active");

  // FAB only on feed
  const fab = document.getElementById("fab-btn");
  if (fab) fab.style.display = tab === "feed" ? "flex" : "none";

  // Load tab content
  switch (tab) {
    case "home":    /* iframe already loaded */ break;
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
function handleSearch(q) { /* TODO: filter by currentTab */ }

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
  const a = p.author || {};
  const color    = getColor((a.name||"A")[0]);
  const initial  = (a.name||"?")[0].toUpperCase();
  const badgeMap = {verified:"vb-g",partial:"vb-b",new:"vb-y"};
  const badgeC   = badgeMap[a.trust_level] || "";
  const trustL   = {verified:"Verified",partial:"Partial",new:"New"}[a.trust_level]||"";
  const typeL    = {job:"Job",question:"Question",win:"Win 🎉",event:"Event",tip:"Tip",update:"Update"}[p.post_type]||"Post";
  const tags     = (p.tags||[]).map(t=>`<span class="ptag ptag-pu">${escHtml(t)}</span>`).join("");

  // Author avatar — reuse the shared fixUrl() so feed avatars follow the
  // same server-first, all-relative-formats rule as profile/header avatars.
  const avatarUrl = a.avatar_url ? fixUrl(a.avatar_url) : "";
  const avatarHtml = avatarUrl
    ? `<div class="post-av" style="background:${color};padding:0;overflow:hidden">
         <img src="${escHtml(avatarUrl)}" alt=""
           style="width:100%;height:100%;object-fit:cover;border-radius:50%"
           onerror="this.style.display='none';this.parentElement.textContent='${initial}'">
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
  const color   = getColor((u.name||"A")[0]);
  const initial = (u.name||"?")[0].toUpperCase();
  const roleL   = {alumni:"Alumni",teacher:"Teacher",admin:"Admin",student:"Student"}[u.role]||u.role;
  const skills  = (u.skills||[]).slice(0,3).map(s=>`<span class="ptag ptag-pu">${escHtml(s)}</span>`).join("");

  // Reuse fixUrl() so alumni-directory avatars follow the same rule as everywhere else.
  const avatarUrl = u.avatar_url ? fixUrl(u.avatar_url) : "";
  const avatarHtml = avatarUrl
    ? `<div class="alumni-av" style="background:${color};padding:0;overflow:hidden;cursor:pointer" onclick="startDMWith('${u.roll_number}')">
         <img src="${escHtml(avatarUrl)}" alt=""
           style="width:100%;height:100%;object-fit:cover;border-radius:50%"
           onerror="this.style.display='none';this.parentElement.textContent='${initial}'">
       </div>`
    : `<div class="alumni-av" style="background:${color};cursor:pointer" onclick="startDMWith('${u.roll_number}')">${initial}</div>`;

  return `
  <div class="alumni-card">
    ${avatarHtml}
    <div class="alumni-info">
      <div class="alumni-name">
        <span onclick="startDMWith('${u.roll_number}')" style="cursor:pointer">${escHtml(u.name)}</span>
        <span class="vbadge vb-g">${roleL}</span>
      </div>
      <div class="alumni-meta">${escHtml(u.branch||"")} · Batch ${u.batch_year||""}</div>
      ${u.company?`<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px">🏢 ${escHtml(u.company)}</div>`:""}
      ${skills?`<div class="alumni-tags" style="margin-top:6px">${skills}</div>`:""}
    </div>
    <button class="btn-outline-sm" onclick="startDMWith('${u.roll_number}')">DM</button>
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
      ${j.salary?`<div style="font-size:13px;font-weight:700;color:#4ADE80;flex-shrink:0">${escHtml(j.salary)}</div>`:""}
    </div>
    ${j.description?`<div class="job-desc">${escHtml(j.description).slice(0,180)}…</div>`:""}
    ${skills?`<div class="job-tags">${skills}</div>`:""}
    <div class="job-foot">
      ${j.referral?`<span class="ptag ptag-gr">✓ Has Referral</span>`:`<span></span>`}
      ${j.apply_link
        ?`<a href="${escHtml(j.apply_link)}" target="_blank" class="btn-primary" style="text-decoration:none;font-size:12px;padding:7px 16px">Apply ↗</a>`
        :`<button class="btn-primary" style="font-size:12px;padding:7px 16px" onclick="showToast('Contact poster via DM!')">Apply</button>`}
    </div>
  </div>`;
}
function searchJobs(q) {}

/* ════════════════════════════════════════════════════════════
   CHAT
════════════════════════════════════════════════════════════ */
async function loadChat() {
  try {
    const data = await ChatAPI.rooms();
    allRooms = data;
    renderRoomList();
    if (window.innerWidth >= 768) openRoom("global","Sangam Community","group");
  } catch {
    allRooms = {
      system_groups:[
        {id:"global",     name:"Sangam Community",   members:120,isAdmin:false},
        {id:"placements", name:"Placements 2025",     members:84, isAdmin:true},
        {id:"mentorship", name:"Mentorship Connect",  members:47, isAdmin:false},
        {id:"cse-batch",  name:"CSE Batch 2022",      members:62, isAdmin:true},
      ],
      my_groups:[], dms:[],
    };
    renderRoomList();
    if (window.innerWidth >= 768) openRoom("global","Sangam Community","group");
  }
}

function renderRoomList() {
  const el = document.getElementById("chat-rooms-list");
  if (!el) return;
  const {system_groups=[],my_groups=[],dms=[]} = allRooms;
  const all = [
    ...system_groups.map(r=>({id:r.id,name:r.name,type:"group",lastMsg:r.last_message||`${r.members||0} members`,lastTime:r.last_time||"",pinned:r.id==="global",isAdmin:r.isAdmin})),
    ...my_groups.map(r=>({id:r.id||r.room,name:r.name,type:"mygroup",lastMsg:r.last_message||"",lastTime:r.last_time||"",pinned:false,isAdmin:true})),
    ...dms.map(d=>({id:d.id,name:d.with_name,type:"dm",lastMsg:d.last_message||"",lastTime:d.last_time||"",pinned:false,isAdmin:false})),
  ].sort((a,b)=>{
    if (a.pinned&&!b.pinned) return -1;
    if (!a.pinned&&b.pinned) return 1;
    return (b.lastTime?new Date(b.lastTime):0)-(a.lastTime?new Date(a.lastTime):0);
  });
  if (!all.length) {
    el.innerHTML=`<div style="padding:32px 20px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px">No chats yet.<br><br>
      <button onclick="openDMSearch()" class="btn-primary" style="font-size:12px;padding:8px 18px">Start a DM</button></div>`;
    return;
  }
  el.innerHTML = all.map(r=>{
    const color  = getColor((r.name||"?")[0]);
    const active = activeRoom===r.id?" active":"";
    const unread = unreadCounts[r.id]||0;
    const online = r.type==="dm" && onlineUsers.has(r.id);
    return `
    <div class="room-item${active}" onclick="openRoom('${escHtml(r.id)}','${escHtml(r.name)}','${r.type}')">
      <div class="room-av" style="background:${color}">
        ${(r.name||"?")[0].toUpperCase()}
        ${online?`<div class="room-online-dot"></div>`:""}
      </div>
      <div class="room-info">
        <div class="room-name">${escHtml(r.name)}${r.pinned?` <span style="font-size:9px;opacity:.4">📌</span>`:""}
          ${unread?`<span style="width:7px;height:7px;background:var(--purple-2);border-radius:50%;display:inline-block;flex-shrink:0"></span>`:""}
        </div>
        <div class="room-last ${unread?"unread-preview":""}">${escHtml((r.lastMsg||"").slice(0,40))}</div>
      </div>
      <div class="room-meta">
        ${r.lastTime?`<div class="room-time">${formatRoomTime(r.lastTime)}</div>`:""}
        ${unread?`<div class="room-badge">${unread>99?"99+":unread}</div>`:""}
      </div>
    </div>`;
  }).join("");
}

async function openRoom(roomId, roomName, sub) {
  activeRoom = roomId; activeRoomName = roomName;
  history.pushState({chatRoom:roomId},"","");
  document.getElementById("chat-sidebar")?.classList.add("hidden-mobile");
  document.getElementById("chat-panel")?.classList.add("visible-mobile");
  document.body.classList.add("chat-panel-open");

  const color = getColor((roomName[0]||"G").toUpperCase());
  const av    = document.getElementById("cp-avatar");
  if (av) { av.textContent=(roomName[0]||"G").toUpperCase(); av.style.background=color; }
  if (document.getElementById("cp-name")) document.getElementById("cp-name").textContent = roomName;

  const subTxt = document.getElementById("cp-sub-text");
  const dot    = document.getElementById("cp-status-dot");
  if (sub==="dm") {
    const online = onlineUsers.has(roomId);
    if (subTxt) subTxt.textContent = online?"Online":"Offline";
    if (dot)    dot.className = "chat-status-dot"+(online?" online":"");
    if (document.getElementById("group-info-btn")) document.getElementById("group-info-btn").style.display="none";
  } else {
    if (subTxt) subTxt.textContent = "Community group";
    if (dot)    dot.className = "chat-status-dot";
    if (document.getElementById("group-info-btn")) document.getElementById("group-info-btn").style.display="";
  }

  document.querySelectorAll(".room-item").forEach(e=>e.classList.remove("active"));
  document.querySelector(`.room-item[onclick*="'${roomId}'"]`)?.classList.add("active");
  unreadCounts[roomId]=0; updateNavBadge();

  document.getElementById("chat-empty-state").style.display="none";
  const ac = document.getElementById("active-chat");
  ac.style.display="flex";

  await loadMessages(roomId);
  connectSocket(roomId);
  cancelReply();
  document.getElementById("chat-input")?.focus();
}

async function loadMessages(roomId) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  area.innerHTML=`<div class="msg-system">Loading…</div>`;
  let msgs;
  try { msgs = await ChatAPI.getMessages(roomId); }
  catch {
    const names=["Rahul Verma","Priya Singh","Kiran Mehta","Dr. S. Tiwari"];
    const texts=["Hey everyone! Welcome to Sangam 👋","This platform is amazing!","Anyone preparing for placements?","Department seminar this Friday — don't miss it!","Just got my Google offer! Happy to help with interview prep 🎉","DSA tip: Practice sliding window problems today 💡"];
    msgs = texts.map((t,i)=>({id:"d"+i,sender_id:i%3===0?String(currentUser.id):"other"+i,sender_name:i%3===0?currentUser.name:names[i%names.length],room:roomId,content:t,created_at:new Date(Date.now()-(texts.length-i)*600000).toISOString(),status:i%3===0?(i===texts.length-3?"seen":"delivered"):null}));
  }
  area.innerHTML = msgs.length ? renderMessages(msgs) : `<div class="msg-system">No messages yet. Say hello! 👋</div>`;
  area.scrollTop = area.scrollHeight;
}

function renderMessages(msgs) {
  const myId = String(currentUser.id||"");
  let html="", lastDate="";
  msgs.forEach(m=>{
    const d = new Date(m.created_at);
    const dateStr = d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
    if (dateStr!==lastDate) { html+=`<div class="msg-date-divider"><span>${dateStr}</span></div>`; lastDate=dateStr; }
    const isMine  = String(m.sender_id)===myId;
    const color   = getColor((m.sender_name||"A")[0]);
    const avInit  = (m.sender_name||"?")[0].toUpperCase();
    const ticks   = isMine?`<span class="msg-ticks${m.status==="seen"?" seen":m.status==="delivered"?" delivered":""}">${m.status==="seen"?"✓✓":m.status==="delivered"?"✓✓":"✓"}</span>`:"";
    const reply   = m.reply_to?`<div class="msg-reply-snippet" onclick="scrollToMsg('${m.reply_to.id}')"><strong>${escHtml(m.reply_to.sender_name)}</strong>${escHtml((m.reply_to.content||"").slice(0,60))}</div>`:"";

    html+=`<div class="msg-row ${isMine?"mine":"theirs"}" id="msg-${m.id}"
      oncontextmenu="showCtxMenu(event,'${m.id}','${escHtml(m.content||"")}','${escHtml(m.sender_name||"")}')"
      ontouchstart="touchStartCtx(event,'${m.id}','${escHtml(m.content||"")}','${escHtml(m.sender_name||"")}')"
      ontouchend="touchEndCtx()">`;
    if (!isMine) html+=`<div class="msg-av-sm" style="background:${color}">${avInit}</div>`;
    html+=`<div class="msg-bubble">${!isMine?`<span class="msg-sender-name">${escHtml(m.sender_name)}</span>`:""} ${reply}`;
    if (m.media_type==="image"&&m.media_url) {
      html+=`<div class="msg-media-wrap"><img class="msg-img" src="${escHtml(m.media_url)}" loading="lazy" onclick="openLightbox('${escHtml(m.media_url)}')"><div class="msg-img-overlay">🔍</div></div>`;
    } else {
      html+=`<div class="msg-text">${escHtml(m.content||"").replace(/\n/g,"<br>")}</div>`;
    }
    html+=`<div class="msg-footer"><span class="msg-time">${formatChatTime(m.created_at)}</span>${ticks}</div></div>`;
    if (isMine) html+=`<div class="msg-av-sm" style="background:var(--purple)">${(currentUser.name||"U")[0].toUpperCase()}</div>`;
    html+=`</div>`;
  });
  return html;
}

function appendMessage(m) {
  const area = document.getElementById("chat-messages-area");
  if (!area) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = renderMessages([m]);
  while (tmp.firstChild) area.appendChild(tmp.firstChild);
  area.scrollTop = area.scrollHeight;
}

async function sendChatMessage() {
  const inp = document.getElementById("chat-input");
  const content = (inp?.value||"").trim();
  if (!content||!activeRoom) return;
  inp.value=""; inp.style.height="auto"; inp.focus();
  closeEmojiPicker();
  const msg={id:"local-"+Date.now(),sender_id:String(currentUser.id),sender_name:currentUser.name,sender_roll:currentUser.roll_number,room:activeRoom,content,created_at:new Date().toISOString(),status:"sent",reply_to:replyingTo?{...replyingTo}:null};
  cancelReply();
  appendMessage(msg);
  if (chatSocket?.connected) chatSocket.emit("message",{token:Auth.getToken()||"",room:activeRoom,content,reply_to:replyingTo});
  else try { await ChatAPI.sendMessage(activeRoom,content); } catch {}
}

function connectSocket(room) {
  if (typeof io==="undefined") return;
  if (chatSocket) { try{chatSocket.disconnect();}catch(e){} }
  chatSocket = io("http://localhost:5000",{auth:{token:`Bearer ${Auth.getToken()||""}`}});
  chatSocket.emit("join",{token:`Bearer ${Auth.getToken()||""}`,room});
  chatSocket.on("new_message",msg=>{
    const update=arr=>arr.map(r=>((r.id||r.room)===msg.room)?{...r,last_message:msg.content,last_time:msg.created_at}:r);
    allRooms.system_groups=update(allRooms.system_groups||[]);
    allRooms.my_groups=update(allRooms.my_groups||[]);
    allRooms.dms=update(allRooms.dms||[]);
    if (msg.room!==activeRoom){unreadCounts[msg.room]=(unreadCounts[msg.room]||0)+1;updateNavBadge();renderRoomList();return;}
    if (String(msg.sender_id)===String(currentUser.id)) return;
    appendMessage(msg); renderRoomList();
  });
  chatSocket.on("typing",d=>{if(d.room===activeRoom&&d.user_id!==currentUser.id)showTypingIndicator(d.name);});
  chatSocket.on("stop_typing",d=>{if(d.room===activeRoom)hideTypingIndicator();});
  chatSocket.on("user_online", id=>{onlineUsers.add(id);updateOnlineStatus(id,true);});
  chatSocket.on("user_offline",id=>{onlineUsers.delete(id);updateOnlineStatus(id,false);});
}

let typingShown=false;
function showTypingIndicator(name){
  hideTypingIndicator(); typingShown=true;
  const area=document.getElementById("chat-messages-area");
  if(!area)return;
  area.insertAdjacentHTML("beforeend",`<div class="typing-indicator" id="typing-indicator"><div class="msg-av-sm" style="background:#334155">…</div><div><div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px">${escHtml(name)} is typing</div><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`);
  area.scrollTop=area.scrollHeight;
}
function hideTypingIndicator(){document.getElementById("typing-indicator")?.remove();typingShown=false;}
function handleTyping(){autoGrow(document.getElementById("chat-input"));if(!chatSocket?.connected||!activeRoom)return;chatSocket.emit("typing",{room:activeRoom,name:currentUser.name,user_id:currentUser.id});clearTimeout(typingTimer);typingTimer=setTimeout(stopTyping,2000);}
function stopTyping(){if(chatSocket?.connected&&activeRoom)chatSocket.emit("stop_typing",{room:activeRoom});}

function setReply(msgId,senderName,content){replyingTo={id:msgId,sender_name:senderName,content};document.getElementById("reply-preview-bar").style.display="flex";document.getElementById("reply-from").textContent=senderName;document.getElementById("reply-text").textContent=content.slice(0,80);document.getElementById("chat-input")?.focus();closeCtxMenu();}
function cancelReply(){replyingTo=null;document.getElementById("reply-preview-bar").style.display="none";}

function toggleEmojiPicker(){
  const p=document.getElementById("emoji-picker");if(!p)return;
  const show=p.style.display==="none"||!p.style.display;
  p.style.display=show?"flex":"none";
  if(show) p.querySelectorAll("span").forEach(s=>{s.onclick=()=>{const inp=document.getElementById("chat-input");if(inp){inp.value+=s.textContent;inp.focus();autoGrow(inp);}};});
}
function closeEmojiPicker(){const p=document.getElementById("emoji-picker");if(p)p.style.display="none";}

let _touchTimer=null;
function showCtxMenu(e,msgId,content,sender){
  e.preventDefault();ctxTargetMsg=msgId;ctxMsgContent=content;ctxMsgSender=sender;
  const menu=document.getElementById("msg-context-menu");if(!menu)return;
  menu.style.display="block";
  menu.style.left=Math.min(e.clientX,window.innerWidth-175)+"px";
  menu.style.top=Math.min(e.clientY,window.innerHeight-160)+"px";
}
function touchStartCtx(e,msgId,content,sender){_touchTimer=setTimeout(()=>showCtxMenu(e.touches[0],msgId,content,sender),500);}
function touchEndCtx(){clearTimeout(_touchTimer);}
function closeCtxMenu(){const m=document.getElementById("msg-context-menu");if(m)m.style.display="none";}
document.addEventListener("click",()=>closeCtxMenu());
function ctxReply(){setReply(ctxTargetMsg,ctxMsgSender,ctxMsgContent);}
function ctxCopy(){navigator.clipboard?.writeText(ctxMsgContent).then(()=>showToast("Copied!","success"));closeCtxMenu();}
function ctxReact(){addReaction(ctxTargetMsg,"❤️");closeCtxMenu();}
function ctxDelete(){const el=document.getElementById("msg-"+ctxTargetMsg);if(el){el.style.opacity="0";el.style.transform="scale(.8)";el.style.transition="all .2s";setTimeout(()=>el.remove(),200);}closeCtxMenu();showToast("Deleted","success");}

function addReaction(msgId,emoji){const row=document.getElementById("msg-"+msgId);if(!row)return;let rd=row.querySelector(".msg-reactions");if(!rd){rd=document.createElement("div");rd.className="msg-reactions";row.querySelector(".msg-bubble")?.after(rd);}const ex=[...rd.querySelectorAll(".msg-reaction-chip")].find(c=>c.textContent.startsWith(emoji));if(ex){const s=ex.querySelector("span");s.textContent=parseInt(s.textContent||"1")+1;}else rd.insertAdjacentHTML("beforeend",`<div class="msg-reaction-chip">${emoji}<span>1</span></div>`);}
function scrollToMsg(id){const el=document.getElementById("msg-"+id);if(el){el.scrollIntoView({behavior:"smooth",block:"center"});el.style.background="rgba(124,58,237,0.2)";setTimeout(()=>el.style.background="",1500);}}
function updateOnlineStatus(userId,online){if(activeRoom!==userId)return;const dot=document.getElementById("cp-status-dot");const sub=document.getElementById("cp-sub-text");if(dot)dot.className="chat-status-dot"+(online?" online":"");if(sub)sub.textContent=online?"Online":"Last seen recently";}
function updateNavBadge(){const total=Object.values(unreadCounts).reduce((a,b)=>a+b,0);let badge=document.querySelector(".bnav-item[data-tab='chat'] .chat-nav-badge");if(!badge&&total>0){const item=document.querySelector(".bnav-item[data-tab='chat']");if(item){item.style.position="relative";item.insertAdjacentHTML("beforeend",`<div class="chat-nav-badge">${total>99?"99+":total}</div>`);}}else if(badge){if(total===0)badge.remove();else badge.textContent=total>99?"99+":total;}}

function backToRoomList(){document.getElementById("chat-sidebar")?.classList.remove("hidden-mobile");document.getElementById("chat-panel")?.classList.remove("visible-mobile");document.body.classList.remove("chat-panel-open");activeRoom=null;activeRoomName="";if(chatSocket){try{chatSocket.disconnect();}catch(e){}chatSocket=null;}}
function filterChatRooms(q){document.querySelectorAll(".room-item").forEach(el=>{const name=el.querySelector(".room-name")?.textContent||"";el.style.display=name.toLowerCase().includes(q.toLowerCase())?"":"none";});}

function openGroupInfo(){
  const overlay=document.getElementById("group-drawer-overlay"),drawer=document.getElementById("group-drawer");
  if(!overlay||!drawer)return;
  document.getElementById("gd-name").textContent=activeRoomName;
  const av=document.getElementById("gd-avatar");if(av){av.textContent=(activeRoomName[0]||"G").toUpperCase();av.style.background=getColor((activeRoomName[0]||"G"));}
  const members=groupMembers[activeRoom]||[{name:"Rahul Verma",roll:"CSE20011",isAdmin:true},{name:"Priya Singh",roll:"EEE22045",isAdmin:false},{name:currentUser.name,roll:currentUser.roll_number,isAdmin:false}];
  document.getElementById("gd-count").textContent=`${members.length} members`;
  document.getElementById("gd-members-list").innerHTML=members.map(m=>`<div class="gd-member"><div class="gd-member-av" style="background:${getColor((m.name||"A")[0])}">${(m.name||"?")[0]}</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:#fff">${escHtml(m.name)}${m.isAdmin?` <span class="gd-admin-badge">Admin</span>`:""}</div><div style="font-size:11px;color:rgba(255,255,255,0.4)">${m.roll||""}</div></div></div>`).join("");
  overlay.classList.add("open");drawer.classList.add("open");
}
function closeGroupInfo(){document.getElementById("group-drawer-overlay")?.classList.remove("open");document.getElementById("group-drawer")?.classList.remove("open");}

function toggleChatTheme(){chatLightMode=!chatLightMode;document.body.classList.toggle("chat-light-mode",chatLightMode);const btn=document.getElementById("theme-toggle-btn");if(btn)btn.innerHTML=chatLightMode?`<i class="ti ti-sun"></i>`:`<i class="ti ti-moon"></i>`;showToast(chatLightMode?"Light mode":"Dark mode","success");}
function searchInChat(){showToast("Search in chat — coming soon!","info");}

function openDMSearch(){
  openModal(`
    <div style="color:#fff">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#fff;margin-bottom:14px">New Direct Message</div>
      <input id="dm-search-input" class="ef-input" placeholder="Search by name or roll number…" oninput="searchDMUsers(this.value)">
      <div id="dm-search-results" style="margin-top:12px"></div>
    </div>`);
}
async function searchDMUsers(q){
  if(!q||q.length<2){document.getElementById("dm-search-results").innerHTML="";return;}
  const res=document.getElementById("dm-search-results");
  try{
    const users=await ChatAPI.searchUsers(q);
    res.innerHTML=users.map(u=>`<div onclick="startDMWith('${u.roll_number}')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--r-sm);cursor:pointer;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,0.07)'" onmouseout="this.style.background=''"><div style="width:36px;height:36px;border-radius:50%;background:${getColor(u.name[0])};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${u.name[0]}</div><div><div style="font-size:14px;font-weight:600;color:#fff">${escHtml(u.name)}</div><div style="font-size:12px;color:rgba(255,255,255,0.4)">${u.roll_number}·${u.branch||""}</div></div></div>`).join("")||`<div style="color:rgba(255,255,255,0.3);font-size:13px">No users found</div>`;
  }catch{res.innerHTML=`<div style="color:rgba(255,255,255,0.3);font-size:13px">Search offline</div>`;}
}
async function startDMWith(roll){closeModal();try{const res=await ChatAPI.startDM(roll);showTab("chat");setTimeout(()=>openRoom(res.room,res.with_user?.name||"DM","dm"),300);}catch{showToast("Could not start DM","error");}}

function openNewGroupModal(){
  openModal(`
    <div style="color:#fff">
      <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#fff;margin-bottom:14px">Create Group</div>
      <input id="ng-name" class="ef-input" placeholder="Group name…" style="margin-bottom:10px">
      <input id="ng-rolls" class="ef-input" placeholder="Roll numbers (comma-separated)…" style="margin-bottom:14px">
      <button class="ef-save-btn" onclick="createGroup()"><i class="ti ti-check"></i> Create Group</button>
    </div>`);
}
async function createGroup(){
  const name=(document.getElementById("ng-name")?.value||"").trim();
  const rolls=(document.getElementById("ng-rolls")?.value||"").split(",").map(r=>r.trim()).filter(Boolean);
  if(!name){showToast("Enter group name","error");return;}
  try{const res=await ChatAPI.createGroup(name,rolls);closeModal();showToast(`"${name}" created!`,"success");await loadChat();openRoom(res.room||`group_${res.id}`,name,"mygroup");}
  catch{showToast("Could not create group","error");}
}

async function handleFileAttach(input){
  if(!input.files[0]||!activeRoom)return;
  const file=input.files[0];showToast("Uploading…","info");
  try{const res=await ChatAPI.uploadFile(file,activeRoom);appendMessage({id:"local-"+Date.now(),sender_id:String(currentUser.id),sender_name:currentUser.name,room:activeRoom,content:file.name,media_type:res.media_type,media_url:res.media_url||res.url,created_at:new Date().toISOString(),status:"sent"});showToast("Sent!","success");}
  catch{showToast("Upload failed","error");}
  input.value="";
}

function openLightbox(src){let lb=document.getElementById("chat-lightbox");if(!lb){lb=document.createElement("div");lb.id="chat-lightbox";lb.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out";lb.onclick=()=>lb.remove();document.body.appendChild(lb);}lb.innerHTML=`<img src="${escHtml(src)}" style="max-width:95vw;max-height:88vh;border-radius:12px;object-fit:contain">`;}
function autoGrow(el){if(!el)return;el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px";const area=document.getElementById("chat-messages-area");if(area&&activeRoom)area.scrollTop=area.scrollHeight;}
function openChatOptions(e){showCtxMenu(e,null,"","");const menu=document.getElementById("msg-context-menu");if(!menu)return;menu.innerHTML=`<div class="ctx-item" onclick="searchInChat();closeCtxMenu()"><i class="ti ti-search"></i> Search</div><div class="ctx-item" onclick="openGroupInfo();closeCtxMenu()"><i class="ti ti-info-circle"></i> Group Info</div><div class="ctx-item" onclick="toggleChatTheme();closeCtxMenu()"><i class="ti ti-moon"></i> Toggle Theme</div><div class="ctx-item danger" onclick="showToast('Left group');closeCtxMenu()"><i class="ti ti-logout"></i> Leave Group</div>`;}

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