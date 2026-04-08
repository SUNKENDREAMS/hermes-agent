"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Users, Plus, Trash2, Check, FolderOpen, Loader2 } from "lucide-react";

interface Profile {
  name: string;
  path: string;
  has_config: boolean;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState("default");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProfiles = async () => {
    try {
      const data = await api.get("/api/v1/profiles");
      setProfiles(data.profiles || []);
      setActiveProfile(data.active || "default");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfiles(); }, []);

  const createProfile = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/v1/profiles", { name: newName });
      setNewName("");
      loadProfiles();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteProfile = async (name: string) => {
    if (!confirm(`Delete profile "${name}"?`)) return;
    try {
      await api.delete(`/api/v1/profiles/${name}`);
      loadProfiles();
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return <div className="space-y-6"><div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profiles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Active: <span className="text-hermes-gold font-mono">{activeProfile}</span>
          {" "}• {profiles.length} profile{profiles.length !== 1 ? "s" : ""} configured
        </p>
      </div>

      {/* Create */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New profile name..."
          className="flex-1 h-10 px-4 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-hermes-gold/50"
          onKeyDown={(e) => e.key === "Enter" && createProfile()}
        />
        <button
          onClick={createProfile}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hermes-gold/10 text-hermes-gold text-sm font-medium hover:bg-hermes-gold/20 disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Create
        </button>
      </div>

      {/* Default profile */}
      <div className={`glass-card rounded-xl p-5 ${activeProfile === "default" ? "border-hermes-gold/20 glow-gold" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-hermes-gold/10 flex items-center justify-center">
            <Users size={18} className="text-hermes-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">default</p>
            <p className="text-xs text-muted-foreground font-mono">~/.hermes</p>
          </div>
          {activeProfile === "default" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-hermes-gold/10 text-hermes-gold flex items-center gap-1">
              <Check size={10} /> Active
            </span>
          )}
        </div>
      </div>

      {/* Profile list */}
      {profiles.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className={`glass-card rounded-xl p-5 ${activeProfile === p.name ? "border-hermes-gold/20 glow-gold" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center">
              <FolderOpen size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{p.path}</p>
            </div>
            {activeProfile === p.name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-hermes-gold/10 text-hermes-gold flex items-center gap-1">
                <Check size={10} /> Active
              </span>
            )}
            <button
              onClick={() => deleteProfile(p.name)}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
