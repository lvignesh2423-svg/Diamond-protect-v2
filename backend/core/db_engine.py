import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd

TRANSACTIONS_DB_PATH = "d:/Diamond-protect-v2/backend/data/transactions.db"

CSV_COLUMNS = [
    "txn_id", "timestamp", "sender_id", "receiver_id", "receiver_vpa", "amount",
    "qr_scanned", "qr_hash_valid", "qr_claimed_name", "beneficiary_age_days",
    "time_since_beneficiary_added_sec", "velocity_10m", "outflow_ratio_5m",
    "in_degree_1h", "ip_risk_score", "device", "location", "is_fraud", "fraud_type"
]


def get_tx_connection():
    os.makedirs(os.path.dirname(TRANSACTIONS_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(TRANSACTIONS_DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    return conn


def init_transactions_db():
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            txn_id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            receiver_vpa TEXT NOT NULL,
            amount REAL NOT NULL,
            qr_scanned INTEGER DEFAULT 0,
            qr_hash_valid INTEGER DEFAULT 1,
            qr_claimed_name TEXT,
            beneficiary_age_days INTEGER DEFAULT 180,
            time_since_beneficiary_added_sec INTEGER DEFAULT 86400,
            velocity_10m INTEGER DEFAULT 1,
            outflow_ratio_5m REAL DEFAULT 0.0,
            in_degree_1h INTEGER DEFAULT 1,
            ip_risk_score REAL DEFAULT 0.05,
            device TEXT,
            location TEXT,
            is_fraud INTEGER DEFAULT 0,
            fraud_type TEXT DEFAULT 'NONE',
            uploaded_by TEXT DEFAULT 'system',
            source TEXT DEFAULT 'dataset'
        )
    """)

    existing = {row[1] for row in cursor.execute("PRAGMA table_info(transactions)")}
    if "source" not in existing:
        cursor.execute("ALTER TABLE transactions ADD COLUMN source TEXT DEFAULT 'dataset'")

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_txn_vpa ON transactions(receiver_vpa)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_txn_ts ON transactions(timestamp)")

    # ---------------------------------------------------------- analyst history
    # Every risk check an analyst runs is archived here, keyed by username, so
    # the full staged analysis can be replayed later without re-running the model.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS evaluation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            txn_id TEXT NOT NULL,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL,
            receiver_vpa TEXT,
            amount REAL DEFAULT 0,
            qr_claimed_name TEXT,
            qr_scanned INTEGER DEFAULT 0,
            risk_score INTEGER DEFAULT 0,
            risk_level TEXT DEFAULT 'LOW_RISK',
            ml_probability REAL DEFAULT 0,
            rule_penalty REAL DEFAULT 0,
            qr_status TEXT DEFAULT 'SKIPPED',
            graph_role TEXT DEFAULT 'UNOBSERVED',
            summary TEXT,
            payload_json TEXT,
            result_json TEXT
        )
    """)
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_hist_user ON evaluation_history(username, id DESC)"
    )
    conn.commit()
    conn.close()


def insert_transaction(txn: Dict[str, Any], uploaded_by: str = "system", source: str = "live_evaluation"):
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO transactions (
            txn_id, timestamp, sender_id, receiver_id, receiver_vpa,
            amount, qr_scanned, qr_hash_valid, qr_claimed_name,
            beneficiary_age_days, time_since_beneficiary_added_sec,
            velocity_10m, outflow_ratio_5m, in_degree_1h, ip_risk_score,
            device, location, is_fraud, fraud_type, uploaded_by, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        txn.get("txn_id"),
        txn.get("timestamp") or datetime.utcnow().isoformat(),
        txn.get("sender_id") or "ANON_SENDER",
        txn.get("receiver_id") or "ANON_RECEIVER",
        txn.get("receiver_vpa") or "",
        float(txn.get("amount", 0.0)),
        int(bool(txn.get("qr_scanned", 0))),
        int(txn.get("qr_hash_valid", 1)),
        txn.get("qr_claimed_name") or "",
        int(txn.get("beneficiary_age_days", 180)),
        int(txn.get("time_since_beneficiary_added_sec", 86400)),
        int(txn.get("velocity_10m", 0)),
        float(txn.get("outflow_ratio_5m", 0.0)),
        int(txn.get("in_degree_1h", 0)),
        float(txn.get("ip_risk_score", 0.05)),
        txn.get("device") or "",
        txn.get("location") or "",
        int(txn.get("is_fraud", 0)),
        txn.get("fraud_type") or "NONE",
        uploaded_by,
        source
    ))
    conn.commit()
    conn.close()


