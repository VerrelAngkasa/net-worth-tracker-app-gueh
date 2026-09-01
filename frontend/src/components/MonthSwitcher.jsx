import { monthLabel } from '../lib/api';

export default function MonthSwitcher({ year, month, onShift }) {
  return (
    <div className="flex items-center gap-3 bg-card border border-line rounded-2xl shadow-sm px-2 py-1.5">
      <button
        onClick={() => onShift(-1)}
        className="px-2.5 py-1.5 text-ink hover:bg-paper-dim rounded-xl transition-colors"
        aria-label="Previous month"
      >
        ←
      </button>
      <span className="font-display text-sm font-bold text-ink min-w-32 text-center">{monthLabel(year, month)}</span>
      <button
        onClick={() => onShift(1)}
        className="px-2.5 py-1.5 text-ink hover:bg-paper-dim rounded-xl transition-colors"
        aria-label="Next month"
      >
        →
      </button>
    </div>
  );
}
