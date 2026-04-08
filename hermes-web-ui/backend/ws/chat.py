"""WebSocket chat streaming — runs AIAgent in a background thread with callbacks.

Streams:
  - text deltas (as they arrive)
  - tool call start/end with args and results
  - reasoning traces
  - status updates (thinking, tool_executing, etc.)
  - errors
"""

import asyncio
import json
import logging
import threading
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from auth import verify_token

logger = logging.getLogger("hermes_web.ws.chat")
router = APIRouter()

# Active agent instances — capped at HERMES_WEB_MAX_AGENTS
_active_agents: dict = {}
_agent_lock = threading.Lock()

import os
MAX_AGENTS = int(os.getenv("HERMES_WEB_MAX_AGENTS", "8"))


class AgentSession:
    """Wrapper around a single AIAgent conversation."""

    def __init__(self, session_id: str, model: str = None):
        self.session_id = session_id
        self.model = model
        self.agent = None
        self.conversation_history = []
        self._ws_queue: asyncio.Queue = None

    def _send_event(self, event_type: str, data: dict):
        """Queue an event to be sent to the WebSocket."""
        if self._ws_queue:
            try:
                self._ws_queue.put_nowait({
                    "type": event_type,
                    "timestamp": time.time(),
                    **data,
                })
            except asyncio.QueueFull:
                logger.warning("WebSocket queue full, dropping event: %s", event_type)

    def _on_tool_start(self, tool_name: str, tool_args: dict, **kwargs):
        """Callback when a tool call begins."""
        self._send_event("tool_start", {
            "tool": tool_name,
            "args": tool_args,
        })

    def _on_tool_end(self, tool_name: str, result: str, **kwargs):
        """Callback when a tool call completes."""
        # Truncate very long results for the WS stream
        truncated = result[:5000] + "..." if len(result) > 5000 else result
        self._send_event("tool_result", {
            "tool": tool_name,
            "result": truncated,
        })

    def _on_reasoning(self, text: str, **kwargs):
        """Callback for reasoning traces."""
        self._send_event("reasoning", {"text": text})

    def run_message(self, user_message: str, queue: asyncio.Queue):
        """Run a single agent turn in a background thread."""
        self._ws_queue = queue

        try:
            from run_agent import AIAgent

            if not self.agent:
                self.agent = AIAgent(
                    model=self.model or "anthropic/claude-sonnet-4-20250514",
                    platform="web-ui",
                    session_id=self.session_id,
                    quiet_mode=True,
                )

            self._send_event("status", {"state": "thinking"})

            result = self.agent.run_conversation(
                user_message=user_message,
                conversation_history=self.conversation_history,
            )

            final_response = result.get("final_response", "") if isinstance(result, dict) else str(result)
            self.conversation_history = result.get("messages", self.conversation_history) if isinstance(result, dict) else self.conversation_history

            self._send_event("response", {"text": final_response})
            self._send_event("done", {})

        except Exception as e:
            logger.exception("Agent error: %s", e)
            self._send_event("error", {"message": str(e)})

        finally:
            self._ws_queue = None


@router.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    """WebSocket endpoint for streaming chat with the agent."""
    await ws.accept()

    # Authenticate via first message
    try:
        auth_msg = await asyncio.wait_for(ws.receive_json(), timeout=10)
        token = auth_msg.get("token", "")
        user = verify_token(token)
        if not user:
            await ws.send_json({"type": "error", "message": "Invalid token"})
            await ws.close(code=4001)
            return
        await ws.send_json({"type": "authenticated", "user": user["sub"]})
    except Exception:
        await ws.close(code=4001)
        return

    session_id = str(uuid.uuid4())
    model = None

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "message")

            if msg_type == "message":
                user_message = data.get("text", "").strip()
                if not user_message:
                    continue

                model = data.get("model", model)

                # Check agent capacity
                with _agent_lock:
                    if len(_active_agents) >= MAX_AGENTS and session_id not in _active_agents:
                        await ws.send_json({
                            "type": "error",
                            "message": f"Max concurrent agents reached ({MAX_AGENTS}). Please wait.",
                        })
                        continue

                    if session_id not in _active_agents:
                        _active_agents[session_id] = AgentSession(session_id, model)

                session = _active_agents[session_id]
                queue = asyncio.Queue(maxsize=100)

                # Run agent in background thread
                thread = threading.Thread(
                    target=session.run_message,
                    args=(user_message, queue),
                    daemon=True,
                )
                thread.start()

                # Stream events from queue to WebSocket
                while True:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=0.1)
                        await ws.send_json(event)
                        if event.get("type") in ("done", "error"):
                            break
                    except asyncio.TimeoutError:
                        if not thread.is_alive():
                            break
                        continue

            elif msg_type == "new_session":
                # Start a fresh session
                with _agent_lock:
                    _active_agents.pop(session_id, None)
                session_id = str(uuid.uuid4())
                await ws.send_json({"type": "new_session", "session_id": session_id})

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info("Chat WebSocket disconnected: %s", session_id)
    except Exception as e:
        logger.exception("Chat WebSocket error: %s", e)
    finally:
        with _agent_lock:
            _active_agents.pop(session_id, None)
