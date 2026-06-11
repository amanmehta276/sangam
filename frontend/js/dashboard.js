/* ============================================================
   dashboard.js — Complete Sangam Dashboard
   FIXES:
   ✅ Profile edit works like LinkedIn (inline sections)
   ✅ Avatar upload → stored in backend → shown everywhere
   ✅ Wallpaper upload → stored in backend → shown on reload
   ✅ Skills, links, bio all save + display correctly
   ✅ All API calls use correct endpoints
   ============================================================ */

/* ── State ─────────────────────────────────────────────── */
let currentUser    = null;
let currentTab     = "home";
let activeRoom     = null;
let activeRoomName = "";
let chatSocket     = null;
let allRooms       = { system_groups: [], my_groups: [], dms: [] };
let allPosts       = [];
let replyingTo     = null;
let unreadCounts   = {};
let onlineUsers    = new Set();
let typingTimer    = null;
let ctxTargetMsg   = null;
let ctxMsgContent  = "";
let ctxMsgSender   = "";

/* ── Avatar colors ─────────────────────────────────────── */
const AV_COLORS = ["#7C3AED","#E8610A","#16A34A","#0288D1","#E91E63","#FF5722","#00796B","#5C6BC0"];
const getColor  = s => AV_COLORS[(s||"A").charCodeAt(0) % AV_COLORS.length];

/* ── Helpers ────────────────────────────────────────────── */
function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmtTime(iso) {
  if (!iso) return "";
  const d=new Date(iso),now=new Date(),diff=(now-d)/1000;
  if(diff<60)return"just now";
  if(diff<3600)return`${Math.floor(diff/60)}m ago`;
  if(diff<86400)return`${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}
function fmtChatTime(iso) {
  if(!iso)return"";
  return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:true});
}
function fmtChatTime2(iso) {
  if(!iso)return"";
  const d=new Date(iso),now=new Date();
  if(d.toDateString()===now.toDateString())return fmtChatTime(iso);
  const diff=(now-d)/86400000;
  if(diff<7)return d.toLocaleDateString("en-IN",{weekday:"short"});
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"short"});
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  if (!Auth.isLoggedIn()) { window.location.href="auth.html"; return; }

  // Load user from backend (fresh data)
  try {
    currentUser = await UsersAPI.me();
    Auth.setUser(currentUser);
  } catch {
    currentUser = Auth.getUser() || {
      name:"Arjun Sharma", roll_number:"CSE22101",
      branch:"CSE", batch_year:2022, type:"student",
      trust_level:"partial", skills:[],
    };
  }

  renderHeaderAvatar();
  await showTab("feed");
  loadNotifBadge();
});

/* ── Render header avatar everywhere ─────────────────────── */
function renderHeaderAvatar() {
  const av    = document.getElementById("header-avatar");
  const cav   = document.getElementById("compose-av");
  const init  = (currentUser.name||"A")[0].toUpperCase();
  const color = getColor(init);

  if (av) {
    if (currentUser.avatar_url) {
      av.innerHTML = `<img src="${escHtml(currentUser.avatar_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">`;
      av.style.background = "none";
    } else {
      av.textContent = init;
      av.style.background = color;
    }
  }
  if (cav) {
    if (currentUser.avatar_url) {
      cav.innerHTML = `<img src="${escHtml(currentUser.avatar_url)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">`;
      cav.style.background = "none";
    } else {
      cav.textContent = init;
      cav.style.background = color;
    }
  }
  if (["alumni","teacher","admin"].includes(currentUser.type)) {
    document.getElementById("post-job-btn-wrap")?.classList.remove("hidden");
  }
}

/* ════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════ */
function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(n=>n.classList.remove("active"));
  document.body.classList.remove("chat-panel-open");

  document.getElementById(`tab-${tab}`)?.classList.add("active");
  document.querySelector(`.bnav-item[data-tab="${tab}"]`)?.classList.add("active");

  const fab = document.getElementById("fab-btn");
  if (fab) fab.style.display = tab==="feed" ? "flex" : "none";

  switch(tab){
    case "home":    break;
    case "feed":    loadFeed();    break;
    case "alumni":  loadAlumni();  break;
    case "jobs":    loadJobs();    break;
    case "chat":    loadChat();    break;
    case "profile": loadProfile(); break;
    case "notifs":  loadNotifs();  break;
  }
}

function toggleSearch(){
  const sb=document.getElementById("search-bar");
  sb?.classList.toggle("hidden");
  if(!sb?.classList.contains("hidden"))sb.querySelector("input")?.focus();
}

/* ════════════════════════════════════════
   FEED
════════════════════════════════════════ */
const DEMO_POSTS=[
  {id:"1",author:{name:"Rahul Verma",roll_number:"CSE20011",branch:"CSE",batch_year:2020,role:"alumni",trust_level:"verified"},post_type:"job",content:"Google is hiring — SWE Intern (Summer 2025)\nDM me for a referral. Deadline April 30th.",tags:["SWE Intern","Remote OK","₹80k/mo"],likes:24,created_at:new Date(Date.now()-7200000).toISOString()},
  {id:"2",author:{name:"Priya Singh",roll_number:"EEE22045",branch:"EEE",batch_year:2022,role:"student",trust_level:"new"},post_type:"question",content:"Anyone who cracked GATE 2024? Looking for a study plan for EEE.",tags:[],likes:11,created_at:new Date(Date.now()-18000000).toISOString()},
  {id:"3",author:{name:"Kiran Mehta",roll_number:"CSE19032",branch:"CSE",batch_year:2019,role:"alumni",trust_level:"verified"},post_type:"win",content:"Product just crossed 1M users! Hosting a free PM session next Saturday.",tags:[],likes:67,created_at:new Date(Date.now()-86400000).toISOString()},
];

async function loadFeed(filter=null){
  const el=document.getElementById("feed-list");
  if(!el)return;
  try{allPosts=await PostsAPI.list(filter);}catch{allPosts=DEMO_POSTS;}
  const posts=filter?allPosts.filter(p=>p.post_type===filter):allPosts;
  el.innerHTML=posts.length?posts.map(renderPost).join(""):`<div class="feed-loading">No posts yet.</div>`;
}

function renderPost(p){
  const a=p.author||{};
  const color=getColor((a.name||"A")[0]);
  const init=(a.name||"?")[0].toUpperCase();
  const badge={verified:"vb-g",partial:"vb-b",new:"vb-y"}[a.trust_level]||"";
  const trust={verified:"Verified",partial:"Partial",new:"New"}[a.trust_level]||"";
  const type={job:"Job",question:"Question",win:"Win",event:"Event",tip:"Tip",update:"Update"}[p.post_type]||"Update";
  const tags=(p.tags||[]).map(t=>`<span class="ptag ptag-pu">${escHtml(t)}</span>`).join("");
  const av=a.avatar_url
    ?`<div class="post-av" style="overflow:hidden"><img src="${escHtml(a.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
    :`<div class="post-av" style="background:${color}">${init}</div>`;
  return `
  <div class="post-card">
    <div class="post-head">
      ${av}
      <div class="post-meta">
        <div class="post-name">${escHtml(a.name||"?")} <span class="vbadge ${badge}">${trust}</span></div>
        <div class="post-sub">${escHtml(a.branch||"")} · Batch ${a.batch_year||""} · ${fmtTime(p.created_at)}</div>
      </div>
      <div class="post-type-chip">${type}</div>
    </div>
    <div class="post-body">${escHtml(p.content||"").replace(/\n/g,"<br>")}</div>
    ${tags?`<div class="post-body" style="padding-top:0"><div class="tag-row">${tags}</div></div>`:""}
    <div class="post-divider"></div>
    <div class="post-actions">
      <div class="pact ${(p.liked_by||[]).includes(currentUser?.roll_number)?"liked":""}" id="like-${p.id||p._id}" onclick="likePost('${p.id||p._id}',this)">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="like-count">${p.likes||0}</span>
      </div>
      <div class="pact" onclick="showToast('Comments coming soon!')">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Comment
      </div>
      <div class="pact" onclick="showToast('Shared!')">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Share
      </div>
    </div>
  </div>`;
}

