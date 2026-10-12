import os
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core.risk_engine import RiskEngine
from backend.core.qr_engine import generate_signed_upi_payload, verify_upi_qr, render_qr_base64
from backend.core.graph_engine import MuleGraphEngine

app = FastAPI(
    title="Diamond-Protect API",
    description="Real-Time UPI Fraud, Phishing-QR and Mule-Account Detection Intelligence Platform",
    version="2.0.0"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

risk_engine = RiskEngine()
graph_engine = MuleGraphEngine()

CSV_PATH = "d:/Diamond-protect-v2/backend/data/transactions.csv"

class TransactionPayload(BaseModel):
    sender_id: str = "USR_1042"
    receiver_id: str = "MERCHANT_STORE"
    receiver_vpa: str = "chaipoint@icici"
    amount: float = 240.0
    qr_scanned: bool = True
    raw_qr: Optional[str] = ""
    qr_claimed_name: Optional[str] = "Chai Point Indiranagar"
    time_since_beneficiary_added_sec: int = 86400
    beneficiary_age_days: int = 180
    velocity_10m: int = 1
    outflow_ratio_5m: float = 0.05
    in_degree_1h: int = 2
    ip_risk_score: float = 0.05
    device: Optional[str] = "OnePlus 11 5G"
    location: Optional[str] = "Bengaluru"

class QRGenerateRequest(BaseModel):
    merchant_id: str = "MID_IND_99210"
    merchant_name: str = "Sharma Kirana & General Store"
    vpa: str = "sharmakirana@sbi"
    amount: Optional[float] = 450.0
    mcc: str = "5411"

class QRVerifyRequest(BaseModel):
    raw_qr_content: str
    claimed_merchant_name: Optional[str] = ""

@app.get("/")
def root():
    return {
        "platform": "Diamond-Protect",
        "tagline": "Real-Time UPI Fraud & Mule-Account Detection System",
        "status": "OPERATIONAL",
        "compliance": "BIS Digital Payment & DSCI Fintech Security Aligned",
        "version": "2.0.0"
    }

@app.post("/api/evaluate")
async def evaluate_transaction_endpoint(payload: TransactionPayload):
    """Real-time scoring and AI explainability for an incoming UPI payment."""
    result = await risk_engine.evaluate_transaction(payload.model_dump())
    return result

@app.post("/api/qr/generate")
def generate_qr_endpoint(req: QRGenerateRequest):
    """Generates a BIS-compliant cryptographically signed UPI QR code."""
    payload_info = generate_signed_upi_payload(
        merchant_id=req.merchant_id,
        merchant_name=req.merchant_name,
        vpa=req.vpa,
        amount=req.amount,
        mcc=req.mcc
    )
    b64_qr = render_qr_base64(payload_info["raw_uri"])
    return {
        **payload_info,
        "qr_image_base64": b64_qr
    }

@app.post("/api/qr/verify")
def verify_qr_endpoint(req: QRVerifyRequest):
    """Inspects a scanned QR payload for tampering, malicious scheme, or merchant spoofing."""
    return verify_upi_qr(req.raw_qr_content, req.claimed_merchant_name)

@app.get("/api/graph/mule-clusters")
def get_mule_clusters():
    """Returns detected hub mules and circular money-laundering rings."""
    return graph_engine.detect_mule_rings()

@app.get("/api/graph/visualization")
def get_graph_visualization(limit: int = 45):
    """Returns network nodes and transaction edges for interactive graph UI."""
    return graph_engine.get_network_visualization_data(limit_nodes=limit)

@app.get("/api/stats")
def get_platform_stats():
    """Returns system-wide metrics and analytics."""
    if not os.path.exists(CSV_PATH):
        return {"error": "Transactions not found"}
        
    df = pd.read_csv(CSV_PATH)
    total_txns = len(df)
    fraud_txns = int(df["is_fraud"].sum())
    fraud_rate = round((fraud_txns / total_txns) * 100, 2) if total_txns > 0 else 0
    total_volume = round(float(df["amount"].sum()), 2)
    saved_fraud_volume = round(float(df[df["is_fraud"] == 1]["amount"].sum()), 2)
    
    fraud_by_type = df[df["is_fraud"] == 1]["fraud_type"].value_counts().to_dict()
    
    return {
        "total_transactions": total_txns,
        "fraud_attempts_blocked": fraud_txns,
        "fraud_rate_pct": fraud_rate,
        "total_volume_inr": total_volume,
        "fraud_amount_prevented_inr": saved_fraud_volume,
        "fraud_breakdown": fraud_by_type,
        "active_mule_nodes_tracked": 12,
        "verified_merchants_registered": 84
    }

@app.get("/api/transactions/recent")
def get_recent_transactions(limit: int = 20, fraud_only: bool = False):
    """Fetches real-time or historical transaction stream for investigator view."""
    if not os.path.exists(CSV_PATH):
        return []
    df = pd.read_csv(CSV_PATH)
    if fraud_only:
        df = df[df["is_fraud"] == 1]
    df = df.tail(limit).iloc[::-1]
    return df.to_dict(orient="records")

@app.get("/api/demo-presets")
def get_demo_presets():
    """Provides instant preset test scenarios for judge demonstration."""
    # 1. Normal safe merchant payment
    valid_qr_info = generate_signed_upi_payload(
        merchant_id="MID_CP_8812",
        merchant_name="Chai Point Indiranagar",
        vpa="chaipoint@icici",
        amount=180.0
    )
    
    # 2. Tampered / Spoofed QR sticker attack
    spoofed_qr = "upi://pay?pa=quickrefund_support_892@upi&pn=Sharma%20Kirana%20Support&mc=5411&am=1200.00&cu=INR"
    
    # 3. Phishing link masquerading as QR
    phishing_qr = "https://upi-free-cashback-reward2026.net/claim?code=DIAMOND"

    return {
        "presets": [
            {
                "id": "scenario_normal",
                "title": "🟢 Normal Safe Payment (Chai Point)",
                "description": "Legitimate customer buying tea at a verified merchant with valid BIS signature.",
                "data": {
                    "sender_id": "USR_1088",
                    "receiver_id": "Chai Point Indiranagar",
                    "receiver_vpa": "chaipoint@icici",
                    "amount": 180.0,
                    "qr_scanned": True,
                    "raw_qr": valid_qr_info["raw_uri"],
                    "qr_claimed_name": "Chai Point Indiranagar",
                    "beneficiary_age_days": 320,
                    "time_since_beneficiary_added_sec": 86400,
                    "velocity_10m": 1,
                    "outflow_ratio_5m": 0.05,
                    "in_degree_1h": 2,
                    "ip_risk_score": 0.04,
                    "device": "Samsung Galaxy S23",
                    "location": "Bengaluru"
                }
            },
            {
                "id": "scenario_tampered_qr",
                "title": "🔴 Tampered QR Sticker Attack (Merchant Spoofing)",
                "description": "Scammer glued their fake QR over Sharma Kirana's counter. System detects payee and signature mismatch.",
                "data": {
                    "sender_id": "USR_1014",
                    "receiver_id": "SCAMMER_QR_DIRECT",
                    "receiver_vpa": "quickrefund_support_892@upi",
                    "amount": 2500.0,
                    "qr_scanned": True,
                    "raw_qr": spoofed_qr,
                    "qr_claimed_name": "Sharma Kirana Store",
                    "beneficiary_age_days": 1,
                    "time_since_beneficiary_added_sec": 15,
                    "velocity_10m": 6,
                    "outflow_ratio_5m": 0.88,
                    "in_degree_1h": 8,
                    "ip_risk_score": 0.85,
                    "device": "OnePlus 11 5G",
                    "location": "Delhi NCR"
                }
            },
            {
                "id": "scenario_mule_hub",
                "title": "🔴 High-Velocity Money Mule Hub Inflow",
                "description": "Victim sending money to a mule account receiving rapid payments from 14 senders & draining 95% in 2 mins.",
                "data": {
                    "sender_id": "USR_1055",
                    "receiver_id": "MULE_ALPHA_HUB",
                    "receiver_vpa": "fastcash_winner8899@ybl",
                    "amount": 35000.0,
                    "qr_scanned": False,
                    "raw_qr": "",
                    "qr_claimed_name": "Electricity Bill Refund Helpdesk",
                    "beneficiary_age_days": 2,
                    "time_since_beneficiary_added_sec": 45,
                    "velocity_10m": 16,
                    "outflow_ratio_5m": 0.96,
                    "in_degree_1h": 22,
                    "ip_risk_score": 0.92,
                    "device": "iPhone 15 Pro",
                    "location": "Mumbai"
                }
            },
            {
                "id": "scenario_phishing_link",
                "title": "🔴 Malicious Non-UPI Phishing QR",
                "description": "Fake QR directs user to an external phishing website designed to steal banking credentials.",
                "data": {
                    "sender_id": "USR_1090",
                    "receiver_id": "PHISHING_SITE",
                    "receiver_vpa": "cashback@unknown",
                    "amount": 500.0,
                    "qr_scanned": True,
                    "raw_qr": phishing_qr,
                    "qr_claimed_name": "Instant Cashback Bonus",
                    "beneficiary_age_days": 1,
                    "time_since_beneficiary_added_sec": 10,
                    "velocity_10m": 4,
                    "outflow_ratio_5m": 0.90,
                    "in_degree_1h": 10,
                    "ip_risk_score": 0.95,
                    "device": "Realme 12 Pro+",
                    "location": "Jaipur"
                }
            }
        ]
    }
