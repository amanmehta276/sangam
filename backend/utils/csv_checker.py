import csv
import os
from config import cfg

# Cache CSV data in memory on first load
_students: dict = {}

def _load():
    global _students
    path = cfg.ROLL_DB_PATH
    if not os.path.exists(path):
        print(f"[CSV] WARNING: {path} not found — all roll numbers will be rejected")
        return
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            roll = row.get("roll_number","").strip().upper()
            if roll:
                _students[roll] = {
                    "name":       row.get("name","").strip(),
                    "branch":     row.get("branch","").strip(),
                    "batch_year": row.get("batch_year","").strip(),
                    "mobile":     row.get("mobile","").strip(),
                    "role":       row.get("role","student").strip(),
                }
    print(f"[CSV] Loaded {len(_students)} students")

_load()  # load on import

def get_student(roll_number: str) -> dict | None:
    """Return student info dict if roll exists, else None"""
    return _students.get(roll_number.upper().strip())

def reload():
    """Hot-reload CSV without restarting server"""
    _students.clear()
    _load()
