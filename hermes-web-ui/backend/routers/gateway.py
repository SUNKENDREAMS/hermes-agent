"""Gateway / messaging platform status."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from auth import require_auth

logger = logging.getLogger("hermes_web.gateway")
router = APIRouter()


@router.get("/gateway/status")
async def get_gateway_status(user: dict = Depends(require_auth)):
    """Get status of all messaging platform adapters."""
    platforms = []
    try:
        from gateway.config import load_gateway_config
        config = load_gateway_config()
        for platform, pconfig in config.platforms.items():
            platforms.append({
                "name": platform.value if hasattr(platform, 'value') else str(platform),
                "enabled": pconfig.enabled if hasattr(pconfig, 'enabled') else False,
                "configured": True,
            })
    except Exception as e:
        logger.debug("Gateway config not available: %s", e)

    # Check if gateway process is running (by looking for the lock file)
    gateway_running = False
    try:
        from hermes_constants import get_hermes_home
        lock_file = get_hermes_home() / "gateway.lock"
        gateway_running = lock_file.exists()
    except Exception:
        pass

    return {
        "running": gateway_running,
        "platforms": platforms,
    }


@router.get("/gateway/platforms")
async def list_platforms(user: dict = Depends(require_auth)):
    """List all available gateway platforms with their configuration status."""
    platforms = [
        {"id": "telegram", "name": "Telegram", "icon": "📱"},
        {"id": "discord", "name": "Discord", "icon": "🎮"},
        {"id": "slack", "name": "Slack", "icon": "💼"},
        {"id": "whatsapp", "name": "WhatsApp", "icon": "💬"},
        {"id": "signal", "name": "Signal", "icon": "🔒"},
        {"id": "matrix", "name": "Matrix", "icon": "🌐"},
        {"id": "mattermost", "name": "Mattermost", "icon": "📮"},
        {"id": "homeassistant", "name": "Home Assistant", "icon": "🏠"},
        {"id": "email", "name": "Email", "icon": "📧"},
        {"id": "sms", "name": "SMS", "icon": "📱"},
        {"id": "dingtalk", "name": "DingTalk", "icon": "🔔"},
        {"id": "feishu", "name": "Feishu/Lark", "icon": "🦅"},
        {"id": "wecom", "name": "WeCom", "icon": "💼"},
        {"id": "webhook", "name": "Webhook", "icon": "🔗"},
    ]

    # Check which are configured
    import os
    env_checks = {
        "telegram": "TELEGRAM_BOT_TOKEN",
        "discord": "DISCORD_TOKEN",
        "slack": "SLACK_BOT_TOKEN",
        "whatsapp": "WHATSAPP_ENABLED",
        "signal": "SIGNAL_ACCOUNT",
        "matrix": "MATRIX_PASSWORD",
        "homeassistant": "HASS_TOKEN",
        "email": "EMAIL_IMAP_SERVER",
        "sms": "TWILIO_ACCOUNT_SID",
    }

    for p in platforms:
        env_key = env_checks.get(p["id"])
        p["configured"] = bool(os.getenv(env_key, "")) if env_key else False

    return {"platforms": platforms}
