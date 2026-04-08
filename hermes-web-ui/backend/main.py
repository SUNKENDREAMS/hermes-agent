"""
Hermes Web UI — FastAPI Backend

Serves the REST API, WebSocket endpoints (chat streaming + terminal),
and (in production mode) the Next.js static export on a single port.

Integration strategy: directly import hermes-agent Python modules for
zero-latency access to AIAgent, SessionDB, tool registry, config, etc.
"""

import os
import sys
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ---------------------------------------------------------------------------
# Ensure hermes-agent root is on sys.path so we can import its modules
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent
_WEB_UI_ROOT = _BACKEND_DIR.parent
_HERMES_ROOT = os.environ.get("HERMES_AGENT_ROOT", os.path.expanduser("~/hermes-agent"))
if _HERMES_ROOT not in sys.path:
    sys.path.insert(0, _HERMES_ROOT)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("hermes_web")

# ---------------------------------------------------------------------------
# App lifespan — startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: verify hermes imports, init auth DB, seed admin."""
    logger.info("Hermes Web UI starting — agent root: %s", _HERMES_ROOT)

    # Verify critical imports
    try:
        from hermes_constants import get_hermes_home
        logger.info("Hermes home: %s", get_hermes_home())
    except ImportError:
        logger.error(
            "Cannot import hermes_constants — is HERMES_AGENT_ROOT correct? (%s)",
            _HERMES_ROOT,
        )

    # Initialize auth database
    from auth import init_auth_db
    await init_auth_db()

    yield

    logger.info("Hermes Web UI shutting down")


# ---------------------------------------------------------------------------
# SSL Certificate Auto-Generation
# ---------------------------------------------------------------------------
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from datetime import datetime, timedelta

CERT_DIR = os.path.join(os.path.dirname(__file__), "../certs")
os.makedirs(CERT_DIR, exist_ok=True)
CERT_FILE = os.path.join(CERT_DIR, "fullchain.pem")
KEY_FILE = os.path.join(CERT_DIR, "privkey.pem")

def generate_self_signed_cert():
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return
    print("Generating self-signed certificate for HTTPS...")
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "hermes-web-ui.local")])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow())
        .not_valid_after(datetime.utcnow() + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    with open(KEY_FILE, "wb") as f:
        f.write(key.private_bytes(encoding=serialization.Encoding.PEM,
                                  format=serialization.PrivateFormat.PKCS8,
                                  encryption_algorithm=serialization.NoEncryption()))
    with open(CERT_FILE, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    print("Self-signed certs generated in hermes-web-ui/certs/")

generate_self_signed_cert()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Hermes Agent Web UI",
    description="Production-grade web administration interface for Hermes Agent",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Mount API routers
# ---------------------------------------------------------------------------
from routers import agent, config, tools, skills, cron, sessions, gateway, profiles, system, discovery

app.include_router(agent.router, prefix="/api/v1", tags=["Agent"])
app.include_router(config.router, prefix="/api/v1", tags=["Config"])
app.include_router(tools.router, prefix="/api/v1", tags=["Tools"])
app.include_router(skills.router, prefix="/api/v1", tags=["Skills"])
app.include_router(cron.router, prefix="/api/v1", tags=["Cron"])
app.include_router(sessions.router, prefix="/api/v1", tags=["Sessions"])
app.include_router(gateway.router, prefix="/api/v1", tags=["Gateway"])
app.include_router(profiles.router, prefix="/api/v1", tags=["Profiles"])
app.include_router(system.router, prefix="/api/v1", tags=["System"])
app.include_router(discovery.router, prefix="/api/v1", tags=["Discovery"])

# ---------------------------------------------------------------------------
# WebSocket endpoints
# ---------------------------------------------------------------------------
from ws.chat import router as chat_ws_router
from ws.terminal import router as terminal_ws_router

app.include_router(chat_ws_router)
app.include_router(terminal_ws_router)

# ---------------------------------------------------------------------------
# Production: serve Next.js static export
# ---------------------------------------------------------------------------
_STATIC_DIR = _WEB_UI_ROOT / "out"
if _STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_STATIC_DIR), html=True), name="static")
    logger.info("Serving static frontend from %s", _STATIC_DIR)


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("HERMES_WEB_PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        reload_dirs=[str(_BACKEND_DIR)],
    )
