# Coding Assistant Guide: Building Pattern Mirror

**For: AI coding assistants (Claude, ChatGPT) building Pattern Mirror**  
**Purpose:** Precise instructions on how to use documentation, what to build, and how to verify completion

---

## 1. How to Use This Documentation

### The Documentation Stack

```
1. ARCHITECTURE.md
   └─ READ FIRST: Understand system design, data flow, component relationships
   
2. API_SPEC.md
   └─ REFERENCE: Backend and frontend must align to these endpoints
   
3. DATABASE.md
   └─ REFERENCE: Firestore structure, queries, security rules
   
4. PHASE_SPECS.md
   └─ YOUR ROADMAP: What to build, in what order, with what deliverables
   
5. COMPONENT_SPECS.md
   └─ DETAILED SPECS: Algorithm details for analysis engines (created separately)
   
6. DESIGN_SYSTEM.md
   └─ REFERENCE: UI/UX standards, colors, components (for frontend work)
```

### Per-Task Workflow

When assigned a task:

1. **Read the spec** (from PHASE_SPECS.md for your phase)
2. **Understand the architecture** (which systems does this connect to?)
3. **Check the API** (what endpoints/contracts must I honor?)
4. **Review the database** (how do I read/write data?)
5. **Code the implementation** (following patterns in existing codebase)
6. **Write tests** (unit + integration, see TESTING_STRATEGY.md)
7. **Verify with spec** (does output match expected schema?)

---

## 2. Working with Phases & Subphases

### Phase Structure

```
PHASE 0: Foundation & Documentation (2 weeks)
  0.1: Dev Environment & Infrastructure
  0.2: Database & Firestore Setup
  0.3: Authentication & Basic API
  0.4: Critical Documentation
  0.5: Cloud Functions & Job Queue Setup

PHASE 1: Core Pipeline (4 weeks)
  1.1: File Upload & Validation
  1.2: Data Extraction Pipeline
  1.3: Job Queue & Status Tracking

PHASE 2: Analysis Engines (4 weeks)
  2.1: Pattern Detection Engine
  2.2: Quote Selection & Framework Engines
  2.3: Analysis Integration & Testing

PHASE 3: Report Generation & Frontend (5 weeks)
  3.1: Narrative Generation Engine
  3.2: Report Compilation & PDF Generation
  3.3: Frontend Implementation
  3.4: Email Notifications & Polish
```

### When You Get an Assignment

**You'll receive:**
```
PHASE: 1.1 (File Upload & Validation)
COMPONENT: POST /api/reports/create endpoint
SPEC: [Link to PHASE_SPECS.md section 1.1]
DELIVERABLE: /backend/functions/api/reports.ts
TESTS: tests/api/reports.test.ts
```

**Steps:**
1. Read the section in PHASE_SPECS.md (e.g., "1.1: File Upload & Validation")
2. Check API_SPEC.md for endpoint details
3. Verify DATABASE.md for data model
4. Review code structure example in the spec
5. Implement following existing patterns
6. Write tests (copy examples from spec)
7. Verify: Does output match expected schema?

---

## 3. Code Quality Standards

### For Every Component

**Always include:**
```
✓ Error handling (all error cases from spec)
✓ Input validation (no bad data gets through)
✓ Type safety (TypeScript types for all inputs/outputs)
✓ Logging (debug logs for troubleshooting)
✓ Tests (unit + at least 1 integration test)
✓ Documentation (JSDoc comments on public functions)
✓ No shortcuts (full implementation, not placeholder)
```

### Example Function Structure

