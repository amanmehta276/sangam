"""
Jobs routes
GET    /api/jobs          — List jobs
POST   /api/jobs          — Create job (alumni/teacher/admin)
DELETE /api/jobs/:id      — Delete job
"""
from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

from models import jobs_col, users_col
from utils import login_required

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

def _out(j):
    j["id"] = str(j.pop("_id"))
    return j

@jobs_bp.route("", methods=["GET"])
@login_required
def list_jobs():
    limit    = min(int(request.args.get("limit", 30)), 100)
    referral = request.args.get("referral","")
    filt     = {}
    if referral == "1": filt["referral"] = True
    jobs = list(jobs_col.find(filt).sort("created_at",-1).limit(limit))
    return jsonify([_out(j) for j in jobs])

@jobs_bp.route("", methods=["POST"])
@login_required
def create_job():
    uid  = request.current_user.get("sub")
    role = request.current_user.get("role","student")
    if role not in ("alumni","teacher","admin"):
        return jsonify({"error": "Only alumni/teachers can post jobs"}), 403

    data = request.json or {}
    if not data.get("title") or not data.get("company"):
        return jsonify({"error": "Title and company required"}), 400

    user = users_col.find_one({"_id": ObjectId(uid)}, {"name":1,"roll_number":1})
    now  = datetime.datetime.utcnow()
    job  = {
        "title":       data.get("title","").strip(),
        "company":     data.get("company","").strip(),
        "location":    data.get("location","").strip(),
        "job_type":    data.get("job_type","internship"),
        "salary":      data.get("salary","").strip(),
        "description": data.get("description","").strip(),
        "skills":      data.get("skills",[]),
        "referral":    bool(data.get("referral", False)),
        "apply_link":  data.get("apply_link","").strip(),
        "posted_by":   {"id": str(uid), "name": user.get("name","") if user else ""},
        "created_at":  now,
        "updated_at":  now,
    }
    result = jobs_col.insert_one(job)
    job["id"] = str(result.inserted_id)
    job.pop("_id", None)
    return jsonify(job), 201

@jobs_bp.route("/<job_id>", methods=["DELETE"])
@login_required
def delete_job(job_id):
    uid  = request.current_user.get("sub")
    role = request.current_user.get("role","")
    job  = jobs_col.find_one({"_id": ObjectId(job_id)})
    if not job:
        return jsonify({"error": "Not found"}), 404
    if job["posted_by"]["id"] != uid and role != "admin":
        return jsonify({"error": "Not authorized"}), 403
    jobs_col.delete_one({"_id": ObjectId(job_id)})
    return jsonify({"ok": True})
