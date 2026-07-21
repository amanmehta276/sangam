// constants/api.ts
//
// Single place that decides which backend the app talks to — same idea
// as frontend/js/api.js on the web. Change API_BASE here only.
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ⚠️ CHANGE THIS to your actual Render backend URL
export const API_BASE = "https://sangam-z93f.onrender.com/api";

export const TOKEN_KEY = "sangam_token";
export const USER_KEY  = "sangam_user";

const client = axios.create({ baseURL: API_BASE, timeout: 60000 });

// Attach JWT to every request automatically
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap axios errors into a plain message string (mirrors web's _api() behavior).
// Includes the failing URL + status in dev so mismatched API_BASE / wrong
// routes are obvious from the Alert text instead of a bare "Not found".
function unwrap(err: any): never {
  const status = err?.response?.status;
  const serverMsg = err?.response?.data?.error;
  const url = (err?.config?.baseURL || "") + (err?.config?.url || "");

  if (!err?.response) {
    // No response at all = DNS/network failure, not a route problem
    throw new Error(`Network error — couldn't reach ${url || API_BASE}. Check API_BASE and your internet connection.`);
  }
  if (status === 404) {
    throw new Error(`404 Not Found at ${url} — check this route exists on the backend and API_BASE is correct.`);
  }
  throw new Error(serverMsg || err?.message || "Something went wrong");
}

/* ── Auth ─────────────────────────────────────────────── */
export const AuthAPI = {
  checkRoll: async (roll_number: string, name: string) => {
    try { return (await client.post("/auth/check-roll", { roll_number, name })).data; }
    catch (e) { unwrap(e); }
  },
  login: async (roll_number: string, otp: string) => {
    try { return (await client.post("/auth/login", { roll_number, otp })).data; }
    catch (e) { unwrap(e); }
  },
  signup: async (roll_number: string, name: string, mobile: string) => {
    try { return (await client.post("/auth/signup", { roll_number, name, mobile })).data; }
    catch (e) { unwrap(e); }
  },
  verifySignup: async (roll_number: string, otp: string, name: string, mobile: string) => {
    try { return (await client.post("/auth/verify-signup", { roll_number, otp, name, mobile })).data; }
    catch (e) { unwrap(e); }
  },
  me: async () => {
    try { return (await client.get("/auth/me")).data; }
    catch (e) { unwrap(e); }
  },
};

/* ── Users ────────────────────────────────────────────── */
export const UsersAPI = {
  list: async (params: Record<string, string> = {}) => {
    try { return (await client.get("/users", { params })).data; }
    catch (e) { unwrap(e); }
  },
  get: async (roll: string) => {
    try { return (await client.get(`/users/${roll}`)).data; }
    catch (e) { unwrap(e); }
  },
  updateMe: async (data: Record<string, any>) => {
    try { return (await client.put("/users/me", data)).data; }
    catch (e) { unwrap(e); }
  },
};

/* ── Posts (Feed) ─────────────────────────────────────── */
export const PostsAPI = {
  list: async () => {
    try { return (await client.get("/posts")).data; }
    catch (e) { unwrap(e); }
  },
  create: async (data: { post_type: string; content: string; tags?: string[] }) => {
    try { return (await client.post("/posts", data)).data; }
    catch (e) { unwrap(e); }
  },
  like: async (id: string) => {
    try { return (await client.post(`/posts/${id}/like`)).data; }
    catch (e) { unwrap(e); }
  },
  remove: async (id: string) => {
    try { return (await client.delete(`/posts/${id}`)).data; }
    catch (e) { unwrap(e); }
  },
};

/* ── Jobs ─────────────────────────────────────────────── */
export const JobsAPI = {
  list: async (params: Record<string, string> = {}) => {
    try { return (await client.get("/jobs", { params })).data; }
    catch (e) { unwrap(e); }
  },
  create: async (data: Record<string, any>) => {
    try { return (await client.post("/jobs", data)).data; }
    catch (e) { unwrap(e); }
  },
  remove: async (id: string) => {
    try { return (await client.delete(`/jobs/${id}`)).data; }
    catch (e) { unwrap(e); }
  },
};

/* ── Chat (polling-based, same as web) ───────────────────── */
export const ChatAPI = {
  rooms: async () => {
    try { return (await client.get("/chat/rooms")).data; }
    catch (e) { unwrap(e); }
  },
  getMessages: async (room: string, after?: string) => {
    try { return (await client.get(`/chat/messages/${room}`, { params: after ? { after } : {} })).data; }
    catch (e) { unwrap(e); }
  },
  sendMessage: async (room: string, content: string) => {
    try { return (await client.post("/chat/messages", { room, content })).data; }
    catch (e) { unwrap(e); }
  },
  createGroup: async (name: string, members: string[]) => {
    try { return (await client.post("/chat/rooms", { name, members })).data; }
    catch (e) { unwrap(e); }
  },
  startDM: async (roll: string) => {
    try { return (await client.post(`/chat/dm/${roll}`)).data; }
    catch (e) { unwrap(e); }
  },
  searchUsers: async (q: string) => {
    try { return (await client.get("/chat/search-users", { params: { q } })).data; }
    catch (e) { unwrap(e); }
  },
};

/* ── Notifications ───────────────────────────────────────── */
export const NotifsAPI = {
  list: async () => {
    try { return (await client.get("/notifications")).data; }
    catch (e) { unwrap(e); }
  },
  readAll: async () => {
    try { return (await client.post("/notifications/read")).data; }
    catch (e) { unwrap(e); }
  },
};

export default client;
