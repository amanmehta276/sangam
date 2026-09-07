# Payment (Razorpay Subscriptions) — Setup Guide

## 1) Naye files copy karo (as-is, no edit needed)

| Naya file (yahan se) | Kahan rakhna hai (project mein) |
|---|---|
| `models/subscription.py` | `backend/models/subscription.py` |
| `routes/payment.py` | `backend/routes/payment.py` |

## 2) `backend/models/__init__.py` mein add karo

File ke end mein, existing collections ke saath:

```python
subscriptions_col = db["subscriptions"]
```

Aur indexes wale section mein (`otps_col.create_index(...)` ke baad):

```python
subscriptions_col.create_index([("user_id", ASCENDING)])
subscriptions_col.create_index([("razorpay_subscription_id", ASCENDING)], unique=True)
```

## 3) `backend/config.py` mein add karo

`Config` class ke andar, `FRONTEND_URL` line ke baad:

```python
    RAZORPAY_KEY_ID         = os.getenv("RAZORPAY_KEY_ID")
    RAZORPAY_KEY_SECRET     = os.getenv("RAZORPAY_KEY_SECRET")
    RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET")
```

## 4) `backend/app.py` mein add karo

Blueprint imports ke saath:
```python
from routes.payment import payment_bp
```

Blueprint registrations ke saath:
```python
app.register_blueprint(payment_bp)
```

## 5) `backend/requirements.txt` mein ek line add karo

```
razorpay==1.4.2
```

Phir terminal mein:
```
pip install -r requirements.txt
```

## 6) `backend/.env` aur `backend/.env.example` dono mein add karo

`.env.example` mein (placeholder ke saath):
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx
```

`.env` mein — Razorpay dashboard se **real** test/live keys nikaal ke daalo (Settings → API Keys). Webhook secret Step 8 mein milega.

## 7) `backend/models/user.py` mein — allowed update fields

`update()` method ke `allowed` list mein `subscription_status` ADD MAT KARO — ye field sirf webhook se update honi chahiye, client se nahi. Isliye list ko as-is chhod do. (Ye jaan-boojh kar mention kiya hai taaki koi galti se add na kar de.)

## 8) Razorpay Dashboard pe karna hai (browser mein, code nahi)

1. **Plan banao**: Dashboard → Subscriptions → Plans → Create Plan
   - Amount: `11682` (paise mein, matlab ₹116.82)
   - Billing cycle: Monthly
   - Save karne pe milega: `plan_XXXXXXXXXX`

2. `backend/routes/payment.py` khol ke `PLAN_CONFIG` dict mein
   `"plan_REPLACE_WITH_REAL_ID"` ko us real `plan_XXXXXXXXXX` se replace karo.

3. **Webhook setup**: Dashboard → Settings → Webhooks → Add New Webhook
   - URL: `https://sangam-z93f.onrender.com/api/payment/webhook`
   - Active events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`, `subscription.completed`
   - Save karne pe ek **Webhook Secret** milega — wahi `.env` mein `RAZORPAY_WEBHOOK_SECRET` mein daalo.

## 9) Render.com pe (production) — env vars add karo

Render Dashboard → aapki service → Environment → yeh 3 add karo:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## 10) Frontend mein add karna hai

`frontend/js/api.js` mein, `NotifsAPI` ke baad, ek naya block:

```javascript
const PaymentAPI = {
  createSubscription: (plan_id) =>
    _api("/payment/create-subscription", { method: "POST", body: { plan_id } }),
};
```

Kisi bhi page pe (e.g. `dashboard.html` ya naya `pricing.html`) Razorpay checkout script add karo `<head>` mein:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Aur ek button + function:
```html
<button onclick="subscribeNow()">Membership lo — ₹116.82/month</button>
```

```javascript
async function subscribeNow() {
  try {
    const data = await PaymentAPI.createSubscription("plan_XXXXXXXXXX"); // real plan_id daalo
    const rzp = new Razorpay({
      key: data.key_id,
      subscription_id: data.subscription_id,
      name: "Sangam",
      description: `Total ₹${data.display.total_amount} (incl. GST)`,
      handler: function () {
        showToast("Payment submitted! Activation mein thoda time lagega.", "info");
      },
    });
    rzp.open();
  } catch (e) {
    showToast(e.message || "Kuch galat ho gaya", "error");
  }
}
```

## 11) Ek security cheez jo abhi bhi pending hai

`backend/app.py` ke CORS config mein `"null"` origin allow hai — real payment jaane se pehle ye hata dena chahiye (production hardening), kyunki ab asli paisa involve ho raha hai.

---

## Test kaise karo (Razorpay Test Mode)

1. `.env` mein test keys (`rzp_test_...`) use karo
2. Local server run karo: `python app.py`
3. Frontend se subscribe button dabao
4. Razorpay checkout mein test card use karo: `4111 1111 1111 1111`, koi bhi future expiry, koi bhi CVV
5. Webhook local test karne ke liye Razorpay CLI ya `ngrok` chahiye hoga (localhost seedha webhook receive nahi kar sakta — Razorpay ko public URL chahiye)
6. Terminal mein `[DB]` logs aur MongoDB `subscriptions` collection check karo ki status `pending` → `active` ho raha hai