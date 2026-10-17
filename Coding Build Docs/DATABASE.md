# Pattern Mirror: Database Schema (Firestore)

**Version:** 1.0  
**Database:** Google Cloud Firestore (NoSQL)  
**Region:** `us-central1` (adjustable per deployment)

---

## 1. Collections Overview

```
/users/{userId}                    — User accounts
/jobs/{jobId}                      — Report generation jobs
/reports/{reportId}                — Completed reports
/extraction_cache/{dataHash}       — Cached extractions (TTL)
/checkouts/{checkoutId}            — Lemon Squeezy checkout/order tracking
/audit_logs/{timestamp}_{userId}   — User action audit trail
```

---

## 2. Collection: /users/{userId}

**Purpose:** Store user account data and preferences.

**Document Schema:**
```json
{
  "userId": "user_abc123",                          // Primary key (Firebase UID)
  "email": "user@example.com",                      // Required
  "displayName": "Sarah Chen",                      // Optional
  "subscriptionTier": "renew90_user",               // free | renew90_user | premium
  "createdAt": "2025-06-14T10:00:00Z",             // Timestamp
  "updatedAt": "2025-06-14T10:00:00Z",             // Timestamp
  
  // Preferences
  "preferences": {
    "emailNotifications": true,
    "shareDataForResearch": false,
    "timezone": "America/New_York"
  },
  
  // Usage tracking (for rate limiting)
  "monthlyReportCount": 2,
  "monthlyReportReset": "2025-07-01T00:00:00Z",
  "totalReportsAllTime": 8,
  
  // Payment info
  "lemonSqueezyCustomerId": "cus_abc123",           // Lemon Squeezy customer ID
  "paymentMethod": "card",                          // card | other
  
  // Renew90 integration (optional, if they're a Renew90 user)
  "renew90UserId": "renew90_user_xyz",             // Foreign key to Renew90 system
  "renew90SyncedAt": "2025-06-14T09:00:00Z"       // Last sync timestamp
}
```

**Indexes Needed:**
- None (userId is primary key, lookups are fast by UID)

**Constraints:**
- `email`: Unique (enforce at app level, use Firebase Auth as source of truth)
- `subscriptionTier`: Enum validation required
- `createdAt`: Immutable (set once, never update)

**Queries:**
```
// Get user by ID (primary)
db.collection('users').doc(userId).get()

// Update user preferences
db.collection('users').doc(userId).update({
  'preferences.emailNotifications': false
})
```

---

## 3. Collection: /jobs/{jobId}

**Purpose:** Track report generation jobs in real-time.

**Document Schema:**
```json
{
  "jobId": "job_12345",                            // Primary key (UUID)
  "userId": "user_abc123",                         // FK to users
  "reportId": "report_67890",                      // FK to reports (set after completion)
  "createdAt": "2025-06-14T10:30:00Z",            // Job creation time
  "startedAt": "2025-06-14T10:31:00Z",            // Job processing start
  "completedAt": null,                             // Set on completion
  
  // Status tracking
  "status": "analyzing",                           // queued|extracting|analyzing|generating|finalizing|complete|failed
  "progress": 45,                                  // 0-100
  "currentPhase": "Analyzing emotional patterns...",
  "estimatedRemainingSeconds": 240,
  
  // Input data reference
  "dataType": "structured",                        // structured|semi|unstructured
  "journalCount": 45,
  "journalFileSize": 125000,                       // Bytes
  "journalStoragePath": "gs://bucket/temp/job_12345/journal.csv",
  
  // Processing metadata
  "processingTimeSeconds": null,                   // Set after completion
  "tokenUsageEstimate": {
    "extractionTokens": 5000,
    "analysisTokens": 8000,
    "narrativeTokens": 35000,
    "totalTokens": 48000
  },
  
  // User input
  "focusQuestions": [
    "What habit is costing me peace?",
    "Where do I abandon my values?"
  ],
  "frameworks": ["mbti", "enneagram"],
  "userMbtiType": "INTJ",                          // Optional, user may not know
  "userEnneagramType": 5,                          // Optional
  "userContext": {
    "goals": "Better sleep, stronger relationships",
    "values": "Integrity, Family, Growth",
    "dateRange": {
      "startDate": "2025-03-01",
      "endDate": "2025-05-31"
    }
  },
  
  // Error tracking (if failed)
  "errorMessage": null,
  "errorPhase": null,                              // Which phase failed
  "errorRecoverable": null,
  "retryCount": 0,
  "maxRetries": 3,
  
  // Payment
  "chargeAmount": 4999,                            // Cents (49.99 USD)
  "chargeCurrency": "usd",
  "checkoutId": "checkout_abc123",                 // FK to /checkouts
  "lemonSqueezyOrderId": "order_789",
  "paymentStatus": "succeeded"                     // succeeded|failed|pending
}
```

