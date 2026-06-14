from datetime import datetime
from bson import ObjectId
from models import notifications_col

class Notification:
    @staticmethod
    def push(user_id: str, notif_type: str, title: str,
             body: str = "", action_url: str = "") -> dict:
        """Create and insert a notification for a user"""
        now = datetime.utcnow()
        doc = {
            "user_id":    user_id,
            "notif_type": notif_type,   # system | job | message | post | mention
            "title":      title,
            "body":       body,
            "action_url": action_url,
            "is_read":    False,
            "created_at": now,
        }
        result = notifications_col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        doc["created_at"] = now.isoformat()
        return doc

    @staticmethod
    def list_for_user(user_id: str, limit: int = 30) -> list:
        docs = list(
            notifications_col
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(min(limit, 100))
        )
        return [Notification.to_dict(n) for n in docs]

    @staticmethod
    def mark_all_read(user_id: str) -> int:
        result = notifications_col.update_many(
            {"user_id": user_id, "is_read": False},
            {"$set": {"is_read": True}}
        )
        return result.modified_count

    @staticmethod
    def mark_one_read(notif_id: str) -> bool:
        result = notifications_col.update_one(
            {"_id": ObjectId(notif_id)},
            {"$set": {"is_read": True}}
        )
        return result.modified_count > 0

    @staticmethod
    def unread_count(user_id: str) -> int:
        return notifications_col.count_documents(
            {"user_id": user_id, "is_read": False}
        )

    @staticmethod
    def delete_old(user_id: str, keep: int = 50) -> None:
        """Keep only latest `keep` notifications per user"""
        docs = list(
            notifications_col
            .find({"user_id": user_id}, {"_id": 1})
            .sort("created_at", -1)
            .skip(keep)
        )
        if docs:
            ids = [d["_id"] for d in docs]
            notifications_col.delete_many({"_id": {"$in": ids}})

    @staticmethod
    def to_dict(n: dict) -> dict:
        if not n:
            return {}
        n = dict(n)
        n["id"] = str(n.pop("_id"))
        if isinstance(n.get("created_at"), datetime):
            n["created_at"] = n["created_at"].isoformat()
        return n
