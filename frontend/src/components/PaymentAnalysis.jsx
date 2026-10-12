import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Sparkles,
  Info,
  ChevronDown,
  Activity,
  Network,
  Cpu,
  QrCode,
  Layers,
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

const LEVEL_STYLES = {
  CRITICAL: {
    icon: ShieldX,
    panel: 'spatial-glass-critical',
    chip: 'bg-red-500/20 text-red-300 border border-red-500/40',
    accent: '#F43F5E',
    label: 'DANGER: FRAUD DETECTED',
    cta: 'DO NOT PAY (BLOCKED)'
  },
  WARNING: {
    icon: ShieldAlert,
    panel: 'spatial-glass border-amber-500/50 shadow-amber-500/10',
    chip: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    accent: '#F59E0B',
    label: 'CAUTION: SUSPICIOUS',
    cta: 'PROCEED WITH CAUTION'
  },
  LOW_RISK: {
    icon: ShieldCheck,
    panel: 'spatial-glass-success',
    chip: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    accent: '#10B981',
    label: 'VERIFIED SAFE PAYMENT',
    cta: 'SAFE TO PAY (ENTER MPIN)'
  }
};

const STATUS_STYLE = {
  PASS: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  WARN: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  FAIL: 'bg-red-500/15 text-red-300 border-red-500/40',
  SKIPPED: 'bg-slate-700/40 text-slate-300 border-white/10'
};

const STAGE_ICONS = { 1: QrCode, 2: Activity, 3: Cpu, 4: Network, 5: Layers };