**Indexes Needed:**
```
- Composite: userId + status (for filtering jobs by user + status)
- Simple: userId (for listing user's jobs)
- Simple: status (for admin queries)
- Simple: createdAt (for cleanup jobs)
```

**Constraints:**
- `status`: Must be valid enum value
- `progress`: Must be 0-100
- `jobId`: Unique
- `focusQuestions`: Must contain exactly 2 items

**Queries:**
```
// Get job by ID
db.collection('jobs').doc(jobId).get()

// Get all jobs for a user
db.collection('jobs').where('userId', '==', userId).get()

// Get user's in-progress jobs
db.collection('jobs')
  .where('userId', '==', userId)
  .where('status', 'in', ['queued', 'extracting', 'analyzing', 'generating'])
  .get()

// Cleanup: Find jobs older than 30 days
db.collection('jobs')
  .where('status', '==', 'complete')
  .where('completedAt', '<', thirtyDaysAgo)
  .get()

// Update job progress
db.collection('jobs').doc(jobId).update({
  status: 'analyzing',
  progress: 50,
  currentPhase: 'Analyzing patterns...',
  estimatedRemainingSeconds: 240
})
```

**TTL (Time To Live):**
- Delete job records after 90 days (retention for audit only)
- Set firestore TTL policy: `expireAt = completedAt + 90 days`

---

## 4. Collection: /reports/{reportId}

**Purpose:** Store metadata for completed reports.

**Document Schema:**
```json
{
  "reportId": "report_67890",                      // Primary key (UUID)
  "userId": "user_abc123",                         // FK to users
  "jobId": "job_12345",                            // FK to jobs
  "generatedAt": "2025-06-14T10:38:00Z",          // Completion timestamp
  
  // Input parameters (saved for regeneration reference)
  "dataType": "structured",
  "journalCount": 45,
  "dateRange": {
    "startDate": "2025-03-01",
    "endDate": "2025-05-31"
  },
  "focusQuestions": [
    "What habit is costing me peace?",
    "Where do I abandon my values?"
  ],
  "frameworksSelected": ["mbti", "enneagram"],
  
  // Output location
  "pdfStoragePath": "gs://bucket/reports/report_67890.pdf",
  "pdfSize": 245000,                               // Bytes
  "pdfEncrypted": true,
  "pdfExpiresAt": "2025-07-14T10:38:00Z",         // 30-day expiry
  
  // Download access
  "pdfSignedUrl": "https://storage.googleapis.com/...",
  "pdfSignedUrlExpiresAt": "2025-07-14T10:38:00Z",
  "downloadCount": 3,
  "lastDownloadedAt": "2025-06-14T14:22:00Z",
  
  // Processing metadata
  "processingTimeSeconds": 480,
  "status": "ready",                               // ready|archived|deleted
  
  // Report content summary (for display in UI)
  "contentSummary": {
    "lifeAreas": ["Work", "Relationships", "Health", "Spirituality"],
    "dominantMood": "anxious",
    "reportLength": "11 pages",
    "generatedSections": ["landscape", "focus_q1", "focus_q2", "blind_spots", "mbti", "enneagram"]
  },
  
  // Versioning (for regenerations)
  "version": 1,                                     // Incremented on regenerate
  "regenerationOf": null,                           // If this is a regeneration, points to original reportId
  
  // Cost tracking
  "estimatedAiCost": 0.065,                        // USD
  "estimatedInfrastructureCost": 0.03,
  "totalCost": 0.095
}
```

**Indexes Needed:**
```
- Simple: userId (for listing user's reports)
- Simple: generatedAt (for sorting by date)
- Simple: status (for active/archived queries)
- Composite: userId + generatedAt (for user's report history sorted by date)
```

**Constraints:**
- `reportId`: Unique
- `status`: Enum value
- `pdfExpiresAt`: Date must be >= generatedAt
- `dataType`: Valid enum

