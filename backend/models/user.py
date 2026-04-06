# models/user.py

from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime


class User:
    def __init__(self, data):
        self.id            = str(data.get("_id"))
        self.name          = data.get("name")
        self.roll_number   = data.get("roll_number")

        self.mobile        = data.get("mobile")
        self.mobile_verified = data.get("mobile_verified", False)

        self.email         = data.get("email")
        self.password_hash = data.get("password_hash")

        self.branch        = data.get("branch")
        self.batch_year    = data.get("batch_year")
        self.semester      = data.get("semester")

        self.role          = data.get("role", "student")
        self.trust_level   = data.get("trust_level", "new")

        self.bio           = data.get("bio")
        self.avatar_url    = data.get("avatar_url")
        self.linkedin_url  = data.get("linkedin_url")
        self.github_url    = data.get("github_url")
        self.company       = data.get("company")
        self.skills        = data.get("skills", [])

        self.created_at    = data.get("created_at", datetime.utcnow())
        self.last_seen     = data.get("last_seen", datetime.utcnow())

    # 🔐 Password
    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return bool(self.password_hash and check_password_hash(self.password_hash, raw))

    # 📱 Mobile mask
    def mobile_masked(self):
        if self.mobile and len(self.mobile) >= 4:
            return "XXXXXXX" + self.mobile[-4:]
        return "Not on file"

    # 📦 Convert to JSON
    def to_dict(self, public=True):
        d = {
            "id": self.id,
            "name": self.name,
            "roll_number": self.roll_number,
            "branch": self.branch,
            "batch_year": self.batch_year,
            "semester": self.semester,
            "role": self.role,
            "trust_level": self.trust_level,
            "bio": self.bio,
            "avatar_url": self.avatar_url,
            "linkedin_url": self.linkedin_url,
            "github_url": self.github_url,
            "company": self.company,
            "skills": self.skills,
            "mobile_verified": self.mobile_verified,
            "mobile_masked": self.mobile_masked(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if not public:
            d["email"] = self.email
            d["mobile"] = self.mobile

        return d