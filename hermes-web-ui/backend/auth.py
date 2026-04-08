"""
Authentication module — SQLite-backed user store with JWT tokens.

Auth database lives at hermes-web-ui/data/auth.db.
On first run, seeds a default admin account.
"""

import hashlib
import logging
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger("hermes_web.auth")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent
_DATA_DIR = Path(os.path.expanduser("~/.hermes/web-ui"))
_DATA_DIR.mkdir(parents=True, exist_ok=True)
_AUTH_DB_PATH = _DATA_DIR / "auth.db"

# JWT settings
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_HOURS = 24

def _get_jwt_secret() -> str:
    """Return JWT secret, generating and persisting one if needed."""
    secret = os.getenv("HERMES_WEB_JWT_SECRET", "").strip()
    if secret:
        return secret
    # Auto-generate and persist to .env
    secret_file = _DATA_DIR / ".jwt_secret"
    if secret_file.exists():
        return secret_file.read_text().strip()
    secret = secrets.token_hex(32)
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    secret_file.write_text(secret)
    logger.info("Generated new JWT secret")
    return secret


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at REAL NOT NULL,
    last_login REAL,
    failed_attempts INTEGER DEFAULT 0,
    locked_until REAL
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token_hash TEXT UNIQUE NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    revoked INTEGER DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT,
    ip_address TEXT,
    timestamp REAL NOT NULL
);
"""


def _get_db() -> sqlite3.Connection:
    """Open a connection to the auth database."""
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_AUTH_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


async def init_auth_db():
    """Initialize schema and seed default admin."""
    db = _get_db()
    db.executescript(_SCHEMA_SQL)

    # Check if any users exist
    row = db.execute("SELECT COUNT(*) as cnt FROM users").fetchone()
    if row["cnt"] == 0:
        # Seed default admin
        default_user = os.getenv("HERMES_WEB_ADMIN_USER", "admin")
        default_pass = os.getenv("HERMES_WEB_ADMIN_PASS", "")
        if not default_pass:
            default_pass = secrets.token_urlsafe(16)
            logger.warning(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            )
            logger.warning("  HERMES WEB UI — First Run Setup")
            logger.warning("  Default admin account created:")
            logger.warning("    Username: %s", default_user)
            logger.warning("    Password: %s", default_pass)
            logger.warning("  Change this password immediately!")
            logger.warning(
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            )

        pw_hash = bcrypt.hashpw(default_pass.encode(), bcrypt.gensalt()).decode()
        db.execute(
            "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)",
            (default_user, pw_hash, time.time()),
        )
        db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Auth operations
# ---------------------------------------------------------------------------

def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Verify credentials and return user dict, or None."""
    db = _get_db()
    row = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        db.close()
        return None

    # Check lock
    if row["locked_until"] and row["locked_until"] > time.time():
        db.close()
        return None

    if not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        # Increment failed attempts, lock after 5
        attempts = (row["failed_attempts"] or 0) + 1
        locked_until = None
        if attempts >= 5:
            locked_until = time.time() + 300  # Lock for 5 minutes
            logger.warning("User '%s' locked for 5 minutes after %d failed attempts", username, attempts)
        db.execute(
            "UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?",
            (attempts, locked_until, row["id"]),
        )
        db.commit()
        db.close()
        return None

    # Reset failed attempts on success
    db.execute(
        "UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = ? WHERE id = ?",
        (time.time(), row["id"]),
    )
    db.commit()
    user = dict(row)
    db.close()
    return user


def create_token(user: dict, request: Request = None) -> str:
    """Generate a JWT token for the user."""
    secret = _get_jwt_secret()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user["username"],
        "uid": user["id"],
        "role": user.get("role", "admin"),
        "iat": now,
        "exp": now + timedelta(hours=_JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, secret, algorithm=_JWT_ALGORITHM)

    # Store session
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db = _get_db()
    db.execute(
        "INSERT INTO sessions (user_id, token_hash, created_at, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
        (
            user["id"],
            token_hash,
            time.time(),
            (now + timedelta(hours=_JWT_EXPIRY_HOURS)).timestamp(),
            request.client.host if request else None,
            request.headers.get("user-agent", "")[:200] if request else None,
        ),
    )
    db.commit()
    db.close()
    return token


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token."""
    secret = _get_jwt_secret()
    try:
        payload = jwt.decode(token, secret, algorithms=[_JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

    # Check if session is revoked
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db = _get_db()
    row = db.execute(
        "SELECT revoked FROM sessions WHERE token_hash = ?", (token_hash,)
    ).fetchone()
    db.close()
    if row and row["revoked"]:
        return None

    return payload


def revoke_token(token: str) -> bool:
    """Revoke a JWT token."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    db = _get_db()
    cursor = db.execute(
        "UPDATE sessions SET revoked = 1 WHERE token_hash = ?", (token_hash,)
    )
    db.commit()
    result = cursor.rowcount > 0
    db.close()
    return result


def log_audit(user_id: Optional[int], action: str, detail: str = None, ip: str = None):
    """Write an entry to the audit log."""
    db = _get_db()
    db.execute(
        "INSERT INTO audit_log (user_id, action, detail, ip_address, timestamp) VALUES (?, ?, ?, ?, ?)",
        (user_id, action, detail, ip, time.time()),
    )
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)


async def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """FastAPI dependency: extract and verify JWT from Authorization header."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
