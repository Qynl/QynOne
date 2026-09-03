import { motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  Brain,
  Check,
  Eraser,
  Sparkles,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  Hash,
  Link2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUi } from "../components/ui";
import { useAi } from "../lib/ai";
import { NOTE_MAX_CHARS, VAULT_MAX_NOTES } from "../lib/limits";
import { renderMarkdown } from "../lib/markdown";
import { useMemory, MEMORY_PATH } from "../lib/memory";
import type { MemoryEntry, MemoryKind } from "../lib/memory";
import { useVault } from "../lib/vault";
import type { VaultNote } from "../lib/vault";
import { runVaultTidy, vaultUsage } from "../lib/vaultMaintain";
import { cn } from "../lib/utils";

type Tab = "notes" | "memory";
type EditorMode = "edit" | "split" | "preview";

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "notes", label: "Notes", icon: FileText },
  { id: "memory", label: "Nex memory", icon: Brain },
];

/** Nex's own files (folders starting with `_`) stay out of the library and budgets. */
function isSystemNote(n: { folder: string }): boolean {
  return n.folder.split("/")[0]?.startsWith("_") ?? false;
}

const fmtKB = (chars: number) => `${(chars / 1000).toFixed(chars < 10000 ? 1 : 0)} KB`;

export function VaultView({
  pendingOpen,
  onConsumed,
}: {
  pendingOpen: string | null;
  onConsumed: () => void;
}) {
  const vault = useVault();
  const memory = useMemory();
  const { toast } = useUi();

  const [tab, setTab] = useState<Tab>("notes");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<EditorMode>("edit");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [draft, setDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [tidying, setTidying] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- memory tab form ---- */
  const [memKind, setMemKind] = useState<MemoryKind>("fact");
  const [memText, setMemText] = useState("");

  const userNotes = useMemo(() => vault.notes.filter((n) => !isSystemNote(n)), [vault.notes]);
  const usage = useMemo(() => vaultUsage(userNotes), [userNotes]);
  const memoryPct = Math.min(100, Math.round((memory.usage / memory.max) * 100));

  /* ---- open a note requested from elsewhere (AI, home) ---- */
  useEffect(() => {
    if (!pendingOpen) return;
    const hit = userNotes.find((n) => n.name.toLowerCase() === pendingOpen.toLowerCase());
    setTab("notes");
    if (hit) {
      setActiveId(hit.id);
      setDraft(hit.content);
      setMode("preview");
    } else {
      setActiveId(null);
    }
    onConsumed();
  }, [pendingOpen, userNotes, onConsumed]);

  const active = useMemo(() => userNotes.find((n) => n.id === activeId) ?? null, [userNotes, activeId]);

  /* When the file changes externally, sync the draft (only if untouched). */
  useEffect(() => {
    if (active && draft === null) setDraft(active.content);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Save with a light debounce + save indicator. */
  useEffect(() => {
    if (draft === null || !active) return;
    if (draft === active.content) {
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void vault.saveNote(active.id, draft).then(() => setSaveState("saved"));
    }, 450);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [draft, active, vault]);

  const searched = useMemo(() => (query.trim() ? vault.searchNotes(query).filter((n) => !isSystemNote(n)) : userNotes), [query, vault.searchNotes, userNotes]);
  const notesByFolder = useMemo(() => {
    const map = new Map<string, VaultNote[]>();
    for (const n of userNotes) {
      const list = map.get(n.folder) ?? [];
      list.push(n);
      map.set(n.folder, list);
    }
    return map;
  }, [userNotes]);

  const orphans = useMemo(() => userNotes.filter((n) => n.backlinks.length === 0), [userNotes]);
  const unresolved = useMemo(() => {
    if (!active) return [];
    const existing = new Set(userNotes.map((n) => n.name.toLowerCase()));
    return [...new Set(active.links)].filter((l) => !existing.has(l.toLowerCase()));
  }, [active, userNotes]);
  const allTags = useMemo(() => [...new Set(userNotes.flatMap((n) => n.tags))].sort(), [userNotes]);
  const wordCount = useMemo(() => (draft ?? "").trim() ? (draft ?? "").trim().split(/\s+/).length : 0, [draft]);
  const nearLimit = (draft?.length ?? 0) > NOTE_MAX_CHARS * 0.85;

  function openNoteByName(name: string) {
    const hit = userNotes.find((n) => n.name.toLowerCase() === name.toLowerCase());
    if (!hit) return;
    setActiveId(hit.id);
    setDraft(hit.content);
    setMode("preview");
  }

  async function createNote() {
    const name = newName.trim();
    if (!name) return;
    if (userNotes.length >= VAULT_MAX_NOTES) {
      toast(`Vault is full — max ${VAULT_MAX_NOTES} notes. Tidy it or archive old ones.`, { icon: <Archive size={14} className="text-amber-300" /> });
      return;
    }
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

  async function addMemory() {
    const text = memText.trim();
    if (!text) return;
    if (memory.usage + text.length > memory.max) {
      toast(`Memory is full (${memory.max.toLocaleString()} chars). Nex compresses it — press Compress or say “/memory-compact”.`, { icon: <Brain size={14} className="text-amber-300" /> });
      return;
    }
    const entry = await memory.add(memKind, text);
    setMemText("");
    toast(entry ? (memKind === "preference" ? "Preference saved" : "Remembered") : "Memory is full — compress it first", { icon: entry ? undefined : <X size={15} className="text-amber-300" /> });
  }

  async function tidy() {
    setTidying(true);
    const result = await runVaultTidy(vault);
    setTidying(false);
    toast(`${result.actions[0] ?? "Vault tidied"}${result.actions.length > 1 ? ` (+${result.actions.length - 1} more)` : ""}`, {
      icon: <Archive size={14} className="text-accent" />,
    });
    if (activeId) {
      const stillThere = vault.notes.some((n) => n.id === activeId);
      if (!stillThere) setActiveId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---------- Page header ---------- */}
      <div className="mx-auto flex w-full max-w-[1500px] items-end justify-between gap-4 px-5 pb-3 pt-5 md:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">Vault · local Markdown library</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-frost-100">Your vault</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <StatChip value={`${usage.notes}/${usage.maxNotes}`} label="notes" warn={usage.notes >= usage.maxNotes} />
            <StatChip value={usage.largestChars > 0 ? fmtKB(usage.largestChars) : "—"} label="largest note" warn={usage.largestChars > NOTE_MAX_CHARS} />
            <StatChip value={allTags.length} label="tags" />
            {orphans.length > 0 && <StatChip value={orphans.length} label="orphans" />}
            <StatChip value={`${fmtKB(memory.usage)}/${fmtKB(memory.max)}`} label="Nex memory" accent memoryPct={memoryPct} />
            {usage.over && (
              <button
                onClick={() => void tidy()}
                disabled={tidying}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 font-semibold text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-50"
              >
                <Archive size={11} className={tidying ? "animate-pulse" : ""} /> {tidying ? "Tidying…" : "Vault over budget — tidy"}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="glass-soft flex shrink-0 items-center gap-1 rounded-xl p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const activeTab = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12.5px] font-semibold transition",
                  activeTab ? "text-frost-100" : "text-frost-500 hover:text-frost-300",
                )}
              >
                {activeTab && <motion.span layoutId="vault-tab" className="absolute inset-0 rounded-lg bg-accent-soft" transition={{ type: "spring", bounce: 0.18, duration: 0.4 }} />}
                <Icon size={14} className={cn("relative", activeTab && "text-accent")} />
                <span className="relative">{t.label}</span>
                {t.id === "memory" && memory.entries.length > 0 && (
                  <span className="relative grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-white">{memory.entries.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1500px] min-h-0 flex-1 px-5 pb-5 md:px-6">
        {tab === "memory" ? (
          <MemoryTab
            memory={memory}
            memKind={memKind}
            setMemKind={setMemKind}
            memText={memText}
            setMemText={setMemText}
            onAdd={addMemory}
          />
        ) : (
          <div className="flex h-full min-h-0 gap-4">
            {/* ---------- Left library ---------- */}
            <aside className="hidden w-[230px] shrink-0 flex-col md:flex">
              <div className="glass flex h-full min-h-0 flex-col rounded-2xl">
                <div className="p-3 pb-2">
                  <div className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.03] px-2.5">
                    <Search size={13} className="shrink-0 text-frost-500" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search vault…"
                      className="h-8 w-full min-w-0 bg-transparent text-[12.5px] text-frost-100 outline-none placeholder:text-frost-500/70"
                    />
                    {query && (
                      <button onClick={() => setQuery("")} className="shrink-0 text-frost-500 hover:text-frost-200">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="accent-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
                  <div className="space-y-0.5">
                    {(query ? searched.filter((n) => n.folder === "") : notesByFolder.get("") ?? []).map((n) => (
                      <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => switchNote(n.id)} />
                    ))}
                  </div>

                  {[...new Set(userNotes.map((n) => n.folder).filter(Boolean))]
                    .sort()
                    .map((folder) => {
                      const list = query ? searched.filter((n) => n.folder === folder) : notesByFolder.get(folder) ?? [];
                      if (query && list.length === 0 && !folder.toLowerCase().includes(query.toLowerCase())) return null;
                      return (
                        <div key={folder}>
                          <p className="flex items-center gap-1.5 px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">
                            <Folder size={11} />
                            <span className="truncate">{folder}</span>
                            <span className="ml-auto text-[9.5px] font-medium tabular-nums text-frost-600">{list.length}</span>
                          </p>
                          <div className="space-y-0.5">
                            {list.map((n) => (
                              <NoteRow key={n.id} note={n} active={n.id === activeId} onClick={() => switchNote(n.id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}

                  {query && searched.length === 0 && <p className="px-2 py-3 text-center text-[11.5px] text-frost-500">No notes match “{query}”.</p>}

                  {!query && allTags.length > 0 && (
                    <div className="px-2 pt-1">
                      <p className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {allTags.slice(0, 12).map((t) => (
                          <button key={t} onClick={() => setQuery(`#${t}`)} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent transition hover:brightness-110">
                            #{t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!query && orphans.length > 0 && (
                    <div className="px-2 pt-1">
                      <p className="pb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">Orphan notes ({orphans.length})</p>
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

            {/* ---------- Editor ---------- */}
            <main className="glass flex min-w-0 flex-1 flex-col rounded-2xl">
              <div className="flex items-center gap-2 border-b border-white/6 px-4 py-2.5">
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
                          {active.folder && <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-frost-500">{active.folder}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {renaming ? (
                        <>
                          <button onClick={() => setRenaming(false)} className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-white/8" aria-label="Cancel rename">
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
                                const next = userNotes.find((n) => n.id !== active.id);
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
                  <p className="text-[13px] font-semibold text-frost-300">{creating ? "New note" : "No note open"}</p>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {active && (
                    <div className="flex rounded-lg border border-white/8 bg-white/4 p-0.5">
                      {(["edit", "split", "preview"] as const).map((m) => (
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
                </div>
              </div>

              {/* Body */}
              {active && draft !== null ? (
                mode === "edit" ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    spellCheck={false}
                    maxLength={NOTE_MAX_CHARS}
                    className="accent-scroll h-full min-h-0 flex-1 resize-none bg-transparent p-5 font-mono text-[13px] leading-relaxed text-frost-200 outline-none placeholder:text-frost-500/50"
                    placeholder={"# Title\n\nWrite in Markdown. Link notes with [[Note Name]]."}
                  />
                ) : mode === "split" ? (
                  <div className="grid min-h-0 flex-1 grid-cols-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      maxLength={NOTE_MAX_CHARS}
                      className="accent-scroll h-full min-h-0 resize-none border-r border-white/6 bg-transparent p-5 font-mono text-[13px] leading-relaxed text-frost-200 outline-none"
                    />
                    <div className="accent-scroll min-h-0 overflow-y-auto p-5">
                      <div className="mx-auto max-w-[640px]">
                        {renderMarkdown(draft, (name) => {
                          const hit = userNotes.find((n) => n.name.toLowerCase() === name.toLowerCase());
                          if (hit) openNoteByName(name);
                          else toast(`No note named "${name}" yet — create it with [[${name}]] in a file`, { icon: <X size={15} className="text-amber-300" /> });
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="accent-scroll h-full min-h-0 flex-1 overflow-y-auto p-5">
                    <div className="mx-auto max-w-[720px]">
                      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-frost-500">Preview</div>
                      {renderMarkdown(draft, (name) => {
                        const hit = userNotes.find((n) => n.name.toLowerCase() === name.toLowerCase());
                        if (hit) openNoteByName(name);
                        else toast(`No note named "${name}" yet — create it with [[${name}]] in a file`, { icon: <X size={15} className="text-amber-300" /> });
                      })}
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
                  <FileText size={26} className="text-frost-500/60" />
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
                        <button onClick={() => void createNote()} disabled={!newName.trim()} className="h-10 flex-1 rounded-xl bg-[var(--accent)] text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                          Create note
                        </button>
                        <button onClick={() => setCreating(false)} className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-[13px] font-medium text-frost-300 transition hover:bg-white/10">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 text-[15px] font-semibold text-frost-200">{userNotes.length === 0 ? "Your vault is empty" : "Select a note"}</p>
                      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-frost-500">
                        {userNotes.length === 0
                          ? vault.isReal
                            ? `Create your first note — it becomes a real .md file in ${vault.root ?? "your vault folder"} on this PC.`
                            : "Create your first note — it's stored here and in the desktop app becomes a real .md file in Documents\\QynOneVault."
                          : "Pick a note from the library. Notes are real .md files; Nex keeps the vault within its budget."}
                      </p>
                      <div className="mt-5 flex items-center gap-2">
                        <button onClick={() => setCreating(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-soft px-5 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]">
                          <FilePlus2 size={14} /> Create your first note
                        </button>
                        <button onClick={() => setTab("memory")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[13px] font-semibold text-frost-300 transition hover:bg-white/10">
                          <Brain size={14} /> Nex memory
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Status bar */}
              {active && draft !== null && (
                <div className="flex items-center gap-3 border-t border-white/6 px-4 py-1.5 text-[10.5px] text-frost-600">
                  <span className="truncate font-mono">{active.path}</span>
                  <span className="ml-auto shrink-0 tabular-nums">{wordCount} words</span>
                  <span className={cn("shrink-0 tabular-nums", nearLimit ? "font-semibold text-amber-300/90" : "")}>
                    {draft.length.toLocaleString()} / {fmtKB(NOTE_MAX_CHARS)}
                  </span>
                  <span className={cn("shrink-0 font-semibold", saveState === "saving" ? "text-amber-300/80" : "text-emerald-300/70")}>
                    {saveState === "saving" ? "Saving…" : "Saved"}
                  </span>
                </div>
              )}
            </main>

            {/* ---------- Right rail: links & backlinks ---------- */}
            {active && (
              <aside className="hidden w-[250px] shrink-0 lg:block">
                <div className="glass flex h-full flex-col rounded-2xl p-4">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
                    <Link2 size={11} /> Links out ({[...new Set(active.links)].length})
                  </p>
                  <div className="mt-2 space-y-1">
                    {active.links.length === 0 && <p className="text-[11.5px] text-frost-500">No [[links]] yet.</p>}
                    {[...new Set(active.links)].map((l) => {
                      const resolved = userNotes.find((n) => n.name.toLowerCase() === l.toLowerCase());
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

                  <p className="mt-5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
                    <ArrowLeft size={11} /> Backlinks ({active.backlinks.length})
                  </p>
                  <div className="accent-scroll mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pb-2">
                    {active.backlinks.length === 0 && <p className="text-[11.5px] text-frost-500">Nothing links here yet.</p>}
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
                      <p className="mt-3 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
                        <Hash size={11} /> Tags
                      </p>
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
                    {vault.isReal ? `Real file on this PC${vault.root ? `:\n${vault.root}\\${active.path}` : ""}` : "Preview storage (desktop app uses real .md files)"}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function StatChip({
  value,
  label,
  accent,
  warn,
  memoryPct,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
  warn?: boolean;
  memoryPct?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium",
        warn
          ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
          : accent
            ? "border-accent-soft bg-accent-soft text-accent"
            : "border-white/8 bg-white/[0.03] text-frost-400",
      )}
    >
      <span className={cn("font-bold tabular-nums", warn ? "text-amber-200" : accent ? "text-accent" : "text-frost-200")}>{value}</span>
      <span>{label}</span>
      {accent && memoryPct !== undefined && (
        <span className="relative h-[3px] w-10 overflow-hidden rounded-full bg-white/10">
          <span className={cn("absolute inset-y-0 left-0 rounded-full", memoryPct >= 85 ? "bg-amber-300" : "bg-[var(--accent)]")} style={{ width: `${memoryPct}%` }} />
        </span>
      )}
    </span>
  );
}

function NoteRow({ note, active, onClick, orphan }: { note: VaultNote; active: boolean; onClick: () => void; orphan?: boolean }) {
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
      {note.backlinks.length > 0 && <span className="shrink-0 text-[9.5px] font-semibold tabular-nums text-accent/70">{note.backlinks.length}</span>}
    </button>
  );
}

function MemoryTab({
  memory,
  memKind,
  setMemKind,
  memText,
  setMemText,
  onAdd,
}: {
  memory: ReturnType<typeof useMemory>;
  memKind: MemoryKind;
  setMemKind: (k: MemoryKind) => void;
  memText: string;
  setMemText: (t: string) => void;
  onAdd: () => void;
}) {
  const { compactMemory } = useAi();
  const { toast } = useUi();
  const [compressing, setCompressing] = useState(false);
  const pct = Math.min(100, Math.round((memory.usage / memory.max) * 100));

  async function compress() {
    setCompressing(true);
    const r = await compactMemory();
    setCompressing(false);
    toast(r.message, { icon: r.ok ? <Check size={14} className="text-emerald-300" /> : <X size={14} className="text-amber-300" /> });
  }

  const sections: Array<{ kind: MemoryKind; title: string; hint: string; entries: MemoryEntry[] }> = [
    { kind: "fact", title: "Facts about you", hint: "Durable things Nex knows about your life and projects.", entries: memory.facts },
    { kind: "preference", title: "Preferences", hint: "How you like things — apps, tools, habits.", entries: memory.preferences },
    { kind: "conversation", title: "Conversations", hint: "Kept briefly — oldest drop first when memory is full.", entries: memory.conversations },
  ];

  return (
    <div className="mx-auto w-full max-w-[980px] py-1">
      {/* Header card */}
      <div className="glass relative overflow-hidden rounded-2xl p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_90%_at_85%_0%,rgba(91,140,255,0.09),transparent_60%)]" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Brain size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">Nex's memory</p>
            <h2 className="mt-0.5 text-[19px] font-semibold tracking-tight text-frost-100">
              {memory.entries.length === 0 ? "Nex remembers nothing yet" : `${memory.entries.length} thing${memory.entries.length === 1 ? "" : "s"} Nex remembers`}
            </h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-frost-500">
              Memory is a real Markdown file — <code className="rounded bg-white/6 px-1 py-px font-mono text-[11px] text-frost-300">{MEMORY_PATH}</code> — capped at{" "}
              <span className="text-frost-300">{(memory.max / 1000).toFixed(1)} KB</span> so only the personal essentials stay. Nex writes here so it can be personal, compresses it when
              it fills up, and you can edit or delete anything in any editor — the .md file is the source of truth.
            </p>
            {/* usage bar */}
            <div className="mt-3 flex max-w-md items-center gap-3">
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", pct >= 85 ? "bg-gradient-to-r from-amber-400 to-amber-300" : "bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_60%,#fff)] to-[var(--accent)]")}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <span className={cn("shrink-0 text-[10.5px] font-semibold tabular-nums", pct >= 85 ? "text-amber-300" : "text-frost-500")}>
                {memory.usage.toLocaleString()} / {memory.max.toLocaleString()} chars
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              onClick={() => void compress()}
              disabled={compressing || memory.entries.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent-glow)] transition hover:brightness-110 disabled:opacity-40"
            >
              <Sparkles size={12} className={compressing ? "animate-pulse" : ""} /> {compressing ? "Compressing…" : "Compress with Nex"}
            </button>
            {memory.entries.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Forget everything Nex remembers?")) void memory.clear();
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-[11.5px] font-medium text-frost-400 transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <Eraser size={12} /> Forget everything
              </button>
            )}
          </div>
        </div>

        {/* Add form */}
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <div className="flex shrink-0 rounded-lg border border-white/8 bg-white/4 p-0.5">
            {(["fact", "preference"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setMemKind(k)}
                className={cn("rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition", memKind === k ? "bg-accent-soft text-accent" : "text-frost-500 hover:text-frost-300")}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            value={memText}
            onChange={(e) => setMemText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            maxLength={300}
            placeholder={memKind === "preference" ? "e.g. prefers dark mode everywhere" : "e.g. working on the OUTBOUND game project"}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/8 bg-white/[0.03] px-3 text-[12.5px] text-frost-100 outline-none placeholder:text-frost-600 focus:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]"
          />
          <button onClick={onAdd} disabled={!memText.trim()} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
            <Plus size={13} /> Save
          </button>
        </div>
        {pct >= 66 && (
          <p className="relative mt-2 text-[11px] text-amber-300/80">
            Memory is {pct}% full — when it hits its cap Nex keeps the newest entries and drops the oldest; “Compress with Nex” merges everything into the essentials.
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <section key={s.kind} className="glass flex min-h-[220px] flex-col rounded-2xl p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-semibold text-frost-100">{s.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-relaxed text-frost-600">{s.hint}</p>
              </div>
              {s.entries.length > 0 && (
                <button onClick={() => void memory.clear(s.kind)} title={`Clear ${s.title.toLowerCase()}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-frost-600 transition hover:bg-white/6 hover:text-frost-300">
                  <Eraser size={12} />
                </button>
              )}
            </div>
            <div className="accent-scroll mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {s.entries.length === 0 && (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/8 text-[11.5px] text-frost-600">{s.kind === "conversation" ? "Oldest conversations drop first when memory is full." : "Nothing here yet."}</div>
              )}
              {s.entries.map((e) => (
                <div key={e.id} className="group flex items-start gap-2 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2 transition hover:border-white/12">
                  <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-frost-200">{e.text}</p>
                  <span className="mt-px shrink-0 text-[9.5px] font-medium tabular-nums text-frost-600">{e.date}</span>
                  <button
                    onClick={() => void memory.remove(e.id)}
                    title="Forget this"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-frost-600 opacity-0 transition hover:bg-rose-500/12 hover:text-rose-300 group-hover:opacity-100"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}