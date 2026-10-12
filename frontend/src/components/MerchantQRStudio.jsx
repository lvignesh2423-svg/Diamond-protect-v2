import React, { useState } from 'react';
import { 
  ShieldCheck, 
  QrCode, 
  AlertTriangle, 
  Copy, 
  CheckCircle, 
  FileText, 
  Download, 
  RefreshCw,
  ExternalLink,
  Lock,
  Sparkles
} from 'lucide-react';

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
      // Auto-fill verifier for convenience
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
    <div className="space-y-8">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/60 via-indigo-950/40 to-slate-900 border border-sky-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              BIS Digital Payment Security Standard Implementation
            </div>
            <h2 className="text-2xl font-black text-white">Cryptographic QR Generator & Anti-Tamper Verifier</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Protects small merchants and street vendors against QR-replacement stickers, payment redirection, and spoofed beneficiary handles using HMAC-SHA256 signatures.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/25 flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto"
          >
            <QrCode className="w-4 h-4" />
            <span>Generate BIS Certified QR</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Merchant QR Creation & Display */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>Merchant Details & Cryptographic Registration</span>
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Merchant ID</label>
                  <input
                    type="text"
                    value={merchantForm.merchant_id}
                    onChange={(e) => setMerchantForm({ ...merchantForm, merchant_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Merchant Category (MCC)</label>
                  <input
                    type="text"
                    value={merchantForm.mcc}
                    onChange={(e) => setMerchantForm({ ...merchantForm, mcc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Business Name</label>
                <input
                  type="text"
                  value={merchantForm.merchant_name}
                  onChange={(e) => setMerchantForm({ ...merchantForm, merchant_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Merchant VPA</label>
                  <input
                    type="text"
                    value={merchantForm.vpa}
                    onChange={(e) => setMerchantForm({ ...merchantForm, vpa: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Preset Amount (Optional)</label>
                  <input
                    type="number"
                    value={merchantForm.amount}
                    onChange={(e) => setMerchantForm({ ...merchantForm, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer transition-colors"
              >
                {loading ? 'Minting Signed Payload...' : 'Update & Re-sign QR'}
              </button>
            </form>

            {generatedQR && (
              <div className="mt-6 pt-6 border-t border-slate-800 flex flex-col items-center">
                <div className="p-4 bg-white rounded-2xl shadow-2xl relative">
                  <img
                    src={generatedQR.qr_image_base64}
                    alt="Signed UPI QR Code"
                    className="w-52 h-52 object-contain"
                  />
                  <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-sky-600 text-[10px] text-white font-bold px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                    BIS Secured
                  </div>
                </div>

                <div className="mt-5 w-full bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 break-all space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300 font-sans font-semibold">
                    <span>Cryptographic Signature (HMAC-SHA256)</span>
                    <button
                      onClick={() => copyToClipboard(generatedQR.signature)}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-sky-300/80">{generatedQR.signature}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: QR Anti-Tamper & Phishing Scanner Lab */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Tamper & Phishing Detection Laboratory</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Simulate attacks like sticker swapping, fake cashback redirects, and unsigned payloads to observe instant BIS trust evaluation.
            </p>

            {/* Attack Loaders */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-[11px] text-slate-400 self-center">Inject Test Vector:</span>
              <button
                type="button"
                onClick={() => loadAttackPayload('tampered_sticker')}
                className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-xs hover:bg-red-900/60 transition-colors cursor-pointer"
              >
                🚨 Tampered Sticker
              </button>
              <button
                type="button"
                onClick={() => loadAttackPayload('phishing_link')}
                className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs hover:bg-amber-900/60 transition-colors cursor-pointer"
              >
                🌐 Fake Web Phishing
              </button>
              <button
                type="button"
                onClick={() => loadAttackPayload('unsigned')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-xs hover:bg-slate-700 transition-colors cursor-pointer"
              >
                ⚠️ Legacy Unsigned QR
              </button>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Claimed Merchant Name on Storefront / Board
                </label>
                <input
                  type="text"
                  value={verifyMerchantName}
                  onChange={(e) => setVerifyMerchantName(e.target.value)}
                  placeholder="e.g. Sharma Kirana & General Store"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Scanned Raw QR Payload or URL
                </label>
                <textarea
                  rows={4}
                  value={verifyPayload}
                  onChange={(e) => setVerifyPayload(e.target.value)}
                  placeholder="upi://pay?pa=... or https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono leading-relaxed"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={verifying || !verifyPayload}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50"
              >
                {verifying ? 'Verifying Integrity...' : 'Inspect QR Authenticity'}
              </button>
            </form>

            {/* Verification Verdict */}
            {verifyResult && (
              <div className={`mt-6 p-5 rounded-xl border transition-all ${
                verifyResult.trust_status === 'PHISHING_MALICIOUS'
                  ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-500/10'
                  : verifyResult.trust_status === 'WARNING'
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/10'
                  : 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
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
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 font-mono text-slate-300">
                    Penalty: +{verifyResult.score_penalty} pts
                  </span>
                </div>

                {verifyResult.reason && (
                  <p className="text-xs text-red-200 mb-3 bg-red-950/80 p-2.5 rounded-lg border border-red-800/80">
                    {verifyResult.reason}
                  </p>
                )}

                {verifyResult.issues && verifyResult.issues.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Identified Vulnerabilities:
                    </div>
                    {verifyResult.issues.map((issue, idx) => (
                      <div key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
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
    </div>
  );
}
