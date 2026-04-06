/* auth.js — Complete authentication flow
   Bugs fixed:
   - doVerifyRoll, doSendSignupOtp, doSignup all defined
   - doCheckRoll, doSendLoginOtp, doLoginVerify all defined
   - Element IDs match auth.html exactly
   - otpBack() backspace navigation added
   - Dev OTP banner shown in page
   - Correct redirect to dashboard.html
*/

let _signupRoll = "";
let _signupName = "";
let _loginRoll  = "";

/* ── Screen navigation ─────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll(".auth-screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 6000);
}

function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? "0.65" : "1";
  if (label) btn.textContent = loading ? "Please wait…" : label;
}

/* ── OTP cell navigation ───────────────────────────────── */
function otpNext(el, idx, flow) {
  el.value = el.value.replace(/\D/g, "").slice(-1);
  if (el.value) el.classList.add("filled");
  const cls   = flow === "login" ? "login-otp-cell" : "signup-otp-cell";
  const cells = [...document.querySelectorAll(`.${cls}`)];
  if (el.value && idx < 5) cells[idx + 1].focus();
  if (cells.filter(c => c.value).length === 6) {
    setTimeout(() => flow === "login" ? doLoginVerify() : doSignup(), 350);
  }
}

function otpBack(el, e) {
  if (e.key !== "Backspace") return;
  el.value = "";
  el.classList.remove("filled");
  const all = [...el.parentElement.querySelectorAll(".otp-cell")];
  const idx = all.indexOf(el);
  if (idx > 0) all[idx - 1].focus();
}

function getOtp(cls) {
  return [...document.querySelectorAll(`.${cls}`)].map(c => c.value).join("");
}

function showDevBanner(id, otp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `DEV MODE — OTP: ${otp}`;
  el.classList.remove("hidden");
}

/* ════════════════════════════════
   SIGNUP — 3 steps
════════════════════════════════ */

async function doVerifyRoll() {
  const roll = (document.getElementById("signup-roll")?.value || "").trim().toUpperCase();
  const name = (document.getElementById("signup-name")?.value || "").trim();
  if (!roll) { showToast("Enter your roll number", "error"); return; }
  if (!name) { showToast("Enter your full name", "error"); return; }

  setLoading("btn-verify-roll", true, "Verify & Continue →");
  try {
    const res = await AuthAPI.verifyRoll(roll, name);

    if (res.already_registered) {
      showToast("Already registered! Please sign in.", "warning");
      setTimeout(() => showScreen("s-login"), 1200);
      return;
    }

    _signupRoll = roll;
    _signupName = name;

    const n = res.student_info || {};
    const el = (id) => document.getElementById(id);
    if (el("signup-mobile-masked"))   el("signup-mobile-masked").textContent   = res.mobile_masked || "your mobile";
    if (el("signup-display-name"))    el("signup-display-name").textContent    = n.name || name;
    if (el("signup-av"))              el("signup-av").textContent              = (n.name || name)[0].toUpperCase();
    if (el("signup-student-info"))    el("signup-student-info").textContent    = `${n.branch || ""} · Batch ${n.batch_year || ""}`;

    await doSendSignupOtp();
    showScreen("s-signup-otp");
  } catch (err) {
    showError("signup-error", err.message || "Verification failed. Check roll number and name.");
  } finally {
    setLoading("btn-verify-roll", false, "Verify & Continue →");
  }
}

async function doSendSignupOtp() {
  const mobile = (document.getElementById("signup-mobile")?.value || "").trim();
  try {
    const res = await AuthAPI.sendOtp(_signupRoll, mobile);
    if (res.dev_otp) {
      showDevBanner("signup-dev-otp-banner", res.dev_otp);
      const cells = [...document.querySelectorAll(".signup-otp-cell")];
      [...res.dev_otp].forEach((d, i) => { if (cells[i]) { cells[i].value = d; cells[i].classList.add("filled"); } });
    } else {
      showToast("OTP sent to your registered mobile", "success");
    }
  } catch (err) {
    showToast(err.message || "Could not send OTP", "error");
  }
}

