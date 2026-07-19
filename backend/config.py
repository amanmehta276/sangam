import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY       = os.getenv("SECRET_KEY", "change-me")
    MONGO_URI        = os.getenv("MONGO_URI")
    ROLL_DB_PATH     = os.getenv("ROLL_DB_PATH", "data/students.csv")
    OTP_MODE         = os.getenv("OTP_MODE", "console")   # console | sms | email
    OTP_EXPIRY       = int(os.getenv("OTP_EXPIRY", 300))  # seconds
    UPLOAD_FOLDER    = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_FILE_MB      = int(os.getenv("MAX_FILE_MB", 10))
    MAX_CONTENT_LEN  = MAX_FILE_MB * 1024 * 1024
    PORT             = int(os.getenv("PORT", 5000))
    FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://127.0.0.1:5500")
    ALLOWED_IMG_EXT  = {"png", "jpg", "jpeg", "gif", "webp"}
    ALLOWED_FILE_EXT = {"pdf", "doc", "docx", "mp4", "mov", "webm"}

cfg = Config()

# ── Fail fast with a clear message instead of a confusing pymongo
#    crash later (issue #1) ─────────────────────────────────────
if not cfg.MONGO_URI:
    raise RuntimeError(
        "MONGO_URI env var is not set. Create a .env file (see .gitignore) "
        "or set MONGO_URI in your Render/hosting dashboard, e.g.:\n"
        "  MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/sangam"
    )
