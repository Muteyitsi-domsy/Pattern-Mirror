import request from 'supertest';
import { createApp } from '../../app';
import { auth } from '../../firebaseAdmin';

jest.mock('../../firebaseAdmin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  },
}));

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with a status and timestamp', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('POST /auth/login', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.FIREBASE_WEB_API_KEY;

  beforeEach(() => {
    process.env.FIREBASE_WEB_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.FIREBASE_WEB_API_KEY = originalApiKey;
  });

  it('rejects a request missing email', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'secret123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects a request missing password', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('returns idToken/userId/email on a successful sign-in', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        idToken: 'fake-id-token',
        localId: 'user_abc123',
        email: 'user@example.com',
      }),
    }) as unknown as typeof fetch;

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      idToken: 'fake-id-token',
      userId: 'user_abc123',
      email: 'user@example.com',
    });
  });

  it('maps a failed Identity Toolkit sign-in to 401 authentication_error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }),
    }) as unknown as typeof fetch;

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('authentication_error');
  });
});

describe('POST /auth/logout', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(401);
  });

  it('revokes refresh tokens and confirms logout for an authenticated user', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user_abc123' });
    (auth.revokeRefreshTokens as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/auth/logout')
      .set('Authorization', 'Bearer goodtoken');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Successfully logged out' });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('user_abc123');
  });
});
