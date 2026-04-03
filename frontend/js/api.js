/* ============================================================
   api.js — Centralised API client
   All fetch calls go through this file.
   ============================================================ */

const API_BASE = "http://localhost:5000/api";

// ── Token management ──────────────────────────────────────────
const Auth = {
  getToken:  ()  => localStorage.getItem("sangam_token"),
  setToken:  (t) => localStorage.setItem("sangam_token", t),
  getUser:   ()  => JSON.parse(localStorage.getItem("sangam_user") || "null"),
  setUser:   (u) => localStorage.setItem("sangam_user", JSON.stringify(u)),
  clear:     ()  => { localStorage.removeItem("sangam_token"); localStorage.removeItem("sangam_user"); },
  isLoggedIn:()  => !!localStorage.getItem("sangam_token"),
};

// ── Base fetch wrapper ────────────────────────────────────────
async function apiCall(path, options = {}) {
  const token = Auth.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw { status: res.status, message: data.error || "Request failed", data };
  }
  return data;
}

// ── Auth API ──────────────────────────────────────────────────
const AuthAPI = {
  checkRoll: (roll) =>
    apiCall("/auth/check-roll", { method: "POST", body: { roll_number: roll } }),

  signup: (payload) =>
    apiCall("/auth/signup", { method: "POST", body: payload }),

  login: (roll, password) =>
    apiCall("/auth/login", { method: "POST", body: { roll_number: roll, password } }),

  me: () => apiCall("/auth/me"),
};

// ── Posts API ─────────────────────────────────────────────────
const PostsAPI = {
  list:   (type)    => apiCall(`/posts/${type ? `?type=${type}` : ""}`),
  create: (payload) => apiCall("/posts/", { method: "POST", body: payload }),
  like:   (id)      => apiCall(`/posts/${id}/like`, { method: "POST" }),
};

// ── Users / Alumni API ────────────────────────────────────────
const UsersAPI = {
  list:          (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/users/?${q}`);
  },
  get:           (id)      => apiCall(`/users/${id}`),
  updateProfile: (payload) => apiCall("/users/me", { method: "PATCH", body: payload }),
};

// ── Jobs API ──────────────────────────────────────────────────
const JobsAPI = {
  list:   (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiCall(`/jobs/?${q}`);
  },
  create: (payload) => apiCall("/jobs/", { method: "POST", body: payload }),
};

// ── Chat API ──────────────────────────────────────────────────
const ChatAPI = {
  rooms:    ()           => apiCall("/chat/rooms"),
  messages: (room)       => apiCall(`/chat/messages?room=${room}`),
  send:     (room, msg)  => apiCall("/chat/messages", { method: "POST", body: { room, content: msg } }),
};

// ── Notifications API ─────────────────────────────────────────
const NotifsAPI = {
  list:    ()  => apiCall("/notifications/"),
  readAll: ()  => apiCall("/notifications/read-all", { method: "POST" }),
};

// ── Toast helper (shared) ─────────────────────────────────────
let _toastTimer;
function showToast(msg, duration = 2600) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), duration);
}

// ── Redirect if not logged in ─────────────────────────────────
function requireAuth(redirectTo = "../pages/auth.html") {
  if (!Auth.isLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  Auth.clear();
  window.location.href = "../pages/auth.html";
}