"""
Chat routes — polling-based messaging (no websockets).
GET  /api/chat/rooms                — my rooms (system / groups / dms)
GET  /api/chat/messages/<room>      — message history (supports ?after= for polling new ones)
POST /api/chat/messages             — send a message
POST /api/chat/rooms                — create a group
POST /api/chat/dm/<roll>            — get-or-create a DM with a user
GET  /api/chat/search-users?q=      — find users to DM / add to a group
"""
import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId

from models import messages_col, rooms_col, users_col
from utils import login_required

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

SYSTEM_ROOM_ID = "global"


def _ensure_system_room():
    room = rooms_col.find_one({"_id": SYSTEM_ROOM_ID})
    if not room:
        room = {
            "_id":        SYSTEM_ROOM_ID,
            "type":       "system",
            "name":       "Global Chat",
            "members":    [],   # everyone logged in can read/post — no explicit list needed
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow(),
            "last_message": None,
        }
        rooms_col.insert_one(room)
    return room


def _room_out(room, me=None):
    r = dict(room)
    r["id"] = str(r.pop("_id"))
    if r["type"] == "dm" and me:
        other_roll = next((m for m in r.get("members", []) if m != me), None)
        other = users_col.find_one({"roll_number": other_roll}) if other_roll else None
        r["dm_with"] = {
            "roll_number": other_roll,
            "name":        other.get("name") if other else other_roll,
            "avatar_url":  other.get("avatar_url","") if other else "",
        }
    return r


def _msg_out(m):
    m = dict(m)
    m["id"] = str(m.pop("_id"))
    return m


def _is_member(room, roll):
    if room["type"] == "system":
        return True
    return roll in room.get("members", [])


# ── Rooms list ─────────────────────────────────────────────
@chat_bp.route("/rooms", methods=["GET"])
@login_required
def list_rooms():
    me = request.current_user["roll"]
    system_room = _ensure_system_room()

    my_groups = list(rooms_col.find({"type": "group", "members": me}).sort("updated_at", -1))
    dms       = list(rooms_col.find({"type": "dm",    "members": me}).sort("updated_at", -1))

    return jsonify({
        "system_groups": [_room_out(system_room, me)],
        "my_groups":      [_room_out(r, me) for r in my_groups],
        "dms":            [_room_out(r, me) for r in dms],
    })


# ── Message history ────────────────────────────────────────
@chat_bp.route("/messages/<room_id>", methods=["GET"])
@login_required
def get_messages(room_id):
    me   = request.current_user["roll"]
    room = rooms_col.find_one({"_id": SYSTEM_ROOM_ID if room_id == SYSTEM_ROOM_ID else _oid_or_str(room_id)})
    if not room or not _is_member(room, me):
        return jsonify({"error": "Room not found or access denied"}), 404

    after = request.args.get("after")   # ISO timestamp — used for polling only new messages
    limit = min(int(request.args.get("limit", 50)), 100)

    filt = {"room": room["_id"]}
    if after:
        try:
            filt["created_at"] = {"$gt": datetime.datetime.fromisoformat(after)}
        except ValueError:
            pass

    if after:
        # Polling for new messages — chronological, no need to reverse
        msgs = list(messages_col.find(filt).sort("created_at", 1).limit(limit))
    else:
        # Initial load — last N messages, oldest first
        msgs = list(messages_col.find(filt).sort("created_at", -1).limit(limit))
        msgs.reverse()

    return jsonify([_msg_out(m) for m in msgs])


