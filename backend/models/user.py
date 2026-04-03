# models/user.py
# ============================================================
#  User model — maps to the `users` table.
#  This is the central schema for the entire platform.
# ============================================================

from config.database import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime


class User(db.Model):
    __tablename__ = "users"

    id           = db.Column(db.Integer, primary_key=True)
    name         = db.Column(db.String(120), nullable=False)
    roll_number  = db.Column(db.String(30),  unique=True, nullable=False)
    email        = db.Column(db.String(120), unique=True, nullable=True)
    password_hash= db.Column(db.String(256), nullable=True)

    # ── Academic info ────────────────────────────────────────
    branch       = db.Column(db.String(20),  nullable=True)
    batch_year   = db.Column(db.Integer,     nullable=True)
    semester     = db.Column(db.Integer,     nullable=True)

    # ── Role: student | alumni | teacher | admin ─────────────
    role         = db.Column(db.String(20),  default="student")

    # ── Trust: new | partial | verified ─────────────────────
    trust_level  = db.Column(db.String(20),  default="new")

    # ── Profile ───────────────────────────────────────────────
    bio          = db.Column(db.Text,        nullable=True)
    avatar_url   = db.Column(db.String(255), nullable=True)
    linkedin_url = db.Column(db.String(255), nullable=True)
    github_url   = db.Column(db.String(255), nullable=True)
    company      = db.Column(db.String(120), nullable=True)  # for alumni
    skills       = db.Column(db.Text,        nullable=True)  # CSV: "Python,React,DSA"

    # ── Timestamps ───────────────────────────────────────────
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen    = db.Column(db.DateTime, default=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────
    posts        = db.relationship("Post",   backref="author",   lazy=True)
    jobs         = db.relationship("Job",    backref="poster",   lazy=True)

    # ── Password helpers ──────────────────────────────────────
    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, raw)

    def to_dict(self, public=True):
        """Serialise for JSON response."""
        d = {
            "id":          self.id,
            "name":        self.name,
            "roll_number": self.roll_number,
            "branch":      self.branch,
            "batch_year":  self.batch_year,
            "role":        self.role,
            "trust_level": self.trust_level,
            "bio":         self.bio,
            "avatar_url":  self.avatar_url,
            "linkedin_url":self.linkedin_url,
            "github_url":  self.github_url,
            "company":     self.company,
            "skills":      self.skills.split(",") if self.skills else [],
            "created_at":  self.created_at.isoformat(),
        }
        if not public:
            d["email"] = self.email
        return d