import random
import datetime
from models import otps_col
from config import cfg

def generate_otp(identifier: str, purpose: str = "auth") -> str:
    """Generate 6-digit OTP, store in DB, return it"""
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=cfg.OTP_EXPIRY)

    # Upsert — one active OTP per identifier+purpose
    otps_col.update_one(
        {"identifier": identifier, "purpose": purpose},
        {"$set": {
            "otp":        otp,
            "expires_at": expires_at,
            "verified":   False,
            "attempts":   0,
        }},
        upsert=True
    )

    # Deliver OTP
    if cfg.OTP_MODE == "console":
        print(f"\n{'='*40}")
        print(f"  OTP for {identifier} [{purpose}]: {otp}")
        print(f"  Expires in {cfg.OTP_EXPIRY}s")
        print(f"{'='*40}\n")
    # TODO: elif cfg.OTP_MODE == "sms": send via Twilio/MSG91
    # TODO: elif cfg.OTP_MODE == "email": send via SMTP

    return otp

def verify_otp(identifier: str, otp: str, purpose: str = "auth") -> tuple[bool, str]:
    """Returns (success, message)"""
    doc = otps_col.find_one({
        "identifier": identifier,
        "purpose":    purpose,
        "verified":   False,
    })
    if not doc:
        return False, "OTP not found or already used"
    if doc["expires_at"] < datetime.datetime.utcnow():
        otps_col.delete_one({"_id": doc["_id"]})
        return False, "OTP expired"
    if doc.get("attempts", 0) >= 5:
        return False, "Too many attempts"
    if doc["otp"] != str(otp).strip():
        otps_col.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        return False, "Wrong OTP"

    # Mark verified + delete
    otps_col.delete_one({"_id": doc["_id"]})
    return True, "OK"
