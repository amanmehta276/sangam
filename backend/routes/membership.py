"""
Membership / payment routes (Razorpay)
GET  /api/membership/plans          — public list of plans
GET  /api/membership/bank-details    — public: association's bank account for direct transfer
GET  /api/membership/me             — current user's membership + paid history (JWT)
POST /api/membership/create-order   — {plan} -> Razorpay order for checkout (JWT)
POST /api/membership/verify         — {razorpay_order_id, razorpay_payment_id, razorpay_signature} (JWT)
POST /api/membership/webhook        — Razorpay webhook (backup, in case user closes tab after paying)

POST /api/membership/bank-transfer         — {plan, utr} -> submit a direct bank transfer for admin review (JWT)
GET  /api/membership/bank-transfer/pending — admin only: list transfers awaiting verification
POST /api/membership/bank-transfer/<id>/approve — admin only: verify + activate membership
POST /api/membership/bank-transfer/<id>/reject  — admin only: reject with a reason

Env vars:
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET      (required, only for the card/UPI checkout path)
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

ASSOCIATION_BANK = {
    "account_name":   "Alumni Association of CGIT Raipur",
    "account_number": "50200125101989",
    "ifsc":           "HDFC0000152",
    "bank":           "HDFC Bank",
    "branch":         "Devendra Nagar, Raipur",
    "pan":            "AAWAA9259N",
}

def admin_required(fn):
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        role = (request.current_user or {}).get("role", "")
        if role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper

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
@membership_bp.route("/bank-details", methods=["GET"])
def bank_details():
    return jsonify(ASSOCIATION_BANK)


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


# ════════════════════════════════════════════════════════
# BANK TRANSFER — user submits, admin verifies
# Money goes straight to the association's account; this just
# records the claim and lets an admin confirm + activate membership.
# ════════════════════════════════════════════════════════
@membership_bp.route("/bank-transfer", methods=["POST"])
@login_required
def submit_bank_transfer():
    data    = request.json or {}
    plan_id = (data.get("plan") or "").strip().lower()
    utr     = (data.get("utr") or "").strip()
    plan    = PLANS.get(plan_id)

    if not plan:
        return jsonify({"error": "Invalid plan"}), 400
    if not utr or len(utr) < 4:
        return jsonify({"error": "Enter the UPI/UTR/transaction reference number from your payment"}), 400

    uid  = request.current_user.get("sub")
    user = users_col.find_one({"_id": ObjectId(uid)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Don't let the same reference be submitted twice
    if payments_col.find_one({"utr": utr}):
        return jsonify({"error": "This reference number has already been submitted"}), 409

    now = _now()
    doc = {
        "user_id":     uid,
        "roll_number": user.get("roll_number", ""),
        "plan":        plan_id,
        "amount":      plan["amount"],
        "currency":    "INR",
        "method":      "bank_transfer",
        "utr":         utr,
        "status":      "pending_verification",
        "created_at":  now,
    }
    payments_col.insert_one(doc)
    return jsonify({"ok": True, "message": "Submitted! The association will verify your transfer and activate your membership shortly."}), 201


@membership_bp.route("/bank-transfer/pending", methods=["GET"])
@login_required
@admin_required
def list_pending_transfers():
    items = list(
        payments_col.find({"method": "bank_transfer", "status": "pending_verification"})
        .sort("created_at", 1)
    )
    return jsonify([{
        "id":          str(i["_id"]),
        "roll_number": i.get("roll_number", ""),
        "plan":        i["plan"],
        "plan_name":   PLANS.get(i["plan"], {}).get("name", i["plan"]),
        "amount":      i["amount"],
        "utr":         i.get("utr", ""),
        "submitted_at": _iso(i.get("created_at")),
    } for i in items])


@membership_bp.route("/bank-transfer/<item_id>/approve", methods=["POST"])
@login_required
@admin_required
def approve_bank_transfer(item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid id"}), 400

    pay = payments_col.find_one({"_id": oid, "method": "bank_transfer"})
    if not pay:
        return jsonify({"error": "Not found"}), 404
    if pay["status"] != "pending_verification":
        return jsonify({"error": f"Already {pay['status']}"}), 409

    admin_roll = request.current_user.get("roll", "")
    _apply_payment(pay, f"bank:{pay.get('utr','')}")
    payments_col.update_one({"_id": oid}, {"$set": {"verified_by": admin_roll}})
    return jsonify({"ok": True})


@membership_bp.route("/bank-transfer/<item_id>/reject", methods=["POST"])
@login_required
@admin_required
def reject_bank_transfer(item_id):
    try:
        oid = ObjectId(item_id)
    except Exception:
        return jsonify({"error": "Invalid id"}), 400

    data   = request.json or {}
    reason = (data.get("reason") or "").strip()
    admin_roll = request.current_user.get("roll", "")

    res = payments_col.update_one(
        {"_id": oid, "method": "bank_transfer", "status": "pending_verification"},
        {"$set": {"status": "rejected", "reject_reason": reason, "verified_by": admin_roll}},
    )
    if res.matched_count == 0:
        return jsonify({"error": "Not found or already processed"}), 404
    return jsonify({"ok": True})