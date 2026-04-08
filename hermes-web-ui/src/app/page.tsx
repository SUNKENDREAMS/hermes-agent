"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import {
  MessageSquare,
  Cpu,
  Wrench,
  Clock,
  Sparkles,
  Activity,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Zap,
  Database,
  Shield,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  total_sessions: number;
  sessions_today: number;
  total_messages: number;
  total_tool_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  active_cron_jobs: number;
  installed_skills: number;
}

interface HealthInfo {
  hermes_available: boolean;
  hermes_version: string;
  hermes_home: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  href?: string;
}) {
  const inner = (
    <motion.div
      variants={itemVariants}
      className="glass-card rounded-xl p-5 group cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon size={20} />
        </div>
        {href && (
          <ArrowUpRight
            size={14}
            className="text-muted-foreground/0 group-hover:text-muted-foreground transition-all"
          />
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get("/api/v1/stats"),
      api.get("/api/v1/health"),
    ]).then(([statsResult, healthResult]) => {
      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hermes Agent {health?.hermes_version || ""} •{" "}
          {health?.hermes_available ? (
            <span className="text-emerald-400">● Online</span>
          ) : (
            <span className="text-destructive">● Offline</span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          label="Sessions Today"
          value={stats?.sessions_today || 0}
          icon={MessageSquare}
          color="bg-blue-500/10 text-blue-400"
          href="/memory"
        />
        <StatCard
          label="Total Sessions"
          value={formatNumber(stats?.total_sessions || 0)}
          icon={Database}
          color="bg-violet-500/10 text-violet-400"
          href="/memory"
        />
        <StatCard
          label="Total Messages"
          value={formatNumber(stats?.total_messages || 0)}
          icon={Activity}
          color="bg-emerald-500/10 text-emerald-400"
        />
        <StatCard
          label="Tool Calls"
          value={formatNumber(stats?.total_tool_calls || 0)}
          icon={Wrench}
          color="bg-amber-500/10 text-amber-400"
          href="/tools"
        />
        <StatCard
          label="Input Tokens"
          value={formatNumber(stats?.total_input_tokens || 0)}
          icon={TrendingUp}
          color="bg-cyan-500/10 text-cyan-400"
        />
        <StatCard
          label="Output Tokens"
          value={formatNumber(stats?.total_output_tokens || 0)}
          icon={Zap}
          color="bg-pink-500/10 text-pink-400"
        />
        <StatCard
          label="Active Cron Jobs"
          value={stats?.active_cron_jobs || 0}
          icon={Clock}
          color="bg-orange-500/10 text-orange-400"
          href="/cron"
        />
        <StatCard
          label="Installed Skills"
          value={stats?.installed_skills || 0}
          icon={Sparkles}
          color="bg-hermes-gold/10 text-hermes-gold"
          href="/skills"
        />
      </motion.div>

      {/* Quick Actions + System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="show"
          className="glass-card rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Zap size={16} className="text-hermes-gold" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "New Chat", href: "/chat", icon: MessageSquare, color: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" },
              { label: "Open Terminal", href: "/terminal", icon: Cpu, color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
              { label: "Browse Skills", href: "/skills", icon: Sparkles, color: "bg-hermes-gold/10 text-hermes-gold hover:bg-hermes-gold/20" },
              { label: "View Config", href: "/tools", icon: Wrench, color: "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20" },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 ${action.color} transition-all cursor-pointer`}
                >
                  <action.icon size={18} />
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* System Info */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="show"
          className="glass-card rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Shield size={16} className="text-hermes-gold" />
            System Info
          </h2>
          <div className="space-y-3">
            {[
              { label: "Hermes Version", value: health?.hermes_version || "—" },
              { label: "Hermes Home", value: health?.hermes_home || "—" },
              {
                label: "Agent Status",
                value: health?.hermes_available ? "Online" : "Offline",
              },
              { label: "Web UI Version", value: "0.1.0" },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
              >
                <span className="text-xs text-muted-foreground">
                  {row.label}
                </span>
                <span className="text-xs font-mono font-medium">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
