import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    clearSessionExpired();
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="badge-logo w-10 h-10 flex items-center justify-center shrink-0">
              <span className="font-display text-xl font-bold text-white">L</span>
            </div>
            <span className="font-display text-2xl font-bold text-ink">LedgerGueh</span>
          </div>
          <h1 className="font-display text-2xl font-medium text-ink">Welcome back</h1>
        </div>

        {sessionExpired && (
          <p className="text-gold text-sm bg-gold-light border border-gold/30 rounded-xl px-3 py-2 mb-4 text-center">
            You were signed out due to inactivity. Please sign in again.
          </p>
        )}

        <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Username</label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-clay text-sm bg-clay-light border border-clay/20 rounded-md px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-white font-semibold rounded-xl py-2.5 shadow-md shadow-primary/30 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-slate mt-4">
          <Link to="/reset-password" className="text-primary font-semibold hover:underline">
            Forgot your password?
          </Link>
        </p>
      </div>
    </div>
  );
}
