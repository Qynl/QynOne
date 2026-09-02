import { motion } from "framer-motion";
import { ArrowUp, ChevronRight, FileText, Folder, FolderHeart, HardDrive, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDesktop } from "../lib/desktop";
import type { DirEntry } from "../lib/desktop";
import { useQyn } from "../lib/store";
import { cn, timeAgo } from "../lib/utils";
import { useUi } from "../components/ui";

const HOME_ROOTS = ["Documents", "Downloads", "Desktop", "Pictures", "Videos", "Music"];

/* ------------------------------------------------------------------ */
/* Web-preview simulation — a tiny fake tree so the preview stays demoable */
/* ------------------------------------------------------------------ */

interface FakeEntry {
  name: string;
  isDir: boolean;
  children?: FakeEntry[];
}

const FAKE_TREE: FakeEntry[] = [
  {
    name: "Documents",
    isDir: true,
    children: [
      { name: "Project Notes.txt", isDir: false },
      { name: "Resume 2026.pdf", isDir: false },
      { name: "Budget 2026.xlsx", isDir: false },
      {
        name: "Unreal Projects",
        isDir: true,
        children: [
          { name: "WorldGenerator.cpp", isDir: false },
          { name: "Level1.umap", isDir: false },
          { name: "Readme.md", isDir: false },
        ],
      },
    ],
  },
  {
    name: "Downloads",
    isDir: true,
    children: [
      { name: "FC26-Setup.exe", isDir: false },
      { name: "wallpaper-dark.jpg", isDir: false },
      { name: "driver-update.zip", isDir: false },
    ],
  },
  {
    name: "Desktop",
    isDir: true,
    children: [{ name: "todo.txt", isDir: false }],
  },
  {
    name: "Pictures",
    isDir: true,
    children: [
      { name: "Screenshots", isDir: true, children: [{ name: "qynone-home.png", isDir: false }] },
      { name: "Wallpapers", isDir: true, children: [] },
    ],
  },
  { name: "Videos", isDir: true, children: [{ name: "clips", isDir: true, children: [] }] },
  { name: "Music", isDir: true, children: [] },
];

function findFakeEntries(segments: string[]): FakeEntry[] {
  let level: FakeEntry[] = FAKE_TREE;
  for (const seg of segments) {
    const next = level.find((e) => e.name === seg);
    if (!next?.isDir) return [];
    level = next.children ?? [];
  }
  return level;
}

/* ------------------------------------------------------------------ */

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

  /* Load entries whenever the directory changes. */
  useEffect(() => {
    if (!bridge) {
      const segments = path ? path.split("/") : [];
      setEntries(
        findFakeEntries(segments).map((e) => ({
          name: e.name,
          path: [...segments, e.name].join("/"),
          isDir: e.isDir,
          size: 0,
          mtimeMs: Date.now() - Math.round(Math.random() * 20) * 36e5,
        })),
      );
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

  const segments = useMemo(
    () => (path ? path.split(/[\\/]/).filter(Boolean) : []),
    [path],
  );

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

  const favorites = state.fileFavorites;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-7 md:px-8">
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

      <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Quick access rail */}
        <aside className="space-y-5">
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

          <div className="glass rounded-2xl p-3">
            <p className="px-2 pb-2 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
              Favorites
            </p>
            {favorites.length === 0 ? (
              <p className="px-2 pb-1 text-[12px] leading-relaxed text-frost-500">
                Star files or folders here and they’ll show up for one-click opening.
              </p>
            ) : (
              <div className="accent-scroll max-h-56 space-y-0.5 overflow-y-auto">
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

          {!bridge && (
            <p className="px-2 text-[11px] leading-relaxed text-frost-500">
              Preview mode shows a simulated folder tree. In the installed app this browses your real Documents,
              Downloads, Desktop and more — read-only at user level.
            </p>
          )}
        </aside>

        {/* Directory listing */}
        <div className="glass min-w-0 rounded-2xl p-4">
          {/* Breadcrumb + up */}
          <div className="flex items-center gap-2">
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

          {/* Entries */}
          <div className="mt-3">
            {loading ? (
              <p className="py-10 text-center text-[13px] text-frost-500">Reading directory…</p>
            ) : sorted.length === 0 ? (
              <div className="py-10 text-center">
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