```typescript
/**
 * Upload and validate a journal file
 * @param fileBuffer - Raw file content
 * @param fileName - Original filename
 * @param maxSizeBytes - Max allowed size
 * @returns Promise<{hash: string, validated: boolean, errors: string[]}>
 */
async function validateAndUploadFile(
  fileBuffer: Buffer,
  fileName: string,
  maxSizeBytes: number = 50 * 1024 * 1024
): Promise<UploadResult> {
  
  // Validate inputs
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('File buffer is empty');
  }
  
  if (fileBuffer.length > maxSizeBytes) {
    throw new Error(`File exceeds maximum size of ${maxSizeBytes} bytes`);
  }
  
  try {
    // Perform validation
    const hash = await calculateHash(fileBuffer);
    const format = detectFileFormat(fileName);
    
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }
    
    // Upload to storage
    const storagePath = await uploadToCloudStorage(fileBuffer, hash);
    
    // Log success
    logger.info('File uploaded successfully', { fileName, hash, storagePath });
    
    return {
      hash,
      storagePath,
      size: fileBuffer.length,
      format,
      validated: true,
      errors: []
    };
    
  } catch (error) {
    // Log error
    logger.error('File validation failed', { fileName, error: error.message });
    
    // Return detailed error
    throw new ValidationError(
      `Failed to validate file: ${error.message}`,
      { fileName, originalError: error }
    );
  }
}
```

---

## 4. Testing Guidelines

### Test Structure

```typescript
describe('File Upload Service', () => {
  
  describe('validateAndUploadFile', () => {
    
    it('should successfully upload valid CSV file', async () => {
      const buffer = Buffer.from('date,mood,intensity\n2025-06-14,anxious,2');
      const result = await validateAndUploadFile(buffer, 'data.csv');
      
      expect(result.validated).toBe(true);
      expect(result.hash).toBeDefined();
      expect(result.storagePath).toContain('gs://');
    });
    
    it('should reject file exceeding max size', async () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024);
      
      await expect(
        validateAndUploadFile(largeBuffer, 'huge.csv', 50 * 1024 * 1024)
      ).rejects.toThrow('exceeds maximum size');
    });
    
    it('should reject unsupported file format', async () => {
      const buffer = Buffer.from('binary content');
      
      await expect(
        validateAndUploadFile(buffer, 'image.jpg')
      ).rejects.toThrow('Unsupported format');
    });
    
    it('should handle empty file buffer', async () => {
      const emptyBuffer = Buffer.from('');
      
      await expect(
        validateAndUploadFile(emptyBuffer, 'empty.csv')
      ).rejects.toThrow('File buffer is empty');
    });
  });
});
```

### Test Coverage Target
```
Unit tests: >80% coverage per function
Integration tests: Critical paths (upload → extract → analyze)
E2E tests: Full flow (uploaded → completed)
Error scenarios: Every error case listed in spec
```

---

## 5. Database Operations Cheat Sheet

### Read Operations

```typescript
// Get document
const job = await db.collection('jobs').doc(jobId).get();
if (job.exists) {
  console.log(job.data());
}

// Query with filter
const userJobs = await db.collection('jobs')
  .where('userId', '==', userId)
  .get();

// Query with multiple filters
const failedJobs = await db.collection('jobs')
  .where('userId', '==', userId)
  .where('status', '==', 'failed')
  .get();

// Query with ordering
const recentReports = await db.collection('reports')
  .where('userId', '==', userId)
  .orderBy('generatedAt', 'desc')
  .limit(5)
  .get();
```

### Write Operations

```typescript
// Set new document
await db.collection('users').doc(userId).set({
  email: 'user@example.com',
  createdAt: admin.firestore.Timestamp.now()
});

// Update existing document
await db.collection('jobs').doc(jobId).update({
  status: 'analyzing',
  progress: 45,
  updatedAt: admin.firestore.Timestamp.now()
});

// Batch write (atomic)
const batch = db.batch();
batch.update(db.collection('jobs').doc(jobId), { status: 'complete' });
batch.set(db.collection('reports').doc(reportId), { ...reportData });
await batch.commit();

// Delete field
await db.collection('users').doc(userId).update({
  deletionScheduledAt: admin.firestore.FieldValue.delete()
});
```

### Important Notes
```
✓ Always use Firestore Timestamps (admin.firestore.Timestamp.now())
✓ Batch operations for atomic multi-document writes
✓ Use transactions for read-then-write operations
✓ Indexes must exist for complex queries (see DATABASE.md)
✓ Security rules are enforced (test in Firebase Emulator)
```

