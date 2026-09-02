import type { AppItem, Folder, Workspace } from "./types";
import type { GraphEdge, VaultNote } from "./vault";

/**
 * The unified knowledge graph.
 *
 * Two kinds of relationships, always computed from real data — never
 * hardcoded:
 *
 *  - explicit  — [[wiki links]] the user actually wrote inside their notes.
 *  - detected  — connections QynOne infers from the user's environment:
 *                a note mentioning an app/folder/workspace/favorite file,
 *                or structural ties like "app sits in folder".
 *
 * The UI must be able to tell the two apart (solid vs dashed), because one
 * was intentional and the other was inferred.
 */

export type GraphNodeType = "note" | "app" | "folder" | "workspace" | "file";

export interface GraphNode {
  /** unique id, e.g. "note:Projects/OUTBOUND.md" or "app:vscode" */
  id: string;
  type: GraphNodeType;
  label: string;
  sub?: string;
  /** key into the icon registry */
  icon: string;
  color: string;
  /** note folder (vault folders) — used for graph filtering */
  folder?: string;
  /** note tags — used for graph filtering */
  tags?: string[];
  /** original entity id (app id / folder id / workspace id / file path) */
  refId: string;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  kind: "explicit" | "detected";
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: KnowledgeEdge[];
}

const nid = { note: (p: string) => `note:${p}`, app: (id: string) => `app:${id}`, folder: (id: string) => `folder:${id}`, ws: (id: string) => `ws:${id}`, file: (p: string) => `file:${p}` };

/** Case-insensitive, word-boundary-ish mention check against note content. */
function mentions(content: string, name: string): boolean {
  if (!name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(content);
  } catch {
    return content.toLowerCase().includes(name.toLowerCase());
  }
}

export function buildGraphModel(
  notes: VaultNote[],
  explicitEdges: GraphEdge[],
  apps: AppItem[],
  folders: Folder[],
  workspaces: Workspace[],
  fileFavorites: string[],
): GraphModel {
  const nodes = new Map<string, GraphNode>();
  const edges: KnowledgeEdge[] = [];
  const seenEdges = new Set<string>();

  const addEdge = (a: string, b: string, kind: "explicit" | "detected") => {
    const key = [a, b].sort().join("|");
    if (seenEdges.has(key) || a === b) return;
    seenEdges.add(key);
    edges.push({ source: a, target: b, kind });
  };

  /* ---- note nodes (explicit relationships) ---- */
  for (const n of notes) {
    nodes.set(nid.note(n.id), { id: nid.note(n.id), type: "note", label: n.name, sub: n.folder || "vault root", icon: "fileText", color: "var(--accent)", folder: n.folder, tags: n.tags, refId: n.id });
  }
  for (const e of explicitEdges) {
    addEdge(nid.note(e.source), nid.note(e.target), "explicit");
  }

  /* ---- app nodes ---- */
  for (const a of apps) {
    nodes.set(nid.app(a.id), { id: nid.app(a.id), type: "app", label: a.name, sub: a.subtitle ?? "application", icon: a.icon, color: a.color, refId: a.id });
  }

  /* ---- virtual folder nodes ---- */
  for (const f of folders) {
    nodes.set(nid.folder(f.id), { id: nid.folder(f.id), type: "folder", label: f.name, sub: "virtual folder", icon: f.icon, color: f.color, refId: f.id });
  }

  /* ---- workspace nodes ---- */
  for (const w of workspaces) {
    nodes.set(nid.ws(w.id), { id: nid.ws(w.id), type: "workspace", label: w.name, sub: `${w.itemIds.length} apps`, icon: w.icon, color: w.color, refId: w.id });
  }

  /* ---- favorite file nodes ---- */
  for (const p of fileFavorites) {
    const name = p.split(/[\\/]/).pop() ?? p;
    nodes.set(nid.file(p), { id: nid.file(p), type: "file", label: name, sub: "favorite", icon: "fileText", color: "#8fb3ff", refId: p });
  }

  /* ---- detected relationships (computed from real data) ---- */
  for (const n of notes) {
    const content = n.content.toLowerCase();

    // note mentions an app / folder / workspace / favorite file
    for (const a of apps) {
      if (mentions(content, a.name) || mentions(content, a.name.replace(/\s+Edition$/, ""))) {
        addEdge(nid.note(n.id), nid.app(a.id), "detected");
      }
    }
    for (const f of folders) {
      if (mentions(content, f.name)) {
        addEdge(nid.note(n.id), nid.folder(f.id), "detected");
      }
    }
    for (const w of workspaces) {
      if (mentions(content, w.name)) {
        addEdge(nid.note(n.id), nid.ws(w.id), "detected");
      }
    }
    for (const p of fileFavorites) {
      const base = (p.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "");
      if (base && mentions(content, base)) {
        addEdge(nid.note(n.id), nid.file(p), "detected");
      }
    }

    // a note living in a vault folder that matches a virtual folder
    if (n.folder) {
      const hit = folders.find((f) => f.name.toLowerCase() === n.folder.toLowerCase());
      if (hit) addEdge(nid.note(n.id), nid.folder(hit.id), "detected");
    }
  }

  // structural: an app that sits inside a virtual folder
  for (const a of apps) {
    if (a.folderId) {
      addEdge(nid.app(a.id), nid.folder(a.folderId), "detected");
    }
  }

  // structural: a workspace contains apps
  for (const w of workspaces) {
    for (const appId of w.itemIds) {
      if (nodes.has(nid.app(appId))) {
        addEdge(nid.ws(w.id), nid.app(appId), "detected");
      }
    }
  }

  return { nodes: [...nodes.values()], edges };
}