async function likePost(id,el){
  const c=el.querySelector(".like-count");
  try{const r=await PostsAPI.like(id);if(c)c.textContent=r.likes;el.classList.toggle("liked",r.liked);}
  catch{const n=parseInt(c?.textContent||"0")+1;if(c)c.textContent=n;el.classList.add("liked");}
}

function filterFeed(type,el){
  document.querySelectorAll(".chips-row .chip").forEach(c=>c.classList.remove("on"));
  el?.classList.add("on");
  loadFeed(type);
}

/* ════════════════════════════════════════
   ALUMNI
════════════════════════════════════════ */
const DEMO_ALUMNI=[
  {_id:"1",name:"Rahul Verma",type:"alumni",branch:"CSE",batch_year:2020,trust_level:"verified",company:"Google",skills:["DSA","Go"],roll_number:"CSE20011"},
  {_id:"2",name:"Kiran Mehta",type:"alumni",branch:"ME",batch_year:2019,trust_level:"verified",company:"Flipkart PM",skills:["PM","SQL"],roll_number:"ME19032"},
  {_id:"3",name:"Sneha Patel",type:"alumni",branch:"CSE",batch_year:2017,trust_level:"verified",company:"Microsoft",skills:["Azure","Python"],roll_number:"CSE17005"},
];

async function loadAlumni(params={}){
  const el=document.getElementById("alumni-list");
  if(!el)return;
  let users;
  try{users=await UsersAPI.list({...params});}catch{users=DEMO_ALUMNI;}
  el.innerHTML=users.length?users.map(renderAlumni).join(""):`<div class="feed-loading">No alumni found.</div>`;
}

