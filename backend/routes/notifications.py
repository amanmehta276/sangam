"""
Notifications routes
GET  /api/notifications       — My notifications
POST /api/notifications/read  — Mark all read
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from models import notifications_col
from utils import login_required

notifs_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

def _out(n):
    n["id"] = str(n.pop("_id"))
    return n

@notifs_bp.route("", methods=["GET"])
@login_required
def list_notifs():
    uid    = request.current_user.get("sub")
    limit  = min(int(request.args.get("limit",30)), 100)
    notifs = list(notifications_col.find({"user_id": uid}).sort("created_at",-1).limit(limit))
    if not notifs:
        # Default welcome notification
        notifs = [{
            "_id":        ObjectId(),
            "user_id":    uid,
            "notif_type": "system",
            "title":      "Welcome to Sangam!",
            "body":       "Connect with alumni, find jobs, and chat with your batch.",
            "is_read":    False,
            "created_at": datetime.datetime.utcnow(),
        }]
    return jsonify([_out(n) for n in notifs])

@notifs_bp.route("/read", methods=["POST"])
@login_required
def mark_read():
    uid = request.current_user.get("sub")
    notifications_col.update_many({"user_id": uid}, {"$set": {"is_read": True}})
    return jsonify({"ok": True})

def push_notification(user_id: str, notif_type: str, title: str, body: str = ""):
    """Helper to push notification from other routes"""
    notifications_col.insert_one({
        "user_id":    user_id,
        "notif_type": notif_type,
        "title":      title,
        "body":       body,
        "is_read":    False,
        "created_at": datetime.datetime.utcnow(),
    })
