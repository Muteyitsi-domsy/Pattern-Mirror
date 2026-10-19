import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import { UserRecord } from '../models/User';

const USERS_COLLECTION = 'users';

function startOfNextMonth(): Timestamp {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Timestamp.fromDate(next);
}

/**
 * Creates the user's /users/{uid} doc on their first authenticated request
 * if it doesn't exist yet. There's no dedicated signup endpoint — Firebase
 * Auth account creation happens client-side, so this is where the app-level
 * user record (subscription tier, rate-limit counters) gets initialized.
 */
export async function ensureUserRecord(userId: string, email: string | undefined): Promise<void> {
  const ref = db.collection(USERS_COLLECTION).doc(userId);
  const doc = await ref.get();

  if (doc.exists) {
    return;
  }

  const user: UserRecord = {
    userId,
    email: email ?? '',
    subscriptionTier: 'free',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    monthlyReportCount: 0,
    monthlyReportReset: startOfNextMonth(),
    totalReportsAllTime: 0,
  };

  await ref.set(user);
}

export async function getUser(userId: string): Promise<UserRecord | null> {
  const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
  return doc.exists ? (doc.data() as UserRecord) : null;
}
