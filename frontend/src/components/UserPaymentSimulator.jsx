import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  QrCode, 
  Smartphone, 
  Building2, 
  AlertTriangle, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Info,
  Lock
} from 'lucide-react';
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

      if (data.risk_score < 30) {
        confetti({
          particleCount: 50,
          spread: 60,
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Interactive Simulation Control */}
      <div className="lg:col-span-5 space-y-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <Smartphone className="w-5 h-5 text-sky-400" />
              <span>Simulated Payment Interface</span>
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-sky-950 border border-sky-800/60 text-sky-300 font-mono">
              UPI 2.0 Live
            </span>
          </div>

          <p className="text-sm text-slate-400 mb-6">
            Test how Diamond-Protect analyzes real-time signals, flags phishing QRs, and intercepts mule rings before MPIN entry.
          </p>

          {/* Quick Attack Presets */}
          <div className="space-y-2 mb-6">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              One-Click Judge Demo Scenarios
            </label>
            <div className="grid grid-cols-1 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`text-left p-3 rounded-xl border text-sm transition-all duration-200 ${
                    activePreset === preset.id
                      ? 'border-sky-500 bg-sky-950/40 text-white shadow-lg shadow-sky-500/10'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300'
                  }`}
                >
                  <div className="font-semibold text-xs tracking-wide">{preset.title}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Input Form */}
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Claimed Merchant / Beneficiary Name
              </label>
              <input
                type="text"
                value={formData.qr_claimed_name}
                onChange={(e) => setFormData({ ...formData, qr_claimed_name: e.target.value })}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payee VPA (UPI ID)
                </label>
                <input
                  type="text"
                  value={formData.receiver_vpa}
                  onChange={(e) => setFormData({ ...formData, receiver_vpa: e.target.value })}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500 font-semibold"
                  required
                />
              </div>
            </div>

            {/* Advanced Telemetry Accordion / Toggles */}
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                <span>Underlying Network & Behavioral Telemetry</span>
                <span className="text-[10px] text-sky-400 font-mono">DSCI / BIS Signals</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-slate-400">Beneficiary Age</div>
                  <div className="font-semibold text-white mt-0.5">{formData.beneficiary_age_days} day(s)</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-slate-400">Added Seconds Ago</div>
                  <div className="font-semibold text-white mt-0.5">{formData.time_since_beneficiary_added_sec}s</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-slate-400">10-Min Velocity</div>
                  <div className="font-semibold text-white mt-0.5">{formData.velocity_10m} txns</div>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="text-slate-400">5-Min Outflow Drain</div>
                  <div className="font-semibold text-white mt-0.5">{(formData.outflow_ratio_5m * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-purple-500 text-white shadow-lg shadow-sky-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Intercepting & Analyzing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Pre-Payment Security</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Pre-Payment Decision Screen (What the User Sees) */}
      <div className="lg:col-span-7 space-y-6">
        {!result && !loading && (
          <div className="glass-panel p-10 rounded-2xl border border-dashed border-slate-800 text-center flex flex-col items-center justify-center h-full min-h-[420px]">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4">
              <QrCode className="w-8 h-8 text-sky-400/80" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Awaiting Payment Intent</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Select a demo scenario on the left or enter transaction parameters, then click <strong className="text-sky-300">"Verify Pre-Payment Security"</strong> to view real-time explainable risk intelligence.
            </p>
          </div>
        )}

        {loading && (
          <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center min-h-[420px]">
            <div className="w-16 h-16 rounded-full border-4 border-sky-500/30 border-t-sky-400 animate-spin mb-6"></div>
            <h3 className="text-lg font-bold text-white mb-2">Real-Time Risk Engine Active</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Executing BIS cryptographic signature verification, graph mule traversal, random forest inference & Llama AI explainability...
            </p>
          </div>
        )}

        {result && (
          <div className={`rounded-2xl transition-all duration-300 p-7 ${
            result.risk_level === 'CRITICAL'
              ? 'glass-panel-danger'
              : result.risk_level === 'WARNING'
              ? 'glass-panel border-amber-500/40 shadow-amber-500/10'
              : 'glass-panel-success'
          }`}>
            {/* Header Status Badge */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                {result.risk_level === 'CRITICAL' ? (
                  <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-500/60 flex items-center justify-center text-red-400">
                    <ShieldX className="w-7 h-7" />
                  </div>
                ) : result.risk_level === 'WARNING' ? (
                  <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/60 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      result.risk_level === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : result.risk_level === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {result.risk_level} ALERT
                    </span>
                    <span className="text-xs text-slate-400">BIS Standard Check</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white mt-1">
                    Risk Assessment: {result.risk_score} / 100
                  </h3>
                </div>
              </div>

              {/* Score Meter Radial */}
              <div className="flex items-center gap-3 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800">
                <div className="text-right">
                  <div className="text-[11px] text-slate-400 uppercase">ML Confidence</div>
                  <div className="text-sm font-bold text-white">{result.ml_confidence}%</div>
                </div>
                <div className="h-8 w-px bg-slate-800"></div>
                <div>
                  <div className="text-[11px] text-slate-400 uppercase">Rule Penalty</div>
                  <div className="text-sm font-bold text-white">{result.rule_penalty} pts</div>
                </div>
              </div>
            </div>

            {/* AI Explainability Box (OpenRouter / Llama 3.2 Powered) */}
            <div className="mt-6 p-4 rounded-xl bg-slate-900/90 border border-sky-500/30 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold tracking-wide text-sky-300 uppercase">
                  Diamond-Protect AI Explainability (Indian Context)
                </span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed font-sans font-medium">
                "{result.ai_explanation}"
              </p>
            </div>

            {/* Triggered Red Flags */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>Detection Signals & Forensics</span>
              </h4>
              <div className="space-y-2">
                {result.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300"
                  >
                    <span className="text-sky-400 font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Action & Protective Controls */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span><strong>Recommendation:</strong> {result.recommended_action}</span>
              </div>

              {result.risk_level === 'CRITICAL' ? (
                <button
                  type="button"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 cursor-not-allowed uppercase tracking-wider"
                  disabled
                >
                  Transaction Blocked
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer uppercase tracking-wider"
                >
                  Authorize Payment (Enter MPIN)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
