import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  QrCode, 
  Smartphone, 
  AlertTriangle, 
  Sparkles, 
  RefreshCw,
  Info,
  Lock,
  Radio,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function UserPaymentSimulator({ onTransactionEvaluated, presets = [] }) {
  const [formData, setFormData] = useState({
    sender_id: 'USR_1042',
    receiver_id: 'Chai Point Indiranagar',
    receiver_vpa: 'chaipoint@icici',
    amount: 180,
    qr_scanned: true,
    raw_qr: 'upi://pay?pa=chaipoint@icici&pn=Chai%20Point%20Indiranagar&mc=5812&mid=MID_CP_8812&cu=INR&ts=1728000000&sig=VALID_MOCK_SIG',
    qr_claimed_name: 'Chai Point Indiranagar',
    beneficiary_age_days: 280,
    time_since_beneficiary_added_sec: 86400,
    velocity_10m: 1,
    outflow_ratio_5m: 0.05,
    in_degree_1h: 2,
    ip_risk_score: 0.05,
    device: 'OnePlus 11 5G',
    location: 'Bengaluru'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activePreset, setActivePreset] = useState('scenario_normal');

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setFormData(prev => ({
      ...prev,
      ...preset.data
    }));
    setResult(null);
  };

  const handleEvaluate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      setResult(data);
      if (onTransactionEvaluated) {
        onTransactionEvaluated(data);
      }

      if (data.risk_score < 35) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 }
        });
      }
    } catch (err) {
      console.error('Error evaluating transaction:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Spatial Telemetry & Input Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="lg:col-span-5 space-y-6"
      >
        <div className="spatial-glass p-7 rounded-3xl relative overflow-hidden">
          {/* Spatial Header Glow */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/10">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Payment Telemetry</h2>
                <div className="text-[11px] text-slate-400">Pre-Authorization Interceptor</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-sky-500/20 text-sky-300 font-mono text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              UPI 2.0 Spatial
            </div>
          </div>

          {/* Quick Attack Vector Presets */}
          <div className="space-y-2 mb-6">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>One-Touch Simulation Presets</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`text-left p-3.5 rounded-2xl border text-xs transition-all duration-300 cursor-pointer ${
                    activePreset === preset.id
                      ? 'border-sky-400/80 bg-sky-500/15 text-white shadow-xl shadow-sky-500/15 translate-x-1'
                      : 'border-white/5 hover:border-white/15 bg-slate-900/40 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs tracking-wide flex items-center justify-between">
                    <span>{preset.title}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Parameters */}
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Claimed Payee / Storefront Label
              </label>
              <input
                type="text"
                value={formData.qr_claimed_name}
                onChange={(e) => setFormData({ ...formData, qr_claimed_name: e.target.value })}
                className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Beneficiary VPA
                </label>
                <input
                  type="text"
                  value={formData.receiver_vpa}
                  onChange={(e) => setFormData({ ...formData, receiver_vpa: e.target.value })}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-400 font-bold"
                  required
                />
              </div>
            </div>

            {/* Spatial Live Telemetry Sensor Badges */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Multi-Sensor Heuristics</span>
                <span className="text-sky-400 font-mono">DSCI Telemetry</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-400">Account Age</div>
                  <div className="font-semibold text-white mt-0.5">{formData.beneficiary_age_days} day(s)</div>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-400">Creation Delta</div>
                  <div className="font-semibold text-white mt-0.5">{formData.time_since_beneficiary_added_sec}s ago</div>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-400">10-Min Velocity</div>
                  <div className="font-semibold text-white mt-0.5">{formData.velocity_10m} attempts</div>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  <div className="text-[10px] text-slate-400">Rapid Outflow</div>
                  <div className="font-semibold text-white mt-0.5">{(formData.outflow_ratio_5m * 100).toFixed(0)}% drained</div>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl font-bold text-xs bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white shadow-xl shadow-sky-500/25 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4 tracking-wide"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Computing Spatial Risk Vector...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Run Pre-Payment Verification</span>
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>

      {/* Right Column: Spatial Holographic Decision Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="lg:col-span-7 space-y-6"
      >
        <AnimatePresence mode="wait">
          {!result && !loading && (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="spatial-glass p-12 rounded-3xl border border-dashed border-white/10 text-center flex flex-col items-center justify-center min-h-[460px]"
            >
              <div className="w-20 h-20 rounded-3xl bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-400 mb-5 shadow-2xl">
                <QrCode className="w-10 h-10 text-sky-400/70" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Spatial Decision Gateway Idle</h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Select a test scenario on the left panel or inject custom parameters. Diamond-Protect will synthesize real-time ML inference, BIS QR signatures, and Llama 3.2 explainability.
              </p>
            </motion.div>
          )}

          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="spatial-glass p-14 rounded-3xl text-center flex flex-col items-center justify-center min-h-[460px]"
            >
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-sky-400/20 border-t-sky-400 animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-purple-400/20 border-b-purple-400 animate-spin animate-reverse" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1.5">Analyzing Spatial Transaction Signals</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Verifying HMAC-SHA256 signatures, traversing NetworkX mule clusters, and generating vernacular AI advice...
              </p>
            </motion.div>
          )}

          {result && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className={`p-8 rounded-3xl transition-all duration-400 ${
                result.risk_level === 'CRITICAL'
                  ? 'spatial-glass-critical'
                  : result.risk_level === 'WARNING'
                  ? 'spatial-glass border-amber-500/50 shadow-amber-500/10'
                  : 'spatial-glass-success'
              }`}
            >
              {/* Verdict Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  {result.risk_level === 'CRITICAL' ? (
                    <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shadow-xl shadow-red-500/20">
                      <ShieldX className="w-8 h-8" />
                    </div>
                  ) : result.risk_level === 'WARNING' ? (
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/20">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full ${
                        result.risk_level === 'CRITICAL'
                          ? 'bg-red-500/25 text-red-200 border border-red-500/40'
                          : result.risk_level === 'WARNING'
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40'
                          : 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                      }`}>
                        {result.risk_level} INTERCEPT
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">IS 18000 Verified</span>
                    </div>
                    <h3 className="text-2xl font-black text-white mt-1 tracking-tight">
                      Composite Risk: {result.risk_score} / 100
                    </h3>
                  </div>
                </div>

                {/* Score Meters */}
                <div className="flex items-center gap-4 bg-slate-950/60 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">ML Confidence</div>
                    <div className="text-sm font-extrabold text-white">{result.ml_confidence}%</div>
                  </div>
                  <div className="h-7 w-px bg-white/10" />
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Rule Penalty</div>
                    <div className="text-sm font-extrabold text-white">+{result.rule_penalty}</div>
                  </div>
                </div>
              </div>

              {/* GenAI Vernacular Explainability */}
              <div className="mt-6 p-5 rounded-2xl bg-slate-950/70 border border-sky-400/30 relative overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span className="text-[10px] font-black tracking-widest text-sky-300 uppercase">
                    Diamond AI Risk Explainability (OpenRouter)
                  </span>
                </div>
                <p className="text-xs text-slate-100 leading-relaxed font-medium">
                  "{result.ai_explanation}"
                </p>
              </div>

              {/* Forensics Signals List */}
              <div className="mt-6">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>Telemetry Intercept Triggers</span>
                </h4>
                <div className="space-y-2">
                  {result.reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 text-xs p-3 rounded-xl bg-slate-950/50 border border-white/5 text-slate-200"
                    >
                      <span className="text-sky-400 font-bold mt-0.5">•</span>
                      <span className="leading-relaxed">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended Action Footer */}
              <div className="mt-7 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-300 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span><strong className="text-white">Protocol:</strong> {result.recommended_action}</span>
                </div>

                {result.risk_level === 'CRITICAL' ? (
                  <button
                    type="button"
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs bg-red-600/90 hover:bg-red-500 text-white shadow-xl shadow-red-600/30 cursor-not-allowed uppercase tracking-wider"
                    disabled
                  >
                    Payment Authorization Blocked
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30 cursor-pointer uppercase tracking-wider"
                  >
                    Proceed with Authentication
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
