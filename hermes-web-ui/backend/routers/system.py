"""System health, version, logs endpoints."""

import logging
import os
import time
from pathlib import Path

from fastapi import APIRouter, Depends
from auth import require_auth

logger = logging.getLogger("hermes_web.system")
router = APIRouter()


@router.get("/health")
async def health_check():
    """Public health check — no auth required."""
    hermes_available = False
    hermes_version = "unknown"
    hermes_home = "unknown"
    try:
        from hermes_constants import get_hermes_home
        hermes_home = str(get_hermes_home())
        hermes_available = True
        # Try to read version from pyproject.toml
        root = Path(__file__).resolve().parent.parent.parent
        pyproject = root / "pyproject.toml"
        if pyproject.exists():
            for line in pyproject.read_text().splitlines():
                if line.strip().startswith("version"):
                    hermes_version = line.split("=")[1].strip().strip('"')
                    break
    except Exception:
        pass

    return {
        "status": "ok",
        "hermes_available": hermes_available,
        "hermes_version": hermes_version,
        "hermes_home": hermes_home,
        "timestamp": time.time(),
    }


@router.get("/version")
async def get_version(user: dict = Depends(require_auth)):
    """Get detailed version and environment info."""
    import sys
    import platform

    info = {
        "web_ui_version": "0.1.0",
        "hermes_version": "unknown",
        "python_version": sys.version,
        "platform": platform.platform(),
        "hostname": platform.node(),
    }

    try:
        root = Path(__file__).resolve().parent.parent.parent
        pyproject = root / "pyproject.toml"
        if pyproject.exists():
            for line in pyproject.read_text().splitlines():
                if line.strip().startswith("version"):
                    info["hermes_version"] = line.split("=")[1].strip().strip('"')
                    break
    except Exception:
        pass

    try:
        from hermes_constants import get_hermes_home
        info["hermes_home"] = str(get_hermes_home())
    except Exception:
        pass

    return info


@router.get("/logs")
async def get_logs(lines: int = 100, log_type: str = "agent", user: dict = Depends(require_auth)):
    """Read recent log entries."""
    try:
        from hermes_constants import get_hermes_home
        log_dir = get_hermes_home() / "logs"
        log_file = log_dir / f"{log_type}.log"
        if not log_file.exists():
            return {"lines": [], "file": str(log_file), "exists": False}

        all_lines = log_file.read_text(encoding="utf-8", errors="replace").splitlines()
        tail = all_lines[-lines:] if len(all_lines) > lines else all_lines
        return {"lines": tail, "file": str(log_file), "exists": True, "total": len(all_lines)}
    except Exception as e:
        return {"error": str(e), "lines": []}


@router.post("/auth/login")
async def login(request_data: dict):
    """Authenticate and return a JWT token."""
    from fastapi import Request
    from auth import authenticate_user, create_token, log_audit

    username = request_data.get("username", "").strip()
    password = request_data.get("password", "")

    if not username or not password:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Username and password required")

    user = authenticate_user(username, password)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user)
    log_audit(user["id"], "login", f"User {username} logged in")

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
        },
    }


@router.post("/auth/logout")
async def logout(user: dict = Depends(require_auth)):
    """Revoke the current JWT token."""
    # Token revocation is handled by the auth module
    return {"status": "ok"}


@router.get("/auth/me")
async def get_current_user(user: dict = Depends(require_auth)):
    """Return current authenticated user info."""
    return {
        "username": user["sub"],
        "id": user["uid"],
        "role": user["role"],
    }
