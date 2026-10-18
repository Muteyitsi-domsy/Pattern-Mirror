import { Timestamp } from 'firebase-admin/firestore';

/** Matches DATABASE.md's /jobs/{jobId} status progression. */
export type JobStatus =
  | 'queued'
  | 'extracting'
  | 'analyzing'
  | 'generating'
  | 'finalizing'
  | 'complete'
  | 'failed';

/**
 * Core job fields used from Phase 0.5 onward. DATABASE.md documents
 * additional fields (dataType, focusQuestions, chargeAmount, etc.) that
 * Phase 1.1's real upload/payment flow populates — intentionally omitted
 * here since this skeleton worker doesn't touch them yet.
 */
export interface Job {
  jobId: string;
  userId: string;
  reportId: string | null;
  status: JobStatus;
  progress: number;
  currentPhase: string;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  estimatedRemainingSeconds: number | null;
  errorMessage: string | null;
  errorPhase: string | null;
  errorRecoverable: boolean | null;
}
