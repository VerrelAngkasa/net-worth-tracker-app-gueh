import { useEffect, useState } from 'react';
import api from '../lib/api';
import Money from '../components/Money';

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyForm = { cardName: '', name: '', totalAmount: '', installmentMonths: '1', monthlyAmount: '', startDate: todayISO(), notes: '' };

export default function CardBills() {
  const [bills, setBills] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [historyBill, setHistoryBill] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/card-bills'), api.get('/assets')]).then(([b, a]) => {
      setBills(b.data);
      setAssets(a.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.cardName.trim() || !form.name.trim()) {
      setError('Enter the card and a name for the purchase.');
      return;
    }
    if (!form.totalAmount || Number(form.totalAmount) <= 0) {
      setError('Enter a valid total amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/card-bills', {
        cardName: form.cardName.trim(),
        name: form.name.trim(),
        totalAmount: Number(form.totalAmount),
        installmentMonths: Number(form.installmentMonths) || 1,
        monthlyAmount: form.monthlyAmount === '' ? undefined : Number(form.monthlyAmount),
        startDate: form.startDate,
        notes: form.notes.trim() || null,
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id) => {
    await api.delete(`/card-bills/${id}`);
    load();
  };

  const activeBills = bills.filter((b) => !b.paidOff);
  const paidBills = bills.filter((b) => b.paidOff);
  const totalOwed = activeBills.reduce((s, b) => s + b.remaining, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Credit cards</h1>
          <p className="text-slate mt-1">Installment purchases and statements — pay them down and watch what's left drop automatically.</p>
        </div>
        <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4">
          <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Total owed</p>
          <Money value={totalOwed} className="font-mono mono-num text-2xl font-bold text-clay" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-line rounded-2xl shadow-sm p-5 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Card</label>
          <input
            type="text"
            value={form.cardName}
            onChange={(e) => setForm({ ...form, cardName: e.target.value })}
            placeholder="e.g. BCA Visa"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-ink mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. New laptop"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Total amount</label>
          <input
            type="number"
            value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            placeholder="0"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Installments</label>
          <input
            type="number"
            min="1"
            value={form.installmentMonths}
            onChange={(e) => setForm({ ...form, installmentMonths: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Monthly (optional)</label>
          <input
            type="number"
            value={form.monthlyAmount}
            onChange={(e) => setForm({ ...form, monthlyAmount: e.target.value })}
            placeholder="Auto-split"
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink mb-1">Starts</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-5">
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
          <p className="text-xs text-slate mb-2">
            Leave "Monthly" blank to split the total evenly across the installments. A one-off statement is just 1
            installment.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-white font-semibold rounded-xl px-4 py-2 text-sm shadow-md shadow-primary/25 hover:bg-primary-dark transition-colors disabled:opacity-60"
          >
            Add bill
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-slate text-sm">Loading…</p>
      ) : bills.length === 0 ? (
        <p className="text-slate text-sm bg-card border border-line rounded-2xl shadow-sm p-6 text-center">
          No credit card bills yet. Add an installment purchase or statement above.
        </p>
      ) : (
        <div className="space-y-6">
          {activeBills.length > 0 && (
            <div className="space-y-3">
              {activeBills.map((b) => (
                <BillCard key={b.id} bill={b} onPay={() => setPayingBill(b)} onHistory={() => setHistoryBill(b)} onDelete={() => onDelete(b.id)} />
              ))}
            </div>
          )}
          {paidBills.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-slate font-semibold mb-2">Paid off</h3>
              <div className="space-y-3">
                {paidBills.map((b) => (
                  <BillCard key={b.id} bill={b} onPay={() => setPayingBill(b)} onHistory={() => setHistoryBill(b)} onDelete={() => onDelete(b.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {payingBill && (
        <PayModal
          bill={payingBill}
          assets={assets}
          onClose={() => setPayingBill(null)}
          onPaid={() => {
            setPayingBill(null);
            load();
          }}
        />
      )}

      {historyBill && <HistoryModal bill={historyBill} onClose={() => setHistoryBill(null)} onChanged={load} />}
    </div>
  );
}

function BillCard({ bill, onPay, onHistory, onDelete }) {
  const pct = Math.min(100, Math.round((bill.paid / bill.total_amount) * 100));
  return (
    <div className={`bg-card border border-line rounded-2xl shadow-sm p-5 ${bill.paidOff ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate font-semibold">{bill.card_name}</p>
          <p className="font-display text-lg font-bold text-ink">{bill.name}</p>
          {bill.notes && <p className="text-xs text-slate mt-0.5">{bill.notes}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-1">
            {bill.paidOff ? 'Paid off' : 'Left to pay'}
          </p>
          <Money
            value={bill.paidOff ? bill.total_amount : bill.remaining}
            className={`font-mono mono-num text-xl font-bold ${bill.paidOff ? 'text-ledger' : 'text-clay'}`}
          />
        </div>
      </div>

      <div className="h-2 w-full bg-paper-dim rounded-full overflow-hidden mb-3">
        <div className={`h-full rounded-full ${bill.paidOff ? 'bg-ledger' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-slate">
          {bill.installmentsPaid}/{bill.installment_months} installments ·{' '}
          <Money value={bill.monthly_amount} className="font-mono mono-num" />/mo
          {!bill.paidOff && bill.nextDueDate && (
            <>
              {' '}
              · next <span className={bill.overdue ? 'text-clay font-semibold' : ''}>{bill.nextDueDate}</span>
              {bill.overdue && ' (overdue)'}
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onHistory} className="text-ink text-xs font-medium hover:underline">
            History
          </button>
          {!bill.paidOff && (
            <button onClick={onPay} className="text-primary text-xs font-semibold hover:underline">
              Record payment
            </button>
          )}
          <button onClick={onDelete} className="text-clay text-xs font-medium hover:underline">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function PayModal({ bill, assets, onClose, onPaid }) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(String(bill.nextDueAmount || bill.remaining));
  const [assetId, setAssetId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/card-bills/${bill.id}/payments`, { date, amount: amt, assetId: assetId || null });
      onPaid();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record this payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div className="bg-card border border-line rounded-2xl shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-1">Record payment</h3>
        <p className="text-sm text-slate mb-4">
          {bill.card_name} — {bill.name}
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Amount</label>
            <input
              type="number"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-slate mt-1">
              <Money value={bill.remaining} /> left on this bill.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Pay from pocket</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full border border-line rounded-xl px-2.5 py-2 bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">None (just record it)</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
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

function HistoryModal({ bill, onClose, onChanged }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get(`/card-bills/${bill.id}/payments`).then((res) => {
      setPayments(res.data);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const onDeletePayment = async (id) => {
    await api.delete(`/card-bills/${bill.id}/payments/${id}`);
    load();
    onChanged();
  };

  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center px-4 z-50" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-2xl shadow-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink mb-1">Payment history</h3>
        <p className="text-sm text-slate mb-4">
          {bill.card_name} — {bill.name}. Deleting a payment adds its amount back to the bill (and its pocket, if one
          was set).
        </p>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <p className="text-slate text-sm">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="text-slate text-sm text-center py-6">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-line/70 first:border-t-0">
                    <td className="py-2.5 text-ink whitespace-nowrap">{p.date}</td>
                    <td className="py-2.5 text-right font-mono mono-num text-ink whitespace-nowrap">
                      <Money value={p.amount} />
                    </td>
                    <td className="py-2.5 text-right pl-3 whitespace-nowrap">
                      <button onClick={() => onDeletePayment(p.id)} className="text-clay text-xs font-medium hover:underline">
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
