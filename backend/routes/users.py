# routes/users.py
from flask import Blueprint, request, jsonify
from config.database import db
from models.user import User
from middleware.auth_middleware import token_required

users_bp = Blueprint("users", __name__)

@users_bp.route("/", methods=["GET"])
@token_required
def list_users(current_user):
    role   = request.args.get("role")
    branch = request.args.get("branch")
    q      = request.args.get("q", "")
    query  = User.query
    if role:   query = query.filter_by(role=role)
    if branch: query = query.filter_by(branch=branch)
    if q:      query = query.filter(User.name.ilike(f"%{q}%"))
    users = query.order_by(User.created_at.desc()).limit(50).all()
    return jsonify([u.to_dict() for u in users])

@users_bp.route("/<int:uid>", methods=["GET"])
@token_required
def get_user(current_user, uid):
    u = User.query.get_or_404(uid)
    return jsonify(u.to_dict())

@users_bp.route("/me", methods=["PATCH"])
@token_required
def update_profile(current_user):
    data = request.get_json() or {}
    allowed = ["bio", "avatar_url", "linkedin_url", "github_url", "company", "skills", "email"]
    for field in allowed:
        if field in data:
            val = data[field]
            if field == "skills" and isinstance(val, list):
                val = ",".join(val)
            setattr(current_user, field, val)
    if current_user.linkedin_url:
        current_user.trust_level = "verified"
    db.session.commit()
    return jsonify(current_user.to_dict(public=False))