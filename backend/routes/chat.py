# # routes/chat.py
# from typing import Optional
# from flask import Blueprint, request, jsonify, current_app
# from bson import ObjectId
# from datetime import datetime
# from config.database import get_db
# from middleware.auth_middleware import token_required, user_to_dict
# from services.upload_service import handle_upload

# chat_bp = Blueprint("chat", __name__)


# def _make_dm_room(mob1: str, mob2: str) -> str:
#     a = "".join(c for c in mob1 if c.isdigit())[-10:]
#     b = "".join(c for c in mob2 if c.isdigit())[-10:]
#     return "dm_" + "_".join(sorted([a, b]))


# def _msg_dict(m: dict) -> dict:
#     return {
#         "id":          str(m["_id"]),
#         "sender_id":   str(m["sender_id"]),
#         "sender_name": m.get("sender_name", ""),
#         "sender_roll": m.get("sender_roll", ""),
#         "room":        m.get("room", ""),
#         "content":     m.get("content", ""),
#         "media_type":  m.get("media_type"),
#         "media_url":   m.get("media_url"),
#         "created_at":  m["created_at"].isoformat() if m.get("created_at") else "",
#     }


# # ── GET /api/chat/rooms ────────────────────────────────────────
# @chat_bp.route("/rooms", methods=["GET"])
# @token_required
# def list_rooms(current_user):
#     db     = get_db()
#     branch = current_user.get("branch", "CSE") or "CSE"
#     year   = current_user.get("batch_year", 2022) or 2022
#     uid    = current_user["_id"]

#     system_groups = [
#         {"id": "global",      "name": "Sangam Community",  "type": "group", "icon": "globe"},
#         {"id": "placements",  "name": "Placements 2025",   "type": "group", "icon": "briefcase"},
#         {"id": "mentorship",  "name": "Mentorship Connect","type": "group", "icon": "handshake"},
#         {"id": f"{branch.lower()}-{year}", "name": f"{branch} {year}", "type": "group", "icon": "graduation"},
#         {"id": "alumni-zone", "name": "Alumni Zone",       "type": "group", "icon": "star"},
#     ]

#     user_groups = list(db.groups.find({"members": uid}))
#     for g in user_groups:
#         g["id"]   = str(g["_id"])
#         g["type"] = "group"
#         g.pop("_id", None)

#     # FIX BUG 7: guard against empty mobile before DM lookup
#     my_mobile = current_user.get("mobile", "") or ""
#     user_mob_clean = "".join(c for c in my_mobile if c.isdigit())[-10:] if my_mobile else ""

#     dm_contacts = []
#     if user_mob_clean:  # only try if we have a valid mobile
#         dm_rooms_raw = db.messages.distinct("room", {"room": {"$regex": "^dm_"}, "sender_id": uid})
#         for room in dm_rooms_raw[:20]:
#             # Extract the two mobiles from room key  e.g. "dm_9876543210_9876543211"
#             without_prefix = room[3:]  # strip "dm_"
#             parts = without_prefix.split("_")
#             if len(parts) != 2:
#                 continue
#             other_mob = parts[1] if parts[0] == user_mob_clean else parts[0]
#             if other_mob == user_mob_clean:
#                 continue  # skip if both parts are same (shouldn't happen)
#             other = db.users.find_one({"mobile": {"$regex": f"{other_mob}$"}})
#             if other:
#                 last_msg = db.messages.find_one({"room": room}, sort=[("created_at", -1)])
#                 dm_contacts.append({
#                     "id":           room,
#                     "type":         "dm",
#                     "with_user_id": str(other["_id"]),
#                     "with_name":    other.get("name", ""),
#                     "with_roll":    other.get("roll_number", ""),
#                     "with_avatar":  other.get("avatar_url"),
#                     "last_message": last_msg.get("content", "") if last_msg else "",
#                     "last_time":    last_msg["created_at"].isoformat() if last_msg and last_msg.get("created_at") else "",
#                 })

#     return jsonify({
#         "system_groups": system_groups,
#         "my_groups":     user_groups,
#         "dms":           dm_contacts,
#     })


# # ── POST /api/chat/dm/start ────────────────────────────────────
# @chat_bp.route("/dm/start", methods=["POST"])
# @token_required
# def start_dm(current_user):
#     d    = request.get_json() or {}
#     roll = d.get("roll_number", "").strip().upper()
#     if not roll:
#         return jsonify({"error": "roll_number required"}), 400

#     db     = get_db()
#     target = db.users.find_one({"roll_number": roll})
#     if not target:
#         return jsonify({"error": "User not found"}), 404
#     if str(target["_id"]) == str(current_user["_id"]):
#         return jsonify({"error": "Cannot DM yourself"}), 400

