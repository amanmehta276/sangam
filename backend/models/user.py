from datetime import datetime
from bson import ObjectId
from models import users_col

class User:
    @staticmethod
    def create(data: dict) -> dict:
        now = datetime.utcnow()
        doc = {
            "roll_number":     data.get("roll_number","").upper().strip(),
            "name":            data.get("name","").strip(),
            "mobile":          data.get("mobile","").strip(),
            "branch":          data.get("branch",""),
            "batch_year":      data.get("batch_year",""),
            "role":            data.get("role","student"),
            "trust_level":     "new",
            "bio":             "",
            "company":         "",
            "location":        "",
            "email":           "",
            "phone":           "",
            "skills":          [],
            "linkedin_url":    "",
            "github_url":      "",
            "avatar_url":      "",
            "wallpaper_url":   "",
            "graduation_year": "",
            "alumni_position": "",
            "alumni_company":  "",
            "created_at":      now,
            "updated_at":      now,
        }
        result = users_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    @staticmethod
    def find_by_roll(roll: str) -> dict | None:
        return users_col.find_one({"roll_number": roll.upper().strip()})

    @staticmethod
    def find_by_id(uid: str) -> dict | None:
        try:
            return users_col.find_one({"_id": ObjectId(uid)})
        except Exception:
            return None

    @staticmethod
    def update(uid: str, data: dict) -> dict | None:
        allowed = [
            "bio","company","location","email","phone","skills",
            "linkedin_url","github_url","avatar_url","wallpaper_url",
            "graduation_year","alumni_position","alumni_company","trust_level",
        ]
        update = {k: data[k] for k in allowed if k in data}
        if "skills" in update and isinstance(update["skills"], str):
            update["skills"] = [s.strip() for s in update["skills"].split(",") if s.strip()]
        update["updated_at"] = datetime.utcnow()
        users_col.update_one({"_id": ObjectId(uid)}, {"$set": update})
        return User.find_by_id(uid)

    @staticmethod
    def to_dict(u: dict) -> dict:
        if not u:
            return {}
        u = dict(u)
        u["id"] = str(u.pop("_id"))
        u.pop("password", None)
        return u

    @staticmethod
    def search(q: str = "", role: str = "", branch: str = "", limit: int = 50) -> list:
        filt = {}
        if role:   filt["role"]   = role
        if branch: filt["branch"] = branch
        if q:
            filt["$or"] = [
                {"name":        {"$regex": q, "$options": "i"}},
                {"roll_number": {"$regex": q, "$options": "i"}},
                {"company":     {"$regex": q, "$options": "i"}},
                {"skills":      {"$elemMatch": {"$regex": q, "$options": "i"}}},
            ]
        docs = list(users_col.find(filt, {"password": 0}).limit(min(limit, 100)))
        return [User.to_dict(u) for u in docs]
