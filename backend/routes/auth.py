# routes/auth.py
import csv, os
from typing import Optional   # FIX BUG 6: dict|None needs Python 3.10+, use Optional
from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from werkzeug.security import generate_password_hash
from datetime import datetime
from config.database import get_db
from middleware.auth_middleware import generate_token, token_required, user_to_dict
from services.otp_service import send_otp, verify_otp

auth_bp = Blueprint("auth", __name__)


def _find_in_csv(roll: str) -> Optional[dict]:
    """
    SIGNUP ONLY: check roll number against students.csv.
    When you get your real college DB, replace this with a DB query.
    """
    path = os.path.join(
        os.path.dirname(__file__), "..",
        current_app.config.get("ROLL_DB_PATH", "data/students.csv")
    )
    if not os.path.exists(path):
        return None
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("roll_number", "").strip().upper() == roll.upper():
                return row
    return None


def _name_ok(csv_name: str, inp: str) -> bool:
    a = csv_name.strip().lower().split()[0] if csv_name.strip() else ""
    b = inp.strip().lower().split()[0] if inp.strip() else ""
    return a == b and bool(a)


# ════ SIGNUP STEP 1 — Check CSV ════════════════════════════════
@auth_bp.route("/verify-roll", methods=["POST"])
def verify_roll():
    d    = request.get_json() or {}
    roll = d.get("roll_number", "").strip().upper()
    name = d.get("name", "").strip()
    if not roll or not name:
        return jsonify({"error": "roll_number and name required"}), 400

    student = _find_in_csv(roll)
    if not student:
        return jsonify({"error": "Roll number not found in college database."}), 404
    if not _name_ok(student.get("name", ""), name):
        return jsonify({"error": "Name does not match records. Check spelling."}), 400

    already = get_db().users.find_one({"roll_number": roll}) is not None
    mob = student.get("mobile", "")
    masked = f"XXXXXXX{mob[-4:]}" if len(mob) >= 4 else "Not on file"
    return jsonify({
        "valid": True,
        "already_registered": already,
        "mobile_masked": masked,
        "student_info": {
            "name":       student.get("name", ""),
            "branch":     student.get("branch", ""),
            "batch_year": student.get("batch_year", ""),
        }
    })


# ════ SIGNUP STEP 2 — Send OTP ═════════════════════════════════
@auth_bp.route("/send-otp", methods=["POST"])
def send_otp_route():
    d         = request.get_json() or {}
    roll      = d.get("roll_number", "").strip().upper()
    mob_input = d.get("mobile", "").strip()

    student = _find_in_csv(roll)
    if not student:
        return jsonify({"error": "Roll not found"}), 404

    csv_mob = student.get("mobile", "").strip()
    send_to = csv_mob if csv_mob else mob_input
    if not send_to:
        return jsonify({"error": "No mobile number available"}), 400

    if csv_mob and mob_input and csv_mob[-10:] != mob_input.replace("+91", "")[-10:]:
        return jsonify({"error": "Mobile doesn't match college records."}), 400

    res = send_otp(send_to)
    if not res["success"]:
        return jsonify({"error": res["message"]}), 500
    r = {"success": True, "message": res["message"]}
    if res.get("dev_otp"):
        r["dev_otp"] = res["dev_otp"]
    return jsonify(r)


# ════ SIGNUP STEP 3 — Verify OTP + create account ══════════════
@auth_bp.route("/signup", methods=["POST"])
def signup():
    d    = request.get_json() or {}
    roll = d.get("roll_number", "").strip().upper()
    name = d.get("name", "").strip()
    mob  = d.get("mobile", "").strip()
    otp  = d.get("otp", "").strip()

    if not all([roll, name, otp]):
        return jsonify({"error": "roll_number, name, otp required"}), 400

    student = _find_in_csv(roll)
    if not student:
        return jsonify({"error": "Roll not found in college database"}), 404

    db = get_db()
    if db.users.find_one({"roll_number": roll}):
        return jsonify({"error": "Already registered. Please login."}), 409

    csv_mob    = student.get("mobile", "").strip()
    verify_mob = csv_mob if csv_mob else mob
    if not verify_mob:
        return jsonify({"error": "No mobile to verify OTP against"}), 400

    res = verify_otp(verify_mob, otp)
    if not res["valid"]:
        return jsonify({"error": res["message"]}), 400

    role = ("admin"   if "ADMIN"  in roll else
            "teacher" if "TCH"    in roll else
            "alumni"  if "ALUMNI" in roll else
            d.get("role", "student"))

    doc = {
        "roll_number":     roll,
        "name":            student.get("name", name),
        "mobile":          verify_mob,
        "mobile_verified": True,
        "email":           d.get("email") or student.get("email"),
        "password_hash":   generate_password_hash(d["password"]) if d.get("password") else None,
        "branch":          student.get("branch", ""),
        "batch_year":      int(student.get("batch_year", 0) or 0),
        "semester":        int(student.get("semester", 0) or 0),
        "role":            role,
        "trust_level":     "partial",
        "bio": None, "avatar_url": None, "linkedin_url": None,
        "github_url": None, "company": None, "skills": [],
        "created_at": datetime.utcnow(), "last_seen": datetime.utcnow(),
    }
    result  = db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    token   = generate_token(str(result.inserted_id))
    return jsonify({"token": token, "user": user_to_dict(doc, public=False)}), 201


