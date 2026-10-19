import { ensureUserRecord, getUser } from '../userService';
import { db } from '../../firebaseAdmin';

jest.mock('../../firebaseAdmin', () => ({
  db: { collection: jest.fn() },
}));

jest.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1700000000, nanoseconds: 0 })),
    fromDate: jest.fn((d: Date) => ({ seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 })),
  },
}));

function mockUserDoc(exists: boolean, data?: Record<string, unknown>) {
  const doc = {
    get: jest.fn().mockResolvedValue({ exists, data: () => data }),
    set: jest.fn().mockResolvedValue(undefined),
  };
  (db.collection as jest.Mock).mockReturnValue({ doc: jest.fn().mockReturnValue(doc) });
  return doc;
}

describe('ensureUserRecord', () => {
  it('creates a default free-tier user record when none exists', async () => {
    const doc = mockUserDoc(false);

    await ensureUserRecord('user_abc123', 'a@b.com');

    expect(doc.set).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_abc123',
        email: 'a@b.com',
        subscriptionTier: 'free',
        monthlyReportCount: 0,
      })
    );
  });

  it('does nothing when a user record already exists (idempotent)', async () => {
    const doc = mockUserDoc(true);

    await ensureUserRecord('user_abc123', 'a@b.com');

    expect(doc.set).not.toHaveBeenCalled();
  });

  it('defaults email to an empty string when the token has none', async () => {
    const doc = mockUserDoc(false);

    await ensureUserRecord('user_abc123', undefined);

    expect(doc.set).toHaveBeenCalledWith(expect.objectContaining({ email: '' }));
  });
});

describe('getUser', () => {
  it('returns null when the user does not exist', async () => {
    mockUserDoc(false);
    await expect(getUser('missing')).resolves.toBeNull();
  });

  it('returns the user record when it exists', async () => {
    mockUserDoc(true, { userId: 'user_abc123', subscriptionTier: 'premium' });
    await expect(getUser('user_abc123')).resolves.toEqual({
      userId: 'user_abc123',
      subscriptionTier: 'premium',
    });
  });
});
