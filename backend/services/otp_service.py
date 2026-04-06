# services/otp_service.py
import random, time, string
from flask import current_app

_store: dict = {}  # { mobile_10digit: {otp, expires_at, attempts} }

def _clean(m): return "".join(c for c in m if c.isdigit())[-10:]

def send_otp(mobile: str) -> dict:
    mob = _clean(mobile)
    if len(mob) < 10:
        return {"success": False, "message": "Invalid mobile (need 10 digits)"}
    otp = "".join(random.choices(string.digits, k=6))
    expire = current_app.config.get("OTP_EXPIRY", 300)
    _store[mob] = {"otp": otp, "expires_at": time.time() + expire, "attempts": 0}
    mode = current_app.config.get("OTP_MODE", "console")
    if mode == "console":
        print(f"\n{'='*45}\n  OTP for +91-{mob}: {otp}\n  (Dev — no SMS sent)\n{'='*45}\n")
        return {"success": True, "dev_otp": otp, "message": f"[DEV] OTP: {otp}"}
    elif mode == "twilio":
        try:
            from twilio.rest import Client
            Client(current_app.config["TWILIO_SID"],
                   current_app.config["TWILIO_TOKEN"]).messages.create(
                body=f"Your Sangam OTP: {otp}. Valid 5 min. Do not share.",
                from_=current_app.config["TWILIO_FROM"], to=f"+91{mob}")
            return {"success": True, "message": f"OTP sent to XXXXXX{mob[-4:]}"}
        except Exception as e:
            return {"success": False, "message": str(e)}
    return {"success": False, "message": f"Unknown OTP_MODE: {mode}"}

def verify_otp(mobile: str, entered: str) -> dict:
    mob = _clean(mobile)
    rec = _store.get(mob)
    if not rec: return {"valid": False, "message": "No OTP sent. Request a new one."}
    if time.time() > rec["expires_at"]:
        del _store[mob]; return {"valid": False, "message": "OTP expired."}
    rec["attempts"] += 1
    if rec["attempts"] > 5:
        del _store[mob]; return {"valid": False, "message": "Too many attempts. Request new OTP."}
    if rec["otp"] != entered.strip():
        return {"valid": False, "message": f"Wrong OTP. {5-rec['attempts']} tries left."}
    del _store[mob]
    return {"valid": True, "message": "OTP verified ✅"}