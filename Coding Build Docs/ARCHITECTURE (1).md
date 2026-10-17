# Pattern Mirror: System Architecture Document

**Version:** 1.0  
**Last Updated:** June 2026  
**Status:** Ready for Development  

---

## 1. System Overview

Pattern Mirror is an AI-powered emotional pattern analysis service. Users upload journals (structured or unstructured), and the system generates a 8-12 page PDF report analyzing emotional patterns, life area correlations, and personality framework alignment.

**Key Architectural Principle:** Privacy-first, ephemeral data processing. User journals are analyzed once, then deleted immediately. Only encrypted reports are retained.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Web/Mobile)                     │
│  React/Next.js • Upload Flow • Progress States • Account Page   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│  Firebase Cloud Functions • Authentication • Request Validation  │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
    ┌────────┐        ┌──────────┐        ┌────────────┐
    │  Job   │        │Firestore │        │Cloud Task  │
    │ Queue  │        │ Database │        │   Queue    │
    └────┬───┘        └──────────┘        └─────┬──────┘
         │                                      │
         └──────────────────┬───────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │    ASYNC PROCESSING LAYER (Workers)   │
        │  Cloud Functions (triggered by queue) │
        └───────────────────────────────────────┘
                 │          │          │
    ┌────────────┴──────────┼──────────┴──────────┐
    ↓                       ↓                      ↓
┌──────────┐        ┌──────────────┐      ┌────────────────┐
│Extraction│        │Analysis      │      │Report          │
│Pipeline  │        │Engines       │      │Generation      │
│(AI)      │        │(Pattern,     │      │Engine (AI)     │
│          │        │Quote, Type)  │      │+ PDF Output    │
└──────────┘        └──────────────┘      └────────────────┘
    ↓                       ↓                      ↓
┌─────────────────────────────────────────────────────────┐
│         STORAGE & NOTIFICATION LAYER                    │
│  Cloud Storage (Encrypted PDFs) • SendGrid Email        │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Core Components

### 3.1 Frontend (Web Application)
**Technology:** React/Next.js, Firebase SDK, TailwindCSS  
**Responsibilities:**
- File upload with validation feedback
- Data type selection (structured/semi/unstructured)
- User context input (goals, values, focus questions, frameworks)
- Progress tracking (wait here OR leave path)
- Report history + regeneration
- Error state handling

**Key Screens:**
1. Upload screen (data type selector, file input)
2. Processing screen (progress bar OR email confirmation)
3. Completion screen (download, view report)
4. Account screen (past reports, metadata)

### 3.2 API Gateway (Firebase Cloud Functions)
**Responsibilities:**
- HTTP request routing
- Firebase Auth validation
- Request/response schema validation
- Payment processing (Lemon Squeezy)
- Rate limiting per user/tier
- Job creation in queue

**Endpoints (detailed in API spec):**
- `POST /api/reports/create` — Start analysis job
- `GET /api/reports/{jobId}/status` — Check progress
- `GET /api/reports/{reportId}` — Fetch report metadata
- `POST /api/reports/{reportId}/regenerate` — Reanalyze with different questions
- `GET /api/account/reports` — List user's reports

### 3.3 Job Queue System
**Technology:** Google Cloud Tasks + Firestore  
**Responsibilities:**
- Receive new job requests from API Gateway
- Maintain job status for polling
- Trigger workers based on queue
- Handle retries (up to 3x)
- Estimate processing time

**Job Status Progression:**
```
queued → extracting → analyzing → generating → complete/failed
```

### 3.4 Extraction Pipeline
**Technology:** Claude API (ZDR mode) + Custom logic  
**When Used:** Only for unstructured/semi-structured data  
**Responsibilities:**
- Read raw journal text
- Identify life areas (work, relationships, health, etc.)
- Calculate area frequencies
- Detect emotional tones
- Return structured extraction for user confirmation

**Output Schema:**
```json
{
  "lifeAreasFound": ["Work", "Relationships", "Health"],
  "areaFrequencies": {"Work": 0.45, "Relationships": 0.28, "Health": 0.18},
  "emotionalTones": ["anxious", "reflective", "grateful"],
  "confidenceScore": 0.87,
  "summary": "We found 5 main life areas you write about..."
}
```

### 3.5 Analysis Engines (Parallel Execution)
**Technology:** Custom Node.js + Claude API  
**Parallel Engines:**

#### Pattern Detection Engine
- Calculates mood frequency per life area
- Detects cross-area correlations (e.g., work stress → sleep issues)
- Identifies temporal trends (day-of-week effects, escalation)
- Outputs: frequency map, correlations, trends JSON

#### Quote Selection Engine
- Finds representative journal entries for each focus question
- Uses semantic similarity + relevance scoring
- Selects 3-5 quotes per question
- Outputs: Array of {quote, date, mood, area} objects

