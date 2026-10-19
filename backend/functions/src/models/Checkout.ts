import { Timestamp } from 'firebase-admin/firestore';

export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

/** Matches DATABASE.md's /checkouts/{checkoutId} (Lemon Squeezy migration). */
export interface Checkout {
  checkoutId: string;
  userId: string;
  jobId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  amount: number;
  currency: string;
  variantId: string;
  status: CheckoutStatus;
  checkoutUrl: string;
  lemonSqueezyOrderId: string | null;
}
