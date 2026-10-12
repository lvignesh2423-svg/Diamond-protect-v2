import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
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
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';

const COLORS = ['#EF4444', '#F59E0B', '#8B5CF6', '#3B82F6', '#10B981'];

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
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Simulated Volume</span>
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">
            ₹{stats?.total_volume_inr?.toLocaleString() || '0'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {stats?.total_transactions?.toLocaleString() || 0} evaluated UPI payments
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fraud Amount Blocked</span>
            <div className="w-8 h-8 rounded-lg bg-red-950 border border-red-800 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-400 mt-2">
            ₹{stats?.fraud_amount_prevented_inr?.toLocaleString() || '0'}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Intercepted before bank settlement
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Fraud Rate</span>
            <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">
            {stats?.fraud_rate_pct || 0}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {stats?.fraud_attempts_blocked || 0} malicious attacks prevented
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Mule Rings</span>
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400 mt-2">
            {stats?.active_mule_nodes_tracked || 0} Nodes
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Tracked in real-time graph intelligence
          </div>
        </div>
      </div>

      {/* Analytics Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Fraud Attack Vectors Breakdown */}
        <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
          <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Fraud Vector Classification</span>
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Distribution of blocked scams across phishing QR, mule hubs, and circular rings.
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
                  paddingAngle={5}
                  dataKey="value"
                >
                  {fraudBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0B0F19', borderColor: '#1F2937', borderRadius: '12px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 mt-2">
            {fraudBreakdownData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="text-slate-300 capitalize">{item.name}</span>
                </div>
                <span className="font-bold text-white font-mono">{item.value} txns</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Transaction Ledger */}
        <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Live Transaction Ledger & Triage</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time surveillance audit trail</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterFraudOnly(!filterFraudOnly)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${
                  filterFraudOnly
                    ? 'bg-red-950/80 border-red-500/60 text-red-300'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {filterFraudOnly ? 'Showing Blocked Only' : 'Filter Blocked'}
              </button>

              <button
                onClick={() => { fetchTransactions(); refreshStats(); }}
                className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mb-4">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Txn ID, VPA, User or Attack Type..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto flex-1 max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Txn ID</th>
                  <th className="py-2.5 px-3">Payee VPA</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Classification</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredTxns.map((t) => (
                  <tr key={t.txn_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-300 font-semibold">{t.txn_id}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 max-w-[150px] truncate" title={t.receiver_vpa}>
                      {t.receiver_vpa}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">₹{t.amount.toLocaleString()}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        t.is_fraud === 1 ? 'bg-red-950/80 text-red-300 border border-red-800/60' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {t.fraud_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.is_fraud === 1 ? (
                        <span className="text-red-400 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Blocked
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Cleared
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
    </div>
  );
}
