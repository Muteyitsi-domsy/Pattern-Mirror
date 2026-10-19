import { createJob, enqueueJob, getJob, processJob } from '../jobService';
import { db } from '../../firebaseAdmin';
import { getFunctions } from 'firebase-admin/functions';

jest.mock('../../firebaseAdmin', () => ({
  db: { collection: jest.fn() },
}));

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0 })) },
}));

jest.mock('firebase-admin/functions', () => ({
  getFunctions: jest.fn(),
}));

function mockJobDoc() {
  const doc = {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
  (db.collection as jest.Mock).mockReturnValue({ doc: jest.fn().mockReturnValue(doc) });
  return doc;
}

const baseParams = {
  userId: 'user_abc123',
  dataType: 'structured' as const,
  journalCount: 45,
  journalStoragePath: 'temp/upload_1/journal.csv',
  focusQuestions: ['Q1', 'Q2'] as [string, string],
  frameworks: [],
  userContext: {},
  userMbtiType: null,
  userEnneagramType: null,
  chargeAmount: 0,
  checkoutId: null,
};

describe('createJob', () => {
  it('writes a queued job with the given params', async () => {
    const doc = mockJobDoc();

    const job = await createJob(baseParams);

    expect(job.userId).toBe('user_abc123');
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(job.reportId).toEqual(expect.any(String));
    expect(doc.set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_abc123', status: 'queued' }));
  });

  it('sets estimatedRemainingSeconds per the documented SLA for the data type', async () => {
    mockJobDoc();

    const structured = await createJob(baseParams);
    const unstructured = await createJob({ ...baseParams, dataType: 'unstructured' });

    expect(structured.estimatedRemainingSeconds).toBe(480);
    expect(unstructured.estimatedRemainingSeconds).toBe(900);
  });
});

describe('enqueueJob', () => {
  it('enqueues onto the processReportJob task queue', async () => {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    (getFunctions as jest.Mock).mockReturnValue({
      taskQueue: jest.fn().mockReturnValue({ enqueue }),
    });

    await enqueueJob('job_123');

    expect(enqueue).toHaveBeenCalledWith({ jobId: 'job_123' });
  });
});

describe('getJob', () => {
  it('returns null when the job does not exist', async () => {
    const doc = mockJobDoc();
    doc.get.mockResolvedValue({ exists: false, data: () => undefined });

    await expect(getJob('missing')).resolves.toBeNull();
  });

  it('returns the job data when it exists', async () => {
    const doc = mockJobDoc();
    doc.get.mockResolvedValue({ exists: true, data: () => ({ jobId: 'job_123', status: 'queued' }) });

    await expect(getJob('job_123')).resolves.toEqual({ jobId: 'job_123', status: 'queued' });
  });
});

describe('processJob', () => {
  it('transitions the job through analyzing to complete', async () => {
    const doc = mockJobDoc();

    await processJob('job_123');

    expect(doc.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'analyzing', progress: 50 })
    );
    expect(doc.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'complete', progress: 100 })
    );
  });
});
