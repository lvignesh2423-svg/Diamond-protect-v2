import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  QrCode, 
  Network, 
  BarChart3, 
  Sparkles, 
  Cpu,
  Layers,
  Activity,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import SpatialCanvas from './components/SpatialCanvas';
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

  const navItems = [
    { id: 'simulator', label: 'Payment Simulator', icon: Smartphone, badge: 'Pre-Pay' },
    { id: 'qr_studio', label: 'Merchant QR Studio', icon: QrCode, badge: 'IS 18000' },
    { id: 'graph', label: 'Mule Syndicates', icon: Network, badge: 'NetworkX' },
    { id: 'investigator', label: 'Intelligence Triage', icon: BarChart3, badge: 'Live Feed' }
  ];

  return (
    <div className="min-h-screen bg-[#05070E] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white relative overflow-x-hidden">
      {/* 3D WebGL Spatial Canvas Background */}
      <SpatialCanvas />

      {/* Spatial Floating Glass Header */}
      <header className="sticky top-0 z-50 px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="max-w-7xl mx-auto spatial-glass rounded-3xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-500 flex items-center justify-center shadow-xl shadow-sky-500/25 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight hologram-text">
                  Diamond-Protect
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300">
                  Spatial Intelligence
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Real-Time UPI Fraud, Phishing-QR & Mule-Account Defense
              </p>
            </div>
          </div>

          {/* Compliance & Intelligence Status Pills */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/60 border border-white/10 text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>BIS IS 18000 Certified</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-950/60 border border-white/10 text-xs font-mono text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Llama 3.2 Copilot</span>
            </div>
          </div>
        </div>

        {/* Spatial Floating Navigation Dock */}
        <div className="max-w-3xl mx-auto mt-3">
          <nav className="spatial-dock rounded-2xl p-1.5 flex items-center justify-between gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 relative cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-400 to-indigo-500 text-slate-950 shadow-lg shadow-sky-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Spatial Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
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
        </AnimatePresence>
      </main>

      {/* Spatial Footer Dock */}
      <footer className="border-t border-white/5 bg-slate-950/80 backdrop-blur-md py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Diamond-Protect</span>
            <span>•</span>
            <span>Spatial UPI Trust Layer for Bharat</span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span>FastAPI</span>
            <span>•</span>
            <span>Three.js / WebGL</span>
            <span>•</span>
            <span>NetworkX Graph</span>
            <span>•</span>
            <span>OpenRouter AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
