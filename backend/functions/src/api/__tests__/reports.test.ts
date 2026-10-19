import request from 'supertest';
import { createApp } from '../../app';
import { auth } from '../../firebaseAdmin';
import { getJob, createJob, enqueueJob } from '../../services/jobService';
import { getUser } from '../../services/userService';
import { checkRateLimit } from '../../services/rateLimitService';
import { findPaidCheckout, createLemonSqueezyCheckout, consumeCheckout } from '../../services/paymentService';
import { createUploadUrl, getOwnedUpload, markUploadConsumed, getUploadedFile } from '../../services/uploadService';

jest.mock('../../firebaseAdmin', () => ({
  auth: { verifyIdToken: jest.fn() },
  db: { collection: jest.fn() },
}));

jest.mock('../../services/jobService', () => ({
  getJob: jest.fn(),
  createJob: jest.fn(),
  enqueueJob: jest.fn(),
}));

jest.mock('../../services/userService', () => ({
  ensureUserRecord: jest.fn(),
  getUser: jest.fn(),
}));

jest.mock('../../services/rateLimitService', () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock('../../services/paymentService', () => ({
  checkPaymentRequired: jest.fn((tier: string) => tier === 'free'),
  findPaidCheckout: jest.fn(),
  createLemonSqueezyCheckout: jest.fn(),
  consumeCheckout: jest.fn(),
}));

jest.mock('../../services/uploadService', () => ({
  detectDataType: jest.fn((v: string) => {
    if (!['structured', 'semi', 'unstructured'].includes(v)) {
      const { ValidationError } = jest.requireActual('../../errors');
      throw new ValidationError('dataType must be one of: structured, semi, unstructured', {
        field: 'dataType',
      });
    }
    return v;
  }),
  createUploadUrl: jest.fn(),
  getOwnedUpload: jest.fn(),
  markUploadConsumed: jest.fn(),
  getUploadedFile: jest.fn(),
  hashContent: jest.fn(() => 'fakehash'),
  calculateLineCount: jest.fn(() => 10),
}));

const app = createApp();

function withAuth(req: request.Test) {
  return req.set('Authorization', 'Bearer goodtoken');
}

const validCreateBody = {
  dataType: 'structured',
  uploadId: 'upload_1',
  focusQuestions: ['What habit costs me peace?', 'Where do I abandon my values?'],
  frameworks: ['mbti'],
};

beforeEach(() => {
  jest.clearAllMocks();
  (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user_abc123' });
  (getUser as jest.Mock).mockResolvedValue({ subscriptionTier: 'free' });
  (checkRateLimit as jest.Mock).mockResolvedValue(undefined);
  (getOwnedUpload as jest.Mock).mockResolvedValue({
    uploadId: 'upload_1',
    userId: 'user_abc123',
    storagePath: 'temp/upload_1/journal.csv',
    consumedByJobId: null,
  });
  (getUploadedFile as jest.Mock).mockResolvedValue(Buffer.from('date,mood,intensity\n2025-06-14,anxious,2'));
  (findPaidCheckout as jest.Mock).mockResolvedValue({
    checkoutId: 'checkout_1',
    amount: 4999,
  });
  (createJob as jest.Mock).mockResolvedValue({
    jobId: 'job_123',
    reportId: 'report_123',
    status: 'queued',
    estimatedRemainingSeconds: 480,
  });
  (enqueueJob as jest.Mock).mockResolvedValue(undefined);
  (markUploadConsumed as jest.Mock).mockResolvedValue(undefined);
  (consumeCheckout as jest.Mock).mockResolvedValue(undefined);
});

describe('GET /api/reports/:jobId/status', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/reports/job_123/status');
    expect(res.status).toBe(401);
  });

  it('returns 404 when the job does not exist', async () => {
    (getJob as jest.Mock).mockResolvedValue(null);

    const res = await withAuth(request(app).get('/api/reports/job_123/status'));

    expect(res.status).toBe(404);
  });

  it("returns 404 when the job belongs to a different user (doesn't leak existence)", async () => {
    (getJob as jest.Mock).mockResolvedValue({ jobId: 'job_123', userId: 'someone_else', status: 'queued' });

    const res = await withAuth(request(app).get('/api/reports/job_123/status'));

    expect(res.status).toBe(404);
  });

  it('returns in-progress shape for a queued/analyzing job', async () => {
    (getJob as jest.Mock).mockResolvedValue({
      jobId: 'job_123',
      userId: 'user_abc123',
      status: 'analyzing',
      progress: 50,
      currentPhase: 'Analyzing emotional patterns...',
      estimatedRemainingSeconds: 240,
      startedAt: { toDate: () => new Date('2026-01-01T00:00:00Z') },
      reportId: null,
    });

    const res = await withAuth(request(app).get('/api/reports/job_123/status'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ jobId: 'job_123', status: 'analyzing', progress: 50 });
  });

  it('returns the complete shape for a finished job', async () => {
    (getJob as jest.Mock).mockResolvedValue({
      jobId: 'job_123',
      userId: 'user_abc123',
      status: 'complete',
      progress: 100,
      reportId: 'report_789',
      startedAt: { seconds: 1000 },
      completedAt: { seconds: 1480, toDate: () => new Date('2026-01-01T00:08:00Z') },
    });

    const res = await withAuth(request(app).get('/api/reports/job_123/status'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jobId: 'job_123',
      status: 'complete',
      reportId: 'report_789',
      processingTimeSeconds: 480,
    });
  });

  it('returns the failed shape with error details', async () => {
    (getJob as jest.Mock).mockResolvedValue({
      jobId: 'job_123',
      userId: 'user_abc123',
      status: 'failed',
      errorPhase: 'analyzing',
      errorMessage: 'Pattern detection failed due to insufficient data',
      errorRecoverable: true,
    });

    const res = await withAuth(request(app).get('/api/reports/job_123/status'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jobId: 'job_123',
      status: 'failed',
      error: { phase: 'analyzing', recoverable: true },
    });
  });
});

