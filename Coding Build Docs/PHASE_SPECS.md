# Pattern Mirror: Phase-by-Phase Build Specifications

**Total Duration:** 15 weeks  
**Start Date:** ~July 2025  
**Target Launch:** October 2025

---

## Timeline Summary

```
Week 1-2:   Phase 0    — Setup & Documentation
Week 3-6:   Phase 1    — Core Pipeline (3 subphases)
Week 7-10:  Phase 2    — Analysis Engines (3 subphases)
Week 11-15: Phase 3    — Frontend, Report Gen, Polish (4 subphases)
```

---

# PHASE 0: Foundation & Documentation (2 weeks)

**Goal:** Infrastructure ready, all critical documentation written, team prepared.

## 0.1: Dev Environment & Infrastructure (Week 1)

**Deliverables:**
- [ ] Firebase projects created (dev, staging, prod)
- [ ] GitHub repo set up with CI/CD skeleton
- [ ] Node.js/npm project initialized
- [ ] Local development environment documented

**Tasks:**
1. Create Firebase projects in console
2. Initialize Cloud Firestore (dev mode)
3. Setup Firebase Authentication
4. Create GitHub repo, add `.gitignore`, `README.md`
5. Initialize `package.json` with core dependencies:
   - `express` (if using Express for local dev)
   - `firebase-admin` (server SDK)
   - `firebase` (client SDK)
   - `jest` (testing)
   - `dotenv` (env variables)
6. Create `.env.example` with required vars
7. Document: "How to set up local dev" in `DEVELOPMENT.md`

**Acceptance Criteria:**
- Team members can clone repo and run locally
- Firebase projects accessible to all devs
- CI/CD pipeline template ready (not functional yet)

---

## 0.2: Database & Firestore Setup (Week 1)

**Deliverables:**
- [ ] Firestore schema initialized (empty collections, no data)
- [ ] Security rules deployed
- [ ] Indexes created
- [ ] TTL policies configured

**Tasks:**
1. Use Firebase Console to create collections:
   - `/users`
   - `/jobs`
   - `/reports`
   - `/extraction_cache`
   - `/payment_intents`
   - `/audit_logs`
2. Deploy Firestore security rules (from `DATABASE.md`)
3. Create composite indexes (use `firestore.indexes.json`)
4. Configure TTL policies:
   - `jobs`: 90-day deletion
   - `reports`: 30-day PDF deletion
   - `extraction_cache`: 7-day deletion
5. Create a `seed_firestore.js` script for test data (optional, nice-to-have)

**Acceptance Criteria:**
- All collections exist, security rules are active
- Indexes created and active
- TTL policies configured

---

## 0.3: Authentication & Basic API (Week 1-2)

**Deliverables:**
- [ ] Firebase Auth integrated in frontend starter
- [ ] Login/logout endpoints working
- [ ] Firebase ID token validation on backend
- [ ] Rate limiting middleware skeleton

**Tasks:**
1. Create frontend login page (HTML form or React component)
2. Create backend API endpoint: `POST /auth/login`
3. Create backend API endpoint: `POST /auth/logout`
4. Implement Firebase token validation middleware
5. Test: Login → get token → use in authenticated request → logout

**Code Structure:**
```
/frontend
  /src
    /pages
      login.tsx

/backend
  /functions
    auth.ts
      - loginUser()
      - logoutUser()
      - validateToken() middleware
  /middleware
    auth.ts
      - verifyFirebaseToken()
```

**Acceptance Criteria:**
- User can sign up, login, receive ID token
- Token validated on each authenticated request
- Logout clears session

---

## 0.4: Critical Documentation (Week 1-2)

**Deliverables:**
- [ ] ARCHITECTURE.md (done, review for accuracy)
- [ ] API_SPEC.md (done, complete)
- [ ] DATABASE.md (done, reviewed)
- [ ] COMPONENT_SPECS.md (extracted, patterns, quote selection, frameworks)
- [ ] PHASE_SPECS.md (this document)
- [ ] DEVELOPMENT.md (local setup guide)
- [ ] DEPLOYMENT.md (how to deploy to staging/prod)

**Tasks:**
1. Review ARCHITECTURE.md for accuracy, update diagrams if needed
2. Complete COMPONENT_SPECS.md (see below for content)
3. Write DEVELOPMENT.md: local setup, running tests, debugging
4. Write DEPLOYMENT.md: GitHub Actions, Firebase deploy, rollback
5. Create TESTING_STRATEGY.md: unit/integration/e2e approach, coverage targets
6. Share all docs with team, get feedback

**Component Specs to Write:**
- Pattern Detection Engine spec (algorithm, inputs, outputs)
- Quote Selection Engine spec
- MBTI Framework Mapping spec
- Enneagram Framework Mapping spec
- Values Alignment spec
- Narrative Generation spec (prompt templates)

**Acceptance Criteria:**
- All team members understand architecture
- Developers can reference specs while coding
- No ambiguity in design decisions

---

## 0.5: Cloud Functions & Job Queue Setup (Week 2)

**Deliverables:**
- [ ] Cloud Functions runtime set up
- [ ] Cloud Tasks queue created
- [ ] Basic worker function skeleton
- [ ] Job status polling working

