import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Routes where a 401 means "wrong credentials", not "your session expired" —
// these should never trigger the global session-expired handler below.
const AUTH_ENTRY_POINTS = ['/auth/login', '/auth/register', '/auth/reset-password', '/auth/setup-status'];

let sessionExpiredHandler = null;
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const isAuthEntryPoint = AUTH_ENTRY_POINTS.some((p) => url.includes(p));
    if (err.response?.status === 401 && !isAuthEntryPoint) {
      sessionExpiredHandler?.();
    }
    return Promise.reject(err);
  }
);

export default api;

export const currency = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(n || 0)
  );

export const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Inclusive YYYY-MM-DD start/end for a given year/month, for scoping list
// fetches (Daily Expenses, Fixed Expenses, Income, Transfers) to one month
// at a time instead of loading every entry ever recorded.
export const monthBounds = (year, month) => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};

export const percent = (n) => `${Number(n || 0).toFixed(1)}%`;

export const ASSET_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank account' },
  { value: 'savings', label: 'Savings' },
  { value: 'investment', label: 'Investment' },
  { value: 'gold', label: 'Gold' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'liability', label: 'Liability (loan, debt)' },
  { value: 'other', label: 'Other' },
];

export const EXPENSE_CATEGORIES = [
  'FnBs',
  'Health & Sports',
  'Groceries',
  'Transport',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Travel',
  'Other',
];
