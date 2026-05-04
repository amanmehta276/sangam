# backend/routes/jobs.py
from flask import Blueprint, jsonify, request
import requests
from functools import lru_cache

jobs_bp = Blueprint("jobs", __name__)

RAPIDAPI_KEY = "YOUR_KEY_HERE"

@jobs_bp.route("/api/jobs", methods=["GET"])
def get_jobs():
    query = request.args.get("q", "software engineer internship India")
    
    url = "https://jsearch.p.rapidapi.com/search"
    headers = {
        "X-RapidAPI-Key": RAPIDAPI_KEY,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }
    params = {
        "query": query,
        "page": "1",
        "num_pages": "1",
        "date_posted": "week"      # only fresh jobs
    }

    try:
        res = requests.get(url, headers=headers, params=params, timeout=8)
        data = res.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 503

    jobs = []
    for item in data.get("data", []):
        jobs.append({
            "id":          item.get("job_id"),
            "poster_id":   "external",
            "title":       item.get("job_title", ""),
            "company":     item.get("employer_name", ""),
            "location":    item.get("job_city") or item.get("job_country", ""),
            "job_type":    item.get("job_employment_type", "fulltime").lower(),
            "description": (item.get("job_description") or "")[:300],  # trim long text
            "salary":      item.get("job_min_salary") and f"₹{item['job_min_salary']:,}+",
            "apply_link":  item.get("job_apply_link", ""),
            "referral":    False,
            "skills":      item.get("job_required_skills") or [],
            "posted_by":   {"name": item.get("employer_name", "External")},
            "created_at":  item.get("job_posted_at_datetime_utc", ""),
            "source":      "jsearch"
        })

    return jsonify(jobs)