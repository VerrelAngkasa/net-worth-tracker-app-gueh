const { queryOne } = require('../db');

// Latest known balance for a pocket, i.e. the most recently RECORDED snapshot —
// ordered by insertion order (id), not by the `date` field. A transaction can be
// backdated (e.g. marking a bill paid "as of" an earlier date than today), and the
// current balance must reflect the most recent thing that actually happened, not
// whichever row happens to carry the latest date value.
async function currentBalance(assetId) {
  const row = await queryOne('SELECT value FROM asset_values WHERE asset_id = ? ORDER BY id DESC LIMIT 1', [
    assetId,
  ]);
  return row ? row.value : 0;
}

// Applies a delta (positive or negative) to a pocket's balance by writing a new
// snapshot dated on `date`, always adjusting from the latest RECORDED balance
// (insertion order, same reasoning as currentBalance above) — so backdated
// entries nudge the current total rather than getting silently overridden by
// whatever row happens to have the latest date.
//
// The read (latest balance) and the write (new snapshot) happen in a single
// statement rather than two separate round trips, so two requests touching
// the same pocket at the same moment can't race and silently drop one of them.
async function adjustBalance(assetId, delta, date) {
  const row = await queryOne(
    `INSERT INTO asset_values (asset_id, date, value)
     SELECT ?, ?, COALESCE(
       (SELECT value FROM asset_values WHERE asset_id = ? ORDER BY id DESC LIMIT 1), 0
     ) + ?
     RETURNING value`,
    [assetId, date, assetId, delta]
  );
  return row.value;
}

module.exports = { currentBalance, adjustBalance };
