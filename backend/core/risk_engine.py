import asyncio
import os
from typing import Any, Dict, List, Optional

import httpx
import joblib
import numpy as np

from backend.core.qr_engine import verify_upi_qr

MODEL_PATH = "d:/Diamond-protect-v2/backend/models/rf_fraud_model.pkl"
# Optional: set OPENROUTER_API_KEY in the environment to enable the GenAI narrative.
# Without it the platform runs fully offline and generates the explanation locally.
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
AI_MODELS = ["openai/gpt-4o-mini", "google/gemini-2.0-flash-001", "openrouter/auto"]
AI_TIMEOUT_SECONDS = 6.0

RULE_WEIGHT = 0.45
ML_WEIGHT = 0.55
CRITICAL_THRESHOLD = 70
WARNING_THRESHOLD = 40

FEATURE_LABELS = {
    "amount": "Transaction amount",
    "qr_scanned": "Paid by scanning a QR",
    "qr_hash_valid": "QR signature valid",
    "beneficiary_age_days": "Beneficiary account age (days)",
    "time_since_beneficiary_added_sec": "Time since beneficiary added",
    "velocity_10m": "Payment velocity (10 min)",
    "outflow_ratio_5m": "Rapid outflow ratio",
    "in_degree_1h": "Distinct incoming counterparties",
    "ip_risk_score": "Device / IP anomaly score",
}