async function doSignup() {
  const otp = getOtp("signup-otp-cell");
  if (otp.length < 6) { showToast("Enter all 6 OTP digits", "error"); return; }

  setLoading("btn-signup", true, "Create Account →");
  try {
    const res = await AuthAPI.signup({
      roll_number: _signupRoll,
      name:        _signupName,
      mobile:      (document.getElementById("signup-mobile")?.value || "").trim(),
      otp,
    });
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showToast(`Welcome, ${res.user.name}!`, "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 900);
  } catch (err) {
    showError("signup-otp-error", err.message || "Wrong OTP or expired.");
    document.querySelectorAll(".signup-otp-cell").forEach(c => { c.value = ""; c.classList.remove("filled"); });
    document.querySelector(".signup-otp-cell")?.focus();
  } finally {
    setLoading("btn-signup", false, "Create Account →");
  }
}

/* ════════════════════════════════
   LOGIN — 3 steps
════════════════════════════════ */

async function doCheckRoll() {
  const roll = (document.getElementById("login-roll")?.value || "").trim().toUpperCase();
  const name = (document.getElementById("login-name")?.value || "").trim();
  if (!roll) { showToast("Enter your roll number", "error"); return; }
  if (!name) { showToast("Enter your full name", "error"); return; }

  setLoading("btn-check-roll", true, "Continue →");
  try {
    const res = await AuthAPI.checkRoll(roll, name);
    if (res.found && res.name_match) {
      _loginRoll = roll;
      const maskedEl = document.getElementById("login-mobile-masked");
      if (maskedEl) maskedEl.textContent = res.mobile_masked || "your mobile";
      await doSendLoginOtp();
      showScreen("s-login-otp");
    }
  } catch (err) {
    const d = err.data || {};
    if (!d.found) {
      if (d.in_college_db) {
        document.getElementById("login-notfound")?.classList.remove("hidden");
      } else {
        showError("login-error", "Roll number not found. Check spelling.");
      }
    } else {
      showError("login-error", err.message || "Name doesn't match records.");
    }
  } finally {
    setLoading("btn-check-roll", false, "Continue →");
  }
}

async function doSendLoginOtp() {
  try {
    const res = await AuthAPI.loginOtp(_loginRoll);
    if (res.dev_otp) {
      showDevBanner("login-dev-otp-banner", res.dev_otp);
      const cells = [...document.querySelectorAll(".login-otp-cell")];
      [...res.dev_otp].forEach((d, i) => { if (cells[i]) { cells[i].value = d; cells[i].classList.add("filled"); } });
    } else {
      showToast("OTP sent!", "success");
    }
  } catch (err) {
    showToast(err.message || "Could not send OTP", "error");
  }
}

async function doLoginVerify() {
  const otp = getOtp("login-otp-cell");
  if (otp.length < 6) { showToast("Enter all 6 OTP digits", "error"); return; }

  setLoading("btn-login-verify", true, "Verify & Sign In →");
  try {
    const res = await AuthAPI.loginVerify(_loginRoll, otp);
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showToast(`Welcome back, ${res.user.name}!`, "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 800);
  } catch (err) {
    showError("login-otp-error", err.message || "Wrong OTP or expired.");
    document.querySelectorAll(".login-otp-cell").forEach(c => { c.value = ""; c.classList.remove("filled"); });
    document.querySelector(".login-otp-cell")?.focus();
  } finally {
    setLoading("btn-login-verify", false, "Verify & Sign In →");
  }
}

/* ── Resend OTP ─────────────────────────────────────────── */
async function resendOtp(flow) {
  const roll = flow === "login" ? _loginRoll : _signupRoll;
  if (!roll) { showToast("Start again from the beginning", "error"); return; }
  try {
    const res = await AuthAPI.resendOtp(roll);
    if (res.dev_otp) {
      const bannerId = flow === "login" ? "login-dev-otp-banner" : "signup-dev-otp-banner";
      showDevBanner(bannerId, res.dev_otp);
      const cls   = flow === "login" ? "login-otp-cell" : "signup-otp-cell";
      const cells = [...document.querySelectorAll(`.${cls}`)];
      [...res.dev_otp].forEach((d, i) => { if (cells[i]) { cells[i].value = d; cells[i].classList.add("filled"); } });
    }
    showToast("OTP resent!", "success");
  } catch {
    showToast("Could not resend OTP", "error");
  }
}

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }
  showScreen("s-splash");
});