---

## 6. API Implementation Pattern

### Endpoint Structure

```typescript
// /backend/functions/api/reports.ts

import { Request, Response } from 'express';
import { db, auth } from '../firebase';
import * as validation from '../services/validation';
import * as jobService from '../services/jobService';

/**
 * POST /api/reports/create
 * Initiates a new report generation job
 */
export async function createReport(req: Request, res: Response) {
  
  // 1. Authenticate
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({
      error: 'authentication_error',
      message: 'Missing authorization token'
    });
  }
  
  try {
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    // 2. Validate request
    const { error, value } = validation.validateCreateReportRequest(req.body);
    if (error) {
      return res.status(400).json({
        error: 'validation_error',
        message: error.details[0].message,
        field: error.details[0].context.key
      });
    }
    
    // 3. Check rate limit
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (userData.monthlyReportCount >= getRateLimit(userData.subscriptionTier)) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: 'You have exceeded your monthly report limit',
        resetTime: userData.monthlyReportReset
      });
    }
    
    // 4. Check payment (if needed) — Lemon Squeezy confirms async via webhook,
    //    so this checks for an already-paid checkout rather than charging inline
    if (userData.subscriptionTier === 'free') {
      const paidCheckout = await paymentService.findPaidCheckout(userId, value.dataType);
      if (!paidCheckout) {
        const checkout = await paymentService.createLemonSqueezyCheckout(userId, value.dataType);
        return res.status(402).json({
          error: 'payment_required',
          message: 'Payment needed before this report can run',
          checkoutUrl: checkout.checkoutUrl
        });
      }
    }
    
    // 5. Create job
    const job = await jobService.createJob(userId, value);
    
    // 6. Queue processing
    await jobService.enqueueJob(job.jobId);
    
    // 7. Return response (202 Accepted)
    return res.status(202).json({
      jobId: job.jobId,
      reportId: job.reportId,
      status: 'queued',
      estimatedCompletionSeconds: estimateCompletionTime(value.dataType),
      statusCheckUrl: `/api/reports/${job.jobId}/status`
    });
    
  } catch (error) {
    logger.error('Create report error', { error: error.message });
    return res.status(500).json({
      error: 'server_error',
      message: 'Failed to create report job'
    });
  }
}
```

---

## 7. Analysis Engine Pattern

### Input/Output Contract

```typescript
// Pattern Detection Engine example

interface AnalysisInput {
  entries: Array<{
    date: string;           // ISO 8601
    mood: string;           // "anxious", "reflective", etc.
    intensity: 1 | 2 | 3;   // Low, medium, high
    lifeArea: string;       // "Work", "Relationships", etc.
    text: string;           // Journal entry text
  }>;
  focusQuestions: string[];
}

interface AnalysisOutput {
  patterns: {
    frequencies: Record<string, number>;  // {Work: 0.45, ...}
    correlations: Array<{
      area1: string;
      area2: string;
      correlation: number;  // -1 to 1
      interpretation: string;
    }>;
    temporalTrends: Array<{
      dayOfWeek: string;
      avgIntensity: number;
      moodFrequency: Record<string, number>;
    }>;
  };
}

/**
 * Analyze patterns in journal data
 */
export async function analyzePatterns(input: AnalysisInput): Promise<AnalysisOutput> {
  
  // Validate input
  if (!input.entries || input.entries.length === 0) {
    throw new Error('No journal entries provided');
  }
  
  try {
    // Perform analysis
    const frequencies = calculateFrequencies(input.entries);
    const correlations = detectCorrelations(input.entries);
    const temporalTrends = identifyTemporalTrends(input.entries);
    
    return {
      patterns: {
        frequencies,
        correlations,
        temporalTrends
      }
    };
    
  } catch (error) {
    logger.error('Pattern analysis failed', { error: error.message });
    throw new AnalysisError(`Failed to analyze patterns: ${error.message}`);
  }
}
```

---

