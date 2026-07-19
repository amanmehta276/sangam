"""
Auth routes
POST /api/auth/check-roll     — Step 1 login: verify roll + name, send OTP
POST /api/auth/login          — Step 2 login: verify OTP, return JWT
POST /api/auth/signup         — Step 1 signup: verify roll in CSV, send OTP
POST /api/auth/verify-signup  — Step 2 signup: verify OTP, create account
GET  /api/auth/me             — Get current user (JWT required)
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from models import users_col
from utils.csv_checker import get_student
from utils.otp import generate_otp, verify_otp
from utils.jwt_helper import create_token
from utils import login_required
from config import cfg

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

# ── helpers ──────────────────────────────────────────────
def _user_out(u: dict) -> dict:
    u["id"] = str(u.pop("_id"))
    u.pop("password", None)
    return u

# ════════════════════════════════════════════════════════
# STEP 1 — LOGIN: check roll + name → send OTP
# ════════════════════════════════════════════════════════
@auth_bp.route("/check-roll", methods=["POST"])
def check_roll():
    data = request.json or {}
    roll = (data.get("roll_number") or "").upper().strip()
    name = (data.get("name") or "").strip()

    if not roll or not name:
        return jsonify({"error": "Roll number and name required"}), 400

    # Must exist in MongoDB (registered user)
    user = users_col.find_one({"roll_number": roll})
    if not user:
        return jsonify({"error": "not_registered", "message": "Roll number not found. Please sign up first."}), 404

    # Name must loosely match (case insensitive)
    if name.lower() not in user.get("name","").lower() and user.get("name","").lower() not in name.lower():
        return jsonify({"error": "Name does not match our records"}), 400

    mobile = user.get("mobile","")
    try:
        otp = generate_otp(roll, "login")
    except ValueError as e:
        return jsonify({"error": str(e)}), 429

    resp = {
        "ok":             True,
        "mobile_masked":  mobile[-4:].rjust(10, "X") if mobile else "XXXXXXXXXX",
    }
    # dev_otp is ONLY ever included when OTP_MODE=console (local dev).
    # In production (sms/email mode) the OTP is delivered out-of-band and
    # must never appear in the API response — this was leaking here before.
    if cfg.OTP_MODE == "console":
        resp["dev_otp"] = otp
    return jsonify(resp)

# ════════════════════════════════════════════════════════
# STEP 2 — LOGIN: verify OTP → JWT
# ════════════════════════════════════════════════════════
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    roll = (data.get("roll_number") or "").upper().strip()
    otp  = (data.get("otp") or "").strip()

    if not roll or not otp:
        return jsonify({"error": "Roll number and OTP required"}), 400

    ok, msg = verify_otp(roll, otp, "login")
    if not ok:
        return jsonify({"error": msg}), 400

    user = users_col.find_one({"roll_number": roll})
    if not user:
        return jsonify({"error": "User not found"}), 404

    token = create_token(str(user["_id"]), roll, user.get("role","student"))
    return jsonify({"token": token, "user": _user_out(user)})

# ════════════════════════════════════════════════════════
# STEP 1 — SIGNUP: verify roll in CSV → send OTP
# ════════════════════════════════════════════════════════
@auth_bp.route("/signup", methods=["POST"])
def signup_step1():
    data   = request.json or {}
    roll   = (data.get("roll_number") or "").upper().strip()
    name   = (data.get("name") or "").strip()
    mobile = (data.get("mobile") or "").strip()

    if not roll or not name:
        return jsonify({"error": "Roll number and name required"}), 400

    # Check CSV
    student = get_student(roll)
    if not student:
        return jsonify({"error": "Roll number not found in college records"}), 404

    # Already registered?
    if users_col.find_one({"roll_number": roll}):
        return jsonify({"error": "already_registered", "message": "Account already exists. Please sign in."}), 409

    # Use CSV mobile if not provided
    if not mobile:
        mobile = student.get("mobile","")

    if not mobile:
        return jsonify({"error": "Mobile number required (not found in records)"}), 400

    try:
        otp = generate_otp(roll, "signup")
    except ValueError as e:
        return jsonify({"error": str(e)}), 429

    resp = {
        "ok":             True,
        "name":           student.get("name") or name,
        "branch":         student.get("branch",""),
        "batch_year":     student.get("batch_year",""),
        "role":           student.get("role","student"),
        "mobile_masked":  mobile[-4:].rjust(10,"X"),
    }
    if cfg.OTP_MODE == "console":
        resp["dev_otp"] = otp
    return jsonify(resp)

# ════════════════════════════════════════════════════════
# STEP 2 — SIGNUP: verify OTP → create user → JWT
# ════════════════════════════════════════════════════════
@auth_bp.route("/verify-signup", methods=["POST"])
def signup_step2():
    data   = request.json or {}
    roll   = (data.get("roll_number") or "").upper().strip()
    otp    = (data.get("otp") or "").strip()
    name   = (data.get("name") or "").strip()
    mobile = (data.get("mobile") or "").strip()

    if not roll or not otp:
        return jsonify({"error": "Roll number and OTP required"}), 400

    ok, msg = verify_otp(roll, otp, "signup")
    if not ok:
        return jsonify({"error": msg}), 400

    student = get_student(roll)
    if not student:
        return jsonify({"error": "Invalid roll number"}), 400

    # Build user document
    now  = datetime.datetime.utcnow()
    user = {
        "roll_number":   roll,
        "name":          name or student.get("name",""),
        "mobile":        mobile or student.get("mobile",""),
        "branch":        student.get("branch",""),
        "batch_year":    student.get("batch_year",""),
        "role":          student.get("role","student"),
        "trust_level":   "new",
        "bio":           "",
        "company":       "",
        "location":      "",
        "skills":        [],
        "linkedin_url":  "",
        "github_url":    "",
        "email":         "",
        "phone":         "",
        "avatar_url":    "",
        "wallpaper_url": "",
        "created_at":    now,
        "updated_at":    now,
    }

    result = users_col.insert_one(user)
    user["_id"] = result.inserted_id

    token = create_token(str(result.inserted_id), roll, user["role"])
    return jsonify({"token": token, "user": _user_out(user)}), 201

# ════════════════════════════════════════════════════════
# GET /api/auth/me
# ════════════════════════════════════════════════════════
@auth_bp.route("/me", methods=["GET"])
@login_required
def me():
    uid  = request.current_user.get("sub")
    user = users_col.find_one({"_id": ObjectId(uid)})
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(_user_out(user))
