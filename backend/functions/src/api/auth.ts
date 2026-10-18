import { Request, Response } from 'express';
import { auth } from '../firebaseAdmin';
import { ValidationError, AuthenticationError } from '../errors';
import { handleError } from '../middleware/errorHandler';

/**
 * When FIREBASE_AUTH_EMULATOR_HOST is set (local/emulator dev), the Admin
 * SDK auto-redirects its own calls there — but this raw fetch() doesn't,
 * so without this we'd silently call *production* Firebase Auth. Mirror
 * the Admin SDK's redirect so emulator-based local dev actually works.
 */
function identityToolkitSignInUrl(): string {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return emulatorHost
    ? `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
    : 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
}

interface IdentityToolkitSignInResponse {
  idToken: string;
  localId: string;
  email: string;
}

interface IdentityToolkitErrorResponse {
  error: { message: string };
}

/**
 * POST /auth/login
 * Proxies Firebase's Identity Toolkit REST API so the documented
 * email/password -> idToken contract (API_SPEC.md 4.2) works without
 * requiring every client to embed the Firebase client SDK.
 */
export async function loginUser(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || email.length === 0) {
      throw new ValidationError('email is required', { field: 'email' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      throw new ValidationError('password is required', { field: 'password' });
    }

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      throw new Error('FIREBASE_WEB_API_KEY is not configured');
    }

    const response = await fetch(`${identityToolkitSignInUrl()}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = (await response.json()) as
      | IdentityToolkitSignInResponse
      | IdentityToolkitErrorResponse;

    if (!response.ok) {
      const message = 'error' in data ? data.error.message : 'Authentication failed';
      throw new AuthenticationError(message);
    }

    const { idToken, localId, email: confirmedEmail } = data as IdentityToolkitSignInResponse;

    res.status(200).json({
      idToken,
      userId: localId,
      email: confirmedEmail,
    });
  } catch (error) {
    handleError(error as Error, res);
  }
}

/**
 * POST /auth/logout
 * Requires verifyFirebaseToken to have run first (req.userId set).
 * Revokes all of the user's refresh tokens so the session is actually
 * cleared, not just abandoned client-side.
 */
export async function logoutUser(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      throw new AuthenticationError('Missing authenticated user');
    }

    await auth.revokeRefreshTokens(req.userId);

    res.status(200).json({ message: 'Successfully logged out' });
  } catch (error) {
    handleError(error as Error, res);
  }
}
