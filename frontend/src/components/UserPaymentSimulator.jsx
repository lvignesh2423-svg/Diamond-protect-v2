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
  Lock, 
  Camera, 
  CheckCircle2, 
  User, 
  HelpCircle,
  ArrowRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import CameraQRScanner from './CameraQRScanner';

export default function UserPaymentSimulator({ onTransactionEvaluated }) {
  // Direct user-entered fields
  const [formData, setFormData] = useState({
    receiver_vpa: '',
    account_number: '',
    amount: '',
    qr_scanned: false,
    raw_qr: '',
    qr_claimed_name: '',
    beneficiary_age_days: 180,
    time_since_beneficiary_added_sec: 86400,
    velocity_10m: 1,
    outflow_ratio_5m: 0.05,
    in_degree_1h: 2,
    ip_risk_score: 0.05
  });

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeQuickFill, setActiveQuickFill] = useState(null);

  // Parse scanned QR or pasted string
  const handleQRDetected = (qrContent) => {
    let parsedVpa = '';
    let parsedName = '';
    let parsedAmount = '';

    if (qrContent.startsWith('upi://pay?')) {
      try {
        const query = qrContent.split('upi://pay?')[1];
        const params = new URLSearchParams(query);
        parsedVpa = params.get('pa') || '';
        parsedName = params.get('pn') || '';
        parsedAmount = params.get('am') || '';
      } catch (e) {
        console.error('Error parsing QR:', e);
      }
    }

    setFormData(prev => ({
      ...prev,
      raw_qr: qrContent,
      qr_scanned: true,
      receiver_vpa: parsedVpa || prev.receiver_vpa,
      qr_claimed_name: parsedName || prev.qr_claimed_name || 'Merchant Scanned via Camera',
      amount: parsedAmount ? parseFloat(parsedAmount) : prev.amount
    }));
  };

  // Quick user verification templates
  const handleQuickFill = (type) => {
    setActiveQuickFill(type);
    if (type === 'chai_point') {
      setFormData({
        receiver_vpa: 'chaipoint@icici',
        account_number: '91882200192',
        amount: 150,
        qr_scanned: true,
        raw_qr: 'upi://pay?pa=chaipoint@icici&pn=Chai%20Point&mc=5812&mid=MID_CP_01&cu=INR&ts=1728000000&sig=VALID_SIG',
        qr_claimed_name: 'Chai Point Indiranagar',
        beneficiary_age_days: 350,
        time_since_beneficiary_added_sec: 86400,
        velocity_10m: 1,
        outflow_ratio_5m: 0.05,
        in_degree_1h: 2,
        ip_risk_score: 0.03
      });
    } else if (type === 'sticker_fraud') {
      setFormData({
        receiver_vpa: 'quickrefund_support_892@upi',
        account_number: '00291039481',
        amount: 2500,
        qr_scanned: true,
        raw_qr: 'upi://pay?pa=quickrefund_support_892@upi&pn=Support%20Kirana&am=2500.00&cu=INR',
        qr_claimed_name: 'Sharma Kirana Store (Sticker Over Counter)',
        beneficiary_age_days: 1,
        time_since_beneficiary_added_sec: 15,
        velocity_10m: 7,
        outflow_ratio_5m: 0.92,
        in_degree_1h: 9,
        ip_risk_score: 0.88
      });
    } else if (type === 'mule_hub') {
      setFormData({
        receiver_vpa: 'fastcash_winner8899@ybl',
        account_number: '55019283741',
        amount: 28000,
        qr_scanned: false,
        raw_qr: '',
        qr_claimed_name: 'Govt Electricity Helpdesk',
        beneficiary_age_days: 2,
        time_since_beneficiary_added_sec: 40,
        velocity_10m: 14,
        outflow_ratio_5m: 0.98,
        in_degree_1h: 24,
        ip_risk_score: 0.92
      });
    }
    setResult(null);
  };

  const handleEvaluate = async (e) => {
    e.preventDefault();
    if (!formData.receiver_vpa && !formData.account_number && !formData.raw_qr) {
      alert('Please enter a UPI ID, Account Number, or scan a QR code.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) || 0,
          receiver_id: formData.qr_claimed_name || formData.receiver_vpa || 'Direct Payee'
        })
      });
      const data = await res.json();
      setResult(data);
      if (onTransactionEvaluated) {
        onTransactionEvaluated(data);
      }

      if (data.risk_score < 35) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    } catch (err) {
      console.error('Error evaluating payment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Easy Direct User Entry & Camera Scanner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-5 space-y-6"
      >
        <div className="spatial-glass p-7 rounded-3xl relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Check UPI / QR Risk</h2>
                <div className="text-xs text-slate-400">Scan or type to see if it is safe to pay</div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live SafePay
            </span>
          </div>

          {/* Camera Scanner Trigger Button */}
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-500/30 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-sky-400" />
                <span>Scan Physical QR Code</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">Use your laptop or webcam</div>
            </div>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Open Camera</span>
            </button>
          </div>

          {/* Quick Real-Life Samples */}
          <div className="mb-6">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Try Real-World Examples</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('chai_point')}
                className={`p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                  activeQuickFill === 'chai_point'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/10 bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div className="font-bold text-[11px]">🟢 Clean Shop</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Chai Point</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('sticker_fraud')}
                className={`p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                  activeQuickFill === 'sticker_fraud'
                    ? 'border-red-500 bg-red-500/20 text-red-200'
                    : 'border-white/10 bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div className="font-bold text-[11px]">🔴 Fake QR</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Counter Sticker</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('mule_hub')}
                className={`p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                  activeQuickFill === 'mule_hub'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                }`}
              >
                <div className="font-bold text-[11px]">🔴 Mule Hub</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Rapid Drain</div>
              </button>
            </div>
          </div>

          {/* User Form */}
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Payee UPI ID (VPA)
              </label>
              <input
                type="text"
                value={formData.receiver_vpa}
                onChange={(e) => setFormData({ ...formData, receiver_vpa: e.target.value })}
                placeholder="e.g. merchant@icici or 9876543210@paytm"
                className="spatial-input w-full font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Number (Optional)
                </label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g. 09182390192"
                  className="spatial-input w-full font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g. 250"
                  className="spatial-input w-full font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Store / Person Claimed Name
              </label>
              <input
                type="text"
                value={formData.qr_claimed_name}
                onChange={(e) => setFormData({ ...formData, qr_claimed_name: e.target.value })}
                placeholder="e.g. Sharma Kirana Store, Rahul Verma..."
                className="spatial-input w-full"
              />
            </div>

            {formData.raw_qr && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-sky-400/30 text-[11px] font-mono text-slate-300 break-all">
                <span className="text-sky-400 font-bold block mb-1">Decoded QR String:</span>
                {formData.raw_qr}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600 hover:from-sky-300 hover:to-purple-500 text-slate-950 shadow-xl shadow-sky-500/25 cursor-pointer transition-all flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Scanning Anti-Fraud Network...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Analyze Fraud & Mule Risk</span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Right Column: Clear, Non-Technical Results Any Regular Citizen Can Understand */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="lg:col-span-7 space-y-6"
      >
        <AnimatePresence mode="wait">
          {!result && !loading && (
            <div className="spatial-glass p-12 rounded-3xl border border-dashed border-white/15 text-center flex flex-col items-center justify-center min-h-[460px]">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-4 shadow-lg">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ready to Verify</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Scan a QR code with your camera or enter a UPI ID and amount on the left. The system will tell you whether it is safe to enter your MPIN or if it is a fraud.
              </p>
            </div>
          )}

          {loading && (
            <div className="spatial-glass p-12 rounded-3xl text-center flex flex-col items-center justify-center min-h-[460px]">
              <div className="w-16 h-16 rounded-full border-4 border-sky-400/20 border-t-sky-400 animate-spin mb-5" />
              <h3 className="text-base font-bold text-white mb-1">Checking Safety Signals</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Inspecting merchant identity, money-mule activity, and AI explanation...
              </p>
            </div>
          )}

          {result && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-7 rounded-3xl transition-all ${
                result.risk_level === 'CRITICAL'
                  ? 'spatial-glass-critical'
                  : result.risk_level === 'WARNING'
                  ? 'spatial-glass border-amber-500/50 shadow-amber-500/10'
                  : 'spatial-glass-success'
              }`}
            >
              {/* Verdict Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-3.5">
                  {result.risk_level === 'CRITICAL' ? (
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 shadow-md">
                      <ShieldX className="w-7 h-7" />
                    </div>
                  ) : result.risk_level === 'WARNING' ? (
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-md">
                      <AlertTriangle className="w-7 h-7" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-md">
                      <ShieldCheck className="w-7 h-7" />
                    </div>
                  )}

                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      result.risk_level === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : result.risk_level === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {result.risk_level === 'CRITICAL' ? 'DANGER: FRAUD DETECTED' : result.risk_level === 'WARNING' ? 'CAUTION: SUSPICIOUS' : 'VERIFIED SAFE PAYMENT'}
                    </span>
                    <h3 className="text-2xl font-black text-white mt-1">
                      Risk Score: {result.risk_score} / 100
                    </h3>
                  </div>
                </div>

                <div className="bg-slate-950/80 px-4 py-2 rounded-xl border border-white/10 text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Transaction Reference</div>
                  <div className="text-xs font-mono font-bold text-sky-400">{result.txn_id}</div>
                </div>
              </div>

              {/* Simple Vernacular AI Explanation (For Everyday Users) */}
              <div className="mt-6 p-5 rounded-2xl bg-slate-950/80 border border-sky-400/40 relative">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-sky-300 uppercase tracking-wide">
                    Plain-Language Explanation (What this means for you)
                  </span>
                </div>
                <p className="text-sm text-slate-100 font-medium leading-relaxed">
                  "{result.ai_explanation}"
                </p>
              </div>

              {/* Triggered Reasons in Clear Language */}
              <div className="mt-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>Why this score was given</span>
                </h4>
                <div className="space-y-2">
                  {result.reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs p-3 rounded-xl bg-slate-950/60 border border-white/5 text-slate-200"
                    >
                      <span className="text-sky-400 font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Safe Action Recommendation */}
              <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-300">
                  <strong className="text-white">Action:</strong> {result.recommended_action}
                </div>

                {result.risk_level === 'CRITICAL' ? (
                  <button
                    type="button"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-red-600 text-white shadow-lg shadow-red-600/30 cursor-not-allowed uppercase"
                    disabled
                  >
                    DO NOT PAY (BLOCKED)
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer uppercase"
                  >
                    Safe to Pay (Enter MPIN)
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* System Camera Scanner Modal */}
      <CameraQRScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={handleQRDetected}
      />
    </div>
  );
}
