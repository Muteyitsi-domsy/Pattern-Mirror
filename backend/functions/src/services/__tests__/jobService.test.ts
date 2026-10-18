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

describe('createJob', () => {
  it('writes a queued job with the given userId', async () => {
    const doc = mockJobDoc();

    const job = await createJob('user_abc123');

    expect(job.userId).toBe('user_abc123');
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(doc.set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_abc123', status: 'queued' }));
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
