"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import {
  Send,
  Plus,
  Bot,
  User,
  Wrench,
  ChevronDown,
  ChevronRight,
  Loader2,
  Brain,
  Copy,
  Check,
  RefreshCw,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  reasoning?: string;
}

interface ToolCall {
  tool: string;
  args: any;
  result?: string;
  loading?: boolean;
}

interface WSEvent {
  type: string;
  text?: string;
  tool?: string;
  args?: any;
  result?: string;
  message?: string;
  state?: string;
  timestamp?: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentToolsRef = useRef<ToolCall[]>([]);
  const currentReasoningRef = useRef<string>("");

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === "development" ? "8000" : window.location.port;
    const ws = new WebSocket(`${protocol}//${host}:${port}/ws/chat`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate
      const token = api.getToken();
      ws.send(JSON.stringify({ token }));
    };

    ws.onmessage = (event) => {
      const data: WSEvent = JSON.parse(event.data);

      switch (data.type) {
        case "authenticated":
          setWsStatus("connected");
          break;

        case "status":
          // Agent is thinking
          break;

        case "tool_start":
          currentToolsRef.current.push({
            tool: data.tool || "",
            args: data.args,
            loading: true,
          });
          // Update the last assistant message with tool calls
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, toolCalls: [...currentToolsRef.current] },
              ];
            }
            return prev;
          });
          break;

        case "tool_result":
          const tc = currentToolsRef.current.find(
            (t) => t.tool === data.tool && t.loading
          );
          if (tc) {
            tc.result = data.result;
            tc.loading = false;
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, toolCalls: [...currentToolsRef.current] },
              ];
            }
            return prev;
          });
          break;

        case "reasoning":
          currentReasoningRef.current += (data.text || "") + "\n";
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, reasoning: currentReasoningRef.current },
              ];
            }
            return prev;
          });
          break;

        case "response":
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: data.text || "",
                  toolCalls: [...currentToolsRef.current],
                  reasoning: currentReasoningRef.current || undefined,
                },
              ];
            }
            return prev;
          });
          break;

        case "done":
          setIsStreaming(false);
          currentToolsRef.current = [];
          currentReasoningRef.current = "";
          break;

        case "error":
          setIsStreaming(false);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: `Error: ${data.message}` },
              ];
            }
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: "assistant",
                content: `Error: ${data.message}`,
                timestamp: Date.now(),
              },
            ];
          });
          break;
      }
    };

    ws.onclose = () => {
      setWsStatus("disconnected");
      wsRef.current = null;
    };

    ws.onerror = () => {
      setWsStatus("disconnected");
    };
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWs]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      connectWs();
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);
    currentToolsRef.current = [];
    currentReasoningRef.current = "";

    wsRef.current.send(JSON.stringify({ type: "message", text }));
  };

  const newSession = () => {
    setMessages([]);
    wsRef.current?.send(JSON.stringify({ type: "new_session" }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleTool = (msgId: string, idx: number) => {
    const key = `${msgId}-${idx}`;
    setExpandedTools((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {wsStatus === "connected" ? (
              <span className="text-emerald-400">● Connected</span>
            ) : wsStatus === "connecting" ? (
              <span className="text-amber-400">● Connecting...</span>
            ) : (
              <span className="text-red-400">● Disconnected</span>
            )}
          </p>
        </div>
        <button
          onClick={newSession}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hermes-gold/10 text-hermes-gold text-sm font-medium hover:bg-hermes-gold/20 transition-colors"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-2 -mr-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
            <Bot size={48} className="text-hermes-gold mb-4" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm text-muted-foreground mt-1">
              Send a message or use a / command
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-lg bg-hermes-gold/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot size={16} className="text-hermes-gold" />
                </div>
              )}

              <div
                className={`max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-hermes-gold/10 border border-hermes-gold/20 rounded-2xl rounded-tr-sm px-4 py-3"
                    : "space-y-2"
                }`}
              >
                {/* Reasoning Trace */}
                {msg.reasoning && (
                  <div className="mb-2">
                    <button
                      onClick={() => toggleReasoning(msg.id)}
                      className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <Brain size={12} />
                      {expandedReasoning.has(msg.id) ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronRight size={12} />
                      )}
                      Reasoning
                    </button>
                    {expandedReasoning.has(msg.id) && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        className="mt-1 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/10 text-xs text-violet-300/80 font-mono overflow-hidden max-h-60 overflow-y-auto"
                      >
                        <pre className="whitespace-pre-wrap">{msg.reasoning}</pre>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Tool Calls */}
                {msg.toolCalls?.map((tc, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border/50 bg-muted/30 overflow-hidden mb-2"
                  >
                    <button
                      onClick={() => toggleTool(msg.id, idx)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                    >
                      {tc.loading ? (
                        <Loader2 size={12} className="animate-spin text-amber-400" />
                      ) : (
                        <Wrench size={12} className="text-emerald-400" />
                      )}
                      <span className="font-mono font-medium text-foreground/80">
                        {tc.tool}
                      </span>
                      {expandedTools.has(`${msg.id}-${idx}`) ? (
                        <ChevronDown size={12} className="ml-auto text-muted-foreground" />
                      ) : (
                        <ChevronRight size={12} className="ml-auto text-muted-foreground" />
                      )}
                    </button>
                    {expandedTools.has(`${msg.id}-${idx}`) && (
                      <div className="px-3 pb-2 space-y-1 border-t border-border/30">
                        <div className="mt-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Args
                          </span>
                          <pre className="mt-0.5 text-[11px] font-mono text-foreground/70 whitespace-pre-wrap max-h-32 overflow-auto">
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </div>
                        {tc.result && (
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Result
                            </span>
                            <pre className="mt-0.5 text-[11px] font-mono text-foreground/70 whitespace-pre-wrap max-h-40 overflow-auto">
                              {tc.result}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Message content */}
                {msg.content && (
                  <div className="relative group">
                    <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.role === "assistant" && msg.content && (
                      <button
                        onClick={() => copyText(msg.content, msg.id)}
                        className="absolute -right-8 top-0 p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                        title="Copy"
                      >
                        {copiedId === msg.id ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Loading indicator for empty assistant messages */}
                {msg.role === "assistant" &&
                  !msg.content &&
                  !msg.toolCalls?.length &&
                  !msg.reasoning && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  )}
              </div>

              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 mt-1">
                  <User size={16} className="text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border/30">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Hermes... (/ for commands)"
              rows={1}
              className="w-full resize-none rounded-xl bg-muted/50 border border-border/50 px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-hermes-gold/50 focus:ring-1 focus:ring-hermes-gold/20 transition-all max-h-32"
              disabled={isStreaming}
              style={{
                height: "auto",
                minHeight: "44px",
              }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 128) + "px";
              }}
            />
          </div>
          <button
            onClick={isStreaming ? undefined : sendMessage}
            disabled={!input.trim() && !isStreaming}
            className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              isStreaming
                ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                : input.trim()
                ? "bg-hermes-gold text-white shadow-lg shadow-hermes-gold/20 hover:bg-hermes-gold-light"
                : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {isStreaming ? <Square size={16} /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
