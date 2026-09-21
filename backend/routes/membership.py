"""
Membership / payment routes (Razorpay)
GET  /api/membership/plans          — public list of plans
GET  /api/membership/me             — current user's membership + paid history (JWT)
POST /api/membership/create-order   — {plan} -> Razorpay order for checkout (JWT)
POST /api/membership/verify         — {razorpay_order_id, razorpay_payment_id, razorpay_signature} (JWT)
POST /api/membership/webhook        — Razorpay webhook (backup, in case user closes tab after paying)

Env vars:
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET      (required)
  RAZORPAY_WEBHOOK_SECRET                   (optional, only for /webhook)

Prices live ONLY here (server side) — the client never sends an amount.
"""
import os
import hmac
import json
import base64
import hashlib
import datetime
import urllib.request
import urllib.error

from bson import ObjectId
from flask import Blueprint, request, jsonify

from models import users_col
from utils import login_required

membership_bp = Blueprint("membership", __name__, url_prefix="/api/membership")
payments_col  = users_col.database["payments"]

# ── Plans (amount in ₹) — from the association's Rules & Regulations ──
PLANS = {
    "general":  {"name": "General Member",  "amount": 1500,  "duration_days": 365,
                 "desc": "Yearly subscription. Renew every year to stay a member.", "rank": 1},
    "lifetime": {"name": "Lifetime Member", "amount": 5000,  "duration_days": None,
                 "desc": "One-time contribution. Member for life.", "rank": 2},
    "patron":   {"name": "Patron Member",   "amount": 11000, "duration_days": None,
                 "desc": "One-time contribution. Lifetime member and custodian of the committee.", "rank": 3},
}

def _now():
    return datetime.datetime.utcnow()

def _keys():
    return os.getenv("RAZORPAY_KEY_ID", ""), os.getenv("RAZORPAY_KEY_SECRET", "")

def _iso(d):
    return d.isoformat() + "Z" if d else None

# ── Razorpay order creation (plain HTTPS, no SDK needed) ─────────────
def _rzp_create_order(payload: dict) -> dict:
    key_id, key_secret = _keys()
    auth = base64.b64encode(f"{key_id}:{key_secret}".encode()).decode()
    req = urllib.request.Request(
        "https://api.razorpay.com/v1/orders",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode(errors="ignore"))
    except Exception as e:
        raise RuntimeError(str(e))

# ── membership helpers ───────────────────────────────────
def _active_membership(user):
    m = (user or {}).get("membership") or {}
    if m.get("status") != "active":
        return None
    exp = m.get("expires_at")
    if exp is not None and exp <= _now():
        return None
    return m

def _membership_out(m):
    if not m:
        return None
    plan = PLANS.get(m.get("plan"), {})
    exp = m.get("expires_at")
    return {
        "plan":       m.get("plan"),
        "plan_name":  plan.get("name", m.get("plan")),
        "status":     "active" if (exp is None or exp > _now()) else "expired",
        "started_at": _iso(m.get("started_at")),
        "expires_at": _iso(exp),          # null = lifetime
    }

def _apply_payment(pay: dict, payment_id: str):
    """Mark payment paid + activate membership. Safe to call twice (verify + webhook)."""
    now = _now()
    res = payments_col.update_one(
        {"_id": pay["_id"], "status": {"$ne": "paid"}},
        {"$set": {"status": "paid", "payment_id": payment_id, "paid_at": now}},
    )
    if res.modified_count == 0:
        return  # already processed

    plan = PLANS[pay["plan"]]
    uid  = ObjectId(pay["user_id"])
    user = users_col.find_one({"_id": uid}) or {}

    expires = None
    if plan["duration_days"]:
        base = now
        cur = user.get("membership") or {}
        # renewing early? extend from current expiry instead of losing days
        if cur.get("plan") == "general" and cur.get("expires_at") and cur["expires_at"] > now:
            base = cur["expires_at"]
        expires = base + datetime.timedelta(days=plan["duration_days"])

    users_col.update_one({"_id": uid}, {"$set": {
        "membership": {
            "plan": pay["plan"], "status": "active",
            "started_at": now, "expires_at": expires, "payment_id": payment_id,
        },
        "updated_at": now,
    }})

