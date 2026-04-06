# config/database.py
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import os

_client = None
_db     = None

def get_db():
    global _db
    if _db is None:
        raise RuntimeError("Database not initialised. Call init_db(app) first.")
    return _db

def init_db(app):
    global _client, _db

    uri = app.config.get("MONGO_URI", "mongodb://localhost:27017/sangam")

    try:
        _client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        _client.admin.command("ping")

        # FIX BUG 2: get_default_database() crashes if URI has no /dbname
        # Always use explicit db name as fallback
        try:
            _db = _client.get_default_database()
        except Exception:
            _db = _client["sangam"]

        print(f"✅ MongoDB connected → {_db.name}")

    # FIX BUG 13: ServerSelectionTimeoutError is NOT a subclass of ConnectionFailure
    except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
        print(f"❌ MongoDB connection failed: {e}")
        print("   Falling back to: mongodb://localhost:27017/sangam")
        _client = MongoClient("mongodb://localhost:27017/sangam",
                              serverSelectionTimeoutMS=3000)
        _db = _client["sangam"]

    # Indexes
    _db.users.create_index("roll_number", unique=True)
    _db.users.create_index("mobile")
    _db.messages.create_index([("room", 1), ("created_at", 1)])
    _db.messages.create_index("created_at")
    _db.posts.create_index("created_at")
    _db.groups.create_index("members")

    _seed_data(_db)
    return _db


def _seed_data(db):
    if db.users.count_documents({}) > 0:
        return

    print("🌱 Seeding from students.csv …")
    import csv, os as _os
    from werkzeug.security import generate_password_hash
    from datetime import datetime

    csv_path = _os.path.join(_os.path.dirname(__file__), "..", "data", "students.csv")
    if not _os.path.exists(csv_path):
        print("⚠️  students.csv not found, skipping seed")
        return

    docs = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            roll = row.get("roll_number", "").strip().upper()
            if not roll:
                continue
            role = ("admin"   if "ADMIN"  in roll else
                    "teacher" if "TCH"    in roll else
                    "alumni"  if "ALUMNI" in roll else "student")
            docs.append({
                "roll_number":     roll,
                "name":   (row.get("name") or "").strip(),
                "mobile": (row.get("mobile") or "").strip(),
                "email":  (row.get("email") or "").strip() or None,
                "branch": (row.get("branch") or "").strip(),
                "mobile_verified": False,
                "password_hash":   generate_password_hash("password123"),
                "batch_year":      int(row.get("batch_year", 0) or 0),
                "semester":        int(row.get("semester", 0) or 0),
                "role":            role,
                "trust_level":     "verified" if role in ("teacher","alumni","admin") else "new",
                "bio": None, "avatar_url": None, "linkedin_url": None,
                "github_url": None, "company": None, "skills": [],
                "created_at": datetime.utcnow(),
                "last_seen":  datetime.utcnow(),
            })

    if docs:
        db.users.insert_many(docs)
        print(f"✅ Seeded {len(docs)} users from CSV")