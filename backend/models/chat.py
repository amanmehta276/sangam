from datetime import datetime
from bson import ObjectId
from models import messages_col, rooms_col, users_col

class Room:
    @staticmethod
    def create_group(name: str, members: list, admin_id: str) -> dict:
        now = datetime.utcnow()
        doc = {
            "name":         name.strip(),
            "type":         "group",
            "members":      members,
            "admin":        admin_id,
            "last_message": "",
            "last_time":    now,
            "created_at":   now,
        }
        result = rooms_col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        return doc

    @staticmethod
    def get_or_create_dm(uid1: str, uid2: str) -> tuple[dict, bool]:
        """Returns (room_doc, created)"""
        members_sorted = sorted([uid1, uid2])
        existing = rooms_col.find_one({
            "type":    "dm",
            "members": {"$all": members_sorted, "$size": 2}
        })
        if existing:
            return Room.to_dict(existing), False

        now = datetime.utcnow()
        doc = {
            "name":         "",
            "type":         "dm",
            "members":      members_sorted,
            "admin":        None,
            "last_message": "",
            "last_time":    now,
            "created_at":   now,
        }
        result = rooms_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return Room.to_dict(doc), True

    @staticmethod
    def get_user_rooms(uid: str) -> dict:
        """Returns {my_groups, dms} for a user"""
        all_rooms = list(rooms_col.find({"members": uid}))
        my_groups = []
        dms       = []

        for r in all_rooms:
            if r["type"] == "group":
                d = Room.to_dict(r)
                d["isAdmin"] = r.get("admin") == uid
                my_groups.append(d)
            elif r["type"] == "dm":
                other_id = next((m for m in r.get("members",[]) if m != uid), None)
                other    = None
                if other_id:
                    try:
                        other = users_col.find_one(
                            {"_id": ObjectId(other_id)},
                            {"name": 1, "avatar_url": 1, "roll_number": 1}
                        )
                    except Exception:
                        pass
                last_time = r.get("last_time","")
                if isinstance(last_time, datetime):
                    last_time = last_time.isoformat()
                dms.append({
                    "id":           str(r["_id"]),
                    "with_name":    other.get("name","Unknown") if other else "Unknown",
                    "with_id":      other_id,
                    "avatar_url":   other.get("avatar_url","") if other else "",
                    "roll_number":  other.get("roll_number","") if other else "",
                    "last_message": r.get("last_message",""),
                    "last_time":    last_time,
                })

        return {"my_groups": my_groups, "dms": dms}

    @staticmethod
    def update_last_message(room_id: str, content: str) -> None:
        now = datetime.utcnow()
        # Try as ObjectId first (custom groups/DMs), then as string (system rooms)
        try:
            rooms_col.update_one(
                {"_id": ObjectId(room_id)},
                {"$set": {"last_message": content[:100], "last_time": now}}
            )
        except Exception:
            pass

    @staticmethod
    def to_dict(r: dict) -> dict:
        if not r:
            return {}
        r = dict(r)
        r["id"] = str(r.pop("_id"))
        if isinstance(r.get("last_time"), datetime):
            r["last_time"] = r["last_time"].isoformat()
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
        return r


class Message:
    @staticmethod
    def create(data: dict) -> dict:
        now = datetime.utcnow()
        doc = {
            "room":        data.get("room",""),
            "sender_id":   data.get("sender_id",""),
            "sender_name": data.get("sender_name",""),
            "sender_roll": data.get("sender_roll",""),
            "avatar_url":  data.get("avatar_url",""),
            "content":     data.get("content","").strip(),
            "media_type":  data.get("media_type", None),
            "media_url":   data.get("media_url",  None),
            "reply_to":    data.get("reply_to",   None),
            "reactions":   [],
            "status":      "delivered",
            "created_at":  now,
        }
        result = messages_col.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        doc.pop("_id", None)
        doc["created_at"] = now.isoformat()
        return doc

    @staticmethod
    def list_by_room(room_id: str, limit: int = 50) -> list:
        docs = list(
            messages_col.find({"room": room_id})
            .sort("created_at", -1)
            .limit(min(limit, 200))
        )
        docs.reverse()
        return [Message.to_dict(m) for m in docs]

    @staticmethod
    def add_reaction(msg_id: str, emoji: str, user_id: str) -> bool:
        msg = messages_col.find_one({"_id": ObjectId(msg_id)})
        if not msg:
            return False
        reactions = msg.get("reactions", [])
        found = False
        for r in reactions:
            if r["emoji"] == emoji:
                if user_id not in r.get("users",[]):
                    r["users"].append(user_id)
                    r["count"] = len(r["users"])
                found = True
                break
        if not found:
            reactions.append({"emoji": emoji, "count": 1, "users": [user_id]})
        messages_col.update_one(
            {"_id": ObjectId(msg_id)},
            {"$set": {"reactions": reactions}}
        )
        return True

    @staticmethod
    def delete(msg_id: str, user_id: str) -> bool:
        msg = messages_col.find_one({"_id": ObjectId(msg_id)})
        if not msg:
            return False
        if msg.get("sender_id") != user_id:
            return False
        messages_col.delete_one({"_id": ObjectId(msg_id)})
        return True

    @staticmethod
    def to_dict(m: dict) -> dict:
        if not m:
            return {}
        m = dict(m)
        m["id"] = str(m.pop("_id"))
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
        return m
