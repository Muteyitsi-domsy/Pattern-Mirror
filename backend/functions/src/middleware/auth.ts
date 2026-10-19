import { Request, Response, NextFunction } from 'express';
import { auth } from '../firebaseAdmin';
import { ensureUserRecord } from '../services/userService';
import { handleError } from './errorHandler';

/**
 * Verifies the Firebase ID token in the Authorization header and attaches
 * the decoded user's uid to req.userId. Responds 401 on any failure.
 */
export async function verifyFirebaseToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split('Bearer ')[1] : undefined;

  if (!token) {
    res.status(401).json({
      error: 'authentication_error',
      message: 'Missing authorization token',
    });
    return;
  }

  let userId: string;

  try {
    // checkRevoked: true — without it, a revoked refresh token (e.g. after
    // logout) has no effect on an already-issued ID token until it expires
    // naturally (~1hr), so "logout clears session" wouldn't actually hold.
    // Note: Firebase compares auth_time to tokensValidAfterTime at whole-second
    // resolution, so a logout in the same UTC second as the original sign-in
    // won't register as revoked yet — expected Firebase behavior, not a bug here.
    const decoded = await auth.verifyIdToken(token, true);
    userId = decoded.uid;
    req.userId = userId;

    try {
      // Separate try/catch: a Firestore failure here is a real server_error,
      // not an authentication failure — conflating them would misreport a
      // valid token as "invalid" when the actual problem is downstream.
      await ensureUserRecord(userId, decoded.email);
    } catch (error) {
      handleError(error as Error, res);
      return;
    }

    next();
  } catch {
    res.status(401).json({
      error: 'authentication_error',
      message: 'Invalid or expired token',
    });
  }
}
