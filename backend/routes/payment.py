"""
Payment routes
POST /api/payment/create-subscription  — logged-in user starts a subscription
POST /api/payment/webhook              — Razorpay -> server confirmation (no auth header, verified via signature)

Price shown to user: base plan + 18% GST added on top (Scenario B).
Amounts in Razorpay are always in paise (1 rupee = 100 paise).
"""
import os
import hmac
import hashlib
import razorpay
from flask import Blueprint, request, jsonify

from models import users_col
from models.subscription import Subscription
from utils import login_required
from config import cfg

payment_bp = Blueprint("payment", __name__, url_prefix="/api/payment")

client = razorpay.Client(auth=(cfg.RAZORPAY_KEY_ID, cfg.RAZORPAY_KEY_SECRET))

# ── Server-side plan whitelist ──────────────────────────────
# NEVER accept price/amount from the client — only a plan_id, checked
# against this fixed list. Add the real Razorpay plan_id here after
# creating the plan on the Razorpay dashboard.
PLAN_CONFIG = {
    "plan_REPLACE_WITH_REAL_ID": {
        "name":         "Monthly Membership",
        "base_amount":  99.00,
        "gst_amount":   17.82,
        "total_amount": 116.82,
    },
}

# ════════════════════════════════════════════════════════
# Step 1 — create a subscription for the logged-in user
# ════════════════════════════════════════════════════════
@payment_bp.route("/create-subscription", methods=["POST"])
@login_required
def create_subscription():
    data = request.json or {}
    plan_id = data.get("plan_id")

    if plan_id not in PLAN_CONFIG:
        return jsonify({"error": "Invalid plan"}), 400

    uid = request.current_user.get("sub")
    plan = PLAN_CONFIG[plan_id]

    subscription = client.subscription.create({
        "plan_id":         plan_id,
        "customer_notify": 1,
        "total_count":     12,
        "notes":           {"user_id": uid},
    })

    Subscription.create_pending(uid, subscription["id"], plan_id)

    return jsonify({
        "subscription_id": subscription["id"],
        "key_id":           cfg.RAZORPAY_KEY_ID,
        "display": {
            "base_amount":  plan["base_amount"],
            "gst_amount":   plan["gst_amount"],
            "total_amount": plan["total_amount"],
        },
    })

# ════════════════════════════════════════════════════════
# Cancel — user-initiated cancellation
# ════════════════════════════════════════════════════════
@payment_bp.route("/cancel-subscription", methods=["POST"])
@login_required
def cancel_subscription():
    uid = request.current_user.get("sub")
    sub = Subscription.find_active_for_user(uid)

    if not sub:
        return jsonify({"error": "No active subscription found"}), 404

    client.subscription.cancel(sub["razorpay_subscription_id"])
    # DB status updates when the "subscription.cancelled" webhook arrives —
    # not here, so we never trust the client alone for state changes.
    return jsonify({"status": "cancellation requested"})

# ════════════════════════════════════════════════════════
# Status — for the profile page to show Member / Not a member
# ════════════════════════════════════════════════════════
@payment_bp.route("/my-subscription", methods=["GET"])
@login_required
def my_subscription():
    uid = request.current_user.get("sub")
    sub = Subscription.find_active_for_user(uid)

    if not sub:
        return jsonify({"active": False})

    return jsonify({
        "active":  True,
        "plan_id": sub["plan_id"],
        "status":  sub["status"],
    })

# ════════════════════════════════════════════════════════
# Step 2 — Razorpay webhook (source of truth, not the client)
# ════════════════════════════════════════════════════════
@payment_bp.route("/webhook", methods=["POST"])
def razorpay_webhook():
    signature = request.headers.get("X-Razorpay-Signature", "")
    payload   = request.get_data()

    expected = hmac.new(
        cfg.RAZORPAY_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        return jsonify({"error": "Invalid signature"}), 400

    event      = request.json or {}
    event_type = event.get("event", "")

    try:
        sub_entity = event["payload"]["subscription"]["entity"]
        razorpay_sub_id = sub_entity["id"]
    except (KeyError, TypeError):
        return jsonify({"error": "Malformed payload"}), 400

    if event_type == "subscription.activated":
        Subscription.set_status(razorpay_sub_id, "active")
        _sync_user_flag(razorpay_sub_id, "active")

    elif event_type == "subscription.charged":
        Subscription.set_status(razorpay_sub_id, "active")
        _sync_user_flag(razorpay_sub_id, "active")

    elif event_type in ("subscription.cancelled", "subscription.halted", "subscription.completed"):
        Subscription.set_status(razorpay_sub_id, "cancelled")
        _sync_user_flag(razorpay_sub_id, "inactive")

    return jsonify({"status": "ok"}), 200


def _sync_user_flag(razorpay_sub_id: str, status: str) -> None:
    """Mirror the subscription state onto the user doc for quick reads
    (e.g. showing a 'Member' badge without joining collections)."""
    sub = Subscription.find_by_razorpay_id(razorpay_sub_id)
    if not sub:
        return
    users_col.update_one(
        {"_id": sub["user_id"]},
        {"$set": {"subscription_status": status}},
    )