function renderAlumni(u){
  const color=getColor((u.name||"A")[0]);
  const init=(u.name||"?")[0].toUpperCase();
  const roleLabel={alumni:"Alumni",teacher:"Teacher",admin:"Admin",student:"Student"}[u.type||u.role]||u.type||"";
  const skills=(u.skills||[]).slice(0,3).map(s=>`<span class="atag">${escHtml(s)}</span>`).join("");
  const av=u.avatar_url
    ?`<div class="al-av" style="overflow:hidden;cursor:pointer" onclick="startDMWith('${u.roll_number}')"><img src="${escHtml(u.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
    :`<div class="al-av" style="background:${color};cursor:pointer" onclick="startDMWith('${u.roll_number}')">${init}</div>`;
  return `
  <div class="alumni-card">
    ${av}
    <div class="al-info">
      <div class="al-name"><span style="cursor:pointer" onclick="startDMWith('${u.roll_number}')">${escHtml(u.name)}</span> <span class="vbadge vb-g">${roleLabel}</span></div>
      <div class="al-role">${escHtml(u.branch||"")} · Batch ${u.batch_year||""}</div>
      ${u.company?`<div class="al-company">${escHtml(u.company)}</div>`:""}
      <div class="al-tags">${skills}</div>
    </div>
    <button class="conn-btn" onclick="startDMWith('${u.roll_number}')">DM</button>
  </div>`;
}

async function searchAlumni(q){if(!q){loadAlumni();return;}loadAlumni({q});}
function filterAlumniBy(k,v){loadAlumni({[k]:v});}

/* ════════════════════════════════════════
   JOBS
════════════════════════════════════════ */
const DEMO_JOBS=[
  {id:"1",title:"SWE Intern",company:"Google",location:"Bangalore",job_type:"internship",salary:"₹80k/mo",referral:true,skills:["DSA","Go"],posted_by:{name:"Rahul Verma"},created_at:new Date(Date.now()-86400000).toISOString()},
  {id:"2",title:"PM Intern",company:"Flipkart",location:"Remote",job_type:"internship",salary:"₹70k/mo",referral:true,skills:["PM","Analytics"],posted_by:{name:"Kiran Mehta"},created_at:new Date(Date.now()-172800000).toISOString()},
];

async function loadJobs(params={}){
  const el=document.getElementById("jobs-list");
  if(!el)return;
  let jobs;
  try{jobs=await JobsAPI.list(params);}catch{jobs=DEMO_JOBS;}
  el.innerHTML=jobs.length?jobs.map(renderJob).join(""):`<div class="feed-loading">No jobs found.</div>`;
}

function renderJob(j){
  const skills=(j.skills||[]).map(s=>`<span class="atag">${escHtml(s)}</span>`).join("");
  return `
  <div class="job-card">
    <div class="jc-top">
      <div class="jc-logo">🏢</div>
      <div style="flex:1;min-width:0">
        <div class="jc-title">${escHtml(j.title)}</div>
        <div class="jc-company">${escHtml(j.company)} · ${escHtml(j.location||"")}</div>
        <div class="jc-by">Posted by ${escHtml(j.posted_by?.name||"Alumni")}</div>
      </div>
      ${j.salary?`<div style="font-size:13px;font-weight:700;color:var(--green);flex-shrink:0">${escHtml(j.salary)}</div>`:""}
    </div>
    <div class="jc-tags">${skills}</div>
    <div class="jc-foot">
      ${j.referral?`<div class="ref-badge">Has Referral</div>`:`<div></div>`}
      <button class="apply-btn" onclick="showToast('Contact via DM!')">Apply</button>
    </div>
  </div>`;
}

function searchJobs(q){}
function chipSel(el){el.closest(".chips-row").querySelectorAll(".chip").forEach(c=>c.classList.remove("on"));el.classList.add("on");}

/* ════════════════════════════════════════
   PROFILE — LinkedIn-style inline edit
════════════════════════════════════════ */
async function loadProfile() {
  let u = currentUser;
  try { u = await UsersAPI.me(); currentUser = u; Auth.setUser(u); } catch {}

  renderHeaderAvatar();

  // ── Cover / wallpaper ────────────────────────────────────
  const wallpaper = document.getElementById("profile-wallpaper");
  if (wallpaper && u.wallpaper_url) {
    wallpaper.style.backgroundImage = `url('${u.wallpaper_url}')`;
    wallpaper.style.backgroundSize  = "cover";
    wallpaper.style.backgroundPosition = "center";
  }

  // ── Avatar ───────────────────────────────────────────────
  const avInitial = document.getElementById("profile-av-initial");
  const avImg     = document.getElementById("profile-av-img");
  if (u.avatar_url && avImg) {
    avImg.src              = u.avatar_url;
    avImg.style.display    = "block";
    if (avInitial) avInitial.style.display = "none";
  } else if (avInitial) {
    avInitial.textContent  = (u.name||"A")[0].toUpperCase();
    avInitial.style.display = "flex";
    if (avImg) avImg.style.display = "none";
  }

  // ── Name, headline, location ─────────────────────────────
  setText("profile-name-display",  u.name||"—");
  setText("profile-meta-display",  u.headline || `${u.branch||""} · Batch ${u.batch_year||""} · ${u.type||""}`);
  setText("profile-bio-display",   u.bio || "Add a bio to tell your story…");
  setText("profile-trust-display", trustLabel(u.trust_level));
  setText("quick-roll",   u.roll_number||"—");
  setText("quick-branch", u.branch||"—");
  setText("quick-batch",  u.batch_year||"—");

  // ── Skills display ───────────────────────────────────────
  const skillsDisplay = document.getElementById("skills-display");
  if (skillsDisplay) {
    const skills = Array.isArray(u.skills) ? u.skills : (u.skills||"").split(",").filter(Boolean);
    if (skills.length) {
      skillsDisplay.innerHTML = skills.map(s =>
        `<span class="skill-chip">${escHtml(s.trim())}</span>`
      ).join("");
    } else {
      skillsDisplay.innerHTML = `<div class="exp-empty">Add skills to help recruiters find you</div>`;
    }
  }

  // ── Company / experience display ─────────────────────────
  const companyEl = document.getElementById("company-role-display");
  if (companyEl) {
    if (u.company || u.role_title) {
      companyEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:var(--r-sm);background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🏢</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(u.role_title||u.alumni_position||"—")}</div>
            <div style="font-size:12px;color:var(--text-3)">${escHtml(u.company||u.alumni_company||"—")}</div>
          </div>
        </div>`;
    } else {
      companyEl.innerHTML = `<div class="exp-empty">Add your experience to stand out</div>`;
    }
  }

  // ── Links display ────────────────────────────────────────
  const linksDisplay = document.getElementById("links-display");
  if (linksDisplay) {
    linksDisplay.innerHTML = `
      ${linkRow("ti-brand-linkedin","LinkedIn",   u.linkedin_url)}
      ${linkRow("ti-brand-github",  "GitHub",     u.github_url)}
      ${linkRow("ti-mail",          "Email",      u.email)}
      ${linkRow("ti-phone",         "Phone",      u.phone)}
      ${linkRow("ti-map-pin",       "Location",   u.location)}
    `;
  }

  // ── Pre-fill edit form ────────────────────────────────────
  setInput("pe-bio",         u.bio||"");
  setInput("pe-headline",    u.headline||"");
  setInput("pe-company",     u.company||u.alumni_company||"");
  setInput("pe-role-title",  u.role_title||u.alumni_position||"");
  setInput("pe-linkedin",    u.linkedin_url||"");
  setInput("pe-github",      u.github_url||"");
  setInput("pe-email",       u.email||"");
  setInput("pe-phone",       u.phone||"");
  setInput("pe-location",    u.location||"");
  const skills = Array.isArray(u.skills) ? u.skills.join(", ") : (u.skills||"");
  setInput("pe-skills",      skills);

  updateIDCard();
  if (u.type==="alumni") switchCardType("alumni");
}

