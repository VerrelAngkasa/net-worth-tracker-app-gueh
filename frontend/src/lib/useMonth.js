import { useState } from 'react';

// Shared year/month state + shift(-1|+1) for pages that browse data one
// month at a time (Daily Expenses, Fixed Expenses, Income, Transfers,
// Monthly Report). Matches the UTC-based month math already used for the
// report's own switcher, so they never drift out of sync near month
// boundaries in different timezones.
export function useMonth() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);

  const shift = (delta) => {
    const total = year * 12 + (month - 1) + delta;
    setYear(Math.floor(total / 12));
    setMonth((total % 12) + 1);
  };

  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth() + 1;

  return { year, month, shift, isCurrentMonth };
}
