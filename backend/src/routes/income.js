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
  const { from, to, assetId } = req.query;
  let sql = 'SELECT * FROM income_entries WHERE user_id = ?';
  const params = [req.userId];
  if (from) {
    sql += ' AND date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date <= ?';
    params.push(to);
  }
  if (assetId) {
    sql += ' AND asset_id = ?';
    params.push(assetId);
  }
  sql += ' ORDER BY date DESC, id DESC';
  res.json(await query(sql, params));
});

router.post('/', async (req, res) => {
  const { date, assetId, source, description, amount } = req.body || {};
  if (!date || !assetId || !source || amount === undefined) {
    return res.status(400).json({ error: 'date, assetId, source and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }
  if (!(await ownsAsset(req.userId, assetId))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  const row = await queryOne(
    'INSERT INTO income_entries (user_id, asset_id, date, source, description, amount) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    [req.userId, assetId, date, source, description || null, amt]
  );

  await adjustBalance(assetId, amt, date);

  res.status(201).json(row);
});

router.delete('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM income_entries WHERE id = ? AND user_id = ?', [
    req.params.id,
    req.userId,
  ]);
  if (!existing) return res.status(404).json({ error: 'Income entry not found.' });

  await adjustBalance(existing.asset_id, -existing.amount, new Date().toISOString().slice(0, 10));
  await run('DELETE FROM income_entries WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/meta/sources', async (req, res) => {
  const rows = await query('SELECT DISTINCT source FROM income_entries WHERE user_id = ? ORDER BY source', [
    req.userId,
  ]);
  res.json(rows.map((r) => r.source));
});

module.exports = router;
