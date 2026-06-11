# # routes/users.py
# from flask import Blueprint, request, jsonify
# from bson import ObjectId
# from config.database import get_db
# from middleware.auth_middleware import token_required, user_to_dict
# from services.upload_service import handle_upload

# users_bp = Blueprint("users", __name__)


# @users_bp.route("/", methods=["GET"])
# @token_required
# def list_users(current_user):
#     role = request.args.get("role"); branch = request.args.get("branch")
#     q    = request.args.get("q","")
#     filt = {}
#     if role:   filt["role"]   = role
#     if branch: filt["branch"] = branch
#     if q:
#         filt["$or"] = [{"name":{"$regex":q,"$options":"i"}},
#                        {"roll_number":{"$regex":q,"$options":"i"}}]
#     users = list(get_db().users.find(filt).sort("created_at",-1).limit(50))
#     return jsonify([user_to_dict(u) for u in users])


# @users_bp.route("/<uid>", methods=["GET"])
# @token_required
# def get_user(current_user, uid):
#     u = get_db().users.find_one({"_id": ObjectId(uid)})
#     if not u: return jsonify({"error":"User not found"}), 404
#     return jsonify(user_to_dict(u))


# @users_bp.route("/me", methods=["PATCH"])
# @token_required
# def update_profile(current_user):
#     """Full profile edit: bio, skills, links, company, semester, etc."""
#     data = request.get_json() or {}
#     db   = get_db()

#     allowed = ["bio","linkedin_url","github_url","company","email","semester",
#                "phone","location","graduation_year","alumni_position","alumni_company"]
#     update  = {}
#     for f in allowed:
#         if f in data:
#             update[f] = data[f]

#     if "skills" in data:
#         v = data["skills"]
#         update["skills"] = v if isinstance(v,list) else [s.strip() for s in v.split(",") if s.strip()]

#     if update.get("linkedin_url"):
#         update["trust_level"] = "verified"

#     if update:
#         db.users.update_one({"_id": current_user["_id"]}, {"$set": update})

#     updated = db.users.find_one({"_id": current_user["_id"]})
#     return jsonify(user_to_dict(updated, public=False))


# @users_bp.route("/me/avatar", methods=["POST"])
# @token_required
# def upload_avatar(current_user):
#     """Upload profile picture."""
#     if "file" not in request.files:
#         return jsonify({"error":"No file"}), 400
#     result = handle_upload(request.files["file"], subfolder="avatars")
#     if not result["ok"]:
#         return jsonify({"error": result["error"]}), 400
#     get_db().users.update_one(
#         {"_id": current_user["_id"]},
#         {"$set": {"avatar_url": result["url"]}}
#     )
#     return jsonify({"avatar_url": result["url"]})





















"""
routes/users.py
Profile edit + avatar + wallpaper upload — fully working
"""

import os
import uuid
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import get_jwt_identity
from PIL import Image
from utils.token import auth_required
from models.user import find_user_by_roll, get_db, update_trust, safe_user
from datetime import datetime

users_bp = Blueprint("users", __name__)

UPLOAD_FOLDER   = os.path.join(os.path.dirname(__file__), "..", "uploads")
AVATAR_FOLDER   = os.path.join(UPLOAD_FOLDER, "avatars")
WALLPAPER_FOLDER= os.path.join(UPLOAD_FOLDER, "wallpapers")
ALLOWED_IMG     = {"png", "jpg", "jpeg", "gif", "webp"}
MAX_SIZE_MB     = 5

