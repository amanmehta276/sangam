/* ============================================================
   dashboard.js — Main dashboard logic
   Handles tabs, feed, alumni, jobs, chat, profile
   ============================================================ */

/* ── State ───────────────────────────────────────────────────*/
let currentUser  = null;
let currentTab   = "feed";
let activePostType = "update";
let allPosts     = [];

/* ── Colours for avatars ─────────────────────────────────────*/
const AV_COLORS = ["#7C3AED","#E8610A","#16A34A","#0288D1","#E91E63","#FF5722","#00796B","#5C6BC0"];
const getColor  = (s) => AV_COLORS[s.charCodeAt(0) % AV_COLORS.length];

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  // Load user from localStorage (works in demo mode too)
  currentUser = Auth.getUser() || {
    id: 1, name: "Arjun Sharma", roll_number: "CSE22101",
    branch: "CSE", batch_year: 2022, role: "student",
    trust_level: "partial", skills: ["React","Python","DSA"],
  };

  renderHeader();
  await showTab("feed");
  loadNotifBadge();
});

/* ── Header personalise ──────────────────────────────────────*/
function renderHeader() {
  const av = document.getElementById("header-avatar");
  const composeAv = document.getElementById("compose-av");
  const initial = (currentUser.name || "A")[0].toUpperCase();
  if (av)       { av.textContent = initial; av.style.background = getColor(initial); }
  if (composeAv){ composeAv.textContent = initial; composeAv.style.background = getColor(initial); }

  // Show post-job button to alumni/teacher/admin
  const pjWrap = document.getElementById("post-job-btn-wrap");
  if (pjWrap && ["alumni","teacher","admin"].includes(currentUser.role)) {
    pjWrap.classList.remove("hidden");
  }
}

