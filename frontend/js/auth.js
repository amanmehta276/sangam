/* ============================================================
   js/api.js — Sangam Complete API Layer
   Every backend endpoint wired — auth, profile, posts,
   jobs, chat, uploads, notifications
   ============================================================ */

const API_BASE = "http://localhost:5000/api";

/* ════════════════════════════════════════
   AUTH STORAGE
════════════════════════════════════════ */
const Auth = {
  getToken:    ()  => localStorage.getItem("sangam_token"),
  setToken:    (t) => localStorage.setItem("sangam_token", t),
  getUser:     ()  => { try { return JSON.parse(localStorage.getItem("sangam_user") || "null"); } catch { return null; } },
  setUser:     (u) => localStorage.setItem("sangam_user", JSON.stringify(u)),
  clear:       ()  => { localStorage.removeItem("sangam_token"); localStorage.removeItem("sangam_user"); },
  isLoggedIn:  ()  => !!localStorage.getItem("sangam_token"),
};

/* ════════════════════════════════════════
   BASE FETCH
════════════════════════════════════════ */
async function _fetch(path, opts = {}) {
  const token = Auth.getToken();
  const isFormData = opts.body instanceof FormData;

  const headers = {
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers || {}),
  };

  const config = {
    method:  opts.method || "GET",
    headers,
    body: opts.body
      ? (isFormData ? opts.body : JSON.stringify(opts.body))
      : undefined,
  };

  try {
    const res  = await fetch(`${API_BASE}${path}`, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, message: data.error || "Request failed", data };
    return data;
  } catch (err) {
    if (err.status) throw err;
    throw { status: 0, message: "Server nahi mila. Backend chal raha hai?", data: {} };
  }
}

/* ════════════════════════════════════════
   AUTH API
════════════════════════════════════════ */
const AuthAPI = {
  verifyRoll:  (roll_number, name, mobile = "") =>
    _fetch("/auth/verify-roll",  { method: "POST", body: { roll_number, name, mobile } }),

  signup:      (roll_number, name, otp, mobile = "") =>
    _fetch("/auth/signup",       { method: "POST", body: { roll_number, name, otp, mobile } }),

  checkRoll:   (roll_number, name) =>
    _fetch("/auth/check-roll",   { method: "POST", body: { roll_number, name } }),

  loginVerify: (roll_number, otp) =>
    _fetch("/auth/login-verify", { method: "POST", body: { roll_number, otp } }),

  resendOtp:   (roll_number)  =>
    _fetch("/auth/resend-otp",   { method: "POST", body: { roll_number } }),

  // loginOtp is same as checkRoll – used in auth.js
  loginOtp:    (roll_number)  =>
    _fetch("/auth/check-roll",   { method: "POST", body: { roll_number, name: window._loginName || "" } }),

  me: () => _fetch("/auth/me"),

  logout: async () => {
    try { await _fetch("/auth/logout", { method: "POST" }); } catch {}
    Auth.clear();
    window.location.href = window.location.pathname.includes("pages") ? "auth.html" : "pages/auth.html";
  },
};

/* ════════════════════════════════════════
   USERS API  (profile + uploads)
════════════════════════════════════════ */
const UsersAPI = {

  // Get my full profile
  me: () => _fetch("/users/me"),

  // ── Update profile (LinkedIn-style) ──────────────────
  update: (payload) =>
    _fetch("/users/me", { method: "PUT", body: payload }),

  // ── Upload avatar photo ───────────────────────────────
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append("file", file);
    return _fetch("/users/me/avatar", { method: "POST", body: form });
  },

  // ── Upload wallpaper / cover ──────────────────────────
  uploadWallpaper: async (file) => {
    const form = new FormData();
    form.append("file", file);
    return _fetch("/users/me/wallpaper", { method: "POST", body: form });
  },

  // Alumni directory
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return _fetch(`/users${qs ? "?" + qs : ""}`);
  },
};

/* ════════════════════════════════════════
   POSTS API
════════════════════════════════════════ */
const PostsAPI = {
  list:   (filter) => {
    const qs = filter ? `?type=${filter}` : "";
    return _fetch(`/posts${qs}`);
  },
  create: (payload) => _fetch("/posts", { method: "POST", body: payload }),
  like:   (id)      => _fetch(`/posts/${id}/like`, { method: "POST" }),
};

/* ════════════════════════════════════════
   JOBS API
════════════════════════════════════════ */
const JobsAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return _fetch(`/jobs${qs ? "?" + qs : ""}`);
  },
  create: (payload)     => _fetch("/jobs", { method: "POST", body: payload }),
  apply:  (id)          => _fetch(`/jobs/${id}/apply`, { method: "POST" }),
};

/* ════════════════════════════════════════
   CHAT API
════════════════════════════════════════ */
const ChatAPI = {
  rooms:       ()           => _fetch("/chat/rooms"),
  getMessages: (room)       => _fetch(`/chat/rooms/${room}/messages`),
  sendMessage: (room, content, reply_to = null) =>
    _fetch(`/chat/rooms/${room}/messages`, { method: "POST", body: { content, reply_to } }),
  startDM:     (roll)       => _fetch("/chat/dm/start",       { method: "POST", body: { roll_number: roll } }),
  createGroup: (name, members) =>
    _fetch("/chat/groups", { method: "POST", body: { name, members } }),
  searchUsers: (q)          => _fetch(`/chat/search-users?q=${encodeURIComponent(q)}`),
  uploadFile:  async (file, room) => {
    const form = new FormData();
    form.append("file", file);
    form.append("room", room);
    return _fetch("/chat/upload", { method: "POST", body: form });
  },
};

/* ════════════════════════════════════════
   NOTIFICATIONS API
════════════════════════════════════════ */
const NotifsAPI = {
  list:    ()   => _fetch("/notifications"),
  readAll: ()   => _fetch("/notifications/read-all", { method: "POST" }),
  read:    (id) => _fetch(`/notifications/${id}/read`, { method: "POST" }),
};

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
function showToast(message, type = "success") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent  = message;
  toast.className    = `toast show ${type}`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}