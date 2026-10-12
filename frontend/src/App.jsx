import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  QrCode, 
  Network, 
  BarChart3, 
  Sparkles, 
  Lock,
  Cpu,
  Layers
} from 'lucide-react';

import UserPaymentSimulator from './components/UserPaymentSimulator';
import MerchantQRStudio from './components/MerchantQRStudio';
import MuleNetworkGraph from './components/MuleNetworkGraph';
import InvestigatorDashboard from './components/InvestigatorDashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('simulator');
  const [stats, setStats] = useState(null);
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchPresets();
  }, []);

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

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight diamond-gradient-text">
                  Diamond-Protect
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-sky-300">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Real-Time UPI Fraud, Phishing-QR & Mule-Account Defense
              </p>
            </div>
          </div>

          {/* Standards & Compliance Pills */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              BIS Standard IS 18000 Aligned
            </span>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              Llama 3.2 AI Explainability
            </span>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. User Payment Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('qr_studio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'qr_studio'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>2. Merchant QR Studio & Verifier</span>
          </button>

          <button
            onClick={() => setActiveTab('graph')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'graph'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>3. Mule Network Visualizer</span>
          </button>

          <button
            onClick={() => setActiveTab('investigator')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'investigator'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>4. Investigator & Intelligence Hub</span>
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'simulator' && (
          <UserPaymentSimulator
            onTransactionEvaluated={() => fetchStats()}
            presets={presets}
          />
        )}

        {activeTab === 'qr_studio' && (
          <MerchantQRStudio />
        )}

        {activeTab === 'graph' && (
          <MuleNetworkGraph />
        )}

        {activeTab === 'investigator' && (
          <InvestigatorDashboard
            stats={stats}
            refreshStats={fetchStats}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">Diamond-Protect</span>
            <span>•</span>
            <span>Empowering Bharat with AI-Powered Real-Time UPI Trust</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Powered by Scikit-Learn • NetworkX • FastAPI • OpenRouter AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
