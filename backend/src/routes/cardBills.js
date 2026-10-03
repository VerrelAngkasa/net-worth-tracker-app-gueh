const express = require('express');
const { query, queryOne, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { adjustBalance } = require('../utils/pockets');
const { todayISO } = require('../utils/dates');

const router = express.Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONTHS = 120;

async function ownsAsset(userId, assetId) {
  if (!assetId) return true;
  return !!(await queryOne('SELECT id FROM assets WHERE id = ? AND user_id = ?', [assetId, userId]));
}

// YYYY-MM-DD plus n months, clamping the day so e.g. Jan 31 + 1 month is Feb 28/29.
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Everything below "left to pay" is derived from the payments on file rather
// than stored, so adding or deleting a payment can never leave the two out of sync.
function decorate(row) {
  const { paid, payment_count, ...bill } = row;
  const remaining = Math.max(round2(bill.total_amount - paid), 0);
  const paidOff = remaining === 0;
  const installmentsPaid = paidOff
    ? bill.installment_months
    : Math.min(bill.installment_months, Math.floor(paid / bill.monthly_amount + 1e-9));
  const nextDueDate = paidOff ? null : addMonths(bill.start_date, installmentsPaid);
  return {
    ...bill,
    paid,
    paymentCount: payment_count,
    remaining,
    paidOff,
    installmentsPaid,
    installmentsLeft: bill.installment_months - installmentsPaid,
    nextDueDate,
    nextDueAmount: paidOff ? 0 : Math.min(bill.monthly_amount, remaining),
    overdue: !paidOff && nextDueDate < todayISO(),
  };
}

const SELECT_BILLS = `
  SELECT b.*, COALESCE(p.paid, 0) AS paid, COALESCE(p.payment_count, 0) AS payment_count
  FROM card_bills b
  LEFT JOIN (
    SELECT bill_id, SUM(amount) AS paid, COUNT(*) AS payment_count
    FROM card_bill_payments GROUP BY bill_id
  ) p ON p.bill_id = b.id
  WHERE b.user_id = ?`;

async function getBill(userId, id) {
  const row = await queryOne(`${SELECT_BILLS} AND b.id = ?`, [userId, id]);
  return row ? decorate(row) : null;
}

// Shared by create and edit. Returns { error } or { values }.
function validateBill(body, fallback = {}) {
  const cardName = String(body.cardName ?? fallback.card_name ?? '').trim();
  const name = String(body.name ?? fallback.name ?? '').trim();
  const total = Number(body.totalAmount ?? fallback.total_amount);
  const months = Number(body.installmentMonths ?? fallback.installment_months ?? 1);
  const startDate = body.startDate ?? fallback.start_date;
  const notes = body.notes !== undefined ? String(body.notes).trim() || null : fallback.notes ?? null;

  if (!cardName || !name) return { error: 'cardName and name are required.' };
  if (!Number.isFinite(total) || total <= 0) return { error: 'totalAmount must be greater than zero.' };
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) {
    return { error: `installmentMonths must be a whole number from 1 to ${MAX_MONTHS}.` };
  }
  if (!startDate || !DATE_RE.test(startDate)) return { error: 'startDate is required (YYYY-MM-DD).' };

  // A blank monthly amount means "split evenly", rounded up so the final
  // installment is the (smaller) remainder. Editing only other fields (say,
  // notes) keeps the monthly amount already on file.
  const monthlyGiven = body.monthlyAmount !== undefined && body.monthlyAmount !== null && body.monthlyAmount !== '';
  const changesSchedule = body.totalAmount !== undefined || body.installmentMonths !== undefined;
  let monthly;
  if (monthlyGiven) monthly = Number(body.monthlyAmount);
  else if (fallback.monthly_amount !== undefined && !changesSchedule) monthly = fallback.monthly_amount;
  else monthly = Math.ceil(total / months);
  if (!Number.isFinite(monthly) || monthly <= 0) return { error: 'monthlyAmount must be greater than zero.' };
  if (monthly > total) return { error: "monthlyAmount can't be more than the total." };

  return { values: { cardName, name, total, months, monthly, startDate, notes } };
}

