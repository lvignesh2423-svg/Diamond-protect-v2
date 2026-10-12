import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Cpu,
  Database,
  Network
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api, setSession } from '../lib/api';

export default function LoginPage({ onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const data = await api(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { username: username.trim(), password }
      });
      setSession(data.token, data.user);
      setSuccessMsg(isRegister ? 'Account created.' : 'Authenticated.');
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const highlights = [
    { icon: Lock, title: 'Username + password only', note: 'No email, no OTP, no third-party login' },
    { icon: Cpu, title: 'Five-stage scoring pipeline', note: 'QR integrity, rules, model, graph, fusion' },
    { icon: Network, title: 'Live money-flow topology', note: 'Hub mules and wash rings from the ledger' },
    { icon: Database, title: 'Evidence-derived telemetry', note: 'Signals read from real records, never invented' }
  ];

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 relative z-10">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-white/10 bg-[#0b1224]/70 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-white/20">
            <ShieldCheck className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <div className="text-xl font-black tracking-tight brand-gradient">Diamond-Protect</div>
            <div className="text-xs text-slate-400 font-medium">Real-Time UPI Fraud &amp; Mule Defense</div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-black text-white leading-tight tracking-tight">
            Investigative access is <span className="brand-gradient">restricted</span> to authenticated analysts.
          </h1>
          <p className="text-sm text-slate-400 mt-4 max-w-md leading-relaxed">
            Every analytical endpoint - payment evaluation, QR verification, graph topology, ledger statistics -
            requires a valid session. Signing out drops the token and returns you to this gate.
          </p>

          <div className="mt-8 space-y-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-white/5"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{item.title}</div>
                    <div className="text-[11px] text-slate-400">{item.note}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
          <span>auth.db</span>
          <span>•</span>
          <span>PBKDF2-SHA256</span>
          <span>•</span>
          <span>JWT session</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="spatial-glass w-full max-w-md p-8 rounded-3xl"
        >
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Lock className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {isRegister ? 'Create Analyst Account' : 'Analyst Sign In'}
              </h3>
              <p className="text-xs text-slate-400">Username + password is the only entry point</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. analyst_01"
                  autoComplete="username"
                  className="spatial-input w-full pl-10"
                  required
                  minLength={3}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className="spatial-input w-full pl-10"
                  required
                  minLength={6}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Stored as a salted PBKDF2-SHA256 hash in auth.db
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-sky-400 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 shadow-lg shadow-sky-500/20 cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Enter Workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-slate-400">
            {isRegister ? (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError(null);
                  }}
                  className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                New investigator?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError(null);
                  }}
                  className="text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                >
                  Create Account
                </button>
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
