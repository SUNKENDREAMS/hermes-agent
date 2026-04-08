"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Loader2,
  Zap,
} from "lucide-react";

interface CronJob {
  id: string;
  name: string;
  prompt: string;
  schedule_display: string;
  enabled: boolean;
  state: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  repeat: { times: number | null; completed: number };
}

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadJobs = async () => {
    try {
      const data = await api.get("/api/v1/cron/jobs?include_disabled=true");
      setJobs(data.jobs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadJobs(); }, []);

  const createJob = async () => {
    if (!newPrompt.trim() || !newSchedule.trim()) return;
    setCreating(true);
    try {
      await api.post("/api/v1/cron/jobs", {
        prompt: newPrompt,
        schedule: newSchedule,
        name: newName || undefined,
      });
      setNewPrompt("");
      setNewSchedule("");
      setNewName("");
      setShowCreate(false);
      loadJobs();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreating(false);
    }
  };

  const pauseJob = async (id: string) => {
    await api.post(`/api/v1/cron/jobs/${id}/pause`);
    loadJobs();
  };

  const resumeJob = async (id: string) => {
    await api.post(`/api/v1/cron/jobs/${id}/resume`);
    loadJobs();
  };

  const triggerJob = async (id: string) => {
    await api.post(`/api/v1/cron/jobs/${id}/trigger`);
    loadJobs();
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Delete this cron job?")) return;
    await api.delete(`/api/v1/cron/jobs/${id}`);
    loadJobs();
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cron Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {jobs.filter((j) => j.enabled).length} active,{" "}
            {jobs.filter((j) => !j.enabled).length} paused
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-hermes-gold/10 text-hermes-gold text-sm font-medium hover:bg-hermes-gold/20 transition-colors"
        >
          <Plus size={16} />
          New Job
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="glass-card rounded-xl p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold">Create Cron Job</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Name (optional)</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My daily check"
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border/50 text-sm mt-1 focus:outline-none focus:border-hermes-gold/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Schedule</label>
              <input
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                placeholder="every 2h, 0 9 * * *, 30m"
                className="w-full h-10 px-3 rounded-lg bg-muted/50 border border-border/50 text-sm mt-1 focus:outline-none focus:border-hermes-gold/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Prompt</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              placeholder="What should Hermes do on each run?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm mt-1 resize-none focus:outline-none focus:border-hermes-gold/50"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={createJob}
              disabled={creating || !newPrompt.trim() || !newSchedule.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-hermes-gold text-white text-sm font-medium disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
        </motion.div>
      )}

      {/* Jobs List */}
      <div className="space-y-3">
        {jobs.map((job) => (
          <motion.div
            key={job.id}
            layout
            className="glass-card rounded-xl p-5"
          >
            <div className="flex items-start gap-4">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                job.enabled ? "bg-emerald-500/10" : "bg-muted/50"
              }`}>
                <Clock size={18} className={job.enabled ? "text-emerald-400" : "text-muted-foreground"} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{job.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    job.state === "scheduled" ? "bg-emerald-500/10 text-emerald-400" :
                    job.state === "paused" ? "bg-amber-500/10 text-amber-400" :
                    "bg-muted/50 text-muted-foreground"
                  }`}>
                    {job.state}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  ⏱ {job.schedule_display}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">
                  {job.prompt}
                </p>

                <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                  <span>Next: {formatDate(job.next_run_at)}</span>
                  <span>Last: {formatDate(job.last_run_at)}</span>
                  {job.last_status && (
                    <span className="flex items-center gap-1">
                      {job.last_status === "ok" ? (
                        <CheckCircle2 size={10} className="text-emerald-400" />
                      ) : (
                        <XCircle size={10} className="text-red-400" />
                      )}
                      {job.last_status}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => triggerJob(job.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  title="Trigger now"
                >
                  <Zap size={14} />
                </button>
                {job.enabled ? (
                  <button
                    onClick={() => pauseJob(job.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                    title="Pause"
                  >
                    <Pause size={14} />
                  </button>
                ) : (
                  <button
                    onClick={() => resumeJob(job.id)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Resume"
                  >
                    <Play size={14} />
                  </button>
                )}
                <button
                  onClick={() => deleteJob(job.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}

        {jobs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock size={32} className="mx-auto mb-3 opacity-30" />
            <p>No cron jobs configured</p>
            <p className="text-xs mt-1">Create one to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
