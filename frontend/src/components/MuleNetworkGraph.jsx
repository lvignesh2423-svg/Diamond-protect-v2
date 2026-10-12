import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Share2, 
  ShieldAlert, 
  Layers, 
  RotateCcw, 
  ArrowRight,
  TrendingDown,
  Info,
  Radio,
  Eye
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function MuleNetworkGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [clusters, setClusters] = useState({ hub_mules: [], circular_chains: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    fetchGraphData();
  }, []);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const [graphRes, clusterRes] = await Promise.all([
        fetch('/api/graph/visualization?limit=40'),
        fetch('/api/graph/mule-clusters')
      ]);
      const gData = await graphRes.json();
      const cData = await clusterRes.json();
      setGraphData(gData);
      setClusters(cData);
    } catch (err) {
      console.error('Error fetching graph info:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Overview Card */}
      <div className="spatial-glass p-7 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 text-[11px] font-semibold mb-3">
              <Network className="w-3.5 h-3.5" />
              NetworkX Graph Topology & Mule Syndicates
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Syndicate & Mule Network Visualizer</h2>
            <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Unmasks multi-tiered money-mule networks, identifying rapid hub drain points and wash-trading laundering loops across UPI handles.
            </p>
          </div>
          <button
            onClick={fetchGraphData}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xl shadow-purple-600/25 tracking-wide"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Re-Sync Graph Topology</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Col: Interactive Node Grid / Visual Canvas */}
        <div className="lg:col-span-7 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2 tracking-tight">
                <Share2 className="w-4 h-4 text-purple-400" />
                <span>Account Interaction Matrix</span>
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" /> Hub Mule
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" /> Mule Account
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" /> Clean User
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-80 flex items-center justify-center text-slate-400 text-xs">
                Computing directed network topology...
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
                        <span>{node.type}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          isHub ? 'bg-red-500 animate-ping' : isMule ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                      </div>
                      <div className="font-bold text-xs text-white truncate mt-1">
                        {node.label}
                      </div>
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
                        <span>In: <strong className="text-white">{node.in_degree}</strong></span>
                        <span>•</span>
                        <span>Out: <strong className="text-white">{node.out_degree}</strong></span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Selected Node Forensics */}
            {selectedNode && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 p-5 rounded-2xl bg-slate-950/80 border border-sky-400/30 text-xs"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white text-sm">Account Forensics: {selectedNode.label}</span>
                  <span className={`px-2.5 py-0.5 rounded-full font-mono text-[10px] ${
                    selectedNode.type === 'HUB_MULE'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {selectedNode.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">In-Degree (Senders)</div>
                    <div className="font-bold text-white mt-0.5">{selectedNode.in_degree} unique payers</div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">Out-Degree (Cashouts)</div>
                    <div className="font-bold text-white mt-0.5">{selectedNode.out_degree} drain nodes</div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">Graph Role</div>
                    <div className="font-bold text-sky-400 mt-0.5">{selectedNode.type}</div>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5">
                    <div className="text-slate-400 text-[10px]">Surveillance Status</div>
                    <div className="font-bold text-amber-400 mt-0.5">High Priority Flag</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Col: Mule Clusters & Circular Wash Rings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Top Detected Hub Mules */}
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Identified Hub Mule Accounts</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              High in-degree accounts receiving funds from victims and immediately draining over 75% in minutes.
            </p>

            <div className="space-y-3">
              {clusters.hub_mules && clusters.hub_mules.length > 0 ? (
                clusters.hub_mules.slice(0, 4).map((mule, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-red-500/20 hover:border-red-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-red-300">{mule.node}</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                        Drain: {(mule.drain_ratio * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                      <div>
                        <span>Victims: </span>
                        <strong className="text-white">{mule.in_degree}</strong>
                      </div>
                      <div>
                        <span>Inflow: </span>
                        <strong className="text-emerald-400">₹{mule.total_inflow.toLocaleString()}</strong>
                      </div>
                      <div>
                        <span>Outflow: </span>
                        <strong className="text-red-400">₹{mule.total_outflow.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 text-center py-4">No active hub mules detected.</div>
              )}
            </div>
          </div>

          {/* Circular Wash Trading Rings */}
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2 tracking-tight">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Circular Laundering Rings (Cycles)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Accounts passing round-trip transactions to artificially inflate credit or obfuscate audit trails.
            </p>

            <div className="space-y-3">
              {clusters.circular_chains && clusters.circular_chains.length > 0 ? (
                clusters.circular_chains.map((chain, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-purple-500/20 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="font-semibold text-purple-300">Ring #{idx + 1} ({chain.length}-Node Cycle)</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                        WASH LOOP DETECTED
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
