"""
=============================================================
  SANGAM — MongoDB Schema Reference
  File: backend/models/schema.py
  
  Ye file actual code nahi hai — sirf schema reference hai.
  Har collection ka exact document structure yahan define hai.
=============================================================
"""

# ═══════════════════════════════════════════════════════════
# COLLECTION 1: users
# Database: sangam
# Index: roll_number (unique), mobile
# ═══════════════════════════════════════════════════════════
USER_SCHEMA = {
    "_id":             "ObjectId — auto",           # MongoDB auto

    # ── Identity (from CSV on signup) ─────────────────────
    "roll_number":     "str  — e.g. CSE22101",      # UNIQUE, from CSV
    "name":            "str  — full name",
    "mobile":          "str  — 10 digit",
    "branch":          "str  — CSE / EEE / ME / CE / ECE",
    "batch_year":      "str  — e.g. 2022",
    "role":            "str  — student | alumni | teacher | admin",
    "trust_level":     "str  — new | partial | verified",

    # ── Profile (user fills after signup) ─────────────────
    "bio":             "str  — about me text",
    "company":         "str  — current company or role",
    "location":        "str  — e.g. Raipur, India",
    "email":           "str  — personal email",
    "phone":           "str  — alternate phone",
    "skills":          "list[str] — ['React','Python','DSA']",
    "linkedin_url":    "str  — full LinkedIn URL",
    "github_url":      "str  — full GitHub URL",
    "avatar_url":      "str  — /uploads/avatars/abc.jpg",
    "wallpaper_url":   "str  — /uploads/wallpapers/xyz.jpg",

    # ── Alumni extra fields ────────────────────────────────
    "graduation_year": "str  — e.g. 2022  (alumni only)",
    "alumni_position": "str  — e.g. SDE-2 (alumni only)",
    "alumni_company":  "str  — e.g. Google (alumni only)",

    # ── Meta ──────────────────────────────────────────────
    "created_at":      "datetime — signup time",
    "updated_at":      "datetime — last profile update",
}

# Example document:
USER_EXAMPLE = {
    "_id":             "64f1a2b3c4d5e6f7a8b9c0d1",
    "roll_number":     "CSE22101",
    "name":            "Arjun Sharma",
    "mobile":          "9876543210",
    "branch":          "CSE",
    "batch_year":      "2022",
    "role":            "student",
    "trust_level":     "partial",
    "bio":             "Aspiring SWE | DSA enthusiast",
    "company":         "Intern @ TCS",
    "location":        "Raipur, India",
    "email":           "arjun@gmail.com",
    "phone":           "9876543210",
    "skills":          ["React", "Python", "DSA"],
    "linkedin_url":    "https://linkedin.com/in/arjun",
    "github_url":      "https://github.com/arjun",
    "avatar_url":      "/uploads/avatars/abc123.jpg",
    "wallpaper_url":   "/uploads/wallpapers/xyz456.jpg",
    "graduation_year": "",
    "alumni_position": "",
    "alumni_company":  "",
    "created_at":      "2024-01-15T10:30:00Z",
    "updated_at":      "2024-06-01T14:22:00Z",
}


# ═══════════════════════════════════════════════════════════
# COLLECTION 2: posts
# Database: sangam
# Index: created_at (desc)
# ═══════════════════════════════════════════════════════════
POST_SCHEMA = {
    "_id":        "ObjectId — auto",

    # ── Author snapshot (denormalized for speed) ──────────
    "author": {
        "id":          "str  — user ObjectId as string",
        "name":        "str",
        "roll_number": "str",
        "branch":      "str",
        "batch_year":  "str",
        "role":        "str",
        "trust_level": "str",
        "avatar_url":  "str",
    },

    # ── Content ───────────────────────────────────────────
    "post_type":  "str  — update | job | question | win | event | tip",
    "content":    "str  — post body text",
    "tags":       "list[str] — ['DSA','Placement']",
    "media_url":  "str  — optional image/video URL",
    "media_type": "str  — image | video | None",

    # ── Engagement ────────────────────────────────────────
    "likes":      "int  — like count",
    "liked_by":   "list[str] — user IDs who liked",
    "comments":   "int  — comment count (future)",

    # ── Meta ──────────────────────────────────────────────
    "created_at": "datetime",
    "updated_at": "datetime",
}

