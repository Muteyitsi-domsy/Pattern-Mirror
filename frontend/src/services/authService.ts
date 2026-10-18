import { signInWithEmailAndPassword, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from './firebaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Full logout: revokes the session server-side (so a copied idToken can't
 * keep being used — see backend/functions/src/middleware/auth.ts), then
 * clears the client-side Firebase session.
 */
export async function signOutUser(): Promise<void> {
  const currentUser = auth.currentUser;

  if (currentUser) {
    const idToken = await currentUser.getIdToken();
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    }).catch(() => {
      // Best-effort: still clear the local session even if the server call fails.
    });
  }

  await firebaseSignOut(auth);
}