const axisStyle = { fontSize: 10, fill: '#94A3B8' };
const tooltipStyle = {
  backgroundColor: 'rgba(5, 7, 14, 0.95)',
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderRadius: '14px',
  fontSize: '11px',
  color: '#F1F5F9'
};

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx, cy, r, a1, a2) {
  const start = polar(cx, cy, r, a1);
  const end = polar(cx, cy, r, a2);
  const largeArc = a2 - a1 > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function ScoreGauge({ score, level, percentile }) {
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.LOW_RISK;
  const cx = 110;
  const cy = 110;
  const r = 84;
  const start = 135;
  const sweep = 270;
  const valueEnd = start + (sweep * Math.max(0, Math.min(100, score))) / 100;
  const arcLength = 2 * Math.PI * r * (sweep / 360);
  const valueLength = 2 * Math.PI * r * ((valueEnd - start) / 360);

  return (
    <div className="relative w-[220px] shrink-0">
      <svg viewBox="0 0 220 150" className="w-full h-auto">
        <path
          d={arcPath(cx, cy, r, start, start + sweep)}
          fill="none"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, r, start, start + sweep)}
          fill="none"
          stroke={style.accent}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${valueLength} ${arcLength}`}
          style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        {[0, 40, 70, 100].map((tick) => {
          const angle = start + (sweep * tick) / 100;
          const outer = polar(cx, cy, r + 16, angle);
          const inner = polar(cx, cy, r + 22, angle);
          return (
            <line
              key={tick}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke="rgba(148,163,184,0.5)"
              strokeWidth="2"
            />
          );
        })}
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-white" style={{ fontSize: 46, fontWeight: 900 }}>
          {score}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" style={{ fontSize: 12, fill: '#94A3B8', fontWeight: 700 }}>
          / 100 risk score
        </text>
        <text x={cx} y={cy + 40} textAnchor="middle" style={{ fontSize: 11, fill: style.accent, fontWeight: 800 }}>
          {percentile}% of payments are lower
        </text>
      </svg>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, note }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-sky-400" />}
        <span>{title}</span>
      </h4>
      {note && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{note}</p>}
    </div>
  );
}

function StageCard({ stage }) {
  const [open, setOpen] = useState(false);
  const Icon = STAGE_ICONS[stage.id] || Layers;
  const statusClass = STATUS_STYLE[stage.status] || STATUS_STYLE.SKIPPED;
  const maxPoints = stage.weight_pct || 100;
  const width = Math.max(0, Math.min(100, (stage.points / (maxPoints || 100)) * 100));

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-4 text-left cursor-pointer hover:bg-white/[0.03] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-sky-400 shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-slate-500">STAGE {stage.id}</span>
            <span className="text-sm font-bold text-white truncate">{stage.title}</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${statusClass}`}>
              {stage.status}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 truncate">{stage.summary}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-black text-white leading-none">
            {stage.points}
            <span className="text-[10px] font-bold text-slate-500"> / {maxPoints}</span>
          </div>
          <div className="text-[9px] text-slate-500 font-mono uppercase">{stage.bucket?.replace(/_/g, ' ')}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className="px-4 -mt-1 pb-3">
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
            style={{ width: `${width}%`, transition: 'width 0.6s ease' }}
          />
        </div>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3"
        >
          <p className="text-[11px] text-slate-400 leading-relaxed">{stage.explanation}</p>

          {stage.id === 1 && (
            <div className="space-y-2">
              {(stage.checks || []).map((check, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-[11px] p-2.5 rounded-xl bg-slate-900/70 border border-white/5">
                  {check.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="text-white font-semibold">{check.check}</div>
                    <div className="text-slate-400 font-mono text-[10px] break-all">{check.detail}</div>
                  </div>
                </div>
              ))}
              {(stage.issues || []).length > 0 && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1">
                  {stage.issues.map((issue, idx) => (
                    <div key={idx} className="text-[11px] text-red-200 flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {stage.id === 2 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="text-slate-500 uppercase text-[9px] border-b border-white/10">
                    <th className="py-2 pr-2">Rule</th>
                    <th className="py-2 pr-2">Observed</th>
                    <th className="py-2 pr-2">Threshold</th>
                    <th className="py-2 pr-2 text-right">Penalty</th>
                    <th className="py-2 text-right">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(stage.rules || []).map((rule) => (
                    <tr key={rule.id} className={rule.triggered ? 'bg-amber-500/[0.06]' : ''}>
                      <td className="py-2 pr-2">
                        <span className="font-mono font-bold text-slate-300">{rule.id}</span>{' '}
                        <span className={rule.triggered ? 'text-white font-semibold' : 'text-slate-400'}>{rule.title}</span>
                      </td>
                      <td className="py-2 pr-2 text-slate-300 font-mono">{rule.observed}</td>
                      <td className="py-2 pr-2 text-slate-500 font-mono">{rule.threshold}</td>
                      <td className="py-2 pr-2 text-right font-mono font-bold text-amber-300">
                        {rule.triggered ? `+${rule.penalty}` : '0'}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            rule.triggered ? 'bg-red-500/15 text-red-300 border-red-500/40' : 'bg-slate-800 text-slate-400 border-white/10'
                          }`}
                        >
                          {rule.triggered ? 'TRIGGERED' : 'CLEAR'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {stage.id === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                  <div className="text-[10px] uppercase text-slate-500 font-bold">Fraud probability</div>
                  <div className="text-2xl font-black text-white">
                    {stage.probability_pct}
                    <span className="text-sm text-slate-400">%</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {stage.n_estimators} trees • validation AUC {(stage.validation_auc || 0).toFixed(3)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    ['Precision', stage.validation?.precision],
                    ['Recall', stage.validation?.recall],
                    ['F1', stage.validation?.f1],
                    ['Accuracy', stage.validation?.accuracy]
                  ].map(([label, value]) => (
                    <div key={label} className="p-2.5 rounded-xl bg-slate-900/70 border border-white/5">
                      <div className="text-[9px] uppercase text-slate-500 font-bold">{label}</div>
                      <div className="text-sm font-black text-sky-300">{((value || 0) * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-500 font-bold mb-2">Feature impact on this verdict</div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {(stage.feature_contributions || []).slice(0, 9).map((c) => (
                    <div key={c.feature} className="flex items-center gap-2 text-[11px]">
                      <span className="w-40 truncate text-slate-300" title={c.label}>
                        {c.label}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-sky-400/80" style={{ width: `${Math.min(100, c.impact_pct * 2)}%` }} />
                      </div>
                      <span className="w-16 text-right font-mono text-slate-400">{c.impact_pct}%</span>
                      <span className="w-16 text-right font-mono text-slate-500">p{c.percentile ?? '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage.id === 4 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(stage.risk_index_components || []).map((comp) => (
                <div key={comp.component} className="p-3 rounded-xl bg-slate-900/70 border border-white/5">
                  <div className="text-[9px] uppercase text-slate-500 font-bold leading-tight">{comp.component}</div>
                  <div className="text-lg font-black text-white mt-1">
                    {comp.points}
                    <span className="text-[10px] text-slate-500 font-bold"> / {comp.max}</span>
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-1">{comp.formula}</div>
                </div>
              ))}
              <div className="col-span-2 md:col-span-4 p-3 rounded-xl bg-slate-900/70 border border-white/5 text-[11px] text-slate-300">
                <span className="font-bold text-white">Evidence only:</span> {stage.note}
              </div>
            </div>
          )}

          {stage.id === 5 && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="text-slate-500 uppercase text-[9px] border-b border-white/10">
                      <th className="py-2 pr-2">Estimator</th>
                      <th className="py-2 pr-2 text-right">Weight</th>
                      <th className="py-2 pr-2 text-right">Raw</th>
                      <th className="py-2 text-right">Weighted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(stage.components || []).map((comp) => (
                      <tr key={comp.name}>
                        <td className="py-2 pr-2 text-white font-semibold">
                          {comp.name} <span className="text-slate-500 font-normal">({comp.source})</span>
                        </td>
                        <td className="py-2 pr-2 text-right font-mono text-slate-400">{(comp.weight * 100).toFixed(0)}%</td>
                        <td className="py-2 pr-2 text-right font-mono text-slate-300">{comp.raw}</td>
                        <td className="py-2 text-right font-mono font-bold text-sky-300">{comp.weighted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/5 text-[11px] text-slate-300 flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  Warning band ≥ <strong className="text-amber-300">{stage.thresholds?.warning}</strong>
                </span>
                <span>
                  Critical band ≥ <strong className="text-red-300">{stage.thresholds?.critical}</strong>
                </span>
                <span>
                  Population percentile <strong className="text-white">{stage.population_percentile}%</strong>
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function BenchmarkRow({ bench }) {
  const percentile = bench.percentile ?? 0;
  const risky = percentile >= 75;
  return (
    <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold text-white">{bench.label}</div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {bench.display} {!bench.observed && <span className="text-slate-600">(no ledger record)</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-black ${risky ? 'text-amber-300' : 'text-emerald-300'}`}>p{percentile}</div>
          <div className="text-[9px] uppercase text-slate-500 font-bold">percentile</div>
        </div>
      </div>

      <div className="mt-2.5 h-2 rounded-full bg-slate-800 overflow-hidden relative">
        <div
          className={`h-full rounded-full ${risky ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${percentile}%`, transition: 'width 0.6s ease' }}
        />
        <div className="absolute inset-y-0 left-[90%] w-px bg-slate-500/70" />
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 font-mono">
        {bench.population && (
          <>
            <span>p50 {bench.population.p50}</span>
            <span>p90 {bench.population.p90}</span>
            <span>p99 {bench.population.p99}</span>
            <span>max {bench.population.max}</span>
          </>
        )}
        <span className="text-slate-600 ml-auto normal-case font-sans">{bench.source}</span>
      </div>
    </div>
  );
}

export default function PaymentAnalysis({ result, amount = 0 }) {
  const [aiText, setAiText] = useState(null);
  const [aiMeta, setAiMeta] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const analysis = result.analysis || {};
  const stages = analysis.stages || [];
  const radar = analysis.radar || [];
  const contributions = analysis.contributions || [];
  const benchmarks = analysis.benchmarks || [];
  const population = analysis.population || {};
  const validation = analysis.model_validation || {};
  const evidence = analysis.evidence || {};
  const qr = result.qr_verification || {};

  const levelStyle = LEVEL_STYLES[result.risk_level] || LEVEL_STYLES.LOW_RISK;
  const LevelIcon = levelStyle.icon;

  const distribution = population.score_distribution || [];

  const contributionsData = contributions.length
    ? contributions
    : [{ name: 'No signal above threshold', value: 1, empty: true }];

  const pieColors = ['#F43F5E', '#F59E0B', '#38BDF8', '#818CF8', '#C084FC', '#34D399'];

  const loadAiNarrative = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await api('/api/ai-explain', {
        method: 'POST',
        body: {
          txn_id: result.txn_id,
          risk_score: result.risk_score,
          risk_level: result.risk_level,
          amount: Number(amount) || 0,
          receiver_vpa: result.signals?.receiver_id || '',
          qr_claimed_name: stages[0]?.evidence?.claimed_nameplate || '',
          qr_status: qr.trust_status || 'SKIPPED',
          triggered_rules: (stages[1]?.rules || [])
            .filter((rule) => rule.triggered)
            .map((rule) => `${rule.id} ${rule.title}`)
            .join(', '),
          ml_probability: result.ml_probability || 0,
          graph_role: analysis.evidence ? (stages[3]?.metrics?.role || 'UNOBSERVED') : 'UNOBSERVED',
          percentile: population.percentile || 0
        }
      });
      if (data.success && data.explanation) {
        setAiText(data.explanation);
        setAiMeta({ source: data.source, model: data.model });
      } else {
        setAiError(data.error || 'Explanation unavailable.');
      }
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const radarData = radar.map((r) => ({ dimension: r.dimension, score: r.score, formula: r.formula }));

  return (
    <div className="space-y-6">
      {/* Verdict + gauge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`p-6 rounded-3xl ${levelStyle.panel}`}
      >
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <ScoreGauge score={result.risk_score} level={result.risk_level} percentile={population.percentile || 0} />

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${levelStyle.chip}`}>
                <LevelIcon className="w-6 h-6" />
              </div>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${levelStyle.chip}`}>
                  {levelStyle.label}
                </span>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-mono text-slate-400">
                  <span className="text-sky-400 font-bold">{result.txn_id}</span>
                  {result.evaluated_by && <span>by {result.evaluated_by}</span>}
                  <span>rules {result.rule_penalty}/100</span>
                  <span>model {result.ml_confidence}/100</span>
                  <span>telemetry: {String(evidence.telemetry_source || 'unknown').replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['QR penalty', `${evidence.qr_penalty ?? 0}`],
                ['Rule penalty', `${evidence.rule_penalty ?? 0}`],
                ['Model score', `${evidence.ml_score ?? 0}`],
                ['Graph risk index', `${evidence.graph_risk_index ?? 0}`]
              ].map(([label, value]) => (
                <div key={label} className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10">
                  <div className="text-[9px] uppercase font-bold text-slate-500">{label}</div>
                  <div className="text-lg font-black text-white leading-tight">{value}</div>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-200 leading-relaxed">{result.recommended_action}</div>
          </div>
        </div>
      </motion.div>

      {/* Plain language explanation */}
      <div className="spatial-glass p-6 rounded-3xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-sky-300 uppercase tracking-wide">
              Plain-language explanation
            </span>
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-white/10 text-slate-400">
              {aiMeta?.source || result.ai_source || 'local_deterministic'}
            </span>
          </div>
          <button
            type="button"
            onClick={loadAiNarrative}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white hover:border-sky-400/40 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            {aiLoading ? 'Generating...' : 'Regenerate narrative'}
          </button>
        </div>

        <p className="text-sm text-slate-100 font-medium leading-relaxed">
          “{aiText || result.ai_explanation}”
        </p>
        {aiError && <p className="text-[11px] text-amber-300 mt-2">{aiError}</p>}
      </div>

      {/* Five stage pipeline */}
      <div className="spatial-glass p-6 rounded-3xl">
        <SectionTitle
          icon={Layers}
          title="Five-stage scoring pipeline"
          note={analysis.summary}
        />
        <div className="space-y-3">
          {stages.map((stage) => (
            <StageCard key={stage.id} stage={stage} />
          ))}
        </div>
      </div>

      {/* Contribution + radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="spatial-glass p-6 rounded-3xl">
          <SectionTitle
            icon={Target}
            title="Where the score came from"
            note="Rule points and model points of the final fused score, in score points."
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contributionsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                  isAnimationActive
                >
                  {contributionsData.map((entry, index) => (
                    <Cell key={`c-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(value) => <span style={{ color: '#CBD5E1', fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {contributions.map((c, idx) => (
              <div key={`${c.name}-${idx}`} className="flex items-center gap-2 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pieColors[idx % pieColors.length] }} />
                <span className="flex-1 text-slate-300 truncate">{c.name}</span>
                <span className="text-slate-500 font-mono">{c.bucket}</span>
                <span className="font-mono font-bold text-white w-8 text-right">{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="spatial-glass p-6 rounded-3xl">
          <SectionTitle
            icon={Activity}
            title="Risk radar across all detectors"
            note="Every axis is 0-100. Hover an axis to read the exact formula behind it."
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="rgba(148,163,184,0.25)" />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 9 }} />
                <Radar name="This transaction" dataKey="score" stroke="#38BDF8" fill="#38BDF8" fillOpacity={0.35} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {radar.map((r) => (
              <div key={r.dimension} className="text-[10px] text-slate-500 flex gap-2">
                <span className="text-slate-400 font-semibold w-32 shrink-0">{r.dimension}</span>
                <span className="font-mono truncate">{r.formula}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Benchmarks */}
      <div className="spatial-glass p-6 rounded-3xl">
        <SectionTitle
          icon={Activity}
          title="Signal benchmarks vs the whole population"
          note={`Percentiles are computed exactly against ${population.sample_size || 0} recorded transactions. The tick mark on each bar is the 90th percentile.`}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {benchmarks.map((bench) => (
            <BenchmarkRow key={bench.key} bench={bench} />
          ))}
        </div>
      </div>

      {/* Distribution + validation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="spatial-glass p-6 rounded-3xl">
          <SectionTitle
            icon={BarChart3}
            title="Population score distribution"
            note={`Fraud share per 10-point score band. Mean ${population.mean_score ?? 0}, median ${population.median_score ?? 0}, base rate ${population.fraud_base_rate_pct ?? 0}%.`}
          />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="bin" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="legit" stackId="a" name="Legitimate" fill="#38BDF8" radius={[0, 0, 0, 0]} />
                <Bar dataKey="fraud" stackId="a" name="Fraud" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                <Legend formatter={(value) => <span style={{ color: '#CBD5E1', fontSize: 11 }}>{value}</span>} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-white/5 text-[11px] text-slate-300">
            This transaction scored <strong className="text-white">{result.risk_score}</strong> - higher than{' '}
            <strong className="text-sky-300">{population.percentile}%</strong> of the {population.sample_size || 0} payments
            evaluated so far.
          </div>
        </div>

        <div className="spatial-glass p-6 rounded-3xl">
          <SectionTitle
            icon={CheckCircle2}
            title="Model validation on held-out data"
            note={`Confusion matrix measured on a 20% hold-out split of the ledger at threshold ${validation.threshold ?? 0.5}.`}
          />
          <div className="grid grid-cols-2 gap-3">
            {[
              ['True positive', validation.confusion_matrix?.true_positive, 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'],
              ['False positive', validation.confusion_matrix?.false_positive, 'bg-amber-500/10 border-amber-500/30 text-amber-300'],
              ['False negative', validation.confusion_matrix?.false_negative, 'bg-amber-500/10 border-amber-500/30 text-amber-300'],
              ['True negative', validation.confusion_matrix?.true_negative, 'bg-sky-500/10 border-sky-500/30 text-sky-300']
            ].map(([label, value, cls]) => (
              <div key={label} className={`p-4 rounded-2xl border text-center ${cls}`}>
                <div className="text-[9px] uppercase font-bold opacity-80">{label}</div>
                <div className="text-2xl font-black">{value ?? 0}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3 text-center">
            {[
              ['Precision', validation.precision],
              ['Recall', validation.recall],
              ['F1', validation.f1],
              ['Accuracy', validation.accuracy]
            ].map(([label, value]) => (
              <div key={label} className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                <div className="text-[9px] uppercase text-slate-500 font-bold">{label}</div>
                <div className="text-sm font-black text-white">{((value || 0) * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            Trained on {validation.sample_size || population.sample_size || 0} ledger rows • AUC{' '}
            {(analysis.model_auc || 0).toFixed(3)}
          </div>
        </div>
      </div>

      {/* Reasons */}
      <div className="spatial-glass p-6 rounded-3xl">
        <SectionTitle icon={Info} title="Why this score was given" />
        <div className="space-y-2">
          {result.reasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs p-3 rounded-xl bg-slate-950/60 border border-white/5 text-slate-200">
              <span className="text-sky-400 font-bold">•</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