class RiskEngine:
    def __init__(self):
        self.model = None
        self.model_data = None
        self.feature_cols: List[str] = []
        self.feature_importances: Dict[str, float] = {}
        self.auc: Optional[float] = None
        self.n_estimators: Optional[int] = None
        self.load_model()

    # ------------------------------------------------------------------- model
    def load_model(self):
        if not os.path.exists(MODEL_PATH):
            print("[risk] model file not found - heuristic rules only.")
            return
        try:
            self.model_data = joblib.load(MODEL_PATH)
            self.model = self.model_data["model"]
            self.feature_cols = self.model_data.get("feature_cols", [])
            self.feature_importances = self.model_data.get("feature_importances", {})
            self.auc = self.model_data.get("auc")
            try:
                self.n_estimators = int(self.model.n_estimators)
            except Exception:
                self.n_estimators = None
            print("[risk] Random Forest loaded "
                  f"({self.n_estimators} trees, AUC={self.auc}).")
        except Exception as exc:
            print(f"[risk] failed to load model: {exc}")

    def predict_proba_frame(self, df) -> np.ndarray:
        frame = df[self.feature_cols].astype(float)
        return self.model.predict_proba(frame)[:, 1]

    def predict_probability(self, features: List[float]) -> float:
        if self.model is None:
            return 0.0
        arr = np.array([features], dtype=float)
        try:
            return float(self.model.predict_proba(arr)[0][1])
        except Exception:
            return 0.0

    # ------------------------------------------------------------------- rules
    @staticmethod
    def rule_checks(txn: Dict[str, Any], telemetry: Dict[str, Any], qr_result: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
        amount = float(txn.get("amount", 0.0) or 0.0)
        outflow = float(telemetry.get("outflow_ratio_5m", 0.0))
        in_deg = int(telemetry.get("in_degree_1h", 0))
        time_added = int(telemetry.get("time_since_beneficiary_added_sec", 86400))
        velocity = int(telemetry.get("velocity_10m", 0))
        age = int(telemetry.get("beneficiary_age_days", 365))
        ip_risk = float(telemetry.get("ip_risk_score", 0.05))
        vpa = str(txn.get("receiver_vpa", "") or "")

        checks: List[Dict[str, Any]] = []

        def add(rule_id, title, intent, triggered, observed, threshold, penalty, interpretation):
            checks.append({
                "id": rule_id,
                "title": title,
                "intent": intent,
                "triggered": bool(triggered),
                "observed": observed,
                "threshold": threshold,
                "penalty": int(penalty) if triggered else 0,
                "max_penalty": int(penalty),
                "interpretation": interpretation,
            })

        drain_trig = outflow > 0.8 and in_deg >= 5
        add("R1", "Rapid drain / mule fan-out",
            "Catches accounts that collect money from several victims and push it out again within minutes.",
            drain_trig,
            f"{outflow * 100:.0f}% of inflow forwarded, {in_deg} distinct payers",
            "outflow > 80% AND counterparties >= 5",
            35,
            "Funds are not being retained for legitimate use; this is the behavioural fingerprint of a money-mule collection account."
            if drain_trig else "Inflow and outflow are balanced - the payee behaves like a normal recipient.")

        add("R2", "Fresh beneficiary + high-value transfer",
            "Detects first-time, seconds-old beneficiaries receiving large sums - the classic impersonation scam pattern.",
            time_added < 120 and amount > 5000,
            f"beneficiary added {time_added} s ago, amount ₹{amount:,.2f}",
            "< 120 s old AND amount > ₹5,000",
            25,
            "There is no relationship history to justify a large transfer to a brand-new address."
            if (time_added < 120 and amount > 5000) else "Either the beneficiary has history or the amount is small enough to be routine.")

        add("R3", "Velocity spike",
            "Measures burst behaviour: many payment attempts in a short window indicate scripted or coerced transfers.",
            velocity >= 5,
            f"{velocity} payments to this payee inside a 10-minute window",
            ">= 5 payments / 10 min",
            20,
            "Human beings rarely transact at this rate; automation or a draining mule is more likely."
            if velocity >= 5 else "Payment cadence matches normal human usage.")

        add("R4", "Ephemeral account",
            "Flags VPA handles registered within the last 3 days - burner accounts used in refund and lottery scams.",
            age <= 3,
            f"beneficiary handle is {age} day(s) old",
            "<= 3 days old",
            20,
            "Ultra-short-lived handles are cheap to create and abandoned immediately after the fraud."
            if age <= 3 else "Handle has accumulated history beyond the burner-account window.")

        add("R5", "Device / IP anomaly",
            "Uses endpoint telemetry (emulator, proxy, datacentre IP) recorded against the payee.",
            ip_risk > 0.7,
            f"{ip_risk * 100:.0f}% anomaly score",
            "> 70% anomaly",
            15,
            "The endpoint fingerprint is consistent with emulators or relay infrastructure used by fraud operations."
            if ip_risk > 0.7 else "Endpoint fingerprint is consistent with an ordinary consumer device.")

        lower_vpa = vpa.lower()
        scam_token = next((tok for tok in ("fastcash", "refund", "lottery") if tok in lower_vpa), None)
        add("R6", "Scam handle pattern",
            "Lexical analysis of the beneficiary handle against known social-engineering naming conventions.",
            scam_token is not None,
            f"handle '{vpa}' contains '{scam_token}'" if scam_token else f"handle '{vpa}' carries no known scam token",
            "fastcash / refund / lottery token present",
            30,
            "The handle itself mimics reward, refund or jackpot language used to lure victims."
            if scam_token else "Handle naming does not match known scam conventions.")

        qr_trig = bool(qr_result) and not qr_result.get("is_valid") and qr_result.get("trust_status") != "SKIPPED"
        qr_penalty = int(qr_result.get("score_penalty", 0)) if qr_result else 0
        add("R7", "QR cryptographic integrity",
            "BIS IS 18000 signature, scheme and nameplate verification performed in Stage 1.",
            qr_trig,
            f"verdict {qr_result.get('trust_status', 'SKIPPED')} with penalty +{qr_penalty}" if qr_result else "no QR payload supplied",
            "signature valid AND scheme upi://pay AND nameplate match",
            qr_penalty if qr_penalty else 60,
            "The scanned code does not cryptographically belong to the storefront presenting it."
            if qr_trig else "Payload passed (or did not require) cryptographic verification.")

        return checks

    # --------------------------------------------------------------- evaluation
    def evaluate(self, txn: Dict[str, Any], signals: Dict[str, Any],
                 analytics=None, graph_engine=None) -> Dict[str, Any]:
        """
        Full staged analysis. Returns synchronously in milliseconds -
        no network call is made on this path (AI narrative is fetched separately).
        """
        telemetry = signals.get("telemetry", {})
        qr_result = verify_upi_qr(txn.get("raw_qr", ""), txn.get("qr_claimed_name", ""))

        rule_checks = self.rule_checks(txn, telemetry, qr_result)
        rule_penalty = min(sum(c["penalty"] for c in rule_checks), 100)

        qr_scanned = bool(txn.get("qr_scanned", False)) or bool(txn.get("raw_qr"))
        qr_valid = 1 if (qr_result.get("is_valid") or qr_result.get("trust_status") == "SKIPPED") else 0

        features = [
            float(txn.get("amount", 0.0) or 0.0),
            1.0 if qr_scanned else 0.0,
            float(qr_valid),
            float(telemetry.get("beneficiary_age_days", 365)),
            float(telemetry.get("time_since_beneficiary_added_sec", 86400)),
            float(telemetry.get("velocity_10m", 0)),
            float(telemetry.get("outflow_ratio_5m", 0.0)),
            float(telemetry.get("in_degree_1h", 0)),
            float(telemetry.get("ip_risk_score", 0.05)),
        ]

        ml_probability = self.predict_probability(features)
        ml_score = int(round(ml_probability * 100))

        final_score = int(round(min(100, max(0, RULE_WEIGHT * rule_penalty + ML_WEIGHT * ml_score))))

        if final_score >= CRITICAL_THRESHOLD:
            risk_level, badge = "CRITICAL", "red"
            recommendation = "BLOCKED / DO NOT PAY: extreme fraud and mule-activity probability. Verify the receiver offline and report the handle to your bank."
        elif final_score >= WARNING_THRESHOLD:
            risk_level, badge = "WARNING", "yellow"
            recommendation = "PROCEED WITH CAUTION: irregular beneficiary signals detected. Confirm the payee name on the UPI app before entering your MPIN."
        else:
            risk_level, badge = "LOW_RISK", "green"
            recommendation = "SAFE: consistent beneficiary signals and (where applicable) a verified cryptographic QR payload."

        triggered = [c for c in rule_checks if c["triggered"]]
        reasons = [f"{c['id']} {c['title']}: {c['observed']} ({c['threshold']})." for c in triggered]
        if not reasons:
            reasons = ["No behavioural, cryptographic or network rule was triggered - signals sit inside normal population ranges."]

        analysis = self.build_analysis(
            txn=txn,
            signals=signals,
            qr_result=qr_result,
            rule_checks=rule_checks,
            rule_penalty=rule_penalty,
            ml_probability=ml_probability,
            ml_score=ml_score,
            final_score=final_score,
            risk_level=risk_level,
            analytics=analytics,
            graph_engine=graph_engine,
        )

        return {
            "risk_score": final_score,
            "risk_level": risk_level,
            "badge_color": badge,
            "ml_confidence": ml_score,
            "ml_probability": round(ml_probability, 4),
            "rule_penalty": rule_penalty,
            "reasons": reasons,
            "recommended_action": recommendation,
            "ai_explanation": self.local_explanation(final_score, risk_level, triggered, ml_probability, analysis),
            "ai_source": "local_deterministic",
            "qr_verification": qr_result,
            "signals": signals,
            "analysis": analysis,
            "timestamp": txn.get("timestamp", ""),
        }

    # ------------------------------------------------------------------ stages
    def build_analysis(self, *, txn, signals, qr_result, rule_checks, rule_penalty,
                       ml_probability, ml_score, final_score, risk_level,
                       analytics, graph_engine) -> Dict[str, Any]:
        telemetry = signals.get("telemetry", {})
        graph_info = signals.get("graph", {})
        profile = signals.get("profile", {})

        snapshot = analytics.snapshot() if analytics else {}
        percentile = analytics.percentile_of_score(final_score) if analytics else 0.0

        # ---- Stage 1: QR -------------------------------------------------------
        qr_status = qr_result.get("trust_status", "SKIPPED")
        qr_map = {"VERIFIED": "PASS", "WARNING": "WARN", "PHISHING_MALICIOUS": "FAIL", "SKIPPED": "SKIPPED"}
        qr_penalty = int(qr_result.get("score_penalty", 0))
        stage1 = {
            "id": 1,
            "key": "qr_integrity",
            "title": "Cryptographic QR & Domain Integrity",
            "standard": "BIS IS 18000 / NPCI UPI payload",
            "status": qr_map.get(qr_status, "SKIPPED"),
            "trust_status": qr_status,
            "score_impact": int(round(RULE_WEIGHT * qr_penalty)),
            "points": int(round(RULE_WEIGHT * qr_penalty)),
            "weight_pct": 45,
            "bucket": "rule_engine_45",
            "qr_penalty": qr_penalty,
            "note": "This stage's penalty is applied through Rule R7, so Stage 1 and Stage 2 share the same 45% bucket.",
            "summary": {
                "VERIFIED": "The payload carried a valid HMAC-SHA256 signature over the payee tuple and matched the storefront nameplate.",
                "WARNING": "The payload parses as a genuine UPI instruction but is unsigned, so tamper-proofing cannot be proven.",
                "PHISHING_MALICIOUS": "The payload is either an off-UPI web redirect or a signed tuple that contradicts the storefront - payment must not proceed.",
                "SKIPPED": "No QR payload was supplied (manual UPI entry), so cryptographic checks did not run. Rule R7 stays neutral.",
            }.get(qr_status, ""),
            "checks": qr_result.get("checks", []),
            "issues": qr_result.get("issues", []),
            "evidence": {
                "payee_address": qr_result.get("pa", ""),
                "signed_payee_name": qr_result.get("pn", ""),
                "merchant_id": qr_result.get("mid", ""),
                "signature_present": bool(qr_result.get("has_valid_sig")),
                "claimed_nameplate": txn.get("qr_claimed_name", ""),
            },
            "explanation": (
                "Stage 1 re-computes the HMAC-SHA256 digest of the canonical tuple "
                "pa|pn|mc|mid|ts and compares it against the signature embedded in the QR. "
                "A mismatch proves the sticker or payload was altered after signing; a non-upi:// scheme proves the code "
                "never intended to enter the UPI switch at all. Penalty: "
                f"+{qr_result.get('score_penalty', 0)} points applied to the heuristic bucket."
            ),
        }

        # ---- Stage 2: rules ----------------------------------------------------
        triggered = [c for c in rule_checks if c["triggered"]]
        qr_raw = int(qr_result.get("score_penalty", 0))
        own_raw = max(rule_penalty - qr_raw, 0)
        stage2 = {
            "id": 2,
            "key": "behavioural_rules",
            "title": "Behavioural Heuristic Rule Engine",
            "standard": "DSCI fintech telemetry / fraud-typology rules",
            "status": "FAIL" if rule_penalty >= 50 else ("WARN" if rule_penalty > 0 else "PASS"),
            "score_impact": int(round(RULE_WEIGHT * own_raw)),
            "points": int(round(RULE_WEIGHT * own_raw)),
            "weight_pct": int(RULE_WEIGHT * 100),
            "bucket": "rule_engine_45",
            "own_raw_penalty": own_raw,
            "summary": (
                f"{len(triggered)} of {len(rule_checks)} rules triggered for {rule_penalty} raw points "
                f"({int(round(RULE_WEIGHT * rule_penalty))} weighted points, of which "
                f"{int(round(RULE_WEIGHT * own_raw))} come from behavioural rules and "
                f"{int(round(RULE_WEIGHT * qr_raw))} from Stage 1 QR verification)."
            ),
            "rules": rule_checks,
            "triggered_count": len(triggered),
            "total_count": len(rule_checks),
            "raw_penalty": rule_penalty,
            "explanation": (
                "Each rule encodes one documented mule or phishing typology. Rules are deterministic and independently "
                "auditable: every one states the observed value, the threshold it was compared against, and the fixed "
                "penalty it contributes. The raw sum is capped at 100 before weighting, so no single rule can dominate "
                "the ensemble by itself. R7 is fed directly by Stage 1; the remaining rules read the telemetry resolved "
                "by the signal pipeline (ledger record, graph topology, or neutral when unobserved)."
            ),
        }

        # ---- Stage 3: ML -------------------------------------------------------
        importances = snapshot.get("feature_importances", []) or [
            {"feature": k, "label": FEATURE_LABELS.get(k, k), "importance": 0.0, "pct": 0.0}
            for k in self.feature_cols
        ]
        feature_names = self.feature_cols or [
            "amount", "qr_scanned", "qr_hash_valid", "beneficiary_age_days",
            "time_since_beneficiary_added_sec", "velocity_10m", "outflow_ratio_5m",
            "in_degree_1h", "ip_risk_score"
        ]
        feature_values = dict(zip(feature_names, [
            txn.get("amount", 0), 1 if txn.get("qr_scanned") or txn.get("raw_qr") else 0,
            qr_result.get("is_valid", False), telemetry.get("beneficiary_age_days", 365),
            telemetry.get("time_since_beneficiary_added_sec", 86400), telemetry.get("velocity_10m", 0),
            telemetry.get("outflow_ratio_5m", 0.0), telemetry.get("in_degree_1h", 0),
            telemetry.get("ip_risk_score", 0.05),
        ]))

        contributions = []
        for entry in importances:
            key = entry["feature"]
            bench = next((b for b in snapshot.get("feature_benchmarks", []) if b["key"] == key), None)
            raw_value = feature_values.get(key, 0)
            severity = 0.0

            if key == "qr_hash_valid":
                severity = 0.0 if raw_value in (1, True, 1.0) else 1.0
            elif key == "qr_scanned":
                severity = 0.15 if raw_value in (1, True, 1.0) else 0.0
            elif key in ("outflow_ratio_5m", "ip_risk_score"):
                severity = float(np.clip(float(raw_value), 0, 1))
            elif key == "beneficiary_age_days":
                severity = float(np.clip(1.0 - (float(raw_value) / 30.0), 0, 1))
            elif key == "time_since_beneficiary_added_sec":
                severity = float(np.clip(1.0 - (float(raw_value) / 86400.0), 0, 1))
            elif bench:
                p99 = bench.get("p99") or 0
                severity = float(np.clip(float(raw_value) / float(p99), 0, 1)) if p99 else 0.0
            else:
                severity = 0.0

            impact = float(entry.get("importance", 0.0)) * severity
            contributions.append({
                "feature": key,
                "label": entry.get("label", FEATURE_LABELS.get(key, key)),
                "value": raw_value if not isinstance(raw_value, bool) else int(raw_value),
                "importance": round(float(entry.get("importance", 0.0)), 4),
                "severity": round(severity, 3),
                "impact": round(impact, 4),
                "impact_pct": 0.0,
                "percentile": analytics.percentile_of_feature(key, float(raw_value)) if analytics else None,
            })
        total_impact = sum(c["impact"] for c in contributions) or 1.0
        for c in contributions:
            c["impact_pct"] = round((c["impact"] / total_impact) * 100, 1)
        contributions.sort(key=lambda c: c["impact"], reverse=True)

        validation = snapshot.get("model_validation", {})
        stage3 = {
            "id": 3,
            "key": "ml_inference",
            "title": "Random Forest Classifier Inference",
            "standard": "Scikit-Learn supervised ensemble",
            "status": "FAIL" if ml_score >= 70 else ("WARN" if ml_score >= 40 else "PASS"),
            "score_impact": int(round(ML_WEIGHT * ml_score)),
            "points": int(round(ML_WEIGHT * ml_score)),
            "weight_pct": int(ML_WEIGHT * 100),
            "summary": (
                f"The forest assigns a {ml_probability * 100:.1f}% fraud probability to this transaction - "
                f"{ml_score} points after weighting."
            ),
            "probability": round(ml_probability, 4),
            "probability_pct": round(ml_probability * 100, 1),
            "n_estimators": self.n_estimators,
            "validation": validation,
            "validation_auc": self.auc,
            "feature_contributions": contributions,
            "explanation": (
                "The classifier consumes the nine tabular signals (amount, QR validity, account age, velocity, drain "
                "ratio, counterparty concentration, endpoint anomaly) and averages the vote of "
                f"{self.n_estimators or '100'} decision trees. The validation block is measured on a held-out 20% split "
                "of the live ledger, so it describes how this model behaves on unseen data - not on the rows it trained on."
            ),
        }

        # ---- Stage 4: graph ----------------------------------------------------
        in_deg = int(graph_info.get("in_degree", 0))
        out_deg = int(graph_info.get("out_degree", 0))
        drain = float(graph_info.get("drain_ratio", 0.0))
        avg_degree = float(graph_info.get("network_avg_degree", 0.0))
        degree_ratio = round((in_deg + out_deg) / avg_degree, 2) if avg_degree else 0.0
        cycles = []
        if graph_engine is not None:
            try:
                clusters = graph_engine.detect_mule_rings() or {}
                node_id = signals.get("receiver_id")
                cycles = [c for c in clusters.get("circular_chains", []) if node_id in c.get("nodes", [])]
            except Exception:
                cycles = []
        drain_component = float(np.clip(drain * 75.0, 0, 60))
        hub_component = 25.0 if graph_info.get("is_hub_mule") else 0.0
        cycle_component = 20.0 if cycles else 0.0
        concentration_component = float(np.clip((in_deg / avg_degree) * 5.0, 0, 15)) if avg_degree else 0.0
        graph_score = int(np.clip(drain_component + hub_component + cycle_component + concentration_component, 0, 100))

        stage4 = {
            "id": 4,
            "key": "network_topology",
            "title": "Money-Mule Network Topology",
            "standard": "NetworkX directed-flow analysis",
            "status": "FAIL" if graph_score >= 70 else ("WARN" if graph_score >= 40 else ("PASS" if graph_info.get("observed") else "SKIPPED")),
            "score_impact": 0,
            "points": 0,
            "weight_pct": 0,
            "bucket": "evidence_only",
            "risk_index": graph_score,
            "risk_index_components": [
                {"component": "Rapid drain (inflow that leaves again)", "points": round(drain_component, 1), "max": 60,
                 "formula": "min(60, drain_ratio x 75)"},
                {"component": "Cluster-confirmed hub mule", "points": hub_component, "max": 25,
                 "formula": "25 if the hub detector flagged this node"},
                {"component": "Membership in a wash-trading ring", "points": cycle_component, "max": 20,
                 "formula": "20 if the node appears in a 3-6 node cycle"},
                {"component": "Counterparty concentration vs network", "points": round(concentration_component, 1), "max": 15,
                 "formula": "min(15, in_degree / avg_degree x 5)"},
            ],
            "note": "Topology is corroborating evidence: it feeds Rules R1/R3 and is never added to the fused score a second time.",
            "summary": (
                f"Payee node has {in_deg} inbound / {out_deg} outbound edges and drains {drain * 100:.0f}% of inflow "
                f"(role {graph_info.get('role', 'UNOBSERVED')}); topology risk index {graph_score}/100."
            ),
            "observed": bool(graph_info.get("observed")),
            "metrics": {
                "in_degree": in_deg,
                "out_degree": out_deg,
                "inflow": graph_info.get("inflow", 0.0),
                "outflow": graph_info.get("outflow", 0.0),
                "drain_ratio": drain,
                "role": graph_info.get("role", "UNOBSERVED"),
                "is_hub_mule": bool(graph_info.get("is_hub_mule")),
                "network_nodes": graph_info.get("network_nodes", 0),
                "network_edges": graph_info.get("network_edges", 0),
                "network_avg_degree": avg_degree,
                "degree_ratio": degree_ratio,
                "cycles_involving_node": len(cycles),
                "cycles": cycles[:3],
            },
            "degree_distribution": (graph_engine.get_degree_distribution() if graph_engine else []),
            "explanation": (
                "The ledger is projected into a directed graph where an edge sender->receiver carries summed value. "
                "A node whose inbound edges come from many distinct payers while most of that value leaves again is a "
                "collection hub; membership in a strongly-connected component of 3-6 nodes indicates a wash-trading ring. "
                + ("This payee was not found in the graph, so topology evidence is unavailable and treated as neutral."
                   if not graph_info.get("observed") else
                   f"Its combined degree is {degree_ratio}x the network average of {avg_degree}.")
            ),
        }

        # ---- Stage 5: fusion ---------------------------------------------------
        components = [
            {"name": "Heuristic rule engine", "weight": RULE_WEIGHT, "raw": rule_penalty,
             "weighted": round(RULE_WEIGHT * rule_penalty, 2), "source": "Stage 1 + Stage 2"},
            {"name": "Random Forest model", "weight": ML_WEIGHT, "raw": ml_score,
             "weighted": round(ML_WEIGHT * ml_score, 2), "source": "Stage 3"},
        ]
        stage5 = {
            "id": 5,
            "key": "ensemble_fusion",
            "title": "Weighted Ensemble Fusion & Verdict",
            "standard": "Score fusion with calibrated bands",
            "status": "FAIL" if risk_level == "CRITICAL" else ("WARN" if risk_level == "WARNING" else "PASS"),
            "score_impact": final_score,
            "points": final_score,
            "weight_pct": 100,
            "bucket": "fusion",
            "summary": (
                f"{RULE_WEIGHT:.0%} of the rule bucket + {ML_WEIGHT:.0%} of the model bucket = {final_score}/100, "
                f"which is the {percentile}th percentile of all {snapshot.get('sample_size', 0)} evaluated transactions."
            ),
            "components": components,
            "final_score": final_score,
            "risk_level": risk_level,
            "thresholds": {
                "critical": CRITICAL_THRESHOLD,
                "warning": WARNING_THRESHOLD,
            },
            "population_percentile": percentile,
            "score_distribution": snapshot.get("score_distribution", []),
            "risk_bands": snapshot.get("risk_bands", []),
            "explanation": (
                "The two independent estimators are fused at a fixed 45/55 split: the rule engine supplies auditability "
                "(every point is attributable to a named typology) while the forest supplies generalisation (patterns that "
                "no hand-written rule captures). The result is banded at 40 and 70, and located inside the population "
                "distribution so an analyst can see whether this score is ordinary or an extreme outlier."
            ),
        }

        # ---- radar -------------------------------------------------------------
        age = int(telemetry.get("beneficiary_age_days", 365))
        velocity = int(telemetry.get("velocity_10m", 0))
        radar = [
            {"dimension": "QR integrity", "score": int(qr_result.get("score_penalty", 0)),
             "formula": "HMAC/nameplate penalty reported by Stage 1"},
            {"dimension": "Behaviour rules", "score": int(rule_penalty),
             "formula": "sum of triggered rule penalties, capped at 100"},
            {"dimension": "ML model", "score": ml_score,
             "formula": "Random Forest fraud probability x 100"},
            {"dimension": "Network topology", "score": int(graph_score),
             "formula": "drain x 75 (max 60) + hub 25 + wash-ring 20 + concentration 15"},
            {"dimension": "Velocity", "score": int(np.clip(velocity * 6, 0, 100)),
             "formula": "min(100, payments_in_10min x 6)"},
            {"dimension": "Identity age", "score": int(np.clip((10 - min(age, 10)) * 10, 0, 100)),
             "formula": "min(10, age_days) inverted x 10"},
        ]

        # ---- signal benchmarks --------------------------------------------------
        benchmarks = []
        for meta in signals.get("meta", []):
            bench = next((b for b in snapshot.get("feature_benchmarks", []) if b["key"] == meta["key"]), None)
            entry = {
                "key": meta["key"],
                "label": meta["label"],
                "value": meta["value"],
                "display": meta["display"],
                "observed": meta["observed"],
                "source": meta["source"],
                "explanation": meta["explanation"],
                "percentile": None,
                "population": None,
            }
            if bench:
                entry["percentile"] = analytics.percentile_of_feature(meta["key"], float(meta["value"])) if analytics else None
                entry["population"] = {
                    "p50": bench["p50"], "p90": bench["p90"], "p99": bench["p99"],
                    "max": bench["max"], "mean": bench["mean"], "label": bench["label"],
                }
            benchmarks.append(entry)

        # ---- contributions ------------------------------------------------------
        raw_sum = sum(c["penalty"] for c in rule_checks) or 1
        scale = rule_penalty / raw_sum
        contributions_bar = [
            {"name": c["title"], "value": int(round(RULE_WEIGHT * c["penalty"] * scale)), "bucket": "Rule engine (45%)"}
            for c in rule_checks if c["triggered"]
        ]
        contributions_bar.append(
            {"name": "Random Forest model", "value": int(round(ML_WEIGHT * ml_score)), "bucket": "Model (55%)"}
        )

        stage_contributions = [
            {"stage": st["id"], "label": st["title"], "points": int(st.get("points", 0)), "status": st["status"]}
            for st in (stage1, stage2, stage3, stage4)
        ]

        return {
            "summary": (
                f"Five-stage pipeline executed. Stage 1 (QR) -> {stage1['status']}; "
                f"Stage 2 (rules) -> {rule_penalty}/100 raw; Stage 3 (model) -> {ml_probability * 100:.1f}% fraud; "
                f"Stage 4 (graph) -> {stage4['status']}; Stage 5 (fusion) -> {final_score}/100 ({risk_level})."
            ),
            "stages": [stage1, stage2, stage3, stage4, stage5],
            "contributions": contributions_bar,
            "stage_contributions": stage_contributions,
            "evidence": {
                "telemetry_source": signals.get("telemetry_source", "unknown"),
                "cross_checks": signals.get("cross_checks", {}),
                "qr_penalty": qr_penalty,
                "rule_penalty": rule_penalty,
                "ml_score": ml_score,
                "graph_risk_index": graph_score,
            },
            "radar": radar,
            "benchmarks": benchmarks,
            "model_validation": validation,
            "model_auc": self.auc,
            "population": {
                "sample_size": snapshot.get("sample_size", 0),
                "fraud_base_rate_pct": snapshot.get("fraud_base_rate_pct", 0.0),
                "mean_score": snapshot.get("mean_score", 0.0),
                "median_score": snapshot.get("median_score", 0.0),
                "percentile": percentile,
                "score_distribution": snapshot.get("score_distribution", []),
                "generated_at": snapshot.get("generated_at", ""),
            },
            "ledger_profile": profile,
            "signal_sources": signals.get("meta", []),
        }

    # ------------------------------------------------------------ local narrative
    @staticmethod
    def local_explanation(score: int, level: str, triggered: List[Dict[str, Any]],
                          ml_probability: float, analysis: Dict[str, Any]) -> str:
        qr_stage = analysis["stages"][0]
        graph_stage = analysis["stages"][3]
        pop = analysis.get("population", {})
        parts = []

        parts.append(
            {
                "VERIFIED": "The scanned QR carried a valid BIS HMAC-SHA256 signature and matched the storefront nameplate, so the payload itself is authentic.",
                "WARNING": "The UPI payload is structurally genuine but unsigned, so nobody can prove the sticker on the counter was not swapped.",
                "PHISHING_MALICIOUS": "The scanned code is not a legitimate UPI instruction at all - it is an off-network phishing redirect or a spoofed payee tuple.",
                "SKIPPED": "You entered the UPI ID directly, so no cryptographic QR evidence was available for this evaluation.",
            }.get(qr_stage.get("trust_status", "SKIPPED"), "")
        )

        if triggered:
            names = ", ".join(f"{c['id']} {c['title']}" for c in triggered[:3])
            parts.append(
                f"{len(triggered)} of 7 behavioural rules fired ({names}), driven by "
                f"{triggered[0]['observed'].lower()}."
            )
        else:
            parts.append(
                "No behavioural rule fired - velocity, drain ratio, account age and endpoint telemetry all sit inside normal ranges."
            )

        if graph_stage["observed"]:
            parts.append(
                "The Random Forest assigns "
                f"{ml_probability * 100:.1f}% fraud probability, and in the money-flow graph this payee behaves as "
                f"{graph_stage['metrics']['role'].replace('_', ' ').lower()} "
                f"(draining {graph_stage['metrics']['drain_ratio'] * 100:.0f}% of what it receives)."
            )
        else:
            parts.append(
                f"The Random Forest assigns {ml_probability * 100:.1f}% fraud probability, and the payee is not yet "
                "present in the money-flow graph, so no topology evidence exists for it."
            )

        parts.append(
            f"Combined score {score}/100 ({level.replace('_', ' ').title()}) places it above "
            f"{pop.get('percentile', 0)}% of the {pop.get('sample_size', 0)} transactions evaluated so far."
        )
        return " ".join(parts)

    # -------------------------------------------------------- local narrative
    @staticmethod
    def local_narrative(payload: Dict[str, Any]) -> str:
        """Deterministic, offline explainability - no external model required."""
        score = int(payload.get("risk_score", 0) or 0)
        level = str(payload.get("risk_level", "LOW_RISK")).replace("_", " ").title()
        qr_status = str(payload.get("qr_status") or "SKIPPED")
        ml_probability = float(payload.get("ml_probability") or 0.0)
        percentile = payload.get("percentile", 0) or 0

        parts = []
        if qr_status == "VERIFIED":
            parts.append(
                "The scanned QR carried a valid BIS HMAC-SHA256 signature and matched the storefront nameplate, "
                "so the payload itself is authentic."
            )
        elif qr_status == "PHISHING_MALICIOUS":
            parts.append(
                "The scanned code is not a genuine UPI instruction - it redirects payment to a spoofed or off-network "
                "beneficiary, so you must not pay."
            )
        elif qr_status == "WARNING":
            parts.append(
                "The QR payload parses as a UPI instruction but is unsigned, so tampering after printing cannot be ruled out."
            )
        else:
            parts.append(
                "You entered the UPI ID directly, so no cryptographic QR evidence was available for this evaluation."
            )

        triggered = payload.get("triggered_rules") or ""
        if isinstance(triggered, (list, tuple)):
            rules = [str(r).strip() for r in triggered if str(r).strip()]
        else:
            rules = [r.strip() for r in str(triggered).split(",") if r.strip()]
        if rules:
            parts.append(
                f"{len(rules)} behavioural rule(s) fired ({', '.join(rules)}), which is what drove the risk to "
                f"{score}/100 ({level})."
            )
        else:
            parts.append(
                "No behavioural or network rule fired - velocity, drain ratio and account age all sit inside the "
                "normal population ranges."
            )

        parts.append(
            f"The Random Forest assigns {ml_probability * 100:.1f}% fraud probability, so the combined verdict is "
            f"{score}/100 ({level}), above {percentile}% of the payments evaluated so far."
        )
        return " ".join(parts)

    # ---------------------------------------------------------------- GenAI path
    async def generate_ai_explanation(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Explainability narrative. The deterministic local narrative is always
        available; a GenAI round-trip is only attempted when OPENROUTER_API_KEY
        is configured in the environment, so the platform works fully offline.
        """
        if not OPENROUTER_API_KEY:
            return {"text": self.local_narrative(payload), "source": "local_deterministic", "model": None}

        prompt = (
            "You are the explainability copilot of Diamond-Protect, an Indian UPI fraud-defense platform aligned to "
            "BIS Digital Payment Security guidance. In at most 60 words, explain to an ordinary Indian citizen or bank "
            "investigator why this transaction received the score it did, and give the single most important action to "
            "take before entering the UPI PIN.\n\n"
            f"- Final risk score: {payload.get('risk_score')}/100 ({payload.get('risk_level')})\n"
            f"- Amount: Rs. {payload.get('amount')}\n"
            f"- Payee VPA: {payload.get('receiver_vpa')}\n"
            f"- Claimed name: {payload.get('qr_claimed_name') or 'n/a'}\n"
            f"- QR verdict: {payload.get('qr_status')}\n"
            f"- Triggered rules: {payload.get('triggered_rules') or 'none'}\n"
            f"- Model fraud probability: {payload.get('ml_probability')}\n"
            f"- Payee graph role: {payload.get('graph_role')}\n"
            f"- Population percentile: {payload.get('percentile')}\n"
            "Be concrete, calm and non-technical. Output plain sentences only, no headings or bullet symbols."
        )

        last_error = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(AI_TIMEOUT_SECONDS, connect=3.0)) as client:
            for model in AI_MODELS:
                try:
                    res = await client.post(
                        OPENROUTER_URL,
                        headers={
                            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://diamond-protect.local",
                            "X-Title": "Diamond-Protect UPI Security",
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": "You are Diamond-Protect's AI Risk Advisor for Indian UPI transactions. Give concise, protective, plain-language advice."},
                                {"role": "user", "content": prompt},
                            ],
                            "temperature": 0.2,
                            "max_tokens": 110,
                        },
                    )
                    if res.status_code == 200:
                        data = res.json()
                        text = data["choices"][0]["message"]["content"].strip()
                        return {"text": text, "source": "openrouter", "model": model}
                    last_error = f"{model}: HTTP {res.status_code}"
                except Exception as exc:
                    last_error = str(exc)
                await asyncio.sleep(0.1)

        return {"text": None, "source": "failed", "error": last_error or "unknown error"}
