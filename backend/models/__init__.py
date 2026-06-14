from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure
from config import cfg
import sys

try:
    client = MongoClient(cfg.MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command("ping")
    db = client["sangam"]
    print("[DB] MongoDB connected ✓")
except ConnectionFailure as e:
    print(f"[DB] MongoDB connection FAILED: {e}")
    sys.exit(1)

# ── Collections ───────────────────────────────────────────
users_col         = db["users"]
posts_col         = db["posts"]
jobs_col          = db["jobs"]
messages_col      = db["messages"]
rooms_col         = db["rooms"]
notifications_col = db["notifications"]
otps_col          = db["otps"]

# ── Indexes ───────────────────────────────────────────────
users_col.create_index([("roll_number", ASCENDING)], unique=True)
users_col.create_index([("mobile", ASCENDING)])
posts_col.create_index([("created_at", DESCENDING)])
jobs_col.create_index([("created_at", DESCENDING)])
messages_col.create_index([("room", ASCENDING), ("created_at", ASCENDING)])
otps_col.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
