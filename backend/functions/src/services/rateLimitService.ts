import { db } from '../firebaseAdmin';
import { RateLimitError } from '../errors';

/** Monthly report limits by subscription tier (API_SPEC.md section 3). */
const RATE_LIMITS: Record<string, number | null> = {
  free: 5,
  renew90_user: null, // unlimited
  premium: 10,
};

export function getRateLimit(subscriptionTier: string): number | null {
  // Explicit `in` check: `??` would collapse a real `null` (unlimited tier)
  // into the free-tier fallback, since null and undefined are both nullish.
  return subscriptionTier in RATE_LIMITS ? RATE_LIMITS[subscriptionTier] : RATE_LIMITS.free;
}

/**
 * Throws RateLimitError if the user has hit their monthly report quota.
 * Skeleton for Phase 0.3 — wired into POST /api/reports/create in Phase 1.1
 * once job creation exists to actually increment monthlyReportCount.
 */
export async function checkRateLimit(userId: string): Promise<void> {
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (!userData) {
    return; // No user record yet — nothing to rate limit against.
  }

  const limit = getRateLimit(userData.subscriptionTier);
  if (limit === null) {
    return; // Unlimited tier.
  }

  if ((userData.monthlyReportCount ?? 0) >= limit) {
    const resetTime =
      userData.monthlyReportReset instanceof Date
        ? userData.monthlyReportReset
        : userData.monthlyReportReset?.toDate?.() ?? new Date();
    throw new RateLimitError(resetTime);
  }
}
