"""Cron job management — direct integration with cron/jobs.py."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.cron")
router = APIRouter()


@router.get("/cron/jobs")
async def list_jobs(include_disabled: bool = False, user: dict = Depends(require_auth)):
    """List all cron jobs."""
    try:
        from cron.jobs import list_jobs as _list_jobs
        jobs = _list_jobs(include_disabled=include_disabled)
        return {"jobs": jobs, "count": len(jobs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cron/jobs")
async def create_job(body: dict, user: dict = Depends(require_auth)):
    """Create a new cron job."""
    prompt = body.get("prompt", "").strip()
    schedule = body.get("schedule", "").strip()
    if not prompt or not schedule:
        raise HTTPException(status_code=400, detail="prompt and schedule are required")

    try:
        from cron.jobs import create_job as _create_job
        job = _create_job(
            prompt=prompt,
            schedule=schedule,
            name=body.get("name"),
            repeat=body.get("repeat"),
            deliver=body.get("deliver"),
            skill=body.get("skill"),
            skills=body.get("skills"),
            model=body.get("model"),
        )
        return {"status": "ok", "job": job}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/cron/jobs/{job_id}")
async def update_job(job_id: str, body: dict, user: dict = Depends(require_auth)):
    """Update a cron job."""
    try:
        from cron.jobs import update_job as _update_job
        job = _update_job(job_id, body)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "ok", "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cron/jobs/{job_id}")
async def remove_job(job_id: str, user: dict = Depends(require_auth)):
    """Remove a cron job."""
    try:
        from cron.jobs import remove_job as _remove_job
        removed = _remove_job(job_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cron/jobs/{job_id}/pause")
async def pause_job(job_id: str, body: dict = None, user: dict = Depends(require_auth)):
    """Pause a cron job."""
    try:
        from cron.jobs import pause_job as _pause_job
        reason = (body or {}).get("reason")
        job = _pause_job(job_id, reason=reason)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "ok", "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cron/jobs/{job_id}/resume")
async def resume_job(job_id: str, user: dict = Depends(require_auth)):
    """Resume a paused cron job."""
    try:
        from cron.jobs import resume_job as _resume_job
        job = _resume_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "ok", "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cron/jobs/{job_id}/trigger")
async def trigger_job(job_id: str, user: dict = Depends(require_auth)):
    """Trigger a cron job to run immediately."""
    try:
        from cron.jobs import trigger_job as _trigger_job
        job = _trigger_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"status": "ok", "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cron/jobs/{job_id}/output")
async def get_job_output(job_id: str, limit: int = 10, user: dict = Depends(require_auth)):
    """Get output history for a cron job."""
    try:
        from cron.jobs import OUTPUT_DIR
        output_dir = OUTPUT_DIR / job_id
        if not output_dir.exists():
            return {"outputs": [], "count": 0}

        files = sorted(output_dir.glob("*.md"), reverse=True)[:limit]
        outputs = []
        for f in files:
            outputs.append({
                "filename": f.name,
                "timestamp": f.stem,
                "content": f.read_text(encoding="utf-8", errors="replace")[:5000],
                "size": f.stat().st_size,
            })
        return {"outputs": outputs, "count": len(outputs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
