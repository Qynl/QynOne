import { useCallback, useMemo } from "react";
import { useVault } from "./vault";
import { MEMORY_MAX_CHARS } from "./limits";

/**
 * Nex's long-term memory.
 *
 * Memory is not a fake database — it is a REAL Markdown file inside the
 * vault (`_Nex/Memory.md`), synced through the same vault watcher as every
 * other note. In the web preview it lives in the localStorage-backed vault;
 * in the desktop app it is a real file under Documents\QynOneVault\_Nex\Memory.md.
 *
 * The file is hard-capped at MEMORY_MAX_CHARS characters: only the personal
 * essentials fit, so Nex must keep entries short and consolidate when the
 * file fills up. Old conversation highlights are dropped first, then the
 * oldest facts, then preferences — newest always survives — and the AI can
 * compress the whole file into a tighter set on request.
 */

export const MEMORY_PATH = "_Nex/Memory.md";

export type MemoryKind = "fact" | "preference" | "conversation";

export interface MemoryEntry {
  /** e.g. "f_1750000000000" — stable id stored in the file */
  id: string;
  kind: MemoryKind;
  /** YYYY-MM-DD */
  date: string;
  text: string;
}

const SECTION: Record<MemoryKind, string> = {
  fact: "Facts",
  preference: "Preferences",
  conversation: "Conversations",
};

const ENTRY_RE = /^- \[([fpce]_\d{10,})\]\s*(\d{4}-\d{2}-\d{2})\s*[—-]\s*(.+)$/;