os.makedirs(AVATAR_FOLDER,    exist_ok=True)
os.makedirs(WALLPAPER_FOLDER, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_IMG


def compress_image(path, max_px=800):
    """Resize + compress image so it's not huge."""
    try:
        img = Image.open(path)
        img = img.convert("RGB")
        img.thumbnail((max_px, max_px), Image.LANCZOS)
        img.save(path, "JPEG", quality=82, optimize=True)
    except Exception as e:
        print(f"[Image] compress error: {e}")


def get_base_url():
    return request.host_url.rstrip("/")


# ════════════════════════════════════════
#  GET /api/users/me  — current user
# ════════════════════════════════════════
@users_bp.route("/api/users/me", methods=["GET"])
@auth_required
def get_me():
    roll = get_jwt_identity()["roll"]
    user = find_user_by_roll(roll)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(safe_user(user)), 200


# ════════════════════════════════════════
#  PUT /api/users/me  — update profile (LinkedIn style)
# ════════════════════════════════════════
@users_bp.route("/api/users/me", methods=["PUT"])
@auth_required
def update_profile():
    roll = get_jwt_identity()["roll"]
    data = request.get_json() or {}

    # Allowed fields to update
    ALLOWED = [
        "bio", "company", "role_title", "location",
        "linkedin_url", "github_url", "portfolio_url",
        "email", "phone", "skills",
        "graduation_year", "alumni_position", "alumni_company",
        "headline",
    ]

    update_doc = {"updated_at": datetime.utcnow()}

    for field in ALLOWED:
        if field in data:
            val = data[field]
            # Skills: accept list or comma-string
            if field == "skills":
                if isinstance(val, str):
                    val = [s.strip() for s in val.split(",") if s.strip()]
                update_doc["skills"] = val
            elif isinstance(val, str):
                update_doc[field] = val.strip()
            else:
                update_doc[field] = val

    # LinkedIn added → trust boost
    if "linkedin_url" in update_doc and update_doc["linkedin_url"]:
        update_doc["linkedin_added"] = True

    db = get_db()
    db.users.update_one(
        {"roll_number": roll},
        {"$set": update_doc}
    )

    user = find_user_by_roll(roll)
    updated = update_trust(roll)
    user.update(updated)

    return jsonify({
        "message": "Profile updated!",
        "user":    safe_user(user),
    }), 200


# ════════════════════════════════════════
#  POST /api/users/me/avatar  — upload profile photo
# ════════════════════════════════════════
@users_bp.route("/api/users/me/avatar", methods=["POST"])
@auth_required
def upload_avatar():
    roll = get_jwt_identity()["roll"]

    if "file" not in request.files:
        return jsonify({"error": "No file sent. Use field name 'file'"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": f"Only {', '.join(ALLOWED_IMG)} allowed"}), 400
    if len(file.read()) > MAX_SIZE_MB * 1024 * 1024:
        return jsonify({"error": f"File too large. Max {MAX_SIZE_MB}MB"}), 400
    file.seek(0)

    ext      = file.filename.rsplit(".", 1)[1].lower()
    filename = f"{roll.lower()}_{uuid.uuid4().hex[:8]}.jpg"
    path     = os.path.join(AVATAR_FOLDER, filename)

    file.save(path)
    compress_image(path, max_px=400)

    avatar_url = f"{get_base_url()}/uploads/avatars/{filename}"

    db = get_db()
    db.users.update_one(
        {"roll_number": roll},
        {"$set": {"avatar_url": avatar_url, "updated_at": datetime.utcnow()}}
    )

    return jsonify({
        "message":    "Avatar uploaded!",
        "avatar_url": avatar_url,
    }), 200


# ════════════════════════════════════════
#  POST /api/users/me/wallpaper  — upload cover/wallpaper
# ════════════════════════════════════════
@users_bp.route("/api/users/me/wallpaper", methods=["POST"])
@auth_required
def upload_wallpaper():
    roll = get_jwt_identity()["roll"]

    if "file" not in request.files:
        return jsonify({"error": "No file sent. Use field name 'file'"}), 400

    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file"}), 400
    if len(file.read()) > MAX_SIZE_MB * 1024 * 1024:
        return jsonify({"error": "File too large. Max 5MB"}), 400
    file.seek(0)

    filename = f"wall_{roll.lower()}_{uuid.uuid4().hex[:8]}.jpg"
    path     = os.path.join(WALLPAPER_FOLDER, filename)

    file.save(path)
    compress_image(path, max_px=1200)

    wallpaper_url = f"{get_base_url()}/uploads/wallpapers/{filename}"

    db = get_db()
    db.users.update_one(
        {"roll_number": roll},
        {"$set": {"wallpaper_url": wallpaper_url, "updated_at": datetime.utcnow()}}
    )

    return jsonify({
        "message":      "Wallpaper uploaded!",
        "wallpaper_url": wallpaper_url,
    }), 200


# ════════════════════════════════════════
#  GET /uploads/* — serve uploaded files
# ════════════════════════════════════════
@users_bp.route("/uploads/avatars/<filename>")
def serve_avatar(filename):
    return send_from_directory(AVATAR_FOLDER, filename)


@users_bp.route("/uploads/wallpapers/<filename>")
def serve_wallpaper(filename):
    return send_from_directory(WALLPAPER_FOLDER, filename)


# ════════════════════════════════════════
#  GET /api/users  — list users (alumni directory)
# ════════════════════════════════════════
@users_bp.route("/api/users", methods=["GET"])
@auth_required
def list_users():
    db     = get_db()
    params = request.args

    query  = {"is_active": True}
    if params.get("role"):    query["type"] = params["role"]
    if params.get("branch"):  query["branch"] = {"$regex": params["branch"], "$options": "i"}
    if params.get("q"):
        q = params["q"]
        query["$or"] = [
            {"name":    {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"skills":  {"$regex": q, "$options": "i"}},
        ]

    users = list(db.users.find(query, {
        "_id":1,"name":1,"roll_number":1,"branch":1,"batch_year":1,
        "type":1,"company":1,"skills":1,"trust_level":1,
        "avatar_url":1,"linkedin_url":1,"bio":1,"role_title":1,
    }).limit(50))

    for u in users:
        u["_id"] = str(u["_id"])

    return jsonify(users), 200