"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Radio, CheckCircle2, XCircle, Settings } from "lucide-react";

interface Platform {
  id: string;
  name: string;
  icon: string;
  configured: boolean;
}

export default function GatewayPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get("/api/v1/gateway/platforms"),
      api.get("/api/v1/gateway/status"),
    ]).then(([platsRes, statusRes]) => {
      if (platsRes.status === "fulfilled") setPlatforms(platsRes.value.platforms);
      if (statusRes.status === "fulfilled") setGatewayRunning(statusRes.value.running);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-muted/30 rounded-xl shimmer" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gateway</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gateway is {gatewayRunning ? (
            <span className="text-emerald-400">● running</span>
          ) : (
            <span className="text-muted-foreground">● not running</span>
          )}{" "}
          • {platforms.filter((p) => p.configured).length} platforms configured
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {platforms.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card rounded-xl p-5"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
              </div>
              {p.configured ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <XCircle size={16} className="text-muted-foreground/30" />
              )}
            </div>
            <div className="mt-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                p.configured ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/50 text-muted-foreground"
              }`}>
                {p.configured ? "Configured" : "Not configured"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
