# routes/notifs.py
from flask import Blueprint, request, jsonify
from config.database import db
from models.notification import Notification
from middleware.auth_middleware import token_required, role_required

notifs_bp = Blueprint("notifs", __name__)

@notifs_bp.route("/", methods=["GET"])
@token_required
def get_notifs(current_user):
    notifs = (Notification.query
              .filter_by(user_id=current_user.id)
              .order_by(Notification.created_at.desc())
              .limit(30).all())
    return jsonify([n.to_dict() for n in notifs])

@notifs_bp.route("/read-all", methods=["POST"])
@token_required
def mark_all_read(current_user):
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})

@notifs_bp.route("/broadcast", methods=["POST"])
@token_required
def broadcast(current_user):
    """Admin sends a notification to all users."""
    if current_user.role != "admin":
        return jsonify({"error": "Admin only"}), 403
    from models.user import User
    data  = request.get_json() or {}
    title = data.get("title", "")
    body  = data.get("body", "")
    users = User.query.all()
    for u in users:
        n = Notification(user_id=u.id, notif_type="system", title=title, body=body)
        db.session.add(n)
    db.session.commit()
    return jsonify({"sent_to": len(users)})