#     my_mob = current_user.get("mobile", "")
#     th_mob = target.get("mobile", "")
#     if not my_mob or not th_mob:
#         return jsonify({"error": "Both users need a registered mobile for DMs"}), 400

#     room = _make_dm_room(my_mob, th_mob)
#     return jsonify({
#         "room":       room,
#         "with_user":  user_to_dict(target),
#         "room_label": f"Chat with {target.get('name', '')}",
#     })


# # ── POST /api/chat/group/create ────────────────────────────────
# @chat_bp.route("/group/create", methods=["POST"])
# @token_required
# def create_group(current_user):
#     d    = request.get_json() or {}
#     name = d.get("name", "").strip()
#     if not name:
#         return jsonify({"error": "group name required"}), 400

#     db           = get_db()
#     member_rolls = d.get("member_rolls", [])
#     member_ids   = [current_user["_id"]]
#     for r in member_rolls:
#         u = db.users.find_one({"roll_number": r.strip().upper()})
#         if u and u["_id"] not in member_ids:
#             member_ids.append(u["_id"])

#     doc = {
#         "name":       name,
#         "icon":       d.get("icon", "group"),
#         "created_by": current_user["_id"],
#         "members":    member_ids,
#         "created_at": datetime.utcnow(),
#     }
#     res    = db.groups.insert_one(doc)
#     doc["_id"] = res.inserted_id
#     return jsonify({
#         "id":   str(res.inserted_id),
#         "name": name,
#         "room": f"group_{res.inserted_id}",
#         "type": "group",
#     }), 201


# # ── GET /api/chat/messages ─────────────────────────────────────
# @chat_bp.route("/messages", methods=["GET"])
# @token_required
# def get_messages(current_user):
#     room      = request.args.get("room", "global")
#     limit     = min(int(request.args.get("limit", "50")), 100)
#     before_id = request.args.get("before")

#     db    = get_db()
#     query = {"room": room}
#     if before_id:
#         query["_id"] = {"$lt": ObjectId(before_id)}

#     msgs = list(db.messages.find(query).sort("created_at", -1).limit(limit))
#     msgs.reverse()
#     return jsonify([_msg_dict(m) for m in msgs])


# # ── POST /api/chat/messages ────────────────────────────────────
# @chat_bp.route("/messages", methods=["POST"])
# @token_required
# def send_message(current_user):
#     d = request.get_json() or {}
#     if not d.get("content") and not d.get("media_url"):
#         return jsonify({"error": "content or media_url required"}), 400

#     db  = get_db()
#     msg = {
#         "sender_id":   current_user["_id"],
#         "sender_name": current_user.get("name", ""),
#         "sender_roll": current_user.get("roll_number", ""),
#         "room":        d.get("room", "global"),
#         "content":     d.get("content", ""),
#         "media_type":  d.get("media_type"),
#         "media_url":   d.get("media_url"),
#         "created_at":  datetime.utcnow(),
#     }
#     res    = db.messages.insert_one(msg)
#     msg["_id"] = res.inserted_id
#     return jsonify(_msg_dict(msg)), 201


# # ── POST /api/chat/upload ──────────────────────────────────────
# @chat_bp.route("/upload", methods=["POST"])
# @token_required
# def upload_media(current_user):
#     if "file" not in request.files:
#         return jsonify({"error": "No file provided"}), 400

#     f      = request.files["file"]
#     room   = request.form.get("room", "global")
#     result = handle_upload(f, subfolder="chat")
#     if not result["ok"]:
#         return jsonify({"error": result["error"]}), 400

#     db  = get_db()
#     msg = {
#         "sender_id":   current_user["_id"],
#         "sender_name": current_user.get("name", ""),
#         "sender_roll": current_user.get("roll_number", ""),
#         "room":        room,
#         "content":     f.filename,
#         "media_type":  result["media_type"],
#         "media_url":   result["url"],
#         "created_at":  datetime.utcnow(),
#     }
#     res    = db.messages.insert_one(msg)
#     msg["_id"] = res.inserted_id
#     return jsonify(_msg_dict(msg)), 201


# # ── GET /api/chat/users/search ─────────────────────────────────
# @chat_bp.route("/users/search", methods=["GET"])
# @token_required
# def search_users(current_user):
#     q = request.args.get("q", "").strip()
#     if not q:
#         return jsonify([]), 200
#     db    = get_db()
#     users = list(db.users.find({
#         "_id": {"$ne": current_user["_id"]},
#         "$or": [
#             {"name":        {"$regex": q, "$options": "i"}},
#             {"roll_number": {"$regex": q, "$options": "i"}},
#         ]
#     }).limit(15))
#     return jsonify([{
#         "id":          str(u["_id"]),
#         "name":        u.get("name", ""),
#         "roll_number": u.get("roll_number", ""),
#         "role":        u.get("role", "student"),
#         "branch":      u.get("branch", ""),
#         "avatar_url":  u.get("avatar_url"),
#     } for u in users])








