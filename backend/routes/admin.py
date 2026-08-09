"""
Admin Routes — changes here reflect on the MAIN WEBSITE
GET    /api/admin/stats              — Dashboard stats
PUT    /api/admin/users/:id/admin-update   — Update user role/trust
DELETE /api/admin/users/:id              — Delete user (admin)
POST   /api/admin/broadcast          — Send notification to all/group
POST   /api/admin/notify             — Send to specific user
POST   /api/admin/upload-csv         — Replace students.csv
POST   /api/admin/add-student        — Add single student to CSV
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime, csv, os, io

from models import users_col, posts_col, jobs_col, notifications_col
from utils import login_required
from utils.csv_checker import reload as reload_csv
from config import cfg

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

def _admin_required(f):
    """Check admin role after login_required"""
    from functools import wraps
    @wraps(f)
    @login_required
    def decorated(*args, **kwargs):
        if request.current_user.get("role") != "admin":
            return jsonify({"error": "Admin only"}), 403
        return f(*args, **kwargs)
    return decorated

# ── Stats ─────────────────────────────────────────────────
@admin_bp.route("/stats", methods=["GET"])
@_admin_required
def get_stats():
    return jsonify({
        "users":    users_col.count_documents({}),
        "students": users_col.count_documents({"role": "student"}),
        "alumni":   users_col.count_documents({"role": "alumni"}),
        "teachers": users_col.count_documents({"role": "teacher"}),
        "posts":    posts_col.count_documents({}),
        "jobs":     jobs_col.count_documents({}),
    })

# ── Update user role/trust ─────────────────────────────────
# FIXED: route ab /api/admin/users/:id/admin-update hai
@admin_bp.route("/users/<uid>/admin-update", methods=["PUT"])
@_admin_required
def admin_update_user(uid):
    data  = request.json or {}
    allow = ["role", "trust_level", "name", "mobile", "branch", "batch_year"]
    update = {k: data[k] for k in allow if k in data}
    update["updated_at"] = datetime.datetime.utcnow()
    try:
        users_col.update_one({"_id": ObjectId(uid)}, {"$set": update})
        user = users_col.find_one({"_id": ObjectId(uid)}, {"password": 0})
        user["id"] = str(user.pop("_id"))
        return jsonify(user)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ── Delete user ────────────────────────────────────────────
# FIXED: route ab /api/admin/users/:id hai
@admin_bp.route("/users/<uid>", methods=["DELETE"])
@_admin_required
def admin_delete_user(uid):
    try:
        users_col.delete_one({"_id": ObjectId(uid)})
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ── Broadcast ──────────────────────────────────────────────
@admin_bp.route("/broadcast", methods=["POST"])
@_admin_required
def broadcast():
    data   = request.json or {}
    title  = data.get("title", "").strip()
    body   = data.get("body", "").strip()
    target = data.get("target", "all")
    ntype  = data.get("notif_type", "system")
    url    = data.get("action_url", "")

    if not title:
        return jsonify({"error": "Title required"}), 400

    filt = {}
    if target in ("student", "alumni", "teacher", "admin"):
        filt["role"] = target
    elif target in ("CSE", "EEE", "ME", "CE", "ECE", "IT"):
        filt["branch"] = target

    users = list(users_col.find(filt, {"_id": 1}))
    now   = datetime.datetime.utcnow()

    if users:
        notifications_col.insert_many([{
            "user_id":    str(u["_id"]),
            "notif_type": ntype,
            "title":      title,
            "body":       body,
            "action_url": url,
            "is_read":    False,
            "created_at": now,
        } for u in users])

    return jsonify({"ok": True, "sent_to": len(users)})

# ── Notify specific user ───────────────────────────────────
@admin_bp.route("/notify", methods=["POST"])
@_admin_required
def notify_user():
    data   = request.json or {}
    target = data.get("target", "").strip()
    title  = data.get("title", "").strip()
    body   = data.get("body", "").strip()
    ntype  = data.get("notif_type", "system")

    if not title or not target:
        return jsonify({"error": "Target and title required"}), 400

    now = datetime.datetime.utcnow()

    if target.lower() == "all":
        users = list(users_col.find({}, {"_id": 1}))
    else:
        user = users_col.find_one({"roll_number": target.upper()}, {"_id": 1})
        users = [user] if user else []

    if not users:
        return jsonify({"error": "No users found"}), 404

    notifications_col.insert_many([{
        "user_id":    str(u["_id"]),
        "notif_type": ntype,
        "title":      title,
        "body":       body,
        "action_url": "",
        "is_read":    False,
        "created_at": now,
    } for u in users])

    return jsonify({"ok": True, "sent_to": len(users)})

# ── Upload CSV ─────────────────────────────────────────────
@admin_bp.route("/upload-csv", methods=["POST"])
@_admin_required
def upload_csv():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file"}), 400

    content = file.read().decode("utf-8")
    path    = cfg.ROLL_DB_PATH

    first_line = content.split("\n")[0].strip()
    required   = {"roll_number", "name", "branch", "batch_year"}
    cols       = set(first_line.lower().split(","))
    if not required.issubset(cols):
        return jsonify({"error": f"CSV must have columns: {required}"}), 400

    # Validate row data too, not just headers — a row with an empty
    # roll_number/name used to be accepted silently (issue #11).
    reader = csv.DictReader(io.StringIO(content))
    reader.fieldnames = [f.strip().lower() for f in reader.fieldnames]
    bad_rows = []
    valid_rows = 0
    for i, row in enumerate(reader, start=2):  # header is row 1
        roll = (row.get("roll_number") or "").strip()
        name = (row.get("name") or "").strip()
        if not roll or not name:
            bad_rows.append(i)
        else:
            valid_rows += 1

    if bad_rows:
        return jsonify({
            "error": f"{len(bad_rows)} row(s) missing roll_number/name",
            "bad_rows": bad_rows[:20],
        }), 400

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    reload_csv()
    return jsonify({"ok": True, "rows": valid_rows})

# ── Add single student ─────────────────────────────────────
@admin_bp.route("/add-student", methods=["POST"])
@_admin_required
def add_student():
    data = request.json or {}
    roll = data.get("roll_number", "").upper().strip()
    name = data.get("name", "").strip()
    if not roll or not name:
        return jsonify({"error": "roll_number and name required"}), 400

    branch = data.get("branch", "").strip()
    batch_year = data.get("batch_year", "").strip()
    mobile = data.get("mobile", "").strip()
    role = data.get("role", "student").strip() or "student"

    path = cfg.ROLL_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("roll_number,name,branch,batch_year,mobile,role\n")

    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            roll,
            name,
            branch,
            batch_year,
            mobile,
            role,
        ])

    existing_user = users_col.find_one({"roll_number": roll})
    if not existing_user:
        now = datetime.datetime.utcnow()
        users_col.insert_one({
            "roll_number": roll,
            "name": name,
            "mobile": mobile,
            "branch": branch,
            "batch_year": batch_year,
            "role": role,
            "trust_level": "new",
            "bio": "",
            "company": "",
            "location": "",
            "email": "",
            "phone": "",
            "skills": [],
            "linkedin_url": "",
            "github_url": "",
            "avatar_url": "",
            "wallpaper_url": "",
            "graduation_year": "",
            "alumni_position": "",
            "alumni_company": "",
            "created_at": now,
            "updated_at": now,
        })

    reload_csv()
    return jsonify({"ok": True, "roll_number": roll})