import { getDesktop } from "./desktop";
import type {
  NexFolderEntry,
  NexFolderList,
  NexFolderInfo,
  NexOpResult,
  NexPickImportResult,
  NexReadResult,
} from "./desktop";

/**
 * Nex Folder — the ONE folder that belongs to Nex.
 *
 * The user deposits briefs and photos there ("here's what I want you to
 * work with") and Nex reads, writes and deletes files inside it. The
 * contract is deliberately tight: only `.md`, plain-text/code files and
 * images are allowed, and every operation is confined to the single
 * configured folder root.
 */

export const NEX_MD_EXT = [".md", ".markdown"] as const;
export const NEX_IMAGE_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"] as const;
export const NEX_TEXT_EXT = [
  ".txt", ".log", ".json", ".csv", ".xml", ".yaml", ".yml", ".ini", ".cfg", ".toml",
  ".lua", ".py", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".htm",
  ".c", ".h", ".cpp", ".cc", ".hpp", ".cs", ".java", ".go", ".rs", ".rb", ".php",
  ".sql", ".sh", ".bat", ".ps1", ".glsl", ".vert", ".frag", ".hlsl",
] as const;
export const NEX_IMAGE_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.bmp";
/** Accept string for <input type=file> — keep in sync with the main process. */
export const NEX_FILE_ACCEPT = [".md", ".markdown", ...NEX_TEXT_EXT, ...NEX_IMAGE_EXT].join(",");
export const NEX_MAX_MD = 500 * 1024; // 500 KB per text file (.md / text / code)
export const NEX_MAX_IMAGE = 20 * 1024 * 1024; // 20 MB per photo
export const NEX_MAX_DEPTH = 4; // root + 3 subfolders

export type NexFileKind = "md" | "text" | "image" | "other";

export const NEX_FOLDER_LABEL = "Nex Folder";

/** What Nex is allowed to act on for a given file name. */
export function kindOfFile(name: string): NexFileKind {
  const lower = String(name).toLowerCase();
  if (NEX_MD_EXT.some((e) => lower.endsWith(e))) return "md";
  if (NEX_TEXT_EXT.some((e) => lower.endsWith(e))) return "text";
  if (NEX_IMAGE_EXT.some((e) => lower.endsWith(e))) return "image";
  return "other";
}

export function isAllowedFile(name: string): boolean {
  return kindOfFile(name) !== "other";
}

/**
 * Normalize a user/file-picker supplied path into safe posix segments
 * ("Briefs/My Game.md"). Returns null when anything is invalid — same
 * rules the main process enforces as the final authority.
 */
export function sanitizeRelPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const segs = raw.split(/[\\/]/).map((s) => s.trim()).filter(Boolean);
  if (segs.length === 0 || segs.length > NEX_MAX_DEPTH) return null;
  if (segs.some((s) => s === "." || s === "..")) return null;
  for (const seg of segs) {
    if (seg.length > 120 || seg.startsWith(".") || /[<>:"|?*\u0000-\u001f]/.test(seg)) return null;
  }
  return segs.join("/");
}

export function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function fmtWhen(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/* Desktop bridge wrappers — safe no-ops in the web preview            */
/* ------------------------------------------------------------------ */

const NO_DESKTOP = "The Nex Folder lives on your PC — open this in the QynOne desktop app to use it.";

function bridge() {
  return getDesktop();
}

export async function nexFolderInfo(): Promise<NexFolderInfo | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.nexFolderInfo();
  } catch {
    return null;
  }
}

export async function nexFolderList(): Promise<NexFolderList | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.nexFolderList();
  } catch {
    return null;
  }
}

export async function nexFolderRead(rel: string, withData = false): Promise<NexReadResult> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    return await b.nexFolderRead(rel, withData);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/** Read a photo from the Nex folder as a data URL (used to send it to
 *  the model as a real image when vision is enabled). */
