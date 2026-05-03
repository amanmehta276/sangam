from flask import Blueprint, jsonify
import requests
from models.job import Job

jobs_bp = Blueprint("jobs", __name__)

@jobs_bp.route("/api/jobs", methods=["GET"])
def get_jobs():
    url = "https://jsearch.p.rapidapi.com/search?query=internship%20india"
    
    headers = {
        "X-RapidAPI-Key": "YOUR_KEY",
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com"
    }

    res = requests.get(url, headers=headers)
    data = res.json()

    jobs = []
    for item in data.get("data", []):
        job = Job({
            "_id": item.get("job_id"),
            "poster_id": "external",
            "title": item.get("job_title"),
            "company": item.get("employer_name"),
            "location": item.get("job_city"),
            "job_type": item.get("job_employment_type"),
            "description": item.get("job_description"),
            "salary": item.get("job_salary"),
            "referral": False,
            "skills_req": []
        })
        jobs.append(job.to_dict())

    return jsonify(jobs)