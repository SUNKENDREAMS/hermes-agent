"""Discovery endpoints — auto-detect new features after hermes update.

This is the KEY future-proofing mechanism. Each endpoint introspects live
Python modules (COMMAND_REGISTRY, tool registry, DEFAULT_CONFIG, skills dir)
and returns the current inventory. The frontend caches and diffs to highlight
new features post-update.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.discovery")
router = APIRouter()


@router.get("/discovery/commands")
async def discover_commands(user: dict = Depends(require_auth)):
    """Scan COMMAND_REGISTRY for all slash commands."""
    try:
        from hermes_cli.commands import COMMAND_REGISTRY
        commands = []
        for cmd in COMMAND_REGISTRY:
            commands.append({
                "name": cmd.name,
                "description": cmd.description,
                "category": cmd.category,
                "aliases": list(cmd.aliases),
                "args_hint": cmd.args_hint,
                "subcommands": list(cmd.subcommands) if cmd.subcommands else [],
                "cli_only": cmd.cli_only,
                "gateway_only": cmd.gateway_only,
            })
        return {"commands": commands, "count": len(commands)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discovery/tools")
async def discover_tools(user: dict = Depends(require_auth)):
    """Scan tool registry for all registered tools."""
    try:
        from tools.registry import registry
        tools = []
        for name in registry.get_all_tool_names():
            entry = registry._tools.get(name)
            if entry:
                tools.append({
                    "name": entry.name,
                    "toolset": entry.toolset,
                    "description": entry.description,
                    "requires_env": entry.requires_env,
                })
        return {"tools": tools, "count": len(tools)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discovery/config-keys")
async def discover_config_keys(user: dict = Depends(require_auth)):
    """Scan DEFAULT_CONFIG for all configuration keys (recursively flattened)."""
    try:
        from hermes_cli.config import DEFAULT_CONFIG
        keys = _flatten_keys(DEFAULT_CONFIG)
        return {"keys": keys, "count": len(keys)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discovery/skills")
async def discover_skills(user: dict = Depends(require_auth)):
    """Scan skill directories for all available skills."""
    try:
        from agent.skill_commands import get_skill_commands
        skill_cmds = get_skill_commands() or {}
        skills = list(skill_cmds.keys())
        return {"skills": skills, "count": len(skills)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discovery/env-vars")
async def discover_env_vars(user: dict = Depends(require_auth)):
    """Scan OPTIONAL_ENV_VARS for all known environment variables."""
    try:
        from hermes_cli.config import OPTIONAL_ENV_VARS
        vars_list = [
            {"key": k, "category": v.get("category", "other"), "description": v.get("description", "")}
            for k, v in OPTIONAL_ENV_VARS.items()
        ]
        return {"env_vars": vars_list, "count": len(vars_list)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discovery/summary")
async def discovery_summary(user: dict = Depends(require_auth)):
    """Get a complete feature inventory — the frontend diffs this against its cached version."""
    summary = {
        "commands": 0,
        "tools": 0,
        "config_keys": 0,
        "skills": 0,
        "env_vars": 0,
        "toolsets": 0,
        "platforms": 0,
    }
    try:
        from hermes_cli.commands import COMMAND_REGISTRY
        summary["commands"] = len(COMMAND_REGISTRY)
    except Exception:
        pass
    try:
        from tools.registry import registry
        summary["tools"] = len(registry.get_all_tool_names())
    except Exception:
        pass
    try:
        from hermes_cli.config import DEFAULT_CONFIG
        summary["config_keys"] = len(_flatten_keys(DEFAULT_CONFIG))
    except Exception:
        pass
    try:
        from agent.skill_commands import get_skill_commands
        summary["skills"] = len(get_skill_commands() or {})
    except Exception:
        pass
    try:
        from hermes_cli.config import OPTIONAL_ENV_VARS
        summary["env_vars"] = len(OPTIONAL_ENV_VARS)
    except Exception:
        pass
    try:
        from toolsets import get_all_toolsets
        summary["toolsets"] = len(get_all_toolsets())
    except Exception:
        pass

    return summary


def _flatten_keys(d: dict, prefix: str = "") -> list:
    """Recursively flatten a dict into dotted key paths with type info."""
    keys = []
    for k, v in d.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.extend(_flatten_keys(v, full_key))
        else:
            keys.append({
                "key": full_key,
                "type": type(v).__name__,
                "default": v if not isinstance(v, (list, dict)) else str(v)[:100],
            })
    return keys
