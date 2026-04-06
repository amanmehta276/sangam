# app.py
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from config.database import init_db
from routes.auth   import auth_bp
from routes.users  import users_bp
from routes.posts  import posts_bp
from routes.jobs   import jobs_bp
from routes.chat   import chat_bp
from routes.notifs import notifs_bp
import jwt, os

socketio = SocketIO()


def create_app():
    app = Flask(__name__)
    app.config.from_object("config.settings.Config")

    os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)

    CORS(app, origins=[
        "http://localhost:3000", "http://127.0.0.1:5500",
        "http://localhost:8000", "http://localhost:5500",
    ], supports_credentials=True)

    init_db(app)

    for bp, prefix in [
        (auth_bp,   "/api/auth"),   (users_bp, "/api/users"),
        (posts_bp,  "/api/posts"),  (jobs_bp,  "/api/jobs"),
        (chat_bp,   "/api/chat"),   (notifs_bp,"/api/notifications"),
    ]:
        app.register_blueprint(bp, url_prefix=prefix)

    @app.route("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config.get("UPLOAD_FOLDER", "uploads"), filename)

    @app.route("/api/health")
    def health():
        return {"status": "ok", "db": "mongodb", "app": "Sangam v3"}, 200

    socketio.init_app(app, cors_allowed_origins="*", async_mode="eventlet")
    _socket_events(app)
    return app


def _get_user(token: str, secret: str):
    """
    FIX BUG 4: Accept secret as parameter instead of using os.getenv()
    so it always matches what Flask loaded from .env via Config.
    """
    from config.database import get_db
    from bson import ObjectId
    try:
        data = jwt.decode(token, secret, algorithms=["HS256"])
        return get_db().users.find_one({"_id": ObjectId(data["user_id"])})
    except Exception:
        return None


def _socket_events(app):
    from config.database import get_db
    from datetime import datetime

    @socketio.on("connect")
    def on_connect(auth):
        token  = (auth or {}).get("token", "").replace("Bearer ", "")
        secret = app.config.get("SECRET_KEY", "")
        with app.app_context():
            u = _get_user(token, secret)
        if not u:
            return False
        print(f"[WS] {u['name']} connected")

    @socketio.on("join")
    def on_join(data):
        room   = data.get("room", "global")
        token  = data.get("token", "").replace("Bearer ", "")
        secret = app.config.get("SECRET_KEY", "")
        with app.app_context():
            u = _get_user(token, secret)
        if not u:
            return
        join_room(room)

    @socketio.on("leave")
    def on_leave(data):
        leave_room(data.get("room", "global"))

    @socketio.on("message")
    def on_message(data):
        token      = data.get("token", "").replace("Bearer ", "")
        room       = data.get("room", "global")
        content    = data.get("content", "").strip()
        media_type = data.get("media_type")
        media_url  = data.get("media_url")
        secret     = app.config.get("SECRET_KEY", "")

        if not content and not media_url:
            return

        with app.app_context():
            u = _get_user(token, secret)
            if not u:
                emit("error", {"message": "Unauthorized"})
                return

            db = get_db()
            # FIX BUG 3: Save timestamp ONCE — same value in DB and WebSocket event
            now = datetime.utcnow()
            msg = {
                "sender_id":   u["_id"],
                "sender_name": u.get("name", ""),
                "sender_roll": u.get("roll_number", ""),
                "room":        room,
                "content":     content,
                "media_type":  media_type,
                "media_url":   media_url,
                "created_at":  now,
            }
            res = db.messages.insert_one(msg)
            msg_id = str(res.inserted_id)
            now_iso = now.isoformat()

        # emit() outside the with block is fine — variables still in scope
        emit("new_message", {
            "id":          msg_id,
            "sender_name": u.get("name", ""),
            "sender_roll": u.get("roll_number", ""),
            "sender_id":   str(u["_id"]),
            "room":        room,
            "content":     content,
            "media_type":  media_type,
            "media_url":   media_url,
            "created_at":  now_iso,  # same timestamp as DB
        }, to=room)


if __name__ == "__main__":
    app = create_app()
    socketio.run(app, debug=True, port=5000)