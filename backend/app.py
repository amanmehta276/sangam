"""
Sangam Backend — Flask
Run: python app.py
"""
import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import cfg

# ── App setup ─────────────────────────────────────────────
app = Flask(__name__, static_folder=None)
app.config["SECRET_KEY"]       = cfg.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = cfg.MAX_CONTENT_LEN

CORS(app, origins=[cfg.FRONTEND_URL, "http://localhost:5500", "http://127.0.0.1:5500", "https://cgitsangam.netlify.app",
                   "null"],  # allow file:// for local dev
     supports_credentials=True)

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
# RUN
# ════════════════════════════════════════════════════════════
if __name__ == "__main__":
    os.makedirs(cfg.UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(f"{cfg.UPLOAD_FOLDER}/avatars",    exist_ok=True)
    os.makedirs(f"{cfg.UPLOAD_FOLDER}/wallpapers", exist_ok=True)
    os.makedirs(f"{cfg.UPLOAD_FOLDER}/media",      exist_ok=True)
    print(f"\n{'='*50}")
    print(f"  Sangam Backend starting on port {cfg.PORT}")
    print(f"  Frontend: {cfg.FRONTEND_URL}")
    print(f"  OTP mode: {cfg.OTP_MODE}")
    print(f"{'='*50}\n")
    app.run(host="0.0.0.0", port=cfg.PORT, debug=False)
