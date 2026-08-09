const express = require('express');
const { query, queryOne, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { adjustBalance } = require('../utils/pockets');

const router = express.Router();
router.use(requireAuth);

async function ownsAsset(userId, assetId) {
  if (!assetId) return true;
  return !!(await queryOne('SELECT id FROM assets WHERE id = ? AND user_id = ?', [assetId, userId]));
}

// List fixed expenses, optionally filtered by from/to date and category.
// Each row is an independent entry for one specific month — there is no
// recurring "rule" behind it, so editing or deleting one never touches
// any other month's entries, even if the name/amount happen to match.
router.get('/', async (req, res) => {
  const { from, to, category, assetId } = req.query;
  let sql = 'SELECT * FROM fixed_expenses WHERE user_id = ?';
  const params = [req.userId];

  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (assetId) {
    sql += ' AND asset_id = ?';
    params.push(assetId);
  }
  sql += ' ORDER BY date DESC, id DESC';

  const rows = await query(sql, params);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { date, category, name, amount, assetId } = req.body || {};
  if (!date || !category || !name || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'date, category, name and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  if (assetId && !(await ownsAsset(req.userId, assetId))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const row = await queryOne(
    `INSERT INTO fixed_expenses (user_id, asset_id, date, category, name, amount)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [req.userId, assetId || null, date, category, name, amt]
  );

  if (assetId) await adjustBalance(assetId, -amt, date);

  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!existing) return res.status(404).json({ error: 'Fixed expense not found.' });

  const { date, category, name, amount, assetId } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const nextAssetId = assetId !== undefined ? assetId || null : existing.asset_id;
  if (nextAssetId && !(await ownsAsset(req.userId, nextAssetId))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }
  const nextDate = date || existing.date;

  // Same fix as Daily Expenses: only touch a pocket balance if the pocket or
  // amount actually changed, and prefer a single net-delta write over a
  // reverse-then-reapply pair when the pocket stays the same.
  const amountChanged = amt !== existing.amount;
  const assetChanged = nextAssetId !== existing.asset_id;

  if (assetChanged) {
    if (existing.asset_id) await adjustBalance(existing.asset_id, existing.amount, nextDate);
    if (nextAssetId) await adjustBalance(nextAssetId, -amt, nextDate);
  } else if (nextAssetId && amountChanged) {
    const delta = existing.amount - amt;
    if (delta !== 0) await adjustBalance(nextAssetId, delta, nextDate);
  }

  const row = await queryOne(
    'UPDATE fixed_expenses SET date = ?, category = ?, name = ?, amount = ?, asset_id = ? WHERE id = ? RETURNING *',
    [nextDate, category || existing.category, name || existing.name, amt, nextAssetId, req.params.id]
  );

  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!existing) return res.status(404).json({ error: 'Fixed expense not found.' });

  if (existing.asset_id) {
    await adjustBalance(existing.asset_id, existing.amount, new Date().toISOString().slice(0, 10));
  }

  await run('DELETE FROM fixed_expenses WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Distinct categories/names used so far, to power suggestion lists in the UI
router.get('/meta/categories', async (req, res) => {
  const rows = await query('SELECT DISTINCT category FROM fixed_expenses WHERE user_id = ? ORDER BY category', [
    req.userId,
  ]);
  res.json(rows.map((r) => r.category));
});

router.get('/meta/names', async (req, res) => {
  const rows = await query('SELECT DISTINCT name FROM fixed_expenses WHERE user_id = ? ORDER BY name', [
    req.userId,
  ]);
  res.json(rows.map((r) => r.name));
});

// Convenience for recurring bills (rent, subscriptions) without baking a
// "rule" back into the data model: copies every fixed expense dated in
// fromYear/fromMonth into toYear/toMonth, keeping the same day-of-month
// where possible, and creates a fresh independent entry for each — so the
// new month's entries can be edited or deleted without affecting the old
// month at all. Pocket balances are deducted for the new entries exactly
// as if you'd added them one by one.
router.post('/duplicate', async (req, res) => {
  const { fromYear, fromMonth, toYear, toMonth } = req.body || {};
  if (!fromYear || !fromMonth || !toYear || !toMonth) {
    return res.status(400).json({ error: 'fromYear, fromMonth, toYear and toMonth are required.' });
  }

  const source = await query(
    `SELECT * FROM fixed_expenses
     WHERE user_id = ? AND EXTRACT(YEAR FROM date) = ? AND EXTRACT(MONTH FROM date) = ?
     ORDER BY date, id`,
    [req.userId, fromYear, fromMonth]
  );
  if (source.length === 0) {
    return res.json({ created: [] });
  }

  const lastDayOfTargetMonth = new Date(Date.UTC(toYear, toMonth, 0)).getUTCDate();
  const created = [];
  for (const item of source) {
    const day = Math.min(Number(item.date.slice(8, 10)), lastDayOfTargetMonth);
    const newDate = `${toYear}-${String(toMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const row = await queryOne(
      `INSERT INTO fixed_expenses (user_id, asset_id, date, category, name, amount)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [req.userId, item.asset_id, newDate, item.category, item.name, item.amount]
    );
    if (item.asset_id) await adjustBalance(item.asset_id, -item.amount, newDate);
    created.push(row);
  }

  res.status(201).json({ created });
});

module.exports = router;
