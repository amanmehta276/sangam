from datetime import datetime
from bson import ObjectId
from models import posts_col

class Post:
    @staticmethod
    def create(author: dict, data: dict) -> dict:
        now = datetime.utcnow()
        doc = {
            "author": {
                "id":          str(author.get("_id", author.get("id",""))),
                "name":        author.get("name",""),
                "roll_number": author.get("roll_number",""),
                "branch":      author.get("branch",""),
                "batch_year":  author.get("batch_year",""),
                "role":        author.get("role","student"),
                "trust_level": author.get("trust_level","new"),
                "avatar_url":  author.get("avatar_url",""),
            },
            "post_type":  data.get("post_type","update"),
            "content":    data.get("content","").strip(),
            "tags":       data.get("tags",[]) if isinstance(data.get("tags"), list) else [],
            "media_url":  data.get("media_url",""),
            "media_type": data.get("media_type",""),
            "likes":      0,
            "liked_by":   [],
            "created_at": now,
            "updated_at": now,
        }
        result = posts_col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return doc

    @staticmethod
    def list(post_type: str = "", limit: int = 30) -> list:
        filt = {}
        if post_type:
            filt["post_type"] = post_type
        docs = list(posts_col.find(filt).sort("created_at", -1).limit(min(limit, 100)))
        return [Post.to_dict(p) for p in docs]

    @staticmethod
    def find_by_id(post_id: str) -> dict | None:
        try:
            return posts_col.find_one({"_id": ObjectId(post_id)})
        except Exception:
            return None

    @staticmethod
    def like(post_id: str, user_id: str) -> dict:
        post = posts_col.find_one({"_id": ObjectId(post_id)})
        if not post:
            return {"error": "Not found"}
        liked_by = post.get("liked_by", [])
        if user_id in liked_by:
            posts_col.update_one(
                {"_id": ObjectId(post_id)},
                {"$pull": {"liked_by": user_id}, "$inc": {"likes": -1}}
            )
            liked = False
        else:
            posts_col.update_one(
                {"_id": ObjectId(post_id)},
                {"$addToSet": {"liked_by": user_id}, "$inc": {"likes": 1}}
            )
            liked = True
        updated = posts_col.find_one({"_id": ObjectId(post_id)})
        return {"likes": updated["likes"], "liked": liked}

    @staticmethod
    def delete(post_id: str) -> bool:
        result = posts_col.delete_one({"_id": ObjectId(post_id)})
        return result.deleted_count > 0

    @staticmethod
    def to_dict(p: dict) -> dict:
        if not p:
            return {}
        p = dict(p)
        p["id"] = str(p.pop("_id"))
        if isinstance(p.get("created_at"), datetime):
            p["created_at"] = p["created_at"].isoformat()
        if isinstance(p.get("updated_at"), datetime):
            p["updated_at"] = p["updated_at"].isoformat()
        return p
