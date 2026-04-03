/* ============================================================
   auth.js — Authentication page logic
   ============================================================ */

// ── Screen navigation ─────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".auth-screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ── OTP cell auto-advance ─────────────────────────────────────
function otpNext(el, idx) {
  el.classList.add("filled");
  const cells = document.querySelectorAll(".otp-cell");
  if (el.value.length >= 1 && idx < 5) cells[idx + 1].focus();
  // Auto-submit when all 6 filled
  const filled = [...cells].filter(c => c.value).length;
  if (filled === 6) {
    setTimeout(() => showToast("✅ OTP verified — creating your account…"), 300);
    setTimeout(() => doSignup(), 1200);
  }
}

// ── Password visibility toggle ────────────────────────────────
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  btn.textContent = input.type === "password" ? "👁" : "🙈";
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 5000);
}

// ══════════════════════════════════════════
//  LOGIN FLOW
// ══════════════════════════════════════════

let _loginRollData = null;

async function checkRollForLogin() {
  const roll = document.getElementById("login-roll")?.value.trim().toUpperCase();
  if (!roll) { showToast("Enter your roll number"); return; }

  try {
    const res = await AuthAPI.checkRoll(roll);

    if (res.already_registered) {
      // Show password step
      _loginRollData = res.student_info || {};
      document.getElementById("login-av").textContent = roll[0].toUpperCase();
      document.getElementById("login-name").textContent = _loginRollData.name || roll;
      document.getElementById("login-meta").textContent =
        `${_loginRollData.branch || ""} · Batch ${_loginRollData.batch_year || ""}`;
      document.getElementById("login-step1").classList.add("hidden");
      document.getElementById("login-step2").classList.remove("hidden");
      document.getElementById("login-notfound").classList.add("hidden");
    } else if (res.found_in_master) {
      // In DB but not registered
      document.getElementById("login-step1").classList.add("hidden");
      document.getElementById("login-step2").classList.add("hidden");
      document.getElementById("login-notfound").classList.remove("hidden");
      _loginRollData = { roll, ...res.student_info };
    } else {
      showError("login-error", "Roll number not found in our database. Contact admin.");
    }
  } catch (err) {
    showError("login-error", err.message || "Something went wrong");
  }
}

async function doLogin() {
  const roll = document.getElementById("login-roll")?.value.trim().toUpperCase();
  const pass = document.getElementById("login-pass")?.value;
  if (!pass) { showToast("Enter your password"); return; }

  try {
    const res = await AuthAPI.login(roll, pass);
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showToast("✅ Welcome back, " + res.user.name + "!");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 800);
  } catch (err) {
    if (err.status === 401) {
      showError("login-error", "Incorrect password. Try again.");
    } else {
      showError("login-error", err.message);
    }
  }
}

// Pre-fill signup from login flow
function prefillSignup() {
  showScreen("s-signup");
  if (_loginRollData) {
    const rollEl = document.getElementById("su-roll");
    if (rollEl) rollEl.value = _loginRollData.roll || "";
    setTimeout(() => checkRollForSignup(), 100);
  }
}

// ══════════════════════════════════════════
//  SIGNUP FLOW
// ══════════════════════════════════════════

let _signupRollData = null;

async function checkRollForSignup() {
  const roll = document.getElementById("su-roll")?.value.trim().toUpperCase();
  if (!roll) { showToast("Enter your roll number"); return; }

  try {
    const res = await AuthAPI.checkRoll(roll);

    if (res.already_registered) {
      showError("signup-error", "This roll number is already registered. Please login.");
      showScreen("s-login");
      document.getElementById("login-roll").value = roll;
      return;
    }

    if (!res.found_in_master) {
      showError("signup-error", "Roll number not found in college database. Contact admin if this is wrong.");
      return;
    }

    // Pre-fill from master data
    _signupRollData = res.student_info || {};
    document.getElementById("su-found-msg").textContent =
      `✅ Roll verified: ${_signupRollData.name || roll}`;
    document.getElementById("su-name").value  = _signupRollData.name  || "";
    document.getElementById("su-branch").value = _signupRollData.branch || "";
    document.getElementById("su-batch").value  = _signupRollData.batch_year || "";

    document.getElementById("signup-step-label").textContent = "STEP 2 / 3";
    document.getElementById("signup-s1").classList.add("hidden");
    document.getElementById("signup-s2").classList.remove("hidden");
    document.getElementById("signup-s3").classList.add("hidden");

  } catch (err) {
    showError("signup-error", err.message || "Error checking roll number");
  }
}

function goToOtp() {
  const name  = document.getElementById("su-name")?.value.trim();
  const email = document.getElementById("su-email")?.value.trim();
  const pass  = document.getElementById("su-pass")?.value;

  if (!name) { showToast("Enter your name"); return; }
  if (!pass || pass.length < 6) { showToast("Password must be 6+ characters"); return; }

  const emailShow = email || `${name.toLowerCase().replace(/\s/g,".")}@cit.edu`;
  document.getElementById("otp-email-display").textContent = emailShow;
  document.getElementById("signup-step-label").textContent = "STEP 3 / 3";
  document.getElementById("signup-s2").classList.add("hidden");
  document.getElementById("signup-s3").classList.remove("hidden");

  showToast("📧 OTP sent! (demo: any 6 digits will work)");
}

async function doSignup() {
  const roll   = document.getElementById("su-roll")?.value.trim().toUpperCase();
  const name   = document.getElementById("su-name")?.value.trim();
  const email  = document.getElementById("su-email")?.value.trim();
  const pass   = document.getElementById("su-pass")?.value;
  const role   = document.getElementById("su-role")?.value || "student";

  try {
    const res = await AuthAPI.signup({ roll_number: roll, name, email, password: pass, role });
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showToast("🎉 Account created! Welcome to Sangam!");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1000);
  } catch (err) {
    showError("signup-error", err.message || "Sign up failed");
    // Fall back to demo mode
    showToast("🔧 Demo mode: entering app without server...");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1200);
  }
}

// ── Demo mode: enter app if no backend ───────────────────────
// This lets you see the UI without running Python
(function checkDemoMode() {
  if (window.location.search.includes("demo=1")) {
    setTimeout(() => { window.location.href = "dashboard.html"; }, 300);
  }
})();