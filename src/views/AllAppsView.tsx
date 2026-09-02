import { motion } from "framer-motion";
import { Plus, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { AppCard } from "../components/AppCard";
import { useUi } from "../components/ui";
import { useQyn } from "../lib/store";
import { cn } from "../lib/utils";

type FilterId = "all" | "favorites" | "unfiled" | string;

export function AllAppsView() {
  const { state } = useQyn();
  const { openAddApp } = useUi();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.apps.filter((a) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "favorites" && a.favorite) ||
        (filter === "unfiled" && a.folderId === null) ||
        (filter !== "favorites" && filter !== "unfiled" && a.folderId === filter);
      if (!matchesFilter) return false;
      if (!q) return true;
      return [a.name, a.subtitle, ...a.tags].filter(Boolean).some((p) => p!.toLowerCase().includes(q));
    });
  }, [state.apps, query, filter]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-7 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-frost-100">Applications</h1>
          <p className="mt-1 text-[13.5px] text-frost-400">
            {state.apps.length} in your environment ·{" "}
            <span className="text-frost-500">{state.apps.filter((a) => a.favorite).length} favorites</span>
          </p>
        </div>
        <button
          onClick={() => openAddApp()}
          className="flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus size={15} strokeWidth={2.2} /> Add application
        </button>
      </motion.div>

      {/* Search + filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="glass-soft flex h-9 w-full max-w-sm items-center gap-2.5 rounded-xl px-3.5">
          <Search size={14} className="shrink-0 text-frost-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, tag…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-frost-100 outline-none placeholder:text-frost-500/70"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip
            label="Favorites"
            icon={<Star size={11} />}
            active={filter === "favorites"}
            onClick={() => setFilter("favorites")}
          />
          <FilterChip label="Unfiled" active={filter === "unfiled"} onClick={() => setFilter("unfiled")} />
          {state.folders.map((f) => (
            <FilterChip
              key={f.id}
              label={f.name}
              dot={f.color}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
        </div>
      </div>

      {/* Grid */}
      {apps.length === 0 ? (
        <div className="glass-soft mt-8 rounded-2xl border-dashed p-12 text-center">
          <Search size={24} className="mx-auto text-frost-500/60" />
          <p className="mt-3 text-[14.5px] font-medium text-frost-300">No applications match</p>
          <p className="mt-1 text-[12.5px] text-frost-500">
            Try a different filter — or add it to your environment.
          </p>
          <button
            onClick={() => openAddApp()}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-accent-soft px-4 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
          >
            <Plus size={14} /> Add application
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {apps.map((app, i) => (
            <AppCard key={app.id} app={app} delay={Math.min(i * 0.03, 0.24)} showLastOpened />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  icon,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition",
        active
          ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-frost-100"
          : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8 hover:text-frost-200",
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {icon && <span className="text-accent">{icon}</span>}
      {label}
    </button>
  );
}