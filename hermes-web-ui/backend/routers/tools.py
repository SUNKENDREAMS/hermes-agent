"""Tools & toolsets — introspect the live tool registry."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.tools")
router = APIRouter()


@router.get("/tools")
async def list_tools(user: dict = Depends(require_auth)):
    """List all registered tools with metadata."""
    try:
        from tools.registry import registry
        tools = []
        for name in registry.get_all_tool_names():
            entry = registry._tools.get(name)
            if not entry:
                continue
            tools.append({
                "name": entry.name,
                "toolset": entry.toolset,
                "description": entry.description or (entry.schema.get("description", "") if entry.schema else ""),
                "emoji": entry.emoji,
                "requires_env": entry.requires_env,
                "is_async": entry.is_async,
                "available": bool(entry.check_fn()) if entry.check_fn else True,
                "schema": entry.schema,
            })
        return {"tools": tools, "count": len(tools)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/toolsets")
async def list_toolsets(user: dict = Depends(require_auth)):
    """List all toolsets with their descriptions and tools."""
    try:
        from toolsets import get_all_toolsets, resolve_toolset
        from tools.registry import registry

        all_ts = get_all_toolsets()
        result = []
        for name, info in sorted(all_ts.items()):
            resolved = resolve_toolset(name)
            available = registry.is_toolset_available(name) if hasattr(registry, 'is_toolset_available') else True
            result.append({
                "name": name,
                "description": info.get("description", ""),
                "tools": info.get("tools", []),
                "includes": info.get("includes", []),
                "resolved_tools": resolved,
                "tool_count": len(resolved),
                "available": available,
            })
        return {"toolsets": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tools/availability")
async def check_availability(user: dict = Depends(require_auth)):
    """Check which tools/toolsets are available (env vars set, etc.)."""
    try:
        from model_tools import check_tool_availability
        available, unavailable = check_tool_availability(quiet=True)
        return {"available": available, "unavailable": unavailable}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
