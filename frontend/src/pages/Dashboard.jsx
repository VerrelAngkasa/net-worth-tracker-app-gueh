import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api, { currency, monthLabel } from '../lib/api';
import StampNumber from '../components/StampNumber';
import Money from '../components/Money';
import { usePrivacy } from '../context/PrivacyContext';

const compactIDR = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `Rp${(v / 1_000_000_000).toFixed(1)}M`;
  if (abs >= 1_000_000) return `Rp${(v / 1_000_000).toFixed(0)}jt`;
  if (abs >= 1_000) return `Rp${(v / 1_000).toFixed(0)}rb`;
  return `Rp${v}`;
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { hidden } = usePrivacy();

  useEffect(() => {
    let mounted = true;
    Promise.all([api.get('/reports/summary'), api.get('/reports/networth-history?months=12')]).then(
      ([s, h]) => {
        if (!mounted) return;
        setSummary(s.data);
        setHistory(h.data.map((p) => ({ ...p, label: monthLabel(p.year, p.month).slice(0, 3) })));
        setLoading(false);
      }
    );
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <p className="text-slate">Loading your ledger…</p>;
  }

  const changePositive = summary.netWorthChange >= 0;
  const monthSpent = summary.monthToDateExpenses + summary.monthFixedExpenses;
  const savingsRate =
    summary.monthToDateIncome > 0 ? ((summary.monthToDateIncome - monthSpent) / summary.monthToDateIncome) * 100 : null;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-display text-3xl font-bold text-ink">Your net worth</h1>
      </div>

      <div className="flex flex-wrap items-end gap-8">
        <StampNumber label="Total net worth" value={summary.netWorth} size="lg" />
        <div className={`px-3 py-1.5 rounded-full ${changePositive ? 'bg-ledger-light' : 'bg-clay-light'}`}>
          <p className="text-xs uppercase tracking-wider text-slate font-semibold mb-0.5">Since last month</p>
          <Money
            value={summary.netWorthChange}
            prefix={changePositive ? '↑ +' : '↓ '}
            className={`font-mono mono-num text-lg font-bold ${changePositive ? 'text-ledger' : 'text-clay'}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Assets" value={summary.totalAssets} tone="ledger" />
        <StatCard label="Income" value={summary.monthToDateIncome} tone="ledger" />
        <StatCard label="Total spent" value={monthSpent} tone="clay" />
        <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4 min-w-0">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
            Savings rate
          </p>
          <p
            className={`font-mono mono-num text-xl font-bold ${
              savingsRate === null ? 'text-slate' : savingsRate >= 0 ? 'text-ledger' : 'text-clay'
            }`}
          >
            {hidden ? '••%' : savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-display text-lg font-bold text-ink mb-4">12-month trend</h2>
        <div className="bg-card border border-line rounded-2xl shadow-sm p-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFC" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C5CFC" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#E6E1F5" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#E6E1F5' }} />
              <YAxis
                stroke="#6B7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (hidden ? '•••' : compactIDR(v))}
                width={60}
              />
              <Tooltip
                formatter={(v) => (hidden ? 'Rp ••••••' : currency(v))}
                contentStyle={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  borderColor: '#E6E1F5',
                  borderRadius: 12,
                  boxShadow: '0 8px 20px -8px rgba(33,31,61,0.25)',
                }}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#7C5CFC"
                strokeWidth={3}
                fill="url(#netWorthFill)"
                activeDot={{ r: 5, fill: '#7C5CFC', stroke: '#fff', strokeWidth: 2 }}
                dot={{ r: 3, fill: '#7C5CFC' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass = { ledger: 'text-ledger', clay: 'text-clay', ink: 'text-ink' }[tone];
  const dotClass = { ledger: 'bg-ledger', clay: 'bg-clay', ink: 'bg-primary' }[tone];
  return (
    <div className="card-pop bg-card border border-line rounded-2xl shadow-sm p-4 min-w-0">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate font-semibold mb-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {label}
      </p>
      <Money value={value} className={`font-mono mono-num text-xl font-bold ${toneClass}`} />
    </div>
  );
}
