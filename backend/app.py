# ============================================================
#  SANGAM — Python/Flask Backend
#  app.py  (entry point)
# ============================================================
#
#  Run:  python app.py
#  API base:  http://localhost:5000/api
#
# ============================================================
# CORS=cross-origin resource sharing

from flask import Flask
from flask_cors import CORS
from config.database import init_db
from routes.auth    import auth_bp
from routes.users   import users_bp
from routes.posts   import posts_bp
from routes.jobs    import jobs_bp
from routes.chat    import chat_bp
from routes.notifs  import notifs_bp

def create_app():
    app = Flask(__name__)
    CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:5500"])

    # ── Load config ──────────────────────────────────────────
    app.config.from_object("config.settings.Config")

    # ── Init database ────────────────────────────────────────
    init_db(app)

    # ── Register blueprints ──────────────────────────────────
    app.register_blueprint(auth_bp,   url_prefix="/api/auth")
    app.register_blueprint(users_bp,  url_prefix="/api/users")
    app.register_blueprint(posts_bp,  url_prefix="/api/posts")
    app.register_blueprint(jobs_bp,   url_prefix="/api/jobs")
    app.register_blueprint(chat_bp,   url_prefix="/api/chat")
    app.register_blueprint(notifs_bp, url_prefix="/api/notifications")

    @app.route("/api/health")
    def health():
        return {"status": "ok", "app": "Sangam API"}, 200

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)