POST_EXAMPLE = {
    "_id":      "64f1a2b3c4d5e6f7a8b9c0d2",
    "author": {
        "id":          "64f1a2b3c4d5e6f7a8b9c0d1",
        "name":        "Arjun Sharma",
        "roll_number": "CSE22101",
        "branch":      "CSE",
        "batch_year":  "2022",
        "role":        "student",
        "trust_level": "partial",
        "avatar_url":  "/uploads/avatars/abc123.jpg",
    },
    "post_type":  "tip",
    "content":    "Always mention time & space complexity in interviews!",
    "tags":       ["DSA", "Placement"],
    "media_url":  None,
    "media_type": None,
    "likes":      15,
    "liked_by":   ["64f1a2b3...", "64f1a2b4..."],
    "created_at": "2024-06-01T10:00:00Z",
    "updated_at": "2024-06-01T10:00:00Z",
}


# ═══════════════════════════════════════════════════════════
# COLLECTION 3: jobs
# Database: sangam
# Index: created_at (desc)
# ═══════════════════════════════════════════════════════════
JOB_SCHEMA = {
    "_id":         "ObjectId — auto",

    "title":       "str  — e.g. SWE Intern",
    "company":     "str  — e.g. Google",
    "location":    "str  — e.g. Bangalore / Remote",
    "job_type":    "str  — internship | fulltime | parttime | contract",
    "salary":      "str  — e.g. ₹80k/mo (optional)",
    "description": "str  — job details",
    "skills":      "list[str] — required skills",
    "referral":    "bool — poster can give referral",
    "apply_link":  "str  — external apply URL (optional)",

    "posted_by": {
        "id":   "str  — user ObjectId",
        "name": "str",
    },

    "created_at":  "datetime",
    "updated_at":  "datetime",
}

JOB_EXAMPLE = {
    "_id":         "64f1a2b3c4d5e6f7a8b9c0d3",
    "title":       "SWE Intern",
    "company":     "Google",
    "location":    "Bangalore",
    "job_type":    "internship",
    "salary":      "₹80k/mo",
    "description": "Strong DSA + Go needed. 3 months.",
    "skills":      ["DSA", "Go", "System Design"],
    "referral":    True,
    "apply_link":  "https://careers.google.com/abc",
    "posted_by":   {"id": "64f1a2b3...", "name": "Rahul Verma"},
    "created_at":  "2024-06-01T09:00:00Z",
    "updated_at":  "2024-06-01T09:00:00Z",
}


# ═══════════════════════════════════════════════════════════
# COLLECTION 4: rooms  (chat groups + DMs)
# Database: sangam
# ═══════════════════════════════════════════════════════════
ROOM_SCHEMA = {
    "_id":          "ObjectId — auto",

    "name":         "str  — group name (empty for DMs)",
    "type":         "str  — group | dm",
    "members":      "list[str] — user ObjectId strings",
    "admin":        "str  — creator user ID (group only)",

    # ── Preview for room list ─────────────────────────────
    "last_message": "str  — last message preview (max 100 chars)",
    "last_time":    "datetime — time of last message",

    "created_at":   "datetime",
}

ROOM_EXAMPLE_GROUP = {
    "_id":          "64f1a2b3c4d5e6f7a8b9c0d4",
    "name":         "CSE Batch 2022",
    "type":         "group",
    "members":      ["64f1a2b3...", "64f1a2b4...", "64f1a2b5..."],
    "admin":        "64f1a2b3...",
    "last_message": "Anyone up for the placement drive?",
    "last_time":    "2024-06-01T15:30:00Z",
    "created_at":   "2024-01-01T00:00:00Z",
}

ROOM_EXAMPLE_DM = {
    "_id":          "64f1a2b3c4d5e6f7a8b9c0d5",
    "name":         "",
    "type":         "dm",
    "members":      ["64f1a2b3...", "64f1a2b6..."],   # exactly 2
    "admin":        None,
    "last_message": "Hey! Can you refer me?",
    "last_time":    "2024-06-01T16:00:00Z",
    "created_at":   "2024-05-20T10:00:00Z",
}


