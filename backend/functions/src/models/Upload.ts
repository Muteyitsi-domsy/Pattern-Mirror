import { Timestamp } from 'firebase-admin/firestore';

/** Matches DATABASE.md's /uploads/{uploadId}. */
export interface Upload {
  uploadId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  createdAt: Timestamp;
  consumedByJobId: string | null;
}