**Tasks:**
1. Create Cloud Functions project structure (under the existing `backend/functions/src/` from Phase 0.3, not a separate `/functions` root):
   ```
   backend/functions/src/
     triggers/
       onJobQueued.ts (worker)
     services/
       jobService.ts
     models/
       Job.ts
   ```
2. No manual Cloud Tasks queue creation needed — `firebase-functions` v2 task-queue functions (`onTaskDispatched`) provision their own backing Cloud Tasks queue automatically on `firebase deploy --only functions`, scoped to the function name. There is no queue named `pattern-mirror-jobs` to create by hand.
3. Implement basic job creation (`jobService.createJob`) + enqueueing (`admin.functions().taskQueue(functionName).enqueue(data)`, from `firebase-admin/functions` — not a raw `@google-cloud/tasks` client)
4. Implement worker that acknowledges jobs (logs "processing")
5. Test: Create job → Check status → Job progresses

**Code Example (corrected to the real `firebase-functions` v2 API — the original example below used `functions.cloudTasks.onDispatch`, which does not exist in the installed package):**
```typescript
// backend/functions/src/triggers/onJobQueued.ts
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { processJob } from '../services/jobService';

export const processReportJob = onTaskDispatched<{ jobId: string }>(async (req) => {
  const { jobId } = req.data;
  console.log(`Processing job ${jobId}`);

  await processJob(jobId);
});
```
```typescript
// Enqueueing, e.g. from jobService.enqueueJob()
import { getFunctions } from 'firebase-admin/functions';

await getFunctions().taskQueue<{ jobId: string }>('processReportJob').enqueue({ jobId });
```

**Acceptance Criteria:**
- Cloud Tasks queue functional
- Worker acknowledges jobs
- Job status can be polled via API

---

## Phase 0 Completion Checklist

- [ ] Firebase projects (dev/staging/prod) live
- [ ] GitHub repo with CI/CD skeleton
- [ ] Firestore schema initialized, security rules deployed
- [ ] Auth working (login/logout)
- [ ] Cloud Functions & Cloud Tasks set up
- [ ] All critical docs written and reviewed
- [ ] Team trained on architecture and flow

**By end of Phase 0:**
- 2 developers can work on Phase 1 in parallel
- Infrastructure doesn't block development
- Team is aligned on design

---

---

# PHASE 1: Core Pipeline (Weeks 3-6, 4 weeks)

**Goal:** File upload works → Extraction works → Data in queue → Status polling works

## 1.1: File Upload & Validation (Weeks 3-4)

**Dependencies:** Phase 0 complete

**Deliverables:**
- [ ] File upload endpoint working
- [ ] Data type detection (structured/semi/unstructured)
- [ ] File validation (format, size, encoding)
- [ ] Temp file storage in Cloud Storage
- [ ] Upload progress tracking

**Tasks:**

**Design correction (discovered during implementation):** the upload cannot
go through `POST /api/reports/create`'s own request body as originally
spec'd below — Cloud Functions gen2 hard-caps uncompressed HTTP request
bodies at 32MB (non-configurable), and base64-encoding a 50MB file requires
~66.7MB. The actual flow is two calls: `POST /api/reports/upload-url`
(client gets a signed Cloud Storage URL, uploads the file directly — bytes
never touch our API) then `POST /api/reports/create` referencing that
upload by `uploadId` instead of embedding `journalFile`. Full request/
response shapes: API_SPEC.md 4.3.

### Backend API Endpoint: POST /api/reports/upload-url
1. Validate `fileName`'s extension is supported (CSV, JSON, TXT, Markdown)
2. Generate `uploadId`, build `storagePath = temp/{uploadId}/journal.{ext}`
3. Create a V4 signed URL for a `PUT` to that path, ~15 min expiry
4. Write `/uploads/{uploadId}` tracking the owning `userId` — Create Report
   Job below checks this, so an attacker can't consume another user's
   upload even if they somehow guessed the (otherwise unguessable) UUID
5. Return `{uploadId, uploadUrl, storagePath}`

### Backend API Endpoint: POST /api/reports/create
1. Implement request validation:
   - `dataType` is valid enum
   - `uploadId` is present and references an upload owned by this user
   - `focusQuestions` has exactly 2 items
   - `frameworks` is array of 0-2 items

2. Resolve the upload:
   - Look up `/uploads/{uploadId}`; 404 if missing or owned by a different user
   - Confirm the object actually exists at `storagePath` in Cloud Storage (the
     client may not have finished/started the direct PUT yet) and is ≤ 50MB
     — this is the real enforcement point for the size limit now, not a
     request-body check, since Storage has no such ceiling
   - Download it to compute `journalCount`/hash — safe to do server-side at
     any size; it's an internal Storage read, not an inbound HTTP request

3. Implement Lemon Squeezy payment check:
   - If user is `free` tier and not Renew90: require a paid checkout ($49-59) before this job starts
   - Check Firestore for an existing `/checkouts/{checkoutId}` with `status: "paid"` for this upload
   - If none exists: return 402 with a `checkoutUrl` (see API_SPEC.md 4.5) — do NOT block this request waiting on payment, since Lemon Squeezy confirms asynchronously via webhook
   - If a paid checkout exists: proceed

