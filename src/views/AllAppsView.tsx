import { motion } from "framer-motion";
import { Check, Gamepad2, Laptop, Plus, RefreshCw, Search, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCard } from "../components/AppCard";
import { useUi } from "../components/ui";
import { getDesktop } from "../lib/desktop";
import type { ShortcutHit } from "../lib/desktop";
import { useQyn } from "../lib/store";
import { cn } from "../lib/utils";

type FilterId = "all" | "favorites" | "unfiled" | string;
type DetectedFilter = "all" | "games" | "apps";

const GAME_WORDS = /\b(game|games|launcher|steam|epic|xbox|riot|battle\.net|minecraft|roblox|fortnite|valorant|overwatch|elden ring|cyberpunk|witcher|gta|apex|fall guys|league of legends|rocket league|terraria|stardew|unreal)\b/i;

function looksLikeGame(name: string): boolean {
  return GAME_WORDS.test(name);
}

export function AllAppsView() {
  const { state, actions } = useQyn();
  const { openAddApp, toast } = useUi();
  const desktop = getDesktop();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [detected, setDetected] = useState<ShortcutHit[]>([]);
  const [detectedQuery, setDetectedQuery] = useState("");
  const [detectedFilter, setDetectedFilter] = useState<DetectedFilter>("all");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  const scan = useCallback(async () => {
    if (!desktop) return;
    setScanning(true);
    try {
      const hits = await desktop.findShortcuts("");
      setDetected(hits);
      setSelectedPaths([]);
      setScanComplete(true);
    } catch {
      setDetected([]);
      setScanComplete(true);
    } finally {
      setScanning(false);
    }
  }, [desktop]);

  useEffect(() => {
    void scan();
  }, [scan]);

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

  const newDetected = useMemo(() => {
    const knownPaths = new Set(
      state.apps
        .map((app) => app.launchUri?.trim().toLowerCase())
        .filter((path): path is string => Boolean(path)),
    );
    const q = detectedQuery.trim().toLowerCase();
    return detected.filter((hit) => {
      if (knownPaths.has(hit.path.toLowerCase())) return false;
      if (q && !hit.name.toLowerCase().includes(q)) return false;
      const game = looksLikeGame(hit.name);
      return detectedFilter === "all" || (detectedFilter === "games" ? game : !game);
    });
  }, [detected, detectedFilter, detectedQuery, state.apps]);

  const selectedVisibleCount = newDetected.filter((hit) => selectedPaths.includes(hit.path)).length;

  function toggleSelected(path: string) {
    setSelectedPaths((paths) => (paths.includes(path) ? paths.filter((item) => item !== path) : [...paths, path]));
  }

  function addDetected(hit: ShortcutHit) {
    const game = looksLikeGame(hit.name);
    actions.addApp({
      name: hit.name,
      subtitle: game ? "Game · detected on this PC" : "Detected on this PC",
      icon: game ? "gamepad2" : "appWindow",
      color: game ? "#7b8cff" : "#5b8cff",
      launchUri: hit.path,
      favorite: false,
      tags: ["detected", ...(game ? ["game"] : [])],
    });
  }

  function addSelected() {
    const chosen = detected.filter((hit) => selectedPaths.includes(hit.path));
    if (chosen.length === 0) return;
    chosen.forEach(addDetected);
    setSelectedPaths([]);
    toast(`Added ${chosen.length} item${chosen.length === 1 ? "" : "s"} to QynOne`);
  }

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
            {state.apps.length} in your environment · <span className="text-frost-500">{state.apps.filter((a) => a.favorite).length} favorites</span>
          </p>
        </div>
        <button
          onClick={() => openAddApp()}
          className="flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus size={15} strokeWidth={2.2} /> Add manually
        </button>
      </motion.div>

      {desktop && (
        <section className="glass-soft mt-6 rounded-2xl p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                <Laptop size={17} />
              </span>
              <div>
                <h2 className="text-[14px] font-semibold text-frost-100">Found on this PC</h2>
                <p className="mt-0.5 text-[12px] text-frost-500">Real Start Menu and Desktop shortcuts. Nothing is moved or changed.</p>
              </div>
            </div>
            <button
              onClick={() => void scan()}
              disabled={scanning}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-[11.5px] font-medium text-frost-300 transition hover:bg-white/10 hover:text-frost-100 disabled:opacity-50"
            >
              <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
              {scanning ? "Scanning…" : "Scan again"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3">
              <Search size={14} className="shrink-0 text-frost-500" />
              <input
                value={detectedQuery}
                onChange={(event) => setDetectedQuery(event.target.value)}
                placeholder="Filter detected apps and games…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-frost-100 outline-none placeholder:text-frost-600"
              />
            </div>
            <DetectedChip label="All" active={detectedFilter === "all"} onClick={() => setDetectedFilter("all")} />
            <DetectedChip label="Games" icon={<Gamepad2 size={12} />} active={detectedFilter === "games"} onClick={() => setDetectedFilter("games")} />
            <DetectedChip label="Apps" icon={<Laptop size={12} />} active={detectedFilter === "apps"} onClick={() => setDetectedFilter("apps")} />
          </div>

          {scanning && <p className="mt-4 text-[12px] text-frost-500">Reading your user-level Windows shortcuts…</p>}
          {!scanning && scanComplete && newDetected.length === 0 && (
            <p className="mt-4 text-[12px] text-frost-500">
              No new shortcuts found. You can add a custom `.exe`, `.lnk`, game launcher, file, or website with “Add manually.”
            </p>
          )}
          {!scanning && newDetected.length > 0 && (
            <>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-frost-500">{newDetected.length} new item{newDetected.length === 1 ? "" : "s"} available</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPaths(selectedVisibleCount === newDetected.length ? [] : newDetected.map((hit) => hit.path))}
                    className="text-[11px] font-medium text-frost-400 transition hover:text-frost-100"
                  >
                    {selectedVisibleCount === newDetected.length ? "Clear selection" : "Select all"}
                  </button>
                  {selectedVisibleCount > 0 && (
                    <button
                      onClick={addSelected}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-[11.5px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
                    >
                      <Plus size={12} /> Add selected ({selectedVisibleCount})
                    </button>
                  )}
                </div>
              </div>
              <div className="accent-scroll mt-2 grid max-h-56 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {newDetected.map((hit) => {
                  const game = looksLikeGame(hit.name);
                  const selected = selectedPaths.includes(hit.path);
                  return (
                    <div key={hit.path} className={cn("flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition", selected ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft" : "border-white/7 bg-white/3 hover:bg-white/6")}>
                      <button onClick={() => toggleSelected(hit.path)} className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition", selected ? "border-accent bg-accent text-white" : "border-white/10 text-transparent hover:border-white/25")} aria-label={selected ? `Deselect ${hit.name}` : `Select ${hit.name}`}>
                        <Check size={13} strokeWidth={3} />
                      </button>
                      <button onClick={() => { addDetected(hit); toast(`Added ${hit.name} to QynOne`); }} className="min-w-0 flex-1 text-left">
                        <span className="flex items-center gap-1.5 truncate text-[12px] font-medium text-frost-200">
                          {game ? <Gamepad2 size={12} className="shrink-0 text-accent" /> : <Laptop size={12} className="shrink-0 text-frost-500" />}
                          {hit.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-frost-600">{hit.path}</span>
                      </button>
                      <Plus size={13} className="shrink-0 text-frost-600" />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Search + filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="glass-soft flex h-9 w-full max-w-sm items-center gap-2.5 rounded-xl px-3.5">
          <Search size={14} className="shrink-0 text-frost-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter your library…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-frost-100 outline-none placeholder:text-frost-500/70"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="Favorites" icon={<Star size={11} />} active={filter === "favorites"} onClick={() => setFilter("favorites")} />
          <FilterChip label="Unfiled" active={filter === "unfiled"} onClick={() => setFilter("unfiled")} />
          {state.folders.map((f) => (
            <FilterChip key={f.id} label={f.name} dot={f.color} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}
        </div>
      </div>

      {/* Grid */}
      {apps.length === 0 ? (
        <div className="glass-soft mt-8 rounded-2xl border-dashed p-12 text-center">
          <Search size={24} className="mx-auto text-frost-500/60" />
          <p className="mt-3 text-[14.5px] font-medium text-frost-300">No applications match</p>
          <p className="mt-1 text-[12.5px] text-frost-500">Try a different filter — or add it to your environment.</p>
          <button onClick={() => openAddApp()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-accent-soft px-4 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]">
            <Plus size={14} /> Add manually
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

function DetectedChip({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition", active ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-frost-100" : "border-white/8 bg-white/4 text-frost-500 hover:bg-white/8 hover:text-frost-200")}>
      {icon && <span className="text-accent">{icon}</span>}
      {label}
    </button>
  );
}

function FilterChip({ label, active, onClick, icon, dot }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode; dot?: string }) {
  return (
    <button onClick={onClick} className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium transition", active ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-frost-100" : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8 hover:text-frost-200")}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {icon && <span className="text-accent">{icon}</span>}
      {label}
    </button>
  );
}
