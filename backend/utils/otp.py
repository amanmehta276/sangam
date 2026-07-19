import random
import datetime
from models import otps_col
from config import cfg

RESEND_COOLDOWN_SECONDS = 30

def generate_otp(identifier: str, purpose: str = "auth") -> str:
    """Generate 6-digit OTP, store in DB, return it.

    Raises ValueError if called again too soon for the same
    identifier+purpose (basic rate limiting to stop OTP spam).
    """
    existing = otps_col.find_one({"identifier": identifier, "purpose": purpose})
    if existing:
        age = (datetime.datetime.utcnow() - existing.get(
            "created_at", datetime.datetime.utcnow() - datetime.timedelta(seconds=RESEND_COOLDOWN_SECONDS)
        )).total_seconds()
        if age < RESEND_COOLDOWN_SECONDS:
            raise ValueError(f"Please wait {int(RESEND_COOLDOWN_SECONDS - age)}s before requesting another OTP")

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
            "created_at": datetime.datetime.utcnow(),
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
