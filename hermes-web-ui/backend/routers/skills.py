"""Skills management — browse, view, edit skills files."""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.skills")
router = APIRouter()


@router.get("/skills")
async def list_skills(user: dict = Depends(require_auth)):
    """List all available skills with metadata."""
    try:
        from agent.skill_commands import get_skill_commands
        skill_cmds = get_skill_commands() or {}
        skills = []
        for cmd_key, info in sorted(skill_cmds.items()):
            skills.append({
                "command": cmd_key,
                "name": info.get("name", ""),
                "description": info.get("description", ""),
                "path": info.get("skill_md_path", ""),
                "category": _extract_category(info.get("skill_md_path", "")),
            })
        return {"skills": skills, "count": len(skills)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skills/{name}")
async def view_skill(name: str, user: dict = Depends(require_auth)):
    """View a skill's full content."""
    try:
        from tools.skills_tool import skill_view
        result = json.loads(skill_view(name))
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Skill not found"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/skills/{name}")
async def update_skill(name: str, body: dict, user: dict = Depends(require_auth)):
    """Update a skill's content."""
    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="content is required")

    try:
        from agent.skill_commands import get_skill_commands
        skill_cmds = get_skill_commands() or {}

        # Find skill path
        cmd_key = f"/{name}" if not name.startswith("/") else name
        info = skill_cmds.get(cmd_key)
        if not info:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")

        skill_path = info.get("skill_md_path", "")
        if not skill_path:
            raise HTTPException(status_code=404, detail="Skill path not found")

        path = Path(skill_path)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Skill file not found")

        path.write_text(content, encoding="utf-8")
        return {"status": "ok", "path": str(path)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skills/categories/list")
async def list_categories(user: dict = Depends(require_auth)):
    """List skill categories (directory names)."""
    try:
        from hermes_constants import get_hermes_home
        skills_dir = get_hermes_home() / "skills"
        categories = []
        if skills_dir.exists():
            for item in sorted(skills_dir.iterdir()):
                if item.is_dir() and not item.name.startswith("."):
                    md_count = len(list(item.glob("*.md")))
                    categories.append({
                        "name": item.name,
                        "path": str(item),
                        "skill_count": md_count,
                    })
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _extract_category(path: str) -> str:
    """Extract category name from a skill path."""
    parts = Path(path).parts
    if len(parts) >= 2:
        return parts[-2]
    return "uncategorized"
