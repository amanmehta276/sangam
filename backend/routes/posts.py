# routes/posts.py
from flask import Blueprint, request, jsonify
from config.database import db
from models.post import Post
from middleware.auth_middleware import token_required

posts_bp = Blueprint("posts", __name__)

@posts_bp.route("/", methods=["GET"])
@token_required
def get_posts(current_user):
    ptype = request.args.get("type")
    query = Post.query
    if ptype: query = query.filter_by(post_type=ptype)
    posts = query.order_by(Post.created_at.desc()).limit(30).all()
    return jsonify([p.to_dict() for p in posts])

@posts_bp.route("/", methods=["POST"])
@token_required
def create_post(current_user):
    data = request.get_json() or {}
    if not data.get("content"):
        return jsonify({"error": "content required"}), 400
    tags = data.get("tags", [])
    post = Post(
        author_id=current_user.id,
        post_type=data.get("post_type", "update"),
        content=data["content"],
        tags=",".join(tags) if isinstance(tags, list) else tags,
    )
    db.session.add(post)
    db.session.commit()
    return jsonify(post.to_dict()), 201

@posts_bp.route("/<int:pid>/like", methods=["POST"])
@token_required
def like_post(current_user, pid):
    post = Post.query.get_or_404(pid)
    post.likes += 1
    db.session.commit()
    return jsonify({"likes": post.likes})