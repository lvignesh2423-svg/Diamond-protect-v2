import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  Search,
  RefreshCw,
  IndianRupee,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Database
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Line
} from 'recharts';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

const COLORS = ['#F43F5E', '#F59E0B', '#A855F7', '#38BDF8', '#10B981', '#FBBF24'];

const tooltipStyle = {
  backgroundColor: 'rgba(5, 7, 14, 0.95)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  fontSize: '11px',
  color: '#F1F5F9'
};

const axisStyle = { fontSize: 10, fill: '#94A3B8' };

function Panel({ icon: Icon, title, note, children, className = '' }) {
  return (
    <div className={`spatial-glass p-7 rounded-3xl ${className}`}>
      <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
        {Icon && <Icon className="w-4 h-4 text-sky-400" />}
        <span>{title}</span>
      </h3>
      {note && <p className="text-xs text-slate-400 mb-5 leading-relaxed">{note}</p>}
      {children}
    </div>
  );
}

export default function InvestigatorDashboard({ stats, refreshStats }) {
  const [transactions, setTransactions] = useState([]);
  const [filterFraudOnly, setFilterFraudOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/transactions/recent?limit=50&fraud_only=${filterFraudOnly}`);
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterFraudOnly]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const analytics = stats?.analytics || {};

  const fraudBreakdownData = useMemo(() => {
    const breakdown = stats?.fraud_breakdown;
    if (Array.isArray(breakdown)) {
      return breakdown.map((b) => ({ name: b.name || b.key, value: b.count }));
    }
    if (breakdown && typeof breakdown === 'object') {
      return Object.entries(breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value
      }));
    }
    return [];
  }, [stats]);

  const scoreDistribution = analytics.score_distribution || [];
  const riskBands = analytics.risk_bands || [];
  const featureImportances = analytics.feature_importances || [];
  const timeSeries = analytics.time_series || [];
  const amountBuckets = analytics.amount_buckets || [];
  const topReceivers = analytics.top_receivers || [];
  const validation = analytics.model_validation || {};

  const filteredTxns = transactions.filter((t) =>
    [t.txn_id, t.sender_id, t.receiver_vpa, t.fraud_type, t.source]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const kpis = [
    {
      label: 'Total volume evaluated',
      value: `₹${Number(stats?.total_volume_inr || 0).toLocaleString()}`,
      sub: `Across ${Number(stats?.total_transactions || 0).toLocaleString()} payments`,
      icon: IndianRupee,
      tone: 'text-sky-400 bg-sky-500/10 border-sky-400/30'
    },
    {
      label: 'Fraud value intercepted',
      value: `₹${Number(stats?.fraud_amount_prevented_inr || 0).toLocaleString()}`,
      sub: 'Blocked before clearing',
      icon: ShieldAlert,
      tone: 'text-red-400 bg-red-500/10 border-red-400/30'
    },
    {
      label: 'Flagged share',
      value: `${stats?.fraud_rate_pct || 0}%`,
      sub: `${stats?.fraud_attempts_blocked || 0} transactions flagged`,
      icon: TrendingUp,
      tone: 'text-amber-400 bg-amber-500/10 border-amber-400/30'
    },
    {
      label: 'Hub mule nodes',
      value: `${stats?.active_mule_nodes_tracked || 0}`,
      sub: `${stats?.verified_merchants_registered || 0} distinct payees seen`,
      icon: Layers,
      tone: 'text-purple-400 bg-purple-500/10 border-purple-400/30'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="spatial-glass p-6 rounded-3xl">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</span>
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${kpi.tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white mt-3 tracking-tight">{kpi.value}</div>
              <div className="text-[11px] text-slate-400 mt-1">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">{error}</div>
      )}

      {/* Fraud vector + ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5">
          <Panel
            icon={Activity}
            title="Fraud vector classification"
            note="Distribution of flagged transactions across the typologies the rule engine encodes."
          >
            <div className="h-60 w-full">
              {fraudBreakdownData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fraudBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={6}
                      dataKey="value"
                      nameKey="name"
                    >
                      {fraudBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend formatter={(value) => <span style={{ color: '#CBD5E1', fontSize: 11 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No flagged transactions yet.
                </div>
              )}
            </div>

            <div className="space-y-2 mt-3">
              {fraudBreakdownData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-bold text-white font-mono">{item.value} txns</span>
                </div>
              ))}
            </div>

            {/* Risk bands */}
            <div className="mt-6 pt-5 border-t border-white/10">
              <div className="text-[10px] uppercase font-bold text-slate-400 mb-3">Risk band composition</div>
              <div className="space-y-2.5">
                {riskBands.map((band) => {
                  const total = analytics.sample_size || 1;
                  const width = Math.max(1, (band.count / total) * 100);
                  return (
                    <div key={band.band}>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>{band.band}</span>
                        <span className="font-mono text-white">
                          {band.count} ({band.fraud} flagged)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            band.band.includes('Critical') ? 'bg-red-500' : band.band.includes('Warning') ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>

        {/* Ledger */}
        <div className="lg:col-span-7">
          <div className="spatial-glass p-7 rounded-3xl flex flex-col h-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Live transaction ledger</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Dataset imports and analyst evaluations, newest first
                </p>
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
                  {filterFraudOnly ? 'Showing flagged only' : 'Filter flagged'}
                </button>

                <button
                  onClick={() => {
                    fetchTransactions();
                    if (refreshStats) refreshStats();
                  }}
                  className="p-2 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                  title="Refresh ledger"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search txn id, VPA, sender, typology or source..."
                className="w-full bg-slate-950/60 border border-white/10 rounded-2xl pl-10 pr-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="overflow-x-auto flex-1 max-h-[440px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#101a33]">
                  <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Txn ID</th>
                    <th className="py-3 px-3">Payee</th>
                    <th className="py-3 px-3">Amount</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTxns.map((t) => (
                    <tr key={t.txn_id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-200 font-semibold">{t.txn_id}</td>
                      <td className="py-3 px-3 font-mono text-slate-400 max-w-[160px] truncate" title={t.receiver_vpa}>
                        {t.receiver_vpa}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        ₹{Number(t.amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            t.source === 'live_evaluation'
                              ? 'bg-sky-500/15 text-sky-200 border-sky-500/30'
                              : 'bg-slate-900 text-slate-400 border-white/10'
                          }`}
                        >
                          {String(t.source || 'dataset').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {t.is_fraud === 1 ? (
                          <span className="text-red-400 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                            {t.fraud_type || 'FLAGGED'}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {t.fraud_type || 'CLEARED'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredTxns.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No transactions match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Statistical panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Panel
          icon={BarChart3}
          title="Population score distribution"
          note={`Risk score of every recorded payment, split by verdict. Mean ${analytics.mean_score ?? 0}, median ${analytics.median_score ?? 0}.`}
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="bin" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="legit" stackId="a" name="Cleared" fill="#38BDF8" />
                <Bar dataKey="fraud" stackId="a" name="Flagged" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => <span style={{ color: '#CBD5E1', fontSize: 11 }}>{value}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          icon={TrendingUp}
          title="Throughput and flag rate over time"
          note="Transactions recorded per day with the share that the pipeline flagged."
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeSeries} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickLine={false} axisLine={false} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar yAxisId="left" dataKey="count" name="Transactions" fill="#818CF8" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="fraud_rate"
                  name="Flag rate %"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#F43F5E' }}
                />
                <Legend formatter={(value) => <span style={{ color: '#CBD5E1', fontSize: 11 }}>{value}</span>} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          icon={Layers}
          title="Amount buckets"
          note="Where the volume sits, and how much of each bucket the pipeline flagged."
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={amountBuckets} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 9 }} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="count" name="Transactions" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fraud" name="Flagged" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => <span style={{ color: '#CBD5E1', fontSize: 11 }}>{value}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          icon={Database}
          title="Model feature importance"
          note="Share of the Random Forest's split gain per input feature."
        >
          <div className="space-y-3">
            {featureImportances.length ? (
              featureImportances.map((f) => (
                <div key={f.feature} className="flex items-center gap-3 text-xs">
                  <span className="w-52 shrink-0 text-slate-300 truncate" title={f.label}>
                    {f.label}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                      style={{ width: `${f.pct}%` }}
                    />
                  </div>
                  <span className="w-14 text-right font-mono text-white">{f.pct}%</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500">Model importances unavailable.</div>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-3">Held-out validation</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Precision', validation.precision],
                ['Recall', validation.recall],
                ['F1', validation.f1],
                ['Accuracy', validation.accuracy]
              ].map(([label, value]) => (
                <div key={label} className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-center">
                  <div className="text-[9px] uppercase text-slate-500 font-bold">{label}</div>
                  <div className="text-sm font-black text-sky-300">{((value || 0) * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-center text-[11px] font-mono text-slate-400">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                TP {validation.confusion_matrix?.true_positive ?? 0}
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                FP {validation.confusion_matrix?.false_positive ?? 0} / FN{' '}
                {validation.confusion_matrix?.false_negative ?? 0}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Top receivers */}
      <Panel
        icon={ShieldAlert}
        title="Highest-volume payees"
        note="Ranked by total inflow with the share of linked records the pipeline flagged."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Payee VPA</th>
                <th className="py-3 px-3 text-right">Inflow</th>
                <th className="py-3 px-3 text-right">Payments</th>
                <th className="py-3 px-3 text-right">Distinct senders</th>
                <th className="py-3 px-3 text-right">Flagged share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {topReceivers.map((r) => (
                <tr key={r.vpa} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-3 font-mono text-white">{r.vpa}</td>
                  <td className="py-3 px-3 text-right font-semibold text-emerald-300">
                    ₹{Number(r.volume || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{r.count}</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">{r.senders}</td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        r.fraud_ratio >= 0.6
                          ? 'bg-red-500/15 text-red-300 border-red-500/40'
                          : r.fraud_ratio > 0
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                          : 'bg-slate-900 text-slate-400 border-white/10'
                      }`}
                    >
                      {(r.fraud_ratio * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
              {!topReceivers.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No receiver statistics computed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            sample {analytics.sample_size || 0}
          </span>
          <span>base rate {analytics.fraud_base_rate_pct || 0}%</span>
          <span>generated {analytics.generated_at || '—'}</span>
          {stats?.graph && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              graph rebuild {stats.graph.build_ms?.toFixed(0)} ms
            </span>
          )}
        </div>
      </Panel>
    </motion.div>
  );
}
