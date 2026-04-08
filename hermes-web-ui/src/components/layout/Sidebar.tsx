"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Brain,
  Clock,
  Settings,
  Terminal,
  Radio,
  Users,
  Sparkles,
  Puzzle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Hexagon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/chat", label: "Chat", icon: MessageSquare, section: "main" },
  { href: "/terminal", label: "Terminal", icon: Terminal, section: "main" },
  { href: "/tools", label: "Tools & Config", icon: Wrench, section: "manage" },
  { href: "/skills", label: "Skills", icon: Sparkles, section: "manage" },
  { href: "/memory", label: "Memory & Insights", icon: Brain, section: "manage" },
  { href: "/cron", label: "Cron Jobs", icon: Clock, section: "manage" },
  { href: "/gateway", label: "Gateway", icon: Radio, section: "system" },
  { href: "/profiles", label: "Profiles", icon: Users, section: "system" },
  { href: "/extensibility", label: "Extensibility", icon: Puzzle, section: "system" },
  { href: "/admin", label: "Admin", icon: Settings, section: "system" },
];

const sections = {
  main: "Core",
  manage: "Manage",
  system: "System",
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl"
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4 border-b border-border/30">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hermes-gold/10 text-hermes-gold">
          <Hexagon size={22} strokeWidth={2.5} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex flex-col"
            >
              <span className="text-sm font-bold gradient-text tracking-tight">
                Hermes Agent
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">
                Web UI v0.1
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
        {Object.entries(sections).map(([key, label]) => (
          <div key={key}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
                >
                  {label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {navItems
                .filter((item) => item.section === key)
                .map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link href={item.href} key={item.href}>
                      <div
                        className={cn(
                          "sidebar-item group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          active
                            ? "active bg-hermes-gold/10 text-hermes-gold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          collapsed && "justify-center px-0"
                        )}
                      >
                        <item.icon
                          size={18}
                          className={cn(
                            "shrink-0 transition-colors",
                            active
                              ? "text-hermes-gold"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <AnimatePresence>
                          {!collapsed && (
                            <motion.span
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -4 }}
                              className="truncate"
                            >
                              {item.label}
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {/* Tooltip when collapsed */}
                        {collapsed && (
                          <div className="absolute left-full ml-2 px-2.5 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {item.label}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/30 p-2.5 space-y-1">
        {/* User info */}
        {user && !collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 mb-1">
            <div className="h-7 w-7 rounded-full bg-hermes-gold/20 flex items-center justify-center text-xs font-bold text-hermes-gold">
              {user.username[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.username}</p>
              <p className="text-[10px] text-muted-foreground">{user.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
