import sqlite3
import hashlib
import os
import secrets
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

AUTH_DB_PATH = "d:/Diamond-protect-v2/backend/data/auth.db"
JWT_SECRET = "DIAMOND_SECURE_AUTH_TOKEN_SECRET_KEY_2026_PROD"
JWT_ALGORITHM = "HS256"

def get_auth_connection():
    os.makedirs(os.path.dirname(AUTH_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(AUTH_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_auth_db():
    conn = get_auth_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT DEFAULT 'analyst',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    # Salted PBKDF2 HMAC SHA-256 (high security standard)
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pwd_hash, salt

def create_user(email: str, full_name: str, password: str, role: str = 'analyst') -> Dict[str, Any]:
    conn = get_auth_connection()
    cursor = conn.cursor()
    
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (email.lower().strip(),))
    if cursor.fetchone():
        conn.close()
        raise ValueError("An account with this email address already exists.")
    
    pwd_hash, salt = hash_password(password)
    cursor.execute("""
        INSERT INTO users (email, full_name, password_hash, salt, role)
        VALUES (?, ?, ?, ?, ?)
    """, (email.lower().strip(), full_name.strip(), pwd_hash, salt, role))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "id": user_id,
        "email": email.lower().strip(),
        "full_name": full_name.strip(),
        "role": role
    }

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    conn = get_auth_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return None

    expected_hash, _ = hash_password(password, user["salt"])
    if secrets.compare_digest(expected_hash, user["password_hash"]):
        return {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"]
        }
    return None

def create_access_token(user_data: Dict[str, Any], expires_hours: int = 24) -> str:
    payload = {
        "sub": str(user_data["id"]),
        "email": user_data["email"],
        "name": user_data["full_name"],
        "role": user_data["role"],
        "exp": datetime.utcnow() + timedelta(hours=expires_hours)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return decoded
    except Exception:
        return None

# Initialize Auth database schema on module load
init_auth_db()