# ═══════════════════════════════════════════════════════════
# COLLECTION 5: messages
# Database: sangam
# Index: room + created_at (asc)
# ═══════════════════════════════════════════════════════════
MESSAGE_SCHEMA = {
    "_id":         "ObjectId — auto",

    "room":        "str  — room ObjectId OR system room id ('global','placements')",
    "sender_id":   "str  — user ObjectId",
    "sender_name": "str  — denormalized for speed",
    "sender_roll": "str  — roll number",
    "avatar_url":  "str  — sender avatar",

    # ── Content ───────────────────────────────────────────
    "content":     "str  — text content",
    "media_type":  "str  — image | video | file | None",
    "media_url":   "str  — /uploads/media/abc.jpg | None",

    # ── Reply ─────────────────────────────────────────────
    "reply_to": {
        "id":          "str  — parent message ObjectId",
        "sender_name": "str",
        "content":     "str  — snippet of replied message",
    },

    # ── Reactions ─────────────────────────────────────────
    "reactions": [
        {"emoji": "str", "count": "int", "users": "list[str]"}
    ],

    "status":      "str  — sent | delivered | seen",
    "created_at":  "datetime",
}

MESSAGE_EXAMPLE = {
    "_id":         "64f1a2b3c4d5e6f7a8b9c0d6",
    "room":        "global",
    "sender_id":   "64f1a2b3...",
    "sender_name": "Arjun Sharma",
    "sender_roll": "CSE22101",
    "avatar_url":  "/uploads/avatars/abc123.jpg",
    "content":     "Hey everyone! Welcome to Sangam 👋",
    "media_type":  None,
    "media_url":   None,
    "reply_to":    None,
    "reactions":   [{"emoji": "❤️", "count": 3, "users": ["uid1","uid2","uid3"]}],
    "status":      "delivered",
    "created_at":  "2024-06-01T10:05:00Z",
}


# ═══════════════════════════════════════════════════════════
# COLLECTION 6: notifications
# Database: sangam
# Index: user_id, created_at (desc)
# ═══════════════════════════════════════════════════════════
NOTIFICATION_SCHEMA = {
    "_id":        "ObjectId — auto",

    "user_id":    "str  — recipient user ObjectId",
    "notif_type": "str  — system | job | message | post | mention",
    "title":      "str  — short heading",
    "body":       "str  — detail text",
    "action_url": "str  — where to go on click (optional)",
    "is_read":    "bool — False by default",

    "created_at": "datetime",
}

NOTIFICATION_EXAMPLE = {
    "_id":        "64f1a2b3c4d5e6f7a8b9c0d7",
    "user_id":    "64f1a2b3...",
    "notif_type": "job",
    "title":      "New Job: SWE Intern at Google",
    "body":       "Rahul Verma posted a new opportunity with referral.",
    "action_url": "/jobs",
    "is_read":    False,
    "created_at": "2024-06-01T11:00:00Z",
}


# ═══════════════════════════════════════════════════════════
# COLLECTION 7: otps  (TTL — auto delete after expiry)
# Database: sangam
# Index: expires_at (TTL — auto delete)
# ═══════════════════════════════════════════════════════════
OTP_SCHEMA = {
    "_id":        "ObjectId — auto",

    "identifier": "str  — roll_number",
    "purpose":    "str  — login | signup",
    "otp":        "str  — 6 digit string",
    "expires_at": "datetime — created_at + OTP_EXPIRY seconds",
    "verified":   "bool — False until used",
    "attempts":   "int  — wrong attempt count (max 5)",
}

OTP_EXAMPLE = {
    "_id":        "64f1a2b3c4d5e6f7a8b9c0d8",
    "identifier": "CSE22101",
    "purpose":    "login",
    "otp":        "482951",
    "expires_at": "2024-06-01T10:10:00Z",
    "verified":   False,
    "attempts":   0,
}


# ═══════════════════════════════════════════════════════════
# SUMMARY TABLE
# ═══════════════════════════════════════════════════════════
"""
Collection        | Purpose                      | Key Indexes
------------------|------------------------------|---------------------------
users             | All user accounts + profiles | roll_number (unique), mobile
posts             | Feed posts                   | created_at desc
jobs              | Job listings                 | created_at desc
rooms             | Chat groups + DMs            | members, type
messages          | Chat messages                | room + created_at asc
notifications     | User notifications           | user_id, created_at desc
otps              | Temporary OTPs               | expires_at (TTL auto-delete)
"""