function setText(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function setInput(id, val){ const el=document.getElementById(id); if(el) el.value=val; }

function trustLabel(level) {
  const m = {verified:"🟢 Verified",partial:"🔵 Partially Verified",new:"🟡 New User"};
  return m[level] || "🟡 New User";
}

function linkRow(icon, label, val) {
  return `
  <div class="plink-row">
    <div class="plink-icon"><i class="ti ${icon}"></i></div>
    <div class="plink-info">
      <div class="plink-label">${label}</div>
      <div class="plink-val">
        ${val ? `<a href="${val.startsWith("http")?val:"mailto:"+val}" target="_blank" rel="noopener" style="color:var(--purple);word-break:break-all">${escHtml(val)}</a>` : "Not added"}
      </div>
    </div>
  </div>`;
}

/* ── Toggle edit section ─────────────────────────────────── */
function toggleEditForm() {
  const form = document.getElementById("edit-form-section");
  const btn  = document.getElementById("edit-btn");
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display = isOpen ? "none" : "block";
  if (btn) btn.innerHTML = isOpen
    ? `<i class="ti ti-pencil" style="font-size:13px"></i> Edit profile`
    : `<i class="ti ti-x" style="font-size:13px"></i> Cancel`;
  if (!isOpen) {
    form.scrollIntoView({behavior:"smooth", block:"start"});
    // Render skill chips from input
    const skills = (document.getElementById("pe-skills")?.value||"").split(",").map(s=>s.trim()).filter(Boolean);
    renderSkillChips(skills);
  }
}

/* ── Save profile ────────────────────────────────────────── */
async function saveProfile() {
  const skills = (document.getElementById("pe-skills")?.value||"").split(",").map(s=>s.trim()).filter(Boolean);

  const payload = {
    bio:           document.getElementById("pe-bio")?.value||"",
    headline:      document.getElementById("pe-headline")?.value||"",
    company:       document.getElementById("pe-company")?.value||"",
    role_title:    document.getElementById("pe-role-title")?.value||"",
    linkedin_url:  document.getElementById("pe-linkedin")?.value||"",
    github_url:    document.getElementById("pe-github")?.value||"",
    email:         document.getElementById("pe-email")?.value||"",
    phone:         document.getElementById("pe-phone")?.value||"",
    location:      document.getElementById("pe-location")?.value||"",
    alumni_company:document.getElementById("pe-company")?.value||"",
    alumni_position:document.getElementById("pe-role-title")?.value||"",
    skills,
  };

  try {
    const updated = await UsersAPI.update(payload);
    currentUser   = { ...currentUser, ...updated.user||updated };
    Auth.setUser(currentUser);
    showToast("Profile saved! ✅", "success");
    toggleEditForm();
    loadProfile();
  } catch (err) {
    showToast(err.message || "Save nahi hua. Try again.", "error");
  }
}

/* ── Avatar upload → backend → display ──────────────────── */
async function uploadAvatar(input) {
  if (!input.files[0]) return;
  showToast("Uploading photo…", "info");
  try {
    const res = await UsersAPI.uploadAvatar(input.files[0]);
    currentUser = { ...currentUser, avatar_url: res.avatar_url };
    Auth.setUser(currentUser);
    showToast("Profile photo updated! ✅", "success");
    loadProfile();
    renderHeaderAvatar();
  } catch (err) {
    showToast(err.message || "Upload failed", "error");
  }
}

/* ── Wallpaper upload → backend → display ───────────────── */
async function uploadWallpaper(input) {
  if (!input.files[0]) return;
  showToast("Uploading cover photo…", "info");
  try {
    const res = await UsersAPI.uploadWallpaper(input.files[0]);
    currentUser = { ...currentUser, wallpaper_url: res.wallpaper_url };
    Auth.setUser(currentUser);
    const wallpaper = document.getElementById("profile-wallpaper");
    if (wallpaper && res.wallpaper_url) {
      wallpaper.style.backgroundImage = `url('${res.wallpaper_url}')`;
      wallpaper.style.backgroundSize  = "cover";
      wallpaper.style.backgroundPosition = "center";
    }
    showToast("Cover photo updated! ✅", "success");
  } catch (err) {
    showToast(err.message || "Upload failed", "error");
  }
}

/* ── Skills rendering ────────────────────────────────────── */
function renderSkillChips(skills) {
  const el = document.getElementById("pe-skills-preview");
  if (!el) return;
  el.innerHTML = skills.filter(Boolean).map(s =>
    `<span class="skill-chip" onclick="removeSkill('${escHtml(s)}')">${escHtml(s)} ×</span>`
  ).join("");
}

function removeSkill(skill) {
  const inp    = document.getElementById("pe-skills");
  const skills = inp.value.split(",").map(s=>s.trim()).filter(s=>s&&s!==skill);
  inp.value    = skills.join(", ");
  renderSkillChips(skills);
}

document.addEventListener("input", e => {
  if (e.target?.id === "pe-skills") {
    renderSkillChips(e.target.value.split(",").map(s=>s.trim()).filter(Boolean));
  }
});

/* ════════════════════════════════════════
   CHAT (full featured — unchanged logic)
════════════════════════════════════════ */
async function loadChat() {
  try {
    const data = await ChatAPI.rooms();
    allRooms = data;
    renderRoomList();
    if (window.innerWidth >= 768) openRoom("global","Sangam Community","group");
  } catch {
    allRooms = {
      system_groups: [
        {id:"global",name:"Sangam Community",icon:"🌍",members:120},
        {id:"placements",name:"Placements 2025",icon:"💼",members:84},
        {id:"mentorship",name:"Mentorship Connect",icon:"🤝",members:47},
        {id:"cse-batch",name:"CSE Batch 2022",icon:"💻",members:62},
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
    ...system_groups.map(r=>({id:r.id,name:r.name,initial:r.name[0],type:"group",lastMsg:r.last_message||"",lastTime:r.last_time||"",members:r.members||0,pinned:r.id==="global",isAdmin:r.isAdmin||false})),
    ...my_groups.map(r=>({id:r.id||r.room,name:r.name,initial:r.name[0],type:"mygroup",lastMsg:r.last_message||"",lastTime:r.last_time||"",members:0,pinned:false,isAdmin:true})),
    ...dms.map(d=>({id:d.id,name:d.with_name,initial:d.with_name[0],type:"dm",lastMsg:d.last_message||"",lastTime:d.last_time||"",members:0,pinned:false,isAdmin:false})),
  ];
  all.sort((a,b)=>{
    if(a.pinned&&!b.pinned)return-1;
    if(!a.pinned&&b.pinned)return 1;
    return(new Date(b.lastTime)||0)-(new Date(a.lastTime)||0);
  });
  if(!all.length){
    el.innerHTML=`<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px">No chats yet.<br><br><button onclick="openDMSearch()" style="background:var(--purple);color:#fff;border:none;border-radius:999px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">Start a DM</button></div>`;
    return;
  }
  el.innerHTML=all.map(r=>{
    const color=getColor(r.initial||"A");
    const active=activeRoom===r.id?" active":"";
    const unread=unreadCounts[r.id]||0;
    const preview=r.lastMsg||(r.members?`${r.members} members`:"");
    return `
    <div class="room-item${active}" onclick="openRoom('${escHtml(r.id)}','${escHtml(r.name)}','${r.type}')">
      <div class="room-av" style="background:${color}">${(r.initial||"?").toUpperCase()}${r.type==="dm"&&onlineUsers.has(r.id)?`<div class="room-online-dot"></div>`:""}</div>
      <div class="room-info">
        <div class="room-name">${escHtml(r.name)}${r.pinned?` <span style="font-size:10px;opacity:.4">📌</span>`:""}</div>
        <div class="room-last ${unread?"unread-preview":""}">${preview?escHtml(preview).slice(0,45):""}</div>
      </div>
      <div class="room-meta">
        ${r.lastTime?`<div class="room-time">${fmtChatTime2(r.lastTime)}</div>`:""}
        ${unread?`<div class="room-badge">${unread>99?"99+":unread}</div>`:""}
      </div>
    </div>`;
  }).join("");
}

async function openRoom(roomId,roomName,sub) {
  activeRoom=roomId; activeRoomName=roomName;
  history.pushState({chatRoom:roomId},"","");
  document.getElementById("chat-sidebar")?.classList.add("hidden-mobile");
  document.getElementById("chat-panel")?.classList.add("visible-mobile");
  document.body.classList.add("chat-panel-open");
  const color=getColor((roomName[0]||"G").toUpperCase());
  const av=document.getElementById("cp-avatar");
  if(av){av.textContent=(roomName[0]||"G").toUpperCase();av.style.background=color;}
  document.getElementById("cp-name").textContent=roomName;
  const subText=document.getElementById("cp-sub-text");
  const statusDot=document.getElementById("cp-status-dot");
  if(sub==="dm"){
    if(subText)subText.textContent=onlineUsers.has(roomId)?"Online":"Offline";
    if(statusDot)statusDot.className="chat-status-dot"+(onlineUsers.has(roomId)?" online":"");
    document.getElementById("group-info-btn").style.display="none";
  }else{
    if(subText)subText.textContent="Community group";
    if(statusDot)statusDot.className="chat-status-dot";
    document.getElementById("group-info-btn").style.display="";
  }
  document.querySelectorAll(".room-item").forEach(el=>el.classList.remove("active"));
  event?.currentTarget?.classList.add("active");
  unreadCounts[roomId]=0;
  updateNavBadge();
  document.getElementById("chat-empty-state").style.display="none";
  const ac=document.getElementById("active-chat");
  ac.style.display="flex";
  await loadMessages(roomId);
  connectSocket(roomId);
  cancelReply();
  document.getElementById("chat-input")?.focus();
}

async function loadMessages(roomId) {
  const area=document.getElementById("chat-messages-area");
  if(!area)return;
  area.innerHTML=`<div class="msg-system">Loading…</div>`;
  let msgs;
  try{msgs=await ChatAPI.getMessages(roomId);}
  catch{
    const names=["Rahul Verma","Priya Singh","Kiran Mehta"];
    const texts=["Hey everyone! Welcome to Sangam 👋","This platform is amazing!","Anyone preparing for placements? Let's form a study group!","Just got my Google offer! Happy to help 🎉"];
    msgs=texts.map((t,i)=>({id:"d"+i,sender_id:i%3===0?String(currentUser._id||"me"):"other"+i,sender_name:i%3===0?currentUser.name:names[i%names.length],sender_roll:"CSE22"+i,room:roomId,content:t,created_at:new Date(Date.now()-(texts.length-i)*600000).toISOString(),status:i%3===0?"delivered":null}));
  }
  area.innerHTML=msgs.length?renderMessages(msgs):`<div class="msg-system">No messages yet. Say hello! 👋</div>`;
  area.scrollTop=area.scrollHeight;
}

function renderMessages(msgs) {
  const myId=String(currentUser._id||currentUser.id||"");
  let html="",lastDate="";
  msgs.forEach(m=>{
    const d=new Date(m.created_at);
    const ds=d.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
    if(ds!==lastDate){html+=`<div class="msg-date-divider"><span>${ds}</span></div>`;lastDate=ds;}
    const isMine=String(m.sender_id)===myId;
    const color=getColor((m.sender_name||"A")[0]);
    const init=(m.sender_name||"?")[0].toUpperCase();
    let ticks="";
    if(isMine)ticks=`<span class="msg-ticks ${m.status==="seen"?"seen":m.status==="delivered"?"delivered":""}">${m.status==="seen"?"✓✓":m.status==="delivered"?"✓✓":"✓"}</span>`;
    let replyHtml="";
    if(m.reply_to)replyHtml=`<div class="msg-reply-snippet"><strong>${escHtml(m.reply_to.sender_name)}</strong>${escHtml(m.reply_to.content||"").slice(0,60)}</div>`;
    html+=`<div class="msg-row ${isMine?"mine":"theirs"}" id="msg-${m.id||m._id}"
      oncontextmenu="showContextMenu(event,'${m.id||m._id}','${escHtml(m.content||"")}','${escHtml(m.sender_name||"")}')"
      ontouchstart="touchStartCtx(event,'${m.id||m._id}','${escHtml(m.content||"")}','${escHtml(m.sender_name||"")}')"
      ontouchend="touchEndCtx()">`;
    if(!isMine)html+=`<div class="msg-av-sm" style="background:${color}" title="${escHtml(m.sender_name||"")}">${init}</div>`;
    html+=`<div class="msg-bubble">`;
    if(!isMine)html+=`<span class="msg-sender-name">${escHtml(m.sender_name)}</span>`;
    html+=replyHtml;
    if(m.media_type==="image"&&m.media_url){
      html+=`<img class="msg-img" src="${escHtml(m.media_url)}" onclick="openLightbox('${escHtml(m.media_url)}')" loading="lazy">`;
    }else{
      html+=`<div class="msg-text">${escHtml(m.content||"").replace(/\n/g,"<br>")}</div>`;
    }
    html+=`<div class="msg-footer"><span class="msg-time">${fmtChatTime(m.created_at)}</span>${ticks}</div>`;
    html+=`</div>`;
    if(isMine)html+=`<div class="msg-av-sm" style="background:var(--purple)">${(currentUser.name||"U")[0].toUpperCase()}</div>`;
    html+=`</div>`;
  });
  return html;
}

function appendMessage(m){
  const area=document.getElementById("chat-messages-area");
  if(!area)return;
  const tmp=document.createElement("div");
  tmp.innerHTML=renderMessages([m]);
  while(tmp.firstChild)area.appendChild(tmp.firstChild);
  area.scrollTop=area.scrollHeight;
}

async function sendChatMessage(){
  const input=document.getElementById("chat-input");
  const content=(input?.value||"").trim();
  if(!content||!activeRoom)return;
  input.value="";input.style.height="38px";input.focus();
  closeEmojiPicker();
  const msg={id:"local-"+Date.now(),sender_id:String(currentUser._id||currentUser.id),sender_name:currentUser.name,sender_roll:currentUser.roll_number,room:activeRoom,content,created_at:new Date().toISOString(),status:"sent",reply_to:replyingTo?{...replyingTo}:null};
  cancelReply();
  appendMessage(msg);
  if(chatSocket?.connected){
    chatSocket.emit("message",{token:Auth.getToken()||"",room:activeRoom,content,reply_to:replyingTo});
  }else{
    try{await ChatAPI.sendMessage(activeRoom,content);}catch{}
  }
}

function connectSocket(room){
  if(typeof io==="undefined")return;
  if(chatSocket){try{chatSocket.disconnect();}catch(e){}}
  const token=Auth.getToken()||"";
  chatSocket=io("http://localhost:5000",{auth:{token:`Bearer ${token}`}});
  chatSocket.emit("join",{token:`Bearer ${token}`,room});
  chatSocket.on("new_message",msg=>{
    if(msg.room!==activeRoom){unreadCounts[msg.room]=(unreadCounts[msg.room]||0)+1;updateNavBadge();renderRoomList();return;}
    if(String(msg.sender_id)===String(currentUser._id||currentUser.id))return;
    appendMessage(msg);
  });
  chatSocket.on("typing",data=>{if(data.room===activeRoom&&data.user_id!==currentUser._id)showTypingIndicator(data.name);});
  chatSocket.on("stop_typing",data=>{if(data.room===activeRoom)hideTypingIndicator();});
  chatSocket.on("user_online",id=>{onlineUsers.add(id);});
  chatSocket.on("user_offline",id=>{onlineUsers.delete(id);});
}

function backToRoomList(){
  document.getElementById("chat-sidebar")?.classList.remove("hidden-mobile");
  document.getElementById("chat-panel")?.classList.remove("visible-mobile");
  document.body.classList.remove("chat-panel-open");
  activeRoom=null;
  if(chatSocket){try{chatSocket.disconnect();}catch(e){}chatSocket=null;}
}

function handleTyping(){autoGrow(document.getElementById("chat-input"));if(chatSocket?.connected&&activeRoom){chatSocket.emit("typing",{room:activeRoom,name:currentUser.name,user_id:currentUser._id});clearTimeout(typingTimer);typingTimer=setTimeout(()=>{if(chatSocket?.connected)chatSocket.emit("stop_typing",{room:activeRoom});},2000);}}
function autoGrow(el){if(!el)return;el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px";}

let typingShown=false;
function showTypingIndicator(name){hideTypingIndicator();typingShown=true;const area=document.getElementById("chat-messages-area");if(!area)return;area.insertAdjacentHTML("beforeend",`<div class="typing-indicator" id="typing-indicator"><div class="msg-av-sm" style="background:#334155">...</div><div><div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:3px">${escHtml(name)} is typing</div><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`);area.scrollTop=area.scrollHeight;}
function hideTypingIndicator(){document.getElementById("typing-indicator")?.remove();typingShown=false;}
function setReply(msgId,senderName,content){replyingTo={id:msgId,sender_name:senderName,content};document.getElementById("reply-preview-bar").style.display="flex";document.getElementById("reply-from").textContent=senderName;document.getElementById("reply-text").textContent=content.slice(0,80);document.getElementById("chat-input")?.focus();closeContextMenu();}
function cancelReply(){replyingTo=null;document.getElementById("reply-preview-bar").style.display="none";}
function toggleEmojiPicker(){const p=document.getElementById("emoji-picker");if(!p)return;const show=p.style.display==="none"||!p.style.display;p.style.display=show?"flex":"none";if(show)p.querySelectorAll("span").forEach(s=>{s.onclick=()=>{const inp=document.getElementById("chat-input");if(inp){inp.value+=s.textContent;inp.focus();autoGrow(inp);}}; });}
function closeEmojiPicker(){const p=document.getElementById("emoji-picker");if(p)p.style.display="none";}
function showContextMenu(e,msgId,content,sender){e.preventDefault();ctxTargetMsg=msgId;ctxMsgContent=content;ctxMsgSender=sender;const menu=document.getElementById("msg-context-menu");if(!menu)return;menu.style.display="block";menu.style.left=Math.min(e.clientX,window.innerWidth-175)+"px";menu.style.top=Math.min(e.clientY,window.innerHeight-160)+"px";}
let _touchTimer=null;
function touchStartCtx(e,msgId,content,sender){_touchTimer=setTimeout(()=>showContextMenu(e.touches[0],msgId,content,sender),500);}
function touchEndCtx(){clearTimeout(_touchTimer);}
function closeContextMenu(){document.getElementById("msg-context-menu").style.display="none";}
document.addEventListener("click",()=>closeContextMenu());
function ctxReply(){setReply(ctxTargetMsg,ctxMsgSender,ctxMsgContent);}
function ctxCopy(){navigator.clipboard?.writeText(ctxMsgContent).then(()=>showToast("Copied!","success"));closeContextMenu();}
function ctxReact(){addReaction(ctxTargetMsg,"❤️");closeContextMenu();}
function ctxDelete(){const el=document.getElementById("msg-"+ctxTargetMsg);if(el){el.style.opacity="0";el.style.transform="scale(.8)";el.style.transition="all .2s";setTimeout(()=>el.remove(),200);}closeContextMenu();showToast("Deleted","success");}
function addReaction(msgId,emoji){const row=document.getElementById("msg-"+msgId);if(!row)return;let rd=row.querySelector(".msg-reactions");if(!rd){rd=document.createElement("div");rd.className="msg-reactions";row.querySelector(".msg-bubble")?.after(rd);}const ex=[...rd.querySelectorAll(".msg-reaction-chip")].find(c=>c.textContent.startsWith(emoji));if(ex){const s=ex.querySelector("span");s.textContent=parseInt(s.textContent||"1")+1;}else{rd.insertAdjacentHTML("beforeend",`<div class="msg-reaction-chip">${emoji}<span>1</span></div>`);}}
function updateNavBadge(){const total=Object.values(unreadCounts).reduce((a,b)=>a+b,0);let badge=document.querySelector(".bnav-item[data-tab='chat'] .chat-nav-badge");if(!badge&&total>0){const item=document.querySelector(".bnav-item[data-tab='chat']");if(item){item.style.position="relative";item.insertAdjacentHTML("beforeend",`<div class="chat-nav-badge">${total>99?"99+":total}</div>`);}}else if(badge){if(total===0)badge.remove();else badge.textContent=total>99?"99+":total;}}
function filterChatRooms(q){document.querySelectorAll(".room-item").forEach(el=>{const name=el.querySelector(".room-name")?.textContent||"";el.style.display=name.toLowerCase().includes(q.toLowerCase())?"":"none";});}
function openGroupInfo(){showToast("Group info coming soon!");}
function closeGroupInfo(){}
function openChatOptions(e){showContextMenu(e,null,"","");const menu=document.getElementById("msg-context-menu");if(!menu)return;menu.innerHTML=`<div class="ctx-item" onclick="showToast('Search coming soon!');closeContextMenu()">🔍 Search in Chat</div><div class="ctx-item" onclick="showToast('Group info!');closeContextMenu()">ℹ️ Group Info</div><div class="ctx-item danger" onclick="showToast('Left group');closeContextMenu()">🚪 Leave Group</div>`;}
function openLightbox(src){let lb=document.getElementById("chat-lightbox");if(!lb){lb=document.createElement("div");lb.id="chat-lightbox";lb.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(6px)";lb.onclick=()=>lb.remove();document.body.appendChild(lb);}lb.innerHTML=`<img src="${escHtml(src)}" style="max-width:95vw;max-height:90vh;border-radius:12px;object-fit:contain">`;document.body.appendChild(lb);}
async function handleFileAttach(input){if(!input.files[0]||!activeRoom)return;showToast("Uploading…","info");try{const res=await ChatAPI.uploadFile(input.files[0],activeRoom);appendMessage({id:"local-"+Date.now(),sender_id:String(currentUser._id||currentUser.id),sender_name:currentUser.name,sender_roll:currentUser.roll_number,room:activeRoom,content:input.files[0].name,media_type:res.media_type,media_url:res.media_url||res.url,created_at:new Date().toISOString(),status:"sent"});showToast("Sent!","success");}catch{showToast("Upload failed","error");}input.value="";}
async function openDMSearch(){openModal(`<div><div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Start a Direct Message</div><input id="dm-search-input" class="profile-input" placeholder="Search by name or roll number…" oninput="searchDMUsers(this.value)"><div id="dm-search-results" style="margin-top:12px"></div></div>`);}
async function searchDMUsers(q){if(!q||q.length<2){document.getElementById("dm-search-results").innerHTML="";return;}const res=document.getElementById("dm-search-results");try{const users=await ChatAPI.searchUsers(q);res.innerHTML=users.map(u=>`<div onclick="startDMWith('${u.roll_number}')" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:var(--r-sm);cursor:pointer" onmouseover="this.style.background='var(--s2)'" onmouseout="this.style.background=''"><div style="width:38px;height:38px;border-radius:50%;background:${getColor(u.name[0])};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700">${u.name[0]}</div><div><div style="font-size:14px;font-weight:600;color:var(--text)">${escHtml(u.name)}</div><div style="font-size:12px;color:var(--text-3)">${u.roll_number} · ${u.branch||""}</div></div></div>`).join("")||`<div style="color:var(--text-3);font-size:13px;padding:8px">No users found</div>`;}catch{res.innerHTML=`<div style="color:var(--text-3);font-size:13px">Search offline</div>`;}}
async function startDMWith(roll){closeModal();try{const res=await ChatAPI.startDM(roll);showTab("chat");setTimeout(()=>openRoom(res.room,res.with_user?.name||"DM","dm"),300);}catch{showToast("Could not start DM","error");}}
function openNewGroupModal(){openModal(`<div><div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Create Group</div><input id="ng-name" class="profile-input" placeholder="Group name…" style="margin-bottom:10px"><input id="ng-rolls" class="profile-input" placeholder="Add roll numbers (comma separated)…" style="margin-bottom:14px"><button class="profile-save-btn" onclick="createGroup()">Create Group</button></div>`);}
async function createGroup(){const name=document.getElementById("ng-name")?.value.trim();const rolls=(document.getElementById("ng-rolls")?.value||"").split(",").map(r=>r.trim()).filter(Boolean);if(!name){showToast("Enter group name","error");return;}try{const res=await ChatAPI.createGroup(name,rolls);closeModal();showToast(`Group "${name}" created!`,"success");await loadChat();openRoom(res.room||`group_${res.id}`,name,"mygroup");}catch{showToast("Could not create group","error");}}

/* ════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════ */
async function loadNotifs(){
  const el=document.getElementById("notifs-list");if(!el)return;
  let notifs;
  try{notifs=await NotifsAPI.list();}catch{notifs=[{id:"1",notif_type:"system",title:"Welcome to Sangam! 🔱",body:"Explore the platform — connect with alumni, find jobs, and chat.",is_read:false,created_at:new Date().toISOString()}];}
  el.innerHTML=notifs.length?notifs.map(n=>`<div class="notif-item ${n.is_read?"":"unread"}"><div class="notif-icon">${{system:"📢",job:"💼",message:"💬"}[n.notif_type]||"🔔"}</div><div><div class="notif-text">${escHtml(n.title)}</div>${n.body?`<div class="notif-text" style="font-size:13px;color:var(--text-2)">${escHtml(n.body)}</div>`:""}<div class="notif-time">${fmtTime(n.created_at)}</div></div></div>`).join(""):`<div class="feed-loading">No notifications</div>`;
}

async function markAllRead(){try{await NotifsAPI.readAll();loadNotifs();document.getElementById("notif-dot").style.display="none";}catch{}}
async function loadNotifBadge(){try{const n=await NotifsAPI.list();const u=n.filter(x=>!x.is_read).length;const dot=document.getElementById("notif-dot");if(dot)dot.style.display=u?"block":"none";}catch{}}

/* ════════════════════════════════════════
   MODALS
════════════════════════════════════════ */
function openModal(html){document.getElementById("modal-overlay").style.display="block";const mc=document.getElementById("modal-content");mc.innerHTML=html;mc.style.display="block";}
function closeModal(){document.getElementById("modal-overlay").style.display="none";document.getElementById("modal-content").style.display="none";}

function openPostModal(){openModal(`<div><div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Create Post</div><select id="post-type-sel" class="profile-input" style="margin-bottom:10px"><option value="update">Update</option><option value="job">Job Opportunity</option><option value="question">Question</option><option value="win">Achievement/Win</option><option value="event">Event</option><option value="tip">Tip</option></select><textarea id="post-content-inp" class="profile-input" rows="5" placeholder="What's on your mind?" style="resize:vertical;margin-bottom:10px"></textarea><input id="post-tags-inp" class="profile-input" placeholder="Tags (comma separated)" style="margin-bottom:14px"><button class="profile-save-btn" onclick="submitPost()">Post</button></div>`);}
async function submitPost(){const type=document.getElementById("post-type-sel")?.value||"update";const content=document.getElementById("post-content-inp")?.value.trim();const tags=(document.getElementById("post-tags-inp")?.value||"").split(",").map(t=>t.trim()).filter(Boolean);if(!content){showToast("Write something first","error");return;}try{await PostsAPI.create({post_type:type,content,tags});closeModal();showToast("Posted!","success");loadFeed();}catch{showToast("Could not post","error");}}

function openJobModal(){openModal(`<div><div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:14px">Post Job / Internship</div><input id="jm-title" class="profile-input" placeholder="Job title" style="margin-bottom:10px"><input id="jm-company" class="profile-input" placeholder="Company" style="margin-bottom:10px"><input id="jm-location" class="profile-input" placeholder="Location / Remote" style="margin-bottom:10px"><select id="jm-type" class="profile-input" style="margin-bottom:10px"><option value="internship">Internship</option><option value="fulltime">Full-Time</option><option value="parttime">Part-Time</option></select><input id="jm-salary" class="profile-input" placeholder="Salary (optional)" style="margin-bottom:10px"><textarea id="jm-desc" class="profile-input" rows="3" placeholder="Description…" style="resize:vertical;margin-bottom:10px"></textarea><label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer"><input type="checkbox" id="jm-referral"><span style="font-size:14px">I can provide a referral</span></label><button class="profile-save-btn" onclick="submitJob()">Post Job</button></div>`);}
async function submitJob(){const payload={title:document.getElementById("jm-title")?.value.trim(),company:document.getElementById("jm-company")?.value.trim(),location:document.getElementById("jm-location")?.value.trim(),job_type:document.getElementById("jm-type")?.value,salary:document.getElementById("jm-salary")?.value.trim(),description:document.getElementById("jm-desc")?.value.trim(),referral:document.getElementById("jm-referral")?.checked};if(!payload.title||!payload.company){showToast("Title and company required","error");return;}try{await JobsAPI.create(payload);closeModal();showToast("Job posted!","success");loadJobs();}catch{showToast("Could not post job","error");}}

/* ════════════════════════════════════════
   ID CARD
════════════════════════════════════════ */
let currentCardType="student";
function switchCardType(type){currentCardType=type;const bs=document.getElementById("btn-student");const ba=document.getElementById("btn-alumni");const as=document.getElementById("alumni-section");if(type==="student"){if(bs){bs.style.background="var(--purple)";bs.style.color="#fff";}if(ba){ba.style.background="transparent";ba.style.color="var(--text)";}if(as)as.style.display="none";}else{if(bs){bs.style.background="transparent";bs.style.color="var(--text)";}if(ba){ba.style.background="var(--purple)";ba.style.color="#fff";}if(as)as.style.display="block";}updateIDCard();}
function updateIDCard(){const u=currentUser||{};setText("card-name",u.name||"Your Name");setText("card-batch",`${u.branch||"CSE"} · Batch ${u.batch_year||"2024"}`);setText("card-id",`SAG-${(u.roll_number||"000000").slice(-6)}`);setText("card-type-label",currentCardType==="student"?"Student":"Alumni");const ca=document.getElementById("card-avatar-letter");if(ca)ca.textContent=(u.name||"A")[0].toUpperCase();}
function generateIDCard(){updateIDCard();const u=currentUser||{};const qrData=JSON.stringify({type:currentCardType,name:u.name,id:`SAG-${(u.roll_number||"").slice(-6)}`,roll:u.roll_number,batch:u.batch_year});const url=`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;const sm=document.getElementById("qr-code-small");const lg=document.getElementById("qr-code-large");if(sm)sm.innerHTML=`<img src="${url}" style="width:100%;height:100%;border-radius:6px">`;if(lg)lg.innerHTML=`<img src="${url}" style="width:100%;height:100%;border-radius:var(--r-sm)">`;document.getElementById("qr-modal").style.display="flex";showToast("ID Card generated","success");}
function closeQRModal(){document.getElementById("qr-modal").style.display="none";}
function downloadQRCode(){const img=document.getElementById("qr-code-large")?.querySelector("img");if(!img){showToast("QR not ready","error");return;}const a=document.createElement("a");a.href=img.src;a.download=`sangam-id-${currentUser.roll_number||"card"}.png`;a.click();showToast("Downloaded!","success");}

/* ── Sidebar / Logout ────────────────────────────────────── */
function logout(){Auth.clear();window.location.href="auth.html";}