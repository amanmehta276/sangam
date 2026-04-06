# routes/users.py
from flask import Blueprint, request, jsonify
from bson import ObjectId
from config.database import get_db
from middleware.auth_middleware import token_required, user_to_dict
from services.upload_service import handle_upload

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
@token_required
def list_users(current_user):
    role = request.args.get("role"); branch = request.args.get("branch")
    q    = request.args.get("q","")
    filt = {}
    if role:   filt["role"]   = role
    if branch: filt["branch"] = branch
    if q:
        filt["$or"] = [{"name":{"$regex":q,"$options":"i"}},
                       {"roll_number":{"$regex":q,"$options":"i"}}]
    users = list(get_db().users.find(filt).sort("created_at",-1).limit(50))
    return jsonify([user_to_dict(u) for u in users])


@users_bp.route("/<uid>", methods=["GET"])
@token_required
def get_user(current_user, uid):
    u = get_db().users.find_one({"_id": ObjectId(uid)})
    if not u: return jsonify({"error":"User not found"}), 404
    return jsonify(user_to_dict(u))


@users_bp.route("/me", methods=["PATCH"])
@token_required
def update_profile(current_user):
    """Full profile edit: bio, skills, links, company, semester, etc."""
    data = request.get_json() or {}
    db   = get_db()

    allowed = ["bio","linkedin_url","github_url","company","email","semester"]
    update  = {}
    for f in allowed:
        if f in data:
            update[f] = data[f]

    if "skills" in data:
        v = data["skills"]
        update["skills"] = v if isinstance(v,list) else [s.strip() for s in v.split(",") if s.strip()]

    if update.get("linkedin_url"):
        update["trust_level"] = "verified"

    if update:
        db.users.update_one({"_id": current_user["_id"]}, {"$set": update})

    updated = db.users.find_one({"_id": current_user["_id"]})
    return jsonify(user_to_dict(updated, public=False))


@users_bp.route("/me/avatar", methods=["POST"])
@token_required
def upload_avatar(current_user):
    """Upload profile picture."""
    if "file" not in request.files:
        return jsonify({"error":"No file"}), 400
    result = handle_upload(request.files["file"], subfolder="avatars")
    if not result["ok"]:
        return jsonify({"error": result["error"]}), 400
    get_db().users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"avatar_url": result["url"]}}
    )
    return jsonify({"avatar_url": result["url"]})