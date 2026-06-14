"""
Chat REST routes (Socket.IO handled in app.py)
GET  /api/chat/rooms              — My rooms list
GET  /api/chat/messages/:room     — Messages in a room
POST /api/chat/rooms              — Create group
POST /api/chat/dm/:roll           — Start / get DM room
POST /api/chat/upload             — Upload file/image in chat
GET  /api/chat/search-users?q=   — Search users for DM
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from models import messages_col, rooms_col, users_col
from utils import login_required
from utils.upload_helper import save_file

chat_bp = Blueprint("chat", __name__, url_prefix="/api/chat")

def _mid(m):
    m["id"] = str(m.pop("_id"))
    return m

def _rid(r):
    r["id"] = str(r.pop("_id"))
    return r

# ── System groups (created once) ─────────────────────────
SYSTEM_GROUPS = [
    {"id": "global",     "name": "Sangam Community",   "members": 0, "isAdmin": False},
    {"id": "placements", "name": "Placements 2025",     "members": 0, "isAdmin": False},
    {"id": "mentorship", "name": "Mentorship Connect",  "members": 0, "isAdmin": False},
]

# ── List rooms ───────────────────────────────────────────
@chat_bp.route("/rooms", methods=["GET"])
@login_required
def list_rooms():
    uid = request.current_user.get("sub")

    # My created groups
    my_groups = list(rooms_col.find({"members": uid, "type": "group"}))
    my_groups = [_rid(r) for r in my_groups]

    # My DMs
    dms = list(rooms_col.find({"members": uid, "type": "dm"}))
    dm_out = []
    for d in dms:
        other_id = next((m for m in d.get("members",[]) if m != uid), None)
        other    = users_col.find_one({"_id": ObjectId(other_id)}, {"name":1}) if other_id else None
        dm_out.append({
            "id":           str(d["_id"]),
            "with_name":    other.get("name","Unknown") if other else "Unknown",
            "with_id":      other_id,
            "last_message": d.get("last_message",""),
            "last_time":    d.get("last_time","").isoformat() if isinstance(d.get("last_time"), datetime.datetime) else d.get("last_time",""),
        })

    return jsonify({
        "system_groups": SYSTEM_GROUPS,
        "my_groups":     my_groups,
        "dms":           dm_out,
    })

# ── Get messages ─────────────────────────────────────────
@chat_bp.route("/messages/<room_id>", methods=["GET"])
@login_required
def get_messages(room_id):
    limit  = min(int(request.args.get("limit", 50)), 200)
    msgs   = list(messages_col.find({"room": room_id}).sort("created_at",-1).limit(limit))
    msgs.reverse()
    return jsonify([_mid(m) for m in msgs])

# ── Create group ─────────────────────────────────────────
@chat_bp.route("/rooms", methods=["POST"])
@login_required
def create_group():
    uid  = request.current_user.get("sub")
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Group name required"}), 400

    # Resolve rolls to user IDs
    rolls   = data.get("members", [])
    members = [uid]
    for roll in rolls:
        u = users_col.find_one({"roll_number": roll.upper()}, {"_id":1})
        if u: members.append(str(u["_id"]))

    now  = datetime.datetime.utcnow()
    room = {
        "name":         name,
        "type":         "group",
        "members":      members,
        "admin":        uid,
        "created_at":   now,
        "last_message": "",
        "last_time":    now,
    }
    result = rooms_col.insert_one(room)
    return jsonify({"room": str(result.inserted_id), "name": name}), 201

# ── Start / get DM ───────────────────────────────────────
@chat_bp.route("/dm/<roll>", methods=["POST"])
@login_required
def start_dm(roll):
    uid   = request.current_user.get("sub")
    other = users_col.find_one({"roll_number": roll.upper()}, {"_id":1,"name":1})
    if not other:
        return jsonify({"error": "User not found"}), 404

    other_id = str(other["_id"])
    if other_id == uid:
        return jsonify({"error": "Cannot DM yourself"}), 400

    # Check existing DM room
    members_sorted = sorted([uid, other_id])
    existing = rooms_col.find_one({
        "type": "dm",
        "members": {"$all": members_sorted, "$size": 2}
    })
    if existing:
        return jsonify({"room": str(existing["_id"]), "with_user": {"name": other.get("name",""), "id": other_id}})

    now  = datetime.datetime.utcnow()
    room = {
        "type":         "dm",
        "members":      members_sorted,
        "created_at":   now,
        "last_message": "",
        "last_time":    now,
    }
    result = rooms_col.insert_one(room)
    return jsonify({"room": str(result.inserted_id), "with_user": {"name": other.get("name",""), "id": other_id}}), 201

# ── Upload file in chat ───────────────────────────────────
@chat_bp.route("/upload", methods=["POST"])
@login_required
def upload_chat_file():
    file    = request.files.get("file")
    room_id = request.form.get("room","")
    if not file:
        return jsonify({"error": "No file"}), 400
    try:
        url, media_type = save_file(file, "media")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"media_url": url, "media_type": media_type})

# ── Search users for DM ───────────────────────────────────
@chat_bp.route("/search-users", methods=["GET"])
@login_required
def search_users():
    q = request.args.get("q","").strip()
    if len(q) < 2:
        return jsonify([])
    users = list(users_col.find({
        "$or": [
            {"name":        {"$regex": q, "$options":"i"}},
            {"roll_number": {"$regex": q, "$options":"i"}},
        ]
    }, {"name":1,"roll_number":1,"branch":1,"avatar_url":1}).limit(10))
    return jsonify([{"id": str(u["_id"]), "name": u.get("name",""), "roll_number": u.get("roll_number",""), "branch": u.get("branch","")} for u in users])
