/* ============================================================
   auth.js — Sangam Auth (no OTP)
   Signup : name + branch + batch + roll no + password -> Sangam ID generated, logged in
   Login  : Sangam ID + password -> logged in
   Depends on: api.js (only for the `Auth` token helper)
   ============================================================ */

const AUTH_API_BASE = API_BASE;   // single source of truth: js/api.js (change the backend URL only there)

const SANGAM_ID_RE = /^[A-Z]{2,6}\d{4,10}$/;

async function authPost(path, body) {
  const res  = await fetch(`${AUTH_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.message || data.error || "Request failed", data };
  return data;
}

/* ── Screen navigation ─────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll(".auth-screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

/* ── Toast ─────────────────────────────────────────────── */
function authToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3000);
}

/* ── Error display ──────────────────────────────────────── */
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

/* ── Button loading state ───────────────────────────────── */
function setLoading(btnId, loading, text = "") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._orig = btn.innerHTML;
    btn.innerHTML = `<span style="opacity:.6">Loading…</span>`;
  } else {
    btn.innerHTML = text || btn._orig || btn.innerHTML;
  }
}

const ARROW = `<i class="ti ti-arrow-right" style="font-size:14px"></i>`;

/* ═══════════════════════════════════════════════════
   LOGIN — Sangam ID only
═══════════════════════════════════════════════════ */
async function doLogin() {
  const roll     = (document.getElementById("login-roll")?.value || "").trim().toUpperCase();
  const password = document.getElementById("login-password")?.value || "";

  hideError("login-error");
  document.getElementById("login-notfound")?.classList.add("hidden");

  if (!roll || !password) {
    showError("login-error", "Please enter your Sangam ID and password.");
    return;
  }
  if (!SANGAM_ID_RE.test(roll)) {
    showError("login-error", "Invalid Sangam ID. Format: BRANCH + YEAR + ROLL (e.g. CSE22101)");
    return;
  }

  setLoading("btn-login", true);

  try {
    const res = await authPost("/auth/login", { roll_number: roll, password });
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    authToast("Welcome back! 👋", "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 700);
  } catch (err) {
    if (err?.data?.error === "not_registered") {
      document.getElementById("login-notfound")?.classList.remove("hidden");
    } else {
      showError("login-error", err?.message || "Something went wrong");
    }
  } finally {
    setLoading("btn-login", false, `Sign In ${ARROW}`);
  }
}

/* ═══════════════════════════════════════════════════
   SIGNUP — name + branch + Sangam ID
═══════════════════════════════════════════════════ */
function buildSangamId(branch, batch, rollNo) {
  if (!branch || !/^\d{4}$/.test(batch) || !/^\d{1,4}$/.test(rollNo)) return "";
  return `${branch}${batch.slice(2)}${rollNo.padStart(3, "0")}`;
}

function updateSangamId() {
  const branch = document.getElementById("signup-branch")?.value || "";
  const batch  = (document.getElementById("signup-batch")?.value  || "").trim();
  const rollNo = (document.getElementById("signup-rollno")?.value || "").trim();
  const el = document.getElementById("sangam-id-preview");
  if (el) el.textContent = `Your Sangam ID: ${buildSangamId(branch, batch, rollNo) || "—"}`;
}

async function doSignup() {
  const name     = (document.getElementById("signup-name")?.value   || "").trim();
  const branch   = (document.getElementById("signup-branch")?.value || "").trim();
  const batch    = (document.getElementById("signup-batch")?.value  || "").trim();
  const rollNo   = (document.getElementById("signup-rollno")?.value || "").trim();
  const password = document.getElementById("signup-password")?.value || "";

  hideError("signup-error");

  if (!name || !branch || !batch || !rollNo || !password) {
    showError("signup-error", "Name, branch, batch, roll number and password are required.");
    return;
  }
  if (!/^\d{4}$/.test(batch) || +batch < 2000 || +batch > 2100) {
    showError("signup-error", "Enter a valid batch year (e.g. 2022).");
    return;
  }
  if (!/^\d{1,4}$/.test(rollNo)) {
    showError("signup-error", "Enter a valid roll number (digits only).");
    return;
  }
  if (password.length < 6) {
    showError("signup-error", "Password must be at least 6 characters.");
    return;
  }

  setLoading("btn-signup", true);

  try {
    const res = await authPost("/auth/signup", { name, branch, batch_year: batch, roll_no: rollNo, password });
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    authToast(`Account created! Your Sangam ID: ${res.user.roll_number}`, "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 2500);
  } catch (err) {
    if (err?.data?.error === "already_registered") {
      showError("signup-error", "Account already exists. Please sign in.");
      setTimeout(() => showScreen("s-login"), 1800);
    } else {
      showError("signup-error", err?.message || "Something went wrong");
    }
  } finally {
    setLoading("btn-signup", false, `Create Account ${ARROW}`);
  }
}

/* ── Enter key submits the active screen ───────────────── */
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const active = document.querySelector(".auth-screen.active");
  if (active?.id === "s-login")  doLogin();
  if (active?.id === "s-signup") doSignup();
});

/* ── If already logged in AND the token is still valid -> dashboard ──
   (a stale token, e.g. user deleted / token expired, is cleared instead of bouncing
   between auth <-> dashboard) */
document.addEventListener("DOMContentLoaded", async () => {
  if (!Auth.isLoggedIn()) return;
  try {
    const res = await fetch(`${AUTH_API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${Auth.getToken()}` },
    });
    if (res.ok) {
      window.location.href = "dashboard.html";
    } else if (res.status >= 400 && res.status < 500) {
      Auth.clear();          // 401/403/404 -> token no longer valid, sign in again
    }
  } catch (e) {
    /* backend unreachable: stay on this page */
  }
});