# ════════════════════════════════════════════════════════
@membership_bp.route("/plans", methods=["GET"])
def plans():
    return jsonify([
        {"id": k, "name": v["name"], "amount": v["amount"], "desc": v["desc"],
         "period": "year" if v["duration_days"] else "one-time"}
        for k, v in sorted(PLANS.items(), key=lambda kv: kv[1]["rank"])
    ])

@membership_bp.route("/me", methods=["GET"])
@login_required
def my_membership():
    uid  = request.current_user.get("sub")
    user = users_col.find_one({"_id": ObjectId(uid)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    history = payments_col.find({"user_id": uid, "status": "paid"}).sort("paid_at", -1)
    return jsonify({
        "membership": _membership_out(user.get("membership")),
        "payments": [{
            "plan": p["plan"], "plan_name": PLANS.get(p["plan"], {}).get("name", p["plan"]),
            "amount": p["amount"], "paid_at": _iso(p.get("paid_at")), "payment_id": p.get("payment_id"),
        } for p in history],
    })

@membership_bp.route("/create-order", methods=["POST"])
@login_required
def create_order():
    key_id, key_secret = _keys()
    if not key_id or not key_secret:
        return jsonify({"error": "Payments are not configured yet. Please try later."}), 503

    data = request.json or {}
    plan_id = (data.get("plan") or "").strip().lower()
    plan = PLANS.get(plan_id)
    if not plan:
        return jsonify({"error": "Invalid plan"}), 400

    uid  = request.current_user.get("sub")
    user = users_col.find_one({"_id": ObjectId(uid)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    cur = _active_membership(user)
    if cur:
        cur_rank = PLANS.get(cur["plan"], {}).get("rank", 0)
        if plan["rank"] < cur_rank or (plan["rank"] == cur_rank and plan_id != "general"):
            return jsonify({"error": "already_member",
                            "message": f"You are already a {PLANS[cur['plan']]['name']}."}), 409

    try:
        order = _rzp_create_order({
            "amount":   plan["amount"] * 100,      # paise
            "currency": "INR",
            "receipt":  f"sg_{uid[-8:]}_{int(_now().timestamp())}",
            "notes":    {"roll_number": user.get("roll_number", ""), "plan": plan_id},
        })
    except RuntimeError as e:
        print("Razorpay order error:", e)
        return jsonify({"error": "Could not start payment. Please try again."}), 502

    payments_col.insert_one({
        "order_id": order["id"], "user_id": uid, "roll_number": user.get("roll_number", ""),
        "plan": plan_id, "amount": plan["amount"], "currency": "INR",
        "status": "created", "created_at": _now(),
    })

    return jsonify({
        "order_id": order["id"], "amount": order["amount"], "currency": order["currency"],
        "key_id": key_id, "plan": plan_id, "plan_name": plan["name"],
        "prefill": {"name": user.get("name", "")},
    })

@membership_bp.route("/verify", methods=["POST"])
@login_required
def verify():
    data       = request.json or {}
    order_id   = data.get("razorpay_order_id") or ""
    payment_id = data.get("razorpay_payment_id") or ""
    signature  = data.get("razorpay_signature") or ""
    if not order_id or not payment_id or not signature:
        return jsonify({"error": "Missing payment details"}), 400

    uid = request.current_user.get("sub")
    pay = payments_col.find_one({"order_id": order_id, "user_id": uid})
    if not pay:
        return jsonify({"error": "Order not found"}), 404

    _, key_secret = _keys()
    expected = hmac.new(key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return jsonify({"error": "Payment verification failed"}), 400

    _apply_payment(pay, payment_id)
    user = users_col.find_one({"_id": ObjectId(uid)})
    return jsonify({"ok": True, "membership": _membership_out(user.get("membership"))})

@membership_bp.route("/webhook", methods=["POST"])
def webhook():
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        return jsonify({"error": "Webhook not configured"}), 503

    raw = request.get_data()
    sig = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return jsonify({"error": "Invalid signature"}), 400

    event = json.loads(raw or b"{}")
    if event.get("event") in ("payment.captured", "order.paid"):
        ent = (event.get("payload", {}).get("payment", {}) or {}).get("entity", {}) or {}
        pay = payments_col.find_one({"order_id": ent.get("order_id")})
        if pay and ent.get("amount") == pay["amount"] * 100:
            _apply_payment(pay, ent.get("id"))
    return jsonify({"ok": True})