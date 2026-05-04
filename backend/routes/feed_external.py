# routes/feed_external.py
from flask import Blueprint, jsonify
import feedparser
from datetime import datetime, timedelta

feed_bp = Blueprint("feed_external", __name__)

# ── RSS sources — all free, no API key needed ──────────────────
RSS_SOURCES = [
    {
        "url":   "https://hnrss.org/jobs",
        "label": "HackerNews Jobs",
        "type":  "job",
    },
    {
        "url":   "https://hnrss.org/newest?q=internship+india",
        "label": "HN Internships",
        "type":  "job",
    },
    {
        "url":   "https://feeds.feedburner.com/TimesJobs",
        "label": "TimesJobs",
        "type":  "job",
    },
    {
        "url":   "https://remotive.com/remote-jobs/feed",
        "label": "Remotive Remote",
        "type":  "job",
    },
    {
        "url":   "https://techcrunch.com/feed/",
        "label": "TechCrunch",
        "type":  "update",
    },
]

# ── Simple in-memory cache (1 hour) ───────────────────────────
_cache: dict = {"data": None, "expires": datetime.min}


def _parse_entry(entry, source_label: str, post_type: str) -> dict:
    """Normalize a feedparser entry into Sangam's post format."""
    published = ""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        published = datetime(*entry.published_parsed[:6]).isoformat()
    elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
        published = datetime(*entry.updated_parsed[:6]).isoformat()
    else:
        published = datetime.utcnow().isoformat()

    summary = getattr(entry, "summary", "") or ""
    # Strip HTML tags simply
    import re
    summary = re.sub(r"<[^>]+>", " ", summary).strip()
    summary = " ".join(summary.split())[:300]  # trim to 300 chars

    return {
        "id":         entry.get("id", entry.get("link", "")),
        "post_type":  post_type,
        "content":    summary or entry.get("title", ""),
        "source_url": entry.get("link", ""),
        "author": {
            "name":        source_label,
            "role":        "external",
            "trust_level": "partial",
            "branch":      "",
            "batch_year":  "",
        },
        "tags":       [],
        "likes":      0,
        "created_at": published,
        "is_external": True,
    }


@feed_bp.route("", methods=["GET"])
def get_external_feed():
    global _cache

    # Serve from cache if still fresh
    if _cache["data"] and datetime.utcnow() < _cache["expires"]:
        return jsonify(_cache["data"])

    posts = []
    for source in RSS_SOURCES:
        try:
            feed = feedparser.parse(source["url"])
            for entry in feed.entries[:6]:          # max 6 per source
                posts.append(_parse_entry(entry, source["label"], source["type"]))
        except Exception as e:
            print(f"[RSS] Failed to fetch {source['url']}: {e}")
            continue

    # Sort newest first
    posts.sort(key=lambda p: p["created_at"], reverse=True)

    # Cache for 1 hour
    _cache = {"data": posts, "expires": datetime.utcnow() + timedelta(hours=1)}

    return jsonify(posts)