import sqlite3
import os
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional

TRANSACTIONS_DB_PATH = "d:/Diamond-protect-v2/backend/data/transactions.db"

def get_tx_connection():
    os.makedirs(os.path.dirname(TRANSACTIONS_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(TRANSACTIONS_DB_PATH)
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
            uploaded_by TEXT DEFAULT 'system'
        )
    """)
    conn.commit()
    conn.close()

def insert_transaction(txn: Dict[str, Any], uploaded_by: str = 'system'):
    conn = get_tx_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO transactions (
            txn_id, timestamp, sender_id, receiver_id, receiver_vpa,
            amount, qr_scanned, qr_hash_valid, qr_claimed_name,
            beneficiary_age_days, time_since_beneficiary_added_sec,
            velocity_10m, outflow_ratio_5m, in_degree_1h, ip_risk_score,
            device, location, is_fraud, fraud_type, uploaded_by
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?
        )
    """, (
        txn.get("txn_id"),
        txn.get("timestamp", datetime.utcnow().isoformat()),
        txn.get("sender_id", "ANON_SENDER"),
        txn.get("receiver_id", "ANON_RECEIVER"),
        txn.get("receiver_vpa", ""),
        float(txn.get("amount", 0.0)),
        int(txn.get("qr_scanned", 0)),
        int(txn.get("qr_hash_valid", 1)),
        txn.get("qr_claimed_name", ""),
        int(txn.get("beneficiary_age_days", 180)),
        int(txn.get("time_since_beneficiary_added_sec", 86400)),
        int(txn.get("velocity_10m", 1)),
        float(txn.get("outflow_ratio_5m", 0.0)),
        int(txn.get("in_degree_1h", 1)),
        float(txn.get("ip_risk_score", 0.05)),
        txn.get("device", "Mobile App"),
        txn.get("location", "India"),
        int(txn.get("is_fraud", 0)),
        txn.get("fraud_type", "NONE"),
        uploaded_by
    ))
    conn.commit()
    conn.close()

def bulk_insert_from_csv(csv_path: str, uploaded_by: str = 'user_upload') -> int:
    df = pd.read_csv(csv_path)
    count = 0
    conn = get_tx_connection()
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        txn_id = str(row.get("txn_id", f"TXN_{count}"))
        cursor.execute("""
            INSERT OR REPLACE INTO transactions (
                txn_id, timestamp, sender_id, receiver_id, receiver_vpa,
                amount, qr_scanned, qr_hash_valid, qr_claimed_name,
                beneficiary_age_days, time_since_beneficiary_added_sec,
                velocity_10m, outflow_ratio_5m, in_degree_1h, ip_risk_score,
                device, location, is_fraud, fraud_type, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            txn_id,
            str(row.get("timestamp", datetime.utcnow().isoformat())),
            str(row.get("sender_id", "USER")),
            str(row.get("receiver_id", "BENEFICIARY")),
            str(row.get("receiver_vpa", "")),
            float(row.get("amount", 0.0)),
            int(row.get("qr_scanned", 0)),
            int(row.get("qr_hash_valid", 1)),
            str(row.get("qr_claimed_name", "")),
            int(row.get("beneficiary_age_days", 180)),
            int(row.get("time_since_beneficiary_added_sec", 86400)),
            int(row.get("velocity_10m", 1)),
            float(row.get("outflow_ratio_5m", 0.0)),
            int(row.get("in_degree_1h", 1)),
            float(row.get("ip_risk_score", 0.05)),
            str(row.get("device", "Android")),
            str(row.get("location", "India")),
            int(row.get("is_fraud", 0)),
            str(row.get("fraud_type", "NONE")),
            uploaded_by
        ))
        count += 1

    conn.commit()
    conn.close()
    return count

def get_all_transactions_df() -> pd.DataFrame:
    conn = get_tx_connection()
    df = pd.read_sql_query("SELECT * FROM transactions ORDER BY timestamp DESC", conn)
    conn.close()
    return df

def get_recent_transactions_list(limit: int = 50, fraud_only: bool = False) -> List[Dict[str, Any]]:
    conn = get_tx_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM transactions"
    if fraud_only:
        query += " WHERE is_fraud = 1"
    query += f" ORDER BY timestamp DESC LIMIT {limit}"
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Initialize schema
init_transactions_db()
