# routes/chat.py
from flask import Blueprint, request, jsonify
from config.database import db
from models.chat import ChatMessage
from middleware.auth_middleware import token_required

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/messages", methods=["GET"])
@token_required
def get_messages(current_user):
    room = request.args.get("room", "global")
    msgs = (ChatMessage.query
            .filter_by(room=room)
            .order_by(ChatMessage.created_at.asc())
            .limit(50).all())
    return jsonify([m.to_dict() for m in msgs])

@chat_bp.route("/messages", methods=["POST"])
@token_required
def send_message(current_user):
    data = request.get_json() or {}
    if not data.get("content"):
        return jsonify({"error": "content required"}), 400
    msg = ChatMessage(
        sender_id=current_user.id,
        room=data.get("room", "global"),
        content=data["content"],
    )
    db.session.add(msg)
    db.session.commit()
    return jsonify(msg.to_dict()), 201

@chat_bp.route("/rooms", methods=["GET"])
@token_required
def list_rooms(current_user):
    """Returns available chat rooms for this user."""
    rooms = [
        {"id": "global",       "name": "🌐 Sangam Community",     "type": "group"},
        {"id": "placements",   "name": "💼 Placements 2025",       "type": "group"},
        {"id": "mentorship",   "name": "🤝 Mentorship Connect",    "type": "group"},
        {"id": f"cse-{current_user.batch_year}", "name": f"💻 {current_user.branch} {current_user.batch_year}", "type": "group"},
    ]
    return jsonify(rooms)