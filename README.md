# Sangam — Alumni & Student Network (CGIT Raipur)

A full-stack networking platform for CGIT Raipur's students and alumni:
a feed, an alumni/student directory, a jobs board, real-time-feeling chat,
and notifications — with roll-number + OTP login instead of passwords
(only people in the college's official roll-number list can sign up).

```
sangam-project/
├── backend/       Flask + MongoDB API
├── frontend/      Static HTML/CSS/JS (no build step, no framework)
└── render.yaml    Render deploy blueprint (see Deployment section)
```

## Features

- **Auth** — roll number + name → OTP (SMS/console) → JWT. No passwords to
  manage or leak. Signup is gated by an admin-uploaded CSV of valid roll
  numbers, so random people can't create accounts.
- **Feed** — post updates, questions, wins, events, or tips; like/unlike;
  delete your own posts.
- **Alumni/student directory** — search by name, roll number, branch, or
  skills; view any profile; message them directly from their card.
- **Jobs board** — alumni/teachers/admins post internships and jobs
  (with optional referral flag); search by title/company/location/skills.
- **Chat** — a shared "Global Chat" room everyone's in, plus 1:1 DMs and
  custom groups you create. Polling-based (see "Why polling, not
  WebSockets" below) — refreshes every 4s while a conversation is open.
- **Notifications** — system + admin broadcast notifications, unread badge.
- **Profiles** — bio, skills, socials, avatar + cover photo upload.
- **Admin panel** — view stats, promote/demote/ban users, broadcast
  notifications, re-upload the student roll-number CSV, add individual
  students by hand.

## Tech stack

- **Backend:** Flask 3, MongoDB (via PyMongo), JWT auth (PyJWT), Pillow for
  image processing (avatar/cover resizing), gunicorn for production serving.
- **Frontend:** plain HTML/CSS/JS — no build step, no bundler, no framework.
  Fetch-based API client in `js/api.js`.
- **Auth:** stateless JWT (30-day expiry), no server-side sessions.

## Why polling, not WebSockets

An earlier version of this chat used Flask-SocketIO for real-time delivery.
It was rebuilt as plain REST + polling (client asks "any new messages?"
every 4 seconds) because:
- No special gunicorn worker class needed (`eventlet`/`gevent`) — this is
  what caused most of the earlier deploy headaches on Render's free tier.
- Works identically behind any host, proxy, or serverless-ish platform —
  WebSockets need sticky sessions / compatible infra that free tiers don't
  always give you.
- Simple enough that the whole chat backend is one ~200-line file
  (`routes/chat.py`) with no separate socket-event wiring to keep in sync
  with the REST layer.

The tradeoff is up to ~4s of latency on new messages instead of instant
delivery — acceptable for a college community chat, not for something
like a competitive game. If you outgrow this, `routes/chat.py` is the only
file you'd need to touch to reintroduce WebSockets.

## How frontend and backend are connected

There is exactly **one place** that decides which backend the frontend
talks to: `frontend/js/api.js`.

```js
const API_BASE = (function() {
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return "http://localhost:5000/api";      // local dev
  }
  return "https://sangam-z93f.onrender.com/api";  // production
})();
```

Every other file (`dashboard.js`, `profile.js`) derives its backend origin
from this automatically via `API_ORIGIN` — you never hardcode a URL
anywhere else in the frontend.

On the backend side, `backend/app.py` has a matching CORS allow-list:

```python
CORS(app, origins=[cfg.FRONTEND_URL, "http://localhost:5500",
                    "http://127.0.0.1:5500", "https://cgitsangam.netlify.app",
                    "null"], supports_credentials=True)
```

**If you deploy the frontend somewhere else, add that exact origin here —
no trailing slash.** Browsers send the `Origin` header without one; a
mismatched trailing slash silently breaks CORS (this was an actual bug in
an earlier version — fixed now, but worth knowing if you add a new origin).

## Backend setup (local)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in real values, especially MONGO_URI
python app.py
```

Runs on `http://localhost:5000` by default (`PORT` in `.env`).
Health check: `GET http://localhost:5000/api/health`

**Required `.env` values** (see `.env.example` for the full template):
- `MONGO_URI` — MongoDB Atlas connection string. The app fails fast with a
  clear error if this is missing or malformed, instead of crashing with a
  raw traceback.
- `SECRET_KEY` — any long random string, used for JWT signing.
- `OTP_MODE` — `console` for local dev (OTP is returned in the API response
  and printed to the terminal, so you can log in without SMS/email set up).
  **Never set this to `console` in production** — that's how OTPs used to
  leak in API responses; it's gated behind this flag now.

## Frontend setup (local)

No build step — it's static HTML/CSS/JS. Serve it with any static server:

```bash
cd frontend
python -m http.server 5500
# open http://127.0.0.1:5500
```

Or use the VS Code "Live Server" extension (also serves on `:5500` by
default, which is why that port is in the backend's CORS list).

## Roll-number CSV (who's allowed to sign up)

`backend/data/students.csv` is the source of truth for valid roll numbers.
Required columns: `roll_number, name, branch, batch_year`. Admins can
re-upload this from the admin panel — the upload validates every row (not
just the header), so a row with a blank name/roll number is rejected with
the row number instead of being silently accepted.

## Deployment

### Backend → Render

**If you hit `ERROR: Could not open requirements file: [Errno 2] No such
file or directory: 'requirements.txt'`:** this happens because Render's
default Root Directory is the repo root, but `requirements.txt` lives in
`backend/`. Two ways to fix it:

1. **Easiest — use the included `render.yaml`:** push this whole repo to
   GitHub, then in Render choose "New → Blueprint" instead of "New → Web
   Service" and point it at the repo. `render.yaml` already sets
   `rootDir: backend` and the right build/start commands.
2. **Or manually:** in your existing Render service → Settings → Root
   Directory → set it to `backend`, and set Start Command to
   `gunicorn app:app`.

Either way, set these env vars in Render's dashboard (not committed to
git): `SECRET_KEY`, `MONGO_URI`, `FRONTEND_URL`. `OTP_MODE` should be `sms`
or `email` in production, never `console`.

### Frontend → Netlify (or similar)

Deploy the `frontend/` folder as-is (no build command needed). Update the
production URL in `api.js` (see above) to match your backend's actual
host, and add the deployed frontend URL to the backend's CORS list in
`app.py`.

## Project history / what's been fixed

- `MONGO_URI` missing/invalid → clear startup error instead of a silent
  crash or raw traceback
- OTP no longer leaks in API responses outside of local dev mode
- OTP requests are rate-limited (30s cooldown) to stop spam
- Alumni/job search on the `skills` field uses `$elemMatch` (searching an
  array with plain `$regex` used to silently return wrong results)
- Job search endpoint (`?q=`) added — the frontend search box works now
- CSV student upload validates every row, not just the header
- CORS origin trailing-slash mismatch fixed
- Render build failure (`requirements.txt` not found) fixed via
  `render.yaml` / Root Directory guidance above
- Color scheme moved from a bright purple theme to a muted professional
  blue/slate palette; heavy font-weights toned down site-wide
- Chat was removed and then rebuilt on a simpler polling architecture
  (see "Why polling, not WebSockets" above)
- Clicking a contact's name/avatar at the top of an open DM now opens
  their profile directly

## Known limitations

- If MongoDB goes down *while the app is already running* (not at
  startup), routes will error rather than degrade gracefully — full
  runtime fallback would need every route to check a connection-health
  flag, which wasn't done here to keep the change scope reasonable.
- Chat has no read receipts, typing indicators, or file attachments —
  text messages only, by design, to keep the polling model simple.
- No push notifications — the unread badge only updates while the app is
  open in a tab.
