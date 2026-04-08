"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Terminal as TermIcon, AlertTriangle, Hexagon } from "lucide-react";

export default function TerminalPage() {
  const termContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Dynamic import xterm (client-only)
    const { Terminal } = await import("@xterm/xterm");
    const { FitAddon } = await import("@xterm/addon-fit");
    const { WebLinksAddon } = await import("@xterm/addon-web-links");
    // xterm CSS loaded via globals.css

    if (!termContainerRef.current) return;

    // Clean up previous terminal
    if (termRef.current) {
      termRef.current.dispose();
    }
    termContainerRef.current.innerHTML = "";

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 14,
      lineHeight: 1.4,
      theme: {
        background: "#0c0d11",
        foreground: "#e2e2e5",
        cursor: "#D4A853",
        cursorAccent: "#0c0d11",
        selectionBackground: "#D4A85333",
        black: "#1e1f28",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#D4A853",
        blue: "#6272a4",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#e2e2e5",
        brightBlack: "#44475a",
        brightRed: "#ff6e6e",
        brightGreen: "#69ff94",
        brightYellow: "#E8C878",
        brightBlue: "#d6acff",
        brightMagenta: "#ff92df",
        brightCyan: "#a4ffff",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(termContainerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    setStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === "development" ? "8000" : window.location.port;
    const ws = new WebSocket(`${protocol}//${host}:${port}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      const token = api.getToken();
      ws.send(JSON.stringify({
        token,
        cols: term.cols,
        rows: term.rows,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "authenticated") {
        setStatus("connected");
      } else if (data.type === "output") {
        term.write(data.data);
      } else if (data.type === "error") {
        setError(data.message);
        setStatus("disconnected");
      }
    };

    ws.onclose = () => setStatus("disconnected");
    ws.onerror = () => setStatus("disconnected");

    // Forward terminal input to WebSocket
    term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }));
      }
    });

    // Handle resize
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        }));
      }
    });
    observer.observe(termContainerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, [connect]);

  const launchHermesTUI = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "hermes_tui" }));
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Terminal</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            status === "connected" ? "bg-emerald-500/10 text-emerald-400" :
            status === "connecting" ? "bg-amber-500/10 text-amber-400" :
            "bg-red-500/10 text-red-400"
          }`}>
            ● {status}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={launchHermesTUI}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hermes-gold/10 text-hermes-gold text-sm font-medium hover:bg-hermes-gold/20 transition-colors"
          >
            <Hexagon size={14} />
            Launch Hermes TUI
          </button>
          {status === "disconnected" && (
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-foreground text-sm font-medium hover:bg-muted transition-colors"
            >
              <TermIcon size={14} />
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Security Warning */}
      <div className="flex items-center gap-2 px-4 py-2 mb-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-400 text-xs">
        <AlertTriangle size={14} />
        <span className="font-medium">Full system shell access — actions are not sandboxed</span>
      </div>

      {/* Terminal */}
      <div className="flex-1 rounded-xl overflow-hidden border border-border/30 bg-[#0c0d11]">
        <div ref={termContainerRef} className="h-full terminal-container" />
      </div>

      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}