4. Create Job record:
   ```javascript
   const job = {
     jobId: uuid(),
     userId,
     status: 'queued',
     progress: 0,
     dataType,
     journalCount: calculateLineCount(file),
     journalStoragePath: storagePath,
     focusQuestions,
     frameworks,
     createdAt: now,
     chargeAmount: calculatePrice(dataType)
   };
   await db.collection('jobs').doc(job.jobId).set(job);
   ```

5. Return 202 response:
   ```json
   {
     "jobId": "job_12345",
     "reportId": "report_67890",
     "status": "queued",
     "estimatedCompletionSeconds": 480
   }
   ```

**Code Structure:**
```
/backend
  /functions
    api/
      reports.ts
        - POST /api/reports/upload-url
        - POST /api/reports/create
  /services
    uploadService.ts
      - createUploadUrl()
      - getUploadedFile()
      - detectDataType()
      - hashContent()
      - calculateLineCount()
    paymentService.ts
      - checkPaymentRequired()
      - createLemonSqueezyCheckout()
      - handleLemonSqueezyWebhook()
    jobService.ts
      - createJob()
```

**Tests:**
1. Request upload URL for a valid CSV filename → 200, signed URL returned
2. Request upload URL for an unsupported extension → 400
3. Create report with a completed, owned upload → 202 OK, jobId returned
4. Create report with someone else's `uploadId` → 400 "Upload not found" (not a leak of "wrong owner", just "not found" — see API_SPEC.md 4.3)
5. Create report with an `uploadId` that was never actually uploaded to → 400
6. Create report with invalid data type → 400 validation error
7. Create report with 1 focus question → 400 validation error
8. Payment declined → 402 error
9. Successful upload for Renew90 user → 202 OK, no charge
10. Check job status → status is "queued"

