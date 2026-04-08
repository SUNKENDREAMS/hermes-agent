"""Profile management — list, create, switch hermes profiles."""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.profiles")
router = APIRouter()


@router.get("/profiles")
async def list_profiles(user: dict = Depends(require_auth)):
    """List all hermes profiles."""
    profiles = []
    try:
        profiles_root = Path.home() / ".hermes" / "profiles"
        if profiles_root.exists():
            for item in sorted(profiles_root.iterdir()):
                if item.is_dir():
                    has_config = (item / "config.yaml").exists()
                    profiles.append({
                        "name": item.name,
                        "path": str(item),
                        "has_config": has_config,
                    })
    except Exception as e:
        logger.warning("Error listing profiles: %s", e)

    # Add default profile
    default_home = Path.home() / ".hermes"
    active_profile = "default"
    import os
    hermes_home = os.getenv("HERMES_HOME", "")
    if hermes_home and "profiles" in hermes_home:
        active_profile = Path(hermes_home).name

    return {
        "profiles": profiles,
        "active": active_profile,
        "default_home": str(default_home),
    }


@router.get("/profiles/active")
async def get_active_profile(user: dict = Depends(require_auth)):
    """Get the currently active profile."""
    import os
    from hermes_constants import get_hermes_home, display_hermes_home
    return {
        "home": str(get_hermes_home()),
        "display": display_hermes_home(),
        "name": _profile_name(),
    }


@router.post("/profiles")
async def create_profile(body: dict, user: dict = Depends(require_auth)):
    """Create a new hermes profile."""
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Validate name
    import re
    if not re.match(r'^[a-zA-Z0-9_-]+$', name):
        raise HTTPException(status_code=400, detail="Profile name must be alphanumeric with - or _")

    profiles_root = Path.home() / ".hermes" / "profiles"
    profile_dir = profiles_root / name
    if profile_dir.exists():
        raise HTTPException(status_code=409, detail=f"Profile '{name}' already exists")

    try:
        profile_dir.mkdir(parents=True)
        # Create minimal config
        (profile_dir / "config.yaml").write_text("# Hermes Agent profile config\nmodel: \"\"\n")
        return {"status": "ok", "name": name, "path": str(profile_dir)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/profiles/{name}")
async def delete_profile(name: str, user: dict = Depends(require_auth)):
    """Delete a hermes profile."""
    if name == "default":
        raise HTTPException(status_code=400, detail="Cannot delete the default profile")

    profiles_root = Path.home() / ".hermes" / "profiles"
    profile_dir = profiles_root / name
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        import shutil
        shutil.rmtree(profile_dir)
        return {"status": "ok", "deleted": name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _profile_name() -> str:
    """Get the active profile name."""
    import os
    hermes_home = os.getenv("HERMES_HOME", "")
    if hermes_home and "profiles" in hermes_home:
        return Path(hermes_home).name
    return "default"
