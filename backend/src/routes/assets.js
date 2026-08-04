const express = require('express');
const { query, queryOne, run } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function latestValueForAsset(assetId) {
  // Insertion order (id), not date order — see utils/pockets.js for why.
  const row = await queryOne('SELECT value, date FROM asset_values WHERE asset_id = ? ORDER BY id DESC LIMIT 1', [
    assetId,
  ]);
  return row ? row.value : 0;
}

// List assets with their current (latest) value and share of total assets attached
router.get('/', async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  let sql = 'SELECT * FROM assets WHERE user_id = ?';
  if (!includeArchived) sql += ' AND archived = false';
  sql += ' ORDER BY type, name';

  const assets = await query(sql, [req.userId]);
  const withValues = await Promise.all(
    assets.map(async (a) => ({ ...a, currentValue: await latestValueForAsset(a.id) }))
  );

  // Percentage is of total *positive* value (liabilities shown as negative, excluded from the base)
  const totalPositive = withValues.reduce((s, a) => s + (a.currentValue > 0 ? a.currentValue : 0), 0);
  const withPercentage = withValues.map((a) => ({
    ...a,
    percentage: totalPositive > 0 && a.currentValue > 0 ? (a.currentValue / totalPositive) * 100 : 0,
  }));

  res.json(withPercentage);
});

router.post('/', async (req, res) => {
  const { name, type, notes, initialValue, date } = req.body || {};
  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required.' });
  }

  const asset = await queryOne(
    'INSERT INTO assets (user_id, name, type, notes) VALUES (?, ?, ?, ?) RETURNING *',
    [req.userId, name, type, notes || null]
  );

  if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
    const val = Number(initialValue);
    if (!Number.isNaN(val)) {
      await run('INSERT INTO asset_values (asset_id, date, value) VALUES (?, ?, ?)', [
        asset.id,
        date || new Date().toISOString().slice(0, 10),
        val,
      ]);
    }
  }

  res.status(201).json({ ...asset, currentValue: await latestValueForAsset(asset.id) });
});

router.put('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Asset not found.' });

  const { name, type, notes, archived } = req.body || {};
  const row = await queryOne(
    'UPDATE assets SET name = ?, type = ?, notes = ?, archived = ? WHERE id = ? RETURNING *',
    [
      name || existing.name,
      type || existing.type,
      notes !== undefined ? notes : existing.notes,
      archived !== undefined ? !!archived : existing.archived,
      req.params.id,
    ]
  );

  res.json({ ...row, currentValue: await latestValueForAsset(row.id) });
});

router.delete('/:id', async (req, res) => {
  const existing = await queryOne('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Asset not found.' });
  await run('DELETE FROM assets WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// --- Value history for one asset ---

router.get('/:id/values', async (req, res) => {
  const asset = await queryOne('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  // Insertion order (id), not date order — the frontend marks the last item
  // in this list as "current," which must match how the balance is actually
  // computed (see utils/pockets.js) or a backdated entry could get the badge
  // even though a later entry is the true current balance.
  const rows = await query('SELECT * FROM asset_values WHERE asset_id = ? ORDER BY id ASC', [req.params.id]);
  res.json(rows);
});

router.post('/:id/values', async (req, res) => {
  const asset = await queryOne('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  const { date, value } = req.body || {};
  const val = Number(value);
  if (!date || Number.isNaN(val)) {
    return res.status(400).json({ error: 'date and numeric value are required.' });
  }

  const row = await queryOne('INSERT INTO asset_values (asset_id, date, value) VALUES (?, ?, ?) RETURNING *', [
    req.params.id,
    date,
    val,
  ]);
  res.status(201).json(row);
});

router.delete('/:id/values/:valueId', async (req, res) => {
  const asset = await queryOne('SELECT * FROM assets WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!asset) return res.status(404).json({ error: 'Asset not found.' });

  const value = await queryOne('SELECT * FROM asset_values WHERE id = ? AND asset_id = ?', [
    req.params.valueId,
    req.params.id,
  ]);
  if (!value) return res.status(404).json({ error: 'Value entry not found.' });

  await run('DELETE FROM asset_values WHERE id = ?', [req.params.valueId]);
  res.json({ ok: true });
});

module.exports = router;
