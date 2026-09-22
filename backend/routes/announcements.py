"""
Announcements / Home-page ticker
GET    /api/announcements/ticker  — PUBLIC, no login needed. Active items, newest first.
                                     Used by index.html to fill the scrolling ticker.
GET    /api/announcements         — admin only. All items (active + inactive), for the manage screen.
POST   /api/announcements         — admin only. Create {text}.
PUT    /api/announcements/<id>    — admin only. Update {text?, active?}.
DELETE /api/announcements/<id>    — admin only. Delete.
"""
import datetime
from bson import ObjectId
from bson.errors import InvalidId
from flask import Blueprint, request, jsonify

from models import users_col
from utils import login_required

announcements_bp = Blueprint("announcements", __name__, url_prefix="/api/announcements")
announcements_col = users_col.database["announcements"]


def _out(a: dict) -> dict:
    a["id"] = str(a.pop("_id"))
    return a


def admin_required(fn):
    """Same shape as login_required, plus a role check. Put @login_required first, then this."""
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        role = (request.current_user or {}).get("role", "")
        if role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ════════════════════════════════════════════════════════
# PUBLIC — used by the home-page ticker, no auth
# ════════════════════════════════════════════════════════
@announcements_bp.route("/ticker", methods=["GET"])
def ticker():
    items = list(
        announcements_col.find({"active": True})
        .sort("created_at", -1)
        .limit(20)
    )
    return jsonify([{"id": str(i["_id"]), "text": i["text"]} for i in items])


# ════════════════════════════════════════════════════════
# ADMIN — manage screen
# ════════════════════════════════════════════════════════
@announcements_bp.route("", methods=["GET"])
@login_required
@admin_required
def list_all():
    items = list(announcements_col.find().sort("created_at", -1))
    return jsonify([_out(i) for i in items])


@announcements_bp.route("", methods=["POST"])
@login_required
@admin_required
def create():
    data = request.json or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Text is required"}), 400
    if len(text) > 200:
        return jsonify({"error": "Keep it under 200 characters"}), 400

    now = datetime.datetime.utcnow()
    doc = {
        "text": text,
        "active": True,
        "created_by": request.current_user.get("roll", ""),
        "created_at": now,
        "updated_at": now,
    }
    result = announcements_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify(_out(doc)), 201


@announcements_bp.route("/<item_id>", methods=["PUT"])
@login_required
@admin_required
def update(item_id):
    try:
        oid = ObjectId(item_id)
    except InvalidId:
        return jsonify({"error": "Invalid id"}), 400

    data = request.json or {}
    update = {"updated_at": datetime.datetime.utcnow()}
    if "text" in data:
        text = (data["text"] or "").strip()
        if not text:
            return jsonify({"error": "Text cannot be empty"}), 400
        if len(text) > 200:
            return jsonify({"error": "Keep it under 200 characters"}), 400
        update["text"] = text
    if "active" in data:
        update["active"] = bool(data["active"])

    res = announcements_col.update_one({"_id": oid}, {"$set": update})
    if res.matched_count == 0:
        return jsonify({"error": "Not found"}), 404

    doc = announcements_col.find_one({"_id": oid})
    return jsonify(_out(doc))


@announcements_bp.route("/<item_id>", methods=["DELETE"])
@login_required
@admin_required
def delete(item_id):
    try:
        oid = ObjectId(item_id)
    except InvalidId:
        return jsonify({"error": "Invalid id"}), 400

    res = announcements_col.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"ok": True})