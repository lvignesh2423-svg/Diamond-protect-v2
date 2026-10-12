import React, { useState } from 'react';
import {
  Smartphone,
  Camera,
  ShieldCheck,
  RefreshCw,
  QrCode,
  ScanLine,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraQRScanner from '../components/CameraQRScanner';
import PaymentAnalysis from '../components/PaymentAnalysis';
import { api } from '../lib/api';

const EMPTY_FORM = {
  receiver_vpa: '',
  account_number: '',
  amount: '',
  qr_scanned: false,
  raw_qr: '',
  qr_claimed_name: ''
};

export default function VerifyPage({ onEvaluated }) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const update = (patch) => setFormData((prev) => ({ ...prev, ...patch }));

  const handleQRDetected = (qrContent) => {
    let parsedVpa = '';
    let parsedName = '';
    let parsedAmount = '';

    if (qrContent.startsWith('upi://pay?')) {
      try {
        const params = new URLSearchParams(qrContent.split('upi://pay?')[1]);
        parsedVpa = params.get('pa') || '';
        parsedName = params.get('pn') || '';
        parsedAmount = params.get('am') || '';
      } catch (e) {
        console.error('Error parsing QR:', e);
      }
    }

    update({
      raw_qr: qrContent,
      qr_scanned: true,
      receiver_vpa: parsedVpa || '',
      qr_claimed_name: parsedName || '',
      amount: parsedAmount ? String(parseFloat(parsedAmount)) : formData.amount
    });
  };

  const handleEvaluate = async (e) => {
    e.preventDefault();
    setError(null);

    const vpa = formData.receiver_vpa.trim();
    const rawQr = formData.raw_qr.trim();
    if (!vpa && !rawQr) {
      setError('Enter a payee UPI ID or scan a QR code before analysing.');
      return;
    }
    if (formData.amount === '' || Number(formData.amount) < 0) {
      setError('Enter the transaction amount.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await api('/api/evaluate', {
        method: 'POST',
        body: {
          receiver_vpa: vpa,
          account_number: formData.account_number.trim() || null,
          amount: parseFloat(formData.amount) || 0,
          qr_scanned: Boolean(formData.qr_scanned || rawQr),
          raw_qr: rawQr,
          qr_claimed_name: formData.qr_claimed_name.trim() || null
        }
      });
      setResult(data);
      if (onEvaluated) onEvaluated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFormData(EMPTY_FORM);
    setResult(null);
    setError(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Input column */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-5 space-y-6"
      >
        <div className="spatial-glass p-7 rounded-3xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Check UPI / QR Risk</h2>
                <div className="text-xs text-slate-400">Scan a code or type a payee to analyse it</div>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Stage 1-5 pipeline
            </span>
          </div>

          {/* Camera trigger */}
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-sky-950/60 to-indigo-950/60 border border-sky-500/30 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-sky-400" />
                <span>Scan a physical QR code</span>
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">Uses the device webcam, frames are decoded locally</div>
            </div>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              <span>Open Camera</span>
            </button>
          </div>

          <form onSubmit={handleEvaluate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Payee UPI ID (VPA)</label>
              <input
                type="text"
                value={formData.receiver_vpa}
                onChange={(e) => update({ receiver_vpa: e.target.value })}
                placeholder="merchant@icici or 9876543210@paytm"
                className="spatial-input w-full font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Account number</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={(e) => update({ account_number: e.target.value })}
                  placeholder="optional payer account"
                  className="spatial-input w-full font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => update({ amount: e.target.value })}
                  placeholder="0.00"
                  className="spatial-input w-full font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Claimed store / person name
              </label>
              <input
                type="text"
                value={formData.qr_claimed_name}
                onChange={(e) => update({ qr_claimed_name: e.target.value })}
                placeholder="name printed on the QR or told to you"
                className="spatial-input w-full"
              />
            </div>

            {formData.raw_qr && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-sky-400/30 text-[11px] font-mono text-slate-300 break-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sky-400 font-bold flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    Decoded QR payload
                  </span>
                  <button
                    type="button"
                    onClick={() => update({ raw_qr: '', qr_scanned: false })}
                    className="text-[10px] text-slate-400 hover:text-red-300 cursor-pointer"
                  >
                    clear
                  </button>
                </div>
                {formData.raw_qr}
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-600 hover:from-sky-300 hover:to-purple-500 text-slate-950 shadow-xl shadow-sky-500/25 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Running five-stage analysis...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Analyze Fraud &amp; Mule Risk</span>
                  </>
                )}
              </button>

              {result && (
                <button
                  type="button"
                  onClick={reset}
                  className="px-4 py-4 rounded-xl font-bold text-xs bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white cursor-pointer transition-colors"
                >
                  New check
                </button>
              )}
            </div>
          </form>
        </div>
      </motion.div>

      {/* Results column */}
      <div className="lg:col-span-7 space-y-6">
        <AnimatePresence mode="wait">
          {!result && !loading && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="spatial-glass p-12 rounded-3xl border border-dashed border-white/15 text-center flex flex-col items-center justify-center min-h-[460px]"
            >
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 mb-4 shadow-lg">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ready to verify</h3>
              <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                Scan a QR code with the camera or enter a payee UPI ID and amount. The verdict, the five pipeline
                stages, population benchmarks and model validation are rendered here.
              </p>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="spatial-glass p-12 rounded-3xl text-center flex flex-col items-center justify-center min-h-[460px]"
            >
              <div className="w-16 h-16 rounded-full border-4 border-sky-400/20 border-t-sky-400 animate-spin mb-5" />
              <h3 className="text-base font-bold text-white mb-1">Running the five-stage pipeline</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                QR integrity, behavioural rules, Random Forest inference, network topology and ensemble fusion.
              </p>
            </motion.div>
          )}

          {result && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PaymentAnalysis result={result} amount={formData.amount} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CameraQRScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={handleQRDetected}
      />
    </div>
  );
}
