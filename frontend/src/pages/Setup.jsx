import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Setup() {
  const { register, refresh } = useAuth();
  const [form, setForm] = useState({ displayName: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await register(form.username, form.password, form.displayName);
      setRecoveryCode(data.recoveryCode);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the code is still selectable on screen
    }
  };

  if (recoveryCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-4">
              <div className="badge-logo w-10 h-10 flex items-center justify-center shrink-0">
                <span className="font-display text-xl font-bold text-white">L</span>
              </div>
              <span className="font-display text-2xl font-bold text-ink">LedgerGueh</span>
            </div>
            <h1 className="font-display text-2xl font-medium text-ink">Save your recovery code</h1>
            <p className="text-slate mt-2 text-sm">
              There's no email on this account, so this code is the only way back in if you forget your password.
              It's shown once — save it somewhere safe now.
            </p>
          </div>

          <div className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-4">
            <div className="bg-paper-dim border border-line rounded-xl px-4 py-4 text-center">
              <p className="font-mono mono-num text-xl font-bold text-ink tracking-wider select-all">{recoveryCode}</p>
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="w-full border border-line text-ink font-semibold rounded-xl py-2 text-sm hover:bg-paper-dim transition-colors"
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>

            <label className="flex items-start gap-2.5 text-sm text-ink pt-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              I've saved this recovery code somewhere safe.
            </label>

            <button
              type="button"
              disabled={!confirmed}
              onClick={refresh}
              className="w-full bg-primary text-white font-semibold rounded-xl py-2.5 shadow-md shadow-primary/30 hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              Continue to LedgerGueh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="badge-logo w-10 h-10 flex items-center justify-center shrink-0">
              <span className="font-display text-xl font-bold text-white">L</span>
            </div>
            <span className="font-display text-2xl font-bold text-ink">LedgerGueh</span>
          </div>
          <h1 className="font-display text-2xl font-medium text-ink">Set up your ledger</h1>
          <p className="text-slate mt-2 text-sm">
            This creates the one account for this ledger. Registration closes after this step.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Username</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. budi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Confirm password</label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
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
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
