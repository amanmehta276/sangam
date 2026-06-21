# Summary — Changes Made

## 1. `dashboard.css`

**Problem:** On mobile, the "Sangam ID Card" and "People you may know" cards were appearing at the **top** instead of the bottom.

**Root cause:** An existing rule was:
```css
@media(max-width:680px){
  .profile-body{grid-template-columns:1fr}
  .profile-right{order:-1}
}
```
`order:-1` pushes that block to the *front* — the opposite of what was wanted.

**Fix:** Replaced it with:
```css
@media(max-width:900px){
  .profile-body{
    grid-template-columns:1fr;
    display:flex;
    flex-direction:column;
  }
  .profile-left{order:1}
  .profile-right{order:2}
}
```
- `.profile-left` (Identity, About, Experience, Skills, Links) now comes first.
- `.profile-right` (ID Card + People You May Know) now comes **last**.
- Switched to `display:flex` (instead of relying on grid alone) so the order is respected reliably across phones/zoom levels.
- Breakpoint widened from 680px → 900px for safer mobile coverage.
- **Desktop/laptop layout (>900px) is untouched** — same two-column layout as before.

## 2. `profile.js`

**Problem:** Cover photo (and avatar) uploaded from laptop didn't show up on phone.

**Root cause:**
- On upload, the code saved the image to `localStorage` immediately (device-only storage) and only *tried* to also save it to the server. If the server upload failed, the error was swallowed silently — toast still said "saved ✓", so there was no signal anything was wrong, and the photo only ever lived in that one browser's `localStorage`.
- `fixUrl()` only handled paths starting with `/uploads/` — any other relative format from the backend wasn't converted to a full URL correctly.

**Fixes:**
- `fixUrl()` now normalizes **any** relative path the backend returns into a full absolute URL.
- `loadProfile()` / `updateIDCard()` now **always prefer the server's `avatar_url` / `wallpaper_url`** over `localStorage`. `localStorage` is only used as a temporary fallback before the first successful sync.
- `uploadAvatar()` / `uploadWallpaper()`: local `dataUrl` is now only used for an *instant preview*, never saved to `localStorage` as the final value. Only the server's returned URL gets cached.
- If the server upload fails, it's no longer hidden — the toast now says **"Upload failed — won't show on other devices"**, and the real error is logged to the browser console (`console.error`), so the actual cause (network/CORS/backend issue) can be diagnosed instead of silently appearing to "work."
- `saveProfile()` (bio/company/skills/etc.) got the same treatment — failure now shows a clear error toast instead of a misleading success message.

## 3. `dashboard.html`

No functional changes — provided as-is so all three files are in one consistent set for you to deploy together.

---

**Action needed from you:** Re-upload a fresh cover photo/avatar after deploying — old uploads that only made it to `localStorage` won't retroactively sync; only new uploads will go through the corrected flow.