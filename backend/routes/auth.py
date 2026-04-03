# routes/auth.py
# ============================================================
#  Auth endpoints:
#    POST /api/auth/login    — login with roll + password
#    POST /api/auth/signup   — register (validates roll exists in DB)
#    GET  /api/auth/check-roll — check if roll number is in master list
# ============================================================

from flask import Blueprint, request, jsonify
from config.database import db
from models.user import User
from middleware.auth_middleware import generate_token, token_required
import csv, os

auth_bp = Blueprint("auth", __name__)


# ── Helper: does this roll exist in the master student list? ──
def roll_exists_in_master(roll_number: str) -> dict | None:
    """
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    THIS IS WHERE YOU CONNECT YOUR REAL DATABASE.

    Right now it reads from  data/students.csv
    which looks like:
        roll_number,name,branch,batch_year
        CSE22101,Arjun Sharma,CSE,2022

    TO USE YOUR REAL DATABASE:
      Option A — CSV file:
        Export your Excel sheet as CSV, drop it in  data/students.csv
        That's literally it — this function already reads it.

      Option B — Separate MySQL/Postgres table:
        Replace the CSV code below with:
            result = db.engine.execute(
                "SELECT * FROM master_students WHERE roll_number = %s",
                (roll_number,)
            ).fetchone()
            return dict(result) if result else None

      Option C — Your existing app's API:
            import requests
            r = requests.get(f"https://yourschool.edu/api/students/{roll_number}")
            return r.json() if r.ok else None
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """
    csv_path = os.path.join(os.path.dirname(__file__), "..", "data", "students.csv")
    if not os.path.exists(csv_path):
        # If no CSV yet, fall back to checking Users table
        u = User.query.filter_by(roll_number=roll_number).first()
        return {"name": u.name, "branch": u.branch, "batch_year": u.batch_year} if u else None

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("roll_number", "").strip().upper() == roll_number.strip().upper():
                return row
    return None


# ── POST /api/auth/check-roll ─────────────────────────────────
@auth_bp.route("/check-roll", methods=["POST"])
def check_roll():
    """Frontend calls this first to see if roll exists in master list."""
    data = request.get_json() or {}
    roll = data.get("roll_number", "").strip().upper()
    if not roll:
        return jsonify({"error": "roll_number required"}), 400

    master = roll_exists_in_master(roll)
    existing_user = User.query.filter_by(roll_number=roll).first()

    return jsonify({
        "found_in_master": master is not None,
        "already_registered": existing_user is not None,
        "student_info": master,          # pre-fill the form!
    })


# ── POST /api/auth/signup ─────────────────────────────────────
@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}
    roll = data.get("roll_number", "").strip().upper()
    name = data.get("name", "").strip()
    pwd  = data.get("password", "")

    if not all([roll, name, pwd]):
        return jsonify({"error": "roll_number, name, password required"}), 400

    # 1. Must exist in master list
    master = roll_exists_in_master(roll)
    if not master:
        return jsonify({
            "error": "Roll number not found in college database. Contact admin."
        }), 404

    # 2. Must not already be registered
    if User.query.filter_by(roll_number=roll).first():
        return jsonify({"error": "Already registered. Please login."}), 409

    # 3. Create user — pre-fill from master list
    user = User(
        name=name,
        roll_number=roll,
        branch=master.get("branch", data.get("branch", "")),
        batch_year=int(master.get("batch_year", data.get("batch_year", 0)) or 0),
        role=data.get("role", "student"),
        email=data.get("email"),
    )
    user.set_password(pwd)
    db.session.add(user)
    db.session.commit()

    token = generate_token(user.id)
    return jsonify({"token": token, "user": user.to_dict(public=False)}), 201


# ── POST /api/auth/login ──────────────────────────────────────
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    roll = data.get("roll_number", "").strip().upper()
    pwd  = data.get("password", "")

    if not roll or not pwd:
        return jsonify({"error": "roll_number and password required"}), 400

    user = User.query.filter_by(roll_number=roll).first()

    if not user:
        # Not registered yet — tell frontend to redirect to signup
        master = roll_exists_in_master(roll)
        return jsonify({
            "error": "not_registered",
            "in_master_list": master is not None,
            "hint": "First time? Please sign up." if master else "Roll number not found."
        }), 404

    if not user.check_password(pwd):
        return jsonify({"error": "Incorrect password"}), 401

    token = generate_token(user.id)
    return jsonify({"token": token, "user": user.to_dict(public=False)})


# ── GET /api/auth/me ──────────────────────────────────────────
@auth_bp.route("/me", methods=["GET"])
@token_required
def me(current_user):
    return jsonify(current_user.to_dict(public=False))