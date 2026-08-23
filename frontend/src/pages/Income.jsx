import { useEffect, useState } from 'react';
import api from '../lib/api';
import Money from '../components/Money';

const todayISO = () => new Date().toISOString().slice(0, 10);
const SOURCE_SUGGESTIONS = ['Salary', 'Bonus', 'Gift', 'Interest', 'Refund', 'Side income', 'Other'];

export default function Income() {
  const [entries, setEntries] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    date: todayISO(),
    assetId: '',
    source: SOURCE_SUGGESTIONS[0],
    description: '',
    amount: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/income'), api.get('/assets')]).then(([i, a]) => {
      setEntries(i.data);
      setAssets(a.data);
      setLoading(false);
      setForm((f) => ({ ...f, assetId: f.assetId || a.data[0]?.id || '' }));
    });
  };

  useEffect(load, []);

  const assetName = (id) => assets.find((a) => a.id === id)?.name || '—';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.assetId) {
      setError('Choose a pocket to receive this income.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/income', { ...form, amount: Number(form.amount) });
      setForm({ ...form, description: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save income.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    await api.delete(`/income/${id}`);
    load();
  };

  const total = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Income</h1>
        <p className="text-slate mt-1">Money landing in a pocket — salary, bonuses, transfers in, gifts.</p>
      </div>

      {assets.length === 0 ? (
        <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
          Add a pocket on the Assets page first, then come back to log income into it.
        </p>
      ) : (
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
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-ink mb-1">Into pocket</label>
            <select
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-ink mb-1">Source</label>
            <input
              type="text"
              list="income-sources"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <datalist id="income-sources">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-ink mb-1">Note</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
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
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              Add income
            </button>
          </div>
        </form>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold text-ink">Entries</h2>
          <p className="text-sm text-slate">
            Total: <Money value={total} className="font-mono mono-num text-ledger font-semibold" />
          </p>
        </div>

        {loading ? (
          <p className="text-slate text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
            No income logged yet.
          </p>
        ) : (
          <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ledger-rule-single text-left text-xs uppercase tracking-wider text-slate">
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Pocket</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Source</th>
                    <th className="px-4 py-2.5 font-medium">Note</th>
                    <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-line/70 hover:bg-paper-dim/50">
                      <td className="px-4 py-2.5 text-ink whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-2.5 text-ink font-medium whitespace-nowrap">{assetName(e.asset_id)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs bg-ledger-light text-ledger px-2 py-0.5 rounded-full">{e.source}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate">{e.description || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono mono-num text-ledger whitespace-nowrap">
                        <Money value={e.amount} prefix="+" />
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
