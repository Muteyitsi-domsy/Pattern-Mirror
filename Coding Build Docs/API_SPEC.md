# Pattern Mirror: API Specification

**Version:** 3.0  
**Format:** OpenAPI 3.0 / REST  
**Base URL:** `https://api.patternmirror.app`  (dev: `http://localhost:8000/api`)  
**Authentication:** Firebase ID Token (Bearer token in Authorization header)

---

## 1. Authentication

All endpoints (except `/health` and `/auth/login`) require:

```
Authorization: Bearer {firebase_id_token}
```

### Obtaining Token (Frontend)
```javascript
import { getAuth } from 'firebase/auth';
const auth = getAuth();
const user = auth.currentUser;
const token = await user.getIdToken();
// Use in headers: Authorization: Bearer ${token}
```

---

## 2. Error Response Format

All error responses follow this schema:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "statusCode": 400,
  "details": {
    "field": "value",
    "reason": "Why this failed"
  }
}
```

**Common Error Codes:**
- `validation_error` — Request body validation failed
- `authentication_error` — Invalid/missing token
- `authorization_error` — User doesn't have permission
- `not_found` — Resource not found
- `conflict` — Duplicate resource (e.g., duplicate account)
- `rate_limit_exceeded` — Too many requests
- `payment_required` — Payment failed or missing
- `server_error` — Internal server error (500)

---

## 3. Rate Limiting

**Per User (by tier):**
- Free: 5 reports/month
- Renew90: Unlimited
- Premium: 10 reports/month

**Response Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1719043200
```

**When Exceeded (429):**
```json
{
  "error": "rate_limit_exceeded",
  "message": "You have 0 reports remaining this month. Next reset: 2025-07-01",
  "resetTime": "2025-07-01T00:00:00Z"
}
```

---

## 4. Endpoints

### 4.1 Health Check (No Auth Required)

**GET /health**

Quick status check for monitoring.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-14T10:30:00Z"
}
```

---

### 4.2 Authentication

#### Login / Get Firebase Token
**POST /auth/login**

Frontend uses Firebase SDK directly. Backend validates token on each request.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "idToken": "eyJhbGc...",
  "userId": "user_uuid",
  "email": "user@example.com"
}
```

#### Logout
**POST /auth/logout**

**Request:** (Auth required)
```
(no body)
```

**Response (200):**
```json
{
  "message": "Successfully logged out"
}
```

---

### 4.3 Reports

#### Create Report Job
**POST /api/reports/create**

Initiates a new pattern analysis job.

**Request:**
```json
{
  "dataType": "structured",
  "journalFile": "base64_encoded_content",
  "fileName": "mood_journal_march.csv",
  "focusQuestions": [
    "What habit is costing me peace?",
    "Where do I abandon my values?"
  ],
  "frameworks": ["mbti", "enneagram"],
  "userContext": {
    "goals": "Sleep better, improve work relationships, find joy in small things",
    "values": "Integrity, Family, Growth, Authenticity",
    "dateRange": {
      "startDate": "2025-03-01",
      "endDate": "2025-05-31"
    }
  },
  "userMbtiType": "INTJ",
  "userEnneagramType": "5"
}
```

**Field Validation:**
- `dataType`: Must be `structured`, `semi`, or `unstructured`
- `focusQuestions`: Array of exactly 2 strings
- `frameworks`: Array of 0-2 items, valid values: `mbti`, `enneagram`, `values`
- `journalFile`: Base64-encoded, ≤50MB
- `fileName`: Required for storage reference
- `userMbtiType`, `userEnneagramType`: Optional (user can skip if unknown)

**Response (202 Accepted):**
```json
{
  "jobId": "job_uuid_12345",
  "reportId": "report_uuid_67890",
  "status": "queued",
  "estimatedCompletionSeconds": 480,
  "userCanWait": true,
  "statusCheckUrl": "/api/reports/job_uuid_12345/status",
  "message": "Your report job has been queued. Estimated completion: 8 minutes."
}
```

