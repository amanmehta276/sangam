"""
Sangam Backend — Flask + Socket.IO
Run: python app.py
"""
import os
import datetime
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit

from config import cfg
from models import messages_col, rooms_col, users_col
from utils.jwt_helper import decode_token

# ── App setup ─────────────────────────────────────────────
app = Flask(__name__, static_folder=None)
app.config["SECRET_KEY"]       = cfg.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = cfg.MAX_CONTENT_LEN

CORS(app, origins=[cfg.FRONTEND_URL, "http://localhost:5500", "http://127.0.0.1:5500","https://cgitsangam.netlify.app/",
                   "null"],  # allow file:// for local dev
     supports_credentials=True)

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# ── Serve uploaded files ──────────────────────────────────
@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(cfg.UPLOAD_FOLDER, filename)

# ── Register blueprints ───────────────────────────────────
from routes.auth          import auth_bp
from routes.users         import users_bp
from routes.posts         import posts_bp
from routes.jobs          import jobs_bp
from routes.chat          import chat_bp
from routes.notifications import notifs_bp
from routes.admin         import admin_bp

app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(posts_bp)
app.register_blueprint(jobs_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(notifs_bp)
app.register_blueprint(admin_bp)

# ── Health check ──────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "app": "Sangam", "version": "1.0.0"})

# ── Global error handlers ─────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": f"File too large (max {cfg.MAX_FILE_MB}MB)"}), 413

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

# ════════════════════════════════════════════════════════════
# SOCKET.IO — Real-time chat
# ════════════════════════════════════════════════════════════

online_users: dict = {}   # sid → user_id

def _auth_socket(auth: dict):
    """Decode JWT from socket auth, return payload or None"""
    token = (auth or {}).get("token","").replace("Bearer ","").strip()
    if not token:
        return None
    try:
        return decode_token(token)
    except Exception:
        return None

@socketio.on("connect")
def on_connect(auth):
    payload = _auth_socket(auth)
    if not payload:
        return False   # reject connection
    uid = payload.get("sub")
    online_users[request.sid] = uid
    emit("connected", {"user_id": uid})
    # Broadcast online status
    socketio.emit("user_online", uid, skip_sid=request.sid)
    print(f"[WS] {uid} connected ({request.sid})")

@socketio.on("disconnect")
def on_disconnect():
    uid = online_users.pop(request.sid, None)
    if uid:
        socketio.emit("user_offline", uid)
        print(f"[WS] {uid} disconnected")

@socketio.on("join")
def on_join(data):
    room = data.get("room","")
    if room:
        join_room(room)
        print(f"[WS] {online_users.get(request.sid)} joined {room}")

@socketio.on("leave")
def on_leave(data):
    room = data.get("room","")
    if room:
        leave_room(room)

@socketio.on("message")
def on_message(data):
    payload = _auth_socket(data)
    if not payload:
        emit("error", {"msg": "Unauthorized"})
        return

    uid     = payload.get("sub")
    room    = data.get("room","")
    content = (data.get("content") or "").strip()

    if not room or not content:
        return

    # Get sender info
    user = users_col.find_one({"_id": __import__("bson").ObjectId(uid)}, {"name":1,"roll_number":1,"avatar_url":1})
    now  = datetime.datetime.utcnow()

    msg = {
        "sender_id":   uid,
        "sender_name": user.get("name","") if user else "",
        "sender_roll": user.get("roll_number","") if user else "",
        "avatar_url":  user.get("avatar_url","") if user else "",
        "room":        room,
        "content":     content,
        "media_type":  None,
        "media_url":   None,
        "reply_to":    data.get("reply_to"),
        "reactions":   [],
        "created_at":  now,
        "status":      "delivered",
    }

    result = messages_col.insert_one(msg)
    msg["id"] = str(result.inserted_id)
    msg.pop("_id", None)
    msg["created_at"] = now.isoformat()

    # Update room last_message
    rooms_col.update_one(
        {"$or": [{"id": room}, {"_id": __import__("bson").ObjectId(room) if len(room)==24 else __import__("bson").ObjectId()}]},
        {"$set": {"last_message": content[:100], "last_time": now}},
        upsert=False
    )

    # Broadcast to everyone in the room
    socketio.emit("new_message", msg, to=room)

@socketio.on("typing")
def on_typing(data):
    room = data.get("room","")
    if room:
        emit("typing", {
            "room":    room,
            "user_id": online_users.get(request.sid,""),
            "name":    data.get("name",""),
        }, to=room, include_self=False)

@socketio.on("stop_typing")
def on_stop_typing(data):
    room = data.get("room","")
    if room:
        emit("stop_typing", {"room": room}, to=room, include_self=False)

# ════════════════════════════════════════════════════════════
# RUN
# ════════════════════════════════════════════════════════════
if __name__ == "__main__":
    os.makedirs(cfg.UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(f"{cfg.UPLOAD_FOLDER}/avatars", exist_ok=True)
    os.makedirs(f"{cfg.UPLOAD_FOLDER}/wallpapers", exist_ok=True)
    os.makedirs(f"{cfg.UPLOAD_FOLDER}/media", exist_ok=True)

    print(f"\n{'='*50}")
    print(f"  Sangam Backend starting on port {cfg.PORT}")
    print(f"  Frontend: {cfg.FRONTEND_URL}")
    print(f"  OTP mode: {cfg.OTP_MODE}")
    print(f"{'='*50}\n")

    socketio.run(app, host="0.0.0.0", port=cfg.PORT)