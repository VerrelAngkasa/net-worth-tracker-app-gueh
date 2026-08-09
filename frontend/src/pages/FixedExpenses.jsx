import { useEffect, useState } from 'react';
import api, { EXPENSE_CATEGORIES } from '../lib/api';
import Money from '../components/Money';

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

export default function FixedExpenses() {
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: todayISO(),
    category: EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 2], // Bills & Utilities
    name: '',
    amount: '',
    assetId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/fixed-expenses'), api.get('/assets')]).then(([f, a]) => {
      setItems(f.data);
      setAssets(a.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const assetName = (id) => assets.find((a) => a.id === id)?.name;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.amount || Number(form.amount) < 0) {
      setError('Enter a name and a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/fixed-expenses', { ...form, amount: Number(form.amount), assetId: form.assetId || null });
      setForm({ ...form, name: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    await api.delete(`/fixed-expenses/${id}`);
    load();
  };

  const onDuplicateLastMonth = async () => {
    setDuplicateMsg('');
    setDuplicating(true);
    try {
      const { year, month } = thisMonth();
      const prevTotal = year * 12 + (month - 1) - 1;
      const fromYear = Math.floor(prevTotal / 12);
      const fromMonth = (prevTotal % 12) + 1;
      const res = await api.post('/fixed-expenses/duplicate', { fromYear, fromMonth, toYear: year, toMonth: month });
      setDuplicateMsg(
        res.data.created.length === 0
          ? "No fixed expenses found in last month to copy."
          : `Copied ${res.data.created.length} item${res.data.created.length === 1 ? '' : 's'} from last month.`
      );
      load();
    } catch (err) {
      setDuplicateMsg(err.response?.data?.error || 'Could not duplicate last month.');
    } finally {
      setDuplicating(false);
    }
  };

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Fixed monthly expenses</h1>
          <p className="text-slate mt-1">
            Rent, subscriptions, insurance — bills you pay each month. Each entry belongs to one specific month, so
            editing or deleting this month's rent never touches last month's.
          </p>
        </div>
        <div className="text-right">
          <button
            onClick={onDuplicateLastMonth}
            disabled={duplicating}
            className="border border-line text-ink font-semibold rounded-xl px-4 py-2 text-sm hover:bg-paper-dim transition-colors disabled:opacity-60"
          >
            {duplicating ? 'Copying…' : 'Copy last month\u2019s bills to this month'}
          </button>
          {duplicateMsg && <p className="text-xs text-slate mt-1.5">{duplicateMsg}</p>}
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl shadow-sm p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Rent"
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
          <label className="block text-xs font-medium text-ink mb-1">Date</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
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
        <div className="sm:col-span-6">
          {error && <p className="text-clay text-sm mb-2">{error}</p>}
          <p className="text-xs text-slate mb-2">
            Pick a pocket to deduct this bill from that account's balance right away, same as a daily expense — it
            just won't count against your spending quota.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            Add fixed expense
          </button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-medium text-ink">Entries</h2>
          <p className="text-sm text-slate">
            Total: <Money value={total} className="font-mono mono-num text-ink font-semibold" />
          </p>
        </div>

        {loading ? (
          <p className="text-slate text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
            No fixed expenses yet. Add rent, subscriptions, or bills above.
          </p>
        ) : (
          <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="ledger-rule-single text-left text-xs uppercase tracking-wider text-slate">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Pocket</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-line/70 hover:bg-paper-dim/50">
                    <td className="px-4 py-2.5 text-ink">{i.date}</td>
                    <td className="px-4 py-2.5 text-ink font-medium">{i.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-paper-dim px-2 py-0.5 rounded-full text-ink">{i.category}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate text-xs">{assetName(i.asset_id) || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono mono-num text-ink">
                      <Money value={i.amount} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => onDelete(i.id)} className="text-clay text-xs font-medium hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