**Acceptance Criteria:**
- Upload URL + create-report endpoints functional
- Validation catches all error cases
- Jobs created in Firestore
- File stored in Cloud Storage (via direct client upload, not proxied through the API)
- Payment required for non-Renew90 users
- A 50MB file genuinely works end-to-end (not silently capped by Cloud Functions' request-size limit)

---

## 1.2: Data Extraction Pipeline (Weeks 4-5)

**Dependencies:** Phase 1.1 complete

**Deliverables:**
- [ ] Extraction engine callable from worker
- [ ] Claude API integration (ZDR mode)
- [ ] User confirmation UI/API
- [ ] Extraction caching (7-day TTL)

**Tasks:**

### Backend Extraction Worker
1. When job status changes to "queued" → Trigger extraction (or skip if structured)

2. For unstructured/semi-structured:
   - Read journal file from Cloud Storage
   - Send to Claude API with extraction prompt:
     ```
     You are analyzing journal entries. Extract:
     1. Life areas (Work, Relationships, Health, etc.)
     2. Frequency of each area (%)
     3. Emotional tones/moods
     4. Overall summary
     
     Return JSON only (no preamble).
     
     Journal content:
     [user's journal text]
     ```
   - Parse Claude's JSON response
   - Save extraction result to Firestore: `/extraction_cache/{dataHash}`
   - Update job status to "extracting_complete"

3. For structured data:
   - Skip extraction entirely
   - Parse CSV/JSON directly (validate columns exist)
   - Create minimal extraction JSON
   - Update job status to "analyzing"

4. Error handling:
   - If Claude fails: retry 2x with exponential backoff
   - If parsing fails: return user-friendly error, make recoverable
   - Log all errors to Firestore job record

**Code:**
```typescript
// extractionService.ts
export async function extractJournalData(
  jobId: string,
  journalFile: Buffer,
  dataType: 'structured' | 'semi' | 'unstructured'
): Promise<ExtractionResult> {
  
  if (dataType === 'structured') {
    // Parse CSV directly
    return parseStructuredJournal(journalFile);
  }
  
  // For unstructured: call Claude
  const extraction = await callClaudeWithZDR(journalFile, EXTRACTION_PROMPT);
  
  // Cache for 7 days
  const hash = sha256(journalFile);
  await cacheExtractionResult(hash, extraction);
  
  return extraction;
}
```

### Frontend: Extraction Confirmation UI
1. After upload completes, show user:
   ```
   "We found:
   - Work: 45%
   - Relationships: 28%
   - Health: 18%
   - Other: 9%
   
   Is this right? [Yes] [No - Let me adjust]"
   ```

2. If user clicks "No":
   - Show form with editable sliders per area
   - User adjusts frequencies
   - Submit corrected extraction
   - Backend receives corrected data via `POST /api/reports/{jobId}/confirm-extraction`

3. If user clicks "Yes":
   - Send confirmation: `POST /api/reports/{jobId}/confirm-extraction`
   - Backend marks job as "analyzing"
   - Proceed to analysis phase

**API Endpoint: POST /api/reports/{jobId}/confirm-extraction**
```json
{
  "confirmed": true,
  "lifeAreas": ["Work", "Relationships", "Health"],
  "adjustedFrequencies": {
    "Work": 0.45,
    "Relationships": 0.28,
    "Health": 0.27
  }
}
```

**Tests:**
1. Extract unstructured journal → JSON returned
2. Extraction cached → Subsequent request uses cache
3. Cache expires after 7 days → New extraction created
4. Structured data skips extraction → Direct to analysis
5. Claude API timeout → Retry + error handling
6. User confirms extraction → Job proceeds to analysis
7. User adjusts extraction → Adjusted data used in analysis

**Acceptance Criteria:**
- Extraction works for unstructured data
- Caching saves Claude API calls
- User can confirm/adjust extraction
- Job state progresses to analysis phase

---

## 1.3: Job Queue & Status Tracking (Weeks 5-6)

**Dependencies:** Phase 1.1 & 1.2 complete (can parallelize)

**Deliverables:**
- [ ] Cloud Tasks queue fully functional
- [ ] Job status polling via API
- [ ] Async processing from upload → completion
- [ ] Error recovery & retry logic

**Tasks:**

### Job Queue Management
1. On file upload completion (`POST /api/reports/create`):
   - Create Job in Firestore
   - Queue task in Cloud Tasks with jobId
   - Return jobId + statusCheckUrl to frontend

2. Cloud Task triggers worker function:
   - Retrieve job from Firestore
   - Begin extraction (if needed)
   - Update job.status to "extracting"
   - Update job.progress

3. After extraction completes:
   - Update job.status to "analyzing"
   - Queue next task (analysis workers)

4. Progress tracking:
   - Job record continuously updated with `progress` (0-100)
   - Each phase updates: `status`, `progress`, `currentPhase`, `estimatedRemainingSeconds`

**Example Job Status Progression:**
```
0%   → queued
10%  → extracting (if unstructured)
30%  → analyzing (patterns, quotes, frameworks)
60%  → generating (narrative sections)
90%  → finalizing (PDF generation)
100% → complete
```

### Backend: GET /api/reports/{jobId}/status
1. Retrieve job from Firestore
2. Calculate `estimatedRemainingSeconds` based on phase
3. Return JSON with current state

**Tests:**
1. Create job → Poll status → Status is "queued"
2. Wait for processing → Status updates to "extracting" → "analyzing" → "generating" → "complete"
3. Job fails → Status is "failed" with error message
4. Retry failed job → New task queued
5. Multiple concurrent jobs → Status tracked independently

**Acceptance Criteria:**
- Jobs queued and processed in order
- Status polling works (API response < 50ms)
- Job states progress correctly
- Errors are logged and recoverable

---

## Phase 1 Completion Checklist

- [ ] Upload endpoint functional, files stored
- [ ] Data type detection working
- [ ] Extraction pipeline working (Claude API integrated)
- [ ] User confirmation flow implemented
- [ ] Job queue operational
- [ ] Status polling working
- [ ] Integration tests passing (upload → extract → queue → status check)
- [ ] Error handling implemented (payment, validation, file errors)

**By end of Phase 1:**
- Data flows from user upload → Firestore → Cloud Storage
- Extraction results cached
- Jobs queued and tracked
- Ready for analysis engines (Phase 2)

---

---

# PHASE 2: Analysis Engines (Weeks 7-10, 4 weeks)

**Goal:** Implement all analysis engines (pattern, quote, framework), integrate them in parallel, test thoroughly.

## 2.1: Pattern Detection Engine (Weeks 7-8)

**Dependencies:** Phase 1 complete

**Deliverables:**
- [ ] Pattern detection algorithm implemented
- [ ] Unit tests (>80% coverage)
- [ ] Integration tested with sample data

**Spec:**
See `COMPONENT_SPECS.md` — Pattern Detection Engine detailed spec.

**High-Level Algorithm:**
1. Parse structured data (life_area, mood, intensity, date)
2. Calculate frequency of each life area
3. Detect cross-area correlations (e.g., high work stress → low sleep mood)
4. Identify temporal trends (day-of-week effects, escalation)
5. Return JSON: frequencies, correlations, trends

**Code Structure:**
```
/backend
  /services
    analysisEngines/
      patternDetection.ts
        - calculateFrequencies()
        - detectCorrelations()
        - identifyTrends()
        - analyzeBlindsSpots()
      __tests__
        patternDetection.test.ts
```

**Input Example:**
```json
{
  "entries": [
    {
      "date": "2025-03-15",
      "mood": "anxious",
      "intensity": 2,
      "lifeArea": "Work",
      "text": "..."
    },
    {
      "date": "2025-03-15",
      "mood": "tired",
      "intensity": 3,
      "lifeArea": "Health",
      "text": "..."
    }
  ]
}
```

**Output Example:**
```json
{
  "frequencies": {
    "Work": 0.45,
    "Relationships": 0.28,
    "Health": 0.18
  },
  "correlations": [
    {
      "area1": "Work",
      "area2": "Health",
      "correlation": 0.72,
      "interpretation": "High work stress correlates with low energy"
    }
  ],
  "temporalTrends": [
    {
      "dayOfWeek": "Monday",
      "avgIntensity": 2.4,
      "moodFrequency": {"anxious": 0.6}
    }
  ]
}
```

**Tests:**
1. Calculate frequencies → Returns correct % for each area
2. Correlations detected → High stress days → Low sleep days
3. Temporal trends → Mondays have higher anxiety
4. Edge case: Single entry → Returns valid output
5. Edge case: All same mood → Handles gracefully

**Acceptance Criteria:**
- Algorithm accurately detects patterns
- Output matches expected schema
- Tests passing, >80% coverage
- Handles edge cases

---

## 2.2: Quote Selection & Framework Engines (Weeks 8-9)

**Dependencies:** Phase 1 complete

**Deliverables:**
- [ ] Quote selection engine
- [ ] MBTI framework mapping
- [ ] Enneagram framework mapping
- [ ] Values alignment analysis
- [ ] Unit tests for each

**Quote Selection Engine:**
1. Input: Journal entries + focus question
2. Use semantic similarity to find relevant entries
3. Score by: relevance (to question) + authenticity + clarity
4. Return top 3-5 quotes

**Code:**
```typescript
// quoteSelectionService.ts
export async function selectQuotes(
  entries: JournalEntry[],
  focusQuestion: string,
  topN: number = 5
): Promise<SelectedQuote[]> {
  
  // Embed question + entries using semantic model
  const questionEmbedding = await embed(focusQuestion);
  const entryEmbeddings = await Promise.all(entries.map(e => embed(e.text)));
  
  // Calculate similarity scores
  const scores = entryEmbeddings.map((emb, i) => ({
    entry: entries[i],
    relevance: cosineSimilarity(questionEmbedding, emb),
    authenticity: scoreAuthenticity(entries[i].text),
    clarity: scoreClarity(entries[i].text),
    overallScore: 0.5 * relevance + 0.3 * authenticity + 0.2 * clarity
  }));
  
  // Return top N
  return scores.sort((a, b) => b.overallScore - a.overallScore).slice(0, topN);
}
```

**Framework Mapping (MBTI Example):**
1. Input: User's stated type (INTJ) + journal patterns
2. Compare against expected patterns for INTJ
   - INTJ expected: Strategic thinking, future-focused, logical decision-making
3. Calculate alignment % (how often observed vs. expected)
4. Identify divergences (blind spots or strengths)

**Code:**
```typescript
// mbtiFramework.ts
export async function analyzeMBTI(
  userType: string,  // e.g., "INTJ"
  patterns: PatternData
): Promise<FrameworkAnalysis> {
  
  const expectedPatterns = MBTI_PROFILES[userType];
  
  const alignment = comparePatterns(expectedPatterns, patterns);
  
  return {
    type: userType,
    alignmentPercentage: alignment.percentage,
    expectedPatterns: expectedPatterns,
    observedPatterns: patterns,
    divergences: alignment.gaps,
    insights: generateInsights(alignment)
  };
}
```

**Tests:**
1. Quote selection → Returns most relevant quotes first
2. MBTI analysis → INTJs show strategic patterns
3. Enneagram analysis → Type 5s show integration/disintegration patterns
4. Values alignment → Contradictions detected
5. Framework skipped if user didn't provide type → No error

**Acceptance Criteria:**
- Quote selection algorithm works
- Framework mappings accurate
- Tests passing, >80% coverage

---

## 2.3: Analysis Integration & Testing (Weeks 9-10)

**Dependencies:** Phases 2.1 & 2.2 complete

**Deliverables:**
- [ ] All engines run in parallel
- [ ] Results combined into analysis JSON
- [ ] Integration tests (end-to-end)
- [ ] Performance acceptable (<10 min for unstructured)

**Tasks:**

### Analysis Worker (Cloud Function)
1. Retrieve extracted data + user context
2. Run all engines in parallel:
   ```typescript
   const [patterns, quotes, mbti, enneagram, values] = await Promise.all([
     patternDetectionEngine(data),
     quoteSelectionEngine(data, focusQuestions),
     mbtiEngine(data, userMbtiType),
     enneagramEngine(data, userEnneagramType),
     valuesAlignmentEngine(data, userValues)
   ]);
   ```
3. Combine results into single analysis JSON
4. Save to Firestore (temporary, will be used for narrative generation)
5. Update job status: "analyzing" → "generating"

### Integration Testing
1. Full flow: Upload → Extract → Analyze (all engines)
2. Performance: Unstructured journal (100+ entries) → Analysis < 10 min
3. Error recovery: One engine fails → Others continue, report partial results
4. Parallel execution: Multiple jobs → No interference

**Tests:**
1. Upload structured data → Run analysis → Get results in <5 min
2. Upload unstructured data (150 entries) → Analysis < 15 min
3. User without MBTI type → Skip MBTI, continue with others
4. Large journal (300+ entries) → Still completes
5. One engine times out → Graceful degradation (report without that lens)

**Acceptance Criteria:**
- All engines run in parallel
- Performance within SLA (<20 min for unstructured)
- Integration tests passing
- Ready for narrative generation (Phase 3)

---

## Phase 2 Completion Checklist

- [ ] Pattern detection engine working, tested
- [ ] Quote selection engine working, tested
- [ ] MBTI framework mapping working, tested
- [ ] Enneagram framework mapping working, tested
- [ ] Values alignment analysis working, tested
- [ ] All engines run in parallel
- [ ] Integration tests passing
- [ ] Performance acceptable
- [ ] Error handling for each engine

**By end of Phase 2:**
- Data flows: Upload → Extract → Analyze
- All analysis engines produce JSON
- Ready for narrative generation
- Foundation for Phase 3 (frontend + PDF)

---

---

# PHASE 3: Report Generation & Frontend (Weeks 11-15, 5 weeks)

**Goal:** Generate narratives, create PDFs, build frontend UI, polish and test.

## 3.1: Narrative Generation Engine (Weeks 11-12)

**Dependencies:** Phase 2 complete

**Deliverables:**
- [ ] Narrative generation for all 6 report sections
- [ ] Claude API prompting (ZDR mode)
- [ ] Section templates defined
- [ ] Quality reviewed

**6 Report Sections:**

1. **Your Emotional Landscape** (2-3 paragraphs)
   - Summary of top life areas + moods
   - Visual metaphor or insight
   - Include life area network visualization description

2. **Focus Question #1** (2-3 pages)
   - The Pattern: Narrative summary
   - The Evidence: 3-5 actual quotes
   - The Interconnections: How pattern affects other areas
   - Reflective Questions: 3-5 open-ended questions

3. **Focus Question #2** (2-3 pages)
   - Same structure as Focus Question #1

4. **Your Blind Spots** (1-2 pages)
   - Analysis of flip journal patterns
   - Areas avoided vs. obsessed over
   - Potential meaning

5. **Framework Lenses** (1-2 pages per framework)
   - MBTI: Type prediction → Actual patterns → Alignment
   - Enneagram: Type prediction → Actual patterns → Alignment
   - (Only if user selected)

6. **Closing** (1 paragraph)
   - Warm closing, honor their journaling practice
   - No summary, no prescription
   - Invitation for reflection

**Code Structure:**
```
/backend
  /services
    narrativeGeneration/
      narrativeService.ts
        - generateLandscapeSection()
        - generateFocusQuestionSection()
        - generateBlindSpotsSection()
        - generateFrameworkSection()
        - generateClosing()
      prompts/
        landscape.ts
        focusQuestion.ts
        blindSpots.ts
        frameworks/
          mbti.ts
          enneagram.ts
        closing.ts
      __tests__
        narrativeGeneration.test.ts
```

**Example Prompt (MBTI Lens):**
```
You are writing a report section analyzing personality framework alignment.
The user is: INTJ
Their actual journal patterns show: Strategic thinking (85%), future-focused (72%), logical (88%), people-aware (42%)

Write a 300-word section titled "Your MBTI Type (INTJ)"
Structure:
1. "Type prediction": What we'd expect from an INTJ
2. "What we observed": The actual patterns from their journal
3. "Where you align": Where observed matches expected
4. "Where you diverge": Blind spots or integrated strengths

Voice: Warm, analytical, non-judgmental. No prescriptions, only observations.

Return only the section text. No markdown, no formatting codes.
```

**Tests:**
1. Generate landscape section → Readable, 2-3 paragraphs, includes quotes
2. Generate focus question section → Includes actual journal quotes, reflective questions
3. MBTI section → Mentions type, expected patterns, observed patterns, divergences
4. All sections combined → Coherent report voice
5. Framework skipped if user didn't select → Section not in output
6. Blind spot analysis → Detects flip journal patterns

**Acceptance Criteria:**
- All sections generated
- Quotes are actual user journal entries
- Voice is consistent: warm, evidence-based, non-prescriptive
- No prescriptions or directives
- Ready for PDF compilation

---

## 3.2: Report Compilation & PDF Generation (Weeks 12-13)

**Dependencies:** Phase 3.1 complete

**Deliverables:**
- [ ] HTML template for report
- [ ] CSS styling (print-optimized)
- [ ] PDF generation (Puppeteer)
- [ ] PDF encryption + Cloud Storage upload
- [ ] Download link generation

**Tasks:**

### HTML Report Template
```html
<!-- report.html -->
<html>
  <head>
    <title>Pattern Mirror Report</title>
    <style>
      /* Print-optimized CSS */
      body {
        font-family: 'Segoe UI', sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
      }
      .section { page-break-inside: avoid; margin-bottom: 40px; }
      .section-title { font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #E8956B; }
      .quote { border-left: 4px solid #E8956B; padding-left: 16px; margin: 20px 0; font-style: italic; }
      @media print { body { padding: 20px; } }
    </style>
  </head>
  <body>
    <div class="cover-page">
      <h1>Pattern Mirror Report</h1>
      <p>Your emotional landscape, revealed.</p>
      <p>Report generated: {{ date }}</p>
    </div>
    
    {{ foreach section in report.sections }}
      <div class="section">
        <h2 class="section-title">{{ section.title }}</h2>
        <div class="section-content">
          {{ section.content }}
        </div>
      </div>
    {{ end }}
    
    <div class="appendix">
      <h2>Appendix</h2>
      <p>Analysis metadata: {{ metadata }}</p>
    </div>
  </body>
</html>
```

### PDF Generation (Puppeteer)
```typescript
// pdfService.ts
import puppeteer from 'puppeteer';

export async function generatePDF(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.setContent(htmlContent);
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
    printBackground: true
  });
  
  await browser.close();
  
  return pdf;
}
```

### Storage & Encryption
```typescript
// reportStorageService.ts
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';

export async function encryptAndStorePDF(
  pdf: Buffer,
  reportId: string
): Promise<{ storagePath: string; downloadUrl: string }> {
  
  // Encrypt PDF with AES-256
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  const encrypted = Buffer.concat([
    cipher.update(pdf),
    cipher.final()
  ]);
  
  // Upload to Cloud Storage
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(`reports/${reportId}.pdf`);
  
  await file.save(encrypted);
  
  // Generate signed URL (30-day expiry)
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 30 * 24 * 60 * 60 * 1000
  });
  
  return {
    storagePath: `gs://bucket/reports/${reportId}.pdf`,
    downloadUrl: signedUrl
  };
}
```

**Tests:**
1. Generate PDF from HTML → Valid PDF file created
2. PDF encrypted → File unreadable without key
3. Signed URL generated → URL valid for 30 days
4. Multiple reports → Each has unique URL
5. PDF content correct → All narrative sections included

**Acceptance Criteria:**
- PDF generation working
- PDFs encrypted + stored securely
- Download links generated
- PDF styling professional and readable

---

## 3.3: Frontend Implementation (Weeks 12-14, parallelize with 3.1 & 3.2)

**Dependencies:** API spec complete, Phase 1 complete

**Deliverables:**
- [ ] Upload screen
- [ ] Data type selector
- [ ] Processing screen (wait vs. email paths)
- [ ] Completion screen
- [ ] Account / report history page
- [ ] Error states
- [ ] Responsive design

**UI/UX Guidance:**
- **Inspiration:** testgorilla.com/test-library/ style
- **Accent color:** Warm sunset (peachy-coral, ~#E8956B)
- **Aesthetic:** Clean, minimal, elegant, NOT overdone
- **No animations:** Keep it static, professional
- **Typography:** Clear hierarchy, plenty of whitespace
- **Backgrounds:** Soft cream/off-white, not dark
- **Overall:** Approachable but sophisticated

**Screens to Build:**

### 1. Upload Screen
```
[Logo] Pattern Mirror

