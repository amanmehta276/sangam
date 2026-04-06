# routes/posts.py
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from config.database import get_db
from middleware.auth_middleware import token_required, user_to_dict

posts_bp = Blueprint("posts", __name__)

def _post_dict(p):
    author = p.get("author_snapshot", {})
    return {
        "id": str(p["_id"]), "post_type": p.get("post_type","update"),
        "content": p.get("content",""),
        "tags": p.get("tags",[]),
        "likes": p.get("likes",0),
        "author": author,
        "created_at": p["created_at"].isoformat() if p.get("created_at") else "",
    }

@posts_bp.route("/", methods=["GET"])
@token_required
def get_posts(cur):
    filt = {}
    t = request.args.get("type")
    if t: filt["post_type"] = t
    posts = list(get_db().posts.find(filt).sort("created_at",-1).limit(30))
    return jsonify([_post_dict(p) for p in posts])

@posts_bp.route("/", methods=["POST"])
@token_required
def create_post(cur):
    d = request.get_json() or {}
    if not d.get("content"): return jsonify({"error":"content required"}),400
    tags = d.get("tags",[])
    doc = {
        "author_id": cur["_id"],
        "author_snapshot": user_to_dict(cur),
        "post_type": d.get("post_type","update"),
        "content": d["content"],
        "tags": tags if isinstance(tags,list) else [t.strip() for t in tags.split(",")],
        "likes": 0, "liked_by": [],
        "created_at": datetime.utcnow(),
    }
    res = get_db().posts.insert_one(doc); doc["_id"] = res.inserted_id
    return jsonify(_post_dict(doc)), 201

@posts_bp.route("/<pid>/like", methods=["POST"])
@token_required
def like_post(cur, pid):
    db   = get_db()
    uid  = cur["_id"]
    post = db.posts.find_one({"_id": ObjectId(pid)})
    if not post: return jsonify({"error":"not found"}),404
    liked = uid in post.get("liked_by",[])
    if liked:
        db.posts.update_one({"_id":post["_id"]},{"$inc":{"likes":-1},"$pull":{"liked_by":uid}})
    else:
        db.posts.update_one({"_id":post["_id"]},{"$inc":{"likes":1},"$addToSet":{"liked_by":uid}})
    updated = db.posts.find_one({"_id": post["_id"]})
    return jsonify({"likes": updated["likes"], "liked": not liked})