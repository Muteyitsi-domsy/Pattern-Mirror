import { useState, FormEvent } from 'react';
import { User } from 'firebase/auth';
import { signIn, signOutUser } from '@/services/authService';

const styles = {
  container: {
    maxWidth: 400,
    margin: '80px auto',
    padding: 'var(--space-2xl)',
  },
  h1: {
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 'var(--space-lg)',
  },
  field: {
    marginBottom: 'var(--space-md)',
  },
  label: {
    display: 'block',
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    width: '100%',
    fontSize: 16,
    padding: '12px 16px',
    border: '1px solid var(--color-border-dark)',
    borderRadius: 'var(--radius-md)',
  },
  button: {
    width: '100%',
    background: 'var(--color-primary)',
    color: 'white',
    fontSize: 16,
    fontWeight: 600,
    padding: '12px 24px',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    background: '#f3f4f6',
    color: 'var(--color-text-primary)',
    fontSize: 16,
    padding: '12px 24px',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  error: {
    color: 'var(--color-error)',
    fontSize: 14,
    marginBottom: 'var(--space-md)',
  },
} as const;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const signedInUser = await signIn(email, password);
      setUser(signedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await signOutUser();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <div style={styles.container}>
        <h1 style={styles.h1}>You&apos;re signed in</h1>
        <p>{user.email}</p>
        <button style={styles.secondaryButton} onClick={handleLogout} disabled={loading}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>Pattern Mirror</h1>
      <form onSubmit={handleSubmit}>
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.field}>
          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
        </div>
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
