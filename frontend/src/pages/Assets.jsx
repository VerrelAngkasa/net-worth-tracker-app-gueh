import { useEffect, useState } from 'react';
import api, { percent, ASSET_TYPES } from '../lib/api';
import Money from '../components/Money';
import { usePrivacy } from '../context/PrivacyContext';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'bank', notes: '', initialValue: '', date: todayISO() });
  const [submitting, setSubmitting] = useState(false);
  const [updatingAsset, setUpdatingAsset] = useState(null);
  const [historyAsset, setHistoryAsset] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/assets').then((res) => {
      setAssets(res.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name) {
      setError('Give the asset a name.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/assets', form);
      setForm({ name: '', type: 'bank', notes: '', initialValue: '', date: todayISO() });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const onArchive = async (asset) => {
    await api.put(`/assets/${asset.id}`, { archived: true });
    load();
  };

  const totalAssets = assets.filter((a) => a.currentValue >= 0).reduce((s, a) => s + a.currentValue, 0);
  const totalLiabilities = assets.filter((a) => a.currentValue < 0).reduce((s, a) => s + Math.abs(a.currentValue), 0);

  const grouped = ASSET_TYPES.map((t) => ({
    ...t,
    items: assets.filter((a) => a.type === t.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">Assets &amp; pockets</h1>
        <p className="text-slate mt-1">Track what you own and owe. Update values whenever a balance changes.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4 min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Total assets</p>
          <Money value={totalAssets} className="font-mono mono-num text-2xl font-bold text-ledger" />
        </div>
        <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4 min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Total liabilities</p>
          <Money value={totalLiabilities} className="font-mono mono-num text-2xl font-bold text-clay" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl shadow-sm p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Emergency Fund"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Value</label>
          <input
            type="number"
            value={form.initialValue}
            onChange={(e) => setForm({ ...form, initialValue: e.target.value })}
            placeholder="0"
            title="Use a negative number for liabilities like loans"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">As of</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-6">
          {error && <p className="text-clay text-sm mb-2">{error}</p>}
          <p className="text-xs text-slate mb-2">Tip: enter a negative value for liabilities like loans or credit card debt.</p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            Add asset
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-slate text-sm">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
          No assets yet. Add a bank account, cash, or investment above.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.value}>
              <h3 className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">{g.label}</h3>
              <div className="bg-card border border-line rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {g.items.map((a) => (
                        <tr key={a.id} className="border-t border-line/70 first:border-t-0 hover:bg-paper-dim/50">
                          <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{a.name}</td>
                          <td className="px-4 py-3 text-slate">{a.notes}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {a.currentValue >= 0 && (
                              <span className="text-xs text-slate font-mono mono-num mr-2">{percent(a.percentage)}</span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono mono-num font-semibold whitespace-nowrap ${
                              a.currentValue < 0 ? 'text-clay' : 'text-ink'
                            }`}
                          >
                            <Money value={a.currentValue} />
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setHistoryAsset(a)}
                              className="text-ink text-xs font-medium hover:underline mr-3"
                            >
                              History
                            </button>
                            <button
                              onClick={() => setUpdatingAsset(a)}
                              className="text-primary text-xs font-medium hover:underline mr-3"
                            >
                              Update value
                            </button>
                            <button onClick={() => onArchive(a)} className="text-clay text-xs font-medium hover:underline">
                              Archive
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {updatingAsset && (
        <UpdateValueModal
          asset={updatingAsset}
          onClose={() => setUpdatingAsset(null)}
          onSaved={() => {
            setUpdatingAsset(null);
            load();
          }}
        />
      )}

      {historyAsset && (
        <HistoryModal
          asset={historyAsset}
          onClose={() => setHistoryAsset(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function UpdateValueModal({ asset, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { hidden } = usePrivacy();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (value === '' || Number.isNaN(Number(value))) {
      setError('Enter a numeric value.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/assets/${asset.id}/values`, { date, value: Number(value) });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="bg-card border border-line rounded-2xl shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-1">Update value</h3>
        <p className="text-sm text-slate mb-4">{asset.name}</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">New value</label>
            <input
              type="number"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={hidden ? '••••••' : String(asset.currentValue)}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">As of</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {error && <p className="text-clay text-sm">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-primary text-white font-semibold rounded-xl py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-line text-ink font-semibold rounded-xl py-2 text-sm hover:bg-paper-dim transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoryModal({ asset, onClose, onChanged }) {
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get(`/assets/${asset.id}/values`).then((res) => {
      setValues(res.data.slice().reverse()); // newest first
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onDeleteEntry = async (valueId) => {
    await api.delete(`/assets/${asset.id}/values/${valueId}`);
    load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="bg-card border border-line rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-1">Value history</h3>
        <p className="text-sm text-slate mb-4">
          {asset.name} — delete a mis-entered snapshot below. The most recent remaining entry becomes the current
          balance.
        </p>

        <div className="flex-1 overflow-y-auto overflow-x-auto -mx-2 px-2">
          {loading ? (
            <p className="text-slate text-sm">Loading…</p>
          ) : values.length === 0 ? (
            <p className="text-slate text-sm text-center py-6">No value history yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {values.map((v, i) => (
                  <tr key={v.id} className="border-t border-line/70 first:border-t-0">
                    <td className="py-2.5 text-ink whitespace-nowrap">{v.date}</td>
                    <td className="py-2.5 text-right font-mono mono-num text-ink whitespace-nowrap">
                      <Money value={v.value} />
                      {i === 0 && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary font-semibold">
                          current
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right pl-3 whitespace-nowrap">
                      <button
                        onClick={() => onDeleteEntry(v.id)}
                        className="text-clay text-xs font-medium hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 border border-line text-ink font-semibold rounded-xl py-2 text-sm hover:bg-paper-dim transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
