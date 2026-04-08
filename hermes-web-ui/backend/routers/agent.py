"""Agent / chat session endpoints — direct integration with AIAgent + SessionDB."""

import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_auth

logger = logging.getLogger("hermes_web.agent")
router = APIRouter()


def _get_session_db():
    """Lazy singleton for SessionDB."""
    try:
        from hermes_state import SessionDB
        return SessionDB()
    except Exception as e:
        logger.error("Cannot initialize SessionDB: %s", e)
        return None


@router.get("/sessions")
async def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    source: Optional[str] = None,
    user: dict = Depends(require_auth),
):
    """List recent sessions with previews."""
    db = _get_session_db()
    if not db:
        raise HTTPException(status_code=503, detail="SessionDB unavailable")

    try:
        sessions = db.list_sessions_rich(
            source=source,
            limit=limit,
            offset=offset,
        )
        return {"sessions": sessions, "limit": limit, "offset": offset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(require_auth)):
    """Get a session with its full message history."""
    db = _get_session_db()
    if not db:
        raise HTTPException(status_code=503, detail="SessionDB unavailable")

    # Try to resolve by title or prefix
    resolved_id = db.resolve_session_id(session_id)
    if not resolved_id:
        resolved_id = db.resolve_session_by_title(session_id)
    if not resolved_id:
        raise HTTPException(status_code=404, detail="Session not found")

    session = db.get_session(resolved_id)
    messages = db.get_messages(resolved_id)
    return {
        "session": session,
        "messages": [dict(m) for m in messages] if messages else [],
    }


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    limit: int = Query(100, ge=1, le=500),
    user: dict = Depends(require_auth),
):
    """Get messages for a session."""
    db = _get_session_db()
    if not db:
        raise HTTPException(status_code=503, detail="SessionDB unavailable")

    messages = db.get_messages(session_id, limit=limit)
    return {"messages": [dict(m) for m in messages] if messages else []}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(require_auth)):
    """Delete a session and its messages."""
    db = _get_session_db()
    if not db:
        raise HTTPException(status_code=503, detail="SessionDB unavailable")

    try:
        db.delete_session(session_id)
        return {"status": "ok", "deleted": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats(user: dict = Depends(require_auth)):
    """Dashboard stats — session counts, tool calls, token usage."""
    db = _get_session_db()
    stats = {
        "total_sessions": 0,
        "sessions_today": 0,
        "total_messages": 0,
        "total_tool_calls": 0,
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "active_cron_jobs": 0,
        "installed_skills": 0,
    }

    if db:
        try:
            with db._lock:
                # Total sessions
                row = db._conn.execute("SELECT COUNT(*) as cnt FROM sessions").fetchone()
                stats["total_sessions"] = row["cnt"] if row else 0

                # Sessions today
                today_start = time.time() - 86400
                row = db._conn.execute(
                    "SELECT COUNT(*) as cnt FROM sessions WHERE started_at > ?",
                    (today_start,),
                ).fetchone()
                stats["sessions_today"] = row["cnt"] if row else 0

                # Total messages
                row = db._conn.execute("SELECT COUNT(*) as cnt FROM messages").fetchone()
                stats["total_messages"] = row["cnt"] if row else 0

                # Aggregate token usage
                row = db._conn.execute(
                    "SELECT SUM(tool_call_count) as tc, SUM(input_tokens) as it, SUM(output_tokens) as ot FROM sessions"
                ).fetchone()
                if row:
                    stats["total_tool_calls"] = row["tc"] or 0
                    stats["total_input_tokens"] = row["it"] or 0
                    stats["total_output_tokens"] = row["ot"] or 0
        except Exception as e:
            logger.warning("Stats query error: %s", e)

    # Cron jobs
    try:
        from cron.jobs import list_jobs
        jobs = list_jobs(include_disabled=False)
        stats["active_cron_jobs"] = len(jobs)
    except Exception:
        pass

    # Skills count
    try:
        from agent.skill_commands import get_skill_commands
        skills = get_skill_commands()
        stats["installed_skills"] = len(skills) if skills else 0
    except Exception:
        pass

    return stats
