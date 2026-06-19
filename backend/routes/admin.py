"""
Admin Routes — changes here reflect on the MAIN WEBSITE
GET  /api/admin/stats              — Dashboard stats
PUT  /api/users/:id/admin-update   — Update user role/trust
POST /api/admin/broadcast          — Send notification to all/group
POST /api/admin/notify             — Send to specific user
POST /api/admin/upload-csv         — Replace students.csv
POST /api/admin/add-student        — Add single student to CSV
DELETE /api/users/:id              — Delete user (admin)
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
        "users":   users_col.count_documents({}),
        "students":users_col.count_documents({"role":"student"}),
        "alumni":  users_col.count_documents({"role":"alumni"}),
        "teachers":users_col.count_documents({"role":"teacher"}),
        "posts":   posts_col.count_documents({}),
        "jobs":    jobs_col.count_documents({}),
    })

# ── Update user role/trust (reflects on main site immediately) ──
@admin_bp.route("/users/<uid>/admin-update", methods=["PUT"])
@_admin_required
def admin_update_user(uid):
    data  = request.json or {}
    allow = ["role","trust_level","name","mobile","branch","batch_year"]
    update = {k: data[k] for k in allow if k in data}
    update["updated_at"] = datetime.datetime.utcnow()
    try:
        users_col.update_one({"_id": ObjectId(uid)}, {"$set": update})
        user = users_col.find_one({"_id": ObjectId(uid)}, {"password":0})
        user["id"] = str(user.pop("_id"))
        return jsonify(user)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ── Delete user ────────────────────────────────────────────
@admin_bp.route("/users/<uid>", methods=["DELETE"])
@_admin_required
def admin_delete_user(uid):
    try:
        users_col.delete_one({"_id": ObjectId(uid)})
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ── Broadcast — pushes notification to ALL matching users ──
@admin_bp.route("/broadcast", methods=["POST"])
@_admin_required
def broadcast():
    """
    Sends notification to users based on target:
    'all' → everyone
    'student'/'alumni'/'teacher' → that role
    'CSE'/'EEE' etc → that branch
    """
    data   = request.json or {}
    title  = data.get("title","").strip()
    body   = data.get("body","").strip()
    target = data.get("target","all")
    ntype  = data.get("notif_type","system")
    url    = data.get("action_url","")

    if not title:
        return jsonify({"error": "Title required"}), 400

    # Build filter
    filt = {}
    if target in ("student","alumni","teacher","admin"):
        filt["role"] = target
    elif target in ("CSE","EEE","ME","CE","ECE","IT"):
        filt["branch"] = target
    # else target == "all" → no filter

    users = list(users_col.find(filt, {"_id":1}))
    now   = datetime.datetime.utcnow()

    # Insert notifications for all matching users
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
    target = data.get("target","").strip()   # roll number or "all"
    title  = data.get("title","").strip()
    body   = data.get("body","").strip()
    ntype  = data.get("notif_type","system")

    if not title or not target:
        return jsonify({"error": "Target and title required"}), 400

    now = datetime.datetime.utcnow()

    if target.lower() == "all":
        users = list(users_col.find({}, {"_id":1}))
    else:
        user = users_col.find_one({"roll_number": target.upper()}, {"_id":1})
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

# ── Upload CSV (replaces students.csv → new students can signup) ──
@admin_bp.route("/upload-csv", methods=["POST"])
@_admin_required
def upload_csv():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file"}), 400

    content = file.read().decode("utf-8")
    path    = cfg.ROLL_DB_PATH

    # Validate header
    first_line = content.split("\n")[0].strip()
    required   = {"roll_number","name","branch","batch_year"}
    cols       = set(first_line.lower().split(","))
    if not required.issubset(cols):
        return jsonify({"error": f"CSV must have columns: {required}"}), 400

    # Save file
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    # Hot-reload CSV cache
    reload_csv()

    rows = len(content.strip().split("\n")) - 1
    return jsonify({"ok": True, "rows": rows})

# ── Add single student to CSV ──────────────────────────────
@admin_bp.route("/add-student", methods=["POST"])
@_admin_required
def add_student():
    data = request.json or {}
    roll = data.get("roll_number","").upper().strip()
    name = data.get("name","").strip()
    if not roll or not name:
        return jsonify({"error": "roll_number and name required"}), 400

    path = cfg.ROLL_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # If file doesn't exist, create with header
    if not os.path.exists(path):
        with open(path,"w") as f:
            f.write("roll_number,name,branch,batch_year,mobile,role\n")

    # Append row
    with open(path,"a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            roll,
            name,
            data.get("branch",""),
            data.get("batch_year",""),
            data.get("mobile",""),
            data.get("role","student"),
        ])

    # Hot-reload
    reload_csv()
    return jsonify({"ok": True, "roll_number": roll})