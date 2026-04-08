import asyncio
import os
import select
import signal
import sys
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict

if sys.platform != "win32":
    import pty
    import fcntl
    import struct
    import termios
else:
    # Dummy mocks for Windows just so Uvicorn boots for testing Next.js on port 8080.
    pty = fcntl = struct = termios = None

class TerminalManager:
    def __init__(self):
        self.processes: Dict[str, asyncio.subprocess.Process] = {}
        self.fd_map: Dict[str, int] = {}

    async def start_terminal(self, websocket: WebSocket, session_id: str, profile_home: str = None):
        # Set up PTY
        pid, master_fd = pty.fork()
        
        if pid == 0:  # Child process
            os.environ["TERM"] = "xterm-256color"
            if profile_home:
                os.chdir(profile_home)
                os.environ["HOME"] = profile_home
            os.execvp("bash", ["bash"])
        
        # Parent process
        self.fd_map[session_id] = master_fd
        
        loop = asyncio.get_running_loop()
        
        # We wrap in JSON for frontend compatibility, as it expects {"type": "output", "data": "..."}
        # and sends {"type": "input", "data": "..."} instead of pure text parsing problems.
        def read_from_pty():
            try:
                data = os.read(master_fd, 4096)
                if data:
                    asyncio.create_task(websocket.send_json({"type": "output", "data": data.decode("utf-8", errors="replace")}))
            except Exception:
                pass
        
        # Initial security warning
        await websocket.send_json({
            "type": "output",
            "data": "\r\n\033[1;33m⚠  HERMES WEB UI — Full System Shell Access (Linux Native)\033[0m\r\n"
                    "\033[33m   Actions are not sandboxed. Proceed with care.\033[0m\r\n\r\n",
        })

        while True:
            try:
                r, _, _ = select.select([master_fd], [], [], 0.05)
                if r:
                    read_from_pty()
                
                # Handle incoming messages from browser
                try:
                    message = await asyncio.wait_for(websocket.receive_json(), timeout=0.05)
                    if not message: continue
                    msg_type = message.get("type", "input")
                    if msg_type == "input":
                        os.write(master_fd, message.get("data", "").encode())
                    elif msg_type == "resize":
                        # Handle resize via ioctl
                        winsize = struct.pack("HHHH", message.get("rows", 30), message.get("cols", 120), 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                    elif msg_type == "hermes_tui":
                        os.write(master_fd, b"hermes\r")
                except asyncio.TimeoutError:
                    continue
            
            except WebSocketDisconnect:
                break
            except Exception:
                break
        
        # Cleanup
        try:
            os.close(master_fd)
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass

from fastapi import APIRouter
from auth import verify_token
import json

router = APIRouter()

terminal_manager = TerminalManager()

@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    # The frontend connects and sends a JSON token inside an authentication message, wait for it
    await websocket.accept()
    try:
        auth_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        token = auth_msg.get("token", "")
        user = verify_token(token)
        if not user:
            await websocket.send_json({"type": "error", "message": "Invalid token"})
            await websocket.close(code=4001)
            return

        session_id = user["sub"]
        await websocket.send_json({"type": "authenticated", "user": session_id})
        
        # Now hand over to the terminal manager
        profile_home = os.environ.get("HERMES_HOME", None)
        await terminal_manager.start_terminal(websocket, session_id, profile_home)
    except Exception:
        await websocket.close(code=4001)
