# models/post.py

from datetime import datetime


class Post:
    def __init__(self, data):
        self.id         = str(data.get("_id"))
        self.author_id  = str(data.get("author_id"))
        self.post_type  = data.get("post_type", "update")
        self.content    = data.get("content")
        self.tags       = data.get("tags", [])
        self.likes      = data.get("likes", 0)
        self.created_at = data.get("created_at", datetime.utcnow())

    def to_dict(self, author_data=None):
        return {
            "id": self.id,
            "author": author_data,  # route se bhejna
            "post_type": self.post_type,
            "content": self.content,
            "tags": self.tags,
            "likes": self.likes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }