import os
import json
import uuid
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.core.risk_engine import RiskEngine
from backend.core.qr_engine import generate_signed_upi_payload, verify_upi_qr, render_qr_base64
from backend.core.graph_engine import MuleGraphEngine
from backend.core.auth_engine import create_user, authenticate_user, create_access_token, verify_token
from backend.core.db_engine import (
    insert_transaction, bulk_insert_from_csv, 
    get_all_transactions_df, get_recent_transactions_list
)

app = FastAPI(
    title="Diamond-Protect API",
    description="Real-Time UPI Fraud & Mule-Account Detection Platform with Dedicated Auth & Transaction DBs",
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

risk_engine = RiskEngine()
graph_engine = MuleGraphEngine()

# Auth Models
class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

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

# Authentication Dependency Helper
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ")[1].strip()
    return verify_token(token)

@app.get("/")
def root():
    return {
        "platform": "Diamond-Protect",
        "tagline": "Real-Time UPI Fraud & Mule-Account Detection System",
        "status": "OPERATIONAL",
        "architecture": "Separated Auth Database (auth.db) & Transactions Database (transactions.db)",
        "version": "3.0.0"
    }

# --- AUTHENTICATION ENDPOINTS (Isolated in auth.db) ---

@app.post("/api/auth/register")
def register_endpoint(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    try:
        user = create_user(req.email, req.full_name, req.password)
        token = create_access_token(user)
        return {
            "success": True,
            "message": "Account created successfully.",
            "token": token,
            "user": user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Registration failed: " + str(e))

@app.post("/api/auth/login")
def login_endpoint(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(user)
    return {
        "success": True,
        "message": "Authenticated successfully.",
        "token": token,
        "user": user
    }

@app.get("/api/auth/me")
def get_me_endpoint(user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated or token expired.")
    return {"user": user}

# --- CORE EVALUATION & DATA ENDPOINTS (Isolated in transactions.db) ---

@app.post("/api/evaluate")
async def evaluate_transaction_endpoint(payload: TransactionPayload, user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """Real-time scoring and AI explainability for an incoming UPI payment."""
    res = await risk_engine.evaluate_transaction(payload.model_dump())
    
    # Persist evaluated transaction into isolated transactions database
    txn_id = f"TXN_{uuid.uuid4().hex[:10].upper()}"
    insert_transaction({
        **payload.model_dump(),
        "txn_id": txn_id,
        "is_fraud": 1 if res["risk_score"] >= 70 else 0,
        "fraud_type": "HIGH_RISK_INTERCEPT" if res["risk_score"] >= 70 else "NONE",
    }, uploaded_by=user.get("email", "live_evaluator") if user else "guest_user")
    
    # Reload graph dynamically
    graph_engine.reload_graph()
    
    return {
        **res,
        "txn_id": txn_id
    }

@app.post("/api/upload-csv")
async def upload_csv_endpoint(file: UploadFile = File(...), user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """Upload user-provided UPI transaction dataset to analyze in real time."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid .csv file.")
    
    temp_path = f"d:/Diamond-protect-v2/backend/data/temp_{uuid.uuid4().hex}.csv"
    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
            
        uploader = user.get("email", "user_upload") if user else "user_upload"
        imported_count = bulk_insert_from_csv(temp_path, uploaded_by=uploader)
        
        # Trigger reload of the graph engine
        graph_engine.reload_graph()
        
        return {
            "success": True,
            "imported_count": imported_count,
            "filename": file.filename,
            "message": f"Successfully ingested and indexed {imported_count} transactions into isolated database."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/qr/generate")
def generate_qr_endpoint(req: QRGenerateRequest):
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
    return verify_upi_qr(req.raw_qr_content, req.claimed_merchant_name)

@app.get("/api/graph/mule-clusters")
def get_mule_clusters():
    return graph_engine.detect_mule_rings()

@app.get("/api/graph/visualization")
def get_graph_visualization(limit: int = 45):
    return graph_engine.get_network_visualization_data(limit_nodes=limit)

@app.get("/api/stats")
def get_platform_stats():
    df = get_all_transactions_df()
    total_txns = len(df)
    fraud_txns = int(df["is_fraud"].sum()) if total_txns > 0 else 0
    fraud_rate = round((fraud_txns / total_txns) * 100, 2) if total_txns > 0 else 0
    total_volume = round(float(df["amount"].sum()), 2) if total_txns > 0 else 0
    saved_fraud_volume = round(float(df[df["is_fraud"] == 1]["amount"].sum()), 2) if total_txns > 0 else 0
    
    fraud_by_type = {}
    if total_txns > 0:
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
def get_recent_transactions(limit: int = 25, fraud_only: bool = False):
    return get_recent_transactions_list(limit=limit, fraud_only=fraud_only)

@app.get("/api/demo-presets")
def get_demo_presets():
    valid_qr_info = generate_signed_upi_payload(
        merchant_id="MID_CP_8812",
        merchant_name="Chai Point Indiranagar",
        vpa="chaipoint@icici",
        amount=180.0
    )
    spoofed_qr = "upi://pay?pa=quickrefund_support_892@upi&pn=Sharma%20Kirana%20Support&mc=5411&am=1200.00&cu=INR"
    phishing_qr = "https://upi-free-cashback-reward2026.net/claim?code=DIAMOND"

    return {
        "presets": [
            {
                "id": "scenario_normal",
                "title": "🟢 Safe Merchant Payment (Chai Point)",
                "description": "Legitimate tea payment at verified merchant with authentic BIS digital signature.",
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
                "title": "🔴 Tampered QR Sticker Attack (Counterfeit)",
                "description": "Scammer placed unauthorized sticker over Sharma Kirana counter to steal payments.",
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
                "title": "🔴 Money Mule Inflow (High Drain Velocity)",
                "description": "Account receives multiple fast transfers and immediately drains 96% in 2 minutes.",
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
                "title": "🔴 Malicious Non-UPI Phishing Link",
                "description": "Scam QR redirects user away from UPI to a malicious web page stealing bank credentials.",
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
