import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, ScanLine, RotateCw, ClipboardPaste } from 'lucide-react';

const READER_ID = 'diamond-qr-reader';

const SCAN_CONFIG = {
  fps: 24,
  qrbox: (viewfinderWidth, viewfinderHeight) => {
    const side = Math.min(260, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75));
    return { width: side, height: side };
  },
  aspectRatio: 1.0,
  disableFlip: false,
  showZoomSliderIfSupported: false
};

function describeCameraError(err) {
  const name = err?.name || '';
  const message = (err?.message || String(err || '')).toLowerCase();

  if (!window.isSecureContext) {
    return 'The camera needs a secure context. Open this app over https:// or http://localhost, then retry.';
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || message.includes('permission')) {
    return 'Camera permission was blocked. Click the camera icon in the address bar, allow access, then retry.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || message.includes('no camera')) {
    return 'No camera was detected on this device. Paste the UPI QR payload below instead.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use')) {
    return 'The camera is already in use by another app. Close it, then retry.';
  }
  if (name === 'OverconstrainedError' || message.includes('overconstrained')) {
    return 'This camera does not support the requested mode. Retry, or paste the payload below.';
  }
  return `Could not open a camera (${name || 'unknown error'}). Paste the UPI QR payload below instead.`;
}

async function stopScanner(scanner) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {
    /* already stopped */
  }
  try {
    scanner.clear();
  } catch {
    /* element already cleared */
  }
}

export default function CameraQRScanner({ isOpen, onClose, onScanSuccess }) {
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const cancelledRef = useRef(false);
  const successRef = useRef(onScanSuccess);
  const closeRef = useRef(onClose);
  successRef.current = onScanSuccess;
  closeRef.current = onClose;

  const pickCamera = useCallback(async () => {
    let cameras = [];
    try {
      cameras = (await Html5Qrcode.getCameras()) || [];
    } catch {
      cameras = [];
    }
    if (!cameras.length) return null;
    const preferred =
      cameras.find((c) => /back|rear|environment/i.test(c.label || '')) ||
      cameras.find((c) => !/front|user|facetime/i.test(c.label || '')) ||
      cameras[0];
    return preferred.id || preferred.deviceId || null;
  }, []);

  const startScanner = useCallback(async () => {
    if (cancelledRef.current || startedRef.current) return;
    if (!document.getElementById(READER_ID)) {
      setCameraError('The video container was not ready. Close and reopen the scanner.');
      setScanning(false);
      return;
    }

    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(describeCameraError({ name: 'InsecureContext' }));
      setScanning(false);
      return;
    }

    startedRef.current = true;

    // A fresh instance per attempt: html5-qrcode keeps internal state after a
    // failed start(), so reusing the instance silently fails on every retry.
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;

    try {
      const deviceId = await pickCamera();
      const target = deviceId || { facingMode: 'environment' };
      await scanner.start(target, SCAN_CONFIG, (decodedText) => {
        if (doneRef.current) return;
        doneRef.current = true;
        if (navigator.vibrate) navigator.vibrate(40);
        stopScanner(scannerRef.current).finally(() => {
          successRef.current(decodedText);
          closeRef.current();
        });
      }, () => {});

      if (cancelledRef.current) {
        await stopScanner(scanner);
        return;
      }
      setScanning(true);
      setCameraError(null);
    } catch (err) {
      console.error('Camera access error:', err);
      await stopScanner(scanner);
      if (cancelledRef.current) return;
      setCameraError(describeCameraError(err));
      setScanning(false);
    } finally {
      startedRef.current = false;
    }
  }, [pickCamera]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    cancelledRef.current = false;
    startedRef.current = false;
    doneRef.current = false;
    setCameraError(null);
    setScanning(true);
    setPasting(false);
    setPasteValue('');

    // Give React one frame to mount the reader div before we grab it.
    const timer = setTimeout(() => {
      startScanner();
    }, 120);

    return () => {
      cancelledRef.current = true;
      clearTimeout(timer);
      stopScanner(scannerRef.current);
      scannerRef.current = null;
      startedRef.current = false;
    };
  }, [isOpen, retryToken, startScanner]);

  const handlePasteSubmit = (e) => {
    e.preventDefault();
    const value = pasteValue.trim();
    if (!value) return;
    doneRef.current = true;
    successRef.current(value);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="spatial-glass w-full max-w-lg p-6 rounded-3xl relative border border-white/20 shadow-2xl">
        <button
          onClick={onClose}
          title="Close scanner"
          className="absolute right-5 top-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 pr-12">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Camera QR scanner</h3>
            <p className="text-xs text-slate-400">Frames are decoded locally in your browser at 24 fps</p>
          </div>
        </div>

        {cameraError ? (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRetryToken((t) => t + 1)}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Retry camera
              </button>
              <button
                onClick={() => setPasting((v) => !v)}
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Paste payload
              </button>
            </div>
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
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => setPasting((v) => !v)}
                className="text-[11px] text-slate-400 hover:text-sky-300 cursor-pointer flex items-center gap-1.5"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                No camera? Paste the QR payload instead
              </button>
            </div>
          </div>
        )}

        {pasting && (
          <form onSubmit={handlePasteSubmit} className="mt-4 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">UPI QR payload</label>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="upi://pay?pa=merchant@okicici&pn=Store&am=1999&cu=INR"
              rows={3}
              className="spatial-input w-full font-mono resize-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={!pasteValue.trim()}
              className="w-full py-2.5 px-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <ScanLine className="w-4 h-4" />
              Use this payload
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
