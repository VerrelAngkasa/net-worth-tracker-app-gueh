const express = require('express');
const { query, queryOne, run } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { monthBounds, shiftMonth, todayISO } = require('../utils/dates');

const router = express.Router();
router.use(requireAuth);

// Net worth as of a given date = sum of each asset's latest value snapshot on/before that date.
// One query for all of a user's assets (via a LATERAL join) rather than one query per asset —
// this matters a lot more once queries cross the network to a hosted Postgres instance instead
// of hitting a local SQLite file, especially since /networth-history calls this per month.
async function netWorthAsOf(userId, date) {
  const rows = await query(
    `SELECT a.id AS asset_id, COALESCE(v.value, 0) AS value
     FROM assets a
     LEFT JOIN LATERAL (
       SELECT value FROM asset_values
       WHERE asset_id = a.id AND date <= ?
       ORDER BY date DESC, id DESC
       LIMIT 1
     ) v ON true
     WHERE a.user_id = ?`,
    [date, userId]
  );
  const breakdown = rows.filter((r) => r.value !== 0).map((r) => ({ assetId: r.asset_id, value: r.value }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return { total, breakdown };
}

async function fixedExpensesForMonth(userId, monthStart, monthEnd) {
  return query('SELECT * FROM fixed_expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date', [
    userId,
    monthStart,
    monthEnd,
  ]);
}

// The quota set for this exact month, or the most recent earlier one carried forward.
async function resolveQuota(userId, year, month) {
  const row = await queryOne(
    `SELECT * FROM spending_quotas
     WHERE user_id = ? AND (year < ? OR (year = ? AND month <= ?))
     ORDER BY year DESC, month DESC LIMIT 1`,
    [userId, year, year, month]
  );
  if (!row) return null;
  return {
    amount: row.amount,
    assetId: row.asset_id || null,
    isExact: row.year === year && row.month === month,
    setFor: { year: row.year, month: row.month },
  };
}

router.get('/monthly', async (req, res) => {
  const year = Number(req.query.year) || Number(todayISO().slice(0, 4));
  const month = Number(req.query.month) || Number(todayISO().slice(5, 7));
  const { start, end } = monthBounds(year, month);
  const prev = shiftMonth(year, month, -1);
  const prevBounds = monthBounds(prev.year, prev.month);

  // These are all independent of each other, so fire them off together
  // instead of paying round-trip latency for each one in sequence.
  const [dailyExpenses, income, fixed, currentNetWorthResult, { total: previousNetWorth }, assets, quota] =
    await Promise.all([
      query('SELECT * FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date', [
        req.userId,
        start,
        end,
      ]),
      query('SELECT * FROM income_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date', [
        req.userId,
        start,
        end,
      ]),
      fixedExpensesForMonth(req.userId, start, end),
      netWorthAsOf(req.userId, end),
      netWorthAsOf(req.userId, prevBounds.end),
      query('SELECT * FROM assets WHERE user_id = ? AND archived = false', [req.userId]),
      resolveQuota(req.userId, year, month),
    ]);
  const currentNetWorth = currentNetWorthResult.total;

  const totalDaily = dailyExpenses.reduce((s, e) => s + e.amount, 0);
  const totalFixed = fixed.reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, e) => s + e.amount, 0);

  const byCategoryMap = {};
  for (const e of dailyExpenses) {
    byCategoryMap[e.category] = (byCategoryMap[e.category] || 0) + e.amount;
  }
  for (const f of fixed) {
    byCategoryMap[f.category] = (byCategoryMap[f.category] || 0) + f.amount;
  }
  const byCategory = Object.entries(byCategoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const valueByAsset = new Map();
  for (const a of currentNetWorthResult.breakdown) valueByAsset.set(a.assetId, a.value);
  const assetBreakdown = assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    value: valueByAsset.get(a.id) || 0,
  }));
  const totalPositive = assetBreakdown.reduce((s, a) => s + (a.value > 0 ? a.value : 0), 0);
  const assetBreakdownWithPct = assetBreakdown.map((a) => ({
    ...a,
    percentage: totalPositive > 0 && a.value > 0 ? (a.value / totalPositive) * 100 : 0,
  }));

  let quotaBlock = null;
  if (quota) {
    const quotaSpent = quota.assetId
      ? dailyExpenses.filter((e) => e.asset_id === quota.assetId).reduce((s, e) => s + e.amount, 0)
      : totalDaily;
    const quotaAsset = quota.assetId ? await queryOne('SELECT id, name FROM assets WHERE id = ?', [quota.assetId]) : null;
    quotaBlock = {
      amount: quota.amount,
      isExact: quota.isExact,
      setFor: quota.setFor,
      assetId: quota.assetId,
      assetName: quotaAsset ? quotaAsset.name : null,
      spent: quotaSpent,
      left: quota.amount - quotaSpent,
    };
  }

  res.json({
    year,
    month,
    range: { start, end },
    dailyExpenses,
    fixedExpenses: fixed,
    income,
    totals: {
      daily: totalDaily,
      fixed: totalFixed,
      combined: totalDaily + totalFixed,
      income: totalIncome,
      net: totalIncome - (totalDaily + totalFixed),
    },
    byCategory,
    netWorth: {
      current: currentNetWorth,
      previous: previousNetWorth,
      change: currentNetWorth - previousNetWorth,
    },
    assetBreakdown: assetBreakdownWithPct,
    quota: quotaBlock,
  });
});

