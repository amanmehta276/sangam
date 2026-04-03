# models/post.py
from config.database import db
from datetime import datetime

class Post(db.Model):
    __tablename__ = "posts"
    id         = db.Column(db.Integer, primary_key=True)
    author_id  = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    post_type  = db.Column(db.String(20), default="update")  # update|job|question|win|event|tip
    content    = db.Column(db.Text, nullable=False)
    tags       = db.Column(db.Text, nullable=True)           # CSV
    likes      = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id":        self.id,
            "author":    self.author.to_dict() if self.author else None,
            "post_type": self.post_type,
            "content":   self.content,
            "tags":      self.tags.split(",") if self.tags else [],
            "likes":     self.likes,
            "created_at":self.created_at.isoformat(),
        }