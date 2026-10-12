"""
Population-level statistics used for the deep, diagram-backed analysis.

Everything here is computed from the real ledger (transactions.db) plus the
trained Random Forest artifact, cached with a short TTL so that per-request
latency stays in the millisecond range.
"""
import threading
import time
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from backend.core.db_engine import get_all_transactions_df

TTL_SECONDS = 20

FEATURE_LABELS = {
    "amount": "Transaction amount",
    "qr_scanned": "Paid by scanning a QR",
    "qr_hash_valid": "QR cryptographic signature valid",
    "beneficiary_age_days": "Beneficiary account age (days)",
    "time_since_beneficiary_added_sec": "Time since beneficiary added",
    "velocity_10m": "Payment velocity in 10 minutes",
    "outflow_ratio_5m": "Rapid outflow (drain) ratio",
    "in_degree_1h": "Distinct incoming counterparties",
    "ip_risk_score": "Device / IP anomaly score",
}

BENCHMARK_FEATURES = [
    "amount",
    "velocity_10m",
    "outflow_ratio_5m",
    "in_degree_1h",
    "beneficiary_age_days",
    "ip_risk_score",
]

SCORE_EDGES = list(range(0, 110, 10))
AMOUNT_BUCKETS = [
    (0, 500, "₹0 - 500"),
    (500, 2000, "₹500 - 2,000"),
    (2000, 10000, "₹2,000 - 10,000"),
    (10000, 50000, "₹10,000 - 50,000"),
    (50000, float("inf"), "₹50,000+"),
]


def _empty_snapshot() -> Dict[str, Any]:
    return {
        "sample_size": 0,
        "fraud_base_rate_pct": 0.0,
        "fraud_count": 0,
        "total_volume": 0.0,
        "fraud_volume": 0.0,
        "distinct_receivers": 0,
        "mean_score": 0.0,
        "median_score": 0.0,
        "score_distribution": [],
        "score_percentile_reference": [],
        "feature_benchmarks": [],
        "model_validation": {},
        "model_metrics": {},
        "feature_importances": [],
        "time_series": [],
        "amount_buckets": [],
        "top_receivers": [],
        "fraud_breakdown": [],
        "risk_bands": [],
    }