def _coerce_row(row: Dict[str, Any]) -> tuple:
    return (
        str(row.get("txn_id") or f"TXN_{abs(hash(str(row.get('receiver_vpa')))) % 10**10}"),
        str(row.get("timestamp") or datetime.utcnow().isoformat()),
        str(row.get("sender_id") or "USER"),
        str(row.get("receiver_id") or "BENEFICIARY"),
        str(row.get("receiver_vpa") or ""),
        float(row.get("amount") or 0.0),
        int(row.get("qr_scanned") or 0),
        int(row.get("qr_hash_valid", 1) or 0),
        str(row.get("qr_claimed_name") or ""),
        int(row.get("beneficiary_age_days", 180) or 180),
        int(row.get("time_since_beneficiary_added_sec", 86400) or 86400),
        int(row.get("velocity_10m", 0) or 0),
        float(row.get("outflow_ratio_5m", 0.0) or 0.0),
        int(row.get("in_degree_1h", 0) or 0),
        float(row.get("ip_risk_score", 0.05) or 0.05),
        str(row.get("device") or ""),
        str(row.get("location") or ""),
        int(row.get("is_fraud") or 0),
        str(row.get("fraud_type") or "NONE"),
    )


def bulk_insert_from_csv(csv_path: str, uploaded_by: str = "user_upload") -> int:
    """Vectorised ingest: single executemany batch instead of per-row commits."""
    df = pd.read_csv(csv_path)
    df = df.where(pd.notnull(df), None)

    records = df.to_dict(orient="records")
    payload = [(*_coerce_row(r), uploaded_by, "csv_upload") for r in records]
    if not payload:
        return 0

    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.executemany("""
        INSERT OR REPLACE INTO transactions (
            txn_id, timestamp, sender_id, receiver_id, receiver_vpa,
            amount, qr_scanned, qr_hash_valid, qr_claimed_name,
            beneficiary_age_days, time_since_beneficiary_added_sec,
            velocity_10m, outflow_ratio_5m, in_degree_1h, ip_risk_score,
            device, location, is_fraud, fraud_type, uploaded_by, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, payload)
    conn.commit()
    conn.close()
    return len(payload)


def get_all_transactions_df() -> pd.DataFrame:
    conn = get_tx_connection()
    df = pd.read_sql_query("SELECT * FROM transactions ORDER BY timestamp DESC", conn)
    conn.close()
    return df


def get_recent_transactions_list(limit: int = 50, fraud_only: bool = False) -> List[Dict[str, Any]]:
    conn = get_tx_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM transactions"
    params: tuple = ()
    if fraud_only:
        query += " WHERE is_fraud = 1"
    query += " ORDER BY timestamp DESC LIMIT ?"
    cursor.execute(query, (*params, int(limit)))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ------------------------------------------------------------------ analyst history
def _stage_status(result: Dict[str, Any], stage_key: str) -> str:
    for stage in (result.get("analysis") or {}).get("stages", []):
        if stage.get("key") == stage_key:
            return str(stage.get("status", "SKIPPED"))
    return "SKIPPED"


def _graph_role(result: Dict[str, Any]) -> str:
    for stage in (result.get("analysis") or {}).get("stages", []):
        if stage.get("key") == "network_topology":
            metrics = stage.get("metrics") or {}
            if metrics.get("role"):
                return str(metrics["role"])
            if stage.get("role"):
                return str(stage.get("role"))
            if stage.get("note"):
                return str(stage.get("note"))
    return "UNOBSERVED"


def insert_evaluation_history(txn_id: str, username: str, payload: Dict[str, Any], result: Dict[str, Any]) -> None:
    """Archive one risk check so an analyst can replay the exact staged analysis later."""
    analysis = result.get("analysis") or {}
    row = (
        txn_id,
        username or "analyst",
        datetime.utcnow().isoformat(),
        (payload.get("receiver_vpa") or "").strip(),
        float(payload.get("amount") or 0.0),
        (payload.get("qr_claimed_name") or "").strip(),
        int(bool(payload.get("qr_scanned"))),
        int(result.get("risk_score", 0)),
        str(result.get("risk_level", "LOW_RISK")),
        float(result.get("ml_probability") or 0.0),
        float(result.get("rule_penalty") or 0.0),
        _stage_status(result, "qr_integrity"),
        _graph_role(result),
        str(analysis.get("summary", "")),
        json.dumps(payload, default=str),
        json.dumps(result, default=str),
    )
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO evaluation_history (
            txn_id, username, created_at, receiver_vpa, amount, qr_claimed_name,
            qr_scanned, risk_score, risk_level, ml_probability, rule_penalty,
            qr_status, graph_role, summary, payload_json, result_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        row,
    )
    conn.commit()
    conn.close()


def list_evaluation_history(username: str, limit: int = 100) -> List[Dict[str, Any]]:
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, txn_id, created_at, receiver_vpa, amount, qr_claimed_name,
               qr_scanned, risk_score, risk_level, ml_probability, rule_penalty,
               qr_status, graph_role, summary
        FROM evaluation_history
        WHERE username = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (username, int(limit)),
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_evaluation_history(username: str, txn_id: str) -> Optional[Dict[str, Any]]:
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM evaluation_history WHERE username = ? AND txn_id = ?",
        (username, txn_id),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    record = dict(row)
    record["payload"] = json.loads(record.pop("payload_json") or "{}")
    record["result"] = json.loads(record.pop("result_json") or "{}")
    return record


def clear_evaluation_history(username: str) -> int:
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM evaluation_history WHERE username = ?", (username,))
    count = int(cursor.fetchone()[0])
    cursor.execute("DELETE FROM evaluation_history WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return count


init_transactions_db()
