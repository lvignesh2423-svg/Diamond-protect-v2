import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  QrCode, 
  Network, 
  BarChart3, 
  Database,
  Lock,
  User,
  LogOut,
  Sparkles,
  Cpu,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import UserPaymentSimulator from './components/UserPaymentSimulator';
import MerchantQRStudio from './components/MerchantQRStudio';
import MuleNetworkGraph from './components/MuleNetworkGraph';
import InvestigatorDashboard from './components/InvestigatorDashboard';
import DatasetUploader from './components/DatasetUploader';
import AuthModal from './components/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator');
  const [stats, setStats] = useState(null);
  const [presets, setPresets] = useState([]);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchPresets();
    checkExistingAuth();
  }, []);

  const checkExistingAuth = () => {
    const savedUser = localStorage.getItem('diamond_user');
    const token = localStorage.getItem('diamond_auth_token');
    if (savedUser && token) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('diamond_user');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('diamond_auth_token');
    localStorage.removeItem('diamond_user');
    setCurrentUser(null);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/demo-presets');
      const data = await res.json();
      setPresets(data.presets || []);
    } catch (e) {
      console.error('Error fetching presets:', e);
    }
  };

  const navItems = [
    { id: 'simulator', label: 'Payment Radar', icon: Smartphone, desc: 'Pre-Pay Interceptor' },
    { id: 'qr_studio', label: 'QR Mint & Verifier', icon: QrCode, desc: 'BIS IS 18000' },
    { id: 'graph', label: 'Mule Syndicates', icon: Network, desc: 'NetworkX Graph' },
    { id: 'investigator', label: 'Live Triage', icon: BarChart3, desc: 'Database Ledger' },
    { id: 'uploader', label: 'Upload Dataset', icon: Database, desc: 'Custom CSV Ingest' },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0e1629]/90 backdrop-blur-xl border-b border-white/10 shadow-lg px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Diamond-Protect
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300">
                  v3.0 Security
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Real-Time UPI Fraud & Mule-Account Defense System
              </p>
            </div>
          </div>

          {/* User Auth Portal & Standards Badges */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                BIS IS 18000 Aligned
              </span>
              <span className="text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 font-mono flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                Llama 3.2 AI
              </span>
            </div>

            {/* User Account Button */}
            {currentUser ? (
              <div className="flex items-center gap-3 bg-slate-900/90 border border-white/10 px-3.5 py-1.5 rounded-2xl shadow">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                    {currentUser.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-white leading-tight">{currentUser.full_name}</div>
                    <div className="text-[10px] text-slate-400 font-mono leading-none">{currentUser.email}</div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 shadow-md shadow-sky-500/20 cursor-pointer transition-all flex items-center gap-1.5 tracking-wide"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Analyst Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Feature Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex space-x-2 overflow-x-auto py-2.5 border-t border-white/5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 ring-1 ring-sky-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                  isActive ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'
                }`}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Feature Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'simulator' && (
            <UserPaymentSimulator
              key="sim"
              onTransactionEvaluated={() => fetchStats()}
              presets={presets}
            />
          )}

          {activeTab === 'qr_studio' && (
            <MerchantQRStudio key="qr" />
          )}

          {activeTab === 'graph' && (
            <MuleNetworkGraph key="graph" />
          )}

          {activeTab === 'investigator' && (
            <InvestigatorDashboard
              key="inv"
              stats={stats}
              refreshStats={fetchStats}
            />
          )}

          {activeTab === 'uploader' && (
            <DatasetUploader
              key="uploader"
              onUploadComplete={() => {
                fetchStats();
                setActiveTab('investigator');
              }}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Auth Modal Dialog */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0a0f1d] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Diamond-Protect</span>
            <span>•</span>
            <span>Real-Time UPI Fraud, Phishing-QR and Mule Detection</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span>auth.db</span>
            <span>•</span>
            <span>transactions.db</span>
            <span>•</span>
            <span>FastAPI</span>
            <span>•</span>
            <span>OpenRouter AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
