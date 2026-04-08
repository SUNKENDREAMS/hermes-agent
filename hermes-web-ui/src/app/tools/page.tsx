"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import {
  Wrench,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Settings,
  Key,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Search,
} from "lucide-react";

interface Tool {
  name: string;
  toolset: string;
  description: string;
  emoji: string;
  requires_env: string[];
  available: boolean;
}

interface EnvVar {
  key: string;
  description: string;
  category: string;
  is_secret: boolean;
  is_set: boolean;
  masked_value: string;
}

type TabType = "tools" | "config" | "env";

export default function ToolsPage() {
  const [tab, setTab] = useState<TabType>("tools");
  const [tools, setTools] = useState<Tool[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [configSchema, setConfigSchema] = useState<any>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedToolsets, setExpandedToolsets] = useState<Set<string>>(new Set());
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [toolsRes, configRes, schemaRes, envRes] = await Promise.allSettled([
        api.get("/api/v1/tools"),
        api.get("/api/v1/config"),
        api.get("/api/v1/config/schema"),
        api.get("/api/v1/config/env"),
      ]);
      if (toolsRes.status === "fulfilled") setTools(toolsRes.value.tools);
      if (configRes.status === "fulfilled") setConfig(configRes.value.config);
      if (schemaRes.status === "fulfilled") setConfigSchema(schemaRes.value.schema);
      if (envRes.status === "fulfilled") setEnvVars(envRes.value.env_vars);
    } finally {
      setLoading(false);
    }
  };

  // Group tools by toolset
  const toolsets = tools.reduce((acc, tool) => {
    if (!acc[tool.toolset]) acc[tool.toolset] = [];
    acc[tool.toolset].push(tool);
    return acc;
  }, {} as Record<string, Tool[]>);

  const filteredToolsets = Object.entries(toolsets).filter(([name, tools]) =>
    search
      ? name.toLowerCase().includes(search.toLowerCase()) ||
        tools.some((t) => t.name.toLowerCase().includes(search.toLowerCase()))
      : true
  );

  const toggleToolset = (name: string) => {
    setExpandedToolsets((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const tabs = [
    { id: "tools" as TabType, label: "Tools", icon: Wrench },
    { id: "config" as TabType, label: "Config", icon: Settings },
    { id: "env" as TabType, label: "API Keys", icon: Key },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tools & Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {tools.length} tools registered across{" "}
          {Object.keys(toolsets).length} toolsets
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-hermes-gold/10 text-hermes-gold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tools Tab */}
      {tab === "tools" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-hermes-gold/50 transition-all"
            />
          </div>

          {filteredToolsets.map(([name, tsTools]) => {
            const allAvailable = tsTools.every((t) => t.available);
            const expanded = expandedToolsets.has(name);
            return (
              <motion.div
                key={name}
                layout
                className="glass-card rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleToolset(name)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors"
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="font-semibold text-sm">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tsTools.length} tool{tsTools.length !== 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {allAvailable ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : (
                      <XCircle size={14} className="text-red-400" />
                    )}
                    <span className={`text-xs ${allAvailable ? "text-emerald-400" : "text-red-400"}`}>
                      {allAvailable ? "Available" : "Missing deps"}
                    </span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border/30 divide-y divide-border/20">
                    {tsTools.map((tool) => (
                      <div key={tool.name} className="px-4 py-3 flex items-start gap-3">
                        <span className="text-lg shrink-0">{tool.emoji || "⚡"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-medium">{tool.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {tool.description}
                          </p>
                          {tool.requires_env.length > 0 && (
                            <div className="flex gap-1.5 mt-1.5 flex-wrap">
                              {tool.requires_env.map((env) => (
                                <span key={env} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-mono">
                                  {env}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {tool.available ? (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-1" />
                        ) : (
                          <XCircle size={14} className="text-red-400 shrink-0 mt-1" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Config Tab */}
      {tab === "config" && config && (
        <div className="glass-card rounded-xl p-6">
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap max-h-[60vh] overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      )}

      {/* Env Vars Tab */}
      {tab === "env" && (
        <div className="space-y-3">
          {["provider", "tool", "messaging", "setting"].map((cat) => {
            const catVars = envVars.filter((v) => v.category === cat);
            if (catVars.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {cat}
                </h3>
                <div className="space-y-2">
                  {catVars.map((v) => (
                    <div key={v.key} className="glass-card rounded-xl p-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-medium">{v.key}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {v.is_set ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Set</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">Not set</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
