"""
User / Profile routes
GET    /api/users              — List users (alumni directory)
GET    /api/users/:roll        — Get one user
PUT    /api/users/me           — Update my profile
POST   /api/users/me/avatar    — Upload avatar
POST   /api/users/me/wallpaper — Upload cover/wallpaper
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from models import users_col
from utils import login_required
from utils.upload_helper import save_image

users_bp = Blueprint("users", __name__, url_prefix="/api/users")

def _out(u):
    if not u: return None
    u["id"] = str(u.pop("_id"))
    u.pop("password", None)
    return u

# ── List / search users ───────────────────────────────────
@users_bp.route("", methods=["GET"])
@login_required
def list_users():
    q      = request.args.get("q","").strip()
    role   = request.args.get("role","")
    branch = request.args.get("branch","")
    limit  = min(int(request.args.get("limit",50)), 100)

    filt = {}
    if role:   filt["role"]   = role
    if branch: filt["branch"] = branch
    if q:
        filt["$or"] = [
            {"name":         {"$regex": q, "$options": "i"}},
            {"roll_number":  {"$regex": q, "$options": "i"}},
            {"company":      {"$regex": q, "$options": "i"}},
            {"skills":       {"$elemMatch": {"$regex": q, "$options": "i"}}},
        ]

    users = list(users_col.find(filt, {"password":0}).limit(limit))
    return jsonify([_out(u) for u in users])

# ── Get one user by roll ─────────────────────────────────
@users_bp.route("/<roll>", methods=["GET"])
@login_required
def get_user(roll):
    u = users_col.find_one({"roll_number": roll.upper()}, {"password":0})
    if not u:
        return jsonify({"error": "User not found"}), 404
    return jsonify(_out(u))

# ── Update my profile ────────────────────────────────────
@users_bp.route("/me", methods=["PUT"])
@login_required
def update_me():
    uid  = request.current_user.get("sub")
    data = request.json or {}

    allowed = [
        "bio","company","location","skills",
        "linkedin_url","github_url","email","phone",
        "graduation_year","alumni_position","alumni_company",
    ]
    update = {k: data[k] for k in allowed if k in data}

    # Skills — ensure list
    if "skills" in update:
        if isinstance(update["skills"], str):
            update["skills"] = [s.strip() for s in update["skills"].split(",") if s.strip()]

    update["updated_at"] = datetime.datetime.utcnow()

    users_col.update_one({"_id": ObjectId(uid)}, {"$set": update})
    user = users_col.find_one({"_id": ObjectId(uid)}, {"password":0})
    return jsonify(_out(user))

# ── Upload avatar ─────────────────────────────────────────
@users_bp.route("/me/avatar", methods=["POST"])
@login_required
def upload_avatar():
    uid  = request.current_user.get("sub")
    file = request.files.get("file") or request.files.get("avatar")
    if not file:
        return jsonify({"error": "No file provided"}), 400
    try:
        url = save_image(file, "avatars", max_px=400)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    users_col.update_one(
        {"_id": ObjectId(uid)},
        {"$set": {"avatar_url": url, "updated_at": datetime.datetime.utcnow()}}
    )
    return jsonify({"avatar_url": url})

# ── Upload wallpaper ──────────────────────────────────────
@users_bp.route("/me/wallpaper", methods=["POST"])
@login_required
def upload_wallpaper():
    uid  = request.current_user.get("sub")
    file = request.files.get("file") or request.files.get("wallpaper")
    if not file:
        return jsonify({"error": "No file provided"}), 400
    try:
        url = save_image(file, "wallpapers", max_px=1920)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    users_col.update_one(
        {"_id": ObjectId(uid)},
        {"$set": {"wallpaper_url": url, "updated_at": datetime.datetime.utcnow()}}
    )
    return jsonify({"wallpaper_url": url})
