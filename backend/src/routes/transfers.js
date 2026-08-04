const express = require('express');
const { query, queryOne, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { adjustBalance } = require('../utils/pockets');

const router = express.Router();
router.use(requireAuth);

async function ownsAsset(userId, assetId) {
  return !!(await queryOne('SELECT id FROM assets WHERE id = ? AND user_id = ?', [assetId, userId]));
}

router.get('/', async (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM transfers WHERE user_id = ?';
  const params = [req.userId];
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(await query(sql, params));
});

router.post('/', async (req, res) => {
  const { date, fromAssetId, toAssetId, description, amount } = req.body || {};
  if (!date || !fromAssetId || !toAssetId || amount === undefined) {
    return res.status(400).json({ error: 'date, fromAssetId, toAssetId and amount are required.' });
  }
  if (String(fromAssetId) === String(toAssetId)) {
    return res.status(400).json({ error: 'Choose two different pockets.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }
  if (!(await ownsAsset(req.userId, fromAssetId)) || !(await ownsAsset(req.userId, toAssetId))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const row = await queryOne(
    `INSERT INTO transfers (user_id, from_asset_id, to_asset_id, date, description, amount)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [req.userId, fromAssetId, toAssetId, date, description || null, amt]
  );

  await adjustBalance(fromAssetId, -amt, date);
  await adjustBalance(toAssetId, amt, date);

  res.status(201).json(row);
});

router.delete('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM transfers WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!existing) return res.status(404).json({ error: 'Transfer not found.' });

  const today = new Date().toISOString().slice(0, 10);
  await adjustBalance(existing.from_asset_id, existing.amount, today);
  await adjustBalance(existing.to_asset_id, -existing.amount, today);

  await run('DELETE FROM transfers WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
