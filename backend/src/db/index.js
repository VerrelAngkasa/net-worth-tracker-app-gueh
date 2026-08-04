const { Pool, types } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Point it at your Supabase Postgres connection string ' +
      '(use the "Transaction" pooler connection string, port 6543, if deploying to a serverless environment like Lambda).'
  );
}

// node-postgres returns BIGINT and NUMERIC as strings by default, since both
// can hold values that don't fit safely in a JS number. This app's IDs and
// amounts never get remotely close to that range, and the whole codebase
// does plain arithmetic on them (e.g. `total += row.amount`), which silently
// turns into string concatenation instead of addition without this fix.
// DATE/TIMESTAMP are also overridden to stay as plain strings instead of
// being parsed into JS Date objects, which avoids local-timezone shifting
// a stored "2026-07-05" into "2026-07-04" depending on the server's TZ.
types.setTypeParser(20 /* int8 / bigint */, (val) => parseInt(val, 10));
types.setTypeParser(1700 /* numeric */, (val) => parseFloat(val));
types.setTypeParser(1082 /* date */, (val) => val);
types.setTypeParser(1114 /* timestamp without time zone */, (val) => val);
types.setTypeParser(1184 /* timestamptz */, (val) => val);

// Supabase (and most managed Postgres) requires SSL. Its certs are properly
// signed, but the pooler's chain isn't always in Node's default trust store,
// so this defaults to permissive verification. Set DATABASE_SSL=false only
// for a local/self-hosted Postgres you're testing against without TLS.
const ssl = process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. the pooler recycling a connection) shouldn't crash the process.
  console.error('Unexpected error on idle Postgres client', err);
});

// This app was originally written against better-sqlite3's `?` placeholders;
// converting them to Postgres's `$1, $2...` here means the route files below
// barely had to change their SQL strings during the migration. Each call
// uses an unnamed prepared statement (no `name` field), which is what makes
// this safe to run through Supabase's transaction-mode pooler — named,
// cached prepared statements don't work reliably across pooled connections.
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return res.rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// For INSERT/UPDATE/DELETE where you don't need rows back — returns rowCount.
async function run(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return { rowCount: res.rowCount };
}

async function migrate() {
  // Dependency order matters here — unlike SQLite, Postgres validates that a
  // FOREIGN KEY's target table already exists at CREATE TABLE time.
  // This mirrors the schema already applied in Supabase; CREATE TABLE IF NOT
  // EXISTS makes it a no-op there, but keeps a fresh database (local Postgres,
  // a new Supabase project, CI) self-sufficient without a manual SQL step.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      recovery_code_hash TEXT,
      display_name TEXT,
      idle_timeout_minutes INTEGER NOT NULL DEFAULT 15,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      notes TEXT,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS asset_values (
      id BIGSERIAL PRIMARY KEY,
      asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      value NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_id BIGINT REFERENCES assets(id) ON DELETE SET NULL,
      date DATE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      amount NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_id BIGINT REFERENCES assets(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      day_of_month INTEGER NOT NULL DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      start_date DATE NOT NULL,
      end_date DATE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fixed_expense_payments (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fixed_expense_id BIGINT NOT NULL REFERENCES fixed_expenses(id) ON DELETE CASCADE,
      asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      date DATE NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (fixed_expense_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS income_entries (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      source TEXT NOT NULL,
      description TEXT,
      amount NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      to_asset_id BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      description TEXT,
      amount NUMERIC(15,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS spending_quotas (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      asset_id BIGINT REFERENCES assets(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, year, month)
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_asset ON expenses(asset_id);
    CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON fixed_expenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_lookup ON fixed_expense_payments(fixed_expense_id, year, month);
    CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
    CREATE INDEX IF NOT EXISTS idx_asset_values_asset_date ON asset_values(asset_id, date);
    CREATE INDEX IF NOT EXISTS idx_income_user_date ON income_entries(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_transfers_user_date ON transfers(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_quotas_user_period ON spending_quotas(user_id, year, month);
  `);

  // Idempotent column additions for people upgrading an existing database —
  // Postgres supports IF NOT EXISTS directly, so no manual existence check needed.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_code_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS idle_timeout_minutes INTEGER NOT NULL DEFAULT 15;
    ALTER TABLE spending_quotas ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES assets(id) ON DELETE SET NULL;
    ALTER TABLE fixed_expenses ADD COLUMN IF NOT EXISTS asset_id BIGINT REFERENCES assets(id) ON DELETE SET NULL;
  `);
}

module.exports = { pool, query, queryOne, run, migrate };
