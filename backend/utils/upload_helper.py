import os
import uuid
from PIL import Image
from werkzeug.utils import secure_filename
from config import cfg

def _ensure(folder):
    os.makedirs(folder, exist_ok=True)
    return folder

def save_image(file, subfolder: str, max_px: int = 1200) -> str:
    """
    Save + resize image. Returns public URL path like /uploads/avatars/abc.jpg
    """
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in cfg.ALLOWED_IMG_EXT:
        raise ValueError(f"File type .{ext} not allowed")

    folder = _ensure(os.path.join(cfg.UPLOAD_FOLDER, subfolder))
    fname  = f"{uuid.uuid4().hex}.{ext}"
    path   = os.path.join(folder, fname)

    img = Image.open(file.stream)
    img = img.convert("RGB")
    img.thumbnail((max_px, max_px), Image.LANCZOS)
    img.save(path, optimize=True, quality=85)

    return f"/uploads/{subfolder}/{fname}"

def save_file(file, subfolder: str = "media") -> tuple[str, str]:
    """
    Save raw file. Returns (public_url, media_type)
    """
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in cfg.ALLOWED_FILE_EXT | cfg.ALLOWED_IMG_EXT:
        raise ValueError(f"File type .{ext} not allowed")

    folder = _ensure(os.path.join(cfg.UPLOAD_FOLDER, subfolder))
    fname  = secure_filename(f"{uuid.uuid4().hex}_{file.filename}")
    path   = os.path.join(folder, fname)
    file.save(path)

    media_type = "image" if ext in cfg.ALLOWED_IMG_EXT else \
                 "video" if ext in {"mp4","mov","webm"} else "file"
    return f"/uploads/{subfolder}/{fname}", media_type
