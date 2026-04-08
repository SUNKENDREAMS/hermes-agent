"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Brain, Search, MessageSquare, BarChart3, DollarSign, Calendar } from "lucide-react";

type TabType = "sessions" | "insights" | "memory";

export default function MemoryPage() {
  const [tab, setTab] = useState<TabType>("sessions");
  const [sessions, setSessions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === "sessions") {
        const data = await api.get("/api/v1/sessions?limit=50");
        setSessions(data.sessions || []);
      } else if (tab === "insights") {
        const data = await api.get("/api/v1/insights?days=30");
        setInsights(data);
      } else if (tab === "memory") {
        const data = await api.get("/api/v1/memory");
        setMemories(data.memories || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const searchSessions = async () => {
    if (!searchQuery.trim()) return;
    try {
      const data = await api.get(`/api/v1/sessions/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data.results || []);
    } catch (e) {
      setSearchResults([]);
    }
  };

  const viewSession = async (id: string) => {
    try {
      const data = await api.get(`/api/v1/sessions/${id}`);
      setSelectedSession(data);
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Memory & Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse sessions, search history, view usage analytics
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit">
        {[
          { id: "sessions" as TabType, label: "Sessions", icon: MessageSquare },
          { id: "insights" as TabType, label: "Insights", icon: BarChart3 },
          { id: "memory" as TabType, label: "Memory Store", icon: Brain },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? "bg-hermes-gold/10 text-hermes-gold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Session Viewer Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSession(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold">{selectedSession.session?.title || "Session"}</h2>
                <p className="text-xs text-muted-foreground">{selectedSession.session?.id}</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              {selectedSession.messages?.map((msg: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg text-sm ${
                  msg.role === "user" ? "bg-hermes-gold/5 border border-hermes-gold/10" :
                  msg.role === "assistant" ? "bg-muted/30" : "bg-muted/10"
                }`}>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">{msg.role}</span>
                  <p className="mt-1 text-foreground/80 whitespace-pre-wrap text-xs">{msg.content?.slice(0, 2000)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {tab === "sessions" && (
        <div className="space-y-4">
          {/* FTS5 Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchSessions()}
                placeholder="Full-text search across all sessions..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-hermes-gold/50"
              />
            </div>
            <button onClick={searchSessions} className="px-4 py-2 rounded-xl bg-hermes-gold/10 text-hermes-gold text-sm font-medium hover:bg-hermes-gold/20">
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Search Results</h3>
              {searchResults.map((r: any, i: number) => (
                <div key={i} className="glass-card rounded-xl p-4 cursor-pointer hover:bg-muted/50" onClick={() => viewSession(r.session_id)}>
                  <p className="text-xs text-muted-foreground font-mono">{r.session_id}</p>
                  <p className="text-sm mt-1">{r.snippet?.slice(0, 200)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Session list */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-muted/30 rounded-xl shimmer" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <div key={s.id} className="glass-card rounded-xl p-4 cursor-pointer" onClick={() => viewSession(s.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{s.title || s.preview || s.id.slice(0, 12)}</p>
                      <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span>{s.source}</span>
                        <span>{s.model || "—"}</span>
                        <span>{s.message_count} msgs</span>
                        <span>{formatDate(s.started_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insights Tab */}
      {tab === "insights" && insights && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
              <p className="text-2xl font-bold mt-1">${insights.cost?.estimated_usd?.toFixed(2) || "0.00"}</p>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs text-muted-foreground">Sources</p>
              <div className="mt-2 space-y-1">
                {Object.entries(insights.by_source || {}).map(([src, cnt]: [string, any]) => (
                  <div key={src} className="flex items-center justify-between text-xs">
                    <span>{src}</span><span className="font-mono">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-xl p-5">
              <p className="text-xs text-muted-foreground">Top Models</p>
              <div className="mt-2 space-y-1">
                {insights.by_model?.slice(0, 5).map((m: any) => (
                  <div key={m.model} className="flex items-center justify-between text-xs">
                    <span className="truncate">{m.model}</span><span className="font-mono">{m.sessions}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Memory Tab */}
      {tab === "memory" && (
        <div className="glass-card rounded-xl p-6">
          {memories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No memories stored yet</p>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap max-h-[60vh] overflow-auto">
              {JSON.stringify(memories, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
