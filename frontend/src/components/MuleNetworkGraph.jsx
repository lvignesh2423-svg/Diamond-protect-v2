import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Share2, 
  AlertCircle, 
  ShieldAlert, 
  Layers, 
  RotateCcw, 
  Users, 
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';

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
    <div className="space-y-8">
      {/* Overview Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/40 border border-purple-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2">
              <Network className="w-3.5 h-3.5" />
              NetworkX Graph Topology & Mule Ring Intelligence
            </div>
            <h2 className="text-2xl font-black text-white">Syndicate & Mule Network Visualizer</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Identifies organized financial crime rings: hub-and-spoke funnels (inflows drained within minutes) and circular wash-trading loops across UPI handles.
            </p>
          </div>
          <button
            onClick={fetchGraphData}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-purple-600/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Refresh Topology</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Interactive Node Grid / Visual Canvas */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-purple-400" />
                <span>Account Interaction Matrix</span>
              </h3>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Mule Hub
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Suspicious Mule
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Clean User
                </span>
              </div>
            </div>

            {loading ? (
              <div className="h-80 flex items-center justify-center text-slate-400 text-sm">
                Constructing transaction graph...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto p-1">
                {graphData.nodes.map((node) => {
                  const isHub = node.type === 'HUB_MULE';
                  const isMule = node.type === 'MULE_ACCOUNT';
                  const isMerchant = node.type === 'MERCHANT';
                  const isSelected = selectedNode?.id === node.id;

                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'border-sky-400 bg-sky-950/60 shadow-lg shadow-sky-500/20'
                          : isHub
                          ? 'border-red-600/70 bg-red-950/40 hover:bg-red-900/50'
                          : isMule
                          ? 'border-amber-600/60 bg-amber-950/30 hover:bg-amber-900/40'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
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
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Node Forensics */}
            {selectedNode && (
              <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-sky-500/30 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">Account Forensics: {selectedNode.label}</span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                    selectedNode.type === 'HUB_MULE'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {selectedNode.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div className="bg-slate-900 p-2 rounded-lg">
                    <div className="text-slate-400 text-[10px]">In-Degree (Senders)</div>
                    <div className="font-bold text-white mt-0.5">{selectedNode.in_degree} distinct users</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg">
                    <div className="text-slate-400 text-[10px]">Out-Degree (Cashouts)</div>
                    <div className="font-bold text-white mt-0.5">{selectedNode.out_degree} target accounts</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg">
                    <div className="text-slate-400 text-[10px]">Graph Role</div>
                    <div className="font-bold text-sky-400 mt-0.5">{selectedNode.type}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg">
                    <div className="text-slate-400 text-[10px]">Action Status</div>
                    <div className="font-bold text-amber-400 mt-0.5">Under Surveillance</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Mule Clusters & Circular Wash Rings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Top Detected Hub Mules */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Identified Hub Mule Accounts</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              High in-degree accounts receiving funds from victims and immediately draining over 75% in minutes.
            </p>

            <div className="space-y-3">
              {clusters.hub_mules && clusters.hub_mules.length > 0 ? (
                clusters.hub_mules.slice(0, 4).map((mule, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-red-900/40 hover:border-red-700/60 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-red-300">{mule.node}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40">
                        Drain: {(mule.drain_ratio * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 mt-2">
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
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Circular Laundering Rings (Cycles)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Accounts passing round-trip transactions to artificially inflate credit or obfuscate audit trails.
            </p>

            <div className="space-y-3">
              {clusters.circular_chains && clusters.circular_chains.length > 0 ? (
                clusters.circular_chains.map((chain, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-purple-900/40 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-purple-300">Ring #{idx + 1} ({chain.length}-Node Loop)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                        CIRCULAR DETECTED
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5 font-mono text-[11px] text-slate-300">
                      {chain.nodes.map((n, i) => (
                        <React.Fragment key={i}>
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">{n}</span>
                          {i < chain.nodes.length - 1 && <ArrowRight className="w-3 h-3 text-purple-400" />}
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
    </div>
  );
}
