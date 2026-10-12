import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CameraQRScanner({ isOpen, onClose, onScanSuccess }) {
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const readerId = "diamond-qr-reader";

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setCameraError(null);
      setScanning(true);

      const startScanner = async () => {
        try {
          html5QrCode = new Html5Qrcode(readerId);
          scannerRef.current = html5QrCode;

          const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            // Stop camera on success
            if (html5QrCode && html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                html5QrCode.clear();
              }).catch(err => console.error("Error stopping scanner:", err));
            }
            onScanSuccess(decodedText);
            onClose();
          };

          const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback,
            (errorMessage) => {
              // Ignore standard frame scan non-detections
            }
          );
        } catch (err) {
          console.error("Camera access error:", err);
          setCameraError(
            "Could not access your system camera. Please ensure camera permissions are granted in your browser, or paste the UPI QR payload directly."
          );
          setScanning(false);
        }
      };

      // Slight timeout to ensure DOM element exists
      const timer = setTimeout(startScanner, 200);

      return () => {
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().then(() => {
            html5QrCode.clear();
          }).catch(console.error);
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="spatial-glass w-full max-w-lg p-6 rounded-3xl relative border border-white/20 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">System Camera QR Scanner</h3>
            <p className="text-xs text-slate-400">Point your camera at any UPI or merchant QR code</p>
          </div>
        </div>

        {cameraError ? (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close & Enter UPI Manually
            </button>
          </div>
        ) : (
          <div>
            <div 
              id={readerId} 
              className="w-full rounded-2xl overflow-hidden border border-white/15 bg-black"
              style={{ minHeight: '300px' }}
            />
            <div className="mt-4 text-center text-xs text-slate-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Camera active • Real-time frame decoding</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
