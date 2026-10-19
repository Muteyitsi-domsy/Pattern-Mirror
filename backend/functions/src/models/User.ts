import { Timestamp } from 'firebase-admin/firestore';

export type SubscriptionTier = 'free' | 'renew90_user' | 'premium';

/** Subset of DATABASE.md's /users/{userId} used so far. */
export interface UserRecord {
  userId: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  monthlyReportCount: number;
  monthlyReportReset: Timestamp;
  totalReportsAllTime: number;
}
