import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Network,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { KnowledgeGraph } from "../components/KnowledgeGraph";
import { useLaunch, useUi } from "../components/ui";
import { getDesktop } from "../lib/desktop";
import { buildGraphModel } from "../lib/graph";
import { renderMarkdown } from "../lib/markdown";
import { useQyn } from "../lib/store";
import { useVault } from "../lib/vault";
import type { VaultNote } from "../lib/vault";
import { cn } from "../lib/utils";

export function VaultView({
  pendingOpen,
  onConsumed,
  onOpenFolder,
  onOpenWorkspace,
}: {
  pendingOpen: string | null;
  onConsumed: () => void;
  onOpenFolder: (folderId: string) => void;
  onOpenWorkspace: (wsId: string) => void;
}) {
  const vault = useVault();
  const { state } = useQyn();
  const { toast } = useUi();
  const launch = useLaunch();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [graphOpen, setGraphOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Unified graph: real [[links]] + QynOne-detected relationships. */
  const graph = useMemo(
    () =>
      buildGraphModel(vault.notes, vault.graphEdges, state.apps, state.folders, state.workspaces, state.fileFavorites),
    [vault.notes, vault.graphEdges, state.apps, state.folders, state.workspaces, state.fileFavorites],
  );

  /* ---- open a note requested from elsewhere (AI, home, graph) ---- */
  useEffect(() => {
    if (!pendingOpen) return;
    const hit = vault.notes.find((n) => n.name.toLowerCase() === pendingOpen.toLowerCase());
    if (hit) {
      setActiveId(hit.id);
      setDraft(hit.content);
      setMode("preview");
    } else {
      setActiveId(null);
    }
    onConsumed();
  }, [pendingOpen, vault.notes, onConsumed]);

  const active = useMemo(() => vault.notes.find((n) => n.id === activeId) ?? null, [vault.notes, activeId]);

  /* When the file changes externally, sync the draft (only if untouched). */
  useEffect(() => {
    if (active && draft === null) setDraft(active.content);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Save with a light debounce. */
  useEffect(() => {
    if (draft === null || !active) return;
    if (draft === active.content) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void vault.saveNote(active.id, draft);
    }, 450);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, active, vault]);

  const searched = useMemo(() => (query.trim() ? vault.searchNotes(query) : vault.notes), [query, vault.notes, vault.searchNotes]);
  const notesByFolder = useMemo(() => {
    const map = new Map<string, VaultNote[]>();
    for (const n of vault.notes) {
      const list = map.get(n.folder) ?? [];
      list.push(n);
      map.set(n.folder, list);
    }
    return map;
  }, [vault.notes]);

  const orphans = useMemo(() => {
    const connected = new Set<string>();
    for (const e of vault.graphEdges) {
      connected.add(e.source);
      connected.add(e.target);
    }
    return vault.notes.filter((n) => !connected.has(n.id));
  }, [vault.notes, vault.graphEdges]);

  const unresolved = useMemo(() => {
    if (!active) return [];
    const existing = new Set(vault.notes.map((n) => n.name.toLowerCase()));
    return [...new Set(active.links)].filter((l) => !existing.has(l.toLowerCase()));
  }, [active, vault.notes]);

  function openNoteByName(name: string) {
    const hit = vault.notes.find((n) => n.name.toLowerCase() === name.toLowerCase());
    if (!hit) return;
    setActiveId(hit.id);
    setDraft(hit.content);
    setMode("preview");
  }

  async function createNote() {
    const name = newName.trim();
    if (!name) return;
    const content = `# ${name}\n\n`;
    const path = await vault.createNote(name, newFolder.trim(), content);
    if (path) {
      setActiveId(path);
      setDraft(content);
      setMode("edit");
      toast(`Created ${name}.md`);
    } else {
      toast("A note with that name already exists", { icon: <X size={15} className="text-amber-300" /> });
    }
    setCreating(false);
    setNewName("");
    setNewFolder("");
  }

  function switchNote(id: string) {
    setActiveId(id);
    setDraft(null);
    setMode("edit");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex w-full max-w-[1240px] flex-1 gap-4 px-5 py-5 md:px-6">
        {/* ---------- Left rail ---------- */}
        <aside className="hidden w-[230px] shrink-0 flex-col md:flex">
          <div className="glass flex h-full min-h-0 flex-col rounded-2xl">
            <div className="p-3 pb-2">
              <div className="flex items-center gap-2">
                <Search size={13} className="text-frost-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vault…"
                  className="h-8 w-full min-w-0 bg-transparent text-[12.5px] text-frost-100 outline-none placeholder:text-frost-500/70"
                />
              </div>
            </div>

            <div className="accent-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
              {/* Root notes */}
              <div className="space-y-0.5">
                {(query ? searched.filter((n) => n.folder === "") : notesByFolder.get("") ?? []).map((n) => (
                  <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => switchNote(n.id)} />
                ))}
              </div>

              {/* Folders */}
              {[...new Set(vault.notes.map((n) => n.folder).filter(Boolean))]
                .sort()
                .map((folder) => {
                  const list = query ? searched.filter((n) => n.folder === folder) : notesByFolder.get(folder) ?? [];
                  if (query && list.length === 0 && !folder.toLowerCase().includes(query.toLowerCase())) return null;
                  return (
                    <div key={folder}>
                      <p className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">
                        <Folder size={11} />
                        <span className="truncate">{folder}</span>
                      </p>
                      <div className="space-y-0.5">
                        {list.map((n) => (
                          <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => switchNote(n.id)} />
                        ))}
                      </div>
                    </div>
                  );
                })}

              {query && searched.length === 0 && (
                <p className="px-2 py-3 text-center text-[11.5px] text-frost-500">No notes match “{query}”.</p>
              )}

              {/* Tags */}
              {!query && (
                <div className="px-2 pt-1">
                  <p className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(vault.notes.flatMap((n) => n.tags))].slice(0, 12).map((t) => (
                      <button
                        key={t}
                        onClick={() => setQuery(`#${t}`)}
                        className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent transition hover:brightness-110"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orphans */}
              {!query && orphans.length > 0 && (
                <div className="px-2 pt-1">
                  <p className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">
                    Orphan notes ({orphans.length})
                  </p>
                  <div className="space-y-0.5">
                    {orphans.map((n) => (
                      <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => switchNote(n.id)} orphan />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t border-white/6 p-3">
              <button
                onClick={() => setCreating((v) => !v)}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-accent-soft text-[12px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
              >
                <FilePlus2 size={13} /> New note
              </button>
              <button
                onClick={() => {
                  const name = window.prompt("New folder name");
                  if (name?.trim()) void vault.createFolder(name.trim());
                }}
                className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-white/4 text-[12px] font-medium text-frost-400 transition hover:bg-white/8 hover:text-frost-200"
              >
                <FolderPlus size={13} /> New folder
              </button>
            </div>
          </div>
        </aside>

        {/* ---------- Main ---------- */}
        <main className="glass flex min-w-0 flex-1 flex-col rounded-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
            {active ? (
              <>
                <FileText size={14} className="shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  {renaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void vault.renameNote(active.id, renameValue).then(() => {
                            setRenaming(false);
                            toast("Note renamed");
                          });
                        }
                        if (e.key === "Escape") setRenaming(false);
                      }}
                      className="h-7 w-64 max-w-full rounded-lg border border-white/10 bg-white/5 px-2 text-[13.5px] font-semibold text-frost-100 outline-none"
                    />
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-[14px] font-bold tracking-tight text-frost-100">{active.title}</p>
                      {active.folder && (
                        <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-frost-500">
                          {active.folder}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {renaming ? (
                    <>
                      <button
                        onClick={() => setRenaming(false)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-white/8"
                        aria-label="Cancel rename"
                      >
                        <X size={13} />
                      </button>
                      <button
                        onClick={() => {
                          void vault.renameNote(active.id, renameValue).then(() => {
                            setRenaming(false);
                            toast("Note renamed");
                          });
                        }}
                        className="grid h-7 w-7 place-items-center rounded-lg text-accent transition hover:bg-accent-soft"
                        aria-label="Confirm rename"
                      >
                        <Check size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setRenameValue(active.name);
                          setRenaming(true);
                        }}
                        title="Rename"
                        className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-white/8 hover:text-frost-200"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${active.name}"? The .md file will be removed.`)) {
                            const next = vault.notes.find((n) => n.id !== active.id);
                            void vault.deleteNote(active.id);
                            setActiveId(next?.id ?? null);
                            setDraft(next?.content ?? null);
                            toast(`Deleted ${active.name}.md`);
                          }
                        }}
                        title="Delete"
                        className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-rose-500/15 hover:text-rose-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[13px] font-semibold text-frost-300">
                {creating ? "New note" : "No note open"}
              </p>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {active && (
                <div className="flex rounded-lg border border-white/8 bg-white/4 p-0.5">
                  {(["edit", "preview"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
                        mode === m ? "bg-accent-soft text-accent" : "text-frost-500 hover:text-frost-300",
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setGraphOpen(true)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[12px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
              >
                <Network size={13} /> Graph
              </button>
            </div>
          </div>

          {/* Body */}
          {active && draft !== null ? (
            mode === "edit" ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="accent-scroll h-full min-h-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed text-frost-200 outline-none placeholder:text-frost-500/50"
                placeholder={"# Title\n\nWrite in Markdown. Link notes with [[Note Name]]."}
              />
            ) : (
              <div className="accent-scroll h-full min-h-0 flex-1 overflow-y-auto p-5">
                <div className="mx-auto max-w-[720px]">
                  <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-frost-500">
                    Preview
                  </div>
                  {renderMarkdown(draft, (name) => {
                    const hit = vault.notes.find((n) => n.name.toLowerCase() === name.toLowerCase());
                    if (hit) openNoteByName(name);
                    else toast(`No note named "${name}" yet — create it with [[${name}]] in a file`, { icon: <X size={15} className="text-amber-300" /> });
                  })}
                </div>
              </div>
            )
          ) : (
            <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
              <Network size={26} className="text-frost-500/60" />
              {creating ? (
                <div className="mt-4 w-full max-w-xs space-y-2.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void createNote()}
                    placeholder="Note name"
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-[13.5px] text-frost-100 outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                  />
                  <input
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void createNote()}
                    placeholder="Folder (optional)"
                    className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-[13.5px] text-frost-100 outline-none focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => void createNote()}
                      disabled={!newName.trim()}
                      className="h-10 flex-1 rounded-xl bg-[var(--accent)] text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                    >
                      Create note
                    </button>
                    <button
                      onClick={() => setCreating(false)}
                      className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-[13px] font-medium text-frost-300 transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-[15px] font-semibold text-frost-200">
                    {vault.notes.length === 0 ? "Your vault is empty" : "Select a note"}
                  </p>
                  <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-frost-500">
                    {vault.notes.length === 0
                      ? vault.isReal
                        ? `Create your first note — it becomes a real .md file in ${vault.root ?? "your vault folder"} on this PC.`
                        : "Create your first note — it's stored here and in the desktop app becomes a real .md file in Documents\\QynOneVault."
                      : "Pick a note from the library, or open the graph to navigate your knowledge."}
                  </p>
                  <button
                    onClick={() => setCreating(true)}
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-accent-soft px-5 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
                  >
                    <FilePlus2 size={14} /> Create your first note
                  </button>
                </>
              )}
            </div>
          )}
        </main>

        {/* ---------- Right rail: links & backlinks ---------- */}
        {active && (
          <aside className="hidden w-[250px] shrink-0 lg:block">
            <div className="glass flex h-full flex-col rounded-2xl p-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">Links out</p>
              <div className="mt-2 space-y-1">
                {active.links.length === 0 && <p className="text-[11.5px] text-frost-500">No [[links]] yet.</p>}
                {[...new Set(active.links)].map((l) => {
                  const resolved = vault.notes.find((n) => n.name.toLowerCase() === l.toLowerCase());
                  return (
                    <button
                      key={l}
                      onClick={() => resolved && openNoteByName(l)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition",
                        resolved ? "text-accent hover:bg-accent-soft" : "text-frost-500 hover:bg-white/5",
                      )}
                    >
                      <FileText size={11} className="shrink-0" />
                      <span className="truncate">{l}</span>
                      {!resolved && <span className="ml-auto shrink-0 text-[9.5px] font-semibold uppercase text-amber-300/70">unlinked</span>}
                    </button>
                  );
                })}
              </div>

              {unresolved.length > 0 && (
                <>
                  <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">Unresolved</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {unresolved.map((u) => (
                      <button
                        key={u}
                        onClick={() => void vault.createNote(u, active.folder, `# ${u}\n\n`)}
                        title="Create this note"
                        className="rounded-md border border-dashed border-amber-300/30 bg-amber-300/5 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-200/80 transition hover:bg-amber-300/12"
                      >
                        {u} +
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
                Backlinks ({active.backlinks.length})
              </p>
              <div className="accent-scroll mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pb-2">
                {active.backlinks.length === 0 && (
                  <p className="text-[11.5px] text-frost-500">Nothing links here yet.</p>
                )}
                {active.backlinks.map((name) => (
                  <button
                    key={name}
                    onClick={() => openNoteByName(name)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-frost-200 transition hover:bg-accent-soft hover:text-frost-100"
                  >
                    <ArrowLeft size={11} className="shrink-0 text-accent" />
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>

              {active.tags.length > 0 && (
                <>
                  <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">Tags</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {active.tags.map((t) => (
                      <span key={t} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
                        #{t}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-auto border-t border-white/6 pt-3 text-[10.5px] leading-relaxed text-frost-600">
                {vault.isReal
                  ? `Real file on this PC${vault.root ? `:\n${vault.root}\\${active.path}` : ""}`
                  : "Preview storage (desktop app uses real .md files)"}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Graph overlay */}
      <AnimatePresence>
        {graphOpen && (
          <KnowledgeGraph
            nodes={graph.nodes}
            edges={graph.edges}
            onOpenNote={(name) => {
              openNoteByName(name);
              setGraphOpen(false);
            }}
            onLaunchApp={(appId) => {
              const app = state.apps.find((a) => a.id === appId);
              if (app) launch(app);
              setGraphOpen(false);
            }}
            onOpenFolder={(folderId) => {
              setGraphOpen(false);
              onOpenFolder(folderId);
            }}
            onOpenWorkspace={(wsId) => {
              setGraphOpen(false);
              onOpenWorkspace(wsId);
            }}
            onOpenPath={(p) => {
              const bridge = getDesktop();
              if (bridge) {
                void bridge.openPath(p).then((res) => {
                  if (res.ok) toast("Opening…");
                  else toast(res.error ? `Couldn’t open — ${res.error}` : "Couldn’t open", { icon: <X size={15} className="text-amber-300" /> });
                });
              } else {
                toast(`In the installed app this opens ${p}`);
              }
              setGraphOpen(false);
            }}
            onClose={() => setGraphOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NoteRow({
  note,
  active,
  onClick,
  orphan,
}: {
  note: VaultNote;
  active: boolean;
  onClick: () => void;
  orphan?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
        active ? "bg-accent-soft text-frost-100" : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
      )}
    >
      <FileText size={12} className={cn("shrink-0", active ? "text-accent" : "text-frost-600", orphan && "text-frost-600/60")} />
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{note.title}</span>
      {note.backlinks.length > 0 && (
        <span className="shrink-0 text-[9.5px] font-semibold tabular-nums text-accent/70">{note.backlinks.length}</span>
      )}
    </button>
  );
}