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















Ab dono documents (PAN + bank details) ready hain, chaliye **poora Razorpay setup flow** end-to-end batata hoon — account banane se lekar live payment tak.

## Poora Flow — Step by Step

### Phase 1 — Account banao (5 min)
1. `razorpay.com` pe jaake sign up karo — organizational email use karo (jo pehle discuss kiya tha)
2. Business type select karo: **"Trust / Society / Association"** (aapka NGO/non-profit type)
3. Basic details bharo — business name exactly PAN jaisa: `ALUMNI ASSOCIATION OF CHHATISGARH INSTITUTE OF TECHNOLOGY RAIPUR`

### Phase 2 — Test mode mein development (abhi turant kar sakte ho)
4. Dashboard → Settings → API Keys → **Generate Test Key** (KYC ki zaroorat nahi is step ke liye)
5. Test keys `.env` mein daalo, poora code test karo (jo humne pehle banaya)

### Phase 3 — KYC Submission (real business details ke saath)

Dashboard → Account & Settings → Business Settings mein ye fields bharo:

| Field | Value |
|---|---|
| PAN Number | `AAWAA9259N` |
| Business Name | `ALUMNI ASSOCIATION OF CHHATISGARH INSTITUTE OF TECHNOLOGY RAIPUR` |
| Date of Incorporation | `30/04/2026` |
| Bank Account Number | `50200125101989` |
| IFSC Code | `HDFC0000152` |
| Account holder name | Bilkul PAN jaisa naam hona chahiye (bank account bhi isi organization ke naam pe hona chahiye, kisi individual ke naam pe nahi) |

**Documents upload karne honge:**
- e-PAN card (jo dikhaya) ✅
- Trust/Society/Association registration certificate
- Cancelled cheque ya bank statement (isi account number `50200125101989` ka, taaki bank details verify ho)
- Authorized signatory ka ID proof (jo Razorpay account operate karega)
- GST certificate (chunki aap GST-registered ho)

### Phase 4 — Verification wait (2-3 din)
6. Razorpay team documents verify karegi — PAN name, bank account name, aur registration certificate ka naam **match hona chahiye exactly**
7. Approve hone pe **live keys** (`rzp_live_...`) milenge

### Phase 5 — Plan banao aur go live
8. Dashboard → Subscriptions → Plans → Create Plan → ₹116.82/month (`11682` paise)
9. Milega `plan_id` → isko `payment.py` aur `payment.js` dono mein daalo (jahan abhi `plan_REPLACE_WITH_REAL_ID` likha hai)
10. Webhook set karo: `https://sangam-z93f.onrender.com/api/payment/webhook`
11. `.env` mein test keys ko **live keys** se replace karo
12. Ek real transaction test karo (chota amount) — settlement bank account `50200125101989` mein 1-2 din mein aayega

### Phase 6 — Settlement cycle (ongoing)
Har successful payment ke baad, paisa (Razorpay fee minus) automatically **HDFC account `...101989`** mein transfer hota rahega — daily/weekly settlement cycle (Razorpay dashboard mein configure kar sakte ho).

---

**Abhi turant kya kar sakte ho:** Test mode mein poora code test karo (KYC ka wait kiye bina), aur parallel mein KYC documents submit kar do. Jab dono ready ho, bas keys switch karni hain.

Kaunsa step abhi start karna hai — KYC submission, ya pehle test mode mein poora flow verify karna?

















I’m checking the dashboard auth guard and the membership/auth entry points because the redirect loop is likely caused by a stale login/session check or a bad redirect target.

Read , lines 1 to 120

Read , lines 1 to 220

Read 

Read 

Read 

## Reason

Haan, yeh current logic intentionally redirect karta hai.

In `dashboard.js:38-47`, ye guard hai:

- agar `Auth.isLoggedIn()` false hai
- tab `window.location.href = "auth.html"`

Aur fir `dashboard.js:60-74` me ye bhi hai:

- `AuthAPI.me()` call hota hai
- agar 401 mila, matlab token invalid/expired
- `Auth.clear();`
- phir redirect to auth page

So dashboard khulne ke baad auth open hona normal hai agar:

1. token missing hai
2. token expired hai
3. backend `/api/auth/me` response 401 de raha hai
4. login flow me token save nahi ho raha

---

## Check karne ka exact point

Aap ye check karo:

- browser devtools > Application > Local Storage
- `sangam_token` aur `sangam_user` visible hain ya nahi

Agar dono missing hain, to dashboard auth page me redirect hoga hi.

Also check `api.js:7-16`:
- API URL is correct or not
- if backend unreachable, `AuthAPI.me()` fail hoga and redirect triggers

---

## Short answer

Ye problem likely is not dashboard ka bug, balki auth guard ka behavior hai.

Agar aapko “testing ke liye dashboard bina login bhi open ho” chahiye, to:
- `dashboard.js:38-47` me ye guard remove kar do

Agar aapko actual login flow sahi chahiye, to:
- login ke baad token store hona chahiye
- backend `/api/auth/me` 200 return karna chahiye
- phir dashboard open hona chahiye

> Meaning: current behavior is “dashboard protected by auth”, not “dashboard open without login”.

If you want, next I can directly tell you which exact 2 lines to remove for testing, or fix the login-token issue.