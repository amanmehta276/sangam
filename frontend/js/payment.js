/* ============================================================
   payment.js — Dashboard "Association Membership" card
   Shows the user's membership status (from /api/membership/me).
   Actual payment happens on pages/membership.html (Razorpay checkout there).
   Needs: api.js (Auth, _api, showToast)
   ============================================================ */

const _fmtMemDate = iso => iso
  ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  : "";

/* Load current membership status and update the card. */
async function loadMembershipStatus() {
  const offerEl  = document.getElementById("membership-offer");
  const activeEl = document.getElementById("membership-active");
  const badgeEl  = document.getElementById("membership-badge");
  const textEl   = document.getElementById("membership-active-text");
  if (!offerEl || !Auth.isLoggedIn()) return;

  try {
    const res = await _api("/membership/me");
    const m = res.membership;

    if (m && m.status === "active") {
      offerEl.style.display  = "none";
      activeEl.style.display = "block";
      badgeEl.style.display  = "inline-flex";
      badgeEl.lastChild.textContent = ` ${m.plan_name}`;
      if (textEl) {
        textEl.textContent = m.expires_at
          ? `You are a ${m.plan_name}. Valid till ${_fmtMemDate(m.expires_at)}.`
          : `You are a ${m.plan_name} — lifetime membership. Thank you for supporting the association!`;
      }
    } else {
      offerEl.style.display  = "block";
      activeEl.style.display = "none";
      badgeEl.style.display  = "none";
    }
  } catch (e) {
    console.warn("[Sangam] Could not load membership status.", e);
  }
}

/* Go to the membership page (choose a plan / renew / upgrade). */
function subscribeMembership() {
  window.location.href = "membership.html";
}

loadMembershipStatus();