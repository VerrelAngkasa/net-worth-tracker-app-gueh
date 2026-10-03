export default function SortableAmountHeader({ dir, onToggle, className = '' }) {
  return (
    <th className={`px-4 py-2.5 font-medium text-right whitespace-nowrap ${className}`}>
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-1 hover:text-ink transition-colors"
        title="Sort by amount"
      >
        Amount
        <span className="text-[10px] leading-none">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '⇅'}</span>
      </button>
    </th>
  );
}
