import { randomUUID } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { db } from '../firebaseAdmin';
import { DataType, Framework, Job, UserContext } from '../models/Job';

const JOBS_COLLECTION = 'jobs';
const PROCESS_REPORT_JOB_FUNCTION = 'processReportJob';

/** Matches API_SPEC.md's documented SLA (section 8). */
const ESTIMATED_SECONDS_BY_DATA_TYPE: Record<DataType, number> = {
  structured: 480, // ~8 min
  semi: 600, // ~10 min
  unstructured: 900, // ~15 min
};

export function estimateCompletionSeconds(dataType: DataType): number {
  return ESTIMATED_SECONDS_BY_DATA_TYPE[dataType];
}

export interface CreateJobParams {
  userId: string;
  dataType: DataType;
  journalCount: number;
  journalStoragePath: string;
  focusQuestions: [string, string];
  frameworks: Framework[];
  userContext: UserContext;
  userMbtiType: string | null;
  userEnneagramType: string | null;
  chargeAmount: number;
  checkoutId: string | null;
}

/** Creates a queued job record (POST /api/reports/create, Phase 1.1). */
export async function createJob(params: CreateJobParams): Promise<Job> {
  const job: Job = {
    jobId: randomUUID(),
    userId: params.userId,
    reportId: randomUUID(),
    status: 'queued',
    progress: 0,
    currentPhase: 'Queued',
    createdAt: Timestamp.now(),
    startedAt: null,
    completedAt: null,
    estimatedRemainingSeconds: estimateCompletionSeconds(params.dataType),
    errorMessage: null,
    errorPhase: null,
    errorRecoverable: null,

    dataType: params.dataType,
    journalCount: params.journalCount,
    journalStoragePath: params.journalStoragePath,
    focusQuestions: params.focusQuestions,
    frameworks: params.frameworks,
    userContext: params.userContext,
    userMbtiType: params.userMbtiType,
    userEnneagramType: params.userEnneagramType,

    chargeAmount: params.chargeAmount,
    checkoutId: params.checkoutId,
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
 * Phase 1.2+ replaces the body of this function with the real
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