class PopulationAnalytics:
    def __init__(self, risk_engine=None):
        self._risk_engine = risk_engine
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = _empty_snapshot()
        self._scores: np.ndarray = np.array([])
        self._built_at: float = 0.0

    @property
    def risk_engine(self):
        return self._risk_engine

    def bind_engine(self, risk_engine):
        self._risk_engine = risk_engine

    def invalidate(self):
        self._built_at = 0.0

    def snapshot(self, force: bool = False) -> Dict[str, Any]:
        now = time.time()
        if not force and self._data.get("sample_size", 0) > 0 and (now - self._built_at) < TTL_SECONDS:
            return self._data
        with self._lock:
            now = time.time()
            if not force and self._data.get("sample_size", 0) > 0 and (now - self._built_at) < TTL_SECONDS:
                return self._data
            try:
                self._build()
            except Exception as exc:  # pragma: no cover - defensive
                print(f"[analytics] build failed: {exc}")
            self._built_at = time.time()
            return self._data

    # ------------------------------------------------------------------ build
    def _build(self):
        df = get_all_transactions_df()
        if df.empty:
            self._data = _empty_snapshot()
            self._scores = np.array([])
            return

        engine = self._risk_engine
        n = len(df)

        # --- model probabilities -------------------------------------------------
        proba = np.zeros(n)
        if engine is not None and getattr(engine, "model", None) is not None:
            try:
                proba = engine.predict_proba_frame(df)
            except Exception as exc:
                print(f"[analytics] batch inference failed: {exc}")

        # --- vectorised rule engine ---------------------------------------------
        rule_penalty = self._vector_rules(df)

        # --- ensemble score (mirrors the live scorer) ----------------------------
        scores = np.clip(0.45 * rule_penalty + 0.55 * (proba * 100.0), 0, 100)

        is_fraud = df["is_fraud"].fillna(0).astype(int).to_numpy()

        # --- score histogram ------------------------------------------------------
        score_bins = []
        for i in range(len(SCORE_EDGES) - 1):
            lo, hi = SCORE_EDGES[i], SCORE_EDGES[i + 1]
            mask = (scores >= lo) & (scores < hi if hi < 100 else scores <= hi)
            score_bins.append({
                "bin": f"{lo}-{hi}",
                "from": lo,
                "to": hi,
                "total": int(mask.sum()),
                "fraud": int((mask & (is_fraud == 1)).sum()),
                "legit": int((mask & (is_fraud == 0)).sum()),
            })

        # --- feature benchmarks ---------------------------------------------------
        benchmarks = []
        for feat in BENCHMARK_FEATURES:
            if feat not in df.columns:
                continue
            series = pd.to_numeric(df[feat], errors="coerce").dropna().to_numpy(dtype=float)
            if series.size == 0:
                continue
            hist_counts, hist_edges = np.histogram(series, bins=10)
            benchmarks.append({
                "key": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "unit": "ratio" if feat in ("outflow_ratio_5m", "ip_risk_score") else "absolute",
                "min": round(float(series.min()), 4),
                "mean": round(float(series.mean()), 4),
                "p50": round(float(np.percentile(series, 50)), 4),
                "p75": round(float(np.percentile(series, 75)), 4),
                "p90": round(float(np.percentile(series, 90)), 4),
                "p99": round(float(np.percentile(series, 99)), 4),
                "max": round(float(series.max()), 4),
                "histogram": [
                    {"bin": f"{round(hist_edges[i], 2)}-{round(hist_edges[i + 1], 2)}", "count": int(hist_counts[i])}
                    for i in range(len(hist_counts))
                ],
            })

        # --- model validation -----------------------------------------------------
        validation = self._validation(proba, is_fraud)

        importances = []
        if engine is not None and getattr(engine, "feature_importances", None):
            total = sum(engine.feature_importances.values()) or 1.0
            for key, val in engine.feature_importances.items():
                importances.append({
                    "feature": key,
                    "label": FEATURE_LABELS.get(key, key),
                    "importance": round(float(val) / total, 4),
                    "pct": round((float(val) / total) * 100, 1),
                })
            importances.sort(key=lambda x: x["importance"], reverse=True)

        # --- time series ----------------------------------------------------------
        ts = self._time_series(df)

        # --- amount buckets -------------------------------------------------------
        amounts = pd.to_numeric(df["amount"], errors="coerce").fillna(0).to_numpy()
        amount_buckets = []
        for lo, hi, label in AMOUNT_BUCKETS:
            mask = (amounts >= lo) & (amounts < hi)
            amount_buckets.append({
                "label": label,
                "count": int(mask.sum()),
                "fraud": int((mask & (is_fraud == 1)).sum()),
                "volume": round(float(amounts[mask].sum()), 2),
            })

        # --- top receivers --------------------------------------------------------
        top = self._top_receivers(df)

        # --- fraud type breakdown -------------------------------------------------
        fraud_df = df[df["is_fraud"] == 1]
        breakdown = []
        if not fraud_df.empty:
            for name, count in fraud_df["fraud_type"].value_counts().items():
                volume = float(fraud_df.loc[fraud_df["fraud_type"] == name, "amount"].sum())
                breakdown.append({
                    "name": str(name).replace("_", " ").title(),
                    "key": str(name),
                    "count": int(count),
                    "volume": round(volume, 2),
                })

        # --- risk band composition ------------------------------------------------
        bands = [
            {"band": "0 - 39 (Low)", "count": int((scores < 40).sum()), "fraud": int(((scores < 40) & (is_fraud == 1)).sum())},
            {"band": "40 - 69 (Warning)", "count": int(((scores >= 40) & (scores < 70)).sum()),
             "fraud": int(((scores >= 40) & (scores < 70) & (is_fraud == 1)).sum())},
            {"band": "70 - 100 (Critical)", "count": int((scores >= 70).sum()), "fraud": int(((scores >= 70) & (is_fraud == 1)).sum())},
        ]

        self._scores = scores
        self._data = {
            "sample_size": int(n),
            "fraud_base_rate_pct": round(float(is_fraud.mean()) * 100, 2),
            "fraud_count": int(is_fraud.sum()),
            "total_volume": round(float(amounts.sum()), 2),
            "fraud_volume": round(float(amounts[is_fraud == 1].sum()), 2),
            "distinct_receivers": int(df["receiver_vpa"].nunique()) if "receiver_vpa" in df.columns else 0,
            "mean_score": round(float(scores.mean()), 2),
            "median_score": round(float(np.median(scores)), 2),
            "score_distribution": score_bins,
            "feature_benchmarks": benchmarks,
            "model_validation": validation,
            "model_metrics": {
                "auc": getattr(self._risk_engine, "auc", None) if self._risk_engine else None,
                "n_estimators": getattr(self._risk_engine, "n_estimators", None) if self._risk_engine else None,
            },
            "feature_importances": importances,
            "time_series": ts,
            "amount_buckets": amount_buckets,
            "top_receivers": top,
            "fraud_breakdown": breakdown,
            "risk_bands": bands,
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

    # ------------------------------------------------------------- rule mirror
    @staticmethod
    def _vector_rules(df: pd.DataFrame) -> np.ndarray:
        """Vectorised mirror of the live heuristic rule engine (for population scoring)."""
        amount = pd.to_numeric(df.get("amount"), errors="coerce").fillna(0)
        qr_scanned = pd.to_numeric(df.get("qr_scanned"), errors="coerce").fillna(0)
        qr_valid = pd.to_numeric(df.get("qr_hash_valid"), errors="coerce").fillna(1)
        age = pd.to_numeric(df.get("beneficiary_age_days"), errors="coerce").fillna(365)
        time_added = pd.to_numeric(df.get("time_since_beneficiary_added_sec"), errors="coerce").fillna(86400)
        velocity = pd.to_numeric(df.get("velocity_10m"), errors="coerce").fillna(0)
        outflow = pd.to_numeric(df.get("outflow_ratio_5m"), errors="coerce").fillna(0)
        in_deg = pd.to_numeric(df.get("in_degree_1h"), errors="coerce").fillna(0)
        ip_risk = pd.to_numeric(df.get("ip_risk_score"), errors="coerce").fillna(0.05)
        vpa = df.get("receiver_vpa", pd.Series([""] * len(df))).astype(str).str.lower()

        penalty = np.zeros(len(df))
        penalty += 35 * ((outflow > 0.8) & (in_deg >= 5)).to_numpy()
        penalty += 25 * ((time_added < 120) & (amount > 5000)).to_numpy()
        penalty += 20 * (velocity >= 5).to_numpy()
        penalty += 20 * (age <= 3).to_numpy()
        penalty += 15 * (ip_risk > 0.7).to_numpy()
        keyword_hit = (
            vpa.str.contains("fastcash") | vpa.str.contains("refund") | vpa.str.contains("lottery")
        ).to_numpy()
        penalty += 30 * keyword_hit
        penalty += 60 * (((qr_scanned == 1) & (qr_valid == 0)).to_numpy())
        return np.minimum(penalty, 100.0)

    # ------------------------------------------------------------------ pieces
    @staticmethod
    def _validation(proba: np.ndarray, is_fraud: np.ndarray) -> Dict[str, Any]:
        pred = (proba >= 0.5).astype(int)
        tp = int(((pred == 1) & (is_fraud == 1)).sum())
        fp = int(((pred == 1) & (is_fraud == 0)).sum())
        fn = int(((pred == 0) & (is_fraud == 1)).sum())
        tn = int(((pred == 0) & (is_fraud == 0)).sum())
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
        accuracy = (tp + tn) / max(len(is_fraud), 1)
        return {
            "confusion_matrix": {
                "true_positive": tp,
                "false_positive": fp,
                "false_negative": fn,
                "true_negative": tn,
            },
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "accuracy": round(accuracy, 4),
            "sample_size": int(len(is_fraud)),
            "threshold": 0.5,
        }

    @staticmethod
    def _time_series(df: pd.DataFrame) -> List[Dict[str, Any]]:
        try:
            ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
            frame = pd.DataFrame({"date": ts.dt.strftime("%Y-%m-%d"), "amount": df["amount"], "is_fraud": df["is_fraud"]})
            frame = frame.dropna(subset=["date"])
            grouped = frame.groupby("date").agg(
                count=("amount", "count"),
                volume=("amount", "sum"),
                fraud=("is_fraud", "sum"),
            ).reset_index()
            grouped["fraud_rate"] = (grouped["fraud"] / grouped["count"] * 100).round(2)
            grouped = grouped.sort_values("date").tail(30)
            return [
                {
                    "date": str(r["date"])[5:],
                    "count": int(r["count"]),
                    "volume": round(float(r["volume"]), 2),
                    "fraud": int(r["fraud"]),
                    "fraud_rate": float(r["fraud_rate"]),
                }
                for _, r in grouped.iterrows()
            ]
        except Exception:
            return []

    @staticmethod
    def _top_receivers(df: pd.DataFrame) -> List[Dict[str, Any]]:
        try:
            grouped = df.groupby("receiver_vpa").agg(
                volume=("amount", "sum"),
                count=("amount", "count"),
                fraud=("is_fraud", "sum"),
                senders=("sender_id", "nunique"),
            ).reset_index()
            grouped["fraud_ratio"] = (grouped["fraud"] / grouped["count"]).round(3)
            top = grouped.sort_values("volume", ascending=False).head(8)
            return [
                {
                    "vpa": str(r["receiver_vpa"]),
                    "volume": round(float(r["volume"]), 2),
                    "count": int(r["count"]),
                    "fraud": int(r["fraud"]),
                    "senders": int(r["senders"]),
                    "fraud_ratio": float(r["fraud_ratio"]),
                }
                for _, r in top.iterrows()
            ]
        except Exception:
            return []

    # ------------------------------------------------------------------ lookups
    def percentile_of_score(self, score: float) -> float:
        scores = self._scores
        if scores.size == 0:
            self.snapshot()
            scores = self._scores
        if scores.size == 0:
            return 0.0
        return round(float((scores < score).mean() * 100), 1)

    def benchmark(self, feature: str):
        for entry in self._data.get("feature_benchmarks", []):
            if entry["key"] == feature:
                return entry
        return None

    def percentile_of_feature(self, feature: str, value: float) -> float:
        snap = self.snapshot()
        bench = None
        for entry in snap.get("feature_benchmarks", []):
            if entry["key"] == feature:
                bench = entry
                break
        if bench is None:
            return 0.0
        # Approximate percentile by stacking the cached histogram.
        hist = bench.get("histogram", [])
        total = sum(h["count"] for h in hist)
        if total == 0:
            return 0.0
        accumulated = 0
        for h in hist:
            lo, hi = h["bin"].split("-")
            lo, hi = float(lo), float(hi)
            if value < lo:
                break
            if value <= hi:
                accumulated += h["count"] * ((value - lo) / (hi - lo) if hi > lo else 1.0)
                break
            accumulated += h["count"]
        return round(min(100.0, (accumulated / total) * 100), 1)


_analytics: PopulationAnalytics | None = None


def get_analytics(risk_engine=None) -> PopulationAnalytics:
    global _analytics
    if _analytics is None:
        _analytics = PopulationAnalytics(risk_engine)
    elif risk_engine is not None and _analytics.risk_engine is None:
        _analytics.bind_engine(risk_engine)
    return _analytics
