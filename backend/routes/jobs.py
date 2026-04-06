# routes/jobs.py
from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
from config.database import get_db
from middleware.auth_middleware import token_required, role_required, user_to_dict

jobs_bp = Blueprint("jobs", __name__)

def _job_dict(j):
    return {
        "id": str(j["_id"]), "title": j.get("title",""), "company": j.get("company",""),
        "location": j.get("location"), "job_type": j.get("job_type","internship"),
        "description": j.get("description"), "salary": j.get("salary"),
        "referral": j.get("referral",False),
        "skills": j.get("skills",[]),
        "posted_by": j.get("poster_snapshot",{}),
        "deadline": j["deadline"].isoformat() if j.get("deadline") else None,
        "created_at": j["created_at"].isoformat() if j.get("created_at") else "",
    }

@jobs_bp.route("/", methods=["GET"])
@token_required
def list_jobs(cur):
    filt = {}
    if request.args.get("type"):     filt["job_type"] = request.args["type"]
    if request.args.get("referral"): filt["referral"] = True
    jobs = list(get_db().jobs.find(filt).sort("created_at",-1).limit(30))
    return jsonify([_job_dict(j) for j in jobs])

@jobs_bp.route("/", methods=["POST"])
@token_required
def create_job(cur):
    if cur.get("role") not in ("alumni","teacher","admin"):
        return jsonify({"error":"Only alumni/teachers can post jobs"}),403
    d = request.get_json() or {}
    if not d.get("title") or not d.get("company"):
        return jsonify({"error":"title and company required"}),400
    skills = d.get("skills",[])
    doc = {
        "poster_id": cur["_id"],
        "poster_snapshot": user_to_dict(cur),
        "title": d["title"], "company": d["company"],
        "location": d.get("location"), "job_type": d.get("job_type","internship"),
        "description": d.get("description"), "salary": d.get("salary"),
        "referral": bool(d.get("referral",False)),
        "skills": skills if isinstance(skills,list) else [s.strip() for s in skills.split(",")],
        "created_at": datetime.utcnow(), "deadline": None,
    }
    res = get_db().jobs.insert_one(doc); doc["_id"] = res.inserted_id
    return jsonify(_job_dict(doc)), 201