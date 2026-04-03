# models/chat.py
from config.database import db
from datetime import datetime

class ChatMessage(db.Model):
    __tablename__ = "chat_messages"
    id         = db.Column(db.Integer, primary_key=True)
    sender_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    room       = db.Column(db.String(60),  nullable=False)   # "global" | "cse-2022" | "dm-{uid1}-{uid2}"
    content    = db.Column(db.Text,        nullable=False)
    created_at = db.Column(db.DateTime,    default=datetime.utcnow)

    sender     = db.relationship("User", foreign_keys=[sender_id])

    def to_dict(self):
        return {
            "id":        self.id,
            "sender":    self.sender.to_dict() if self.sender else None,
            "room":      self.room,
            "content":   self.content,
            "created_at":self.created_at.isoformat(),
        }