# ════ LOGIN STEP 1 — Check MongoDB ═════════════════════════════
@auth_bp.route("/check-roll", methods=["POST"])
def check_roll():
    d    = request.get_json() or {}
    roll = d.get("roll_number", "").strip().upper()
    name = d.get("name", "").strip()
    if not roll or not name:
        return jsonify({"error": "roll_number and name required"}), 400

    db   = get_db()
    user = db.users.find_one({"roll_number": roll})

    if not user:
        in_csv = _find_in_csv(roll) is not None
        return jsonify({
            "found": False,
            "in_college_db": in_csv,
            "error": "Not registered. Please sign up first." if in_csv else "Roll number not found."
        }), 404

    if not _name_ok(user.get("name", ""), name):
        return jsonify({"found": True, "name_match": False,
                        "error": "Name doesn't match your account"}), 400

    mob    = user.get("mobile", "")
    masked = f"XXXXXXX{mob[-4:]}" if len(mob) >= 4 else "Not on file"
    return jsonify({"found": True, "name_match": True, "mobile_masked": masked})


# ════ LOGIN STEP 2 — Send OTP ══════════════════════════════════
@auth_bp.route("/login-otp", methods=["POST"])
def login_send_otp():
    d    = request.get_json() or {}
    roll = d.get("roll_number", "").strip().upper()

    user = get_db().users.find_one({"roll_number": roll})
    if not user:
        return jsonify({"error": "Not registered. Please sign up."}), 404
    if not user.get("mobile"):
        return jsonify({"error": "No mobile on record. Contact admin."}), 400

    res = send_otp(user["mobile"])
    if not res["success"]:
        return jsonify({"error": res["message"]}), 500

    r = {
        "success":       True,
        "message":       res["message"],
        "mobile_masked": "XXXXXXX" + user["mobile"][-4:],
    }
    if res.get("dev_otp"):
        r["dev_otp"] = res["dev_otp"]
    return jsonify(r)


# ════ LOGIN STEP 3 — Verify OTP → JWT ═════════════════════════
@auth_bp.route("/login-verify", methods=["POST"])
def login_verify():
    d    = request.get_json() or {}
    roll = d.get("roll_number", "").strip().upper()
    otp  = d.get("otp", "").strip()
    if not roll or not otp:
        return jsonify({"error": "roll_number and otp required"}), 400

    db   = get_db()
    user = db.users.find_one({"roll_number": roll})
    if not user:
        return jsonify({"error": "User not found"}), 404

    res = verify_otp(user["mobile"], otp)
    if not res["valid"]:
        return jsonify({"error": res["message"]}), 400

    db.users.update_one({"_id": user["_id"]}, {"$set": {"last_seen": datetime.utcnow()}})
    token = generate_token(str(user["_id"]))
    return jsonify({"token": token, "user": user_to_dict(user, public=False)})


# ════ Resend OTP ═══════════════════════════════════════════════
@auth_bp.route("/resend-otp", methods=["POST"])
def resend_otp():
    d    = request.get_json() or {}
    roll = d.get("roll_number", "").strip().upper()

    user = get_db().users.find_one({"roll_number": roll})
    mob  = user["mobile"] if user and user.get("mobile") else None
    if not mob:
        s   = _find_in_csv(roll)
        mob = s.get("mobile", "") if s else None
    if not mob:
        return jsonify({"error": "No mobile found"}), 400

    res = send_otp(mob)
    # FIX BUG 10: return 500 if OTP send failed
    if not res["success"]:
        return jsonify({"error": res["message"]}), 500

    r = {"success": True, "message": res["message"]}
    if res.get("dev_otp"):
        r["dev_otp"] = res["dev_otp"]
    return jsonify(r)


# ════ GET /api/auth/me ══════════════════════════════════════════
@auth_bp.route("/me", methods=["GET"])
@token_required
def me(current_user):
    return jsonify(user_to_dict(current_user, public=False))