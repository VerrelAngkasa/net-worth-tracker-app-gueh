import { useEffect, useState } from 'react';
import api, { monthBounds } from '../lib/api';
import Money from '../components/Money';
import MonthSwitcher from '../components/MonthSwitcher';
import { useMonth } from '../lib/useMonth';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Transfers() {
  const { year, month, shift, isCurrentMonth } = useMonth();
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ date: todayISO(), fromAssetId: '', toAssetId: '', description: '', amount: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    const { start, end } = monthBounds(year, month);
    Promise.all([api.get('/transfers', { params: { from: start, to: end } }), api.get('/assets')]).then(
      ([t, a]) => {
        setTransfers(t.data);
        setAssets(a.data);
        setLoading(false);
        setForm((f) => ({
          ...f,
          fromAssetId: f.fromAssetId || a.data[0]?.id || '',
          toAssetId: f.toAssetId || a.data[1]?.id || '',
        }));
      }
    );
  };

  useEffect(load, [year, month]);

  useEffect(() => {
    const { start } = monthBounds(year, month);
    setForm((f) => ({ ...f, date: isCurrentMonth ? todayISO() : start }));
  }, [year, month, isCurrentMonth]);

  const assetName = (id) => assets.find((a) => a.id === id)?.name || '—';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.fromAssetId || !form.toAssetId) {
      setError('Choose both pockets.');
      return;
    }
    if (form.fromAssetId === form.toAssetId) {
      setError('Choose two different pockets.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/transfers', { ...form, amount: Number(form.amount) });
      setForm({ ...form, description: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    await api.delete(`/transfers/${id}`);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Transfers</h1>
          <p className="text-slate mt-1">Move money between pockets — e.g. topping up your Emergency Fund from Payroll.</p>
        </div>
        <MonthSwitcher year={year} month={month} onShift={shift} />
      </div>

      {assets.length < 2 ? (
        <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
          You need at least two pockets on the Assets page to make a transfer.
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
            <label className="block text-xs font-medium text-ink mb-1">From</label>
            <select
              value={form.fromAssetId}
              onChange={(e) => setForm({ ...form, fromAssetId: e.target.value })}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-ink mb-1">To</label>
            <select
              value={form.toAssetId}
              onChange={(e) => setForm({ ...form, toAssetId: e.target.value })}
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
            <label className="block text-xs font-medium text-ink mb-1">Note</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional, e.g. 'This month savings'"
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="sm:col-span-6">
            {error && <p className="text-clay text-sm mb-2">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              Move money
            </button>
          </div>
        </form>
      )}

      <div>
        <h2 className="font-display text-lg font-bold text-ink mb-3">History</h2>
        {loading ? (
          <p className="text-slate text-sm">Loading…</p>
        ) : transfers.length === 0 ? (
          <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
            No transfers this month.
          </p>
        ) : (
          <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ledger-rule-single text-left text-xs uppercase tracking-wider text-slate">
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Date</th>
                    <th className="px-4 py-2.5 font-medium whitespace-nowrap">Route</th>
                    <th className="px-4 py-2.5 font-medium">Note</th>
                    <th className="px-4 py-2.5 font-medium text-right whitespace-nowrap">Amount</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id} className="border-t border-line/70 hover:bg-paper-dim/50">
                      <td className="px-4 py-2.5 text-ink whitespace-nowrap">{t.date}</td>
                      <td className="px-4 py-2.5 text-ink whitespace-nowrap">
                        <span className="font-medium">{assetName(t.from_asset_id)}</span>
                        <span className="text-primary mx-1.5">→</span>
                        <span className="font-medium">{assetName(t.to_asset_id)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate">{t.description || '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono mono-num text-ink whitespace-nowrap">
                        <Money value={t.amount} />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button onClick={() => onDelete(t.id)} className="text-clay text-xs font-medium hover:underline">
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
