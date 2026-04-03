# config/database.py
# ============================================================
#  Database initialisation.
#
#  RIGHT NOW   → SQLite  (works instantly, no setup)
#  YOUR REAL DB → swap the engine URL below (see comments)
# ============================================================

from flask_sqlalchemy import SQLAlchemy
import os

db = SQLAlchemy()   # shared instance — import this everywhere

def init_db(app):
    """Attach SQLAlchemy to the Flask app."""

    db_type = app.config.get("DATABASE_TYPE", "sqlite")

    if db_type == "sqlite":
        # ── EXAMPLE: SQLite ──────────────────────────────────
        #  Great for development / demo. File stored locally.
        path = app.config["SQLITE_PATH"]
        app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{path}"

    elif db_type == "postgres":
        # ── PRODUCTION: PostgreSQL ───────────────────────────
        #  1. pip install psycopg2-binary
        #  2. Set env var:  DATABASE_URL=postgresql://user:pw@host/dbname
        app.config["SQLALCHEMY_DATABASE_URI"] = app.config["POSTGRES_URL"]

    elif db_type == "mysql":
        # ── PRODUCTION: MySQL ────────────────────────────────
        #  1. pip install PyMySQL
        #  2. Set env var:  MYSQL_URL=mysql+pymysql://user:pw@host/dbname
        app.config["SQLALCHEMY_DATABASE_URI"] = app.config["MYSQL_URL"]

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    # Auto-create tables on first run
    with app.app_context():
        from models import user, post, job, chat, notification  # noqa
        db.create_all()
        _seed_example_data()   # loads example students

    return db


# ── Seed example data ─────────────────────────────────────────
def _seed_example_data():
    """
    Inserts a small example dataset so the app works immediately.
    In production this is replaced by your real student CSV/DB.
    """
    from models.user import User

    if User.query.count() > 0:
        return   # already seeded

    examples = [
        {"name": "Arjun Sharma",   "roll": "CSE22101", "branch": "CSE", "batch": 2022, "role": "student"},
        {"name": "Priya Singh",    "roll": "EEE22045", "branch": "EEE", "batch": 2022, "role": "student"},
        {"name": "Rahul Verma",    "roll": "CSE20011", "branch": "CSE", "batch": 2020, "role": "alumni"},
        {"name": "Kiran Mehta",    "roll": "ME19032",  "branch": "ME",  "batch": 2019, "role": "alumni"},
        {"name": "Dr. S. Tiwari",  "roll": "TCH001",   "branch": "CSE", "batch": 2005, "role": "teacher"},
        {"name": "Admin",          "roll": "ADMIN001",  "branch": "",    "batch": 0,    "role": "admin"},
    ]

    for e in examples:
        u = User(
            name=e["name"], roll_number=e["roll"],
            branch=e["branch"], batch_year=e["batch"],
            role=e["role"],
            trust_level="verified" if e["role"] in ("alumni","teacher","admin") else "new"
        )
        u.set_password("password123")   # default demo password
        db.session.add(u)

    db.session.commit()
    print("✅  Sangam: example data seeded.")