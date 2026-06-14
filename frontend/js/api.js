/* ============================================================
   api.js — Sangam Frontend API client
   All calls go to http://localhost:5000/api
   ============================================================ */

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "https://your-backend.onrender.com/api";

/* ── Auth storage ────────────────────────────────────────── */
const Auth = {
  getToken:  ()  => localStorage.getItem("sangam_token"),
  setToken:  (t) => localStorage.setItem("sangam_token", t),
  getUser:   ()  => { try { return JSON.parse(localStorage.getItem("sangam_user")||"null"); } catch{return null;} },
  setUser:   (u) => localStorage.setItem("sangam_user", JSON.stringify(u)),
  clear:     ()  => { localStorage.removeItem("sangam_token"); localStorage.removeItem("sangam_user"); },
  isLoggedIn:()  => !!localStorage.getItem("sangam_token"),
};

/* ── Base fetch ──────────────────────────────────────────── */
async function _api(path, options = {}) {
  const token = Auth.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, message: data.error || "Request failed", data };
  return data;
}

/* ── Multipart (file upload) ─────────────────────────────── */
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
  /* Step 1 login: roll + name → OTP */
  checkRoll: (roll_number, name) =>
    _api("/auth/check-roll", { method:"POST", body:{ roll_number, name } }),

  /* Step 2 login: OTP → JWT */
  login: (roll_number, otp) =>
    _api("/auth/login", { method:"POST", body:{ roll_number, otp } }),

  /* Step 1 signup: roll + name + mobile → OTP */
  signup: (roll_number, name, mobile) =>
    _api("/auth/signup", { method:"POST", body:{ roll_number, name, mobile } }),

  /* Step 2 signup: OTP → create account + JWT */
  verifySignup: (roll_number, otp, name, mobile) =>
    _api("/auth/verify-signup", { method:"POST", body:{ roll_number, otp, name, mobile } }),

  /* Get current user */
  me: () => _api("/auth/me"),
};

/* ════════════════════════════════════════════════════════════
   UsersAPI
════════════════════════════════════════════════════════════ */
const UsersAPI = {
  list:   (params = {}) => _api("/users?" + new URLSearchParams(params)),
  get:    (roll)        => _api(`/users/${roll}`),
  update: (payload)     => _api("/users/me", { method:"PUT", body: payload }),

  uploadAvatar: (file) => {
    const fd = new FormData(); fd.append("file", file);
    return _upload("/users/me/avatar", fd);
  },
  uploadWallpaper: (file) => {
    const fd = new FormData(); fd.append("file", file);
    return _upload("/users/me/wallpaper", fd);
  },
};

/* ════════════════════════════════════════════════════════════
   PostsAPI
════════════════════════════════════════════════════════════ */
const PostsAPI = {
  list:   (type)    => _api("/posts" + (type ? `?type=${type}` : "")),
  create: (payload) => _api("/posts", { method:"POST", body: payload }),
  like:   (id)      => _api(`/posts/${id}/like`, { method:"POST" }),
  delete: (id)      => _api(`/posts/${id}`, { method:"DELETE" }),
};

/* ════════════════════════════════════════════════════════════
   JobsAPI
════════════════════════════════════════════════════════════ */
const JobsAPI = {
  list:   (params = {}) => _api("/jobs?" + new URLSearchParams(params)),
  create: (payload)     => _api("/jobs", { method:"POST", body: payload }),
  delete: (id)          => _api(`/jobs/${id}`, { method:"DELETE" }),
};

/* ════════════════════════════════════════════════════════════
   ChatAPI
════════════════════════════════════════════════════════════ */
const ChatAPI = {
  rooms:       ()          => _api("/chat/rooms"),
  getMessages: (room)      => _api(`/chat/messages/${room}`),
  sendMessage: (room, content) =>
    _api("/chat/messages", { method:"POST", body:{ room, content } }),
  createGroup: (name, members) =>
    _api("/chat/rooms", { method:"POST", body:{ name, members } }),
  startDM: (roll) =>
    _api(`/chat/dm/${roll}`, { method:"POST" }),
  searchUsers: (q) => _api(`/chat/search-users?q=${encodeURIComponent(q)}`),
  uploadFile: (file, room) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("room", room);
    return _upload("/chat/upload", fd);
  },
};

/* ════════════════════════════════════════════════════════════
   NotifsAPI
════════════════════════════════════════════════════════════ */
const NotifsAPI = {
  list:    () => _api("/notifications"),
  readAll: () => _api("/notifications/read", { method:"POST" }),
};

/* ── Toast helper (used across JS files) ─────────────────── */
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 3000);
}
