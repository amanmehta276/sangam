# # app.py
# from flask import Flask, send_from_directory, jsonify
# from flask_cors import CORS
# from flask_socketio import SocketIO, emit, join_room, leave_room
# from config.database import init_db
# from routes.auth   import auth_bp
# from routes.users  import users_bp
# from routes.posts  import posts_bp
# from routes.jobs   import jobs_bp
# from routes.chat   import chat_bp
# from routes.notifs import notifs_bp
# from routes.feed_external import feed_bp   # ← NEW
# import jwt, os

# socketio = SocketIO()


# def create_app():
#     app = Flask(__name__)
#     app.config.from_object("config.settings.Config")

#     os.makedirs(app.config.get("UPLOAD_FOLDER", "uploads"), exist_ok=True)

#     CORS(app, origins=[
#          "http://127.0.0.1:5500",
#          "http://localhost:5500",
#         "https://cgitsangam.netlify.app",
#         "https://sangam-z93f.onrender.com"
#     ], supports_credentials=True)

#     init_db(app)

#     for bp, prefix in [
#         (auth_bp,   "/api/auth"),   (users_bp, "/api/users"),
#         (posts_bp,  "/api/posts"),  (jobs_bp,  "/api/jobs"),
#         (chat_bp,   "/api/chat"),   (notifs_bp,"/api/notifications"),
#         (feed_bp,   "/api/feed/external"),     # ← NEW
#     ]:
#         app.register_blueprint(bp, url_prefix=prefix)

#     @app.route("/uploads/<path:filename>")
#     def serve_upload(filename):
#         return send_from_directory(app.config.get("UPLOAD_FOLDER", "uploads"), filename)

#     @app.route("/api/health")
#     def health():
#         return {"status": "ok", "db": "mongodb", "app": "Sangam v3"}, 200

#     socketio.init_app(app, cors_allowed_origins="*", async_mode="eventlet")
#     _socket_events(app)
#     return app


# def _get_user(token: str, secret: str):
#     from config.database import get_db
#     from bson import ObjectId
#     try:
#         data = jwt.decode(token, secret, algorithms=["HS256"])
#         return get_db().users.find_one({"_id": ObjectId(data["user_id"])})
#     except Exception:
#         return None


# def _socket_events(app):
#     from config.database import get_db
#     from datetime import datetime

#     @socketio.on("connect")
#     def on_connect(auth):
#         token  = (auth or {}).get("token", "").replace("Bearer ", "")
#         secret = app.config.get("SECRET_KEY", "")
#         with app.app_context():
#             u = _get_user(token, secret)
#         if not u:
#             return False
#         print(f"[WS] {u['name']} connected")

#     @socketio.on("join")
#     def on_join(data):
#         room   = data.get("room", "global")
#         token  = data.get("token", "").replace("Bearer ", "")
#         secret = app.config.get("SECRET_KEY", "")
#         with app.app_context():
#             u = _get_user(token, secret)
#         if not u:
#             return
#         join_room(room)

#     @socketio.on("leave")
#     def on_leave(data):
#         leave_room(data.get("room", "global"))

#     @socketio.on("message")
#     def on_message(data):
#         token      = data.get("token", "").replace("Bearer ", "")
#         room       = data.get("room", "global")
#         content    = data.get("content", "").strip()
#         media_type = data.get("media_type")
#         media_url  = data.get("media_url")
#         secret     = app.config.get("SECRET_KEY", "")

#         if not content and not media_url:
#             return

#         with app.app_context():
#             u = _get_user(token, secret)
#             if not u:
#                 emit("error", {"message": "Unauthorized"})
#                 return

#             db = get_db()
#             now = datetime.utcnow()
#             msg = {
#                 "sender_id":   u["_id"],
#                 "sender_name": u.get("name", ""),
#                 "sender_roll": u.get("roll_number", ""),
#                 "room":        room,
#                 "content":     content,
#                 "media_type":  media_type,
#                 "media_url":   media_url,
#                 "created_at":  now,
#             }
#             res = db.messages.insert_one(msg)
#             msg_id = str(res.inserted_id)
#             now_iso = now.isoformat()

#         emit("new_message", {
#             "id":          msg_id,
#             "sender_name": u.get("name", ""),
#             "sender_roll": u.get("roll_number", ""),
#             "sender_id":   str(u["_id"]),
#             "room":        room,
#             "content":     content,
#             "media_type":  media_type,
#             "media_url":   media_url,
#             "created_at":  now_iso,
#         }, to=room)


# if __name__ == "__main__":
#     app = create_app()
#     socketio.run(app, host="0.0.0.0", port=5000)






"""
app.py — Sangam Complete Backend
Run: python app.py
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from dotenv import load_dotenv

load_dotenv()

from utils.token import init_jwt
from routes.auth  import auth_bp
from routes.users import users_bp
from routes.posts import posts_bp
from routes.chat  import chat_bp, register_socket_events, init_socketio
from routes.jobs  import jobs_bp

def create_app():
    app = Flask(__name__)

    # ── CORS ──────────────────────────────────────────────
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    # ── JWT ───────────────────────────────────────────────
    init_jwt(app)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "sangam_secret_2025")

    # ── Blueprints ────────────────────────────────────────
    for bp in [auth_bp, users_bp, posts_bp, chat_bp, jobs_bp]:
        app.register_blueprint(bp)

    # ── Health ────────────────────────────────────────────
    @app.route("/")
    def index():
        return jsonify({
            "app":    "Sangam API 🔱",
            "status": "running",
            "routes": [
                "POST /api/auth/verify-roll",
                "POST /api/auth/signup",
                "POST /api/auth/check-roll",
                "POST /api/auth/login-verify",
                "GET  /api/auth/me",
                "GET  /api/users/me",
                "PUT  /api/users/me",
                "POST /api/users/me/avatar",
                "POST /api/users/me/wallpaper",
                "GET  /api/users",
                "GET  /api/posts",
                "POST /api/posts",
                "POST /api/posts/<id>/like",
                "GET  /api/jobs",
                "POST /api/jobs",
                "GET  /api/chat/rooms",
                "GET  /api/chat/rooms/<room>/messages",
                "POST /api/chat/dm/start",
                "POST /api/chat/groups",
            ]
        })

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": str(e)}), 500

    return app


if __name__ == "__main__":
    app     = create_app()
    sio     = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
    init_socketio(sio)
    register_socket_events(sio, os.getenv("JWT_SECRET_KEY", "sangam_jwt_2025"))

    port = int(os.getenv("PORT", 5000))
    print(f"""
╔══════════════════════════════════════════╗
║   🔱 Sangam Backend — CGIT Raipur       ║
║   http://localhost:{port}                 ║
║   DEV_MODE : {os.getenv('DEV_MODE','true')}                      ║
║   MongoDB  : {os.getenv('MONGO_URI','mongodb://localhost/sangam')[:30]}  ║
╚══════════════════════════════════════════╝
    """)
    sio.run(app, debug=True, port=port, host="0.0.0.0", allow_unsafe_werkzeug=True)