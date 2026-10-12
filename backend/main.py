import os
import uuid
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.core.analytics import get_analytics
from backend.core.auth_engine import authenticate_user, create_access_token, create_user, verify_token
from backend.core.db_engine import bulk_insert_from_csv, get_recent_transactions_list, insert_transaction
from backend.core.graph_engine import MuleGraphEngine
from backend.core.qr_engine import generate_signed_upi_payload, render_qr_base64, verify_upi_qr
from backend.core.risk_engine import RiskEngine
from backend.core.signals import derive_signals

app = FastAPI(
    title="Diamond-Protect API",
    description=(
        "Real-Time UPI Fraud & Mule-Account Detection Platform. "
        "Username/password authentication is mandatory for every analytical endpoint."
    ),
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

risk_engine = RiskEngine()
graph_engine = MuleGraphEngine(preload=False)
analytics = get_analytics(risk_engine)


@app.on_event("startup")
def warm_up():
    graph_engine.reload_graph()
    analytics.snapshot(force=True)


# ------------------------------------------------------------------ auth models
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TransactionPayload(BaseModel):
    receiver_vpa: str = ""
    account_number: Optional[str] = None
    sender_id: Optional[str] = None
    receiver_id: Optional[str] = None
    amount: float = Field(ge=0)
    qr_scanned: bool = False
    raw_qr: Optional[str] = ""
    qr_claimed_name: Optional[str] = None


class AIExplainRequest(BaseModel):
    txn_id: Optional[str] = None
    risk_score: int = 0
    risk_level: str = "LOW_RISK"
    amount: float = 0
    receiver_vpa: str = ""
    qr_claimed_name: str = ""
    qr_status: str = "SKIPPED"
    triggered_rules: str = ""
    ml_probability: float = 0
    graph_role: str = "UNOBSERVED"
    percentile: float = 0


class QRGenerateRequest(BaseModel):
    merchant_id: str = Field(min_length=1)
    merchant_name: str = Field(min_length=1)
    vpa: str = Field(min_length=3)
    amount: Optional[float] = Field(default=None, ge=0)
    mcc: str = "0000"


class QRVerifyRequest(BaseModel):
    raw_qr_content: str
    claimed_merchant_name: Optional[str] = None


# --------------------------------------------------------------- auth plumbing
def _bearer_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization.split("Bearer ", 1)[1].strip()


def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Every analytical endpoint is behind this dependency."""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required.")
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in again.")
    return user


def current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    return verify_token(token) if token else None


@app.get("/")
def root():
    return {
        "platform": "Diamond-Protect",
        "tagline": "Real-Time UPI Fraud & Mule-Account Detection System",
        "status": "OPERATIONAL",
        "auth": "username + password (mandatory for all analytical endpoints)",
        "version": "4.0.0",
    }


# ----------------------------------------------------------------- auth routes
@app.post("/api/auth/register")
def register_endpoint(req: RegisterRequest):
    username = req.username.strip()
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    try:
        user = create_user(username, req.password)
        token = create_access_token(user)
        return {"success": True, "message": "Account created.", "token": token, "user": user}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Registration failed: {exc}")


@app.post("/api/auth/login")
def login_endpoint(req: LoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    token = create_access_token(user)
    return {"success": True, "message": "Authenticated.", "token": token, "user": user}


@app.get("/api/auth/me")
def get_me_endpoint(user: Dict[str, Any] = Depends(require_user)):
    return {"user": user}


# ------------------------------------------------------------ payment analysis
@app.post("/api/evaluate")
async def evaluate_transaction_endpoint(
    payload: TransactionPayload,
    user: Dict[str, Any] = Depends(require_user),
):
    """
    Synchronous, network-free risk evaluation:
    QR verification + heuristic rules + Random Forest + graph topology + ensemble
    fusion all resolve in milliseconds. The GenAI narrative is requested
    separately via /api/ai-explain so it can never slow the verdict down.
    """
    receiver_vpa = (payload.receiver_vpa or "").strip()
    if not receiver_vpa and not (payload.raw_qr or "").strip():
        raise HTTPException(status_code=400, detail="A payee UPI ID or a scanned QR payload is required.")

    signals = derive_signals(
        receiver_vpa=receiver_vpa,
        receiver_id=payload.receiver_id or payload.qr_claimed_name or receiver_vpa,
        amount=payload.amount,
        graph_engine=graph_engine,
    )

    txn = payload.model_dump()
    txn["receiver_vpa"] = receiver_vpa
    txn["receiver_id"] = signals["receiver_id"]
    txn["sender_id"] = payload.sender_id or payload.account_number or "PAYER_SELF"
    txn["qr_scanned"] = bool(payload.qr_scanned or payload.raw_qr)
    txn["telemetry"] = signals["telemetry"]

    result = risk_engine.evaluate(txn, signals, analytics=analytics, graph_engine=graph_engine)

    txn_id = f"TXN_{uuid.uuid4().hex[:10].upper()}"
    telemetry = signals["telemetry"]
    insert_transaction(
        {
            "txn_id": txn_id,
            "sender_id": txn["sender_id"],
            "receiver_id": txn["receiver_id"],
            "receiver_vpa": receiver_vpa,
            "amount": payload.amount,
            "qr_scanned": int(txn["qr_scanned"]),
            "qr_hash_valid": int(bool(result["qr_verification"] and result["qr_verification"].get("is_valid"))),
            "qr_claimed_name": payload.qr_claimed_name or "",
            "beneficiary_age_days": telemetry["beneficiary_age_days"],
            "time_since_beneficiary_added_sec": telemetry["time_since_beneficiary_added_sec"],
            "velocity_10m": telemetry["velocity_10m"],
            "outflow_ratio_5m": telemetry["outflow_ratio_5m"],
            "in_degree_1h": telemetry["in_degree_1h"],
            "ip_risk_score": telemetry["ip_risk_score"],
            "is_fraud": 1 if result["risk_score"] >= 70 else 0,
            "fraud_type": "HIGH_RISK_INTERCEPT" if result["risk_score"] >= 70 else "NONE",
        },
        uploaded_by=user.get("username", "analyst"),
        source="live_evaluation",
    )
    graph_engine.schedule_reload()

    return {**result, "txn_id": txn_id, "evaluated_by": user.get("username")}


@app.post("/api/ai-explain")
async def ai_explain_endpoint(req: AIExplainRequest, user: Dict[str, Any] = Depends(require_user)):
    """Generative explainability - intentionally decoupled from the scoring path."""
    result = await risk_engine.generate_ai_explanation(req.model_dump())
    return {
        "success": bool(result.get("text")),
        "explanation": result.get("text"),
        "source": result.get("source", "failed"),
        "model": result.get("model"),
        "error": result.get("error"),
    }


# ----------------------------------------------------------------- data routes
@app.post("/api/upload-csv")
async def upload_csv_endpoint(file: UploadFile = File(...), user: Dict[str, Any] = Depends(require_user)):
    if not (file.filename or "").endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid .csv file.")

    temp_path = f"d:/Diamond-protect-v2/backend/data/temp_{uuid.uuid4().hex}.csv"
    try:
        content = await file.read()
        with open(temp_path, "wb") as handle:
            handle.write(content)

        imported_count = bulk_insert_from_csv(temp_path, uploaded_by=user.get("username", "analyst"))
        graph_engine.reload_graph()
        analytics.snapshot(force=True)

        return {
            "success": True,
            "imported_count": imported_count,
            "filename": file.filename,
            "message": f"Ingested {imported_count} transactions; graph topology and statistics recomputed.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {exc}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.get("/api/transactions/recent")
def get_recent_transactions(limit: int = 25, fraud_only: bool = False, user: Dict[str, Any] = Depends(require_user)):
    return get_recent_transactions_list(limit=min(limit, 200), fraud_only=fraud_only)


# -------------------------------------------------------------------- qr routes
@app.post("/api/qr/generate")
def generate_qr_endpoint(req: QRGenerateRequest, user: Dict[str, Any] = Depends(require_user)):
    payload_info = generate_signed_upi_payload(
        merchant_id=req.merchant_id,
        merchant_name=req.merchant_name,
        vpa=req.vpa,
        amount=req.amount,
        mcc=req.mcc,
    )
    return {**payload_info, "qr_image_base64": render_qr_base64(payload_info["raw_uri"])}


@app.post("/api/qr/verify")
def verify_qr_endpoint(req: QRVerifyRequest, user: Dict[str, Any] = Depends(require_user)):
    return verify_upi_qr(req.raw_qr_content, req.claimed_merchant_name)


# ----------------------------------------------------------------- graph routes
@app.get("/api/graph/mule-clusters")
def get_mule_clusters(user: Dict[str, Any] = Depends(require_user)):
    data = graph_engine.detect_mule_rings()
    return {**data, "build_ms": graph_engine.last_build_ms, "stale": graph_engine.is_stale}


@app.get("/api/graph/visualization")
def get_graph_visualization(limit: int = 40, user: Dict[str, Any] = Depends(require_user)):
    payload = graph_engine.get_network_visualization_data(limit_nodes=limit)
    return {
        **payload,
        "build_ms": graph_engine.last_build_ms,
        "stale": graph_engine.is_stale,
        "degree_distribution": graph_engine.get_degree_distribution(),
    }


# ---------------------------------------------------------------- stats routes
@app.get("/api/stats")
def get_platform_stats(user: Dict[str, Any] = Depends(require_user)):
    snapshot = analytics.snapshot()
    breakdown = {item["key"]: item["count"] for item in snapshot.get("fraud_breakdown", [])}
    clusters = graph_engine.detect_mule_rings()

    return {
        "total_transactions": snapshot.get("sample_size", 0),
        "fraud_attempts_blocked": snapshot.get("fraud_count", 0),
        "fraud_rate_pct": snapshot.get("fraud_base_rate_pct", 0),
        "total_volume_inr": snapshot.get("total_volume", 0),
        "fraud_amount_prevented_inr": snapshot.get("fraud_volume", 0),
        "fraud_breakdown": breakdown,
        "active_mule_nodes_tracked": len(clusters.get("hub_mules", [])),
        "verified_merchants_registered": snapshot.get("distinct_receivers", 0),
        "graph": {
            "nodes": clusters.get("total_nodes", 0),
            "edges": clusters.get("total_edges", 0),
            "build_ms": graph_engine.last_build_ms,
            "cycle_search": clusters.get("cycle_search", {}),
        },
        "model": snapshot.get("model_metrics", {}),
        "analytics": snapshot,
    }
