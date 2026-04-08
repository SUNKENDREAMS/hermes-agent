"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Puzzle, RefreshCw, CheckCircle2, ArrowRight, Sparkles, Wrench, Settings, Terminal } from "lucide-react";

export default function ExtensibilityPage() {
  const [summary, setSummary] = useState<any>(null);
  const [commands, setCommands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, cmdRes] = await Promise.allSettled([
        api.get("/api/v1/discovery/summary"),
        api.get("/api/v1/discovery/commands"),
      ]);
      if (sumRes.status === "fulfilled") setSummary(sumRes.value);
      if (cmdRes.status === "fulfilled") setCommands(cmdRes.value.commands || []);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted/30 rounded-xl shimmer" />)}
        </div>
      </div>
    );
  }

  const categories = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extensibility</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-discovered features from the live hermes-agent registry
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 text-foreground text-sm font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} />
          Rescan
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Slash Commands", value: summary.commands, icon: Terminal, color: "text-blue-400 bg-blue-500/10" },
            { label: "Tools", value: summary.tools, icon: Wrench, color: "text-emerald-400 bg-emerald-500/10" },
            { label: "Config Keys", value: summary.config_keys, icon: Settings, color: "text-violet-400 bg-violet-500/10" },
            { label: "Skills", value: summary.skills, icon: Sparkles, color: "text-hermes-gold bg-hermes-gold/10" },
          ].map((card) => (
            <div key={card.label} className="glass-card rounded-xl p-5">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${card.color} mb-3`}>
                <card.icon size={18} />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Command Registry */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Terminal size={16} className="text-hermes-gold" />
          Slash Command Registry
        </h2>
        {Object.entries(categories).map(([cat, cmds]) => (
          <div key={cat} className="glass-card rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted/20 border-b border-border/20">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</span>
            </div>
            <div className="divide-y divide-border/10">
              {(cmds as any[]).map((cmd: any) => (
                <div key={cmd.name} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-sm font-mono text-hermes-gold">/{cmd.name}</span>
                  {cmd.aliases?.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      ({cmd.aliases.map((a: string) => `/${a}`).join(", ")})
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex-1 truncate">{cmd.description}</span>
                  {cmd.args_hint && (
                    <span className="text-[10px] text-muted-foreground/50 font-mono">{cmd.args_hint}</span>
                  )}
                  {cmd.cli_only && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">CLI</span>}
                  {cmd.gateway_only && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">GW</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