Upload your journals
Select data type: [Structured ▼] [Semi-structured ▼] [Unstructured ▼]
(Help: "Structured = pre-labeled data from Renew90")

[Drag file here or click to upload]
Supported: CSV, JSON, TXT, Markdown
Max size: 50MB

Focus questions (choose 2):
[Dropdown 1] "What habit is costing me peace?"
[Dropdown 2] "Where do I abandon my values?"

Frameworks (optional):
☑ MBTI (Do you know your type?)
  [Input: INTJ]
  (or) [Take 16personalities.com test]
☐ Enneagram
[Continue] button
```

### 2. Processing Screen
```
Your report is being analyzed...

[Progress bar: 40% complete]
Current phase: Analyzing emotional patterns...
Estimated time: 8 minutes

Two options:
[⏱ Wait here] - Get instant download when done
[📧 Email me] - We'll send you a link (leave whenever)

(If user clicks "Email me")
Great! We'll email {user@email.com} when your report is ready.
Estimated time: 12 minutes.
[Back to home]
```

### 3. Completion Screen (After Wait)
```
✓ Your report is ready!

[Download PDF] [View in Browser]

Summary:
- Analyzed 45 journal entries
- 3-month period
- Processing time: 8 minutes
- Frameworks: MBTI, Enneagram

