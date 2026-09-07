from datetime import datetime
from bson import ObjectId
from models import subscriptions_col

class Subscription:
    @staticmethod
    def create_pending(user_id: str, razorpay_subscription_id: str, plan_id: str) -> dict:
        now = datetime.utcnow()
        doc = {
            "user_id":                  ObjectId(user_id),
            "razorpay_subscription_id": razorpay_subscription_id,
            "plan_id":                  plan_id,
            "status":                   "pending",   # pending -> active -> cancelled/halted
            "current_period_end":       None,
            "created_at":               now,
            "updated_at":               now,
        }
        subscriptions_col.insert_one(doc)
        return doc

    @staticmethod
    def find_by_razorpay_id(razorpay_subscription_id: str) -> dict | None:
        return subscriptions_col.find_one({"razorpay_subscription_id": razorpay_subscription_id})

    @staticmethod
    def find_active_for_user(user_id: str) -> dict | None:
        return subscriptions_col.find_one({
            "user_id": ObjectId(user_id),
            "status": "active",
        })

    @staticmethod
    def set_status(razorpay_subscription_id: str, status: str) -> None:
        subscriptions_col.update_one(
            {"razorpay_subscription_id": razorpay_subscription_id},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}},
        )