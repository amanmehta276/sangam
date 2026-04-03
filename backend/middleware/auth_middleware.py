# middleware/auth_middleware.py
# ============================================================
#  JWT helper — sign tokens and protect routes
# ============================================================

import jwt
import functools
from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from models.user import User


def generate_token(user_id: int) -> str:
    payload = {
        "user_id": user_id,
        "exp":     datetime.utcnow() + timedelta(hours=current_app.config["JWT_EXPIRY_HOURS"]),
        "iat":     datetime.utcnow(),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def token_required(f):
    """Decorator — blocks request if no valid JWT in Authorization header."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"error": "Token missing"}), 401

        try:
            data    = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
            current_user = User.query.get(data["user_id"])
            if not current_user:
                raise ValueError("User not found")
        except Exception as e:
            return jsonify({"error": "Token invalid", "detail": str(e)}), 401

        return f(current_user, *args, **kwargs)
    return decorated


def role_required(*roles):
    """Decorator — allow only specific roles after token check."""
    def wrapper(f):
        @functools.wraps(f)
        @token_required
        def decorated(current_user, *args, **kwargs):
            if current_user.role not in roles:
                return jsonify({"error": f"Access denied. Requires: {roles}"}), 403
            return f(current_user, *args, **kwargs)
        return decorated
    return wrapper