/* api.js — Centralised API client
   FIX BUG 11: AuthAPI updated to match new backend endpoints.
   Old /auth/verify-credentials and /auth/login no longer exist.
   New flow: verify-roll → send-otp → signup (signup)
             check-roll  → login-otp → login-verify (login)
*/

const API_BASE = "http://localhost:5000/api";

// ── Token management ──────────────────────────────────────────
const Auth = {
  getToken:   ()  => localStorage.getItem("sangam_token"),
  setToken:   (t) => localStorage.setItem("sangam_token", t),
  getUser:    ()  => JSON.parse(localStorage.getItem("sangam_user") || "null"),
  setUser:    (u) => localStorage.setItem("sangam_user", JSON.stringify(u)),
  clear:      ()  => { localStorage.removeItem("sangam_token"); localStorage.removeItem("sangam_user"); },
  isLoggedIn: ()  => !!localStorage.getItem("sangam_token"),
};

// ── Base fetch wrapper ────────────────────────────────────────
async function apiCall(path, options = {}) {
  const token = Auth.getToken();
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: isFormData ? options.body
        : options.body ? JSON.stringify(options.body)
        : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw { status: res.status, message: data.error || "Request failed", data };
  }
  return data;
}

// ── Auth API — FIXED ENDPOINTS ────────────────────────────────
const AuthAPI = {
  // SIGNUP STEP 1: verify roll number + name against college DB (CSV)
  verifyRoll: (roll, name) =>
    apiCall("/auth/verify-roll", { method: "POST", body: { roll_number: roll, name } }),

  // SIGNUP STEP 2: send OTP to mobile
  sendOtp: (roll, mobile) =>
    apiCall("/auth/send-otp", { method: "POST", body: { roll_number: roll, mobile } }),

  // SIGNUP STEP 3: verify OTP + create account
  signup: (payload) =>
    apiCall("/auth/signup", { method: "POST", body: payload }),

  // LOGIN STEP 1: check if roll is registered in MongoDB
  checkRoll: (roll, name) =>
    apiCall("/auth/check-roll", { method: "POST", body: { roll_number: roll, name } }),

  // LOGIN STEP 2: send OTP to registered mobile
  loginOtp: (roll) =>
    apiCall("/auth/login-otp", { method: "POST", body: { roll_number: roll } }),

  // LOGIN STEP 3: verify OTP → get JWT
  loginVerify: (roll, otp) =>
    apiCall("/auth/login-verify", { method: "POST", body: { roll_number: roll, otp } }),

  // Resend OTP
  resendOtp: (roll) =>
    apiCall("/auth/resend-otp", { method: "POST", body: { roll_number: roll } }),

  // Get current logged-in user
  me: () => apiCall("/auth/me"),
};

// ── Posts API ─────────────────────────────────────────────────
const PostsAPI = {
  list:   (type)    => apiCall(`/posts/${type ? `?type=${type}` : ""}`),
  create: (payload) => apiCall("/posts/", { method: "POST", body: payload }),
  like:   (id)      => apiCall(`/posts/${id}/like`, { method: "POST" }),
};

// ── Users API ─────────────────────────────────────────────────
const UsersAPI = {
  list:   (params = {}) => apiCall(`/users/?${new URLSearchParams(params)}`),
  get:    (id)          => apiCall(`/users/${id}`),
  update: (payload)     => apiCall("/users/me", { method: "PATCH", body: payload }),
  uploadAvatar: (file)  => {
    const fd = new FormData();
    fd.append("file", file);
    return apiCall("/users/me/avatar", { method: "POST", body: fd });
  },
};

// ── Jobs API ──────────────────────────────────────────────────
const JobsAPI = {
  list:   (params = {}) => apiCall(`/jobs/?${new URLSearchParams(params)}`),
  create: (payload)     => apiCall("/jobs/", { method: "POST", body: payload }),
};

// ── Chat API ──────────────────────────────────────────────────
const ChatAPI = {
  rooms:       ()             => apiCall("/chat/rooms"),
  getMessages: (room, before) => apiCall(`/chat/messages?room=${room}${before ? `&before=${before}` : ""}`),
  sendMessage: (room, msg)    => apiCall("/chat/messages", { method: "POST", body: { room, content: msg } }),
  startDM:     (roll)         => apiCall("/chat/dm/start", { method: "POST", body: { roll_number: roll } }),
  createGroup: (name, rolls)  => apiCall("/chat/group/create", { method: "POST", body: { name, member_rolls: rolls } }),
  searchUsers: (q)            => apiCall(`/chat/users/search?q=${encodeURIComponent(q)}`),
  uploadFile: (file, room)    => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("room", room);
    return apiCall("/chat/upload", { method: "POST", body: fd });
  },
};

// ── Notifications API ─────────────────────────────────────────
const NotifsAPI = {
  list:    ()  => apiCall("/notifications/"),
  readAll: ()  => apiCall("/notifications/read-all", { method: "POST" }),
};

// ── Toast helper ──────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = "info", duration = 2600) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.classList.remove("show", "success", "error", "warning", "info");
  t.textContent = msg;
  t.classList.add("show", type);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), duration);
}