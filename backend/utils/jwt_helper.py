import jwt
import datetime
from config import cfg

def create_token(user_id: str, roll: str, role: str) -> str:
    payload = {
        "sub":  str(user_id),
        "roll": roll,
        "role": role,
        "iat":  datetime.datetime.utcnow(),
        "exp":  datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    return jwt.encode(payload, cfg.SECRET_KEY, algorithm="HS256")

def decode_token(token: str) -> dict:
    """Returns payload dict or raises jwt.InvalidTokenError"""
    return jwt.decode(token, cfg.SECRET_KEY, algorithms=["HS256"])