**Response (400 Validation Error):**
```json
{
  "error": "validation_error",
  "message": "focusQuestions must contain exactly 2 items",
  "field": "focusQuestions"
}
```

**Response (402 Payment Required):**
```json
{
  "error": "payment_required",
  "message": "Payment needed before this report can run. Complete checkout and try again.",
  "checkoutUrl": "https://patternmirror.lemonsqueezy.com/checkout/custom/abc123",
  "retryableAfter": "2025-06-14T11:00:00Z"
}
```

Note: Unlike a saved-card flow, Lemon Squeezy payment is not confirmed synchronously inside this request. If the user's tier requires payment and no successful order exists yet for this upload, the backend returns 402 with a `checkoutUrl` instead of attempting an inline charge. See Section 4.5.

**Response (429 Rate Limit):**
```json
{
  "error": "rate_limit_exceeded",
  "message": "You have 0 reports remaining this month",
  "resetTime": "2025-07-01T00:00:00Z"
}
```

**Side Effects:**
- Job record created in Firestore
- Task queued in Cloud Tasks
- User charged (if applicable)
- Analytics event logged: `report_created`

---

#### Get Job Status
**GET /api/reports/{jobId}/status**

Poll this endpoint to track report generation progress.

**Response (200):**
```json
{
  "jobId": "job_uuid_12345",
  "status": "analyzing",
  "progress": 45,
  "currentPhase": "Analyzing emotional patterns...",
  "estimatedRemainingSeconds": 240,
  "startedAt": "2025-06-14T10:30:00Z",
  "reportId": "report_uuid_67890"
}
```

**Possible Status Values:**
- `queued` — Waiting for processing to start
- `extracting` — Reading and structuring journal data (unstructured only)
- `analyzing` — Running pattern/quote/framework analysis engines
- `generating` — Creating narrative sections via Claude
- `finalizing` — Generating PDF and uploading
- `complete` — Done! Report ready for download
- `failed` — Error occurred (see error field)

**Response (200, After Completion):**
```json
{
  "jobId": "job_uuid_12345",
  "status": "complete",
  "progress": 100,
  "reportId": "report_uuid_67890",
  "processingTimeSeconds": 480,
  "completedAt": "2025-06-14T10:38:00Z"
}
```

**Response (200, Failed):**
```json
{
  "jobId": "job_uuid_12345",
  "status": "failed",
  "error": {
    "phase": "analyzing",
    "message": "Pattern detection failed due to insufficient data",
    "recoverable": true
  }
}
```

---

#### Get Report Metadata
**GET /api/reports/{reportId}**

Fetch metadata about a completed report.

**Response (200):**
```json
{
  "reportId": "report_uuid_67890",
  "userId": "user_uuid",
  "generatedAt": "2025-06-14T10:38:00Z",
  "dataType": "structured",
  "journalCount": 45,
  "dateRange": {
    "startDate": "2025-03-01",
    "endDate": "2025-05-31"
  },
  "frameworksSelected": ["mbti", "enneagram"],
  "focusQuestions": [
    "What habit is costing me peace?",
    "Where do I abandon my values?"
  ],
  "pdfUrl": "https://storage.googleapis.com/reports/report_uuid_67890.pdf?token=...",
  "pdfUrlExpiresAt": "2025-07-14T10:38:00Z",
  "processingTimeSeconds": 480,
  "status": "ready"
}
```

**Response (404):**
```json
{
  "error": "not_found",
  "message": "Report not found"
}
```

---

#### List User's Reports
**GET /api/account/reports?limit=10&offset=0**

Paginated list of user's past reports.

