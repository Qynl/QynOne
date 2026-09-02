import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  CornerDownLeft,
  FileSearch,
  FileText,
  FolderOpen,
  Layers,
  LayoutGrid,
  MonitorCog,
  Plus,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDesktop } from "../lib/desktop";
import type { SearchHit } from "../lib/desktop";
import { useQyn } from "../lib/store";
import type { AppItem, Folder, ViewId } from "../lib/types";
import { useVault } from "../lib/vault";
import { cn } from "../lib/utils";
import { AppIcon } from "./AppIcon";
import { useLaunch, useUi } from "./ui";

interface Result {
  key: string;
  group: "Applications" | "Folders" | "Workspaces" | "Notes" | "Files" | "Actions";
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  run: () => void;
}

/** Windows system pages opened through the OS — shown only in the desktop app. */
const SYSTEM_ACTIONS: Array<{ label: string; uri: string; words: string[]; hint: string }> = [
  { label: "Open sound settings", uri: "ms-settings:sound", words: ["volume", "sound", "audio", "mixer"], hint: "volume, audio" },
  { label: "Open display settings", uri: "ms-settings:display", words: ["display", "screen", "monitor", "resolution"], hint: "screen, resolution" },
  { label: "Open network settings", uri: "ms-settings:network-status", words: ["wifi", "network", "internet", "ethernet"], hint: "wifi, internet" },
  { label: "Open bluetooth settings", uri: "ms-settings:bluetooth", words: ["bluetooth", "pair"], hint: "pair devices" },
  { label: "Open storage settings", uri: "ms-settings:storage", words: ["storage", "disk", "space"], hint: "disk space" },
  { label: "Open Windows Update", uri: "ms-settings:windowsupdate", words: ["update", "windows update"], hint: "install updates" },
  { label: "Open personalization", uri: "ms-settings:personalization", words: ["theme", "personalize", "wallpaper", "colors"], hint: "themes, colors" },
  { label: "Open apps list", uri: "ms-settings:appsfeatures", words: ["uninstall", "installed apps", "apps list"], hint: "uninstall apps" },
];

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onOpenFolder,
  onOpenNote,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: ViewId) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenNote: (name: string) => void;
}) {
  const { state } = useQyn();
  const vault = useVault();
  const { openAddApp, openFolderModal } = useUi();
  const launch = useLaunch();
  const bridge = getDesktop();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [fileHits, setFileHits] = useState<SearchHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Debounced real file search on the desktop. */
  useEffect(() => {
    if (!open || !bridge) return;
    const q = query.trim();
    if (q.length < 2) {
      setFileHits([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      bridge
        .searchFiles(q)
        .then((hits) => {
          if (alive) setFileHits(hits);
        })
        .catch(() => {});
    }, 260);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, open, bridge]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setFileHits([]);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (...parts: Array<string | undefined>) =>
      q.length === 0 ||
      parts
        .filter(Boolean)
        .some((p) => p!.toLowerCase().includes(q));

    const apps: Result[] = state.apps
      .filter((a: AppItem) => match(a.name, a.subtitle, ...a.tags))
      .slice(0, 8)
      .map((a) => ({
        key: `app-${a.id}`,
        group: "Applications" as const,
        icon: <AppIcon icon={a.icon} color={a.color} size={32} rounded="rounded-[9px]" />,
        label: a.name,
        hint: a.subtitle,
        run: () => {
          onClose();
          launch(a);
        },
      }));

    const folders: Result[] = state.folders
      .filter((f: Folder) => match(f.name))
      .slice(0, 5)
      .map((f) => ({
        key: `folder-${f.id}`,
        group: "Folders" as const,
        icon: <AppIcon icon={f.icon} color={f.color} size={32} rounded="rounded-[9px]" />,
        label: f.name,
        hint: `${state.apps.filter((a) => a.folderId === f.id).length} items`,
        run: () => {
          onClose();
          onOpenFolder(f.id);
        },
      }));

    const workspaces: Result[] = state.workspaces
      .filter((w) => match(w.name))
      .slice(0, 4)
      .map((w) => {
        const count = w.itemIds.length;
        return {
          key: `ws-${w.id}`,
          group: "Workspaces" as const,
          icon: <AppIcon icon={w.icon} color={w.color} size={32} rounded="rounded-[9px]" />,
          label: w.name,
          hint: `Launch ${count} application${count === 1 ? "" : "s"} together`,
          run: () => {
            onClose();
            const items = w.itemIds.map((id) => state.apps.find((a) => a.id === id)).filter(Boolean);
            items.forEach((app, i) => window.setTimeout(() => launch(app!), i * 450));
          },
        };
      });

    const files: Result[] = fileHits
      .filter((f) => match(f.name))
      .slice(0, 6)
      .map((f) => ({
        key: `file-${f.path}`,
        group: "Files" as const,
        icon: <ActionGlyph><FileSearch size={14} /></ActionGlyph>,
        label: f.name,
        hint: f.path,
        run: () => {
          onClose();
          bridge?.openPath(f.path).then((res) => {
            if (!res.ok) console.warn(res.error);
          });
        },
      }));

    const notes: Result[] = (q.length >= 2 ? vault.searchNotes(q).slice(0, 6) : []).map((n) => ({
      key: `note-${n.id}`,
      group: "Notes" as const,
      icon: <ActionGlyph><FileText size={14} /></ActionGlyph>,
      label: n.name,
      hint: `${n.folder || "vault root"}${n.tags.length ? ` · ${n.tags.map((t) => `#${t}`).join(" ")}` : ""}`,
      run: () => {
        onClose();
        onOpenNote(n.name);
      },
    }));

    const actions: Result[] = [
      {
        key: "act-add-app",
        group: "Actions" as const,
        icon: <ActionGlyph><Plus size={15} /></ActionGlyph>,
        label: "Add an application",
        run: () => {
          onClose();
          openAddApp();
        },
      },
      {
        key: "act-profile",
        group: "Actions" as const,
        icon: <ActionGlyph><User size={15} /></ActionGlyph>,
        label: "Open your profile",
        run: () => {
          onClose();
          onNavigate("profile");
        },
      },
      {
        key: "act-new-folder",
        group: "Actions" as const,
        icon: <ActionGlyph><FolderOpen size={15} /></ActionGlyph>,
        label: "Create a virtual folder",
        run: () => {
          onClose();
          openFolderModal();
        },
      },
      {
        key: "act-workspaces",
        group: "Actions" as const,
        icon: <ActionGlyph><Layers size={15} /></ActionGlyph>,
        label: "Open workspaces",
        run: () => {
          onClose();
          onNavigate("workspaces");
        },
      },
      {
        key: "act-calendar",
        group: "Actions" as const,
        icon: <ActionGlyph><CalendarDays size={15} /></ActionGlyph>,
        label: "Open the calendar",
        run: () => {
          onClose();
          onNavigate("calendar");
        },
      },
      {
        key: "act-files",
        group: "Actions" as const,
        icon: <ActionGlyph><FolderOpen size={15} /></ActionGlyph>,
        label: "Open file center",
        run: () => {
          onClose();
          onNavigate("files");
        },
      },
      {
        key: "act-system",
        group: "Actions" as const,
        icon: <ActionGlyph><MonitorCog size={15} /></ActionGlyph>,
        label: "Open system center",
        run: () => {
          onClose();
          onNavigate("system");
        },
      },
      {
        key: "act-vault",
        group: "Actions" as const,
        icon: <ActionGlyph><BookOpen size={15} /></ActionGlyph>,
        label: "Open the vault & graph",
        run: () => {
          onClose();
          onNavigate("vault");
        },
      },
      {
        key: "act-apps",
        group: "Actions" as const,
        icon: <ActionGlyph><LayoutGrid size={15} /></ActionGlyph>,
        label: "Open all applications",
        run: () => {
          onClose();
          onNavigate("apps");
        },
      },
      {
        key: "act-settings",
        group: "Actions" as const,
        icon: <ActionGlyph><SlidersHorizontal size={15} /></ActionGlyph>,
        label: "Open settings",
        run: () => {
          onClose();
          onNavigate("settings");
        },
      },
    ]
      .filter((a) => match(a.label))
      .concat(
        bridge
          ? SYSTEM_ACTIONS.filter((s) => s.words.some((w) => w.includes(q)) && q.length > 0)
              .slice(0, 4)
              .map((s) => ({
                key: `sys-${s.uri}`,
                group: "Actions" as const,
                icon: <ActionGlyph><MonitorCog size={15} /></ActionGlyph>,
                label: s.label,
                hint: s.hint,
                run: () => {
                  onClose();
                  bridge.launch(s.uri);
                },
              }))
          : [],
      );

    return [...actions, ...folders, ...workspaces, ...notes, ...files, ...apps];
  }, [query, fileHits, state, vault, onClose, onNavigate, onOpenFolder, onOpenNote, launch, openAddApp, openFolderModal, bridge]);

  useEffect(() => {
    setSelected((s) => Math.max(0, Math.min(s, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  function runAt(index: number) {
    results[index]?.run();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[55]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="absolute inset-0 bg-[#02040a]/50 backdrop-blur-[5px]" onClick={onClose} />

      <div className="relative mx-auto mt-[14vh] w-full max-w-[600px] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -6 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="glass-strong overflow-hidden rounded-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        >
          {/* Input row */}
          <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
            <Search size={17} className="shrink-0 text-accent" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((s) => Math.min(s + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((s) => Math.max(s - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  runAt(selected);
                } else if (e.key === "Escape") {
                  onClose();
                } else if (e.key === "Backspace" && query === "" && results.length === 0) {
                  onClose();
                }
              }}
              placeholder="Search apps, files, folders, actions…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-frost-100 outline-none placeholder:text-frost-500/70"
            />
            <span className="kbd shrink-0">esc</span>
          </div>

          {/* Results */}
          <div className="max-h-[52vh] overflow-y-auto p-2">
            {results.length === 0 && (
              <div className="px-4 py-10 text-center">
                <p className="text-[14px] font-medium text-frost-300">Nothing found</p>
                <p className="mt-1 text-[12.5px] text-frost-500">
                  Try a different name — or add {query.trim() ? `“${query.trim()}”` : "it"} as a new application.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    openAddApp();
                  }}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-accent-soft px-4 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
                >
                  <Plus size={14} /> Add application
                </button>
              </div>
            )}

            {(["Actions", "Folders", "Workspaces", "Notes", "Files", "Applications"] as const).map((group) => {
              const groupResults = results.filter((r) => r.group === group);
              if (groupResults.length === 0) return null;
              return (
                <div key={group}>
                  <p className="px-3 pb-1.5 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
                    {group}
                  </p>
                  {groupResults.map((r) => {
                    const idx = results.indexOf(r);
                    const isSelected = idx === selected;
                    return (
                      <button
                        key={r.key}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => runAt(idx)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                          isSelected ? "bg-accent-soft" : "hover:bg-white/4",
                        )}
                      >
                        <span className="shrink-0">{r.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-[13.5px] font-medium", isSelected ? "text-frost-100" : "text-frost-200")}>
                            {r.label}
                          </span>
                          {r.hint && (
                            <span className="block truncate text-[11.5px] text-frost-500">{r.hint}</span>
                          )}
                        </span>
                        {isSelected && <CornerDownLeft size={13} className="shrink-0 text-frost-500" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ActionGlyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-white/10 bg-white/6 text-frost-300">
      {children}
    </span>
  );
}