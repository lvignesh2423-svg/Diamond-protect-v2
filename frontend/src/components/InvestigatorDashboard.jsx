import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Search, 
  RefreshCw,
  IndianRupee,
  Activity,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
import { motion } from 'framer-motion';

const COLORS = ['#F43F5E', '#F59E0B', '#A855F7', '#38BDF8', '#10B981'];

export default function InvestigatorDashboard({ stats, refreshStats }) {
  const [transactions, setTransactions] = useState([]);
  const [filterFraudOnly, setFilterFraudOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [filterFraudOnly]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transactions/recent?limit=25&fraud_only=${filterFraudOnly}`);
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const fraudBreakdownData = stats?.fraud_breakdown
    ? Object.entries(stats.fraud_breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value
      }))
    : [];

  const filteredTxns = transactions.filter(t => 
    t.txn_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.sender_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.receiver_vpa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.fraud_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="spatial-glass p-6 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Volume Evaluated</span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-md shadow-sky-500/10">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-3 tracking-tight">
            ₹{stats?.total_volume_inr?.toLocaleString() || '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {stats?.total_transactions?.toLocaleString() || 0} evaluated payments
          </div>
        </div>

        <div className="spatial-glass p-6 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fraud Blocked Value</span>
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-400/30 flex items-center justify-center text-red-400 shadow-md shadow-red-500/10">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-400 mt-3 tracking-tight">
            ₹{stats?.fraud_amount_prevented_inr?.toLocaleString() || '0'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Intercepted prior to clearing
          </div>
        </div>

        <div className="spatial-glass p-6 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attack Intercept Rate</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-md shadow-amber-500/10">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-3 tracking-tight">
            {stats?.fraud_rate_pct || 0}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats?.fraud_attempts_blocked || 0} threats neutralized
          </div>
        </div>

        <div className="spatial-glass p-6 rounded-3xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mule Nodes Monitored</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-400/30 flex items-center justify-center text-purple-400 shadow-md shadow-purple-500/10">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400 mt-3 tracking-tight">
            {stats?.active_mule_nodes_tracked || 0} Nodes
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Active under graph surveillance
          </div>
        </div>
      </div>

      {/* Analytics Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Fraud Attack Vectors Breakdown */}
        <div className="lg:col-span-5 spatial-glass p-7 rounded-3xl">
          <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Fraud Vector Classification</span>
          </h3>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Distribution of prevented attacks across phishing QR, mule hubs, and circular rings.
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={fraudBreakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {fraudBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(5, 7, 14, 0.9)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '16px', fontSize: '11px', backdropFilter: 'blur(16px)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 mt-3">
            {fraudBreakdownData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-300 capitalize">{item.name}</span>
                </div>
                <span className="font-bold text-white font-mono">{item.value} txns</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Transaction Ledger */}
        <div className="lg:col-span-7 spatial-glass p-7 rounded-3xl flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Live Transaction Ledger & Triage</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Real-time audit trail and classification</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterFraudOnly(!filterFraudOnly)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                  filterFraudOnly
                    ? 'bg-red-500/20 border-red-500/50 text-red-200'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {filterFraudOnly ? 'Showing Blocked Only' : 'Filter Blocked'}
              </button>

              <button
                onClick={() => { fetchTransactions(); refreshStats(); }}
                className="p-2 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Txn ID, VPA, User or Attack Type..."
              className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Txn ID</th>
                  <th className="py-3 px-3">Payee VPA</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Classification</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTxns.map((t) => (
                  <tr key={t.txn_id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-200 font-semibold">{t.txn_id}</td>
                    <td className="py-3 px-3 font-mono text-slate-400 max-w-[150px] truncate" title={t.receiver_vpa}>
                      {t.receiver_vpa}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">₹{t.amount.toLocaleString()}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.is_fraud === 1 ? 'bg-red-500/20 text-red-200 border border-red-500/30' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {t.fraud_type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {t.is_fraud === 1 ? (
                        <span className="text-red-400 font-bold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Blocked
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Cleared
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