// Net worth trend for the last N months (default 12), one point per month-end.
router.get('/networth-history', async (req, res) => {
  const months = Math.min(60, Math.max(1, Number(req.query.months) || 12));
  const now = new Date();

  const periods = [];
  for (let i = months - 1; i >= 0; i--) {
    const total = now.getUTCFullYear() * 12 + now.getUTCMonth() - i;
    periods.push({ year: Math.floor(total / 12), month: (total % 12) + 1 });
  }

  // One request per month, but fired concurrently instead of awaited in a loop —
  // the connection pool caps real parallelism, but this still beats N sequential round trips.
  const points = await Promise.all(
    periods.map(async ({ year, month }) => {
      const { end } = monthBounds(year, month);
      const { total: netWorth } = await netWorthAsOf(req.userId, end);
      return { year, month, date: end, netWorth };
    })
  );

  res.json(points);
});

// Quick dashboard summary
router.get('/summary', async (req, res) => {
  const today = todayISO();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const { start, end } = monthBounds(year, month);
  const prev = shiftMonth(year, month, -1);
  const prevBounds = monthBounds(prev.year, prev.month);

  const [
    { total: netWorth, breakdown },
    assets,
    monthToDateExpensesRow,
    monthToDateIncomeRow,
    fixed,
    { total: previousNetWorth },
  ] = await Promise.all([
    netWorthAsOf(req.userId, end),
    query('SELECT * FROM assets WHERE user_id = ? AND archived = false', [req.userId]),
    queryOne('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?', [
      req.userId,
      start,
      today,
    ]),
    queryOne(
      'SELECT COALESCE(SUM(amount),0) as total FROM income_entries WHERE user_id = ? AND date >= ? AND date <= ?',
      [req.userId, start, today]
    ),
    fixedExpensesForMonth(req.userId, start, end),
    netWorthAsOf(req.userId, prevBounds.end),
  ]);

  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const b of breakdown) {
    if (b.value >= 0) totalAssets += b.value;
    else totalLiabilities += Math.abs(b.value);
  }
  const totalFixed = fixed.reduce((s, e) => s + e.amount, 0);

  res.json({
    netWorth,
    totalAssets,
    totalLiabilities,
    assetCount: assets.length,
    monthToDateExpenses: monthToDateExpensesRow.total,
    monthToDateIncome: monthToDateIncomeRow.total,
    monthFixedExpenses: totalFixed,
    netWorthChange: netWorth - previousNetWorth,
  });
});

// Get or set the spending quota for a specific month
router.get('/quota', async (req, res) => {
  const year = Number(req.query.year) || Number(todayISO().slice(0, 4));
  const month = Number(req.query.month) || Number(todayISO().slice(5, 7));
  const quota = await resolveQuota(req.userId, year, month);
  res.json(quota || { amount: null, assetId: null, isExact: false, setFor: null, left: null });
});

router.put('/quota', async (req, res) => {
  const { year, month, amount, assetId } = req.body || {};
  if (!year || !month || amount === undefined) {
    return res.status(400).json({ error: 'year, month and amount are required.' });
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number.' });
  }
  const resolvedAssetId = assetId || null;
  if (resolvedAssetId && !(await queryOne('SELECT id FROM assets WHERE id = ? AND user_id = ?', [resolvedAssetId, req.userId]))) {
    return res.status(400).json({ error: 'Pocket not found.' });
  }

  await run(
    `INSERT INTO spending_quotas (user_id, year, month, amount, asset_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, year, month) DO UPDATE SET amount = excluded.amount, asset_id = excluded.asset_id`,
    [req.userId, year, month, amt, resolvedAssetId]
  );

  res.json({ year, month, amount: amt, assetId: resolvedAssetId });
});

module.exports = router;
