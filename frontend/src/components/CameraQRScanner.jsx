import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';

const READER_ID = 'diamond-qr-reader';

const SCAN_CONFIG = {
  fps: 20,
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const side = Math.min(240, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72));
    return { width: side, height: side };
  },
  aspectRatio: 1.0,
  disableFlip: false,
  showZoomSliderIfSupported: false
};

const CAMERA_CANDIDATES = [
  { facingMode: 'environment' },
  { facingMode: 'user' },
  { width: { ideal: 1280 }, height: { ideal: 720 } }
];

async function stopScanner(scanner) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch (e) {
    /* already stopped */
  }
  try {
    scanner.clear();
  } catch (e) {
    /* element already cleared */
  }
}

export default function CameraQRScanner({ isOpen, onClose, onScanSuccess }) {
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const successRef = useRef(onScanSuccess);
  const closeRef = useRef(onClose);
  successRef.current = onScanSuccess;
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    let scanner = null;
    startedRef.current = false;
    doneRef.current = false;
    setCameraError(null);
    setScanning(true);

    const handleSuccess = (decodedText) => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      stopScanner(scannerRef.current).finally(() => {
        successRef.current(decodedText);
        closeRef.current();
      });
    };

    const startScanner = async () => {
      if (cancelled || startedRef.current) return;
      if (!document.getElementById(READER_ID)) {
        setCameraError('Video container was not ready. Close and reopen the scanner.');
        setScanning(false);
        return;
      }

      startedRef.current = true;
      scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;

      let lastError = null;
      for (const device of CAMERA_CANDIDATES) {
        if (cancelled) return;
        try {
          await scanner.start(device, SCAN_CONFIG, handleSuccess, () => {});
          if (!cancelled) setScanning(true);
          return;
        } catch (err) {
          lastError = err;
        }
      }

      console.error('Camera access error:', lastError);
      if (!cancelled) {
        setCameraError(
          'Could not open a camera. Grant camera permission in the browser, or paste the UPI QR payload manually.'
        );
        setScanning(false);
      }
    };

    const timer = setTimeout(startScanner, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner(scannerRef.current);
      scannerRef.current = null;
      startedRef.current = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="spatial-glass w-full max-w-lg p-6 rounded-3xl relative border border-white/20 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Camera QR scanner</h3>
            <p className="text-xs text-slate-400">Frames are decoded locally in the browser at 20 fps</p>
          </div>
        </div>

        {cameraError ? (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Close and paste the payload manually
            </button>
          </div>
        ) : (
          <div>
            <div
              id={READER_ID}
              className="w-full rounded-2xl overflow-hidden border border-white/15 bg-black"
              style={{ minHeight: '300px' }}
            />
            <div className="mt-4 text-center text-xs text-slate-300 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{scanning ? 'Camera active - decoding frames' : 'Starting camera...'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
