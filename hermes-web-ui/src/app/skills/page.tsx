"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Sparkles, Search, FolderOpen, FileText, ExternalLink } from "lucide-react";

interface Skill {
  command: string;
  name: string;
  description: string;
  path: string;
  category: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewingSkill, setViewingSkill] = useState<any>(null);

  useEffect(() => {
    api.get("/api/v1/skills").then((data) => {
      setSkills(data.skills || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(skills.map((s) => s.category))].sort();
  const filtered = skills.filter((s) => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.command.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !selectedCategory || s.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  const viewSkill = async (name: string) => {
    try {
      const data = await api.get(`/api/v1/skills/${encodeURIComponent(name)}`);
      setViewingSkill(data);
    } catch (e: any) {
      setViewingSkill({ error: e.message });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted/50 rounded-lg shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-xl shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {skills.length} skills installed across {categories.length} categories
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-border/50 text-sm focus:outline-none focus:border-hermes-gold/50 transition-all"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !selectedCategory ? "bg-hermes-gold/10 text-hermes-gold" : "text-muted-foreground hover:text-foreground bg-muted/30"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat ? "bg-hermes-gold/10 text-hermes-gold" : "text-muted-foreground hover:text-foreground bg-muted/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Skill Viewer Modal */}
      {viewingSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewingSkill(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Skill Content</h2>
              <button onClick={() => setViewingSkill(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80">
              {viewingSkill.content || viewingSkill.error || "No content"}
            </pre>
          </div>
        </div>
      )}

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((skill, i) => (
          <motion.div
            key={skill.command}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="glass-card rounded-xl p-5 cursor-pointer group"
            onClick={() => viewSkill(skill.command.replace("/", ""))}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-hermes-gold/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-hermes-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-hermes-gold transition-colors">
                  {skill.name || skill.command}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {skill.command}
                </p>
                {skill.description && (
                  <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-2">
                    {skill.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">
                {skill.category}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
          <p>No skills found</p>
        </div>
      )}
    </div>
  );
}
