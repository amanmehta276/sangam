# config/settings.py
import os
from dotenv import load_dotenv
load_dotenv()  # MUST be before Config class — reads .env into os.getenv

class Config:
    SECRET_KEY       = os.getenv("SECRET_KEY", "sangam-dev-secret")
    JWT_EXPIRY_HOURS = 24

    # ── Database: mongo ────────────────────────────────────────
    DB_TYPE   = os.getenv("DB_TYPE", "mongo")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/sangam")

    # ── Student CSV (college DB crosscheck on signup) ──────────
    ROLL_DB_PATH = os.getenv("ROLL_DB_PATH", "data/students.csv")

    # ── OTP ───────────────────────────────────────────────────
    OTP_MODE     = os.getenv("OTP_MODE", "console")
    OTP_EXPIRY   = int(os.getenv("OTP_EXPIRY", "300"))
    TWILIO_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
    TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
    TWILIO_FROM  = os.getenv("TWILIO_FROM_NUMBER", "")

    # ── File uploads ──────────────────────────────────────────
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_FILE_MB   = int(os.getenv("MAX_FILE_MB", "10"))
    ALLOWED_EXT   = {"png","jpg","jpeg","gif","webp","mp4","mov","pdf","doc","docx","xlsx","zip"}

    COLLEGE_NAME  = "Chhattisgarh Institute of Technology"
    COLLEGE_SHORT = "CGIT"