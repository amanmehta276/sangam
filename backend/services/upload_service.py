# services/upload_service.py
# Handles file uploads for chat + profile pictures
# Free storage = local disk. For production use Cloudinary (free tier).

import os, uuid, mimetypes
from flask import current_app
from werkzeug.utils import secure_filename

IMAGE_EXTS = {"png","jpg","jpeg","gif","webp"}
VIDEO_EXTS = {"mp4","mov","avi","webm"}
DOC_EXTS   = {"pdf","doc","docx","xlsx","xls","ppt","pptx","txt","zip"}


def _ext(filename: str) -> str:
    return filename.rsplit(".",1)[-1].lower() if "." in filename else ""


def handle_upload(file_obj, subfolder: str = "general") -> dict:
    """
    Save an uploaded file and return its URL.
    Returns { ok, url, media_type } or { ok=False, error }
    """
    if not file_obj or not file_obj.filename:
        return {"ok": False, "error": "No file"}

    ext = _ext(file_obj.filename)
    allowed = current_app.config.get("ALLOWED_EXT",
              IMAGE_EXTS | VIDEO_EXTS | DOC_EXTS)

    if ext not in allowed:
        return {"ok": False, "error": f"File type .{ext} not allowed"}

    # Check size
    file_obj.seek(0, 2)
    size_mb = file_obj.tell() / (1024*1024)
    file_obj.seek(0)
    max_mb = current_app.config.get("MAX_FILE_MB", 10)
    if size_mb > max_mb:
        return {"ok": False, "error": f"File too large. Max {max_mb}MB."}

    # Determine media type
    if ext in IMAGE_EXTS:   mt = "image"
    elif ext in VIDEO_EXTS: mt = "video"
    else:                   mt = "file"

    # Save to disk
    upload_base = current_app.config.get("UPLOAD_FOLDER","uploads")
    dest_dir    = os.path.join(upload_base, subfolder)
    os.makedirs(dest_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}.{ext}"
    dest      = os.path.join(dest_dir, safe_name)
    file_obj.save(dest)

    url = f"/uploads/{subfolder}/{safe_name}"
    return {"ok": True, "url": url, "media_type": mt}