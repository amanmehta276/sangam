"""
Posts / Feed routes
GET    /api/posts          — List posts (feed)
POST   /api/posts          — Create post
POST   /api/posts/:id/like — Like/unlike
DELETE /api/posts/:id      — Delete (own post or admin)
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from models import posts_col, users_col
from utils import login_required

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")

def _out(p):
    if "_id" in p:
        p["id"] = str(p.pop("_id"))
    # author ka avatar_url fix karo — relative URL ko absolute banao
    if "author" in p and p["author"].get("avatar_url","").startswith("/uploads/"):
        p["author"]["avatar_url"] = "https://sangam-z93f.onrender.com" + p["author"]["avatar_url"]
    return p

# ── List posts ────────────────────────────────────────────
@posts_bp.route("", methods=["GET"])
@login_required
def list_posts():
    post_type = request.args.get("type","")
    limit     = min(int(request.args.get("limit", 30)), 100)
    filt      = {}
    if post_type: filt["post_type"] = post_type

    try:
        posts = list(posts_col.find(filt).sort("created_at",-1).limit(limit))
        return jsonify([_out(p) for p in posts])
    except Exception as e:
        print(f"[posts] list error: {e}")
        return jsonify({"error": str(e)}), 500

# ── Create post ───────────────────────────────────────────
@posts_bp.route("", methods=["POST"])
@login_required
def create_post():
    uid  = request.current_user.get("sub")
    data = request.json or {}

    content   = (data.get("content") or "").strip()
    post_type = data.get("post_type","update")
    tags      = data.get("tags",[])

    if not content:
        return jsonify({"error": "Content required"}), 400

    user = users_col.find_one({"_id": ObjectId(uid)}, {"password":0})
    if not user:
        return jsonify({"error": "User not found"}), 404

    now  = datetime.datetime.utcnow()
    post = {
        "author": {
            "id":           str(user["_id"]),
            "name":         user.get("name",""),
            "roll_number":  user.get("roll_number",""),
            "branch":       user.get("branch",""),
            "batch_year":   user.get("batch_year",""),
            "role":         user.get("role","student"),
            "trust_level":  user.get("trust_level","new"),
            "avatar_url":   user.get("avatar_url",""),
        },
        "post_type":  post_type,
        "content":    content,
        "tags":       tags if isinstance(tags, list) else [],
        "likes":      0,
        "liked_by":   [],
        "created_at": now,
        "updated_at": now,
    }

    result = posts_col.insert_one(post)
    post["id"] = str(result.inserted_id)
    post.pop("_id", None)
    return jsonify(post), 201

# ── Like / unlike ─────────────────────────────────────────
@posts_bp.route("/<post_id>/like", methods=["POST"])
@login_required
def like_post(post_id):
    uid  = request.current_user.get("sub")
    post = posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify({"error": "Post not found"}), 404

    liked_by = post.get("liked_by", [])
    if uid in liked_by:
        # Unlike
        posts_col.update_one(
            {"_id": ObjectId(post_id)},
            {"$pull": {"liked_by": uid}, "$inc": {"likes": -1}}
        )
        liked = False
    else:
        # Like
        posts_col.update_one(
            {"_id": ObjectId(post_id)},
            {"$addToSet": {"liked_by": uid}, "$inc": {"likes": 1}}
        )
        liked = True

    updated = posts_col.find_one({"_id": ObjectId(post_id)})
    return jsonify({"likes": updated["likes"], "liked": liked})

# ── Delete post ───────────────────────────────────────────
@posts_bp.route("/<post_id>", methods=["DELETE"])
@login_required
def delete_post(post_id):
    uid  = request.current_user.get("sub")
    role = request.current_user.get("role","")
    post = posts_col.find_one({"_id": ObjectId(post_id)})
    if not post:
        return jsonify({"error": "Not found"}), 404

    if post["author"]["id"] != uid and role != "admin":
        return jsonify({"error": "Not authorized"}), 403

    posts_col.delete_one({"_id": ObjectId(post_id)})
    return jsonify({"ok": True})
