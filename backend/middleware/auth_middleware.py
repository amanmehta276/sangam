# middleware/auth_middleware.py
import jwt, functools
from datetime import datetime, timedelta
from bson import ObjectId
from flask import request, jsonify, current_app
from config.database import get_db


def generate_token(user_id: str) -> str:
    payload = {
        "user_id": str(user_id),
        "exp": datetime.utcnow() + timedelta(hours=current_app.config["JWT_EXPIRY_HOURS"]),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "):
            token = ah.split(" ")[1]
        if not token:
            return jsonify({"error": "Token missing. Please login."}), 401
        try:
            data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
            db   = get_db()
            user = db.users.find_one({"_id": ObjectId(data["user_id"])})
            if not user:
                raise ValueError("User not found")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please login again."}), 401
        except Exception as e:
            return jsonify({"error": "Invalid token.", "detail": str(e)}), 401
        return f(user, *args, **kwargs)
    return decorated


def role_required(*roles):
    """BUG FIX: was missing entirely — caused ImportError crash on startup."""
    def wrapper(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            token = None
            ah = request.headers.get("Authorization", "")
            if ah.startswith("Bearer "):
                token = ah.split(" ")[1]
            if not token:
                return jsonify({"error": "Token missing"}), 401
            try:
                data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
                user = get_db().users.find_one({"_id": ObjectId(data["user_id"])})
                if not user:
                    raise ValueError("User not found")
            except Exception as e:
                return jsonify({"error": "Invalid token", "detail": str(e)}), 401
            if user.get("role") not in roles:
                return jsonify({"error": f"Access denied. Required: {list(roles)}"}), 403
            return f(user, *args, **kwargs)
        return decorated
    return wrapper


def user_to_dict(u: dict, public=True) -> dict:
    """Serialize a MongoDB user document safely."""
    d = {
        "id":           str(u["_id"]),
        "name":         u.get("name",""),
        "roll_number":  u.get("roll_number",""),
        "branch":       u.get("branch",""),
        "batch_year":   u.get("batch_year"),
        "semester":     u.get("semester"),
        "role":         u.get("role","student"),
        "trust_level":  u.get("trust_level","new"),
        "bio":          u.get("bio"),
        "avatar_url":   u.get("avatar_url"),
        "linkedin_url": u.get("linkedin_url"),
        "github_url":   u.get("github_url"),
        "company":      u.get("company"),
        "skills":       u.get("skills", []),
        "mobile_verified": u.get("mobile_verified", False),
        "mobile_masked":   ("XXXXXXX" + u["mobile"][-4:]) if u.get("mobile") and len(u.get("mobile","")) >= 4 else "Not on file",
        "created_at":   u["created_at"].isoformat() if u.get("created_at") else None,
    }
    if not public:
        d["email"]  = u.get("email")
        d["mobile"] = u.get("mobile")
    return d