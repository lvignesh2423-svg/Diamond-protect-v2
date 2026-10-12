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
            username TEXT UNIQUE NOT NULL,
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
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return pwd_hash, salt

def create_user(username: str, password: str, role: str = 'analyst') -> Dict[str, Any]:
    username_clean = username.strip().lower()
    if not username_clean:
        raise ValueError("Username cannot be empty.")
    if len(password) < 4:
        raise ValueError("Password must be at least 4 characters long.")

    conn = get_auth_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM users WHERE username = ?", (username_clean,))
    if cursor.fetchone():
        conn.close()
        raise ValueError("This username is already taken. Please choose another.")
    
    pwd_hash, salt = hash_password(password)
    cursor.execute("""
        INSERT INTO users (username, password_hash, salt, role)
        VALUES (?, ?, ?, ?)
    """, (username_clean, pwd_hash, salt, role))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "id": user_id,
        "username": username_clean,
        "role": role
    }

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    username_clean = username.strip().lower()
    conn = get_auth_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username_clean,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        return None

    expected_hash, _ = hash_password(password, user["salt"])
    if secrets.compare_digest(expected_hash, user["password_hash"]):
        return {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"]
        }
    return None

def create_access_token(user_data: Dict[str, Any], expires_hours: int = 48) -> str:
    payload = {
        "sub": str(user_data["id"]),
        "username": user_data["username"],
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

init_auth_db()
