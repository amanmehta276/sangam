# models/notification.py
from config.database import db
from datetime import datetime

class Notification(db.Model):
    __tablename__ = "notifications"
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    notif_type = db.Column(db.String(30), nullable=False)   # like|comment|job|system|connection
    title      = db.Column(db.String(200), nullable=False)
    body       = db.Column(db.Text, nullable=True)
    is_read    = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id":         self.id,
            "notif_type": self.notif_type,
            "title":      self.title,
            "body":       self.body,
            "is_read":    self.is_read,
            "created_at": self.created_at.isoformat(),
        }