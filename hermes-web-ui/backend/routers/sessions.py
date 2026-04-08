"""Session search & memory endpoints — FTS5 + memory store integration."""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from auth import require_auth

logger = logging.getLogger("hermes_web.sessions")
router = APIRouter()


@router.get("/sessions/search")
async def search_sessions(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_auth),
):
    """Full-text search across all session messages via FTS5."""
    try:
        from hermes_state import SessionDB
        db = SessionDB()
        results = db.search(q, limit=limit)
        return {"results": results, "query": q, "count": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory")
async def get_memories(user: dict = Depends(require_auth)):
    """Read the persistent memory store."""
    try:
        from hermes_constants import get_hermes_home
        memory_file = get_hermes_home() / "memories" / "memory.json"
        if not memory_file.exists():
            return {"memories": [], "path": str(memory_file)}

        import json
        data = json.loads(memory_file.read_text(encoding="utf-8"))
        return {"memories": data if isinstance(data, list) else [data], "path": str(memory_file)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/memory/user-profile")
async def get_user_profile(user: dict = Depends(require_auth)):
    """Read the user profile (if memory/user modeling is enabled)."""
    try:
        from hermes_constants import get_hermes_home
        profile_file = get_hermes_home() / "memories" / "user_profile.json"
        if not profile_file.exists():
            return {"profile": None, "path": str(profile_file)}

        import json
        data = json.loads(profile_file.read_text(encoding="utf-8"))
        return {"profile": data, "path": str(profile_file)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insights")
async def get_insights(days: int = Query(30, ge=1, le=365), user: dict = Depends(require_auth)):
    """Usage insights and analytics."""
    try:
        import time
        from hermes_state import SessionDB
        db = SessionDB()

        cutoff = time.time() - (days * 86400)
        with db._lock:
            # Session count by source
            rows = db._conn.execute(
                "SELECT source, COUNT(*) as cnt FROM sessions WHERE started_at > ? GROUP BY source ORDER BY cnt DESC",
                (cutoff,),
            ).fetchall()
            by_source = {row["source"]: row["cnt"] for row in rows}

            # Model usage
            rows = db._conn.execute(
                "SELECT model, COUNT(*) as cnt, SUM(input_tokens) as inp, SUM(output_tokens) as out "
                "FROM sessions WHERE started_at > ? AND model IS NOT NULL GROUP BY model ORDER BY cnt DESC",
                (cutoff,),
            ).fetchall()
            by_model = [
                {"model": row["model"], "sessions": row["cnt"],
                 "input_tokens": row["inp"] or 0, "output_tokens": row["out"] or 0}
                for row in rows
            ]

            # Daily session counts
            rows = db._conn.execute(
                "SELECT date(started_at, 'unixepoch') as day, COUNT(*) as cnt "
                "FROM sessions WHERE started_at > ? GROUP BY day ORDER BY day",
                (cutoff,),
            ).fetchall()
            daily = [{"date": row["day"], "count": row["cnt"]} for row in rows]

            # Total cost
            row = db._conn.execute(
                "SELECT SUM(estimated_cost_usd) as est, SUM(actual_cost_usd) as act "
                "FROM sessions WHERE started_at > ?",
                (cutoff,),
            ).fetchone()
            cost = {
                "estimated_usd": round(row["est"] or 0, 4),
                "actual_usd": round(row["act"] or 0, 4),
            }

        return {
            "days": days,
            "by_source": by_source,
            "by_model": by_model,
            "daily": daily,
            "cost": cost,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
