import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  QrCode,
  Network,
  BarChart3,
  Database,
  LogOut,
  Activity
} from 'lucide-react';

import SpatialCanvas from './components/SpatialCanvas';
import VerifyPage from './pages/VerifyPage';
import LoginPage from './pages/LoginPage';
import MerchantQRStudio from './components/MerchantQRStudio';
import MuleNetworkGraph from './components/MuleNetworkGraph';
import InvestigatorDashboard from './components/InvestigatorDashboard';
import DatasetUploader from './components/DatasetUploader';

import { api, clearSession, getUser, hasSession, onUnauthorized } from './lib/api';
import { DEFAULT_ROUTE, ROUTES, navigate, useRoute } from './lib/router';

const NAV_ITEMS = [
  { id: 'verify', label: 'Verify Payment', icon: Smartphone, desc: 'Camera & UPI analysis' },
  { id: 'qr-studio', label: 'Merchant QR Studio', icon: QrCode, desc: 'Sign & verify payloads' },
  { id: 'graph', label: 'Mule Network', icon: Network, desc: 'Topology & wash rings' },
  { id: 'dashboard', label: 'Investigator Dashboard', icon: BarChart3, desc: 'Statistics & ledger' },
  { id: 'data', label: 'Dataset', icon: Database, desc: 'CSV ingestion' }
];

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState(() => (hasSession() ? getUser() : null));
  const [stats, setStats] = useState(null);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    navigate('login');
  }, []);

  useEffect(() => {
    onUnauthorized(handleUnauthorized);
    return () => onUnauthorized(null);
  }, [handleUnauthorized]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api('/api/stats');
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  useEffect(() => {
    if (user) fetchStats();
  }, [user, fetchStats]);

  const handleAuthSuccess = (nextUser) => {
    setUser(nextUser);
    navigate(DEFAULT_ROUTE);
    fetchStats();
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setStats(null);
    navigate('login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col font-sans selection:bg-sky-500 selection:text-white relative overflow-x-hidden">
        <SpatialCanvas />
        <LoginPage onAuthSuccess={handleAuthSuccess} />
      </div>
    );
  }

  const activeRoute = ROUTES.includes(route) ? route : DEFAULT_ROUTE;

  const renderPage = () => {
    switch (activeRoute) {
      case 'qr-studio':
        return <MerchantQRStudio />;
      case 'graph':
        return <MuleNetworkGraph />;
      case 'dashboard':
        return (
          <InvestigatorDashboard stats={stats} refreshStats={fetchStats} />
        );
      case 'data':
        return <DatasetUploader onImported={fetchStats} />;
      case 'verify':
      default:
        return <VerifyPage onEvaluated={fetchStats} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-sky-500 selection:text-white relative overflow-x-hidden">
      <SpatialCanvas />

      {/* Top navbar */}
      <header className="sticky top-0 z-40 bg-[#0e1629]/85 backdrop-blur-xl border-b border-white/10 shadow-lg px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight brand-gradient">Diamond-Protect</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300">
                  IS 18000
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Real-Time UPI Fraud, Camera QR &amp; Mule-Account Detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stats && (
              <span className="hidden lg:flex text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 font-mono items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                {stats.total_transactions?.toLocaleString()} txns • {stats.fraud_rate_pct}% flagged
              </span>
            )}

            <div className="flex items-center gap-3 bg-slate-900/90 border border-white/10 px-3.5 py-1.5 rounded-2xl shadow">
              <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs uppercase">
                {(user.username || '?').charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">{user.username}</div>
                <div className="text-[10px] text-slate-400 font-mono leading-none">{user.role || 'analyst'}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature navigation */}
        <div className="max-w-7xl mx-auto flex space-x-2 overflow-x-auto py-2.5 border-t border-white/5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 ring-1 ring-sky-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {renderPage()}
      </main>

      <footer className="border-t border-white/10 bg-[#0a0f1d] py-6 mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Diamond-Protect</span>
            <span>•</span>
            <span>Five-stage UPI fraud &amp; mule defence pipeline</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>auth.db</span>
            <span>•</span>
            <span>transactions.db</span>
            <span>•</span>
            <span>username + password session</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