describe('POST /api/reports/create', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/reports/create').send(validCreateBody);
    expect(res.status).toBe(401);
  });

  it('uploads successfully for a renew90_user with no paid checkout needed', async () => {
    (getUser as jest.Mock).mockResolvedValue({ subscriptionTier: 'renew90_user' });

    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ jobId: 'job_123', reportId: 'report_123', status: 'queued' });
    expect(findPaidCheckout).not.toHaveBeenCalled();
    expect(createJob).toHaveBeenCalledWith(expect.objectContaining({ chargeAmount: 0, checkoutId: null }));
    expect(enqueueJob).toHaveBeenCalledWith('job_123');
  });

  it('uses an existing paid checkout for a free-tier user and consumes it', async () => {
    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(202);
    expect(createJob).toHaveBeenCalledWith(
      expect.objectContaining({ chargeAmount: 4999, checkoutId: 'checkout_1' })
    );
    expect(consumeCheckout).toHaveBeenCalledWith('checkout_1', 'job_123');
  });

  it('returns 402 with a checkoutUrl when a free-tier user has no paid checkout', async () => {
    (findPaidCheckout as jest.Mock).mockResolvedValue(null);
    (createLemonSqueezyCheckout as jest.Mock).mockResolvedValue({
      checkoutUrl: 'https://patternmirror.lemonsqueezy.com/checkout/abc',
    });

    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({
      error: 'payment_required',
      checkoutUrl: 'https://patternmirror.lemonsqueezy.com/checkout/abc',
    });
    expect(createJob).not.toHaveBeenCalled();
  });

  it('rejects an invalid dataType', async () => {
    const res = await withAuth(request(app).post('/api/reports/create')).send({
      ...validCreateBody,
      dataType: 'bogus',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects a missing uploadId', async () => {
    const res = await withAuth(request(app).post('/api/reports/create')).send({
      ...validCreateBody,
      uploadId: undefined,
    });

    expect(res.status).toBe(400);
  });

  it("rejects an uploadId owned by a different user (doesn't leak existence)", async () => {
    const { ValidationError } = jest.requireActual('../../errors');
    (getOwnedUpload as jest.Mock).mockRejectedValue(new ValidationError('Upload not found', { field: 'uploadId' }));

    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(400);
    expect(createJob).not.toHaveBeenCalled();
  });

  it('rejects when the uploaded file was never actually uploaded to storage', async () => {
    const { ValidationError } = jest.requireActual('../../errors');
    (getUploadedFile as jest.Mock).mockRejectedValue(
      new ValidationError('Uploaded file not found — complete the direct upload first', { field: 'uploadId' })
    );

    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(400);
  });

  it('marks the upload as consumed by the created job', async () => {
    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(202);
    expect(markUploadConsumed).toHaveBeenCalledWith('upload_1', 'job_123');
  });

  it('rejects a request with only 1 focus question', async () => {
    const res = await withAuth(request(app).post('/api/reports/create')).send({
      ...validCreateBody,
      focusQuestions: ['Only one question'],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects more than 2 frameworks', async () => {
    const res = await withAuth(request(app).post('/api/reports/create')).send({
      ...validCreateBody,
      frameworks: ['mbti', 'enneagram', 'values'],
    });

    expect(res.status).toBe(400);
  });

  it('returns 429 when the user has hit their rate limit', async () => {
    const { RateLimitError } = jest.requireActual('../../errors');
    (checkRateLimit as jest.Mock).mockRejectedValue(new RateLimitError(new Date('2026-11-01')));

    const res = await withAuth(request(app).post('/api/reports/create')).send(validCreateBody);

    expect(res.status).toBe(429);
  });
});

describe('POST /api/reports/upload-url', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/reports/upload-url').send({ fileName: 'journal.csv' });
    expect(res.status).toBe(401);
  });

  it('returns a signed upload URL for a valid fileName', async () => {
    (createUploadUrl as jest.Mock).mockResolvedValue({
      uploadId: 'upload_1',
      uploadUrl: 'https://storage.googleapis.com/signed-url',
      storagePath: 'temp/upload_1/journal.csv',
    });

    const res = await withAuth(request(app).post('/api/reports/upload-url')).send({ fileName: 'journal.csv' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ uploadId: 'upload_1', uploadUrl: 'https://storage.googleapis.com/signed-url' });
    expect(createUploadUrl).toHaveBeenCalledWith('user_abc123', 'journal.csv');
  });

  it('rejects an unsupported file format', async () => {
    const { ValidationError } = jest.requireActual('../../errors');
    (createUploadUrl as jest.Mock).mockRejectedValue(new ValidationError('Unsupported file format: exe', { field: 'fileName' }));

    const res = await withAuth(request(app).post('/api/reports/upload-url')).send({ fileName: 'journal.exe' });

    expect(res.status).toBe(400);
  });
});