export async function nexFolderReadImage(rel: string): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    const r = await b.nexFolderRead(rel, true);
    if (!r.ok) return { ok: false, error: r.error };
    if (r.kind !== "image" || !r.dataUrl) return { ok: false, error: "not an image" };
    return { ok: true, dataUrl: r.dataUrl };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

export async function nexFolderWrite(rel: string, content: string): Promise<NexOpResult> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    return await b.nexFolderWrite(rel, content);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

export async function nexFolderDelete(rel: string): Promise<NexOpResult> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    return await b.nexFolderDelete(rel);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

export async function nexFolderImport(rel: string, dataUrl: string): Promise<NexOpResult> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    return await b.nexFolderImport(rel, dataUrl);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

export async function nexFolderChoose(): Promise<(NexOpResult & NexFolderInfo) | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.nexFolderChoose();
  } catch {
    return null;
  }
}

export async function nexFolderReset(): Promise<(NexOpResult & NexFolderInfo) | null> {
  const b = bridge();
  if (!b) return null;
  try {
    return await b.nexFolderReset();
  } catch {
    return null;
  }
}

export async function nexFolderReveal(rel?: string): Promise<{ ok: boolean; error?: string }> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    return await b.nexFolderReveal(rel);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/** OS file picker → validated copies land in Chat/ inside the Nex folder. */
export async function nexFolderPickImport(): Promise<NexPickImportResult> {
  const b = bridge();
  if (!b) return { ok: false, error: NO_DESKTOP };
  try {
    return await b.nexFolderPickImport();
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

/** True when a drop/picked file may go into the Nex folder. */
export function importErrorFor(file: { name: string; size: number }): string | null {
  const kind = kindOfFile(file.name);
  if (kind === "other") {
    return "Only .md, text/code and photo files (png, jpg, jpeg, gif, webp, bmp) can be deposited into the Nex folder.";
  }
  if ((kind === "md" || kind === "text") && file.size > NEX_MAX_MD) return "That file is too large (max 500 KB).";
  if (kind === "image" && file.size > NEX_MAX_IMAGE) return "That photo is too large (max 20 MB).";
  return null;
}

/**
 * Read a local File (picker / drag-and-drop) into a data URL and derive
 * its safe relative path inside the Nex folder. Returns { error } when
 * the file is not allowed.
 */
export function readFileForFolder(file: File): Promise<{ rel: string; dataUrl: string } | { error: string }> {
  return new Promise((resolve) => {
    const problem = importErrorFor({ name: file.name, size: file.size });
    if (problem) {
      resolve({ error: problem });
      return;
    }
    const rel = sanitizeRelPath(file.webkitRelativePath || file.name);
    if (!rel) {
      resolve({ error: "That file name isn't allowed — use letters, numbers, spaces, dashes and dots only." });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => resolve({ error: "Couldn't read that file." });
    reader.onload = () => {
      if (typeof reader.result === "string") resolve({ rel, dataUrl: reader.result });
      else resolve({ error: "Couldn't read that file." });
    };
    reader.readAsDataURL(file);
  });
}

/** Display a short summary of an entry for tool results and traces. */
export function describeEntry(entry: NexFolderEntry): string {
  if (entry.isDir) return `${entry.rel}/ (folder)`;
  const kind = entry.kind === "md" ? ".md" : entry.kind === "text" ? "text/code" : entry.kind === "image" ? "photo" : "file";
  return `${entry.rel} — ${kind}, ${fmtBytes(entry.size)}, ${fmtWhen(entry.mtimeMs)}`;
}

/** Deterministic slug (first meaningful words) for a long chat message file. */
export function slugForChat(text: string): string {
  const words = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 6)
    .join("-");
  return (words || "message").replace(/-+/g, "-").slice(0, 48);
}

/** Relative path for a long chat message: Chat/<slug>-<timestamp>.md */
export function chatFileNameFor(text: string, now: Date = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `Chat/${slugForChat(text)}-${stamp}.md`;
}