**Queries:**
```
// Get report by ID
db.collection('reports').doc(reportId).get()

// Get all reports for a user, sorted by date
db.collection('reports')
  .where('userId', '==', userId)
  .orderBy('generatedAt', 'desc')
  .limit(10)
  .get()

// Find expired PDFs for cleanup
db.collection('reports')
  .where('pdfExpiresAt', '<', now)
  .where('status', '==', 'ready')
  .get()

// Get report versions (original + regenerations)
db.collection('reports')
  .where('userId', '==', userId)
  .where('regenerationOf', '==', originalReportId)
  .get()
```

**TTL:**
- Delete report PDFs after 30 days (configurable)
- Keep metadata longer (90 days) for billing/analytics
- Set Firestore TTL: `pdfExpiresAt` field

---

## 5. Collection: /extraction_cache/{dataHash}

**Purpose:** Cache extraction results to avoid re-processing same data within 7 days.

**Document Schema:**
```json
{
  "dataHash": "sha256_abc123def456",               // Primary key (SHA256 of journal content)
  "userId": "user_abc123",                         // FK to users
  "createdAt": "2025-06-14T10:30:00Z",
  "expiresAt": "2025-06-21T10:30:00Z",            // 7 days TTL
  
  // Cached extraction result
  "extraction": {
    "lifeAreasFound": ["Work", "Relationships", "Health", "Spirituality"],
    "areaFrequencies": {
      "Work": 0.45,
      "Relationships": 0.28,
      "Health": 0.18,
      "Spirituality": 0.09
    },
    "emotionalTones": ["anxious", "reflective", "grateful", "frustrated"],
    "confidenceScore": 0.87,
    "summary": "We found 4 main life areas you write about..."
  },
  
  // Metadata
  "sourceDataType": "unstructured",
  "journalCount": 120,
  "extractionTime": 450,                           // Seconds
  "tokensUsed": 5200,
  "cost": 0.015                                    // USD
}
```

**Indexes Needed:**
- Simple: userId (for cache lookup by user)
- Simple: expiresAt (for TTL cleanup)

**Constraints:**
- `dataHash`: Unique
- `expiresAt`: Must be > createdAt

**Queries:**
```
// Check if extraction cached
const hash = sha256(journalContent);
const cached = await db.collection('extraction_cache').doc(hash).get();

if (cached.exists && cached.data().expiresAt > now) {
  // Use cached extraction
  const { extraction } = cached.data();
}

// Delete expired caches
db.collection('extraction_cache')
  .where('expiresAt', '<', now)
  .get()
```

**TTL:**
- Firestore TTL policy: Delete documents where `expiresAt` < now
- Set TTL duration: 7 days

---

## 6. Collection: /checkouts/{checkoutId}

**Purpose:** Track Lemon Squeezy checkouts/orders for debugging and reconciliation. Created when the backend requests a checkout; updated by the `/api/webhooks/lemonsqueezy` handler once Lemon Squeezy confirms payment — never trust client-reported payment status.

**Document Schema:**
```json
{
  "checkoutId": "checkout_abc123",                 // Primary key (our generated ID, embedded in Lemon Squeezy custom_data)
  "userId": "user_abc123",                         // FK to users
  "jobId": "job_12345",                            // FK to jobs (job may be created pending this checkout)
  "createdAt": "2025-06-14T10:30:00Z",
  "updatedAt": "2025-06-14T10:35:00Z",
  
  "amount": 4999,                                  // Cents
  "currency": "usd",
  "variantId": "123456",                           // Lemon Squeezy product variant purchased
  "status": "paid",                                // pending|paid|failed|expired|refunded
  
  "checkoutUrl": "https://patternmirror.lemonsqueezy.com/checkout/custom/abc123",
  "lemonSqueezyOrderId": "order_789",              // Set once order_created webhook lands
  "lemonSqueezyData": {
    "id": "order_789",
    "attributes": {
      "status": "paid",
      "total": 4999,
      "currency": "usd",
      "refunded": false
    }
  }
}
```

**Queries:**
```
// Lookup by our checkout ID
db.collection('checkouts').doc(checkoutId).get()

// Get user's payment history
db.collection('checkouts')
  .where('userId', '==', userId)
  .orderBy('createdAt', 'desc')
  .get()

// Find failed/stuck checkouts for reconciliation
db.collection('checkouts')
  .where('status', '==', 'failed')
  .where('createdAt', '>', oneDayAgo)
  .get()
```

---

## 7. Collection: /audit_logs/{timestamp}_{userId}

**Purpose:** Track all user actions for security and debugging.

