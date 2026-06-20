/* ============================================================
   profile.js — Profile tab (Sangam)
   Edit via right-side drawer, server-first persistence
   ============================================================ */

const STORAGE_KEYS = {
  avatar:    "sangam_profile_avatar",
  wallpaper: "sangam_profile_wallpaper",
  data:      "sangam_profile_data",
};

const BACKEND_URL = "https://sangam-z93f.onrender.com";

/* Turns any relative/partial path the backend may return into a full,
   absolute URL that will work the same on every device/browser. */
function fixUrl(url) {
  if (!url) return "";
  url = String(url).trim();
  if (!url) return "";
  // Already absolute (http/https/data URI) — leave it alone
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) return url;
  // Backend sometimes returns "/uploads/xxx" or just "uploads/xxx"
  const path = url.startsWith("/") ? url : "/" + url;
  return BACKEND_URL + path;
}

/* ══ Load & render profile ══════════════════════════════ */
async function loadProfile() {
  let u = currentUser;
  try {
    u = await AuthAPI.me();
    currentUser = u;
    Auth.setUser(u);
  } catch (e) {
    console.warn("[Sangam] Could not refresh profile from server, using cached copy.", e);
  }

  // Merge locally saved edits (only fills gaps the server didn't return)
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.data)||"null");
    if (saved) u = { ...saved, ...u };
  } catch(e) {}

  renderHeader();

  // Identity
  _set("profile-name-display",  u.name || "—");
  _set("profile-meta-display",  `${u.branch||""} · Batch ${u.batch_year||""} · ${u.role||""}`);
  _set("quick-roll",   u.roll_number || "—");
  _set("quick-branch", u.branch      || "—");
  _set("quick-batch",  u.batch_year  || "—");

  // Location
  const locEl = document.querySelector("#profile-location-display span");
  if (locEl) locEl.textContent = u.location || "Raipur, Chhattisgarh, India";

  // Verified badge
  const trust = document.getElementById("profile-trust-display");
  if (trust) trust.innerHTML = `<i class="ti ti-rosette-discount-check" style="font-size:12px"></i>
    ${u.trust_level==="verified"?"Verified":"New"} Student · CGIT Raipur`;

  // About
  const bioEl = document.getElementById("profile-bio-display");
  if (bioEl) {
    if (u.bio) {
      bioEl.textContent = u.bio;
      bioEl.style.color = "rgba(255,255,255,0.6)";
      bioEl.style.fontStyle = "normal";
    } else {
      bioEl.textContent = 'Click "Edit Profile" to add your bio…';
      bioEl.style.color = "rgba(255,255,255,0.28)";
      bioEl.style.fontStyle = "italic";
    }
  }

  // Experience
  const crEl = document.getElementById("company-role-display");
  if (crEl) crEl.innerHTML = u.company
    ? `<div style="display:flex;align-items:center;gap:12px;padding:4px 0">
        <div style="width:40px;height:40px;border-radius:var(--r-sm);background:rgba(255,255,255,0.07);border:1px solid var(--border-dk);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">🏢</div>
        <div>
          <div style="font-size:14px;font-weight:600;color:#fff">${escHtml(u.company)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px">Current employer</div>
        </div>
       </div>`
    : `<div class="exp-empty">Click "Edit Profile" to add experience</div>`;

  // Skills
  const skills = Array.isArray(u.skills)
    ? u.skills
    : (u.skills||"").split(",").map(s=>s.trim()).filter(Boolean);
  const skillsEl = document.getElementById("skills-display");
  if (skillsEl) skillsEl.innerHTML = skills.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${skills.map(s=>`<span class="skill-chip">${escHtml(s)}</span>`).join("")}</div>`
    : `<div class="exp-empty">Click "Edit Profile" to add skills</div>`;

  // Links
  _set("display-linkedin", u.linkedin_url || "Not added");
  _set("display-github",   u.github_url   || "Not added");
  _set("display-email",    u.email        || "Not added");

  // ── Avatar — ALWAYS prefer the server URL so every device matches ──
  // localStorage is only a fallback for instant preview before the first
  // successful server sync ever happens (e.g. offline / first load).
  let avatarUrl = u.avatar_url ? fixUrl(u.avatar_url) : "";
  if (!avatarUrl) {
    const cached = localStorage.getItem(STORAGE_KEYS.avatar);
    if (cached) avatarUrl = fixUrl(cached);
  }

  const avImg  = document.getElementById("profile-av-img");
  const avInit = document.getElementById("profile-av-initial");
  if (avatarUrl && avImg) {
    avImg.src = avatarUrl;
    avImg.style.display = "block";
    avImg.onerror = () => {
      avImg.style.display = "none";
      if (avInit) { avInit.textContent = (u.name||"A")[0].toUpperCase(); avInit.style.display = "block"; }
    };
    if (avInit) avInit.style.display = "none";
  } else if (avInit) {
    avInit.textContent = (u.name||"A")[0].toUpperCase();
    avInit.style.display = "block";
    if (avImg) avImg.style.display = "none";
  }

  // ── Wallpaper — same server-first rule as avatar ──
  let wpUrl = u.wallpaper_url ? fixUrl(u.wallpaper_url) : "";
  if (!wpUrl) {
    const cachedWp = localStorage.getItem(STORAGE_KEYS.wallpaper);
    if (cachedWp) wpUrl = fixUrl(cachedWp);
  }
  const wb = document.getElementById("profile-wallpaper");
  if (wb) {
    if (wpUrl) {
      wb.style.backgroundImage    = `url('${wpUrl}')`;
      wb.style.backgroundSize     = "cover";
      wb.style.backgroundPosition = "center";
    } else {
      wb.style.backgroundImage = "";
    }
  }

  // ID card
  updateIDCard();
  if (u.role === "alumni") switchCardType("alumni");
}

/* ══ DRAWER open / close ════════════════════════════════ */
function openEditDrawer() {
  const u = currentUser || {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.data)||"null");
    if (saved) Object.assign(u, saved);
  } catch(e) {}

  const skills = Array.isArray(u.skills)
    ? u.skills
    : (u.skills||"").split(",").map(s=>s.trim()).filter(Boolean);

  _val("pe-bio",             u.bio             || "");
  _val("pe-company",         u.company         || "");
  _val("pe-location",        u.location        || "");
  _val("pe-skills",          skills.join(", "));
  _val("pe-linkedin",        u.linkedin_url    || "");
  _val("pe-github",          u.github_url      || "");
  _val("pe-email",           u.email           || "");
  _val("pe-phone",           u.phone           || "");
  _val("pe-graduation-year", u.graduation_year || "");
  _val("pe-alumni-position", u.alumni_position || "");
  _val("pe-alumni-company",  u.alumni_company  || "");

  renderSkillChips(skills);

  const alumniSec = document.getElementById("alumni-section");
  if (alumniSec) alumniSec.style.display = u.role==="alumni" ? "block" : "none";

  document.getElementById("edit-drawer-overlay")?.classList.add("open");
  document.getElementById("edit-drawer")?.classList.add("open");
  document.body.style.overflow = "hidden";

  setTimeout(() => document.getElementById("pe-bio")?.focus(), 300);
}

function closeEditDrawer() {
  document.getElementById("edit-drawer-overlay")?.classList.remove("open");
  document.getElementById("edit-drawer")?.classList.remove("open");
  document.body.style.overflow = "";
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeEditDrawer();
});

/* ══ Save profile ═══════════════════════════════════════ */
async function saveProfile() {
  const saveBtn = document.getElementById("drawer-save-btn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="ti ti-loader" style="font-size:16px;animation:spin 1s linear infinite"></i> Saving…`;
  }

  const skills = (_getv("pe-skills")||"")
    .split(",").map(s=>s.trim()).filter(Boolean);

  const payload = {
    bio:             _getv("pe-bio"),
    company:         _getv("pe-company"),
    location:        _getv("pe-location"),
    linkedin_url:    _getv("pe-linkedin"),
    github_url:      _getv("pe-github"),
    email:           _getv("pe-email"),
    phone:           _getv("pe-phone"),
    graduation_year: _getv("pe-graduation-year"),
    alumni_position: _getv("pe-alumni-position"),
    alumni_company:  _getv("pe-alumni-company"),
    skills,
  };

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.data)||"{}");
    localStorage.setItem(STORAGE_KEYS.data, JSON.stringify({...existing,...payload}));
  } catch(e) {}

  currentUser = { ...currentUser, ...payload };
  Auth.setUser(currentUser);

  try {
    const updated = await UsersAPI.update(payload);
    currentUser = { ...currentUser, ...updated };
    Auth.setUser(currentUser);
    showToast("Profile saved! ✓", "success");
  } catch (err) {
    console.error("[Sangam] Profile save failed — this will NOT appear on other devices until it succeeds.", err);
    showToast("Saved on this device only — server update failed", "error");
  }

  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="ti ti-device-floppy" style="font-size:16px"></i> Save Changes`;
  }

  closeEditDrawer();
  loadProfile();
}

/* ══ Avatar upload ══════════════════════════════════════ */
async function uploadAvatar(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;

    // Instant local preview only — NOT treated as the source of truth
    const avImg  = document.getElementById("profile-av-img");
    const avInit = document.getElementById("profile-av-initial");
    if (avImg)  { avImg.src = dataUrl; avImg.style.display = "block"; }
    if (avInit) avInit.style.display = "none";

    const hav = document.getElementById("header-avatar");
    if (hav) {
      hav.innerHTML = `<img src="${dataUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
      hav.style.background = "none";
    }

    // Upload to server — this is the ONLY thing that makes the photo show
    // up on other devices, so we surface failures clearly instead of
    // silently treating "saved locally" as success.
    try {
      const res = await UsersAPI.uploadAvatar(file);
      const serverUrl = fixUrl(res.avatar_url);
      if (!serverUrl) throw new Error("Server did not return an avatar_url");

      currentUser = { ...currentUser, avatar_url: serverUrl };
      Auth.setUser(currentUser);
      // Cache only as a fallback for this device — never the source of truth
      localStorage.setItem(STORAGE_KEYS.avatar, serverUrl);

      if (avImg) { avImg.src = serverUrl; avImg.style.display = "block"; }
      if (hav)   hav.innerHTML = `<img src="${serverUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;

      updateIDCard();
      showToast("Photo updated everywhere ✓", "success");
    } catch (err) {
      console.error("[Sangam] Avatar upload to server failed — photo will NOT show on other devices.", err);
      showToast("Upload failed — won't show on other devices. Check connection & retry.", "error");
    }
  };
  reader.readAsDataURL(file);
  input.value = "";
}

/* ══ Wallpaper upload ═══════════════════════════════════ */
async function uploadWallpaper(input) {
  if (!input.files[0]) return;
  const file   = input.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;

    // Instant local preview only — NOT treated as the source of truth
    const wb = document.getElementById("profile-wallpaper");
    if (wb) {
      wb.style.backgroundImage    = `url('${dataUrl}')`;
      wb.style.backgroundSize     = "cover";
      wb.style.backgroundPosition = "center";
    }

    // Upload to server — this is the ONLY thing that makes the cover
    // show up on other devices.
    try {
      const res = await UsersAPI.uploadWallpaper(file);
      const serverUrl = fixUrl(res.wallpaper_url);
      if (!serverUrl) throw new Error("Server did not return a wallpaper_url");

      currentUser = { ...currentUser, wallpaper_url: serverUrl };
      Auth.setUser(currentUser);
      // Cache only as a fallback for this device — never the source of truth
      localStorage.setItem(STORAGE_KEYS.wallpaper, serverUrl);

      if (wb) wb.style.backgroundImage = `url('${serverUrl}')`;
      showToast("Cover updated everywhere ✓", "success");
    } catch (err) {
      console.error("[Sangam] Wallpaper upload to server failed — cover will NOT show on other devices.", err);
      showToast("Upload failed — won't show on other devices. Check connection & retry.", "error");
    }
  };
  reader.readAsDataURL(input.files[0]);
  input.value = "";
}

/* ══ Skill chips ════════════════════════════════════════ */
function renderSkillChips(skills) {
  const el = document.getElementById("pe-skills-preview");
  if (!el) return;
  el.innerHTML = skills.filter(Boolean).map(s =>
    `<span class="skill-chip" onclick="removeSkill('${escHtml(s)}')" style="cursor:pointer">
      ${escHtml(s)} <span style="opacity:.45;font-size:10px;margin-left:2px">×</span>
    </span>`
  ).join("");
}
function removeSkill(skill) {
  const inp = document.getElementById("pe-skills");
  if (!inp) return;
  const skills = inp.value.split(",").map(s=>s.trim()).filter(s=>s&&s!==skill);
  inp.value = skills.join(", ");
  renderSkillChips(skills);
}
document.addEventListener("input", e => {
  if (e.target?.id === "pe-skills")
    renderSkillChips(e.target.value.split(",").map(s=>s.trim()).filter(Boolean));
});

/* ══ ID Card ═════════════════════════════════════════════ */
let currentCardType = "student";

function switchCardType(type) {
  currentCardType = type;
  document.getElementById("btn-student")?.classList.toggle("active", type==="student");
  document.getElementById("btn-alumni")?.classList.toggle("active",  type==="alumni");
  const sec = document.getElementById("alumni-section");
  if (sec) sec.style.display = type==="alumni" ? "block" : "none";
  updateIDCard();
}

function updateIDCard() {
  const u = currentUser || {};
  _set("card-name",       u.name || "Your Name");
  _set("card-batch",      `${u.branch||"CSE"} · Batch ${u.batch_year||2024}`);
  _set("card-id",         `SAG-${String(u.id||u.roll_number||"000000").padStart(6,"0").slice(-6)}`);
  _set("card-type-label", currentCardType==="alumni" ? "Alumni" : "Student");

  // ID card avatar — same server-first rule
  const cardAv = document.getElementById("card-avatar-letter");
  if (cardAv) {
    let avatarUrl = u.avatar_url ? fixUrl(u.avatar_url) : "";
    if (!avatarUrl) {
      const cached = localStorage.getItem(STORAGE_KEYS.avatar);
      if (cached) avatarUrl = fixUrl(cached);
    }
    const initial = (u.name||"A")[0].toUpperCase();
    if (avatarUrl) {
      cardAv.innerHTML = `<img src="${avatarUrl}"
        style="width:100%;height:100%;border-radius:50%;object-fit:cover"
        onerror="this.parentElement.innerHTML='${initial}'">`;
    } else {
      cardAv.textContent = initial;
    }
  }
}

function generateIDCard() {
  updateIDCard();
  const u = currentUser || {};
  const sangamID = `SAG-${String(u.id||u.roll_number||"000000").padStart(6,"0").slice(-6)}`;
  const qrData   = JSON.stringify({type:currentCardType,name:u.name,id:sangamID,roll:u.roll_number,batch:u.batch_year});
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&color=4C1D95&bgcolor=FFFFFF`;
  const sQR = document.getElementById("qr-code-small");
  const lQR = document.getElementById("qr-code-large");
  if (sQR) sQR.innerHTML = `<img src="${qrUrl}" style="width:100%;height:100%;border-radius:var(--r-sm)" alt="QR">`;
  if (lQR) lQR.innerHTML = `<img src="${qrUrl}" style="width:100%;height:100%;border-radius:var(--r-sm)" alt="QR">`;
  const modal = document.getElementById("qr-modal");
  if (modal) modal.style.display = "flex";
  showToast("QR generated!", "success");
}

function closeQRModal() {
  const m = document.getElementById("qr-modal");
  if (m) m.style.display = "none";
}

function downloadQRCode() {
  const img = document.getElementById("qr-code-large")?.querySelector("img");
  if (!img) { showToast("Generate QR first","error"); return; }
  const a = document.createElement("a");
  a.href = img.src;
  a.download = `sangam-id-${currentUser?.roll_number||"card"}.png`;
  a.click();
  showToast("Downloaded!","success");
}

/* ══ toggleEditForm kept as alias for backward compat ═══ */
function toggleEditForm() { openEditDrawer(); }

/* ══ Helpers ════════════════════════════════════════════ */
function _set(id, v) { const e=document.getElementById(id); if(e) e.textContent=v; }
function _val(id, v) { const e=document.getElementById(id); if(e) e.value=v; }
function _getv(id)   { return document.getElementById(id)?.value?.trim()||""; }