**Query Parameters:**
- `limit` (optional): Max results to return (default: 10, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `sortBy` (optional): `created_at` (default), `processing_time`
- `sortOrder` (optional): `desc` (default), `asc`

**Response (200):**
```json
{
  "reports": [
    {
      "reportId": "report_uuid_1",
      "generatedAt": "2025-06-14T10:38:00Z",
      "dataType": "structured",
      "journalCount": 45,
      "processingTimeSeconds": 480,
      "status": "ready"
    },
    {
      "reportId": "report_uuid_2",
      "generatedAt": "2025-06-13T14:20:00Z",
      "dataType": "unstructured",
      "journalCount": 120,
      "processingTimeSeconds": 900,
      "status": "ready"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

---

#### Regenerate Report (Different Questions/Frameworks)
**POST /api/reports/{reportId}/regenerate**

Re-analyze existing journal data with different focus questions or frameworks. Uses cached extraction data (cheaper than full re-run).

**Request:**
```json
{
  "focusQuestions": [
    "How do my different life areas compete?",
    "What am I neglecting and why?"
  ],
  "frameworks": ["mbti"]
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "job_uuid_new",
  "reportId": "report_uuid_67890_v2",
  "status": "queued",
  "estimatedCompletionSeconds": 240,
  "message": "Report regeneration job queued. Using cached extraction data.",
  "cost": "$9.99"
}
```

**Response (409 Conflict):**
```json
{
  "error": "conflict",
  "message": "A regeneration job for this report is already in progress"
}
```

---

### 4.4 Account

#### Get User Account
**GET /api/account**

**Response (200):**
```json
{
  "userId": "user_uuid",
  "email": "user@example.com",
  "subscriptionTier": "renew90_user",
  "reportsThisMonth": 2,
  "reportLimit": "unlimited",
  "createdAt": "2025-01-15T08:00:00Z"
}
```

---

#### Update User Preferences
**PATCH /api/account**

**Request:**
```json
{
  "preferences": {
    "emailNotifications": true,
    "shareDataForResearch": false
  }
}
```

**Response (200):**
```json
{
  "preferences": {
    "emailNotifications": true,
    "shareDataForResearch": false
  }
}
```

---

### 4.5 Payment (Lemon Squeezy Integration)

Lemon Squeezy is a Merchant of Record: payment happens on Lemon Squeezy's hosted checkout page (redirect or `Lemon.js` overlay), not inside our own form. There is no client-side card entry and no synchronous "confirm" call — the backend finds out a payment succeeded via **webhook**, not via a response to a request it made.

**Flow:**
```
1. Frontend calls POST /api/payment/create-checkout
2. Backend calls Lemon Squeezy API to create a checkout, embeds
   { userId, dataType, pendingJobId } in custom_data
3. Backend returns checkoutUrl to frontend
4. Frontend redirects user to checkoutUrl (or opens Lemon.js overlay)
5. User pays on Lemon Squeezy's hosted page
6. Lemon Squeezy redirects back to our `redirect_url` AND fires an
   `order_created` webhook to POST /api/webhooks/lemonsqueezy
7. Backend verifies webhook signature, marks payment as paid,
   unblocks the associated job (or creates it, if not yet created)
8. Frontend polls GET /api/payment/checkout/{checkoutId}/status
   (same polling pattern as job status) until it sees "paid"
```

#### Create Checkout
**POST /api/payment/create-checkout**

**Request:**
```json
{
  "dataType": "unstructured",
  "description": "Pattern Mirror report analysis"
}
```

**Field Validation:**
- `dataType`: Must be `structured`, `semi`, or `unstructured` — price/variant is looked up server-side from this, never trust a client-supplied amount

**Response (200):**
```json
{
  "checkoutId": "checkout_abc123",
  "checkoutUrl": "https://patternmirror.lemonsqueezy.com/checkout/custom/abc123",
  "variantId": "123456",
  "amount": 4999,
  "currency": "usd",
  "status": "pending"
}
```

---

#### Get Checkout Status
**GET /api/payment/checkout/{checkoutId}/status**

Frontend polls this after redirecting to `checkoutUrl`, the same way it polls job status.

**Response (200):**
```json
{
  "checkoutId": "checkout_abc123",
  "status": "paid",
  "lemonSqueezyOrderId": "order_789",
  "paidAt": "2025-06-14T10:35:00Z"
}
```

**Possible `status` values:** `pending`, `paid`, `failed`, `expired`

---

#### Lemon Squeezy Webhook
**POST /api/webhooks/lemonsqueezy**

Not authenticated with a Firebase ID token (it's server-to-server from Lemon Squeezy). Instead, verify the `X-Signature` header: HMAC-SHA256 of the raw request body using the webhook signing secret, timing-safe compared.

**Request (from Lemon Squeezy, abbreviated):**
```json
{
  "meta": {
    "event_name": "order_created",
    "custom_data": { "userId": "user_abc123", "checkoutId": "checkout_abc123" }
  },
  "data": {
    "id": "order_789",
    "attributes": { "status": "paid", "total": 4999, "currency": "usd" }
  }
}
```

**Response (200):**
```json
{ "received": true }
```

**Response (401, bad signature):**
```json
{
  "error": "authentication_error",
  "message": "Invalid webhook signature"
}
```

**Handled events:** `order_created` (mark checkout paid, unblock job), `order_refunded` (flag report, revoke access per policy)

---

## 5. Pagination Standard

All list endpoints use:
- `limit`: Results per page (default: 10, max: 100)
- `offset`: Number of items to skip (default: 0)

**Response includes:**
```json
{
  "data": [...],
  "total": 25,
  "limit": 10,
  "offset": 0,
  "hasMore": true
}
```

---

## 6. Timestamps

All timestamps are ISO 8601 format:
```
2025-06-14T10:30:00Z
```

---

## 7. Testing the API

### Example: Create Report (curl)
```bash
curl -X POST https://api.patternmirror.app/api/reports/create \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataType": "structured",
    "journalFile": "..."base64 content"...",
    "fileName": "mood_journal.csv",
    "focusQuestions": ["What habit costs me peace?", "Where do I abandon my values?"],
    "frameworks": ["mbti"],
    "userContext": {
      "goals": "Better sleep, stronger relationships",
      "values": "Integrity, Family, Growth"
    }
  }'
