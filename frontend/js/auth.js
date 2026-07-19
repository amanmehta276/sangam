/* ============================================================
   auth.js — Sangam Auth Flow
   Depends on: api.js (loaded before this)
   Screens: s-splash → s-login → s-login-otp
            s-splash → s-signup → s-signup-otp
   ============================================================ */

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

/* ── OTP input helpers ──────────────────────────────────── */
function otpNext(el, idx, prefix) {
  el.value = el.value.replace(/\D/g, "").slice(0, 1);
  if (el.value) el.classList.add("filled");
  else el.classList.remove("filled");

  if (el.value) {
    const cells = document.querySelectorAll(`.${prefix}-otp-cell`);
    if (cells[idx + 1]) cells[idx + 1].focus();
  }
}

function otpBack(el, e) {
  if (e.key === "Backspace" && !el.value) {
    const cells = [...el.parentElement.querySelectorAll(".otp-cell")];
    const idx = cells.indexOf(el);
    if (idx > 0) cells[idx - 1].focus();
  }
}

function getOtpValue(className) {
  return [...document.querySelectorAll(`.${className}`)]
    .map(c => c.value.trim())
    .join("");
}

function clearOtp(className) {
  document.querySelectorAll(`.${className}`).forEach(c => {
    c.value = "";
    c.classList.remove("filled");
  });
}

/* ═══════════════════════════════════════════════════
   LOGIN — Step 1: Roll + Name
═══════════════════════════════════════════════════ */
async function doCheckRoll() {
  const roll = (document.getElementById("login-roll")?.value || "").trim().toUpperCase();
  const name = (document.getElementById("login-name")?.value || "").trim();

  hideError("login-error");
  document.getElementById("login-notfound")?.classList.add("hidden");

  if (!roll || !name) {
    showError("login-error", "Please enter your roll number and name.");
    return;
  }

  setLoading("btn-check-roll", true);

  try {
    const res = await AuthAPI.checkRoll(roll, name);

    // Show masked mobile
    const masked = document.getElementById("login-mobile-masked");
    if (masked) masked.textContent = res.mobile_masked || "XXXXXXXXXX";

    // Dev OTP banner
    if (res.dev_otp) {
      const banner = document.getElementById("login-dev-otp-banner");
      if (banner) {
        banner.textContent = `DEV OTP: ${res.dev_otp}`;
        banner.classList.remove("hidden");
      }
    }

    clearOtp("login-otp-cell");
    showScreen("s-login-otp");

  } catch (err) {
    const msg = err?.message || "Something went wrong";
    if (err?.data?.error === "not_registered") {
      document.getElementById("login-notfound")?.classList.remove("hidden");
    } else {
      showError("login-error", msg);
    }
  } finally {
    setLoading("btn-check-roll", false, `Continue <i class="ti ti-arrow-right" style="font-size:14px"></i>`);
  }
}

/* ═══════════════════════════════════════════════════
   LOGIN — Step 2: OTP verify
═══════════════════════════════════════════════════ */
async function doLoginVerify() {
  const roll = (document.getElementById("login-roll")?.value || "").trim().toUpperCase();
  const otp  = getOtpValue("login-otp-cell");

  hideError("login-otp-error");

  if (otp.length < 6) {
    showError("login-otp-error", "Enter the 6-digit OTP.");
    return;
  }

  setLoading("btn-login-verify", true);

  try {
    const res = await AuthAPI.login(roll, otp);
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    authToast("Welcome back! 👋", "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 800);
  } catch (err) {
    showError("login-otp-error", err?.message || "Wrong OTP. Try again.");
  } finally {
    setLoading("btn-login-verify", false, `Verify & Sign In <i class="ti ti-arrow-right" style="font-size:14px"></i>`);
  }
}

/* ═══════════════════════════════════════════════════
   SIGNUP — Step 1: Roll + Name + Mobile
═══════════════════════════════════════════════════ */
async function doVerifyRoll() {
  const roll   = (document.getElementById("signup-roll")?.value   || "").trim().toUpperCase();
  const name   = (document.getElementById("signup-name")?.value   || "").trim();
  const mobile = (document.getElementById("signup-mobile")?.value || "").trim();

  hideError("signup-error");

  if (!roll || !name) {
    showError("signup-error", "Roll number and name are required.");
    return;
  }

  setLoading("btn-verify-roll", true);

  try {
    const res = await AuthAPI.signup(roll, name, mobile);

    // Prefill info strip
    const av = document.getElementById("signup-av");
    if (av) av.textContent = (res.name || name)[0].toUpperCase();

    const dispName = document.getElementById("signup-display-name");
    if (dispName) dispName.textContent = res.name || name;

    const dispInfo = document.getElementById("signup-student-info");
    if (dispInfo) dispInfo.textContent = `${res.branch || ""} · Batch ${res.batch_year || ""} · ${res.role || "student"}`;

    const masked = document.getElementById("signup-mobile-masked");
    if (masked) masked.textContent = res.mobile_masked || "XXXXXXXXXX";

    // Dev OTP
    if (res.dev_otp) {
      const banner = document.getElementById("signup-dev-otp-banner");
      if (banner) {
        banner.textContent = `DEV OTP: ${res.dev_otp}`;
        banner.classList.remove("hidden");
      }
    }

    clearOtp("signup-otp-cell");
    showScreen("s-signup-otp");

  } catch (err) {
    const msg = err?.message || "Something went wrong";
    if (err?.data?.error === "already_registered") {
      showError("signup-error", "Account already exists. Please sign in.");
      setTimeout(() => showScreen("s-login"), 2000);
    } else {
      showError("signup-error", msg);
    }
  } finally {
    setLoading("btn-verify-roll", false, `Verify & Continue <i class="ti ti-arrow-right" style="font-size:14px"></i>`);
  }
}

/* ═══════════════════════════════════════════════════
   SIGNUP — Step 2: OTP → create account
═══════════════════════════════════════════════════ */
async function doSignup() {
  const roll   = (document.getElementById("signup-roll")?.value   || "").trim().toUpperCase();
  const name   = (document.getElementById("signup-name")?.value   || "").trim();
  const mobile = (document.getElementById("signup-mobile")?.value || "").trim();
  const otp    = getOtpValue("signup-otp-cell");

  hideError("signup-otp-error");

  if (otp.length < 6) {
    showError("signup-otp-error", "Enter the 6-digit OTP.");
    return;
  }

  setLoading("btn-signup", true);

  try {
    const res = await AuthAPI.verifySignup(roll, otp, name, mobile);
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    authToast("Account created! Welcome 🎉", "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 900);
  } catch (err) {
    showError("signup-otp-error", err?.message || "Wrong OTP. Try again.");
  } finally {
    setLoading("btn-signup", false, `Create Account <i class="ti ti-arrow-right" style="font-size:14px"></i>`);
  }
}

/* ── Resend OTP ─────────────────────────────────────────── */
async function resendOtp(type) {
  if (type === "login") {
    await doCheckRoll();
    clearOtp("login-otp-cell");
    authToast("OTP resent!", "info");
  } else {
    await doVerifyRoll();
    clearOtp("signup-otp-cell");
    authToast("OTP resent!", "info");
  }
}

/* ── Redirect if already logged in ─────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    window.location.href = "dashboard.html";
  }
});