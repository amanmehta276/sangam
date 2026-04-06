# models/chat.py

from datetime import datetime


class ChatMessage:
    def __init__(self, data):
        self.id          = str(data.get("_id"))
        self.sender_id   = str(data.get("sender_id"))
        self.sender_name = data.get("sender_name")
        self.sender_roll = data.get("sender_roll")
        self.room        = data.get("room", "global")
        self.content     = data.get("content")
        self.media_type  = data.get("media_type")
        self.media_url   = data.get("media_url")
        self.created_at  = data.get("created_at", datetime.utcnow())

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "sender_name": self.sender_name,
            "sender_roll": self.sender_roll,
            "room": self.room,
            "content": self.content,
            "media_type": self.media_type,
            "media_url": self.media_url,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


def make_dm_room(mobile1: str, mobile2: str) -> str:
    a = "".join(c for c in mobile1 if c.isdigit())[-10:]
    b = "".join(c for c in mobile2 if c.isdigit())[-10:]
    return "dm_" + "_".join(sorted([a, b]))