/* ============================================================
   api.js — Sangam API Client
   Load this BEFORE auth.js and dashboard.js
   ============================================================ */

// ── Backend URL — change this to your Render URL in production
// Change ONLY here — API_ORIGIN below is derived from this automatically,
// so dashboard.js/profile.js no longer need their own hardcoded copy.
const API_BASE = (function() {
  // Agar local mein chal raha hai
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "http://localhost:5000/api";
  }
  // Production — apna Render URL yahan daalo
  return "https://sangam-z93f.onrender.com/api";
})();

// Backend root without the /api suffix — used for Socket.IO connect and
// for turning "/uploads/..." paths returned by the backend into full URLs.
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

/* ── Auth token storage ─────────────────────────────────── */
const Auth = {
  getToken:   ()  => localStorage.getItem("sangam_token"),
  setToken:   (t) => localStorage.setItem("sangam_token", t),
  getUser:    ()  => { try { return JSON.parse(localStorage.getItem("sangam_user") || "null"); } catch { return null; } },
  setUser:    (u) => localStorage.setItem("sangam_user", JSON.stringify(u)),
  clear:      ()  => { localStorage.removeItem("sangam_token"); localStorage.removeItem("sangam_user"); },
  isLoggedIn: ()  => !!localStorage.getItem("sangam_token"),
};

/* ── Base JSON fetch ────────────────────────────────────── */
async function _api(path, options = {}) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.error || "Request failed", data };
  return data;
}

/* ── File upload fetch ──────────────────────────────────── */
async function _upload(path, formData) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.error || "Upload failed" };
  return data;
}

/* ════════════════════════════════════════════════════════════
   AuthAPI
════════════════════════════════════════════════════════════ */
const AuthAPI = {
  checkRoll:    (roll_number, name) =>
    _api("/auth/check-roll", { method: "POST", body: { roll_number, name } }),

  login:        (roll_number, otp) =>
    _api("/auth/login", { method: "POST", body: { roll_number, otp } }),

  signup:       (roll_number, name, mobile) =>
    _api("/auth/signup", { method: "POST", body: { roll_number, name, mobile } }),

  verifySignup: (roll_number, otp, name, mobile) =>
    _api("/auth/verify-signup", { method: "POST", body: { roll_number, otp, name, mobile } }),

  me:           () => _api("/auth/me"),
};

/* ════════════════════════════════════════════════════════════
   UsersAPI
════════════════════════════════════════════════════════════ */
const UsersAPI = {
  list:   (params = {}) => _api("/users?" + new URLSearchParams(params)),
  get:    (roll)        => _api(`/users/${roll}`),
  update: (payload)     => _api("/users/me", { method: "PUT", body: payload }),

  uploadAvatar: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return _upload("/users/me/avatar", fd);
  },

  uploadWallpaper: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return _upload("/users/me/wallpaper", fd);
  },
};

/* ════════════════════════════════════════════════════════════
   PostsAPI
════════════════════════════════════════════════════════════ */
const PostsAPI = {
  list:   (type)    => _api("/posts" + (type ? `?type=${type}` : "")),
  create: (payload) => _api("/posts", { method: "POST", body: payload }),
  like:   (id)      => _api(`/posts/${id}/like`, { method: "POST" }),
  delete: (id)      => _api(`/posts/${id}`, { method: "DELETE" }),
};

/* ════════════════════════════════════════════════════════════
   JobsAPI
════════════════════════════════════════════════════════════ */
const JobsAPI = {
  list:   (params = {}) => _api("/jobs?" + new URLSearchParams(params)),
  create: (payload)     => _api("/jobs", { method: "POST", body: payload }),
  delete: (id)          => _api(`/jobs/${id}`, { method: "DELETE" }),
};

/* ════════════════════════════════════════════════════════════
   ChatAPI — polling-based (no websockets)
════════════════════════════════════════════════════════════ */
const ChatAPI = {
  rooms:       ()               => _api("/chat/rooms"),
  getMessages: (room, after)    => _api(`/chat/messages/${room}` + (after ? `?after=${encodeURIComponent(after)}` : "")),
  sendMessage: (room, content)  => _api("/chat/messages", { method: "POST", body: { room, content } }),
  createGroup: (name, members)  => _api("/chat/rooms", { method: "POST", body: { name, members } }),
  startDM:     (roll)           => _api(`/chat/dm/${roll}`, { method: "POST" }),
  searchUsers: (q)              => _api(`/chat/search-users?q=${encodeURIComponent(q)}`),
};

/* ════════════════════════════════════════════════════════════
   NotifsAPI
════════════════════════════════════════════════════════════ */
const NotifsAPI = {
  list:    () => _api("/notifications"),
  readAll: () => _api("/notifications/read", { method: "POST" }),
};

/* ── Global toast (used by all JS files) ────────────────── */
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}