**Document Schema:**
```json
{
  "auditId": "2025-06-14T10:30:00Z_user_abc123_action_001",  // Document ID
  "userId": "user_abc123",
  "timestamp": "2025-06-14T10:30:00Z",
  "action": "report_created",                      // Action type
  "resourceId": "job_12345",
  "details": {
    "dataType": "structured",
    "frameworks": ["mbti"],
    "cost": 0.00
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Queries:**
```
// Get audit logs for a user
db.collection('audit_logs')
  .where('userId', '==', userId)
  .orderBy('timestamp', 'desc')
  .get()

// Find actions of a specific type
db.collection('audit_logs')
  .where('action', '==', 'report_created')
  .where('timestamp', '>', oneDayAgo)
  .get()
```

---

## 8. Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read/write their own documents
    match /users/{userId} {
      allow read, update: if request.auth.uid == userId;
      allow create: if request.auth.uid == userId;
      allow delete: if false; // Never delete user docs
    }
    
    // Users can read their own jobs
    match /jobs/{jobId} {
      allow read: if resource.data.userId == request.auth.uid;
      allow create: if request.auth.uid != null;
      allow update: if resource.data.userId == request.auth.uid;
      allow delete: if false; // Never delete, archive instead
    }
    
    // Users can read their own reports
    match /reports/{reportId} {
      allow read: if resource.data.userId == request.auth.uid;
      allow create: if false; // Created by backend only
      allow update: if resource.data.userId == request.auth.uid;
      allow delete: if false; // Never delete, archive instead
    }
    
    // Extraction cache: users can read, backend creates
    match /extraction_cache/{dataHash} {
      allow read: if resource.data.userId == request.auth.uid;
      allow create: if false; // Backend only
      allow update: if false;
      allow delete: if false;
    }
    
    // Checkouts: users can read their own; only backend (Admin SDK, bypasses rules) creates/updates
    match /checkouts/{checkoutId} {
      allow read: if resource.data.userId == request.auth.uid;
      allow create: if false;
      allow update: if false;
      allow delete: if false;
    }
    
    // Audit logs: users can read their own
    match /audit_logs/{logId} {
      allow read: if logId.split('_')[1] == request.auth.uid;
      allow create: if false; // Backend only
      allow update: if false;
      allow delete: if false;
    }
    
    // Deny all by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 9. Indexes to Create (Firestore Console)

**Collection: jobs**
```
- userId, status (Ascending, Ascending)
- userId, createdAt (Ascending, Descending)
```

**Collection: reports**
```
- userId, generatedAt (Ascending, Descending)
- userId, status (Ascending, Ascending)
```

**Collection: extraction_cache**
```
- userId, expiresAt (Ascending, Ascending)
```

**Collection: audit_logs**
```
- userId, timestamp (Ascending, Descending)
- action, timestamp (Ascending, Descending)
```

---

## 10. Data Cleanup / TTL Policies

**Firestore TTL Policy Setup:**

```
Collection: jobs
  Field: expiresAt (set to completedAt + 90 days)
  Behavior: Auto-delete after 90 days
  
Collection: reports
  Field: pdfExpiresAt (set to generatedAt + 30 days)
  Behavior: Auto-delete PDF only, keep metadata
  
Collection: extraction_cache
  Field: expiresAt (set to createdAt + 7 days)
  Behavior: Auto-delete after 7 days
```

---

## 11. Backup & Recovery

**Backup Strategy:**
- Firestore automated backups (daily, 7-day retention)
- Export to Cloud Storage weekly (for long-term archive)
- Test restore annually

**Recovery RTO/RPO:**
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 24 hours

---

## 12. Data Migration Examples

### Add a field to all documents
```javascript
// One-time migration script
const snapshot = await db.collection('users').get();
const batch = db.batch();

snapshot.docs.forEach(doc => {
  batch.update(doc.ref, {
    'preferences.theme': 'light'  // Add default
  });
});

await batch.commit();
```

### Rename a field
```javascript
const snapshot = await db.collection('jobs').get();
const batch = db.batch();

snapshot.docs.forEach(doc => {
  if (doc.data().oldFieldName !== undefined) {
    batch.update(doc.ref, {
      newFieldName: doc.data().oldFieldName,
      oldFieldName: firebase.firestore.FieldValue.delete()
    });
  }
});

await batch.commit();
```

---

## 13. Related Documents

- **ARCHITECTURE.md** — System design overview
- **API_SPEC.md** — API endpoints that query this database

