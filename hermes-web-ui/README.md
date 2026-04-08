# Hermes Agent – Web UI

Welcome to the **Hermes Web UI** – a powerful, offline-first administration interface for the Hermes Agent (v0.8.0), delivering production-grade visualization, deployment monitoring, and interactive execution out of the box.

Designed specifically to be deeply integrated with the core Hermes Python packages securely without leaking to cloud endpoints, Hermes Web UI relies mostly on local intelligence, SQLite, and WebSockets.

---

## 🚀 Features

- **End-to-End Chat & Memory Search**: WebSocket streaming for tokens and reasoning traces, built-in SQLite session playback via FTS5.
- **Terminal Integration**: Fast native PTY via WebSockets integrated with xterm.js (Profile environment ready).
- **Extensible Configuration Setup**: View all configured tools, check environment variables, and manage platforms for message tunneling (Gateway).
- **Job Orchestration Control Room**: Deep integration with `cron.jobs.*` letting you run tasks on a schedule.
- **Auto-Discovery Module**: Continuously checks `/discovery/summary` so that any upstream commands or tool additions map dynamically onto UI pages.
- **Security Baked In**: Localized SQLite Authentication database stored in an isolated persistent directory `~/.hermes/web-ui/auth.db`. Auto-generated self-signed certificates limit unencrypted socket connections.

---

## 🛠 Prerequisites

To host Hermes Web UI, you must have the following dependencies:
- **Node.js**: v18+ 
- **Python**: 3.10+
- **Hermes Agent Root Access**: Hermes CLI dependencies and packages must be installed locally.

---

## 💻 Installation

1. Install Frontend node packages:
   ```bash
   cd hermes-web-ui
   npm install
   ```
2. Install Backend Python requirements:
   ```bash
   # Make sure your Python Hermes environment is active!
   pip install -r backend/requirements.txt
   ```

---

## 🔧 Getting Started

### Development Mode
For changing layouts and UI development without static build steps:
```bash
npm run dev
```

This concurrently boots:
- Next.js development server on `http://localhost:3000`
- FastAPI backend router on `http://localhost:8000`

### Production Mode (Linux Ready)

Before switching to production, build your frontend into optimized static files:
```bash
npm run build
```

Then start the application seamlessly:
```bash
./start.sh
```
This triggers the backend to run an underlying Uvicorn process that handles Next.js endpoints transparently and listens securely over HTTPS!

---

## 🔐 Environment Variables

You can supply standard environment overrides in `.env` (or through exports):
- **`HERMES_WEB_PORT`**: Designate the server's listening port (Default: `8080`).
- **`HERMES_AGENT_ROOT`**: Define absolute path to original Python Hermes modules (Default: `~/hermes-agent`).
- **`HERMES_WEB_JWT_SECRET`**: Auto randomizes on initial run but can be hardcoded for cluster setups.
- **`HERMES_WEB_MAX_AGENTS`**: Controls total number of running parallel agents allowed (Default: `8`).

---

## 🤔 Troubleshooting

- **Server Not Listening / WebSocket Drops:** Ensure you do not have multiple instances holding onto identical ports (e.g., standard `8000` / `8080`).
- **Cannot Parse Certificates:** On immediate startup, the `main.py` daemon generates `privkey.pem` and `fullchain.pem` inside `backend/certs/`. Verify permissions or clear out old expired certs.
- **Admin Password Reset:** The system locks Admin credentials safely after 5 failed log-ins. If you forget your password, directly access `~/.hermes/web-ui/auth.db` via `sqlite3` to dump the users table.

*Need core Hermes API documentation? Check `~/hermes-agent/AGENTS.md`!*
