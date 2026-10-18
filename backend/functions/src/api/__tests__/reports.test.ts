import request from 'supertest';
import { createApp } from '../../app';
import { auth } from '../../firebaseAdmin';
import { getJob } from '../../services/jobService';

jest.mock('../../firebaseAdmin', () => ({
  auth: { verifyIdToken: jest.fn() },
}));

jest.mock('../../services/jobService', () => ({
  getJob: jest.fn(),
}));

const app = createApp();

function withAuth(req: request.Test) {
  return req.set('Authorization', 'Bearer goodtoken');
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user_abc123' });
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
