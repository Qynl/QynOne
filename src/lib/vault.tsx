import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getDesktop } from "./desktop";
import { extractTags, extractWikiLinks, noteTitle } from "./markdown";

const PREVIEW_KEY = "qynone.vault.v1";

export interface VaultNote {
  /** unique id — the relative path, e.g. "Projects/OUTBOUND.md" */
  id: string;
  /** relative path */
  path: string;
  /** note name (no extension), e.g. "OUTBOUND" */
  name: string;
  /** folder relative path ("" = vault root) */
  folder: string;
  title: string;
  content: string;
  links: string[];
  backlinks: string[];
  tags: string[];
  updatedAt: number;
}

export interface GraphEdge {
  source: string; // note id
  target: string; // note id
}

interface VaultValue {
  notes: VaultNote[];
  folders: string[];
  root: string | null;
  loading: boolean;
  isReal: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createNote: (name: string, folder: string, content: string) => Promise<string | null>;
  saveNote: (id: string, content: string) => Promise<void>;
  renameNote: (id: string, newName: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  /** edges derived from actual [[links]] in the files — never hardcoded */
  graphEdges: GraphEdge[];
  searchNotes: (query: string) => VaultNote[];
}

const VaultContext = createContext<VaultValue | null>(null);

/** localStorage vault — the only storage available to the web preview. */
function previewLoad(): { folders: string[]; files: Record<string, string> } {
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { folders?: string[]; files?: Record<string, string> };
      return { folders: parsed.folders ?? [], files: parsed.files ?? {} };
    }
  } catch {
    // fall through to empty
  }
  return { folders: [], files: {} };
}

