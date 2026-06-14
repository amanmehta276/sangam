from functools import wraps
from flask import request, jsonify
from utils.jwt_helper import decode_token
import jwt

def login_required(f):
    """JWT auth decorator — injects current_user into route"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization","")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing token"}), 401
        token = auth.split(" ", 1)[1]
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        request.current_user = payload
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    """Must be admin role"""
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if request.current_user.get("role") not in ("admin",):
            return jsonify({"error": "Admin only"}), 403
        return f(*args, **kwargs)
    return decorated