#### Framework Mapping Engine (MBTI/Enneagram)
- Compares user's stated type vs. behavioral patterns in journal
- Calculates alignment percentage
- Identifies divergences (blind spots or integrated strengths)
- Outputs: {type, alignmentPct, expectedPatterns[], actualPatterns[], divergences[]}

#### Values Alignment Engine
- Cross-references user's stated values against journal behavior
- Flags where data contradicts stated values
- Outputs: {valuesProvided[], contradictions[], alignedAreas[]}

### 3.6 Narrative Generation Engine
**Technology:** Claude API (ZDR mode) + Jinja2 templates  
**Responsibilities:**
- Takes analysis JSON outputs (from engines above)
- Generates 6 report sections (Landscape, Focus Q1, Focus Q2, Blind Spots, Frameworks, Closing)
- Maintains voice consistency: warm, evidence-based, non-prescriptive
- Outputs: Markdown sections → HTML → Compiled for PDF

**Prompt Template Structure:**
```
You are writing a compassionate, insightful analysis report.
Context: [user's goals, values, background]
Data: [analysis JSON from engines]
Section: [section name, e.g., "Your Emotional Landscape"]
Requirements: [evidence-based, 2-3 paragraphs, include quotes]
Do not prescribe. Show, don't tell. Maintain voice: warm but analytical.
```

### 3.7 Report Generation & Storage
**Technology:** Puppeteer (HTML→PDF) + Google Cloud Storage  
**Responsibilities:**
- Compile narrative sections + analysis data into HTML template
- Apply styling (responsive, print-optimized)
- Convert HTML to PDF
- Encrypt PDF + upload to Cloud Storage
- Generate secure download link (30-day expiry)
- Delete original journal file + temp processing files

**Report Retention Policy:**
- PDF stored encrypted for 30 days
- User can request extension or deletion
- Metadata (email, timestamp) kept for billing only

### 3.8 Notification System
**Technology:** SendGrid  
**Responsibilities:**
- Send email when report is ready (if user chose "email me" path)
- Include secure download link
- Include report summary
- Include link to account page
- Track delivery/bounces

---

## 4. Data Flow (End-to-End)

### Happy Path: Structured Renew90 Data
```
1. User uploads Renew90 CSV export (mood_journal data)
   └─ POST /api/reports/create
   
2. API Gateway validates, creates Job in Firestore
   └─ Job status: "queued"
   
3. Cloud Task triggered, Analysis Worker starts
   └─ Skips extraction (data already labeled)
   
4. Pattern Detection Engine runs (in parallel):
   ├─ Calculate mood × area frequencies
   ├─ Detect correlations (work stress ↔ sleep)
   └─ Returns: frequency_map, correlations, trends
   
5. Quote Selection Engine runs (in parallel):
   ├─ Find representative entries for each focus question
   └─ Returns: [{quote, date, mood, area}, ...]
   
6. Framework Mapping Engine runs (in parallel):
   ├─ Compare MBTI type vs. actual patterns
   └─ Returns: {type, alignment%, divergences[]}
   
7. All engines complete → Narrative Generator starts
   └─ Takes all JSON outputs + user context
   └─ Generates 6 report sections (Markdown)
   
8. Report Compiler:
   └─ Markdown → HTML template
   └─ Apply styling + branding
   └─ HTML → PDF (Puppeteer)
   
9. Encrypt PDF + Upload to Cloud Storage
   └─ Generate 30-day secure link
   
10. Delete user's journal file + temp processing data
    └─ Keep only: encrypted PDF, metadata (email, timestamp)
    
11. Send notification (email OR auto-refresh frontend)
    └─ Job status: "complete"
    └─ Frontend polls, receives completion → Download button
    
12. User downloads report or accesses via email link
```

### Alternative Path: Unstructured Day One Journal
```
[Same as above, BUT:]

2.5. Extraction Pipeline triggered (skipped in Renew90 path)
   ├─ Claude reads raw journal text
   ├─ Proposes: life areas, frequencies, tones
   └─ Returns extraction JSON
   
2.6. User confirms extraction (UI: checkboxes to accept/modify)
   ├─ User sees: "We found: Work 45%, Relationships 28%, Health 18%... Is this right?"
   └─ User checks box: ✓ Confirmed
   
[Rest proceeds as Renew90 path above]
```

---

## 5. Database Schema (Firestore)