router.get('/', async (req, res) => {
  // Active bills first, paid-off ones after, newest first within each group.
  const rows = await query(
    `${SELECT_BILLS} ORDER BY (COALESCE(p.paid, 0) >= b.total_amount), b.start_date DESC, b.id DESC`,
    [req.userId]
  );
  res.json(rows.map(decorate));
});

router.post('/', async (req, res) => {
  const { error, values } = validateBill(req.body || {});
  if (error) return res.status(400).json({ error });

  const created = await queryOne(
    `INSERT INTO card_bills (user_id, card_name, name, total_amount, installment_months, monthly_amount, start_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [req.userId, values.cardName, values.name, values.total, values.months, values.monthly, values.startDate, values.notes]
  );
  res.status(201).json(await getBill(req.userId, created.id));
});

router.put('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM card_bills WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Bill not found.' });

  const { error, values } = validateBill(req.body || {}, existing);
  if (error) return res.status(400).json({ error });

  await run(
    `UPDATE card_bills SET card_name = ?, name = ?, total_amount = ?, installment_months = ?,
       monthly_amount = ?, start_date = ?, notes = ? WHERE id = ?`,
    [values.cardName, values.name, values.total, values.months, values.monthly, values.startDate, values.notes, req.params.id]
  );
  res.json(await getBill(req.userId, req.params.id));
});

// Deleting a bill also undoes its payments' effect on pocket balances, the same
// way deleting an expense hands its money back — otherwise the balances would
// stay reduced by payments that no longer exist anywhere.
router.delete('/:id', async (req, res) => {
  const existing = await queryOne('SELECT id FROM card_bills WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Bill not found.' });

  const payments = await query('SELECT asset_id, amount FROM card_bill_payments WHERE bill_id = ? AND asset_id IS NOT NULL', [
    req.params.id,
  ]);
  const today = todayISO();
  for (const p of payments) await adjustBalance(p.asset_id, p.amount, today);

  await run('DELETE FROM card_bills WHERE id = ?', [req.params.id]);
  res.json({ ok: true, refundedPayments: payments.length });
});

router.get('/:id/payments', async (req, res) => {
  const bill = await queryOne('SELECT id FROM card_bills WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!bill) return res.status(404).json({ error: 'Bill not found.' });
  res.json(await query('SELECT * FROM card_bill_payments WHERE bill_id = ? ORDER BY date DESC, id DESC', [req.params.id]));
});

// Paying a bill lowers what's left on it and, if a pocket is chosen, deducts that
// pocket like any other expense. It deliberately does not touch the spending quota.
router.post('/:id/payments', async (req, res) => {
  const bill = await getBill(req.userId, req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found.' });

  const { date, amount, assetId } = req.body || {};
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ error: 'date is required (YYYY-MM-DD).' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be greater than zero.' });
  if (amt > bill.remaining + 0.005) {
    return res
      .status(400)
      .json({ error: `Only Rp ${bill.remaining.toLocaleString('id-ID')} is left to pay on this bill.` });
  }
  if (assetId && !(await ownsAsset(req.userId, assetId))) return res.status(400).json({ error: 'Pocket not found.' });

  const payment = await queryOne(
    'INSERT INTO card_bill_payments (user_id, bill_id, asset_id, date, amount) VALUES (?, ?, ?, ?, ?) RETURNING *',
    [req.userId, req.params.id, assetId || null, date, amt]
  );
  if (assetId) await adjustBalance(assetId, -amt, date);

  res.status(201).json(payment);
});

router.delete('/:id/payments/:paymentId', async (req, res) => {
  const payment = await queryOne(
    'SELECT * FROM card_bill_payments WHERE id = ? AND bill_id = ? AND user_id = ?',
    [req.params.paymentId, req.params.id, req.userId]
  );
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });

  if (payment.asset_id) await adjustBalance(payment.asset_id, payment.amount, todayISO());
  await run('DELETE FROM card_bill_payments WHERE id = ?', [req.params.paymentId]);
  res.json({ ok: true });
});

module.exports = router;