## 8. Error Handling Standard

### Error Types

```typescript
class ValidationError extends Error {
  constructor(message: string, public context: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class RateLimitError extends Error {
  constructor(public resetTime: Date) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

class PaymentError extends Error {
  constructor(message: string, public checkoutUrl?: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

class AnalysisError extends Error {
  constructor(message: string, public recoverable: boolean = true) {
    super(message);
    this.name = 'AnalysisError';
  }
}
```

### Error Responses

```typescript
// Map errors to HTTP responses
function handleError(error: Error, res: Response) {
  
  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'validation_error',
      message: error.message,
      details: error.context
    });
  }
  
  if (error instanceof AuthenticationError) {
    return res.status(401).json({
      error: 'authentication_error',
      message: error.message
    });
  }
  
  if (error instanceof RateLimitError) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: error.message,
      resetTime: error.resetTime
    });
  }
  
  if (error instanceof PaymentError) {
    return res.status(402).json({
      error: 'payment_required',
      message: error.message,
      checkoutUrl: error.checkoutUrl
    });
  }
  
  // Default: Server error
  logger.error('Unhandled error', { error: error.message });
  return res.status(500).json({
    error: 'server_error',
    message: 'An unexpected error occurred'
  });
}
```

---

## 9. How to Request Help

When you encounter ambiguity:

**Format your question:**
```
PHASE: [Phase.Subphase]
COMPONENT: [Component Name]
QUESTION: [Your question]

CONTEXT:
[What you've tried, where you're stuck]

SPEC REFERENCE:
[Which section of which document is unclear]
```

**Example:**
```
PHASE: 2.1
COMPONENT: Pattern Detection Engine
QUESTION: How should I handle entries with missing mood?

CONTEXT:
Some journal entries have empty mood field. 
Should I skip them, default to neutral, or reject?

SPEC REFERENCE:
PHASE_SPECS.md section 2.1 doesn't specify this edge case.
```

---

## 10. Acceptance Criteria Checklist

### Before Considering Work Complete

- [ ] Code implements 100% of spec (no shortcuts)
- [ ] All error cases handled (from error handling matrix)
- [ ] Input validation strict (rejects bad data)
- [ ] Tests written (unit + integration, >80% coverage)
- [ ] Tests passing (100%)
- [ ] Output schema matches spec exactly (JSON structure, field names, types)
- [ ] Logging implemented (debug + error levels)
- [ ] TypeScript types defined (no `any` types)
- [ ] JSDoc comments on public functions
- [ ] Code follows existing patterns in codebase
- [ ] Performance acceptable (see SLA in ARCHITECTURE.md)
- [ ] Security considered (no data leaks, auth validated)
- [ ] Ready for next team member to build on top

### Code Review Checklist (if applicable)

- [ ] Does code match the API spec?
- [ ] Are all error cases handled?
- [ ] Is the database schema followed?
- [ ] Are tests comprehensive and passing?
- [ ] Is the code readable and well-documented?
- [ ] Are there any security issues?
- [ ] Does it integrate cleanly with adjacent components?

---

## 11. Quick Reference Commands

### Clone & Setup
```bash
git clone https://github.com/patternmirror/backend.git
cd backend
npm install
cp .env.example .env  # Fill in Firebase credentials
npm run dev           # Local development server
npm test              # Run all tests
npm run lint          # Check code style
```

### Firebase Emulator (for local testing)
```bash
firebase emulators:start    # Start all emulators
firebase emulators:exec 'npm test'  # Run tests against emulator
```

### Deploy
```bash
npm run build              # Build
npm run deploy:staging     # Deploy to staging
npm run deploy:prod        # Deploy to production
```

---

## 12. Debugging Tips

### Check Job Status
```javascript
// Get job status from Firestore
const jobId = 'job_12345';
const job = await db.collection('jobs').doc(jobId).get();
console.log(job.data());  // See current status, progress, errors

// Check if extraction cached
const hash = sha256(journalContent);
const cached = await db.collection('extraction_cache').doc(hash).get();
console.log('Cache hit:', cached.exists);
```

