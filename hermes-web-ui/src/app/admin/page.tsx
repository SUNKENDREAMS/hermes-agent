"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Settings, Shield, FileText, RefreshCw, Server, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function AdminPage() {
  const { user } = useAuth();
  const [version, setVersion] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    api.get("/api/v1/version").then(setVersion).catch(() => {});
  }, []);

  const loadLogs = async () => {
    setLogLoading(true);
    try {
      const data = await api.get("/api/v1/logs?lines=200&log_type=agent");
      setLogs(data.lines || []);
    } finally {
      setLogLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System administration and configuration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Info */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Server size={16} className="text-hermes-gold" />
            System Information
          </h2>
          {version ? (
            <div className="space-y-3">
              {[
                { label: "Web UI Version", value: version.web_ui_version },
                { label: "Hermes Version", value: version.hermes_version },
                { label: "Python", value: version.python_version?.split(" ")[0] },
                { label: "Platform", value: version.platform },
                { label: "Hostname", value: version.hostname },
                { label: "Hermes Home", value: version.hermes_home },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-mono font-medium truncate max-w-[60%] text-right">{row.value || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading...</p>
          )}
        </div>

        {/* Current User */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Shield size={16} className="text-hermes-gold" />
            Authentication
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/20">
              <span className="text-xs text-muted-foreground">Username</span>
              <span className="text-xs font-mono font-medium">{user?.username}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/20">
              <span className="text-xs text-muted-foreground">Role</span>
              <span className="text-xs font-mono font-medium">{user?.role}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-muted-foreground">Auth Type</span>
              <span className="text-xs font-mono font-medium">Local JWT (SQLite)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <FileText size={16} className="text-hermes-gold" />
            Agent Logs
          </h2>
          <button
            onClick={loadLogs}
            disabled={logLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-xs text-foreground hover:bg-muted transition-colors"
          >
            {logLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Load Logs
          </button>
        </div>
        {logs.length > 0 ? (
          <div className="bg-[#0c0d11] rounded-lg p-4 max-h-[50vh] overflow-auto">
            <pre className="text-[11px] font-mono text-foreground/70 whitespace-pre-wrap">
              {logs.join("\n")}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Click "Load Logs" to view agent log output
          </p>
        )}
      </div>
    </div>
  );
}