"""
routes/chat.py  — Chat rooms, messages, Socket.IO
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, decode_token
from flask_socketio import SocketIO, join_room, leave_room, emit
from utils.token import auth_required
from models.user import get_db, find_user_by_roll
from datetime import datetime
from bson import ObjectId
import os

chat_bp  = Blueprint("chat", __name__)
socketio = None   # injected from app.py

def init_socketio(sio):
    global socketio
    socketio = sio

def _oid(s):
    try: return ObjectId(s)
    except: return None

def _ser(d):
    d["_id"] = str(d["_id"])
    return d

# ── System groups (always exist) ──────────────────────────
SYSTEM_GROUPS = [
    {"id": "global",      "name": "Sangam Community",   "icon": "🌍"},
    {"id": "placements",  "name": "Placements 2025",     "icon": "💼"},
    {"id": "mentorship",  "name": "Mentorship Connect",  "icon": "🤝"},
    {"id": "cse-batch",   "name": "CSE Batch 2022",      "icon": "💻"},
    {"id": "eee-batch",   "name": "EEE Batch 2022",      "icon": "⚡"},
]


# ── GET /api/chat/rooms ────────────────────────────────────
@chat_bp.route("/api/chat/rooms", methods=["GET"])
@auth_required
def get_rooms():
    roll = get_jwt_identity()["roll"]
    db   = get_db()

    # My groups
    my_groups = list(db.chat_groups.find({"members": roll}))
    for g in my_groups:
        g["id"]   = str(g["_id"])
        g["_id"]  = str(g["_id"])
        g["room"] = g["id"]

    # DMs
    dms = list(db.dms.find({"$or": [{"user1": roll}, {"user2": roll}]}).sort("updated_at", -1).limit(20))
    dm_list = []
    for d in dms:
        other = d["user2"] if d["user1"] == roll else d["user1"]
        other_user = find_user_by_roll(other)
        dm_list.append({
            "id":          str(d["_id"]),
            "with_roll":   other,
            "with_name":   other_user["name"] if other_user else other,
            "last_message": d.get("last_message", ""),
            "last_time":   d.get("updated_at", "").isoformat() if hasattr(d.get("updated_at",""), "isoformat") else "",
        })

    # Add last_message to system groups from DB
    sg_with_meta = []
    for sg in SYSTEM_GROUPS:
        last = db.messages.find_one({"room": sg["id"]}, sort=[("created_at", -1)])
        sg_with_meta.append({
            **sg,
            "members":      120,
            "last_message": last["content"] if last else "",
            "last_time":    last["created_at"].isoformat() if last and hasattr(last.get("created_at",""), "isoformat") else "",
        })

    return jsonify({
        "system_groups": sg_with_meta,
        "my_groups":     [_ser(g) for g in my_groups],
        "dms":           dm_list,
    }), 200


# ── GET /api/chat/rooms/<room>/messages ───────────────────
@chat_bp.route("/api/chat/rooms/<room>/messages", methods=["GET"])
@auth_required
def get_messages(room):
    db   = get_db()
    msgs = list(db.messages.find({"room": room}).sort("created_at", -1).limit(60))
    msgs.reverse()
    return jsonify([_ser(m) for m in msgs]), 200


# ── POST /api/chat/rooms/<room>/messages ──────────────────
@chat_bp.route("/api/chat/rooms/<room>/messages", methods=["POST"])
@auth_required
def send_message(room):
    roll = get_jwt_identity()["roll"]
    user = find_user_by_roll(roll)
    data = request.get_json() or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Empty message"}), 400

    db  = get_db()
    now = datetime.utcnow()
    doc = {
        "room":        room,
        "sender_id":   str(user["_id"]),
        "sender_name": user["name"],
        "sender_roll": roll,
        "content":     content,
        "reply_to":    data.get("reply_to"),
        "media_type":  None,
        "media_url":   None,
        "status":      "sent",
        "created_at":  now,
    }
    result = db.messages.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    if socketio:
        socketio.emit("new_message", doc, room=room)

    return jsonify(doc), 201


# ── POST /api/chat/dm/start ───────────────────────────────
@chat_bp.route("/api/chat/dm/start", methods=["POST"])
@auth_required
def start_dm():
    roll = get_jwt_identity()["roll"]
    data = request.get_json() or {}
    target_roll = (data.get("roll_number") or "").upper()
    if not target_roll:
        return jsonify({"error": "roll_number required"}), 400

    target = find_user_by_roll(target_roll)
    if not target:
        return jsonify({"error": "User not found"}), 404

    db  = get_db()
    # Find existing DM
    existing = db.dms.find_one({
        "$or": [
            {"user1": roll, "user2": target_roll},
            {"user1": target_roll, "user2": roll},
        ]
    })
    if existing:
        room_id = f"dm_{str(existing['_id'])}"
    else:
        now    = datetime.utcnow()
        result = db.dms.insert_one({
            "user1":      roll,
            "user2":      target_roll,
            "created_at": now,
            "updated_at": now,
        })
        room_id = f"dm_{str(result.inserted_id)}"

    return jsonify({
        "room":      room_id,
        "with_user": {"name": target["name"], "roll": target_roll},
    }), 200


# ── POST /api/chat/groups ─────────────────────────────────
@chat_bp.route("/api/chat/groups", methods=["POST"])
@auth_required
def create_group():
    roll = get_jwt_identity()["roll"]
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Group name required"}), 400

    members = list(set([roll] + (data.get("members") or [])))
    db      = get_db()
    now     = datetime.utcnow()
    result  = db.chat_groups.insert_one({
        "name":       name,
        "members":    members,
        "created_by": roll,
        "created_at": now,
        "updated_at": now,
    })
    return jsonify({"id": str(result.inserted_id), "room": f"group_{str(result.inserted_id)}"}), 201


# ── GET /api/chat/search-users ────────────────────────────
@chat_bp.route("/api/chat/search-users", methods=["GET"])
@auth_required
def search_users():
    q  = request.args.get("q", "")
    db = get_db()
    users = list(db.users.find(
        {"$or": [{"name": {"$regex": q, "$options": "i"}}, {"roll_number": {"$regex": q, "$options": "i"}}]},
        {"_id": 0, "name": 1, "roll_number": 1, "branch": 1, "batch_year": 1}
    ).limit(10))
    return jsonify(users), 200


# ── POST /api/chat/upload ─────────────────────────────────
@chat_bp.route("/api/chat/upload", methods=["POST"])
@auth_required
def upload_file():
    import uuid
    roll = get_jwt_identity()["roll"]
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400

    file = request.files["file"]
    ext  = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    name = f"{uuid.uuid4().hex}.{ext}"
    folder = os.path.join(os.path.dirname(__file__), "..", "uploads", "chat")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, name)
    file.save(path)

    media_type = "image" if ext in {"png","jpg","jpeg","gif","webp"} else "video" if ext in {"mp4","mov","webm"} else "file"
    url        = f"{request.host_url}uploads/chat/{name}"

    return jsonify({"media_type": media_type, "media_url": url, "url": url}), 200


# ══════════════════════════════════════════
#  SOCKET.IO EVENTS
# ══════════════════════════════════════════
def register_socket_events(sio, jwt_secret):

    @sio.on("connect")
    def on_connect():
        print(f"[Socket] Client connected")

    @sio.on("join")
    def on_join(data):
        try:
            token = (data.get("token") or "").replace("Bearer ", "")
            identity = decode_token(token)["sub"]
            roll     = identity["roll"]
            room     = data.get("room")
            if room:
                join_room(room)
                emit("joined", {"room": room, "roll": roll})
        except Exception as e:
            print(f"[Socket] join error: {e}")

    @sio.on("message")
    def on_message(data):
        try:
            token = (data.get("token") or "").replace("Bearer ", "")
            identity = decode_token(token)["sub"]
            roll     = identity["roll"]
            user     = find_user_by_roll(roll)
            room     = data.get("room")
            content  = (data.get("content") or "").strip()
            if not room or not content:
                return

            db  = get_db()
            now = datetime.utcnow()
            doc = {
                "room":        room,
                "sender_id":   str(user["_id"]),
                "sender_name": user["name"],
                "sender_roll": roll,
                "content":     content,
                "reply_to":    data.get("reply_to"),
                "media_type":  None,
                "media_url":   None,
                "status":      "delivered",
                "created_at":  now,
            }
            result = db.messages.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
            doc["created_at"] = now.isoformat()

            # Update last_message in DM
            if room.startswith("dm_"):
                dm_id = room.replace("dm_", "")
                db.dms.update_one(
                    {"_id": _oid(dm_id)},
                    {"$set": {"last_message": content, "updated_at": now}}
                )

            sio.emit("new_message", doc, room=room)
        except Exception as e:
            print(f"[Socket] message error: {e}")

    @sio.on("typing")
    def on_typing(data):
        room = data.get("room")
        if room:
            emit("typing", data, room=room, include_self=False)

    @sio.on("stop_typing")
    def on_stop_typing(data):
        room = data.get("room")
        if room:
            emit("stop_typing", data, room=room, include_self=False)

    @sio.on("disconnect")
    def on_disconnect():
        print("[Socket] Client disconnected")