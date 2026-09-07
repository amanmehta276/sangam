/* ============================================================
   payment.js — Sangam Membership (Razorpay Subscriptions)
   ============================================================ */

// Replace with the real plan_id from Razorpay Dashboard -> Subscriptions -> Plans.
const MEMBERSHIP_PLAN_ID = "plan_REPLACE_WITH_REAL_ID";

/* Load current membership status and update the card. */
async function loadMembershipStatus() {
  const offerEl = document.getElementById("membership-offer");
  const activeEl = document.getElementById("membership-active");
  const badgeEl = document.getElementById("membership-badge");
  if (!offerEl || !Auth.isLoggedIn()) return;

  try {
    const res = await PaymentAPI.myStatus();
    if (res.active) {
      offerEl.style.display = "none";
      activeEl.style.display = "block";
      badgeEl.style.display = "inline-flex";
    } else {
      offerEl.style.display = "block";
      activeEl.style.display = "none";
      badgeEl.style.display = "none";
    }
  } catch (e) {
    console.warn("[Sangam] Could not load membership status.", e);
  }
}

/* Start a new subscription. */
async function subscribeMembership() {
  const hint = document.getElementById("membership-hint");
  try {
    const data = await PaymentAPI.createSubscription(MEMBERSHIP_PLAN_ID);

    const rzp = new Razorpay({
      key: data.key_id,
      subscription_id: data.subscription_id,
      name: "Sangam",
      description: `Membership — ₹${data.display.total_amount}/month (incl. GST)`,
      theme: { color: "#B45309" },
      handler: function () {
        if (hint) hint.style.display = "block";
        setTimeout(loadMembershipStatus, 4000);
        setTimeout(loadMembershipStatus, 9000);
      },
      modal: {
        ondismiss: function () {
          if (hint) hint.style.display = "none";
        },
      },
    });

    rzp.on("payment.failed", function () {
      showToast("Payment failed. Please try again.", "error");
    });

    rzp.open();
  } catch (e) {
    console.error("[Sangam] subscribeMembership failed", e);
    showToast(e.message || "Could not start checkout", "error");
  }
}

/* Cancel an active subscription. */
async function cancelMembership() {
  if (!confirm("Cancel your Sangam Membership? You'll keep access until the current period ends.")) return;
  try {
    await PaymentAPI.cancelSubscription();
    showToast("Cancellation requested.", "info");
    setTimeout(loadMembershipStatus, 3000);
  } catch (e) {
    console.error("[Sangam] cancelMembership failed", e);
    showToast(e.message || "Could not cancel", "error");
  }
}

loadMembershipStatus();
