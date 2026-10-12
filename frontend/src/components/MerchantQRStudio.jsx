import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  AlertTriangle,
  Copy,
  CheckCircle,
  Lock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

const EMPTY_MERCHANT = {
  merchant_id: '',
  merchant_name: '',
  vpa: '',
  amount: '',
  mcc: '0000'
};

export default function MerchantQRStudio() {
  const [merchantForm, setMerchantForm] = useState(EMPTY_MERCHANT);
  const [generatedQR, setGeneratedQR] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const [verifyPayload, setVerifyPayload] = useState('');
  const [verifyMerchantName, setVerifyMerchantName] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const update = (patch) => setMerchantForm((prev) => ({ ...prev, ...patch }));

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api('/api/qr/generate', {
        method: 'POST',
        body: {
          merchant_id: merchantForm.merchant_id.trim(),
          merchant_name: merchantForm.merchant_name.trim(),
          vpa: merchantForm.vpa.trim(),
          amount: merchantForm.amount === '' ? null : parseFloat(merchantForm.amount),
          mcc: merchantForm.mcc.trim() || '0000'
        }
      });
      setGeneratedQR(data);
      setVerifyPayload(data.raw_uri);
      setVerifyMerchantName(merchantForm.merchant_name.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setVerifyError(null);
    setVerifying(true);
    try {
      const data = await api('/api/qr/verify', {
        method: 'POST',
        body: {
          raw_qr_content: verifyPayload.trim(),
          claimed_merchant_name: verifyMerchantName.trim() || null
        }
      });
      setVerifyResult(data);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verdictTone =
    verifyResult?.trust_status === 'PHISHING_MALICIOUS'
      ? 'critical'
      : verifyResult?.trust_status === 'WARNING'
      ? 'warning'
      : 'ok';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Overview banner */}
      <div className="spatial-glass p-7 rounded-3xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-[11px] font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              BIS IS 18000 cryptographic QR minting
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Signed QR mint &amp; anti-tamper verifier
            </h2>
            <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Mints an HMAC-SHA256 signature over the canonical payee tuple, then verifies any pasted payload for
              signature validity, scheme, beneficiary mismatch and suspicious handle patterns.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-bold text-xs shadow-xl shadow-sky-500/20 flex items-center gap-2 cursor-pointer transition-all self-start md:self-auto tracking-wide disabled:opacity-60"
          >
            <QrCode className="w-4 h-4" />
            <span>{loading ? 'Minting...' : 'Generate signed QR'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: merchant parameters */}
        <div className="lg:col-span-6 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 tracking-tight">
              <Lock className="w-4 h-4 text-sky-400" />
              <span>Merchant identity parameters</span>
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Merchant ID</label>
                  <input
                    type="text"
                    value={merchantForm.merchant_id}
                    onChange={(e) => update({ merchant_id: e.target.value })}
                    placeholder="MID assigned by the acquirer"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Category code (MCC)</label>
                  <input
                    type="text"
                    value={merchantForm.mcc}
                    onChange={(e) => update({ mcc: e.target.value })}
                    placeholder="0000"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-400 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Storefront nameplate</label>
                <input
                  type="text"
                  value={merchantForm.merchant_name}
                  onChange={(e) => update({ merchant_name: e.target.value })}
                  placeholder="Name printed on the shop board"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Collector VPA</label>
                  <input
                    type="text"
                    value={merchantForm.vpa}
                    onChange={(e) => update({ vpa: e.target.value })}
                    placeholder="shop@bank"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-sky-400 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Preset amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={merchantForm.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                    placeholder="leave blank for open amount"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-slate-800/80 hover:bg-slate-700/80 text-white border border-white/10 cursor-pointer transition-colors disabled:opacity-60"
              >
                {loading ? 'Minting signed payload...' : 'Sign cryptographic payload'}
              </button>
            </form>

            {generatedQR && (
              <div className="mt-7 pt-6 border-t border-white/10 flex flex-col items-center">
                <div className="p-4 bg-white rounded-3xl shadow-2xl relative">
                  <img
                    src={generatedQR.qr_image_base64}
                    alt="Signed UPI QR code"
                    className="w-48 h-48 object-contain"
                  />
                  <div className="absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 bg-sky-600 text-[10px] text-white font-black px-3.5 py-0.5 rounded-full uppercase tracking-wider shadow-lg">
                    BIS secured
                  </div>
                </div>

                <div className="mt-5 w-full bg-slate-950/80 p-3.5 rounded-2xl border border-white/10 text-[11px] font-mono text-slate-400 break-all space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300 font-sans font-semibold">
                    <span>HMAC-SHA256 signature</span>
                    <button
                      onClick={() => copyToClipboard(generatedQR.signature)}
                      className="text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-sky-300/90">{generatedQR.signature}</div>
                  <div className="text-slate-500 break-all">{generatedQR.raw_uri}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: verifier */}
        <div className="lg:col-span-6 space-y-6">
          <div className="spatial-glass p-7 rounded-3xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2 tracking-tight">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Anti-tamper &amp; phishing inspection</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Paste any payload you were handed - a signed <span className="font-mono">upi://pay</span> string, a bare
              VPA, or a URL. Every check reports its own verdict, evidence and severity.
            </p>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Storefront physical nameplate
                </label>
                <input
                  type="text"
                  value={verifyMerchantName}
                  onChange={(e) => setVerifyMerchantName(e.target.value)}
                  placeholder="Name as printed on the shop board"
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Extracted QR payload</label>
                <textarea
                  rows={4}
                  value={verifyPayload}
                  onChange={(e) => setVerifyPayload(e.target.value)}
                  placeholder="upi://pay?pa=...&amp;sig=... or https://..."
                  className="w-full bg-slate-950/60 border border-white/10 rounded-2xl p-3.5 text-xs text-white font-mono leading-relaxed focus:border-sky-400 focus:outline-none"
                  required
                />
              </div>

              {verifyError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || !verifyPayload}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-50 tracking-wide"
              >
                {verifying ? 'Inspecting cryptographic integrity...' : 'Evaluate payload authenticity'}
              </button>
            </form>

            {verifyResult && (
              <div
                className={`mt-6 p-6 rounded-2xl border transition-all ${
                  verdictTone === 'critical'
                    ? 'spatial-glass-critical'
                    : verdictTone === 'warning'
                    ? 'spatial-glass border-amber-500/50'
                    : 'spatial-glass-success'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {verdictTone === 'critical' ? (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    ) : verdictTone === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="font-extrabold text-sm text-white">Verdict: {verifyResult.trust_status}</span>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full bg-slate-950/80 border border-white/10 font-mono text-slate-300">
                    Penalty: +{verifyResult.score_penalty}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  {[
                    ['Payee (pa)', verifyResult.pa || '—'],
                    ['Signed name (pn)', verifyResult.pn || '—'],
                    ['Merchant ID', verifyResult.mid || '—']
                  ].map(([label, value]) => (
                    <div key={label} className="p-2 rounded-xl bg-slate-950/70 border border-white/10">
                      <div className="text-[9px] uppercase font-bold text-slate-500">{label}</div>
                      <div className="text-[11px] font-mono text-white truncate" title={value}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Check register</div>
                  {(verifyResult.checks || []).map((check, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs p-2.5 rounded-xl bg-slate-950/60 border border-white/5"
                    >
                      {check.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-white font-semibold">
                          {check.check}
                          <span className="ml-2 text-[9px] uppercase text-slate-500">{check.severity}</span>
                        </div>
                        <div className="text-slate-400 font-mono text-[10px] break-all">{check.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {verifyResult.issues?.length > 0 && (
                  <div className="space-y-1.5 mt-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flagged issues</div>
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
