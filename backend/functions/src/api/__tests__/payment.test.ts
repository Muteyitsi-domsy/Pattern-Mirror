import { createHmac } from 'crypto';
import request from 'supertest';
import { createApp } from '../../app';
import { auth, db } from '../../firebaseAdmin';
import { createLemonSqueezyCheckout } from '../../services/paymentService';

jest.mock('../../firebaseAdmin', () => ({
  auth: { verifyIdToken: jest.fn() },
  db: { collection: jest.fn() },
}));

jest.mock('../../services/userService', () => ({
  ensureUserRecord: jest.fn(),
}));

jest.mock('../../services/paymentService', () => {
  const actual = jest.requireActual('../../services/paymentService');
  return {
    createLemonSqueezyCheckout: jest.fn(),
    handleLemonSqueezyWebhook: jest.fn(),
    verifyWebhookSignature: actual.verifyWebhookSignature,
  };
});

jest.mock('../../services/uploadService', () => ({
  detectDataType: jest.fn((v: string) => {
    if (!['structured', 'semi', 'unstructured'].includes(v)) {
      const { ValidationError } = jest.requireActual('../../errors');
      throw new ValidationError('bad dataType');
    }
    return v;
  }),
}));

const app = createApp();

function withAuth(req: request.Test) {
  return req.set('Authorization', 'Bearer goodtoken');
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user_abc123' });
});

describe('POST /api/payment/create-checkout', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/payment/create-checkout').send({ dataType: 'structured' });
    expect(res.status).toBe(401);
  });

  it('creates a checkout and returns its details', async () => {
    (createLemonSqueezyCheckout as jest.Mock).mockResolvedValue({
      checkoutId: 'checkout_1',
      checkoutUrl: 'https://patternmirror.lemonsqueezy.com/checkout/abc',
      variantId: 'variant_1',
      amount: 4999,
      currency: 'usd',
      status: 'pending',
    });

    const res = await withAuth(request(app).post('/api/payment/create-checkout')).send({
      dataType: 'structured',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ checkoutId: 'checkout_1', amount: 4999, status: 'pending' });
  });

  it('rejects an invalid dataType', async () => {
    const res = await withAuth(request(app).post('/api/payment/create-checkout')).send({
      dataType: 'bogus',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/payment/checkout/:checkoutId/status', () => {
  it('returns 404 when the checkout does not exist', async () => {
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }),
    });

    const res = await withAuth(request(app).get('/api/payment/checkout/checkout_1/status'));
    expect(res.status).toBe(404);
  });

  it("returns 404 when the checkout belongs to a different user (doesn't leak existence)", async () => {
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ userId: 'someone_else', status: 'paid' }),
        }),
      }),
    });

    const res = await withAuth(request(app).get('/api/payment/checkout/checkout_1/status'));
    expect(res.status).toBe(404);
  });

  it('returns the checkout status for its owner', async () => {
    (db.collection as jest.Mock).mockReturnValue({
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            checkoutId: 'checkout_1',
            userId: 'user_abc123',
            status: 'paid',
            lemonSqueezyOrderId: 'order_789',
            updatedAt: { toDate: () => new Date('2026-01-01T00:00:00Z') },
          }),
        }),
      }),
    });

    const res = await withAuth(request(app).get('/api/payment/checkout/checkout_1/status'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ checkoutId: 'checkout_1', status: 'paid', lemonSqueezyOrderId: 'order_789' });
  });
});

describe('POST /api/webhooks/lemonsqueezy', () => {
  const secret = 'test-webhook-secret';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, LEMONSQUEEZY_WEBHOOK_SECRET: secret };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects a request with a bad signature', async () => {
    const payload = JSON.stringify({ meta: { event_name: 'order_created' } });

    const res = await request(app)
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .set('X-Signature', 'not-the-real-signature-not-the-real-signature')
      .send(payload);

    expect(res.status).toBe(401);
  });

  it('accepts a correctly signed request and processes the event', async () => {
    // Sent as a string, not a Buffer: supertest's .send(buffer) JSON-serializes
    // Buffer objects (-> {"type":"Buffer","data":[...]}) instead of writing
    // their raw bytes, which would make this test sign one payload and send
    // a different one. A real request from Lemon Squeezy sends literal bytes
    // either way, so this is a test-harness-only concern, not a production bug.
    const payload = JSON.stringify({
      meta: { event_name: 'order_created', custom_data: { checkoutId: 'checkout_1' } },
      data: { id: 'order_789', attributes: { status: 'paid' } },
    });
    const signature = createHmac('sha256', secret).update(Buffer.from(payload, 'utf-8')).digest('hex');

    const res = await request(app)
      .post('/api/webhooks/lemonsqueezy')
      .type('application/json')
      .set('X-Signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});
