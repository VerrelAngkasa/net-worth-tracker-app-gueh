# MyLedger — Personal Net Worth Tracker

A self-hosted, single-user app for tracking pockets of money (bank accounts,
savings, investments), logging income and expenses against them, and
generating monthly reports. Amounts are shown in Indonesian Rupiah (IDR).

- **Backend:** Node.js + Express + Postgres (via [Supabase](https://supabase.com)), JWT auth in an httpOnly cookie
- **Frontend:** React + Vite + Tailwind CSS, Recharts for charts

## Project structure

```
networth-tracker/
├── backend/     Express API, connects to a Supabase Postgres database
└── frontend/    React app (Vite)
```

## 1. Requirements

- Node.js 18 or newer (check with `node -v`)
- npm (comes with Node)
- A [Supabase](https://supabase.com) project (free tier is enough)

## 2. Set up the database

1. Create a project at [supabase.com](https://supabase.com) (or use an
   existing one).
2. In the Supabase dashboard, go to **Project Settings → Database →
   Connection string**, and copy the **Transaction pooler** string (port
   `6543`) — not the direct connection (port `5432`). The pooler is required
   if you ever deploy this behind something serverless (e.g. AWS Lambda),
   and works fine for local development too.
3. The app creates its own tables on boot (`CREATE TABLE IF NOT EXISTS`), so
   you don't have to run any SQL by hand. If you'd rather set the schema up
   yourself first, the exact schema it expects is in
   `backend/src/db/index.js`'s `migrate()` function.

## 3. Set up the backend

```bash
cd backend
npm install
```

Open `.env` and fill in your Supabase connection string and a real
`JWT_SECRET`:

```
PORT=3000
JWT_SECRET=change_this_to_a_long_random_string_before_real_use
NODE_ENV=development
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xx-xxxx-1.pooler.supabase.com:6543/postgres
CLIENT_ORIGIN=http://localhost:5173
```

Start the API:

```bash
npm run dev      # auto-restarts on changes, via nodemon
# or
npm start        # plain node
```

The API runs at `http://localhost:3000`, and applies its schema against your
Supabase database on boot before it starts listening.

**A note on connection pooling**: the transaction-mode pooler doesn't support
named prepared statements shared across connections. Every query in this app
uses unnamed statements for exactly this reason — worth knowing if you add
new queries, since some ORMs default to named/cached prepared statements and
will break against the pooler.

## 4. Set up the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` and proxies API requests to the
backend automatically (see `frontend/vite.config.js`).

## 5. First run

Open `http://localhost:5173`. Since this is a single-user app, the first time
you open it you'll be asked to create the one account for your ledger — a
username, display name, and password. **Registration closes automatically
after this step** — the `/api/auth/register` route refuses to create a second
account — so there's always exactly one login for your data.

After that, you'll sign in with that username and password on future visits.
Sessions last 7 days and are stored in an httpOnly cookie.

**If you forget your password**: at account creation you're shown a one-time
**recovery code** (also regeneratable any time from Settings while logged
in). On the login page, "Forgot your password?" leads to a reset form asking
for your username and that code — no email required. Using it to reset your
password issues a new recovery code automatically, since the old one is spent
the moment it's used.

## 6. The pocket model

This app is built around **pockets** — the Assets page is really a list of
accounts you move money in and out of (Payroll Account, Emergency Fund,
Holiday Savings, an investment account, etc.), plus any illiquid assets
(property, vehicles) or liabilities (loans, enter as negative values) you
want to include in net worth.

- **Income** — log money landing in a pocket (salary, bonus, gift...). It
  increases that pocket's balance immediately.
- **Transfers** — move money between two pockets (e.g. Payroll → Emergency
  Fund). The source pocket decreases and the destination increases.
- **Daily Expenses** — optionally choose a pocket when logging a purchase.
  If you pick "Emergency Fund," only that pocket's balance goes down — your
  other pockets are untouched. Leave it as "None" to just log the spend
  without affecting any pocket balance.
- **Fixed Expenses** — bills you pay each month (rent, subscriptions,
  insurance). Each entry belongs to one specific month with its own date, so
  editing or deleting July's rent never touches June's or August's — unlike a
  recurring "rule" shared across months. Pick a pocket and it's deducted
  right away, exactly like a Daily Expense, just filed separately so it
  doesn't count against your spending quota. Since there's no rule to repeat
  a bill automatically, **"Copy last month's bills to this month"** on the
  Fixed Expenses page duplicates last month's entries into the current one
  in a single click, each as its own independent entry you can then edit
  freely.
- **Spending quota** — an optional monthly budget, set from the Monthly
  Report page. It's reduced only by **Daily Expenses** — fixed bills never
  count against it, since a quota is meant to track discretionary spending.
  You can also tie a quota to one specific pocket (e.g. your everyday
  "Spending Account") so it only counts expenses drawn from that pocket —
  spending from Emergency Fund or Travel pockets won't touch it. Leave it as
  "All daily expenses" to count every daily expense regardless of pocket. If
  you don't set a quota for a given month, the most recent earlier one
  (amount and pocket) carries forward automatically; setting a new one for a
  month overrides that just for that month onward.

Every pocket's "current value" is always its most recent recorded balance.
Income, transfers, and pocket-linked expenses all write a new balance
snapshot; you can also manually "Update value" on the Assets page any time to
reconcile against your real bank balance (useful for investment accounts
whose value moves on its own).

**Percentages**: each pocket on the Assets page and in the Monthly Report
shows its share of your total (positive) assets, so you can see at a glance
how your money is spread across pockets.

**Fixing a mis-input**: click **History** on any asset to see every balance
snapshot recorded for it, and delete individual entries — the most recent
remaining one becomes the pocket's current balance. This is the way to
correct a wrong amount without needing to archive the whole asset.

## 7. Using the app

- **Dashboard** — net worth headline, 12-month trend, and quick totals for
  assets, liabilities, income this month, and spending this month.
- **Daily Expenses** — one-off spending with an optional pocket.
- **Fixed Expenses** — one independent entry per month; use "Copy last
  month's bills" to carry recurring ones forward without linking months.
- **Income** — money landing in a pocket, with a source (Salary, Bonus, etc).
- **Transfers** — move money between two pockets.
- **Assets** — every pocket and asset, with percentage of total, value
  history, and manual value updates.
- **Settings** — change your password, generate a new recovery code
  (invalidates the old one), or set how long you can stay idle before being
  automatically signed out.
- **Monthly Report** — net worth at month end and its change, income vs.
  spending, a **spending quota** card (set a monthly budget and see what's
  left, or how far over you are, with a progress bar — set it once and it
  carries forward to future months until you change it), an interactive
  spending-by-category donut chart (hover or click a slice/legend pill to
  filter the tables below), the asset breakdown with percentages, and full
  expense listings for the month.

## 8. Backing up your data

Your data lives in Supabase's Postgres database, not on your machine.
Supabase takes automatic daily backups on paid plans; on the free tier,
export your data yourself from **Project Settings → Database → Backups**,
or run `pg_dump` against your connection string periodically if you want
your own copy outside Supabase entirely.

## 9. Running it long-term

For everyday personal use, running `npm run dev` in both folders whenever you
want to use the app is enough. If you'd like it to run in the background or
start automatically:

```bash
# Backend
cd backend
npm start                     # or use pm2 / a systemd service

# Frontend — build static files and serve them
cd frontend
npm run build                 # outputs to frontend/dist
npx serve dist                # or any static file server
```

If you serve the built frontend from a different origin than `localhost:5173`,
update `CLIENT_ORIGIN` in `backend/.env` so CORS allows it, and point the
frontend's API calls at the backend's real URL.

## Notes on security

This app is built for personal, local use. The single-account model, JWT
cookie auth, and bcrypt password hashing are reasonable for that. If you ever
expose it beyond your own machine (e.g. host it on the internet), put it
behind HTTPS and treat `JWT_SECRET` as a real secret.

**Auto sign-out**: your session uses a sliding idle timeout — every request
you make while using the app quietly extends it, so it only expires after
genuine inactivity (5 minutes to 2 hours, configurable in Settings; 15
minutes by default). There's also a fixed 7-day ceiling on any single
session regardless of activity, so you're never signed into the same session
indefinitely even with constant use.
