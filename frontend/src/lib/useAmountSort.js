import { useMemo, useState } from 'react';

// Shared amount-sort state for list pages (Daily Expenses, Fixed Expenses,
// Income, Transfers). `null` direction means "leave it in the order the
// server sent it" (newest first) — sorting only kicks in once the Amount
// column header is clicked.
export function useAmountSort(items, amountKey = 'amount') {
  const [dir, setDir] = useState(null); // null | 'asc' | 'desc'

  const sorted = useMemo(() => {
    if (!dir) return items;
    return [...items].sort((a, b) => (dir === 'asc' ? a[amountKey] - b[amountKey] : b[amountKey] - a[amountKey]));
  }, [items, dir, amountKey]);

  const toggle = () => setDir((d) => (d === 'desc' ? 'asc' : 'desc'));

  return { sorted, dir, toggle };
}