/** Parse a memory file into entries, preserving any hand-written lines. */
export function parseMemory(content: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  let section: MemoryKind | null = null;
  for (const line of content.split(/\r?\n/)) {
    const head = line.match(/^## (Facts|Preferences|Conversations)\s*$/);
    if (head) {
      section = head[1] === "Facts" ? "fact" : head[1] === "Preferences" ? "preference" : "conversation";
      continue;
    }
    if (!section) continue;
    const m = line.match(ENTRY_RE);
    if (m) {
      const kind = m[1][0] === "f" ? "fact" : m[1][0] === "p" ? "preference" : "conversation";
      if (kind === section) entries.push({ id: m[1], kind, date: m[2], text: m[3].trim() });
    }
  }
  return entries;
}

/** Render entries back into the memory file. */
export function renderMemory(entries: MemoryEntry[]): string {
  const kinds: MemoryKind[] = ["fact", "preference", "conversation"];
  const byKind = (k: MemoryKind) => entries.filter((e) => e.kind === k);
  const lines: string[] = [
    "# Nex — Memory",
    "",
    "> My memory lives in this real Markdown file — the source of truth. I write here so I can be personal, and you can edit or delete anything anytime.",
    "",
  ];
  for (const kind of kinds) {
    lines.push(`## ${SECTION[kind]}`, "");
    const list = byKind(kind);
    if (list.length === 0) {
      lines.push(`- _(nothing yet)_`, "");
    }
    for (const e of list) {
      lines.push(`- [${e.id}] ${e.date} — ${e.text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface MemoryValue {
  entries: MemoryEntry[];
  facts: MemoryEntry[];
  preferences: MemoryEntry[];
  conversations: MemoryEntry[];
  /** true once the memory file exists in the vault */
  ready: boolean;
  /** short summary for the AI system prompt */
  summary: string;
  /** rendered file length in characters */
  usage: number;
  /** hard budget — the file never exceeds this */
  max: number;
  add: (kind: MemoryKind, text: string) => Promise<MemoryEntry | null>;
  remove: (id: string) => Promise<void>;
  clear: (kind?: MemoryKind) => Promise<void>;
  /** replace the whole file (AI consolidation) — still enforces the budget */
  replaceAll: (entries: MemoryEntry[]) => Promise<MemoryEntry[]>;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Enforce the hard budget: drop entries oldest-first, conversations before
 * facts before preferences, until the rendered file fits. Newest survives.
 */
export function enforceBudget(entries: MemoryEntry[]): MemoryEntry[] {
  let current = [...entries];
  const kindWeight = (k: MemoryKind) => (k === "conversation" ? 0 : k === "fact" ? 1 : 2);
  while (current.length > 0 && renderMemory(current).length > MEMORY_MAX_CHARS) {
    const victim = [...current].sort(
      (a, b) =>
        kindWeight(a.kind) - kindWeight(b.kind) ||
        a.date.localeCompare(b.date) ||
        a.id.localeCompare(b.id),
    )[0];
    current = current.filter((e) => e.id !== victim.id);
  }
  return current;
}

/** Read a vault note by path; local helper so memory.tsx stays small. */
function findNote(notes: ReturnType<typeof useVault>["notes"], path: string) {
  return notes.find((n) => n.id === path) ?? null;
}

export function useMemory(): MemoryValue {
  const vault = useVault();

  const note = useMemo(() => findNote(vault.notes, MEMORY_PATH), [vault.notes]);
  const entries = useMemo(() => parseMemory(note?.content ?? ""), [note]);

  const facts = useMemo(() => entries.filter((e) => e.kind === "fact"), [entries]);
  const preferences = useMemo(() => entries.filter((e) => e.kind === "preference"), [entries]);
  const conversations = useMemo(() => entries.filter((e) => e.kind === "conversation"), [entries]);

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (facts.length > 0) parts.push(`Facts: ${facts.slice(-14).map((e) => e.text).join("; ")}`);
    if (preferences.length > 0) parts.push(`Preferences: ${preferences.slice(-8).map((e) => e.text).join("; ")}`);
    if (conversations.length > 0) parts.push(`Recent conversations: ${conversations.slice(-5).map((e) => e.text).join("; ")}`);
    return parts.join("\n");
  }, [facts, preferences, conversations]);

  /** Write with a small retry: the vault serializes saves, so concurrent
      writes can otherwise be skipped. */
  const write = useCallback(
    async (next: MemoryEntry[]) => {
      const content = renderMemory(next);
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          if (note) {
            await vault.saveNote(MEMORY_PATH, content);
          } else {
            const created = await vault.createNote("Memory", "_Nex", content);
            if (created) return;
          }
          return;
        } catch {
          await sleep(220);
        }
      }
    },
    [note, vault],
  );

  const add = useCallback(
    async (kind: MemoryKind, text: string): Promise<MemoryEntry | null> => {
      const clean = text.trim().replace(/\s+/g, " ");
      if (!clean) return null;
      if (entries.some((e) => e.text.toLowerCase() === clean.toLowerCase())) {
        return entries.find((e) => e.text.toLowerCase() === clean.toLowerCase()) ?? null;
      }
      const entry: MemoryEntry = {
        id: `${kind[0]}_${Date.now()}`,
        kind,
        date: new Date().toISOString().slice(0, 10),
        text: clean,
      };
      /* The file is capped: the new entry always survives, so first free
         room by dropping the oldest conversation / fact / preference. If a
         single entry alone would not fit, it can't be stored at all. */
      let room = entries;
      while (room.length > 0 && renderMemory([...room, entry]).length > MEMORY_MAX_CHARS) {
        const victim = [...room].sort(
          (a, b) =>
            (a.kind === "conversation" ? 0 : a.kind === "fact" ? 1 : 2) - (b.kind === "conversation" ? 0 : b.kind === "fact" ? 1 : 2) ||
            a.date.localeCompare(b.date) ||
            a.id.localeCompare(b.id),
        )[0];
        room = room.filter((e) => e.id !== victim.id);
      }
      if (renderMemory([entry]).length > MEMORY_MAX_CHARS) return null;
      await write([...room, entry]);
      return entry;
    },
    [entries, write],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!entries.some((e) => e.id === id)) return;
      await write(entries.filter((e) => e.id !== id));
    },
    [entries, write],
  );

  const clear = useCallback(
    async (kind?: MemoryKind) => {
      await write(kind ? entries.filter((e) => e.kind !== kind) : []);
    },
    [entries, write],
  );

  const replaceAll = useCallback(
    async (nextEntries: MemoryEntry[]): Promise<MemoryEntry[]> => {
      const fitted = enforceBudget(nextEntries);
      await write(fitted);
      return fitted;
    },
    [write],
  );

  const usage = useMemo(() => (note ? renderMemory(entries).length : 0), [note, entries]);

  return useMemo(
    () => ({
      entries,
      facts,
      preferences,
      conversations,
      ready: Boolean(note),
      summary,
      usage,
      max: MEMORY_MAX_CHARS,
      add,
      remove,
      clear,
      replaceAll,
    }),
    [entries, facts, preferences, conversations, note, summary, usage, add, remove, clear, replaceAll],
  );
}