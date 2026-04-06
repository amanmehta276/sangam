# routes/notifs.py

from flask import Blueprint, request, jsonify
from config.database import get_db
from middleware.auth_middleware import token_required
from datetime import datetime

notifs_bp = Blueprint("notifs", __name__)


# 📥 Get notifications
@notifs_bp.route("/", methods=["GET"])
@token_required
def get_notifs(current_user):
    db = get_db()

    notifs = list(
        db.notifications.find({"user_id": str(current_user["_id"])})
        .sort("created_at", -1)
        .limit(30)
    )

    for n in notifs:
        n["_id"] = str(n["_id"])

    return jsonify(notifs)


# 📖 Mark all as read
@notifs_bp.route("/read-all", methods=["POST"])
@token_required
def mark_all_read(current_user):
    db = get_db()

    db.notifications.update_many(
        {"user_id": str(current_user["_id"]), "is_read": False},
        {"$set": {"is_read": True}}
    )

    return jsonify({"ok": True})


# 📢 Broadcast (Admin)
@notifs_bp.route("/broadcast", methods=["POST"])
@token_required
def broadcast(current_user):
    db = get_db()

    if current_user.get("role") != "admin":
        return jsonify({"error": "Admin only"}), 403

    data  = request.get_json() or {}
    title = data.get("title")
    body  = data.get("body")

    if not title:
        return jsonify({"error": "title required"}), 400

    users = list(db.users.find())

    docs = []
    for u in users:
        docs.append({
            "user_id": str(u["_id"]),
            "notif_type": "system",
            "title": title,
            "body": body,
            "is_read": False,
            "created_at": datetime.utcnow()
        })

    if docs:
        db.notifications.insert_many(docs)

    return jsonify({"sent_to": len(docs)})