Past reports:
[Report 1] June 14, 2025 • Download
[Report 2] June 7, 2025 • Download
```

### 4. Account / Reports Page
```
Your Reports

[New Report] button

Active Reports:
- Pattern Mirror: June 14, 2025 ✓ Ready [Download] [Regenerate]
- Pattern Mirror: June 7, 2025 ✓ Ready [Download] [Regenerate]

(Past reports have "Regenerate with different questions for $9.99")
```

**React Component Structure:**
```
/frontend
  /src
    /pages
      uploadPage.tsx
      processingPage.tsx
      completionPage.tsx
      accountPage.tsx
    /components
      FileUpload.tsx
      DataTypeSelector.tsx
      ProgressBar.tsx
      FocusQuestionSelector.tsx
      FrameworkSelector.tsx
      ReportCard.tsx
    /services
      reportService.ts (API calls)
      authService.ts (Firebase)
    /styles
      global.css
      components.css
```

**Tests:**
1. File upload → Validation feedback
2. Data type selector → Correct type selected
3. Focus question selector → Exactly 2 selected
4. Framework selector → Optional, can skip
5. Wait path → Progress bar updates every 3 seconds
6. Email path → Confirmation shown, redirect to home
7. Completion → Download button works
8. Account page → Past reports listed, regenerate available
9. Error state → User-friendly error message, retry option

**Acceptance Criteria:**
- All UI screens functional
- API calls work (upload, status check, etc.)
- Responsive design (mobile, tablet, desktop)
- No broken links
- Ready for user testing

---

## 3.4: Email Notifications & Polish (Weeks 14-15)

**Dependencies:** Phases 3.1-3.3 complete

**Deliverables:**
- [ ] Email notification system (SendGrid)
- [ ] Error handling & recovery
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Launch readiness

**Tasks:**

### Email Notification
```
Subject: Your Pattern Mirror report is ready!