### Monitor Cloud Functions
```bash
# Tail function logs
gcloud functions log processReportJob --limit 100

# Check function execution errors
gcloud error-reporting list

# Manual invocation (for testing)
gcloud functions call processReportJob \
  --data '{"jobId":"job_12345"}'
```

### Test Claude API Calls
```typescript
// Test extraction prompt
const testPrompt = `Extract life areas from: "${journalText}"`;
const response = await callClaudeWithZDR(testPrompt);
console.log('Claude response:', response);

// Check token usage
console.log('Tokens used:', response.usage.input_tokens);
console.log('Cost estimate:', response.usage.input_tokens * 0.000003);
```

---

## 13. Success Criteria by Phase

### Phase 0 Complete ✓
- Firebase projects live (dev/staging/prod)
- GitHub repo with CI/CD skeleton
- Firestore schema initialized
- Auth working (login/logout)
- Cloud Functions deployed
- All docs written and reviewed
- Team trained and aligned

### Phase 1 Complete ✓
- File uploads working
- Data type detection working
- Extraction pipeline working (Claude integrated)
- User confirmation flow working
- Job queue operational
- Status polling working
- Integration tests passing
- Error handling complete

### Phase 2 Complete ✓
- All analysis engines working independently
- Engines run in parallel
- Results combined into JSON
- Performance acceptable (<20 min for unstructured)
- Integration tests passing
- Ready for narrative generation

### Phase 3 Complete ✓
- Narrative generation working (all 6 sections)
- PDF generation working
- Frontend UI complete
- Email notifications working
- Error states handled
- End-to-end tested
- Production ready

---

## 14. Final Checklist Before Launch

- [ ] All automated tests passing
- [ ] Manual testing completed (all user flows)
- [ ] Load testing completed (100+ concurrent users)
- [ ] Security audit completed
- [ ] Performance acceptable (meet SLA)
- [ ] Error monitoring set up (Sentry or similar)
- [ ] Analytics instrumentation complete
- [ ] Logging comprehensive (debug + error)
- [ ] Documentation complete and accurate
- [ ] Team trained on troubleshooting
- [ ] Rollback procedure tested
- [ ] Backup/restore tested
- [ ] Production infrastructure ready
- [ ] Staging environment mirrors production
- [ ] Go/no-go decision made

---

## 15. Key Contacts & Resources

**Documentation:**
- ARCHITECTURE.md — System design
- API_SPEC.md — API contracts
- DATABASE.md — Firestore schema
- PHASE_SPECS.md — Development roadmap
- DESIGN_SYSTEM.md — UI/UX standards
- COMPONENT_SPECS.md — Algorithm details

**External Services:**
- Firebase Console: https://console.firebase.google.com
- Lemon Squeezy Dashboard: https://app.lemonsqueezy.com
- SendGrid: https://app.sendgrid.com
- GitHub: https://github.com/patternmirror

**Coding Standards:**
- TypeScript: Strict mode enabled
- Testing: Jest + Supertest
- Linting: ESLint + Prettier
- Format: npm run lint && npm run format

---

## 16. One More Thing

**Before you start coding:**

1. Read the entire architecture doc (30 min)
2. Review your specific phase spec (15 min)
3. Check the API spec for your endpoints (10 min)
4. Review the database schema for your data model (10 min)
5. Ask clarifying questions BEFORE coding (saves 2-3 hours)

**While coding:**

1. Follow the spec exactly (no deviations)
2. Write tests as you go (not after)
3. Test error paths (not just happy path)
4. Log generously (helps debugging)
5. Type everything (no `any` types)

**When you think you're done:**

1. Run all tests (must pass)
2. Check your output against spec schema (must match)
3. Verify error handling (all cases covered)
4. Do a code walkthrough (would another dev understand this?)
5. Mark as ready for review

---

**You've got this! The documentation is comprehensive, the specs are detailed, and you have everything you need to build a great product. Don't hesitate to ask questions if anything is unclear.**

