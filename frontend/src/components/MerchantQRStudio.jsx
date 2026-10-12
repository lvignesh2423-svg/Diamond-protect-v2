import React, { useState } from 'react';
import { 
  ShieldCheck, 
  QrCode, 
  AlertTriangle, 
  Copy, 
  CheckCircle, 
  Lock, 
  Sparkles,
  ArrowRight,
  Shield,
  Layers
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function MerchantQRStudio() {
  const [merchantForm, setMerchantForm] = useState({
    merchant_id: 'MID_BLR_0928',
    merchant_name: 'Sharma Kirana & General Store',
    vpa: 'sharmakirana@sbi',
    amount: 350.0,
    mcc: '5411'
  });

  const [generatedQR, setGeneratedQR] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Verification tester state
  const [verifyPayload, setVerifyPayload] = useState('');
  const [verifyMerchantName, setVerifyMerchantName] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merchantForm)
      });
      const data = await res.json();
      setGeneratedQR(data);
      setVerifyPayload(data.raw_uri);
      setVerifyMerchantName(merchantForm.merchant_name);
    } catch (err) {
      console.error('Error generating QR:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setVerifying(true);
    try {
      const res = await fetch('/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_qr_content: verifyPayload,
          claimed_merchant_name: verifyMerchantName
        })
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch (err) {
      console.error('Error verifying QR:', err);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadAttackPayload = (type) => {
    if (type === 'tampered_sticker') {
      setVerifyMerchantName('Sharma Kirana & General Store');
      setVerifyPayload('upi://pay?pa=quickrefund_support_892@upi&pn=Sharma%20Kirana%20Support&mc=5411&am=500.00&cu=INR');
    } else if (type === 'phishing_link') {
      setVerifyMerchantName('Reliance Digital Tech');
      setVerifyPayload('https://upi-free-cashback-reward2026.net/claim?bonus=500');
    } else if (type === 'unsigned') {
      setVerifyMerchantName('Sharma Kirana & General Store');
      setVerifyPayload('upi://pay?pa=sharmakirana@sbi&pn=Sharma%20Kirana&mc=5411&am=350.00&cu=INR');
    }
    setVerifyResult(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Overview Banner */}
      <div className="spatial-glass p-7 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-[11px] font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              BIS Standard Cryptographic QR Minting (IS 18000)
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Cryptographic QR Mint & Anti-Tamper Verifier</h2>
            <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Equips merchants with tamper-proof HMAC-SHA256 signatures and protects street vendors against malicious counter-sticker swaps and payment redirection.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-xl shadow-sky-500/20 flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto tracking-wide"
          >
            <QrCode className="w-4 h-4" />
            <span>Generate Certified QR</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Merchant QR Registration */}
        <div className="lg:col-span-6 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 tracking-tight">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>Merchant Identity Parameters</span>
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Merchant ID</label>
                  <input
                    type="text"
                    value={merchantForm.merchant_id}
                    onChange={(e) => setMerchantForm({ ...merchantForm, merchant_id: e.target.value })}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Category Code (MCC)</label>
                  <input
                    type="text"
                    value={merchantForm.mcc}
                    onChange={(e) => setMerchantForm({ ...merchantForm, mcc: e.target.value })}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Storefront Name</label>
                <input
                  type="text"
                  value={merchantForm.merchant_name}
                  onChange={(e) => setMerchantForm({ ...merchantForm, merchant_name: e.target.value })}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Bank VPA</label>
                  <input
                    type="text"
                    value={merchantForm.vpa}
                    onChange={(e) => setMerchantForm({ ...merchantForm, vpa: e.target.value })}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Preset Amount (₹)</label>
                  <input
                    type="number"
                    value={merchantForm.amount}
                    onChange={(e) => setMerchantForm({ ...merchantForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-slate-800/80 hover:bg-slate-700/80 text-white border border-white/10 cursor-pointer transition-colors"
              >
                {loading ? 'Minting Signed Payload...' : 'Re-Sign Cryptographic Payload'}
              </button>
            </form>

            {generatedQR && (
              <div className="mt-7 pt-6 border-t border-white/10 flex flex-col items-center">
                <div className="p-4 bg-white rounded-3xl shadow-2xl relative">
                  <img
                    src={generatedQR.qr_image_base64}
                    alt="Signed UPI QR Code"
                    className="w-48 h-48 object-contain"
                  />
                  <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-sky-600 text-[10px] text-white font-black px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                    BIS Secured
                  </div>
                </div>

                <div className="mt-5 w-full bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 text-[11px] font-mono text-slate-400 break-all space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300 font-sans font-semibold">
                    <span>Cryptographic HMAC Signature</span>
                    <button
                      onClick={() => copyToClipboard(generatedQR.signature)}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-sky-300/90">{generatedQR.signature}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: QR Anti-Tamper & Phishing Scanner Lab */}
        <div className="lg:col-span-6 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2 tracking-tight">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Anti-Tamper & Phishing Inspection Laboratory</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Inject attack vectors like glued counterfeit stickers, legacy unsigned payloads, or phishing URLs to observe instant spatial trust isolation.
            </p>

            {/* Quick Attack Vector Triggers */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-[11px] text-slate-400 self-center">Inject Vector:</span>
              <button
                type="button"
                onClick={() => loadAttackPayload('tampered_sticker')}
                className="px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs hover:bg-red-500/25 transition-colors cursor-pointer"
              >
                🚨 Tampered Sticker
              </button>
              <button
                type="button"
                onClick={() => loadAttackPayload('phishing_link')}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs hover:bg-amber-500/25 transition-colors cursor-pointer"
              >
                🌐 Web Phishing
              </button>
              <button
                type="button"
                onClick={() => loadAttackPayload('unsigned')}
                className="px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/10 text-slate-300 text-xs hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                ⚠️ Legacy Unsigned
              </button>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Storefront Physical Nameplate
                </label>
                <input
                  type="text"
                  value={verifyMerchantName}
                  onChange={(e) => setVerifyMerchantName(e.target.value)}
                  placeholder="e.g. Sharma Kirana & General Store"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Extracted QR Payload
                </label>
                <textarea
                  rows={4}
                  value={verifyPayload}
                  onChange={(e) => setVerifyPayload(e.target.value)}
                  placeholder="upi://pay?pa=... or https://..."
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-3.5 text-xs text-white font-mono leading-relaxed focus:border-sky-400 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={verifying || !verifyPayload}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50 tracking-wide"
              >
                {verifying ? 'Inspecting Cryptographic Integrity...' : 'Evaluate Payload Authenticity'}
              </button>
            </form>

            {/* Verdict Output Box */}
            {verifyResult && (
              <div className={`mt-6 p-6 rounded-2xl border transition-all ${
                verifyResult.trust_status === 'PHISHING_MALICIOUS'
                  ? 'spatial-glass-critical'
                  : verifyResult.trust_status === 'WARNING'
                  ? 'spatial-glass border-amber-500/50'
                  : 'spatial-glass-success'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {verifyResult.trust_status === 'PHISHING_MALICIOUS' ? (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    ) : verifyResult.trust_status === 'WARNING' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="font-extrabold text-sm text-white">
                      Verdict: {verifyResult.trust_status}
                    </span>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full bg-slate-950/80 border border-white/10 font-mono text-slate-300">
                    Penalty: +{verifyResult.score_penalty}
                  </span>
                </div>

                {verifyResult.reason && (
                  <p className="text-xs text-red-200 mb-3 bg-red-950/80 p-3 rounded-xl border border-red-800/80 leading-relaxed">
                    {verifyResult.reason}
                  </p>
                )}

                {verifyResult.issues && verifyResult.issues.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Identified Attack Anomalies:
                    </div>
                    {verifyResult.issues.map((issue, idx) => (
                      <div key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                        <span className="text-red-400 font-bold">•</span>
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