Hi {{ firstName }},

Your emotional pattern analysis is ready to download.

[Download Your Report] <- Button with signed URL

Report Summary:
- Analyzed: 45 journal entries
- Time period: March 1 - May 31, 2025
- Frameworks: MBTI (INTJ), Enneagram (Type 5)
- Processing time: 8 minutes

View in your account: [link to account page]

Questions? Reply to this email or visit [support].

Warmly,
Pattern Mirror Team
```

### Error Handling
1. If report generation fails:
   - Email: "Your report failed to generate. Here's why... [recoverable/not]"
   - Offer: Retry for free (if recoverable) OR refund

2. If PDF generation fails:
   - Graceful degradation: Return analysis JSON instead
   - User can view report in browser (HTML version)

3. If email delivery fails:
   - Retry 3x with exponential backoff
   - Log to Sentry

### End-to-End Testing Checklist
- [ ] Upload structured data → Report generates → Email sent
- [ ] Upload unstructured data → Extraction → Report → Email
- [ ] User clicks "Wait" → Progress updates → Download works
- [ ] User clicks "Email" → Gets email → Click link → Download works
- [ ] Framework skipped → Report still complete
- [ ] Large journal (300+ entries) → Still completes, SLA met
- [ ] Payment fails → User notified, can retry
- [ ] Report regeneration → Different questions → New PDF generated
- [ ] Error recovery → User can retry failed job

### Performance Optimization
1. Caching:
   - Extraction cache: 7 days
   - Report metadata: Firestore
   - Static assets: CDN

2. Database indexes:
   - All query patterns indexed
   - No full collection scans

3. Claude API:
   - Token usage tracked
   - Cost per report monitored
   - Adjust prompts if needed

### Monitoring & Observability
1. Metrics to track:
   - Job completion rate (%)
   - Average processing time
   - Error rate by type
   - Claude API cost per report

2. Alerts:
   - Job failure rate > 5% → Alert
   - Processing time > 20 min → Alert
   - Email delivery failure → Alert

**Acceptance Criteria:**
- Email notifications working reliably
- Error states handled gracefully
- End-to-end flow fully tested
- Performance meets SLA
- Ready for production launch

---

## Phase 3 Completion Checklist

- [ ] Narrative generation working (all 6 sections)
- [ ] PDF generation working (styled, encrypted)
- [ ] Frontend UI complete (all screens)
- [ ] Email notifications working
- [ ] Error handling implemented
- [ ] Integration tests passing (end-to-end)
- [ ] Performance acceptable (< 20 min for unstructured)
- [ ] Security audit completed
- [ ] Ready for launch

**By end of Phase 3:**
- Complete end-to-end flow: Upload → Extract → Analyze → Generate → Download
- Frontend polished and responsive
- Production ready

---

---

# FINAL LAUNCH & DEPLOYMENT (Week 15)

**Deliverables:**
- [ ] Staging environment fully tested
- [ ] Production deployment process documented
- [ ] Monitoring set up
- [ ] Rollback procedure ready
- [ ] Team trained on production operations

**Pre-Launch Checklist:**
- [ ] All integration tests passing
- [ ] Load testing completed (100 concurrent users)
- [ ] Security audit completed (Firebase rules, API auth, data encryption)
- [ ] Error handling tested (all failure paths)
- [ ] Email delivery tested
- [ ] Analytics instrumentation complete
- [ ] Documentation complete (runbook, troubleshooting)
- [ ] Rollback procedure tested
- [ ] Team trained on incident response

**Go-Live Steps:**
1. Deploy to staging
2. Final full integration test
3. Deploy to production
4. Monitor error rates for 24 hours
5. If issues: Rollback procedure
6. If stable: Announce launch

---

# Summary: Documentation Deliverables by Phase

| Phase | Documentation | Status |
|-------|---------------|--------|
| 0 | ARCHITECTURE.md, API_SPEC.md, DATABASE.md, COMPONENT_SPECS.md, DEVELOPMENT.md, DEPLOYMENT.md, TESTING_STRATEGY.md | Ready |
| 1 | Upload validation spec, extraction spec, job queue spec | During Phase 0 |
| 2 | Pattern engine spec, quote selection spec, framework specs, analysis integration spec | During Phase 0 |
| 3 | Narrative generation spec, PDF generation spec, UI component spec, email template spec | During Phase 0 |
| Launch | Runbook, monitoring guide, incident response guide, scaling guide | Week 15 |

---

# Coding Assistant Prompt Template

When assigning work to an AI coding assistant, use this template:

```
PHASE: [Phase.Subphase]
TASK: [Component Name]

SPECIFICATION:
[Paste relevant spec section from COMPONENT_SPECS.md]

INPUT SCHEMA:
[Example JSON input]

OUTPUT SCHEMA:
[Example JSON output]

REQUIREMENTS:
1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

TESTS:
[List test cases from spec]

ACCEPTANCE CRITERIA:
[List success criteria]

CONSTRAINTS:
- Error handling required (see spec)
- No shortcuts, full implementation
- Include unit tests in same file
- Code follows existing patterns in /backend/services/

DELIVERABLE:
[Paste file path where code should go]

Begin with: "I understand. I will implement [Component] following the spec above..."
```

---

**Questions for the team:**
1. Parallel work during phases? (Suggest: Phase 3 frontend can start week 9, parallelized with Phase 2)
2. Who reviews code? (Suggest: 1 senior dev per team/component)
3. Testing strategy? (See TESTING_STRATEGY.md for detail)
4. Deployment frequency? (Suggest: Deploy to staging daily, production weekly or on-demand)