/* ════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════ */
function showTab(tab) {
  currentTab = tab;

  // Deactivate all views
  document.querySelectorAll(".tab-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(n => n.classList.remove("active"));

  // Activate target view
  const view = document.getElementById(`tab-${tab}`);
  if (view) view.classList.add("active");

  const navItem = document.querySelector(`.bnav-item[data-tab="${tab}"]`);
  if (navItem) navItem.classList.add("active");

  // Hide FAB on non-feed tabs
  const fab = document.getElementById("fab-btn");
  if (fab) fab.style.display = (tab === "feed") ? "flex" : "none";

  // Load data for the tab
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
   FEED
════════════════════════════════════════ */
const DEMO_POSTS = [
  { id:1, author:{name:"Rahul Verma",roll_number:"CSE20011",branch:"CSE",batch_year:2020,role:"alumni",trust_level:"verified"}, post_type:"job", content:"🚀 Google is hiring — SWE Intern (Summer 2025)\nLooking for strong DSA + problem solving. DM me directly for a referral — happy to fast-track juniors from our college. Deadline April 30th.", tags:["SWE Intern","Remote OK","₹80k/mo"], likes:24, created_at:new Date(Date.now()-7200000).toISOString() },
  { id:2, author:{name:"Priya Singh",roll_number:"EEE22045",branch:"EEE",batch_year:2022,role:"student",trust_level:"new"}, post_type:"question", content:"Anyone here who cracked GATE 2024? Looking for a study plan for EEE — power systems + control systems. Would really appreciate guidance from alumni or seniors 🙏", tags:[], likes:11, created_at:new Date(Date.now()-18000000).toISOString() },
  { id:3, author:{name:"Kiran Mehta",roll_number:"CSE19032",branch:"CSE",batch_year:2019,role:"alumni",trust_level:"verified"}, post_type:"win", content:"Our product just crossed 1 Million users! 🎉 Excited to announce I'm hosting a free PM session for juniors next Saturday. Drop a comment to register — limited slots!", tags:[], likes:67, created_at:new Date(Date.now()-86400000).toISOString() },
  { id:4, author:{name:"Dr. S. Tiwari",roll_number:"TCH001",branch:"CSE",batch_year:2005,role:"teacher",trust_level:"verified"}, post_type:"event", content:"📢 Department Seminar on AI & Machine Learning this Friday, 3PM, Seminar Hall A. All students are encouraged to attend. Guest speaker from IIT Raipur.", tags:["AI","ML","Free"], likes:38, created_at:new Date(Date.now()-172800000).toISOString() },
  { id:5, author:{name:"Sneha Verma",roll_number:"IT22088",branch:"IT",batch_year:2022,role:"student",trust_level:"partial"}, post_type:"tip", content:"💡 Interview tip: Always mention the time & space complexity of your solutions even if interviewer doesn't ask. It signals you're thinking like an engineer. #DSA #Placement", tags:[], likes:102, created_at:new Date(Date.now()-259200000).toISOString() },
];

async function loadFeed(filter = null) {
  const el = document.getElementById("feed-list");
  if (!el) return;

  try {
    allPosts = await PostsAPI.list(filter);
  } catch {
    allPosts = DEMO_POSTS; // fallback demo data
  }

  const posts = filter ? allPosts.filter(p => p.post_type === filter) : allPosts;
  el.innerHTML = posts.length ? posts.map(renderPost).join("") : `<div class="feed-loading">No posts yet.</div>`;
  loadStories();
}

function renderPost(p) {
  const a = p.author || {};
  const color = getColor((a.name || "A")[0]);
  const initial = (a.name || "?")[0].toUpperCase();
  const trust = { verified:"🟢 Verified", partial:"🔵 Verified", new:"🟡 New" }[a.trust_level] || "";
  const badgeClass = { verified:"vb-g", partial:"vb-b", new:"vb-y" }[a.trust_level] || "";
  const typeLabel = { job:"💼 Job", question:"🙋 Question", win:"🏆 Win", event:"📢 Event", tip:"💡 Tip", update:"💬 Update" }[p.post_type] || "💬 Update";
  const tags = (p.tags || []).map(t => `<span class="ptag ptag-pu">${t}</span>`).join("");
  const timeAgo = formatTime(p.created_at);

  return `
  <div class="post-card">
    <div class="post-head">
      <div class="post-av" style="background:${color}">${initial}</div>
      <div class="post-meta">
        <div class="post-name">
          ${escHtml(a.name || "Unknown")}
          <span class="vbadge ${badgeClass}">${trust}</span>
        </div>
        <div class="post-sub">${escHtml(a.branch||"")} · Batch ${a.batch_year||""} · ${timeAgo}</div>
      </div>
      <div class="post-type-chip">${typeLabel}</div>
    </div>
    <div class="post-body">${escHtml(p.content || "").replace(/\n/g,"<br>")}</div>
    ${tags ? `<div class="post-body" style="padding-top:0"><div class="tag-row">${tags}</div></div>` : ""}
    <div class="post-divider"></div>
    <div class="post-actions">
      <div class="pact" id="like-${p.id}" onclick="likePost(${p.id}, this)">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        <span class="like-count">${p.likes || 0}</span>
      </div>
      <div class="pact" onclick="showToast('Comments coming soon!')">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Comment
      </div>
      <div class="pact" onclick="showToast('Post shared!')">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Share
      </div>
    </div>
  </div>`;
}

async function likePost(id, el) {
  const countEl = el.querySelector(".like-count");
  const n = parseInt(countEl?.textContent || 0);
  // Optimistic UI
  countEl.textContent = n + 1;
  el.style.color = "var(--purple)";
  el.querySelector("path")?.setAttribute("fill", "var(--purple)");
  try { await PostsAPI.like(id); } catch {}
  showToast("❤️ Liked!");
}

function filterFeed(type, chipEl) {
  document.querySelectorAll(".chips-row .chip").forEach(c => c.classList.remove("on"));
  chipEl.classList.add("on");
  loadFeed(type === "all" ? null : type);
}

function loadStories() {
  const strip = document.getElementById("stories-strip");
  if (!strip) return;
  // Keep the "Add" button, append dynamic stories
  const storyData = [
    { name:"Rahul", color:"#388E3C" },
    { name:"Priya",  color:"#9C27B0" },
    { name:"Kiran",  color:"#FF5722" },
    { name:"Meera",  color:"#E91E63" },
    { name:"Aryan",  color:"#00ACC1" },
  ];
  const extra = storyData.map(s => `
    <div class="story" onclick="showToast('${s.name}\\'s story')">
      <div class="story-ring">
        <div class="story-inner" style="background:${s.color}">${s.name[0]}</div>
      </div>
      <div class="story-name">${s.name}</div>
    </div>`).join("");
  // Only append if not already done
  if (strip.querySelectorAll(".story").length <= 1) {
    strip.insertAdjacentHTML("beforeend", extra);
  }
}

/* ════════════════════════════════════════
   ALUMNI
════════════════════════════════════════ */
const DEMO_ALUMNI = [
  { id:3, name:"Rahul Verma",   branch:"CSE", batch_year:2020, role:"alumni",  trust_level:"verified", company:"Google",    skills:["DSA","System Design","Go"] },
  { id:4, name:"Kiran Mehta",   branch:"ME",  batch_year:2019, role:"alumni",  trust_level:"verified", company:"Flipkart",  skills:["Product","Analytics","SQL"] },
  { id:5, name:"Sneha Patel",   branch:"CSE", batch_year:2018, role:"alumni",  trust_level:"verified", company:"Microsoft", skills:["ML","Python","PyTorch"] },
  { id:6, name:"Dr. S. Tiwari", branch:"CSE", batch_year:2005, role:"teacher", trust_level:"verified", company:"CIT Raipur",skills:["Research","DBMS","CN"] },
  { id:7, name:"Vikram Das",    branch:"IT",  batch_year:2021, role:"alumni",  trust_level:"partial",  company:"Amazon",    skills:["Java","Spring Boot","AWS"] },
  { id:8, name:"Meera Joshi",   branch:"ECE", batch_year:2021, role:"alumni",  trust_level:"partial",  company:"Razorpay",  skills:["Figma","UX","Research"] },
];

async function loadAlumni(params = {}) {
  const el = document.getElementById("alumni-list");
  if (!el) return;
  let alumni;
  try { alumni = await UsersAPI.list({ role: "alumni", ...params }); }
  catch { alumni = DEMO_ALUMNI; }
  el.innerHTML = alumni.length ? alumni.map(renderAlumniCard).join("") : `<div class="feed-loading">No alumni found.</div>`;
}

function renderAlumniCard(u) {
  const color = getColor((u.name||"A")[0]);
  const initial = (u.name||"?")[0].toUpperCase();
  const trust = { verified:"🟢", partial:"🔵", new:"🟡" }[u.trust_level] || "";
  const badgeClass = { verified:"vb-g", partial:"vb-b", new:"vb-y" }[u.trust_level] || "";
  const skills = (u.skills || []).slice(0,3).map(s => `<span class="atag">${escHtml(s)}</span>`).join("");
  return `
  <div class="alumni-card">
    <div class="al-av" style="background:${color}">${initial}</div>
    <div class="al-info">
      <div class="al-name">${escHtml(u.name)} <span class="vbadge ${badgeClass}">${trust}</span></div>
      <div class="al-role">${escHtml(u.role==="teacher"?"Faculty":"Alumni")} · ${u.branch} · Batch ${u.batch_year}</div>
      ${u.company ? `<div class="al-company">@ ${escHtml(u.company)}</div>` : ""}
      <div class="al-tags">${skills}</div>
    </div>
    <button class="conn-btn" onclick="showToast('Connection request sent to ${escHtml(u.name)}!')">Connect</button>
  </div>`;
}

function searchAlumni(q) {
  loadAlumni(q ? { q } : {});
}

function filterAlumniBy(key, val) {
  const params = {};
  params[key] = val;
  loadAlumni(params);
}

/* ════════════════════════════════════════
   JOBS
════════════════════════════════════════ */
const DEMO_JOBS = [
  { id:1, title:"Software Engineer Intern", company:"Google", location:"Bangalore", job_type:"internship", salary:"₹80k/mo", referral:true, skills:["DSA","System Design","Go"], posted_by:{name:"Rahul Verma",batch_year:2020} },
  { id:2, title:"Product Manager Intern",   company:"Flipkart",location:"Bangalore",job_type:"internship", salary:"₹70k/mo", referral:true, skills:["Product Sense","Analytics"], posted_by:{name:"Kiran Mehta",batch_year:2019} },
  { id:3, title:"Data Science Intern",       company:"Microsoft",location:"Hyderabad",job_type:"internship",salary:"₹75k/mo", referral:true, skills:["Python","ML","Azure"],       posted_by:{name:"Sneha Patel",batch_year:2018} },
  { id:4, title:"SDE-1",                     company:"Amazon",  location:"Remote",    job_type:"fulltime",  salary:"₹18 LPA", referral:true, skills:["Java","Spring Boot","AWS"],  posted_by:{name:"Vikram Das",batch_year:2021} },
];

async function loadJobs() {
  const el = document.getElementById("jobs-list");
  if (!el) return;
  let jobs;
  try { jobs = await JobsAPI.list(); }
  catch { jobs = DEMO_JOBS; }
  el.innerHTML = jobs.length ? jobs.map(renderJobCard).join("") : `<div class="feed-loading">No jobs posted yet.</div>`;
}

function renderJobCard(j) {
  const skills = (j.skills || []).map(s => `<span class="ptag ptag-pu">${escHtml(s)}</span>`).join("");
  const by = j.posted_by || {};
  return `
  <div class="job-card">
    <div class="jc-top">
      <div class="jc-logo">🏢</div>
      <div>
        <div class="jc-title">${escHtml(j.title)}</div>
        <div class="jc-company">${escHtml(j.company)} · ${escHtml(j.location||"")}</div>
        ${by.name ? `<div class="jc-by">Posted by ${escHtml(by.name)} (Batch ${by.batch_year})</div>` : ""}
      </div>
    </div>
    <div class="jc-tags">
      ${skills}
      ${j.salary ? `<span class="ptag ptag-or">${escHtml(j.salary)}</span>` : ""}
      <span class="ptag ptag-gr">${j.job_type==="fulltime"?"Full-Time":"Internship"}</span>
    </div>
    <div class="jc-foot">
      ${j.referral ? `<span class="ref-badge">✅ Referral Available</span>` : `<span></span>`}
      <button class="apply-btn" onclick="showToast('✅ Application sent!')">Apply →</button>
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   CHAT
════════════════════════════════════════ */
const DEMO_DMS = [
  { id:1, name:"Rahul Verma · Google",   color:"#388E3C", preview:"Sure! Send me your resume 👍", time:"2m",  unread:2, online:true  },
  { id:2, name:"Kiran Mehta · Flipkart", color:"#FF5722", preview:"PM session is Saturday 3PM!",  time:"1h",  unread:1, online:false },
  { id:3, name:"Meera Joshi",            color:"#E91E63", preview:"Did you see the GATE group? 👀",time:"3h",  unread:1, online:true  },
  { id:4, name:"Aryan Kapoor",           color:"#00ACC1", preview:"Thanks for the LeetCode sheet!",time:"1d", unread:0, online:false },
];

const DEMO_GROUPS = [
  { id:"placements", name:"Placements 2025",    icon:"💼", bg:"#FFF3EB", sub:"342 members · Amazon opening SDE1!", badge:12 },
  { id:"cse-2022",   name:"CSE Batch 2022",      icon:"💻", bg:"#F0ECFF", sub:"89 members · Active now",           badge:0  },
  { id:"webdev",     name:"Web Dev & Fullstack",  icon:"🌐", bg:"#E3F2FD", sub:"156 members · React 19 is fire 🔥", badge:3  },
  { id:"aiml",       name:"AI & ML Enthusiasts",  icon:"🤖", bg:"#F3E5F5", sub:"203 members · Active 1h ago",        badge:0  },
  { id:"gate",       name:"GATE 2025 Prep",       icon:"📚", bg:"#FFFDE7", sub:"78 members · Resources shared",      badge:7  },
  { id:"mentorship", name:"Mentorship Connect",   icon:"🤝", bg:"#EBF8F0", sub:"Alumni + Students · Live now",       badge:0  },
];

function loadChat() {
  renderDMs();
  renderGroups();
}

function renderDMs() {
  const el = document.getElementById("chat-dm-list");
  if (!el) return;
  el.innerHTML = DEMO_DMS.map(c => `
    <div class="dm-item" onclick="showToast('Chat opened with ${c.name}')">
      <div class="dm-av" style="background:${c.color}">
        ${c.name[0]}
        ${c.online ? `<div class="online-dot"></div>` : ""}
      </div>
      <div class="dm-body">
        <div class="dm-name">${escHtml(c.name)}</div>
        <div class="dm-preview">${escHtml(c.preview)}</div>
      </div>
      <div class="dm-side">
        <div class="dm-time">${c.time}</div>
        ${c.unread ? `<div class="dm-unread">${c.unread}</div>` : ""}
      </div>
    </div>`).join("");
}

function renderGroups() {
  const el = document.getElementById("chat-grp-list");
  if (!el) return;
  el.innerHTML = DEMO_GROUPS.map(g => `
    <div class="grp-item" onclick="showToast('${g.name} opened')">
      <div class="grp-icon" style="background:${g.bg}">${g.icon}</div>
      <div class="grp-body">
        <div class="grp-name">${escHtml(g.name)}</div>
        <div class="grp-sub">${escHtml(g.sub)}</div>
      </div>
      ${g.badge ? `<span class="grp-badge">${g.badge}</span>` : ""}
    </div>`).join("");
}

function chatTabSwitch(tab) {
  document.getElementById("ctab-dm").classList.toggle("on", tab === "dm");
  document.getElementById("ctab-grp").classList.toggle("on", tab === "grp");
  document.getElementById("chat-dm-list").classList.toggle("hidden", tab !== "dm");
  document.getElementById("chat-grp-list").classList.toggle("hidden", tab !== "grp");
}

/* ════════════════════════════════════════
   PROFILE
════════════════════════════════════════ */
function loadProfile() {
  const u = currentUser;
  if (!u) return;

  const initial = (u.name || "A")[0].toUpperCase();
  const av = document.getElementById("profile-av");
  if (av) { av.textContent = initial; av.style.background = getColor(initial); }

  setText("prof-name",   u.name || "—");
  setText("prof-role",   `${u.role === "teacher" ? "Faculty" : u.role === "alumni" ? "Alumni" : "Student"} · ${u.branch || ""} · ${u.batch_year || ""}`);
  setText("prof-bio",    u.bio || "No bio yet. Edit your profile to add one.");

  // Badges
  const badges = document.getElementById("prof-badges");
  if (badges) badges.innerHTML = `
    <span class="pbadge pb-batch">Batch ${u.batch_year||""}</span>
    <span class="pbadge pb-branch">${u.branch||""}</span>
    <span class="pbadge pb-role">${u.role||"student"}</span>`;

  // Trust bar
  const trustW = { verified: "90", partial: "50", new: "25" }[u.trust_level] || "25";
  const trustBar = document.getElementById("trust-bar");
  if (trustBar) trustBar.style.width = `${trustW}%`;
  setText("trust-label", `${trustW}% — ${u.trust_level || "New User"}`);

  // Skills
  const skillsEl = document.getElementById("skills-list");
  if (skillsEl) {
    const skills = Array.isArray(u.skills) ? u.skills : (u.skills||"").split(",").filter(Boolean);
    skillsEl.innerHTML = skills.map(s => `<span class="skill-chip">${escHtml(s.trim())}</span>`).join("") +
      `<span class="skill-chip" style="border-style:dashed;color:var(--purple);border-color:var(--purple)" onclick="showToast('Add skill coming soon!')">+ Add Skill</span>`;
  }

  // Links
  const linksEl = document.getElementById("prof-links");
  if (linksEl) {
    linksEl.innerHTML = `
      <button onclick="showToast('${u.linkedin_url ? "LinkedIn added!" : "Add LinkedIn for Verified status!"}')"
        style="display:flex;align-items:center;gap:6px;background:#EBF2FD;color:#1355A0;border:none;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">
        🔗 ${u.linkedin_url ? "LinkedIn Connected" : "Add LinkedIn"}
      </button>
      <button onclick="showToast('Add GitHub')"
        style="display:flex;align-items:center;gap:6px;background:var(--s2);color:var(--text-2);border:1.5px dashed var(--border-2);border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer">
        🐙 Add GitHub
      </button>`;
  }

  // Prefill edit form
  setVal("edit-email",   u.email||"");
  setVal("edit-company", u.company||"");
  setVal("edit-linkedin",u.linkedin_url||"");
  setVal("edit-github",  u.github_url||"");
  const skills2 = Array.isArray(u.skills) ? u.skills.join(", ") : (u.skills||"");
  setVal("edit-skills",  skills2);
  setVal("bio-edit",     u.bio||"");
}

function toggleEditProfile() {
  const form = document.getElementById("edit-form");
  const bioEl = document.getElementById("bio-edit");
  const bioDisplay = document.getElementById("prof-bio");
  if (!form) return;
  const isHidden = form.classList.contains("hidden");
  form.classList.toggle("hidden", !isHidden);
  if (bioEl) bioEl.classList.toggle("hidden", !isHidden);
  if (bioDisplay) bioDisplay.classList.toggle("hidden", isHidden);
}

async function saveProfile() {
  const payload = {
    email:       getVal("edit-email"),
    company:     getVal("edit-company"),
    linkedin_url:getVal("edit-linkedin"),
    github_url:  getVal("edit-github"),
    bio:         getVal("bio-edit"),
    skills:      getVal("edit-skills").split(",").map(s=>s.trim()).filter(Boolean),
  };

  try {
    const updated = await UsersAPI.updateProfile(payload);
    currentUser = { ...currentUser, ...updated };
    Auth.setUser(currentUser);
    showToast("✅ Profile saved!");
  } catch {
    // Demo mode: update locally
    currentUser = { ...currentUser, ...payload };
    Auth.setUser(currentUser);
    showToast("✅ Profile saved (local)!");
  }
  toggleEditProfile();
  loadProfile();
}

function showScholarship() {
  showTab("feed");
  showToast("📢 Scholarship section opening soon!");
}

/* ════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════ */
const DEMO_NOTIFS = [
  { notif_type:"job",    title:"New referral available", body:"Rahul Verma posted a Google SWE Intern role", is_read:false, created_at: new Date(Date.now()-120000).toISOString() },
  { notif_type:"system", title:"Welcome to Sangam!",     body:"Complete your profile to reach Verified status.", is_read:false, created_at: new Date(Date.now()-3600000).toISOString() },
  { notif_type:"like",   title:"Kiran liked your post",  body:"Kiran Mehta and 3 others liked your recent update.", is_read:true, created_at: new Date(Date.now()-86400000).toISOString() },
  { notif_type:"system", title:"Placement drive on Feb 22", body:"TCS & Infosys coming to campus. Register now.", is_read:true, created_at: new Date(Date.now()-172800000).toISOString() },
];

async function loadNotifs() {
  const el = document.getElementById("notifs-list");
  if (!el) return;
  let notifs;
  try { notifs = await NotifsAPI.list(); }
  catch { notifs = DEMO_NOTIFS; }

  const icons = { job:"💼", like:"❤️", system:"📢", connection:"🤝", comment:"💬" };
  el.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.is_read ? "" : "unread"}" onclick="showToast('${escHtml(n.title)}')">
      <div class="notif-icon-wrap" style="background:var(--purple-light);font-size:18px">${icons[n.notif_type]||"📩"}</div>
      <div class="notif-body">
        <div class="notif-text"><strong>${escHtml(n.title)}</strong>${n.body ? " — " + escHtml(n.body) : ""}</div>
        <div class="notif-time">${formatTime(n.created_at)}</div>
      </div>
    </div>`).join("");

  // Mark as read
  try { await NotifsAPI.readAll(); } catch {}
  loadNotifBadge();
}

async function loadNotifBadge() {
  const dot = document.getElementById("notif-dot");
  if (!dot) return;
  try {
    const notifs = await NotifsAPI.list();
    const unread = notifs.filter(n => !n.is_read).length;
    dot.style.display = unread > 0 ? "block" : "none";
  } catch {
    dot.style.display = "block"; // show in demo
  }
}

/* ════════════════════════════════════════
   POST MODAL
════════════════════════════════════════ */
function openPostModal() {
  document.getElementById("post-modal")?.classList.remove("hidden");
}

function openJobModal() {
  document.getElementById("job-modal")?.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function modalBgClose(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}

function ptSel(el) {
  document.querySelectorAll(".pt-btn").forEach(b => b.classList.remove("sel"));
  el.classList.add("sel");
  activePostType = el.dataset.type || "update";
}

async function submitPost() {
  const content = document.getElementById("post-content")?.value.trim();
  if (!content) { showToast("Write something first!"); return; }

  try {
    await PostsAPI.create({ content, post_type: activePostType });
  } catch {
    // Demo: prepend locally
    allPosts.unshift({
      id: Date.now(), author: currentUser,
      post_type: activePostType, content, tags: [], likes: 0,
      created_at: new Date().toISOString(),
    });
  }

  closeModal("post-modal");
  document.getElementById("post-content").value = "";
  showToast("🔱 Posted to Sangam!");
  loadFeed();
}

async function submitJob() {
  const payload = {
    title:    getVal("jm-title"),
    company:  getVal("jm-company"),
    location: getVal("jm-location"),
    salary:   getVal("jm-salary"),
    job_type: getVal("jm-type"),
    skills:   getVal("jm-skills").split(",").map(s=>s.trim()),
    description: getVal("jm-desc"),
    referral: document.getElementById("jm-referral")?.checked || false,
  };
  if (!payload.title || !payload.company) { showToast("Title and company required"); return; }
  try { await JobsAPI.create(payload); }
  catch { showToast("Demo: job saved locally"); }
  closeModal("job-modal");
  showToast("💼 Job posted!");
  loadJobs();
}

/* ════════════════════════════════════════
   SEARCH
════════════════════════════════════════ */
function toggleSearch() {
  const bar = document.getElementById("search-bar");
  if (!bar) return;
  const isHidden = bar.classList.contains("hidden");
  bar.classList.toggle("hidden", !isHidden);
  if (!isHidden) bar.querySelector("input")?.focus();
}

function handleSearch(q) {
  if (currentTab === "alumni") searchAlumni(q);
}

/* ════════════════════════════════════════
   CHIP SELECTOR
════════════════════════════════════════ */
function chipSel(el) {
  el.closest(".chips-row")?.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
  el.classList.add("on");
}

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function getVal(id) {
  return document.getElementById(id)?.value || "";
}