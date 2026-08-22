import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';

export default function ResetPassword() {
  const [form, setForm] = useState({ username: '', recoveryCode: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newRecoveryCode, setNewRecoveryCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/reset-password', {
        username: form.username,
        recoveryCode: form.recoveryCode,
        newPassword: form.newPassword,
      });
      setNewRecoveryCode(res.data.recoveryCode);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your password.');
    } finally {
      setSubmitting(false);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(newRecoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable — the code is still selectable on screen
    }
  };

  if (newRecoveryCode) {
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
            <h1 className="font-display text-2xl font-medium text-ink">Password reset</h1>
            <p className="text-slate mt-2 text-sm">
              Your password is updated. That old recovery code is now spent — here's a new one. Save it somewhere
              safe.
            </p>
          </div>

          <div className="bg-card border border-line rounded-2xl p-6 shadow-sm space-y-4">
            <div className="bg-paper-dim border border-line rounded-xl px-4 py-4 text-center">
              <p className="font-mono mono-num text-xl font-bold text-ink tracking-wider select-all">
                {newRecoveryCode}
              </p>
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="w-full border border-line text-ink font-semibold rounded-xl py-2 text-sm hover:bg-paper-dim transition-colors"
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
            <Link
              to="/"
              className="block w-full text-center bg-primary text-white font-semibold rounded-xl py-2.5 shadow-md shadow-primary/30 hover:bg-primary-dark transition-colors"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="font-display text-2xl font-medium text-ink">Reset your password</h1>
          <p className="text-slate mt-2 text-sm">Enter your username and the recovery code you saved at setup.</p>
        </div>

        <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Username</label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Recovery code</label>
            <input
              type="text"
              required
              value={form.recoveryCode}
              onChange={(e) => setForm({ ...form, recoveryCode: e.target.value })}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">New password</label>
            <input
              type="password"
              required
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="w-full border border-line rounded-xl px-3 py-2 bg-paper focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Confirm new password</label>
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
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="text-center text-sm text-slate mt-4">
          <Link to="/" className="text-primary font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
