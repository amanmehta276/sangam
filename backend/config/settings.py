# config/settings.py
# ============================================================
#  All app configuration in one place.
#  In production, load secrets from environment variables.
# ============================================================

import os

class Config:
    # ── JWT ──────────────────────────────────────────────────
    SECRET_KEY = os.getenv("SECRET_KEY", "sangam-dev-secret-change-in-prod")
    JWT_EXPIRY_HOURS = 24

    # ── Database ─────────────────────────────────────────────
    #
    #  EXAMPLE DATABASE  →  uses SQLite so you can run with zero setup.
    #  YOUR REAL DATABASE →  see HOW_TO_CONNECT.md  (generated below)
    #
    DATABASE_TYPE = os.getenv("DB_TYPE", "sqlite")   # "sqlite" | "postgres" | "mysql"

    # SQLite (example — file-based, no install needed)
    SQLITE_PATH = os.getenv("SQLITE_PATH", "sangam_example.db")

    # PostgreSQL (your production DB)
    POSTGRES_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/sangam_db"
    )

    # MySQL
    MYSQL_URL = os.getenv(
        "MYSQL_URL",
        "mysql+pymysql://user:password@localhost:3306/sangam_db"
    )

    # ── Roll-number DB (YOUR COLLEGE DATA) ───────────────────
    #  Point this to your Excel / CSV / separate DB of students
    ROLL_DB_PATH = os.getenv("ROLL_DB_PATH", "data/students.csv")

    # ── College info ─────────────────────────────────────────
    COLLEGE_NAME  = "Chhattisgarh Institute of Technology"
    COLLEGE_SHORT = "CIT"