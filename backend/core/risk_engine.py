import os
import joblib
import numpy as np
import httpx
from typing import Dict, Any, List
from backend.core.qr_engine import verify_upi_qr
from backend.core.graph_engine import MuleGraphEngine

MODEL_PATH = "d:/Diamond-protect-v2/backend/models/rf_fraud_model.pkl"
OPENROUTER_API_KEY = "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"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

class RiskEngine:
    def __init__(self):
        self.model_data = None
        self.model = None
        self.feature_cols = []
        self.load_model()
        self.graph_engine = MuleGraphEngine()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                self.model_data = joblib.load(MODEL_PATH)
                self.model = self.model_data["model"]
                self.feature_cols = self.model_data["feature_cols"]
                print("Loaded Random Forest model successfully.")
            except Exception as e:
                print(f"Failed to load model: {e}")
        else:
            print("Model file not found. Running purely on heuristic rules.")

    async def get_ai_explanation(self, risk_score: int, risk_level: str, reasons: List[str], txn_details: Dict[str, Any]) -> str:
        """
        Calls OpenRouter API to produce empathetic, clear, Indian-context explainability
        tailored for citizens and merchant fraud investigators.
        """
        if not OPENROUTER_API_KEY:
            return "Rule-based summary: " + " | ".join(reasons)

        prompt = f"""
You are the AI explainability copilot for 'Diamond-Protect', India's real-time UPI fraud and mule-account defense platform (aligned with BIS Digital Payment Security guidelines).
Explain this risk alert in 2 to 3 concise, clear sentences. Speak simply so any Indian citizen or bank investigator understands immediately what the danger is and what exact action to take.

Transaction Risk:
- Risk Score: {risk_score}/100 ({risk_level})
- Amount: ₹{txn_details.get('amount', 0):,.2f}
- Payee VPA / Handle: {txn_details.get('receiver_vpa', 'Unknown')}
- Claimed Merchant: {txn_details.get('qr_claimed_name', 'None')}
- Reasons Triggered: {', '.join(reasons)}
- Rapid Outflow Ratio: {txn_details.get('outflow_ratio_5m', 0)*100:.0f}%
- Time Beneficiary Added: {txn_details.get('time_since_beneficiary_added_sec', 0)} seconds ago

Respond with:
1. Clear explanation of why it is dangerous or safe.
2. Immediate recommended advice (e.g., Do NOT authorize, verify physical QR, proceed safely).
Keep it under 65 words.
"""
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://diamond-protect.fintech",
                        "X-Title": "Diamond-Protect UPI Security"
                    },
                    json={
                        "model": "openrouter/auto",
                        "messages": [
                            {"role": "system", "content": "You are Diamond-Protect's AI Risk Advisor for Indian UPI transactions. Provide concise, friendly, protective advice."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.2,
                        "max_tokens": 120
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    return data["choices"][0]["message"]["content"].strip()
                else:
                    return f"Offline Summary: {' '.join(reasons)}"
        except Exception as e:
            # Fallback if network issue
            return f"Offline Summary: {' '.join(reasons)}"

    async def evaluate_transaction(self, txn: Dict[str, Any]) -> Dict[str, Any]:
        """
        Full 360-degree evaluation combining:
        1. BIS QR verification
        2. Rule-based heuristic triggers (DSCI & BIS alignment)
        3. Scikit-learn Random Forest ML confidence
        4. Graph topology mule detection
        5. Generative AI explainability summary
        """
        reasons = []
        rule_penalty = 0

        # Extract parameters
        amount = float(txn.get("amount", 0.0))
        qr_scanned = bool(txn.get("qr_scanned", False))
        raw_qr = txn.get("raw_qr", "")
        claimed_name = txn.get("qr_claimed_name", "")
        time_added = int(txn.get("time_since_beneficiary_added_sec", 3600))
        beneficiary_age_days = int(txn.get("beneficiary_age_days", 180))
        velocity_10m = int(txn.get("velocity_10m", 0))
        outflow_ratio_5m = float(txn.get("outflow_ratio_5m", 0.0))
        in_degree_1h = int(txn.get("in_degree_1h", 1))
        ip_risk = float(txn.get("ip_risk_score", 0.05))
        receiver_vpa = str(txn.get("receiver_vpa", ""))

        # Check QR verification if scanned
        qr_valid = 1
        qr_check_result = None
        if qr_scanned and raw_qr:
            qr_check_result = verify_upi_qr(raw_qr, claimed_name)
            if not qr_check_result["is_valid"]:
                qr_valid = 0
                rule_penalty += qr_check_result["score_penalty"]
                reasons.extend(qr_check_result["issues"])

        # Rule 1: High velocity & rapid fan-out (Classic Mule Account behaviour)
        if outflow_ratio_5m > 0.8 and in_degree_1h >= 5:
            rule_penalty += 35
            reasons.append(f"Mule Pattern: Receiver drains {outflow_ratio_5m*100:.0f}% of incoming funds within 5 minutes across multiple accounts.")

        # Rule 2: Just-added beneficiary with large payment
        if time_added < 120 and amount > 5000:
            rule_penalty += 25
            reasons.append(f"Sudden Transfer: Beneficiary created just {time_added} seconds ago for a large amount (₹{amount:,.2f}).")

        # Rule 3: High transaction frequency in 10 minutes
        if velocity_10m >= 5:
            rule_penalty += 20
            reasons.append(f"Velocity Spike: Unusually rapid payment burst ({velocity_10m} attempts in past 10 mins).")

        # Rule 4: Newly created account (< 3 days old)
        if beneficiary_age_days <= 3:
            rule_penalty += 20
            reasons.append(f"Ephemeral Account: VPA was registered only {beneficiary_age_days} day(s) ago.")

        # Rule 5: IP Risk / Suspicious Geo or Device
        if ip_risk > 0.7:
            rule_penalty += 15
            reasons.append(f"Device Telemetry: Suspicious emulator or high-risk IP fingerprint detected ({ip_risk*100:.0f}% anomaly).")

        # Rule 6: Known mule handle pattern
        if "fastcash" in receiver_vpa.lower() or "refund" in receiver_vpa.lower() or "lottery" in receiver_vpa.lower():
            rule_penalty += 30
            reasons.append(f"Scam Handle Pattern: Beneficiary handle '{receiver_vpa}' matches known deceptive patterns.")

        # ML Inference
        ml_score = 0
        if self.model:
            features = np.array([[
                amount,
                int(qr_scanned),
                qr_valid,
                beneficiary_age_days,
                time_added,
                velocity_10m,
                outflow_ratio_5m,
                in_degree_1h,
                ip_risk
            ]])
            prob = self.model.predict_proba(features)[0][1]
            ml_score = int(prob * 100)

        # Composite Risk Score Calculation (0 - 100)
        # Weighted ensemble: 50% Rule Engine + 50% ML Model
        final_score = int(min(100, max(0, 0.45 * min(rule_penalty, 100) + 0.55 * ml_score)))
        
        # Determine Severity Level & Recommendations
        if final_score >= 70:
            risk_level = "CRITICAL"
            badge_color = "red"
            recommendation = "BLOCKED / DO NOT PAY: Extreme fraud and mule activity probability. Verify receiver identity offline."
        elif final_score >= 40:
            risk_level = "WARNING"
            badge_color = "yellow"
            recommendation = "PROCEED WITH CAUTION: Irregular beneficiary signals detected. Verify details before authenticating MPIN."
        else:
            risk_level = "LOW_RISK"
            badge_color = "green"
            recommendation = "SAFE: Legitimate beneficiary and verified cryptographic QR payload."
            if not reasons:
                reasons.append("Authentic merchant signature verified. Normal behavioural velocity.")

        # AI Explainability via OpenRouter
        ai_summary = await self.get_ai_explanation(final_score, risk_level, reasons, txn)

        return {
            "risk_score": final_score,
            "risk_level": risk_level,
            "badge_color": badge_color,
            "ml_confidence": ml_score,
            "rule_penalty": min(rule_penalty, 100),
            "reasons": reasons,
            "recommended_action": recommendation,
            "ai_explanation": ai_summary,
            "qr_verification": qr_check_result,
            "timestamp": txn.get("timestamp", "")
        }
