import React, { useCallback, useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  ShieldX,
  ShieldAlert,
  ShieldCheck,
  X,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import PaymentAnalysis from '../components/PaymentAnalysis';

const LEVEL_META = {
  CRITICAL: { chip: 'bg-red-500/15 text-red-300 border-red-500/40', icon: ShieldX, color: 'text-red-400' },
  WARNING: { chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: ShieldAlert, color: 'text-amber-400' },
  LOW_RISK: { chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', icon: ShieldCheck, color: 'text-emerald-400' }
};

const SCORE_COLORS = ['#10B981', '#10B981', '#10B981', '#10B981', '#F59E0B', '#F59E0B', '#F59E0B', '#F43F5E', '#F43F5E', '#F43F5E'];

function scoreColor(score) {
  return SCORE_COLORS[Math.min(9, Math.max(0, Math.floor((score || 0) / 10)))] || '#94A3B8';
}

function levelMeta(level) {
  return LEVEL_META[level] || LEVEL_META.LOW_RISK;
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return iso.replace('T', ' ').slice(0, 19);
    return d.toLocaleString(undefined, {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [justCleared, setJustCleared] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/history?limit=200');
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (item) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await api(`/api/history/${item.txn_id}`);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Delete all saved checks from your history? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api('/api/history', { method: 'DELETE' });
      setItems([]);
      setDetail(null);
      setJustCleared(true);
      setTimeout(() => setJustCleared(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  const stats = items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.volume += Number(item.amount || 0);
      if (item.risk_level === 'CRITICAL') acc.critical += 1;
      else if (item.risk_level === 'WARNING') acc.warning += 1;
      else acc.safe += 1;
      return acc;
    },
    { total: 0, volume: 0, critical: 0, warning: 0, safe: 0 }
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* List column */}
      <div className={`space-y-6 ${detail || detailLoading ? 'xl:col-span-5' : 'xl:col-span-12'}`}>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="spatial-glass p-7 rounded-3xl"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                <HistoryIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">My analysis history</h2>
                <div className="text-xs text-slate-400">
                  Every risk check you have run, archived in the database
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {items.length > 0 && (
                <button
                  onClick={clearHistory}
                  disabled={clearing}
                  className="px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {clearing ? 'Clearing...' : 'Clear history'}
                </button>
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Checks run', value: stats.total },
                { label: 'Flagged critical', value: stats.critical, tone: 'text-red-400' },
                { label: 'Warnings', value: stats.warning, tone: 'text-amber-400' },
                { label: 'Total value', value: `₹${stats.volume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }
              ].map((s) => (
                <div key={s.label} className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{s.label}</div>
                  <div className={`text-lg font-black ${s.tone || 'text-white'}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {justCleared && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Your analysis history was cleared.</span>
          </div>
        )}

        {loading ? (
          <div className="spatial-glass p-12 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <div className="w-10 h-10 rounded-full border-4 border-sky-400/20 border-t-sky-400 animate-spin" />
            <span>Loading your saved checks...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="spatial-glass p-12 rounded-3xl border border-dashed border-white/15 text-center flex flex-col items-center justify-center min-h-[320px]">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-4 shadow-lg">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">No checks saved yet</h3>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Head to Verify Payment and analyse a payee. Each check you run is archived here with its full
              five-stage breakdown so you can reopen it later.
            </p>
          </div>
        ) : (
          <div className="spatial-glass p-2 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                    <th className="px-4 py-3 font-bold">When</th>
                    <th className="px-4 py-3 font-bold">Payee VPA</th>
                    <th className="px-4 py-3 font-bold text-right">Amount</th>
                    <th className="px-4 py-3 font-bold">Score</th>
                    <th className="px-4 py-3 font-bold">Verdict</th>
                    <th className="px-4 py-3 font-bold hidden md:table-cell">QR</th>
                    <th className="px-4 py-3 font-bold hidden lg:table-cell">Graph role</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const meta = levelMeta(item.risk_level);
                    const LevelIcon = meta.icon;
                    const active = detail?.txn_id === item.txn_id;
                    return (
                      <tr
                        key={item.txn_id}
                        onClick={() => openDetail(item)}
                        className={`border-b border-white/5 last:border-0 cursor-pointer transition-colors ${
                          active ? 'bg-sky-500/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                          {fmtTime(item.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-white max-w-[200px] truncate">
                          {item.receiver_vpa || <span className="text-slate-600">(QR only)</span>}
                          {item.qr_claimed_name && (
                            <div className="text-[10px] text-slate-500 truncate">{item.qr_claimed_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-right text-slate-200 whitespace-nowrap">
                          ₹{Number(item.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black" style={{ color: scoreColor(item.risk_score) }}>
                              {item.risk_score}
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${item.risk_score}%`, background: scoreColor(item.risk_score) }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${meta.chip}`}>
                            <LevelIcon className="w-3 h-3" />
                            {item.risk_level === 'LOW_RISK' ? 'SAFE' : item.risk_level}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono hidden md:table-cell">
                          <span className={item.qr_status === 'PASS' ? 'text-emerald-400' : 'text-slate-500'}>
                            {item.qr_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono text-slate-400 hidden lg:table-cell max-w-[170px] truncate">
                          {item.graph_role}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail column */}
      <AnimatePresence mode="wait">
        {(detail || detailLoading) && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="xl:col-span-7 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Saved check</h3>
              <button
                onClick={() => {
                  setDetail(null);
                  setDetailLoading(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
            </div>

            {detailLoading ? (
              <div className="spatial-glass p-12 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 text-xs min-h-[420px]">
                <div className="w-10 h-10 rounded-full border-4 border-sky-400/20 border-t-sky-400 animate-spin" />
                <span>Loading the full staged analysis...</span>
              </div>
            ) : detail ? (
              <PaymentAnalysis result={detail.result} amount={detail.payload?.amount ?? 0} />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
