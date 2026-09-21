"""
Auth routes (Sangam ID + password, no OTP / CSV check)
POST /api/auth/signup  — name + branch + batch + roll no + password -> Sangam ID generated, account created, JWT returned
POST /api/auth/login   — Sangam ID + password -> JWT
GET  /api/auth/me      — current user (JWT required)

Sangam ID format: BRANCH + YEAR + ROLL  (e.g. CSE22101)
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime
import re
from werkzeug.security import generate_password_hash, check_password_hash

from models import users_col
from utils.jwt_helper import create_token
from utils import login_required

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

BRANCHES = {"CSE", "EEE", "ETC", "ME", "CE", "DS"}
SANGAM_ID_RE = re.compile(r"^[A-Z]{2,6}\d{4,10}$")

def _user_out(u: dict) -> dict:
    u["id"] = str(u.pop("_id"))
    u.pop("password", None)
    return u

# ════════════════════════════════════════════════════════
# SIGNUP: name + branch + batch + roll no + password → Sangam ID generated → JWT
# ════════════════════════════════════════════════════════
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data   = request.json or {}
    name   = (data.get("name") or "").strip()
    branch = (data.get("branch") or "").upper().strip()
    batch  = str(data.get("batch_year") or "").strip()
    roll_no = str(data.get("roll_no") or "").strip()
    password = data.get("password") or ""

    if not name or not branch or not batch or not roll_no or not password:
        return jsonify({"error": "Name, branch, batch, roll number and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if branch not in BRANCHES:
        return jsonify({"error": "Please select a valid branch"}), 400

    if not re.fullmatch(r"\d{4}", batch) or not (2000 <= int(batch) <= 2100):
        return jsonify({"error": "Enter a valid batch year (e.g. 2022)"}), 400

    if not re.fullmatch(r"\d{1,4}", roll_no):
        return jsonify({"error": "Enter a valid roll number (digits only)"}), 400

    # Sangam ID = BRANCH + last 2 digits of batch + roll (3 digits) → e.g. CSE22101
    roll = f"{branch}{batch[2:]}{roll_no.zfill(3)}"

    if not SANGAM_ID_RE.match(roll):
        return jsonify({"error": "Could not generate a valid Sangam ID"}), 400

    if users_col.find_one({"roll_number": roll}):
        return jsonify({"error": "already_registered", "message": "Account already exists. Please sign in."}), 409

    now  = datetime.datetime.utcnow()
    user = {
        "roll_number":   roll,
        "password":      generate_password_hash(password),
        "name":          name,
        "mobile":        "",
        "branch":        branch,
        "batch_year":    batch,
        "role":          "student",
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
# LOGIN: Sangam ID + password → JWT
# ════════════════════════════════════════════════════════
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    roll = (data.get("roll_number") or "").upper().strip()
    password = data.get("password") or ""

    if not roll or not password:
        return jsonify({"error": "Sangam ID and password required"}), 400

    user = users_col.find_one({"roll_number": roll})
    if not user:
        return jsonify({"error": "not_registered", "message": "Sangam ID not found. Please sign up first."}), 404

    if not user.get("password"):
        return jsonify({"error": "no_password", "message": "This account has no password set. Please contact admin."}), 403

    if not check_password_hash(user["password"], password):
        return jsonify({"error": "wrong_password", "message": "Wrong password. Try again."}), 401

    token = create_token(str(user["_id"]), roll, user.get("role", "student"))
    return jsonify({"token": token, "user": _user_out(user)})

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