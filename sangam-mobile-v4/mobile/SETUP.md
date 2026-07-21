# Sangam Mobile — Setup Guide

This is a React Native (Expo Router, SDK 54) app that talks to the same
Sangam backend as the web app. It mirrors every feature: auth (roll + OTP),
feed, alumni directory, jobs, chat (polling-based, same as web), and
profile.

## What's in this zip

```
app/
├── _layout.tsx           Root layout — switches between auth and main app
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/
│   ├── _layout.tsx        Bottom tab bar
│   ├── index.tsx          Feed
│   ├── alumni.tsx         Alumni/student directory
│   ├── jobs.tsx           Jobs board
│   ├── chat.tsx           Conversation list
│   └── profile.tsx        Your own profile
├── chat/[roomId].tsx      A single conversation (polling every 4s)
└── profile/[roll].tsx     View someone else's profile

components/
├── Avatar.tsx
├── PostCard.tsx
├── AlumniCard.tsx
├── JobCard.tsx
├── ChatBubble.tsx
└── EmptyState.tsx

constants/
├── api.ts        API client — CHANGE API_BASE here to your Render URL
└── theme.ts       Same professional blue/slate palette as the web app

hooks/
└── useAuth.tsx    Login state, persisted via AsyncStorage
```

## How to merge this into your existing `mobile/` project

You already ran `npx create-expo-app mobile` and have `node_modules/`,
`package.json`, `app.json`, `tsconfig.json` set up — **don't delete those**.
Just copy these folders into your existing `mobile/` folder, overwriting
the default `app/` folder that Expo generated:

1. Delete the default `app/` folder Expo created (the one with
   `(tabs)/index.tsx`, `(tabs)/explore.tsx`, `+not-found.tsx`) — you're
   replacing it entirely with the one in this zip.
2. Copy `app/`, `components/`, `constants/`, `hooks/` from this zip into
   your `mobile/` folder root (same level as your existing `package.json`).

## Install the extra dependencies this code needs

```bash
cd mobile
npx expo install @react-native-async-storage/async-storage
npm install axios
```

(`expo-router`, `@expo/vector-icons`, and `expo-status-bar` already come
with the default template — no need to install those again.)

## ⚠️ One thing you MUST change before running

**`constants/api.ts`** — line near the top:

```ts
export const API_BASE = "https://sangam-xxxx.onrender.com/api";
```

Replace with your actual Render backend URL. This is the mobile
equivalent of `frontend/js/api.js`'s `API_BASE` — the one place that
decides which backend the app talks to.

**No CORS changes needed on the backend** — CORS only applies to
browsers. A native mobile app's HTTP requests aren't subject to it, so
you don't need to add anything to `app.py`'s CORS list for this to work.

## Run it

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (same as before).
You should land on the login screen — enter a roll number that's in
your backend's `students.csv`, and if your backend has `OTP_MODE=console`,
the OTP will show up in an alert on-screen (as well as in your Render/
local terminal logs).

## Logo / app icon (new)

This update adds `assets/images/`:
- `icon.png` — app icon (shown on home screen)
- `adaptive-icon.png` — Android adaptive icon foreground
- `splash-icon.png` — splash screen image
- `favicon.png` — web favicon
- `logo-mark.png` — used inside the login/signup screens directly

**Copy `assets/images/*` into your existing `assets/images/` folder,
overwriting the default Expo ones.**

Then open your existing `app.json` and point these keys at the new files
(exact key names depend on your Expo SDK version — for SDK 54 it's
usually):

```json
{
  "expo": {
    "icon": "./assets/images/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#1E293B"
      }
    },
    "web": {
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/images/splash-icon.png",
        "backgroundColor": "#0C0C0F"
      }]
    ]
  }
}
```

Don't overwrite your whole `app.json` — just merge these specific keys in
(your `name`, `slug`, `scheme`, `bundleIdentifier` etc. should stay as-is).
After changing `app.json`, restart with `npx expo start -c` (icon/splash
changes need a full restart, not just fast refresh).

## Debugging "Couldn't send OTP — Not found"

This means the app successfully reached your Flask backend, but the
**specific route wasn't found** — it's not a network problem, it's a
URL/path mismatch. The error message now tells you the exact failing URL
(this update improved `constants/api.ts` to surface it instead of a bare
"Not found").

Checklist:
1. Open `constants/api.ts` and confirm `API_BASE` is your **real** Render
   URL with `/api` at the end, e.g. `https://sangam-abc123.onrender.com/api`
   — not the `sangam-xxxx` placeholder.
2. Test the backend directly in a browser: visit
   `https://<your-render-url>/api/health` — you should see
   `{"status":"ok"}`. If you get a 404 or nothing loads, the backend
   itself isn't reachable at that URL (wrong URL, or the service is
   asleep/crashed on Render — check Render's logs).
3. Run `npx expo start -c` (not just `npx expo start`) after changing
   `api.ts` — Metro can cache the old value otherwise.
4. Next time you hit an error, the Alert text will now include the full
   URL that was called — compare it against what `/api/health` needed to
   work, and the mismatch should be obvious.

## Notes on what's intentionally simple


- **Chat polls every 4 seconds** (same architecture as the web app) — no
  push notifications, no typing indicators, no read receipts. If you add
  WebSocket/real-time later, `constants/api.ts`'s `ChatAPI` object and
  `app/chat/[roomId].tsx` are the only files that would need to change.
- **No avatar/cover upload screen yet** — profile editing here only
  covers bio and skills (text fields), since the backend's photo upload
  issue (Render's ephemeral disk resetting on redeploy) hasn't been
  fixed yet. Add an upload screen once that's sorted on the backend side.
- **Job posting** is only shown to users whose `role` is `alumni`,
  `teacher`, or `admin` — same rule as the web app.