```

### Example: Check Status (JavaScript)
```javascript
const token = await firebase.auth().currentUser.getIdToken();
const response = await fetch(`/api/reports/${jobId}/status`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { status, progress } = await response.json();
console.log(`Progress: ${progress}%`);
```

---

## 8. API Response Times (SLA)

| Operation | Time |
|-----------|------|
| `/api/reports/create` | < 100ms |
| `/api/reports/{jobId}/status` | < 50ms |
| File upload (validation) | < 500ms |
| Job processing (structured data) | 5-10 min |
| Job processing (unstructured data) | 15-20 min |

---

## 9. Webhook Events (Future)

Currently not implemented. Future capability:

```
report.completed
report.failed
payment.succeeded
payment.failed
```

---

## 10. API Versioning

Current version: `v1` (implied in base URL)

Future versions will use: `/api/v2/reports/create`

---

## 11. Code Examples

### Frontend: Upload and Wait
```javascript
// 1. Create report
const response = await fetch('/api/reports/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    dataType: 'structured',
    journalFile: base64Content,
    focusQuestions: [q1, q2],
    frameworks: ['mbti']
  })
});

const { jobId } = await response.json();

// 2. Poll for completion
let status = 'queued';
while (status !== 'complete' && status !== 'failed') {
  const statusResp = await fetch(`/api/reports/${jobId}/status`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await statusResp.json();
  status = data.status;
  console.log(`Progress: ${data.progress}%`);
  await new Promise(r => setTimeout(r, 3000)); // Wait 3 sec
}

// 3. Fetch report
if (status === 'complete') {
  const reportResp = await fetch(`/api/reports/${data.reportId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const report = await reportResp.json();
  window.location.href = report.pdfUrl; // Download
}
```

### Frontend: Upload and Get Email
```javascript
// 1. Create report
const response = await fetch('/api/reports/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
});

const { jobId } = await response.json();

// 2. Redirect to home
// User will receive email when ready
window.location.href = '/home?jobId=' + jobId;
```

---

## 12. Related Documents

- **ARCHITECTURE.md** — System design and components
- **COMPONENT_SPECS.md** — Analysis engine algorithm specifications
- **PHASE_SPECS.md** — Development phases and deliverables

