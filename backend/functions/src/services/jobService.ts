import { randomUUID } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../firebaseAdmin';
import { Job } from '../models/Job';

const JOBS_COLLECTION = 'jobs';
const PROCESS_REPORT_JOB_FUNCTION = 'processReportJob';

/**
 * Creates a queued job record. Phase 0.5 skeleton — doesn't yet take
 * dataType/focusQuestions/payment info (Phase 1.1's POST /api/reports/create
 * populates those once upload/payment exist).
 */
export async function createJob(userId: string): Promise<Job> {
  const job: Job = {
    jobId: randomUUID(),
    userId,
    reportId: null,
    status: 'queued',
    progress: 0,
    currentPhase: 'Queued',
    createdAt: Timestamp.now(),
    startedAt: null,
    completedAt: null,
    estimatedRemainingSeconds: null,
    errorMessage: null,
    errorPhase: null,
    errorRecoverable: null,
  };

  await db.collection(JOBS_COLLECTION).doc(job.jobId).set(job);
  return job;
}

/** Enqueues the job onto its Cloud Tasks queue (auto-provisioned by onTaskDispatched). */
export async function enqueueJob(jobId: string): Promise<void> {
  await getFunctions().taskQueue<{ jobId: string }>(PROCESS_REPORT_JOB_FUNCTION).enqueue({ jobId });
}

export async function getJob(jobId: string): Promise<Job | null> {
  const doc = await db.collection(JOBS_COLLECTION).doc(jobId).get();
  return doc.exists ? (doc.data() as Job) : null;
}

/**
 * Worker skeleton (Phase 0.5): acknowledges the job and marks it complete.
 * Phase 1-2 replaces the body of this function with the real
 * extraction -> analysis -> generation -> finalizing pipeline; the status
 * progression and Firestore update pattern established here stays the same.
 */
export async function processJob(jobId: string): Promise<void> {
  console.log(`Processing job ${jobId}`);

  const jobRef = db.collection(JOBS_COLLECTION).doc(jobId);

  await jobRef.update({
    status: 'analyzing',
    progress: 50,
    currentPhase: 'Processing (skeleton worker)',
    startedAt: Timestamp.now(),
  });

  await jobRef.update({
    status: 'complete',
    progress: 100,
    currentPhase: 'Complete',
    completedAt: Timestamp.now(),
  });
}
