from datetime import datetime
from bson import ObjectId
from models import jobs_col

class Job:
    @staticmethod
    def create(poster: dict, data: dict) -> dict:
        now = datetime.utcnow()
        doc = {
            "title":       data.get("title","").strip(),
            "company":     data.get("company","").strip(),
            "location":    data.get("location","").strip(),
            "job_type":    data.get("job_type","internship"),
            "salary":      data.get("salary","").strip(),
            "description": data.get("description","").strip(),
            "skills":      data.get("skills",[]) if isinstance(data.get("skills"), list) else [],
            "referral":    bool(data.get("referral", False)),
            "apply_link":  data.get("apply_link","").strip(),
            "posted_by": {
                "id":   str(poster.get("_id", poster.get("id",""))),
                "name": poster.get("name",""),
            },
            "created_at": now,
            "updated_at": now,
        }
        result = jobs_col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return doc

    @staticmethod
    def list(referral: bool = False, limit: int = 30) -> list:
        filt = {}
        if referral:
            filt["referral"] = True
        docs = list(jobs_col.find(filt).sort("created_at", -1).limit(min(limit, 100)))
        return [Job.to_dict(j) for j in docs]

    @staticmethod
    def find_by_id(job_id: str) -> dict | None:
        try:
            return jobs_col.find_one({"_id": ObjectId(job_id)})
        except Exception:
            return None

    @staticmethod
    def delete(job_id: str) -> bool:
        result = jobs_col.delete_one({"_id": ObjectId(job_id)})
        return result.deleted_count > 0

    @staticmethod
    def to_dict(j: dict) -> dict:
        if not j:
            return {}
        j = dict(j)
        j["id"] = str(j.pop("_id"))
        if isinstance(j.get("created_at"), datetime):
            j["created_at"] = j["created_at"].isoformat()
        if isinstance(j.get("updated_at"), datetime):
            j["updated_at"] = j["updated_at"].isoformat()
        return j