function previewSave(folders: string[], files: Record<string, string>) {
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify({ folders, files }));
  } catch {
    // storage unavailable
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const bridge = getDesktop();
  const [root, setRoot] = useState<string | null>(null);
  const [isReal, setIsReal] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  const refresh = useCallback(async () => {
    if (bridge) {
      try {
        const [r, tree] = await Promise.all([bridge.vaultRoot(), bridge.vaultTree()]);
        if (r) setRoot(r);
        setIsReal(true);
        if (tree) {
          setFolders(tree.folders);
          const next: Record<string, string> = {};
          for (const n of tree.notes) next[n.path] = n.content;
          setFiles(next);
        }
        setError(null);
      } catch (e) {
        setError(String((e && (e as Error).message) || e));
      } finally {
        setLoading(false);
      }
      return;
    }
    const p = previewLoad();
    setFolders(p.folders);
    setFiles(p.files);
    setRoot(null);
    setIsReal(false);
    setLoading(false);
  }, [bridge]);

  useEffect(() => {
    void refresh();

    /* Auto-rescan: re-read the .md files whenever the desktop app's watcher
       fires, when the window regains focus, and on a slow poll as a safety
       net — the graph re-marks itself from the real files automatically. */
    const off = bridge?.onVaultChanged ? bridge.onVaultChanged(() => void refresh()) : undefined;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const poll = setInterval(() => void refresh(), 15000);
    return () => {
      off?.();
      window.removeEventListener("focus", onFocus);
      clearInterval(poll);
    };
  }, [refresh, bridge]);

  /* Derived notes with links/backlinks/tags — the source of truth is files. */
  const notes = useMemo<VaultNote[]>(() => {
    const list: VaultNote[] = Object.entries(files).map(([path, content]) => {
      const segs = path.split("/");
      const name = (segs.pop() ?? "").replace(/\.md$/i, "");
      return {
        id: path,
        path,
        name,
        folder: segs.join("/"),
        title: noteTitle(content, name),
        content,
        links: extractWikiLinks(content),
        backlinks: [],
        tags: extractTags(content),
        updatedAt: Date.now(),
      };
    });
    const byName = new Map<string, VaultNote[]>();
    for (const n of list) {
      const key = n.name.toLowerCase();
      const arr = byName.get(key) ?? [];
      arr.push(n);
      byName.set(key, arr);
    }
    const resolve = (target: string): string | null => {
      const direct = byName.get(target.toLowerCase());
      if (direct && direct.length > 0) return direct[0].id;
      /* also try folder-qualified "Folder/Name" */
      const qualified = byName.get(target.split("/").pop()?.toLowerCase() ?? "");
      return qualified && qualified.length > 0 ? qualified[0].id : null;
    };
    for (const n of list) {
      for (const target of n.links) {
        const resolved = resolve(target);
        if (resolved && resolved !== n.id) {
          const hit = list.find((x) => x.id === resolved);
          if (hit && !hit.backlinks.includes(n.name)) hit.backlinks.push(n.name);
        }
      }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [files]);

  const graphEdges = useMemo<GraphEdge[]>(() => {
    const byName = new Map<string, VaultNote[]>();
    for (const n of notes) {
      const key = n.name.toLowerCase();
      const arr = byName.get(key) ?? [];
      arr.push(n);
      byName.set(key, arr);
    }
    const seen = new Set<string>();
    const edges: GraphEdge[] = [];
    for (const n of notes) {
      for (const target of n.links) {
        const hits = byName.get(target.toLowerCase());
        if (!hits) continue;
        for (const hit of hits) {
          if (hit.id === n.id) continue;
          const key = [n.id, hit.id].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push({ source: n.id, target: hit.id });
        }
      }
    }
    return edges;
  }, [notes]);

  const searchNotes = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return notes;
      return notes
        .map((n) => {
          let score = 0;
          if (n.name.toLowerCase().includes(q)) score += 10;
          if (n.title.toLowerCase().includes(q)) score += 6;
          if (n.tags.some((t) => t.toLowerCase().includes(q))) score += 4;
          if (n.content.toLowerCase().includes(q)) score += 2;
          return { n, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.n);
    },
    [notes],
  );

  const createNote = useCallback(
    async (name: string, folder: string, content: string): Promise<string | null> => {
      const cleanName = name.trim().replace(/[\\/:*?"<>|]/g, "-");
      if (!cleanName) return null;
      const path = folder ? `${folder}/${cleanName}.md` : `${cleanName}.md`;
      if (files[path]) return null;
      if (bridge) {
        const res = await bridge.vaultWrite(path, content);
        if (!res.ok) {
          setError(res.error ?? "couldn't write the note");
          return null;
        }
      } else {
        setFiles((f) => ({ ...f, [path]: content }));
        previewSave([...new Set([...folders, folder].filter(Boolean))], { ...files, [path]: content });
      }
      await refresh();
      return path;
    },
    [bridge, files, folders, refresh],
  );

  const saveNote = useCallback(
    async (id: string, content: string) => {
      if (saving.current) return;
      saving.current = true;
      try {
        if (bridge) {
          await bridge.vaultWrite(id, content);
        } else {
          const next = { ...files, [id]: content };
          setFiles(next);
          previewSave(folders, next);
        }
      } finally {
        saving.current = false;
      }
    },
    [bridge, files, folders],
  );

  const renameNote = useCallback(
    async (id: string, newName: string) => {
      const clean = newName.trim().replace(/[\\/:*?"<>|]/g, "-");
      if (!clean || clean === id) return;
      const folder = id.split("/").slice(0, -1).join("/");
      const newPath = folder ? `${folder}/${clean}.md` : `${clean}.md`;
      if (files[newPath]) return;
      if (bridge) {
        const res = await bridge.vaultRename(id, newPath);
        if (!res.ok) {
          setError(res.error ?? "couldn't rename the note");
          return;
        }
      } else {
        const next = { ...files };
        const content = next[id];
        delete next[id];
        if (content !== undefined) next[newPath] = content;
        setFiles(next);
        previewSave(folders, next);
      }
      await refresh();
    },
    [bridge, files, folders, refresh],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      if (bridge) {
        const res = await bridge.vaultDelete(id);
        if (!res.ok) {
          setError(res.error ?? "couldn't delete the note");
          return;
        }
      } else {
        const next = { ...files };
        delete next[id];
        setFiles(next);
        previewSave(folders, next);
      }
      await refresh();
    },
    [bridge, files, folders, refresh],
  );

  const createFolder = useCallback(
    async (name: string) => {
      const clean = name.trim().replace(/[\\/:*?"<>|]/g, "-");
      if (!clean || folders.includes(clean)) return;
      if (bridge) {
        await bridge.vaultMkdir(clean);
      } else {
        const next = [...folders, clean].sort();
        setFolders(next);
        previewSave(next, files);
      }
      await refresh();
    },
    [bridge, folders, files, refresh],
  );

  const value = useMemo<VaultValue>(
    () => ({
      notes,
      folders,
      root,
      loading,
      isReal,
      error,
      refresh,
      createNote,
      saveNote,
      renameNote,
      deleteNote,
      createFolder,
      graphEdges,
      searchNotes,
    }),
    [notes, folders, root, loading, isReal, error, refresh, createNote, saveNote, renameNote, deleteNote, createFolder, graphEdges, searchNotes],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault(): VaultValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside VaultProvider");
  return ctx;
}