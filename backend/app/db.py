import sqlite3
import os
import json
import hashlib
import secrets
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

env_data_dir = os.environ.get("DATA_DIR")
if env_data_dir:
    DATA_DIR = Path(env_data_dir)
else:
    DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "modelhub.db"

def get_db_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn

def init_db() -> None:
    """Initialize database tables for users, sessions, and user conversations"""
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                    email TEXT,
                    display_name TEXT,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_conversations (
                    id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    title TEXT,
                    messages_json TEXT NOT NULL DEFAULT '[]',
                    updated_at INTEGER NOT NULL,
                    PRIMARY KEY (user_id, id),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_user_conv_user ON user_conversations(user_id);")
    finally:
        conn.close()

def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{key.hex()}"

def verify_password(stored_hash: str, password: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def create_user(username: str, password: str, email: Optional[str] = None, display_name: Optional[str] = None) -> Dict[str, Any]:
    username_clean = username.strip()
    if len(username_clean) < 3:
        raise ValueError("Foydalanuvchi nomi kamida 3 ta belgidan iborat bo'lishi kerak.")
    if len(password) < 6:
        raise ValueError("Parol kamida 6 ta belgidan iborat bo'lishi kerak.")

    pwd_hash = hash_password(password)
    display = (display_name or "").strip() or username_clean
    email_clean = (email or "").strip() or None

    conn = get_db_connection()
    try:
        with conn:
            cursor = conn.execute(
                "INSERT INTO users (username, email, display_name, password_hash) VALUES (?, ?, ?, ?)",
                (username_clean, email_clean, display, pwd_hash)
            )
            user_id = cursor.lastrowid
            row = conn.execute("SELECT id, username, email, display_name, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(row)
    except sqlite3.IntegrityError:
        raise ValueError("Ushbu foydalanuvchi nomi allaqachon band. Boshqa nom tanlang.")
    finally:
        conn.close()

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username.strip(),)).fetchone()
        if not row:
            return None
        if not verify_password(row["password_hash"], password):
            return None
        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "display_name": row["display_name"],
            "created_at": row["created_at"],
        }
    finally:
        conn.close()

def create_session(user_id: int, days_valid: int = 30) -> str:
    token = secrets.token_hex(32)
    expires_at = datetime.utcnow() + timedelta(days=days_valid)
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                (token, user_id, expires_at.isoformat())
            )
        return token
    finally:
        conn.close()

def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or not token.strip():
        return None
    conn = get_db_connection()
    try:
        row = conn.execute("""
            SELECT u.id, u.username, u.email, u.display_name, u.created_at, s.expires_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        """, (token.strip(),)).fetchone()
        if not row:
            return None
        
        # Check token expiration
        if row["expires_at"]:
            try:
                expires = datetime.fromisoformat(row["expires_at"])
                if datetime.utcnow() > expires:
                    delete_session(token)
                    return None
            except Exception:
                pass

        return {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "display_name": row["display_name"],
            "created_at": row["created_at"],
        }
    finally:
        conn.close()

def delete_session(token: str) -> None:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token.strip(),))
    finally:
        conn.close()

def get_user_conversations(user_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        rows = conn.execute(
            "SELECT id, title, messages_json, updated_at FROM user_conversations WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,)
        ).fetchall()
        result = []
        for r in rows:
            try:
                msgs = json.loads(r["messages_json"])
            except Exception:
                msgs = []
            result.append({
                "id": r["id"],
                "title": r["title"] or "",
                "messages": msgs,
                "updatedAt": r["updated_at"]
            })
        return result
    finally:
        conn.close()

def save_user_conversations(user_id: int, conversations: List[Dict[str, Any]]) -> None:
    conn = get_db_connection()
    try:
        with conn:
            for c in conversations:
                cid = c.get("id")
                if not cid:
                    continue
                title = c.get("title") or ""
                msgs = c.get("messages") or []
                msgs_json = json.dumps(msgs, ensure_ascii=False)
                updated_at = int(c.get("updatedAt") or c.get("updated_at") or int(datetime.utcnow().timestamp() * 1000))
                conn.execute(
                    """
                    INSERT INTO user_conversations (id, user_id, title, messages_json, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, id) DO UPDATE SET
                        title = excluded.title,
                        messages_json = excluded.messages_json,
                        updated_at = excluded.updated_at
                    """,
                    (cid, user_id, title, msgs_json, updated_at)
                )
    finally:
        conn.close()

def delete_user_conversation(user_id: int, conv_id: str) -> None:
    conn = get_db_connection()
    try:
        with conn:
            conn.execute(
                "DELETE FROM user_conversations WHERE user_id = ? AND id = ?",
                (user_id, conv_id)
            )
    finally:
        conn.close()

