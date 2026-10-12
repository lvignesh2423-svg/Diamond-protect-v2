import React, { useCallback, useEffect, useState } from 'react';
import {
  Network,
  Share2,
  ShieldAlert,
  Layers,
  RotateCcw,
  ArrowRight,
  Activity,
  AlertCircle,
  Timer
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

const tooltipStyle = {
  backgroundColor: 'rgba(5, 7, 14, 0.95)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  fontSize: '11px',
  color: '#F1F5F9'
};

const axisStyle = { fontSize: 10, fill: '#94A3B8' };

const ROLE_BADGES = {
  HUB_MULE: 'bg-red-500/15 text-red-300 border-red-500/40',
  HIGH_INFLOW_BENEFICIARY: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  CASH_OUT_NODE: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
  ROUTINE_BENEFICIARY: 'bg-slate-800 text-slate-300 border-white/10',
  UNOBSERVED: 'bg-slate-800 text-slate-400 border-white/10'
};

export default function MuleNetworkGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [clusters, setClusters] = useState({ hub_mules: [], circular_chains: [] });
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [viz, ringData] = await Promise.all([
        api('/api/graph/visualization?limit=40'),
        api('/api/graph/mule-clusters')
      ]);
      setGraphData({ nodes: viz.nodes || [], edges: viz.edges || [] });
      setClusters(ringData);
      setMeta({
        build_ms: viz.build_ms,
        stale: viz.stale,
        degree_distribution: viz.degree_distribution || [],
        cycle_search: ringData.cycle_search || {},
        total_nodes: ringData.total_nodes,
        total_edges: ringData.total_edges
      });
      setSelectedNode(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  const hubMules = clusters.hub_mules || [];
  const confirmedHubs = hubMules.filter((m) => m.role === 'HUB_MULE');
  const highInflow = hubMules.filter((m) => m.role !== 'HUB_MULE');
  const rings = clusters.circular_chains || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Overview */}
      <div className="spatial-glass p-7 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 text-[11px] font-semibold mb-3">
              <Network className="w-3.5 h-3.5" />
              NetworkX directed money-flow topology
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Mule syndicate visualiser</h2>
            <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Projects the ledger into a directed graph, ranks hub accounts by drain behaviour and enumerates
              strongly-connected wash-trading rings of 3 to 6 nodes.
            </p>

            {meta && (
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-sky-400" />
                  rebuild {meta.build_ms?.toFixed(0)} ms
                </span>
                <span>{meta.total_nodes} nodes</span>
                <span>{meta.total_edges} edges</span>
                <span>
                  cycle search {meta.cycle_search?.elapsed_ms?.toFixed(1)} ms
                  {meta.cycle_search?.truncated ? ' (bounded)' : ''}
                </span>
                <span className={meta.stale ? 'text-amber-300' : 'text-emerald-300'}>
                  {meta.stale ? 'refresh pending' : 'graph synchronised'}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={fetchGraphData}
            disabled={loading}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xl shadow-purple-600/25 tracking-wide disabled:opacity-60"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Rebuilding...' : 'Re-sync graph topology'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: node matrix */}
        <div className="lg:col-span-7 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
                <Share2 className="w-4 h-4 text-purple-400" />
                <span>Account interaction matrix</span>
              </h3>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Hub mule
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> High inflow
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Routine
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-80 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                <div className="w-10 h-10 rounded-full border-4 border-purple-400/20 border-t-purple-400 animate-spin" />
                <span>Projecting the ledger into a directed graph...</span>
              </div>
            ) : graphData.nodes.length === 0 ? (
              <div className="h-80 flex items-center justify-center text-slate-500 text-xs">
                No nodes to display. Upload a dataset to build the topology.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto p-1">
                {graphData.nodes.map((node) => {
                  const isHub = node.type === 'HUB_MULE';
                  const isMule = node.type === 'MULE_ACCOUNT';
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'border-sky-400 bg-sky-500/20 shadow-xl shadow-sky-500/25 ring-1 ring-sky-400'
                          : isHub
                          ? 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20'
                          : isMule
                          ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'border-white/5 bg-slate-900/40 hover:border-white/15'
                      }`}
                    >
                      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span className="truncate">{node.type}</span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isHub ? 'bg-red-500 animate-ping' : isMule ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="font-bold text-xs text-white truncate mt-1">{node.label}</div>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
                        <span>
                          In: <strong className="text-white">{node.in_degree}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Out: <strong className="text-white">{node.out_degree}</strong>
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 p-5 rounded-2xl bg-slate-950/80 border border-sky-400/30 text-xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white text-sm">Account forensics: {selectedNode.label}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] border ${
                      ROLE_BADGES[selectedNode.type] || ROLE_BADGES.UNOBSERVED
                    }`}
                  >
                    {selectedNode.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">In-degree (payers)</div>
                    <div className="font-bold text-white mt-0.5">{selectedNode.in_degree}</div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">Out-degree (cash-outs)</div>
                    <div className="font-bold text-white mt-0.5">{selectedNode.out_degree}</div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">Topology role</div>
                    <div className="font-bold text-sky-400 mt-0.5">{selectedNode.type}</div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">Total degree</div>
                    <div className="font-bold text-white mt-0.5">
                      {(selectedNode.in_degree || 0) + (selectedNode.out_degree || 0)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Degree distribution */}
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Degree distribution</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              How many accounts sit at each degree bucket. A long tail of high-degree nodes is the signature of
              collection hubs rather than a normal peer-to-peer graph.
            </p>
            <div className="h-56">
              {meta?.degree_distribution?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={meta.degree_distribution} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fill: '#94A3B8', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                    <Bar dataKey="count" name="Accounts" fill="#818CF8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  No degree distribution computed yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: clusters */}
        <div className="lg:col-span-5 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Confirmed hub mule accounts</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Nodes flagged by the hub detector: high in-degree from distinct payers with most of that value leaving
              again within minutes.
            </p>

            <div className="space-y-3">
              {loading ? (
                <div className="text-xs text-slate-500 text-center py-4">Scoring hub candidates...</div>
              ) : confirmedHubs.length ? (
                confirmedHubs.slice(0, 5).map((mule, idx) => (
                  <div
                    key={`${mule.node}-${idx}`}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-red-500/20 hover:border-red-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-red-300 truncate">{mule.node}</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">
                        Drain {(mule.drain_ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                      <div>
                        <span>Payers: </span>
                        <strong className="text-white">{mule.in_degree}</strong>
                      </div>
                      <div>
                        <span>Inflow: </span>
                        <strong className="text-emerald-400">₹{Number(mule.total_inflow || 0).toLocaleString()}</strong>
                      </div>
                      <div>
                        <span>Outflow: </span>
                        <strong className="text-red-400">₹{Number(mule.total_outflow || 0).toLocaleString()}</strong>
                      </div>
                    </div>
                    {typeof mule.fraud_share === 'number' && (
                      <div className="mt-2 text-[10px] text-slate-500 font-mono">
                        fraud share {(mule.fraud_share * 100).toFixed(0)}% of linked records
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-4">No hub mules detected in the ledger.</div>
              )}
            </div>

            {highInflow.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-2">
                  High-inflow beneficiaries (not draining)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {highInflow.slice(0, 8).map((m) => (
                    <span
                      key={m.node}
                      className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-amber-500/20 text-[10px] font-mono text-amber-200 truncate max-w-[160px]"
                      title={m.node}
                    >
                      {m.node}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Circular laundering rings</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Strongly-connected components of 3 to 6 accounts passing value round-trip to launder or inflate credit.
            </p>

            <div className="space-y-3">
              {loading ? (
                <div className="text-xs text-slate-500 text-center py-4">Enumerating cycles...</div>
              ) : rings.length ? (
                rings.map((chain, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-950/60 border border-purple-500/20 text-xs">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-semibold text-purple-300">
                        Ring #{idx + 1} ({chain.length}-node cycle)
                      </span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                        WASH LOOP
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-2 font-mono text-[11px] text-slate-200">
                      {chain.nodes.map((n, i) => (
                        <React.Fragment key={i}>
                          <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-white/5">{n}</span>
                          {i < chain.nodes.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-purple-400" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-4">No circular cycles detected.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
