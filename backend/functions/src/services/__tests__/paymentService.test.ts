import { createHmac } from 'crypto';
import {
  checkPaymentRequired,
  findPaidCheckout,
  consumeCheckout,
  createLemonSqueezyCheckout,
  verifyWebhookSignature,
  handleLemonSqueezyWebhook,
} from '../paymentService';
import { ValidationError } from '../../errors';
import { db } from '../../firebaseAdmin';

jest.mock('../../firebaseAdmin', () => ({
  db: { collection: jest.fn() },
}));

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: { now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0 })) },
}));

describe('checkPaymentRequired', () => {
  it('requires payment only for the free tier', () => {
    expect(checkPaymentRequired('free')).toBe(true);
    expect(checkPaymentRequired('renew90_user')).toBe(false);
    expect(checkPaymentRequired('premium')).toBe(false);
  });
});

describe('findPaidCheckout', () => {
  it('queries for a paid, unconsumed checkout for the user', async () => {
    const where = jest.fn().mockReturnThis();
    const limit = jest.fn().mockReturnThis();
    const get = jest.fn().mockResolvedValue({ empty: true, docs: [] });
    (db.collection as jest.Mock).mockReturnValue({ where, limit, get });

    const result = await findPaidCheckout('user_abc123');

    expect(where).toHaveBeenCalledWith('userId', '==', 'user_abc123');
    expect(where).toHaveBeenCalledWith('status', '==', 'paid');
    expect(where).toHaveBeenCalledWith('jobId', '==', null);
    expect(result).toBeNull();
  });

  it('returns the checkout data when one is found', async () => {
    const checkoutData = { checkoutId: 'checkout_1', status: 'paid' };
    const where = jest.fn().mockReturnThis();
    const limit = jest.fn().mockReturnThis();
    const get = jest.fn().mockResolvedValue({ empty: false, docs: [{ data: () => checkoutData }] });
    (db.collection as jest.Mock).mockReturnValue({ where, limit, get });

    await expect(findPaidCheckout('user_abc123')).resolves.toEqual(checkoutData);
  });
});

describe('consumeCheckout', () => {
  it('marks the checkout as consumed by the job', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({ update }),
    });

    await consumeCheckout('checkout_1', 'job_123');

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job_123' }));
  });
});

describe('createLemonSqueezyCheckout', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      LEMONSQUEEZY_API_KEY: 'test-key',
      LEMONSQUEEZY_STORE_ID: 'store_1',
      LEMONSQUEEZY_VARIANT_ID: 'variant_1',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('throws when Lemon Squeezy env vars are not configured', async () => {
    process.env.LEMONSQUEEZY_API_KEY = '';
    await expect(createLemonSqueezyCheckout('user_abc123', 'structured')).rejects.toThrow(
      /not configured/
    );
  });

  it('creates a checkout via the Lemon Squeezy API and stores it in Firestore', async () => {
    const set = jest.fn().mockResolvedValue(undefined);
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({ set }),
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'ls_checkout_1', attributes: { url: 'https://patternmirror.lemonsqueezy.com/checkout/abc' } },
      }),
    }) as unknown as typeof fetch;

    const checkout = await createLemonSqueezyCheckout('user_abc123', 'unstructured');

    expect(checkout.amount).toBe(5999);
    expect(checkout.status).toBe('pending');
    expect(checkout.checkoutUrl).toBe('https://patternmirror.lemonsqueezy.com/checkout/abc');
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user_abc123', amount: 5999 }));
  });

  it('throws when the Lemon Squeezy API returns an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'Invalid variant',
    }) as unknown as typeof fetch;

    await expect(createLemonSqueezyCheckout('user_abc123', 'structured')).rejects.toThrow(
      /checkout creation failed/
    );
  });
});

describe('verifyWebhookSignature', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, LEMONSQUEEZY_WEBHOOK_SECRET: 'test-secret' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('accepts a correctly signed body', () => {
    const body = Buffer.from(JSON.stringify({ meta: { event_name: 'order_created' } }));
    const signature = createHmac('sha256', 'test-secret').update(body).digest('hex');

    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it('rejects an incorrect signature', () => {
    const body = Buffer.from('{}');
    expect(verifyWebhookSignature(body, 'wrong-signature-wrong-signature')).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(verifyWebhookSignature(Buffer.from('{}'), undefined)).toBe(false);
  });

  it('rejects when the webhook secret is not configured', () => {
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = '';
    const body = Buffer.from('{}');
    const signature = createHmac('sha256', 'test-secret').update(body).digest('hex');
    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });
});

describe('handleLemonSqueezyWebhook', () => {
  it('marks the checkout paid on order_created', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({ update }),
    });

    const body = Buffer.from(
      JSON.stringify({
        meta: { event_name: 'order_created', custom_data: { checkoutId: 'checkout_1' } },
        data: { id: 'order_789', attributes: { status: 'paid' } },
      })
    );

    await handleLemonSqueezyWebhook(body);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paid', lemonSqueezyOrderId: 'order_789' })
    );
  });

  it('marks the checkout refunded on order_refunded', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({ update }),
    });

    const body = Buffer.from(
      JSON.stringify({
        meta: { event_name: 'order_refunded', custom_data: { checkoutId: 'checkout_1' } },
        data: { id: 'order_789', attributes: { status: 'refunded' } },
      })
    );

    await handleLemonSqueezyWebhook(body);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'refunded' }));
  });

  it('throws when custom_data.checkoutId is missing', async () => {
    const body = Buffer.from(JSON.stringify({ meta: { event_name: 'order_created' }, data: { id: 'x', attributes: {} } }));

    await expect(handleLemonSqueezyWebhook(body)).rejects.toThrow(ValidationError);
  });
});
