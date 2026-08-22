import { NavLink, Outlet } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/expenses', label: 'Daily Expenses' },
  { to: '/fixed-expenses', label: 'Fixed Expenses' },
  { to: '/income', label: 'Income' },
  { to: '/transfers', label: 'Transfers' },
  { to: '/assets', label: 'Assets' },
  { to: '/reports', label: 'Monthly Report' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { hidden, toggle } = usePrivacy();

  return (
    <div className="min-h-screen bg-paper flex">
      <aside className="w-60 shrink-0 border-r border-line bg-card flex flex-col">
        <div className="px-6 py-6 border-b border-line space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="badge-logo w-9 h-9 flex items-center justify-center shrink-0">
              <span className="font-display text-lg font-bold text-white">L</span>
            </div>
            <span className="font-display text-xl font-bold text-ink">LedgerGueh</span>
          </div>
          <button
            onClick={toggle}
            className="flex items-center gap-2 w-full text-xs font-semibold text-ink bg-paper-dim hover:bg-line/60 rounded-xl px-3 py-2 transition-colors"
            title={hidden ? 'Show balances' : 'Hide balances'}
          >
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
            {hidden ? 'Balances hidden' : 'Balances visible'}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : 'text-ink hover:bg-paper-dim'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-line">
          <p className="text-xs text-slate mb-2 truncate">@{user?.username}</p>
          <div className="flex items-center gap-3">
            <NavLink to="/settings" className="text-sm text-ink font-semibold hover:underline">
              Settings
            </NavLink>
            <button
              onClick={logout}
              className="text-sm text-clay font-semibold hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8 md:px-10 md:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
