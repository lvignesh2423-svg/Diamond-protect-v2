import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Download,
  Info,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

export default function DatasetUploader({ onImported, onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadStatus(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a valid CSV file to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const data = await api("/api/upload-csv", {
        method: "POST",
        body: formData
      });

      setUploadStatus(data);
      if (onImported) onImported(data);
      if (onUploadComplete) onUploadComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const header =
      "txn_id,timestamp,sender_id,receiver_id,receiver_vpa,amount,qr_scanned,qr_hash_valid,qr_claimed_name,beneficiary_age_days,time_since_beneficiary_added_sec,velocity_10m,outflow_ratio_5m,in_degree_1h,ip_risk_score,device,location,is_fraud,fraud_type";
    const csvContent = "data:text/csv;charset=utf-8," + header;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "diamond_protect_upi_columns.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Top Banner */}
      <div className="spatial-card p-7 border border-white/10 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 text-xs font-semibold mb-3">
              <Database className="w-3.5 h-3.5" />
              Isolated Live Transaction Ingestion Engine
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Upload Real-World UPI Data
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Upload your own CSV datasets. Diamond-Protect immediately imports every record into your isolated <strong className="text-sky-300 font-mono">transactions.db</strong>, updates graph topologies, and re-computes syndicate rings.
            </p>
          </div>
          <button
            onClick={downloadSampleTemplate}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-white/15 flex items-center gap-2 cursor-pointer transition-colors self-start md:self-auto"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Download column headers</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload Form Box */}
        <div className="lg:col-span-6 space-y-6">
          <div className="spatial-card p-7">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-sky-400" />
              <span>Select File from Your Computer</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Accepted format: Standard comma-separated values (.csv). No size or row limit.
            </p>

            <form onSubmit={handleUpload} className="space-y-5">
              <div className="border-2 border-dashed border-white/15 hover:border-sky-400/50 rounded-2xl p-8 text-center transition-colors cursor-pointer bg-slate-950/40 relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center text-sky-400 mb-3 shadow-md">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  {file ? (
                    <div>
                      <div className="text-sm font-bold text-white">{file.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold text-white">Click or drag & drop CSV file here</div>
                      <div className="text-xs text-slate-400 mt-1">Files are safely stored in transactions.db</div>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {uploadStatus && (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">{uploadStatus.message}</div>
                    <div className="text-[11px] text-emerald-300 mt-1">
                      File: {uploadStatus.filename} • {uploadStatus.imported_count} transactions imported.
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 shadow-lg shadow-sky-500/20 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Parsing & Ingesting Dataset...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Ingest Dataset into System</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Instructions & Field Mappings for Regular Users */}
        <div className="lg:col-span-6 space-y-6">
          <div className="spatial-card p-7">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400" />
              <span>Easy CSV Column Guide (What each column means)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Even if you don't have all columns, Diamond-Protect automatically fills reasonable security defaults!
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="font-bold text-white font-mono">receiver_vpa <span className="text-[10px] text-sky-400 font-sans font-normal">(Required)</span></div>
                <div className="text-slate-400 mt-0.5">The UPI ID being paid (e.g. merchant@icici, scammer@upi).</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="font-bold text-white font-mono">amount <span className="text-[10px] text-sky-400 font-sans font-normal">(Required)</span></div>
                <div className="text-slate-400 mt-0.5">The transaction amount in Indian Rupees (INR).</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="font-bold text-white font-mono">qr_scanned <span className="text-[10px] text-slate-400 font-sans font-normal">(Optional, 0 or 1)</span></div>
                <div className="text-slate-400 mt-0.5">Set to 1 if paid by scanning a physical QR code, 0 if entered manually.</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="font-bold text-white font-mono">outflow_ratio_5m <span className="text-[10px] text-slate-400 font-sans font-normal">(Optional, 0.0 - 1.0)</span></div>
                <div className="text-slate-400 mt-0.5">Percentage of money forwarded immediately within 5 minutes. (0.95 = 95% mule drain).</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="font-bold text-white font-mono">beneficiary_age_days <span className="text-[10px] text-slate-400 font-sans font-normal">(Optional)</span></div>
                <div className="text-slate-400 mt-0.5">How many days old the receiving bank handle is (1-3 days triggers high risk).</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
