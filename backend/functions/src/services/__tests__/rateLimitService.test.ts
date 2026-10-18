import { checkRateLimit, getRateLimit } from '../rateLimitService';
import { RateLimitError } from '../../errors';
import { db } from '../../firebaseAdmin';

jest.mock('../../firebaseAdmin', () => ({
  db: { collection: jest.fn() },
}));

function mockUserDoc(data: Record<string, unknown> | undefined) {
  (db.collection as jest.Mock).mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({ data: () => data }),
    }),
  });
}

describe('getRateLimit', () => {
  it('returns the documented limit per tier', () => {
    expect(getRateLimit('free')).toBe(5);
    expect(getRateLimit('premium')).toBe(10);
    expect(getRateLimit('renew90_user')).toBeNull();
  });

  it('defaults unknown tiers to the free limit', () => {
    expect(getRateLimit('unknown_tier')).toBe(5);
  });
});

describe('checkRateLimit', () => {
  it('does nothing when the user has no record yet', async () => {
    mockUserDoc(undefined);
    await expect(checkRateLimit('user_abc')).resolves.toBeUndefined();
  });

  it('does nothing for a free-tier user under their limit', async () => {
    mockUserDoc({ subscriptionTier: 'free', monthlyReportCount: 2 });
    await expect(checkRateLimit('user_abc')).resolves.toBeUndefined();
  });

  it('throws RateLimitError for a free-tier user at their limit', async () => {
    mockUserDoc({
      subscriptionTier: 'free',
      monthlyReportCount: 5,
      monthlyReportReset: new Date('2026-11-01'),
    });
    await expect(checkRateLimit('user_abc')).rejects.toThrow(RateLimitError);
  });

  it('never throws for an unlimited (renew90_user) tier', async () => {
    mockUserDoc({ subscriptionTier: 'renew90_user', monthlyReportCount: 9999 });
    await expect(checkRateLimit('user_abc')).resolves.toBeUndefined();
  });
});
