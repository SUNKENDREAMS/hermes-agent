"""Config read/write endpoints — direct integration with hermes_cli/config.py."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.config")
router = APIRouter()


@router.get("/config")
async def get_config(user: dict = Depends(require_auth)):
    """Read current config.yaml as JSON."""
    try:
        from hermes_cli.config import load_config, get_config_path
        config = load_config()
        return {"config": config, "path": str(get_config_path())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {e}")


@router.put("/config")
async def update_config(body: dict, user: dict = Depends(require_auth)):
    """Update config.yaml with the provided values (merge, not replace)."""
    try:
        import yaml
        from hermes_cli.config import get_config_path, load_config

        config_path = get_config_path()
        current = load_config()

        # Deep merge
        updates = body.get("config", body)
        _deep_merge(current, updates)

        # Write back
        with open(config_path, "w", encoding="utf-8") as f:
            yaml.dump(current, f, default_flow_style=False, allow_unicode=True)

        return {"status": "ok", "path": str(config_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update config: {e}")


@router.get("/config/schema")
async def get_config_schema(user: dict = Depends(require_auth)):
    """Return DEFAULT_CONFIG as the schema definition for form generation."""
    try:
        from hermes_cli.config import DEFAULT_CONFIG
        return {"schema": DEFAULT_CONFIG}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/env")
async def get_env_vars(user: dict = Depends(require_auth)):
    """List optional env vars with metadata (descriptions, URLs, categories)."""
    try:
        from hermes_cli.config import OPTIONAL_ENV_VARS, get_env_path
        import os

        env_path = get_env_path()
        # Read current .env values (masked)
        env_values = {}
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, val = line.partition("=")
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if val:
                        env_values[key] = val[:4] + "..." + val[-4:] if len(val) > 12 else "***"
                    else:
                        env_values[key] = ""

        # Build response with metadata
        env_list = []
        for key, meta in OPTIONAL_ENV_VARS.items():
            env_list.append({
                "key": key,
                "description": meta.get("description", ""),
                "category": meta.get("category", "other"),
                "url": meta.get("url", ""),
                "is_secret": meta.get("password", False),
                "is_set": key in env_values,
                "masked_value": env_values.get(key, ""),
                "advanced": meta.get("advanced", False),
            })

        return {"env_vars": env_list, "path": str(env_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config/env")
async def update_env_var(body: dict, user: dict = Depends(require_auth)):
    """Set an environment variable in .env file."""
    key = body.get("key", "").strip()
    value = body.get("value", "")

    if not key:
        raise HTTPException(status_code=400, detail="key is required")

    try:
        from hermes_cli.config import get_env_path
        env_path = get_env_path()

        # Read existing
        lines = []
        if env_path.exists():
            lines = env_path.read_text(encoding="utf-8", errors="replace").splitlines()

        # Update or append
        found = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
                lines[i] = f'{key}="{value}"' if value else f"{key}="
                found = True
                break

        if not found:
            lines.append(f'{key}="{value}"' if value else f"{key}=")

        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return {"status": "ok", "key": key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _deep_merge(base: dict, updates: dict):
    """Recursively merge `updates` into `base` in-place."""
    for key, value in updates.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value
