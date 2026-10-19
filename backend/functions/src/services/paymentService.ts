import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../firebaseAdmin';
import { Checkout } from '../models/Checkout';
import { DataType } from '../models/Job';
import { SubscriptionTier } from '../models/User';
import { ValidationError } from '../errors';

const CHECKOUTS_COLLECTION = 'checkouts';
const LEMONSQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

/** Per ARCHITECTURE.md/PHASE_SPECS.md's documented $49-59 range. */
const PRICE_CENTS_BY_DATA_TYPE: Record<DataType, number> = {
  structured: 4999,
  semi: 5499,
  unstructured: 5999,
};

/**
 * Only the free tier pays per report — renew90_user gets it bundled with
 * their Renew90 subscription, premium's monthly quota is covered by their
 * separate Pattern Mirror subscription (not modeled in this app).
 */
export function checkPaymentRequired(tier: SubscriptionTier): boolean {
  return tier === 'free';
}

/** Finds an existing paid, not-yet-consumed checkout for this user. */
export async function findPaidCheckout(userId: string): Promise<Checkout | null> {
  const snapshot = await db
    .collection(CHECKOUTS_COLLECTION)
    .where('userId', '==', userId)
    .where('status', '==', 'paid')
    .where('jobId', '==', null)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }
  return snapshot.docs[0].data() as Checkout;
}

/** Marks a checkout as consumed by the job it paid for. */
export async function consumeCheckout(checkoutId: string, jobId: string): Promise<void> {
  await db.collection(CHECKOUTS_COLLECTION).doc(checkoutId).update({
    jobId,
    updatedAt: Timestamp.now(),
  });
}

interface LemonSqueezyCheckoutResponse {
  data: {
    id: string;
    attributes: { url: string };
  };
}

/**
 * Creates a Lemon Squeezy checkout via their API and a matching Firestore
 * /checkouts doc. See API_SPEC.md 4.5 for the full flow (checkout ->
 * webhook confirms payment asynchronously, not a synchronous charge here).
 */
export async function createLemonSqueezyCheckout(
  userId: string,
  dataType: DataType
): Promise<Checkout> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

  if (!apiKey || !storeId || !variantId) {
    throw new Error('Lemon Squeezy is not configured (missing API key/store/variant env vars)');
  }

  const checkoutId = randomUUID();
  const amount = PRICE_CENTS_BY_DATA_TYPE[dataType];

  const response = await fetch(`${LEMONSQUEEZY_API_BASE}/checkouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          custom_price: amount,
          checkout_data: {
            custom: { userId, checkoutId },
          },
        },
        relationships: {
          store: { data: { type: 'stores', id: storeId } },
          variant: { data: { type: 'variants', id: variantId } },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Lemon Squeezy checkout creation failed: ${response.status} ${errorBody}`);
  }

  const body = (await response.json()) as LemonSqueezyCheckoutResponse;

  const checkout: Checkout = {
    checkoutId,
    userId,
    jobId: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    amount,
    currency: 'usd',
    variantId,
    status: 'pending',
    checkoutUrl: body.data.attributes.url,
    lemonSqueezyOrderId: null,
  };

  await db.collection(CHECKOUTS_COLLECTION).doc(checkoutId).set(checkout);
  return checkout;
}

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { checkoutId?: string };
  };
  data: {
    id: string;
    attributes: { status: string };
  };
}

/** Verifies the X-Signature header (HMAC-SHA256 of the raw body), timing-safe. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf-8');
  const signatureBuffer = Buffer.from(signature, 'utf-8');

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

/** Handles order_created / order_refunded events (API_SPEC.md 4.5). */
export async function handleLemonSqueezyWebhook(rawBody: Buffer): Promise<void> {
  const payload = JSON.parse(rawBody.toString('utf-8')) as LemonSqueezyWebhookPayload;
  const checkoutId = payload.meta.custom_data?.checkoutId;

  if (!checkoutId) {
    throw new ValidationError('Webhook payload missing custom_data.checkoutId');
  }

  if (payload.meta.event_name === 'order_created') {
    await db
      .collection(CHECKOUTS_COLLECTION)
      .doc(checkoutId)
      .update({
        status: 'paid',
        lemonSqueezyOrderId: payload.data.id,
        updatedAt: Timestamp.now(),
      });
    return;
  }

  if (payload.meta.event_name === 'order_refunded') {
    await db.collection(CHECKOUTS_COLLECTION).doc(checkoutId).update({
      status: 'refunded',
      updatedAt: Timestamp.now(),
    });
  }
}
