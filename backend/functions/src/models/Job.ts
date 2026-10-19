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

export type DataType = 'structured' | 'semi' | 'unstructured';
export type Framework = 'mbti' | 'enneagram' | 'values';

export interface UserContext {
  goals?: string;
  values?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

/** Matches DATABASE.md's /jobs/{jobId} (full Phase 1.1 shape). */
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

  // Input data, set by POST /api/reports/create (Phase 1.1)
  dataType: DataType;
  journalCount: number;
  journalStoragePath: string | null;
  focusQuestions: [string, string];
  frameworks: Framework[];
  userContext: UserContext;
  userMbtiType: string | null;
  userEnneagramType: string | null;

  // Payment
  chargeAmount: number; // cents; 0 for renew90_user/premium
  checkoutId: string | null; // FK to /checkouts, null if no payment was required
}
