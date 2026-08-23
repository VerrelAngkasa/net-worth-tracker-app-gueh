import { useEffect, useState } from 'react';
import api, { EXPENSE_CATEGORIES } from '../lib/api';
import Money from '../components/Money';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: todayISO(),
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
    assetId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/expenses'), api.get('/assets')]).then(([e, a]) => {
      setExpenses(e.data);
      setAssets(a.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const assetName = (id) => assets.find((a) => a.id === id)?.name;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.amount || Number(form.amount) < 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount), assetId: form.assetId || null });
      setForm({ ...form, description: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    await api.delete(`/expenses/${id}`);
    load();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Daily expenses</h1>
        <p className="text-slate mt-1">Log the day-to-day spending — groceries, coffee, gas, whatever comes up.</p>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl shadow-sm p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Pocket</label>
          <select
            value={form.assetId}
            onChange={(e) => setForm({ ...form, assetId: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">None</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional note"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Amount</label>
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-6">
          {error && <p className="text-clay text-sm mb-2">{error}</p>}
          <p className="text-xs text-slate mb-2">
            Pick a pocket to automatically deduct this expense from that account's balance. Leave it as None to just
            log the spend without touching a pocket.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            Add expense
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-ink">Entries</h2>
          <p className="text-sm text-slate">
            Total: <Money value={total} className="font-mono mono-num text-ink font-semibold" />
          </p>
        </div>

        {loading ? (
          <p className="text-slate text-sm">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
            No expenses yet. Add your first one above.
          </p>
        ) : (
          <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ledger-rule-single text-left text-xs uppercase tracking-wider text-slate">
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Category</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Pocket</th>
                    <th className="px-4 py-2.5 font-medium">Description</th>
                    <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t border-line/70 hover:bg-paper-dim/50">
                      <td className="px-4 py-2.5 text-ink whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs bg-paper-dim px-2 py-0.5 rounded-full text-ink">{e.category}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate text-xs whitespace-nowrap">{assetName(e.asset_id) || '—'}</td>
                      <td className="px-4 py-2.5 text-slate">{e.description || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono mono-num text-ink whitespace-nowrap">
                        <Money value={e.amount} />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => onDelete(e.id)} className="text-clay text-xs font-medium hover:underline">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
