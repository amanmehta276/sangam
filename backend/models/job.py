# models/job.py

from datetime import datetime


class Job:
    def __init__(self, data):
        self.id          = str(data.get("_id"))
        self.poster_id   = str(data.get("poster_id"))
        self.title       = data.get("title")
        self.company     = data.get("company")
        self.location    = data.get("location")
        self.job_type    = data.get("job_type")
        self.description = data.get("description")
        self.salary      = data.get("salary")
        self.referral    = data.get("referral", False)
        self.skills_req  = data.get("skills_req", [])
        self.deadline    = data.get("deadline")
        self.created_at  = data.get("created_at", datetime.utcnow())

    def to_dict(self):
        return {
            "id": self.id,
            "poster_id": self.poster_id,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "job_type": self.job_type,
            "description": self.description,
            "salary": self.salary,
            "referral": self.referral,
            "skills_req": self.skills_req,
            "deadline": self.deadline,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }