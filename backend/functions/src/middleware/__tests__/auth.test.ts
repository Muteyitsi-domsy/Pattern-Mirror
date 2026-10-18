import { Request, Response } from 'express';
import { verifyFirebaseToken } from '../auth';
import { auth } from '../../firebaseAdmin';

jest.mock('../../firebaseAdmin', () => ({
  auth: { verifyIdToken: jest.fn() },
}));

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('verifyFirebaseToken', () => {
  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a request with no Authorization header', async () => {
    const req = { headers: {} } as Request;
    const res = mockRes();

    await verifyFirebaseToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'authentication_error' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a header that is not a Bearer token', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as Request;
    const res = mockRes();

    await verifyFirebaseToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    (auth.verifyIdToken as jest.Mock).mockRejectedValue(new Error('invalid token'));
    const req = { headers: { authorization: 'Bearer badtoken' } } as Request;
    const res = mockRes();

    await verifyFirebaseToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches userId and calls next on a valid token', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user_abc123' });
    const req = { headers: { authorization: 'Bearer goodtoken' } } as Request;
    const res = mockRes();

    await verifyFirebaseToken(req, res, next);

    expect(req.userId).toBe('user_abc123');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('checks token revocation so a logged-out session is actually rejected', async () => {
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: 'user_abc123' });
    const req = { headers: { authorization: 'Bearer goodtoken' } } as Request;
    const res = mockRes();

    await verifyFirebaseToken(req, res, next);

    expect(auth.verifyIdToken).toHaveBeenCalledWith('goodtoken', true);
  });
});
