# models/job.py
from config.database import db
from datetime import datetime

class Job(db.Model):
    __tablename__ = "jobs"
    id           = db.Column(db.Integer, primary_key=True)
    poster_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title        = db.Column(db.String(200), nullable=False)
    company      = db.Column(db.String(120), nullable=False)
    location     = db.Column(db.String(120), nullable=True)
    job_type     = db.Column(db.String(30),  default="internship")  # internship|fulltime|parttime
    description  = db.Column(db.Text,        nullable=True)
    salary       = db.Column(db.String(60),  nullable=True)
    referral     = db.Column(db.Boolean,     default=False)
    skills_req   = db.Column(db.Text,        nullable=True)  # CSV
    deadline     = db.Column(db.DateTime,    nullable=True)
    created_at   = db.Column(db.DateTime,    default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":         self.id,
            "posted_by":  self.poster.to_dict() if self.poster else None,
            "title":      self.title,
            "company":    self.company,
            "location":   self.location,
            "job_type":   self.job_type,
            "description":self.description,
            "salary":     self.salary,
            "referral":   self.referral,
            "skills":     self.skills_req.split(",") if self.skills_req else [],
            "deadline":   self.deadline.isoformat() if self.deadline else None,
            "created_at": self.created_at.isoformat(),
        }