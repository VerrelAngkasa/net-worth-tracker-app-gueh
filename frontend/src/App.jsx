import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrivacyProvider } from './context/PrivacyContext';
import Layout from './components/Layout';
import Setup from './pages/Setup';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import FixedExpenses from './pages/FixedExpenses';
import Income from './pages/Income';
import Transfers from './pages/Transfers';
import Assets from './pages/Assets';
import CardBills from './pages/CardBills';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

// The signed-out gate — decides between first-run setup and the login form.
// Rendered only for routes that don't have their own public page (see AppRoutes).
function SignedOutGate() {
  const { needsSetup } = useAuth();
  return needsSetup ? <Setup /> : <Login />;
}

function AppRoutes() {
  const { user, loading, needsSetup } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p className="text-slate">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      {/* Reachable even when signed out, so a forgotten password doesn't need a session. */}
      <Route path="/reset-password" element={needsSetup ? <Navigate to="/" replace /> : <ResetPassword />} />

      {!user ? (
        <Route path="*" element={<SignedOutGate />} />
      ) : (
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="fixed-expenses" element={<FixedExpenses />} />
          <Route path="income" element={<Income />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="assets" element={<Assets />} />
          <Route path="card-bills" element={<CardBills />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PrivacyProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PrivacyProvider>
    </AuthProvider>
  );
}
