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

// List expenses, optionally filtered by from/to date and category
router.get('/', async (req, res) => {
  const { from, to, category, assetId } = req.query;
  let sql = 'SELECT * FROM expenses WHERE user_id = ?';
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
  const { date, category, description, amount, assetId } = req.body || {};
  if (!date || !category || amount === undefined || amount === null) {
    return res.status(400).json({ error: 'date, category and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  if (assetId && !(await ownsAsset(req.userId, assetId))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const row = await queryOne(
    `INSERT INTO expenses (user_id, asset_id, date, category, description, amount)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [req.userId, assetId || null, date, category, description || null, amt]
  );

  if (assetId) await adjustBalance(assetId, -amt, date);

  res.status(201).json(row);
});

router.put('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Expense not found.' });

  const { date, category, description, amount, assetId } = req.body || {};
  const amt = amount !== undefined ? Number(amount) : existing.amount;
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const nextAssetId = assetId !== undefined ? assetId || null : existing.asset_id;
  if (nextAssetId && !(await ownsAsset(req.userId, nextAssetId))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }
  const nextDate = date || existing.date;

  // Only touch pocket balances if something that actually affects them changed.
  // Writing a snapshot on every edit (even unrelated fields like description)
  // was creating noisy, misleading history entries.
  const amountChanged = amt !== existing.amount;
  const assetChanged = nextAssetId !== existing.asset_id;

  if (assetChanged) {
    // Moving between two different pockets (or into/out of "no pocket") —
    // these are genuinely two separate balances, so both need a write.
    if (existing.asset_id) await adjustBalance(existing.asset_id, existing.amount, nextDate);
    if (nextAssetId) await adjustBalance(nextAssetId, -amt, nextDate);
  } else if (nextAssetId && amountChanged) {
    // Same pocket throughout — apply the difference in a single write instead
    // of reversing the old amount and re-applying the new one as two writes.
    const delta = existing.amount - amt;
    if (delta !== 0) await adjustBalance(nextAssetId, delta, nextDate);
  }

  const row = await queryOne(
    'UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, asset_id = ? WHERE id = ? RETURNING *',
    [nextDate, category || existing.category, description !== undefined ? description : existing.description, amt, nextAssetId, req.params.id]
  );

  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Expense not found.' });

  if (existing.asset_id) {
    await adjustBalance(existing.asset_id, existing.amount, new Date().toISOString().slice(0, 10));
  }

  await run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// Distinct categories used so far, to power a suggestions list in the UI
router.get('/meta/categories', async (req, res) => {
  const rows = await query('SELECT DISTINCT category FROM expenses WHERE user_id = ? ORDER BY category', [req.userId]);
  res.json(rows.map((r) => r.category));
});

module.exports = router;
