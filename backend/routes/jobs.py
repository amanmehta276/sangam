# routes/jobs.py
from flask import Blueprint, request, jsonify
from config.database import db
from models.job import Job
from middleware.auth_middleware import token_required, role_required

jobs_bp = Blueprint("jobs", __name__)

@jobs_bp.route("/", methods=["GET"])
@token_required
def list_jobs(current_user):
    jtype    = request.args.get("type")
    referral = request.args.get("referral")
    query    = Job.query
    if jtype:    query = query.filter_by(job_type=jtype)
    if referral: query = query.filter_by(referral=True)
    jobs = query.order_by(Job.created_at.desc()).limit(30).all()
    return jsonify([j.to_dict() for j in jobs])

@jobs_bp.route("/", methods=["POST"])
@token_required
def create_job(current_user):
    # Only alumni / teacher / admin can post jobs
    if current_user.role not in ("alumni", "teacher", "admin"):
        return jsonify({"error": "Only alumni or teachers can post jobs"}), 403
    data = request.get_json() or {}
    if not data.get("title") or not data.get("company"):
        return jsonify({"error": "title and company required"}), 400
    skills = data.get("skills", [])
    job = Job(
        poster_id  = current_user.id,
        title      = data["title"],
        company    = data["company"],
        location   = data.get("location"),
        job_type   = data.get("job_type", "internship"),
        description= data.get("description"),
        salary     = data.get("salary"),
        referral   = bool(data.get("referral", False)),
        skills_req = ",".join(skills) if isinstance(skills, list) else skills,
    )
    db.session.add(job)
    db.session.commit()
    return jsonify(job.to_dict()), 201