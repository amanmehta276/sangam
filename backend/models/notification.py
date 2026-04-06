from datetime import datetime

class Notification:
    def __init__(self, data):
        self.id         = str(data.get("_id"))
        self.user_id    = str(data.get("user_id"))
        self.notif_type = data.get("notif_type")
        self.title      = data.get("title")
        self.body       = data.get("body")
        self.is_read    = data.get("is_read", False)
        self.created_at = data.get("created_at", datetime.utcnow())

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "notif_type": self.notif_type,
            "title": self.title,
            "body": self.body,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }