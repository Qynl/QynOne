import { motion } from "framer-motion";
import { ArrowUp, ChevronRight, FileText, Folder, FolderHeart, HardDrive, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDesktop } from "../lib/desktop";
import type { DirEntry } from "../lib/desktop";
import { useQyn } from "../lib/store";
import { cn, timeAgo } from "../lib/utils";
import { useUi } from "../components/ui";

const HOME_ROOTS = ["Documents", "Downloads", "Desktop", "Pictures", "Videos", "Music"];

export function FileCenterView() {
  const { state, actions } = useQyn();
  const { toast } = useUi();
  const bridge = getDesktop();

  /* On desktop: the user's home folder (C:\Users\name). In preview: null. */
  const [home, setHome] = useState<string | null>(null);
  /* Current directory. Desktop: absolute path. Preview: "Documents/Unreal Projects". */
  const [path, setPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge.getHomeDir().then((h) => {
      if (alive && h) setHome(h);
    });
    return () => {
      alive = false;
    };
  }, [bridge]);

  /* Load entries whenever the directory changes (desktop app only —
     the web preview has no access to the OS, so it shows nothing fake). */
  useEffect(() => {
    if (!bridge) {
      setEntries(null);
      return;
    }
    if (!path) {
      if (!home) return;
      setLoading(true);
      bridge
        .listDir(home)
        .then((list) => setEntries(list))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    bridge
      .listDir(path)
      .then((list) => setEntries(list))
      .finally(() => setLoading(false));
  }, [bridge, path, home]);

  const segments = useMemo(() => (path ? path.split(/[\\/]/).filter(Boolean) : []), [path]);

  const rootLabel = useCallback(
    (p: string) => {
      if (bridge) {
        const base = home ? home.replace(/[\\/]+$/, "") : "";
        const rel = p.startsWith(base) ? p.slice(base.length).replace(/^[\\/]+/, "") : p;
        const segs = rel.split(/[\\/]/).filter(Boolean);
        return segs[0] ?? "Home";
      }
      return p;
    },
    [bridge, home],
  );

  function openEntry(entry: DirEntry) {
    if (entry.isDir) {
      setPath(entry.path);
      return;
    }
    if (bridge) {
      bridge.openPath(entry.path).then((res) => {
        if (res.ok) toast(`Opening ${entry.name}`);
        else toast(res.error ? `Couldn’t open — ${res.error}` : `Couldn’t open ${entry.name}`, { icon: <WarnIcon /> });
      });
    } else {
      toast(`In the desktop app this opens ${entry.name} on your PC`);
    }
  }

  function goUp() {
    if (segments.length <= 1) {
      setPath(null);
    } else {
      setPath(segments.slice(0, -1).join("/"));
    }
  }

  const sorted = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  }, [entries]);

  const webPreview = !bridge;

  const favorites = state.fileFavorites;

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1120px] flex-col px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-accent">File Center</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-frost-100 md:text-[30px]">
            Your files, inside QynOne.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-frost-400">
            Browse, open and favorite the folders you use every day — without leaving your environment.
          </p>
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 gap-5">
        {/* Quick access rail */}
        <aside className="hidden w-[220px] shrink-0 flex-col gap-5 md:flex">
          <div className="glass rounded-2xl p-3">
            <p className="px-2 pb-2 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
              Quick access
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => setPath(null)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                  path === null ? "bg-accent-soft text-frost-100" : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
                )}
              >
                <HardDrive size={14} className={path === null ? "text-accent" : "text-frost-500"} />
                This PC
              </button>
              {HOME_ROOTS.map((name) => {
                const active = segments[0] === name && path !== null;
                return (
                  <button
                    key={name}
                    onClick={() => setPath(bridge && home ? `${home.replace(/[\\/]+$/, "")}\\${name}` : name)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                      active ? "bg-accent-soft text-frost-100" : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
                    )}
                  >
                    <Folder size={14} className={active ? "text-accent" : "text-frost-500"} />
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-3">
            <p className="px-2 pb-2 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
              Favorites
            </p>
            {favorites.length === 0 ? (
              <p className="px-2 pb-1 text-[12px] leading-relaxed text-frost-500">
                Star files or folders here and they’ll show up for one-click opening.
              </p>
            ) : (
              <div className="accent-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-1">
                {favorites.map((fav) => (
                  <div key={fav} className="group flex items-center">
                    <button
                      onClick={() => {
                        if (bridge) {
                          bridge.openPath(fav).then((res) => {
                            if (res.ok) toast("Opening…");
                            else toast(res.error ? `Couldn’t open — ${res.error}` : "Couldn’t open", { icon: <WarnIcon /> });
                          });
                        } else {
                          toast(`In the desktop app this opens ${fav}`);
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-white/5"
                    >
                      <Star size={12} className="shrink-0 text-[var(--accent)]" fill="currentColor" />
                      <span className="truncate text-[12.5px] font-medium text-frost-200">{rootLabel(fav)}</span>
                    </button>
                    <button
                      onClick={() => actions.toggleFileFavorite(fav)}
                      title="Remove favorite"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-frost-600 opacity-0 transition hover:bg-white/8 hover:text-frost-300 group-hover:opacity-100"
                    >
                      <FolderHeart size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {webPreview && (
            <p className="px-2 text-[11px] leading-relaxed text-frost-500">
              File Center reads your real folders in the installed QynOne app — read-only, user level. The web
              preview has no access to the OS, so it shows nothing instead of a simulation.
            </p>
          )}
        </aside>

        {/* Directory listing — the page never scrolls, only the file list does */}
        <div className="glass flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl p-4">
          {/* Breadcrumb + up */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={goUp}
              disabled={path === null}
              title="Go up"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-300 transition hover:bg-white/8 hover:text-frost-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
            <div className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setPath(null)}
                className={cn(
                  "shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold transition",
                  path === null ? "text-frost-100" : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
                )}
              >
                This PC
              </button>
              {segments.map((seg, i) => (
                <span key={`${seg}-${i}`} className="flex shrink-0 items-center gap-1">
                  <ChevronRight size={13} className="text-frost-600" />
                  <button
                    onClick={() => {
                      if (bridge && home) {
                        const base = home.replace(/[\\/]+$/, "");
                        setPath([base, ...segments.slice(0, i + 1)].join("\\"));
                      } else {
                        setPath(segments.slice(0, i + 1).join("/"));
                      }
                    }}
                    className={cn(
                      "max-w-[180px] truncate rounded-lg px-2 py-1 text-[13px] font-medium transition",
                      i === segments.length - 1
                        ? "text-frost-100"
                        : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
                    )}
                  >
                    {seg}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Entries — the only scrollable part of this page */}
          <div className="accent-scroll mt-3 min-h-0 flex-1 overflow-y-auto">
            {webPreview ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center py-8 text-center">
                <HardDrive size={26} className="mx-auto text-frost-500/50" />
                <p className="mt-3 text-[14px] font-semibold text-frost-200">Your files live in the installed app</p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-frost-500">
                  Install QynOne on your PC and this becomes a real browser for Documents, Downloads, Desktop,
                  Pictures and more — nothing here is simulated.
                </p>
              </div>
            ) : loading ? (
              <div className="flex h-full min-h-[180px] items-center justify-center">
                <p className="text-[13px] text-frost-500">Reading directory…</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-center">
                <Folder size={22} className="mx-auto text-frost-500/50" />
                <p className="mt-2 text-[13px] text-frost-400">This folder is empty</p>
              </div>
            ) : (
              <ul className="divide-y divide-white/[0.04]">
                {sorted.map((entry, i) => {
                  const fav = favorites.includes(entry.path);
                  return (
                    <motion.li
                      key={entry.path}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
                    >
                      <div className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/4">
                        <button onClick={() => openEntry(entry)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border",
                              entry.isDir
                                ? "border-[color-mix(in_srgb,var(--accent)_25%,transparent)] bg-accent-soft text-accent"
                                : "border-white/8 bg-white/4 text-frost-400",
                            )}
                          >
                            {entry.isDir ? <Folder size={16} /> : <FileText size={15} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-frost-100">
                              {entry.name}
                            </span>
                            <span className="block truncate text-[11.5px] text-frost-500">
                              {entry.isDir ? "Folder" : formatSize(entry.size)} · {timeAgo(entry.mtimeMs)}
                            </span>
                          </span>
                        </button>
                        <button
                          onClick={() => actions.toggleFileFavorite(entry.path)}
                          title={fav ? "Remove favorite" : "Add favorite"}
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition",
                            fav
                              ? "text-[var(--accent)]"
                              : "text-frost-600 opacity-0 hover:bg-white/8 hover:text-frost-300 group-hover:opacity-100",
                          )}
                        >
                          <Star size={14} fill={fav ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WarnIcon() {
  return <span className="text-amber-300">⚠</span>;
}