# ── Send message ───────────────────────────────────────────
@chat_bp.route("/messages", methods=["POST"])
@login_required
def send_message():
    me   = request.current_user["roll"]
    data = request.get_json(silent=True) or {}
    room_id = data.get("room")
    content = (data.get("content") or "").strip()

    if not room_id or not content:
        return jsonify({"error": "room and content are required"}), 400
    if len(content) > 4000:
        return jsonify({"error": "Message too long"}), 400

    room = rooms_col.find_one({"_id": SYSTEM_ROOM_ID if room_id == SYSTEM_ROOM_ID else _oid_or_str(room_id)})
    if not room or not _is_member(room, me):
        return jsonify({"error": "Room not found or access denied"}), 404

    sender = users_col.find_one({"roll_number": me}) or {}
    msg = {
        "room":        room["_id"],
        "sender":      me,
        "sender_name": sender.get("name", me),
        "content":     content,
        "created_at":  datetime.datetime.utcnow(),
    }
    result = messages_col.insert_one(msg)
    msg["_id"] = result.inserted_id

    rooms_col.update_one({"_id": room["_id"]}, {"$set": {
        "updated_at":   msg["created_at"],
        "last_message": {"content": content[:120], "sender": me, "created_at": msg["created_at"]},
    }})

    return jsonify(_msg_out(msg)), 201


# ── Create group ───────────────────────────────────────────
@chat_bp.route("/rooms", methods=["POST"])
@login_required
def create_group():
    me   = request.current_user["roll"]
    data = request.get_json(silent=True) or {}
    name    = (data.get("name") or "").strip()
    members = data.get("members") or []

    if not name:
        return jsonify({"error": "Group name is required"}), 400
    if not isinstance(members, list):
        return jsonify({"error": "members must be a list of roll numbers"}), 400

    all_members = sorted(set([me] + [m.upper().strip() for m in members if m]))
    if len(all_members) < 2:
        return jsonify({"error": "Add at least one other member"}), 400

    room = {
        "type":         "group",
        "name":         name,
        "members":      all_members,
        "created_by":   me,
        "created_at":   datetime.datetime.utcnow(),
        "updated_at":   datetime.datetime.utcnow(),
        "last_message": None,
    }
    result = rooms_col.insert_one(room)
    room["_id"] = result.inserted_id
    return jsonify(_room_out(room, me)), 201


# ── Start / get a DM ───────────────────────────────────────
@chat_bp.route("/dm/<roll>", methods=["POST"])
@login_required
def start_dm(roll):
    me     = request.current_user["roll"]
    target = roll.upper().strip()

    if target == me:
        return jsonify({"error": "Can't DM yourself"}), 400
    if not users_col.find_one({"roll_number": target}):
        return jsonify({"error": "User not found"}), 404

    pair = sorted([me, target])
    room = rooms_col.find_one({"type": "dm", "members": pair})
    if not room:
        room = {
            "type":         "dm",
            "name":         None,
            "members":      pair,
            "created_at":   datetime.datetime.utcnow(),
            "updated_at":   datetime.datetime.utcnow(),
            "last_message": None,
        }
        result = rooms_col.insert_one(room)
        room["_id"] = result.inserted_id

    return jsonify(_room_out(room, me))


# ── Search users (for new DM / add to group) ───────────────
@chat_bp.route("/search-users", methods=["GET"])
@login_required
def search_users():
    me = request.current_user["roll"]
    q  = request.args.get("q", "").strip()
    if not q:
        return jsonify([])

    users = list(users_col.find({
        "roll_number": {"$ne": me},
        "$or": [
            {"name":        {"$regex": q, "$options": "i"}},
            {"roll_number": {"$regex": q, "$options": "i"}},
        ],
    }, {"roll_number": 1, "name": 1, "avatar_url": 1, "branch": 1}).limit(15))

    return jsonify([{
        "roll_number": u.get("roll_number"),
        "name":        u.get("name"),
        "avatar_url":  u.get("avatar_url",""),
        "branch":      u.get("branch",""),
    } for u in users])


def _oid_or_str(room_id):
    """Group/DM room ids are Mongo ObjectIds (stored as strings in URLs);
    the system room uses a fixed string id. Try ObjectId first."""
    try:
        return ObjectId(room_id)
    except Exception:
        return room_id