### Collections Overview
```
/users/{userId}
  - email: string
  - subscription_tier: "free" | "renew90_user" | "premium"
  - created_at: timestamp
  
/jobs/{jobId}
  - userId: string (FK)
  - status: "queued" | "extracting" | "analyzing" | "generating" | "complete" | "failed"
  - progress: 0-100
  - currentPhase: "Extracting themes..."
  - startedAt: timestamp
  - estimatedRemainingSeconds: number
  - reportId: string (populated on completion)
  - errorMessage: null | "string"
  
/reports/{reportId}
  - userId: string (FK)
  - generated_at: timestamp
  - data_type: "structured" | "semi" | "unstructured"
  - journal_count: number
  - date_range: {start: timestamp, end: timestamp}
  - frameworks_selected: ["mbti", "enneagram"]
  - focus_questions: ["string", "string"]
  - pdf_url: string (signed, expires in 30 days)
  - processing_time_seconds: number
  - ai_cost_estimate: number
  - status: "ready" | "downloading" | "archived"
  
/extraction_cache/{dataHash}
  - structure: {areas[], frequencies{}, tones[]}
  - created_at: timestamp
  - ttl: 3600 (seconds)
  
(See DATABASE.md for full schema with indexes and constraints)
```

---

## 6. External Dependencies

| Service | Purpose | Cost Model |
|---------|---------|-----------|
| Firebase Auth | User authentication | Free tier included |
| Firestore | Database | Pay-per-read/write |
| Cloud Storage | PDF encryption + storage | $0.02 per report |
| Cloud Tasks | Job queue | $0.10 per 1M tasks |
| Cloud Functions | Workers (serverless) | $0.40 per 1M invocations |
| Claude API | Extraction + Narrative Gen | ~$0.05-0.09 per report |
| SendGrid | Email notifications | $20/month (free tier: 100 emails/day) |
| Lemon Squeezy | Payment processing (Merchant of Record) | ~5% + $0.50 per transaction (includes global tax/VAT handling) |

---

## 7. Security & Privacy Architecture

### Data Handling
- **No persistence:** Journal text never stored after analysis
- **ZDR mode:** Claude API calls use `anthropic-zero-data-retention: true` header
- **Encrypted storage:** PDFs encrypted before upload to Cloud Storage
- **Signed URLs:** Download links expire after 30 days
- **Access control:** Only report owner can access their report

### Authentication
- Firebase Auth for user sessions
- ID tokens validated on every API request
- Rate limiting per user/tier (5 reports/month free, unlimited for paid)

### Payment Security
- Lemon Squeezy is Merchant of Record — handles all card data (PCI compliant), plus global sales tax/VAT collection and remittance
- Backend never stores card details; payment happens on Lemon Squeezy's hosted checkout, not in our app
- Webhook signature validation (HMAC-SHA256 via `X-Signature` header) required before trusting any `order_created` / `order_refunded` event

---

## 8. Scalability Considerations

**Current capacity:** ~100 concurrent report generations  
**Bottlenecks:**
- Claude API rate limits (~50 requests/min)
- Firestore write capacity (auto-scales)
- PDF generation time (bottleneck: Puppeteer single-threaded)

**Scaling approach:**
- Use job queue to smooth demand (inherent in Cloud Tasks)
- Batch report generation during off-peak hours
- Cache extraction results (same data → skip extraction)
- Monitor Claude API usage, implement backoff if rate-limited

---

## 9. Monitoring & Observability

**Metrics to track:**
- Job completion rate (% of jobs that complete successfully)
- Average processing time per data type
- Claude API token usage + cost per report
- PDF generation latency
- Email delivery rate
- Error rate by type (extraction, analysis, generation)

**Logging:**
- All job state transitions logged to Firestore
- Error logs to Sentry (or similar)
- API request logs to Cloud Logging

---

## 10. Deployment Architecture

**Environments:** dev, staging, production

**Infrastructure as Code:**
- Firebase projects (separate per environment)
- Cloud Functions deployed via CI/CD (GitHub Actions)
- Firestore initialized with schema (migrations as needed)

**Deployment Pipeline:**
```
GitHub Push → CI runs tests → Deploy to staging 
  → Manual approval → Deploy to production
```

---

## 11. Future Scaling (Post-MVP)

- **Batch processing:** Generate reports for multiple users in parallel
- **Caching layer:** Redis for frequently accessed extraction results
- **Multi-region:** Replicate Firestore across regions for low latency
- **Custom NLP models:** Replace Claude calls with fine-tuned models for cost/speed
- **B2B integration:** Coaches, therapists, corporate wellness platforms

---

## 12. Related Documents

- **API_SPEC.md** — Complete API endpoint specifications
- **DATABASE.md** — Firestore schema, indexes, constraints
- **COMPONENT_SPECS.md** — Detailed algorithm specs for each analysis engine
- **PHASE_SPECS.md** — Phase-by-phase development breakdown

---

**Questions for the team:**
- How to handle very large journals (1000+ entries)? (Answer: Implement pagination in extraction)
- What's the SLA for report completion? (Answer: 15-20 min for unstructured, 5-10 min for structured)
- How many concurrent users day 1? (Answer: Assume <50, scale as needed)
