/**
 * QynOne — main process.
 *
 * A real Windows application built on Electron (the same foundation as
 * VS Code and Discord). Everything the user owns lives on their PC:
 *
 *  - State: a JSON file in the per-user data folder ( %APPDATA%\QynOne ),
 *    written with ordinary user permissions — no admin anywhere.
 *  - Launching: apps start through Windows' normal shell (ShellExecute at
 *    the current user's token), exactly like a double-click. QynOne never
 *    requests elevation and never bypasses Windows security. If an app
 *    itself needs admin, Windows' own UAC prompt decides.
 *  - Virtual folders: pure metadata. QynOne never moves, copies, renames
 *    or touches the real applications on the PC.
 */

const { app, BrowserWindow, dialog, ipcMain, shell, screen } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { createMcpRuntime } = require("./mcpClient.cjs");

const IS_DEV = Boolean(process.env.VITE_DEV_SERVER_URL);

app.setName("QynOne");

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#070809",
    title: "QynOne",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow = win;
  win.once("ready-to-show", () => win.show());

  if (IS_DEV) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  /* The floating Nex lives and dies with QynOne: closing the main window
     hides it too (it never stays behind as an orphan overlay). */
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
    closeFloatWindow();
  });

  return win;
}

/* ------------------------------------------------------------------ */
/* Floating Nex — an always-on-top companion window                    */
/* ------------------------------------------------------------------ */

let floatWindow = null;

const FLOAT_W = 300;
const FLOAT_H = 210;

function isFloatAlive() {
  return Boolean(floatWindow && !floatWindow.isDestroyed());
}

function floatState() {
  return { open: isFloatAlive() };
}

function broadcastFloatState() {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("qyn:float-changed", floatState());
  }
}

function positionFloatBottomLeft(win) {
  try {
    const display = screen.getPrimaryDisplay();
    const wa = display.workArea;
    const [bw, bh] = win.getSize();
    win.setPosition(Math.round(wa.x + 20), Math.round(wa.y + wa.height - bh - 20), false);
  } catch {
    // keep the OS default position
  }
}

function openFloatWindow() {
  if (isFloatAlive()) {
    floatWindow.showInactive();
    return floatWindow;
  }
  const win = new BrowserWindow({
    width: FLOAT_W,
    height: FLOAT_H,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    title: "Nex",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  floatWindow = win;

  /* Stay above fullscreen/borderless games. Opened with showInactive() so
     it never steals focus from the game; clicking it (or double-clicking to
     close) still works because the window remains focusable. */
  win.setAlwaysOnTop(true, "screen-saver");
  positionFloatBottomLeft(win);

  win.once("ready-to-show", () => win.showInactive());

  if (IS_DEV) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#float`);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"), { hash: "float" });
  }

  win.on("closed", () => {
    if (floatWindow === win) floatWindow = null;
    broadcastFloatState();
  });

  broadcastFloatState();
  return win;
}

function closeFloatWindow() {
  if (isFloatAlive()) floatWindow.close();
}

ipcMain.handle("qyn:float-toggle", () => {
  if (isFloatAlive()) {
    closeFloatWindow();
    return { open: false };
  }
  openFloatWindow();
  return { open: true };
});

ipcMain.handle("qyn:float-state", () => floatState());

ipcMain.handle("qyn:float-close", () => {
  closeFloatWindow();
  return floatState();
});

/* ------------------------------------------------------------------ */
/* State file                                                          */
/* ------------------------------------------------------------------ */

function stateFilePath() {
  return path.join(app.getPath("userData"), "qynone-state.json");
}

async function loadStateFile() {
  try {
    const raw = await fsPromises.readFile(stateFilePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Launching the real applications                                     */
/* ------------------------------------------------------------------ */

/**
 * Start-menu / desktop shortcut discovery for "Find on this PC".
 * Reads shortcut names only (user-level, no admin) and returns .lnk/.url
 * files; opening one with ShellExecute runs the app at the user's token.
 */
function shortcutRoots() {
  const roots = [];
  if (process.platform === "win32") {
    const appData = app.getPath("appData"); // %APPDATA%
    const programData = process.env.ProgramData;
    const home = app.getPath("home"); // %USERPROFILE%
    roots.push(path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs"));
    roots.push(path.join(home, "Desktop"));
    if (programData) roots.push(path.join(programData, "Microsoft", "Windows", "Start Menu", "Programs"));
  }
  return roots;
}

function walkShortcuts(dir, query, out, seen, depth) {
  if (depth > 4) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        walkShortcuts(full, query, out, seen, depth + 1);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (!lower.endsWith(".lnk") && !lower.endsWith(".url")) continue;
        if (seen.has(full.toLowerCase())) continue;
        seen.add(full.toLowerCase());
        const name = entry.name.replace(/\.(lnk|url)$/i, "");
        if (query && !name.toLowerCase().includes(query)) continue;
        out.push({ name, path: full });
      }
    } catch {
      // skip unreadable entries
    }
  }
}

async function findShortcuts(query) {
  if (typeof query !== "string") return [];
  const q = query.trim().toLowerCase();
  const out = [];
  const seen = new Set();
  for (const root of shortcutRoots()) {
    walkShortcuts(root, q, out, seen, 0);
  }
  return out.slice(0, q ? 24 : 400);
}

/**
 * Launch a target the user configured:
 *  - .lnk/.url/.exe or plain filesystem paths -> openPath (ShellExecute)
 *  - file:// links                              -> openPath
 *  - everything else (https://, steam://, ...)  -> openExternal
 * Never spawns arbitrary commands.
 */
async function launchTarget(target) {
  if (typeof target !== "string" || !target.trim()) {
    return { ok: false, error: "no launch target set" };
  }
  const t = target.trim();
  try {
    if (t.startsWith("file://")) {
      const p = fileURLToPath(t);
      const err = await shell.openPath(p);
      return err ? { ok: false, error: err } : { ok: true };
    }
    if (
      /^[A-Za-z]:[\\/]/.test(t) ||
      t.startsWith("\\\\") ||
      t.startsWith("/") ||
      t.startsWith("./") ||
      t.startsWith("../")
    ) {
      const p = path.resolve(t);
      if (!fs.existsSync(p)) return { ok: false, error: "path not found" };
      const err = await shell.openPath(p);
      return err ? { ok: false, error: err } : { ok: true };
    }
    await shell.openExternal(t);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/* ------------------------------------------------------------------ */
/* Live stats — real CPU (sampled), RAM, uptime                       */
/* ------------------------------------------------------------------ */

let lastCpuSample = null;

function sampleCpuPct() {
  const cpus = os.cpus();
  const now = process.hrtime.bigint();
  if (!cpus || cpus.length === 0) return 0;
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  const sample = { at: now, idle, total };
  if (!lastCpuSample) {
    lastCpuSample = sample;
    return 0;
  }
  const dTotal = total - lastCpuSample.total;
  const dIdle = idle - lastCpuSample.idle;
  lastCpuSample = sample;
  if (dTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - dIdle / dTotal) * 100)));
}

ipcMain.handle("qyn:stats", () => {
  const memTotal = os.totalmem();
  return {
    cpuPct: sampleCpuPct(),
    memUsedBytes: memTotal - os.freemem(),
    memTotalBytes: memTotal,
    uptimeSec: Math.floor(os.uptime()),
    platform: process.platform,
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpuModel: os.cpus().length > 0 ? os.cpus()[0].model : null,
    cores: os.cpus().length,
  };
});

/* ------------------------------------------------------------------ */
/* File system — browsing, opening, searching (read-only user level)   */
/* ------------------------------------------------------------------ */

const HOME_ROOTS = ["Documents", "Downloads", "Desktop", "Pictures", "Videos", "Music"];

function userHome() {
  return app.getPath("home");
}

async function listDir(dir) {
  if (typeof dir !== "string" || !dir.trim()) return null;
  let entries;
  try {
    entries = await fsPromises.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const out = [];
  for (const entry of entries.slice(0, 600)) {
    const full = path.join(dir, entry.name);
    try {
      const st = await fsPromises.lstat(full);
      out.push({
        name: entry.name,
        path: full,
        isDir: entry.isDirectory(),
        size: st.size,
        mtimeMs: st.mtimeMs,
      });
    } catch {
      // skip unreadable entries
    }
  }
  out.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return out;
}

function walkFiles(dir, query, out, seen, depth) {
  if (depth > 4 || out.length >= 14) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= 14) return;
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        if (depth < 4) walkFiles(full, query, out, seen, depth + 1);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (!lower.includes(query)) continue;
        const key = full.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name: entry.name, path: full });
      }
    } catch {
      // skip unreadable entries
    }
  }
}

async function searchFiles(query) {
  if (typeof query !== "string") return [];
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const home = userHome();
  const out = [];
  const seen = new Set();
  for (const root of HOME_ROOTS) {
    walkFiles(path.join(home, root), q, out, seen, 0);
  }
  return out.slice(0, 14);
}

async function openPath(p) {
  if (typeof p !== "string" || !p.trim()) return { ok: false, error: "no path" };
  try {
    const err = await shell.openPath(p);
    return err ? { ok: false, error: err } : { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/* ------------------------------------------------------------------ */
/* Markdown Vault — a real folder of .md files on the user's PC.       */
/* The files themselves are the source of truth; QynOne only reads     */
/* and writes them (user-level, no admin).                             */
/* ------------------------------------------------------------------ */

function vaultRoot() {
  return path.join(app.getPath("documents"), "QynOneVault");
}

/** Ensure a relative vault path stays inside the vault root. */
function vaultSafe(rel) {
  if (typeof rel !== "string" || !rel.trim()) return null;
  const root = path.resolve(vaultRoot());
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

async function ensureVault() {
  await fsPromises.mkdir(vaultRoot(), { recursive: true });
}

function walkVault(dir, rel, folders, notes, depth) {
  if (depth > 10) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    try {
      if (entry.isDirectory()) {
        folders.push(relPath);
        walkVault(full, relPath, folders, notes, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const content = fs.readFileSync(full, "utf8");
        notes.push({ path: relPath, name: entry.name.slice(0, -3), folder: rel ? rel : "", content });
      }
    } catch {
      // skip unreadable entries
    }
  }
}

async function readVaultTree() {
  await ensureVault();
  const folders = [];
  const notes = [];
  walkVault(vaultRoot(), "", folders, notes, 0);
  folders.sort((a, b) => a.localeCompare(b));
  return { folders, notes };
}

ipcMain.handle("qyn:vault-root", async () => {
  await ensureVault();
  return vaultRoot();
});

ipcMain.handle("qyn:vault-tree", () => readVaultTree());

/* Auto-rescan: watch the vault folder so the graph re-marks itself whenever
   the .md files change — even when they're edited outside QynOne. */
let vaultWatcher = null;
let vaultWatchTimer = null;

function startVaultWatcher() {
  if (vaultWatcher) return;
  const root = vaultRoot();
  try {
    fsPromises.mkdir(root, { recursive: true }).then(() => {
      try {
        vaultWatcher = fs.watch(root, { recursive: true }, () => {
          if (vaultWatchTimer) clearTimeout(vaultWatchTimer);
          vaultWatchTimer = setTimeout(() => {
            for (const win of BrowserWindow.getAllWindows()) {
              win.webContents.send("qyn:vault-changed");
            }
          }, 400);
        });
      } catch {
        vaultWatcher = null; // recursive watch unsupported → UI polls instead
      }
    });
  } catch {
    vaultWatcher = null;
  }
}

app.whenReady().then(() => {
  createWindow();
  startVaultWatcher();
  initMcp();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

ipcMain.handle("qyn:vault-read", async (_event, rel) => {
  const full = vaultSafe(rel);
  if (!full) return null;
  try {
    return await fsPromises.readFile(full, "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("qyn:vault-write", async (_event, rel, content) => {
  const full = vaultSafe(rel);
  if (!full || typeof content !== "string") return { ok: false, error: "invalid path or content" };
  if (!full.toLowerCase().endsWith(".md")) return { ok: false, error: "only .md files can be written" };
  try {
    await fsPromises.mkdir(path.dirname(full), { recursive: true });
    await fsPromises.writeFile(full, content, "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("qyn:vault-rename", async (_event, oldRel, newRel) => {
  const oldFull = vaultSafe(oldRel);
  const newFull = vaultSafe(newRel);
  if (!oldFull || !newFull) return { ok: false, error: "invalid path" };
  try {
    await fsPromises.mkdir(path.dirname(newFull), { recursive: true });
    await fsPromises.rename(oldFull, newFull);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("qyn:vault-delete", async (_event, rel) => {
  const full = vaultSafe(rel);
  if (!full) return { ok: false, error: "invalid path" };
  try {
    await fsPromises.rm(full, { recursive: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("qyn:vault-mkdir", async (_event, rel) => {
  const full = vaultSafe(rel);
  if (!full) return { ok: false, error: "invalid path" };
  try {
    await fsPromises.mkdir(full, { recursive: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

/* ------------------------------------------------------------------ */
/* Nex Folder — the ONE folder that belongs to Nex.                    */
/*                                                                     */
/* The user deposits briefs (.md), text/code files and photos there and  */
/* asks Nex to work from them. Nex may freely read, create, edit and     */
/* delete files INSIDE this folder — but only .md, text/code and image   */
/* files, and only within this root. Every handler re-validates the      */
/* file extension, so no tool can reach outside or touch other types.   */
/* ------------------------------------------------------------------ */

const NEX_MD_EXT = [".md", ".markdown"];
const NEX_IMAGE_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};
const NEX_IMAGE_LIMIT = 20 * 1024 * 1024; // 20 MB per photo
const NEX_MD_LIMIT = 500 * 1024; // 500 KB per text file (.md and text/code)
/* Plain-text & code types Nex may read/write/deposit — the user chose to
   open the folder beyond .md. Keep in sync with src/lib/nexfolder.ts. */
const NEX_TEXT_EXT = [
  ".txt", ".log", ".json", ".csv", ".xml", ".yaml", ".yml", ".ini", ".cfg", ".toml",
  ".lua", ".py", ".js", ".jsx", ".ts", ".tsx", ".css", ".html", ".htm",
  ".c", ".h", ".cpp", ".cc", ".hpp", ".cs", ".java", ".go", ".rs", ".rb", ".php",
  ".sql", ".sh", ".bat", ".ps1", ".glsl", ".vert", ".frag", ".hlsl",
];

function nexConfigFile() {
  return path.join(app.getPath("userData"), "qynone-nex.json");
}

function nexDefaultRoot() {
  return path.join(app.getPath("documents"), "QynOneNex");
}

async function nexConfiguredPath() {
  try {
    const raw = await fsPromises.readFile(nexConfigFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.path === "string" && parsed.path.trim()) return parsed.path.trim();
  } catch {
    // no config yet — default folder
  }
  return nexDefaultRoot();
}

async function nexSavePath(p) {
  const file = nexConfigFile();
  await fsPromises.mkdir(path.dirname(file), { recursive: true });
  await fsPromises.writeFile(file, JSON.stringify({ path: p }, null, 2), "utf8");
}

/** "md" | "image" | "other" — what Nex is allowed to touch. */
function nexKindOf(name) {
  const lower = String(name).toLowerCase();
  if (NEX_MD_EXT.some((e) => lower.endsWith(e))) return "md";
  if (NEX_TEXT_EXT.some((e) => lower.endsWith(e))) return "text";
  if (Object.prototype.hasOwnProperty.call(NEX_IMAGE_MIME, lower.slice(lower.lastIndexOf(".")))) return "image";
  return "other";
}

/** Normalize a tool/UI-supplied relative path into safe posix segments. */
function nexSanitizeRel(raw) {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const segs = String(raw)
    .split(/[\\/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== "." && s !== "..");
  if (segs.length === 0 || segs.length > 4) return null;
  if (segs.some((s) => s.length > 120 || /[<>:"|?*\u0000-\u001f]/.test(s) || s.startsWith("."))) return null;
  return segs.join("/");
}

/** Resolve a sanitized relative path and make sure it stays inside the root. */
async function nexResolve(rel) {
  const clean = nexSanitizeRel(rel);
  if (!clean) return { error: "invalid path" };
  const root = path.resolve(await nexConfiguredPath());
  const full = path.resolve(root, clean);
  if (full !== root && !full.startsWith(root + path.sep)) return { error: "path escapes the Nex folder" };
  return { root, full, rel: clean };
}

function nexEntry(root, rel, name, entry, st) {
  const kind = entry.isDirectory() ? "dir" : nexKindOf(name);
  return {
    name,
    rel,
    isDir: entry.isDirectory(),
    kind,
    allowed: kind === "md" || kind === "text" || kind === "image",
    size: entry.isDirectory() ? 0 : st.size,
    mtimeMs: st.mtimeMs,
  };
}

function nexWalk(dir, root, base, entries, depth) {
  if (depth > 3 || entries.length >= 800) return;
  let list;
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of list) {
    if (entries.length >= 800) return;
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    try {
      const st = fs.statSync(full);
      entries.push(nexEntry(root, rel, entry.name, entry, st));
      if (entry.isDirectory()) nexWalk(full, root, rel, entries, depth + 1);
    } catch {
      // skip unreadable entries
    }
  }
}

async function nexInfo() {
  const root = await nexConfiguredPath();
  const custom = path.resolve(root) !== path.resolve(nexDefaultRoot());
  let exists = false;
  try {
    exists = (await fsPromises.stat(root)).isDirectory();
  } catch {
    exists = false;
  }
  return { root, custom, exists };
}

async function nexEnsureRoot() {
  const root = path.resolve(await nexConfiguredPath());
  await fsPromises.mkdir(root, { recursive: true });
  return root;
}

ipcMain.handle("qyn:nex-folder-info", async () => nexInfo());

ipcMain.handle("qyn:nex-folder-list", async () => {
  const info = await nexInfo();
  const entries = [];
  if (info.exists) {
    const root = path.resolve(info.root);
    nexWalk(root, root, "", entries, 0);
    entries.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  }
  return { ...info, entries };
});

ipcMain.handle("qyn:nex-folder-read", async (_event, rel, withData) => {
  const resolved = await nexResolve(rel);
  if (resolved.error) return { ok: false, error: resolved.error };
  const { root, full } = resolved;
  const name = path.basename(full);
  const kind = nexKindOf(name);
  if (kind === "other") return { ok: false, error: "only .md, text/code and photo files can be read from the Nex folder" };
  try {
    const st = await fsPromises.lstat(full);
    if (st.isSymbolicLink()) return { ok: false, error: "links are not allowed inside the Nex folder" };
    if (!st.isFile()) return { ok: false, error: "not a file" };
    if (kind === "md" || kind === "text") {
      if (st.size > NEX_MD_LIMIT) return { ok: false, error: "that file is too large to read here" };
      const content = await fsPromises.readFile(full, "utf8");
      return { ok: true, kind, name, rel: resolved.rel, size: st.size, content };
    }
    if (st.size > NEX_IMAGE_LIMIT) return { ok: false, error: "that photo is too large to read here" };
    const buf = await fsPromises.readFile(full);
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    const mime = NEX_IMAGE_MIME[ext] || "application/octet-stream";
    const result = { ok: true, kind: "image", name, rel: resolved.rel, size: st.size, mime };
    if (withData) result.dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    return result;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("qyn:nex-folder-write", async (_event, rel, content) => {
  if (typeof content !== "string") return { ok: false, error: "invalid content" };
  if (content.length > NEX_MD_LIMIT) return { ok: false, error: "that file is too large to write (max 500 KB)" };
  const resolved = await nexResolve(rel);
  if (resolved.error) return { ok: false, error: resolved.error };
  const kind = nexKindOf(path.basename(resolved.full));
  if (kind !== "md" && kind !== "text")
    return { ok: false, error: "Nex can only write .md and text/code files into the folder — photos are added by you." };
  try {
    /* Never write through a symlink: a link with an allowed extension could
       point outside the folder and break the boundary. lstat sees the link
       itself, so a new file (ENOENT) still passes. */
    const existing = await fsPromises.lstat(resolved.full).catch(() => null);
    if (existing && existing.isSymbolicLink())
      return { ok: false, error: "links are not allowed inside the Nex folder" };
    await nexEnsureRoot();
    await fsPromises.mkdir(path.dirname(resolved.full), { recursive: true });
    await fsPromises.writeFile(resolved.full, content, "utf8");
    return { ok: true, rel: resolved.rel };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("qyn:nex-folder-delete", async (_event, rel) => {
  const resolved = await nexResolve(rel);
  if (resolved.error) return { ok: false, error: resolved.error };
  const kind = nexKindOf(path.basename(resolved.full));
  if (kind === "other") return { ok: false, error: "only .md, text/code and photo files in the Nex folder can be deleted" };
  try {
    const st = await fsPromises.lstat(resolved.full);
    if (st.isSymbolicLink()) return { ok: false, error: "links are not allowed inside the Nex folder" };
    if (st.isDirectory()) return { ok: false, error: "folders themselves are managed by you in Explorer — Nex can delete files inside them." };
    await fsPromises.rm(resolved.full);
    return { ok: true, rel: resolved.rel };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("qyn:nex-folder-import", async (_event, rel, dataUrl) => {
  const clean = nexSanitizeRel(rel);
  if (!clean) return { ok: false, error: "invalid file name" };
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!m) return { ok: false, error: "invalid file data" };
  const buf = Buffer.from(m[3], "base64");
  const name = clean.split("/").pop();
  const kind = nexKindOf(name);
  if (kind === "md" || kind === "text") {
    if (buf.length > NEX_MD_LIMIT) return { ok: false, error: "that file is too large" };
  } else if (kind === "image") {
    if (buf.length > NEX_IMAGE_LIMIT) return { ok: false, error: "that photo is too large (max 20 MB)" };
    const mediaType = String(m[1] || "").toLowerCase();
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    const expected = NEX_IMAGE_MIME[ext];
    if (mediaType && expected && mediaType !== expected && !mediaType.startsWith("image/")) {
      return { ok: false, error: "file content does not match its extension" };
    }
  } else {
    return { ok: false, error: "Only .md, text/code and photo files (png, jpg, jpeg, gif, webp, bmp) can be deposited into the Nex folder." };
  }
  try {
    const root = await nexEnsureRoot();
    const full = path.resolve(root, clean);
    if (full !== root && !full.startsWith(root + path.sep)) return { ok: false, error: "path escapes the Nex folder" };
    await fsPromises.mkdir(path.dirname(full), { recursive: true });
    await fsPromises.writeFile(full, kind === "image" ? buf : buf.toString("utf8"));
    return { ok: true, rel: clean };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

/* Chat attachments — one OS dialog, then every chosen file is validated
   against the same rules and copied into Chat/ inside the Nex folder.
   Everything stays confined to the root; only allowed types are copied. */
const NEX_DIALOG_EXTS = [
  ...new Set([
    ...NEX_MD_EXT.map((e) => e.replace(/^\./, "")),
    ...NEX_TEXT_EXT.map((e) => e.replace(/^\./, "")),
    ...Object.keys(NEX_IMAGE_MIME).map((e) => e.replace(/^\./, "")),
  ]),
];

function nexUniqueChatName(root, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = name;
  let n = 2;
  while (fs.existsSync(path.join(root, "Chat", candidate))) {
    candidate = `${base} (${n})${ext}`;
    n += 1;
    if (n > 99) break;
  }
  return candidate;
}

ipcMain.handle("qyn:nex-folder-pick-import", async () => {
  const options = {
    title: "Send files to Nex",
    buttonLabel: "Send to the Nex Folder",
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Nex files (.md, text & code, photos)", extensions: NEX_DIALOG_EXTS }],
  };
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return { ok: true, canceled: true, imported: [], errors: [] };
  let root;
  try {
    root = await nexEnsureRoot();
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), imported: [], errors: [] };
  }
  const imported = [];
  const errors = [];
  for (const filePath of result.filePaths) {
    const name = path.basename(filePath);
    const kind = nexKindOf(name);
    if (kind === "other" || name.startsWith(".")) {
      errors.push({ name, error: "Only .md, text/code and photo files can be sent — this type isn't allowed in the Nex Folder." });
      continue;
    }
    try {
      const buf = await fsPromises.readFile(filePath);
      if ((kind === "md" || kind === "text") && buf.length > NEX_MD_LIMIT) {
        errors.push({ name, error: "too large (max 500 KB)" });
        continue;
      }
      if (kind === "image" && buf.length > NEX_IMAGE_LIMIT) {
        errors.push({ name, error: "too large (max 20 MB)" });
        continue;
      }
      const chatDir = path.join(root, "Chat");
      await fsPromises.mkdir(chatDir, { recursive: true });
      const targetName = nexUniqueChatName(root, name);
      await fsPromises.writeFile(path.join(chatDir, targetName), kind === "image" ? buf : buf.toString("utf8"));
      imported.push({ rel: `Chat/${targetName}`, name: targetName, kind });
    } catch (e) {
      errors.push({ name, error: String((e && e.message) || e) });
    }
  }
  return { ok: true, imported, errors };
});

ipcMain.handle("qyn:nex-folder-choose", async () => {
  const options = {
    title: "Choose the one Nex folder",
    properties: ["openDirectory", "createDirectory"],
    message: "Nex gets read/write/delete access to this folder and ONLY this folder — limited to .md, text/code and photo files.",
  };
  const win = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true, ...(await nexInfo()) };
  try {
    const chosen = path.resolve(result.filePaths[0]);
    await nexSavePath(chosen);
    await nexEnsureRoot();
    return { ok: true, ...(await nexInfo()) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), ...(await nexInfo()) };
  }
});

ipcMain.handle("qyn:nex-folder-reset", async () => {
  try {
    await nexSavePath(nexDefaultRoot());
    await nexEnsureRoot();
    return { ok: true, ...(await nexInfo()) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), ...(await nexInfo()) };
  }
});

ipcMain.handle("qyn:nex-folder-reveal", async (_event, rel) => {
  if (!rel) {
    const info = await nexInfo();
    if (!info.exists) await nexEnsureRoot();
    return openPath(info.root);
  }
  const resolved = await nexResolve(rel);
  if (resolved.error) return { ok: false, error: resolved.error };
  return openPath(resolved.full);
});

/* ------------------------------------------------------------------ */
/* AI configuration — stored as a plain .env file in the user data     */
/* folder ( %APPDATA%\QynOne\qynone.env ). The API key never leaves    */
/* the user's PC and is never logged.                                  */
/* ------------------------------------------------------------------ */

function aiConfigFile() {
  return path.join(app.getPath("userData"), "qynone.env");
}

function parseEnvFile(raw) {
  const out = {};
  for (const line of String(raw).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

ipcMain.handle("qyn:ai-config-get", async () => {
  try {
    const raw = await fsPromises.readFile(aiConfigFile(), "utf8");
    const env = parseEnvFile(raw);
    return {
      provider: env.QYNONE_AI_PROVIDER || "ollama",
      endpoint: env.QYNONE_AI_ENDPOINT || "",
      model: env.QYNONE_AI_MODEL || "",
      key: env.QYNONE_AI_KEY || "",
    };
  } catch {
    return null;
  }
});

ipcMain.handle("qyn:ai-config-set", async (_event, cfg) => {
  try {
    const c = cfg && typeof cfg === "object" ? cfg : {};
    const lines = [
      `QYNONE_AI_PROVIDER=${String(c.provider || "ollama").replace(/[^a-z0-9_-]/gi, "")}`,
      `QYNONE_AI_ENDPOINT=${String(c.endpoint || "")}`,
      `QYNONE_AI_MODEL=${String(c.model || "")}`,
      `QYNONE_AI_KEY=${String(c.key || "")}`,
    ];
    const file = aiConfigFile();
    await fsPromises.mkdir(path.dirname(file), { recursive: true });
    await fsPromises.writeFile(file, lines.join("\n") + "\n", "utf8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

/* ------------------------------------------------------------------ */
/* Screenshot — save a captured PNG into Pictures/QynOne              */
/* ------------------------------------------------------------------ */

async function saveScreenshot(dataUrl) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
    return { ok: false, error: "invalid image data" };
  }
  try {
    const base64 = dataUrl.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    const folder = path.join(app.getPath("pictures"), "QynOne");
    await fsPromises.mkdir(folder, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(folder, `qynone-${stamp}.png`);
    await fsPromises.writeFile(file, buf);
    return { ok: true, path: file };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */

ipcMain.handle("qyn:load-state", async () => {
  const state = await loadStateFile();
  if (!state || typeof state !== "object" || !Array.isArray(state.apps)) return null;
  return state;
});

ipcMain.handle("qyn:save-state", async (_event, state) => {
  if (!state || typeof state !== "object" || !Array.isArray(state.apps)) {
    return { ok: false };
  }
  try {
    const file = stateFilePath();
    await fsPromises.mkdir(path.dirname(file), { recursive: true });
    await fsPromises.writeFile(file, JSON.stringify(state, null, 2), "utf8");
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("qyn:launch", (_event, target) => launchTarget(target));

ipcMain.handle("qyn:find-shortcuts", (_event, query) => findShortcuts(query));

/* Real machine facts — all plain user-level reads (os.hostname, os.cpus, …). */
ipcMain.handle("qyn:system-info", () => {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: process.platform,
    release: os.release(),
    arch: os.arch(),
    cpuModel: cpus.length > 0 ? cpus[0].model : null,
    cores: cpus.length,
    totalMemBytes: os.totalmem(),
  };
});

ipcMain.handle("qyn:list-dir", (_event, dir) => listDir(dir));

/* The user's home directory ( C:\Users\<name> ) — used to build quick roots. */
ipcMain.handle("qyn:home-dir", () => {
  try {
    return app.getPath("home");
  } catch {
    return null;
  }
});

ipcMain.handle("qyn:open-path", (_event, p) => openPath(p));

ipcMain.handle("qyn:search-files", (_event, query) => searchFiles(query));

ipcMain.handle("qyn:save-screenshot", (_event, dataUrl) => saveScreenshot(dataUrl));

/* ------------------------------------------------------------------ */
/* Start with Windows — a real per-user Run entry (HKCU).               */
/* Electron's login-item API points the entry at the actual QynOne      */
/* executable, at the current user's token — no admin, no Startup       */
/* folder hacks. In dev it's disabled because process.execPath is       */
/* electron.exe, which would autostart the wrong thing.                 */
/* ------------------------------------------------------------------ */

function autostartState() {
  try {
    const s = app.getLoginItemSettings();
    return { enabled: Boolean(s.openAtLogin), available: !IS_DEV };
  } catch {
    return { enabled: false, available: false };
  }
}

ipcMain.handle("qyn:autostart-get", () => autostartState());

ipcMain.handle("qyn:autostart-set", (_event, enabled) => {
  try {
    if (IS_DEV) {
      return { ok: false, enabled: false, error: "Start with Windows is only available in the installed QynOne app." };
    }
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    const after = app.getLoginItemSettings();
    return { ok: true, enabled: Boolean(after.openAtLogin) };
  } catch (e) {
    return { ok: false, enabled: false, error: String((e && e.message) || e) };
  }
});

/* ------------------------------------------------------------------ */
/* MCP connections — Roblox Studio, Unreal Engine and any MCP server.  */
/* Nex drives real engines through the same tool loop as QynOne tools. */
/* Each server config is a small stdio or HTTP client (mcpClient.cjs). */
/* ------------------------------------------------------------------ */

function mcpConfigFile() {
  return path.join(app.getPath("userData"), "qynone-mcp.json");
}

async function loadMcpConfigs() {
  try {
    const raw = await fsPromises.readFile(mcpConfigFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c) => c && typeof c === "object" && c.id && c.name && (c.transport === "stdio" || c.transport === "http"));
    }
  } catch {
    // no file yet — first run
  }
  return [];
}

async function saveMcpConfigs(configs) {
  const file = mcpConfigFile();
  await fsPromises.mkdir(path.dirname(file), { recursive: true });
  await fsPromises.writeFile(file, JSON.stringify(configs, null, 2), "utf8");
}

/* id -> runtime (mcpClient). A runtime only exists once a connection has
   been attempted; configs without a runtime read as state "idle". */
const mcpRuntimes = new Map();
let mcpConfigsCache = [];

function mcpConfig(id) {
  return mcpConfigsCache.find((c) => c.id === id) || null;
}

function mcpStatus(config) {
  const runtime = mcpRuntimes.get(config.id);
  if (runtime) return runtime.snapshot();
  return {
    id: config.id,
    name: config.name,
    transport: config.transport,
    command: config.command || "",
    args: config.args || [],
    url: config.url || "",
    env: config.env || {},
    autoConnect: config.autoConnect !== false,
    state: "idle",
    error: "",
    log: [],
    tools: [],
  };
}

function mcpStatuses() {
  return mcpConfigsCache.map(mcpStatus);
}

function mcpBroadcast() {
  const list = mcpStatuses();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("qyn:mcp-changed", list);
  }
}

function mcpEnsureRuntime(config) {
  let runtime = mcpRuntimes.get(config.id);
  if (!runtime || runtime.state === "error") {
    if (runtime) {
      runtime.stop().catch(() => {});
      mcpRuntimes.delete(config.id);
    }
    runtime = createMcpRuntime(config);
    mcpRuntimes.set(config.id, runtime);
  }
  return runtime;
}

async function mcpConnect(id) {
  const config = mcpConfig(id);
  if (!config) return { ok: false, error: "Unknown connection." };
  const runtime = mcpEnsureRuntime(config);
  try {
    await runtime.start();
    return { ok: true, status: runtime.snapshot() };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), status: runtime.snapshot() };
  } finally {
    mcpBroadcast();
  }
}

async function mcpDisconnect(id) {
  const runtime = mcpRuntimes.get(id);
  if (runtime) {
    await runtime.stop().catch(() => {});
    mcpRuntimes.delete(id);
  }
  mcpBroadcast();
  return { ok: true };
}

function isConnectionFailure(message) {
  return /Could not reach|ECONNREFUSED|fetch failed|process ended|signal|exit [0-9]|Timed out waiting for initialize/i.test(message || "");
}

async function mcpCall(id, toolName, args) {
  const config = mcpConfig(id);
  if (!config) return { ok: false, error: "Unknown connection." };
  const runtime = mcpEnsureRuntime(config);
  let stateChanged = false;
  try {
    if (runtime.state !== "connected") {
      await runtime.start();
      stateChanged = true;
    }
    const result = await runtime.callTool(String(toolName), args && typeof args === "object" ? args : {});
    if (stateChanged) mcpBroadcast();
    return { ok: true, result };
  } catch (e) {
    const message = String((e && e.message) || e);
    if (isConnectionFailure(message) && mcpRuntimes.get(id)) {
      mcpRuntimes.delete(id); // next attempt restarts cleanly
      runtime.stop().catch(() => {});
    }
    mcpBroadcast();
    return { ok: false, error: message };
  }
}

ipcMain.handle("qyn:mcp-list", async () => mcpStatuses());

ipcMain.handle("qyn:mcp-save", async (_event, raw) => {
  const c = raw && typeof raw === "object" ? raw : {};
  const id = typeof c.id === "string" && c.id ? c.id : `mcp_${Date.now().toString(36)}`;
  const transport = c.transport === "http" ? "http" : "stdio";
  const name = String(c.name || "").trim().slice(0, 40) || "MCP server";
  const config = {
    id,
    name,
    transport,
    command: transport === "http" ? "" : String(c.command || "").trim().slice(0, 500),
    args: transport === "http" ? [] : Array.isArray(c.args) ? c.args.map((a) => String(a).slice(0, 400)) : [],
    url: transport === "http" ? String(c.url || "").trim().slice(0, 500) : "",
    env: c.env && typeof c.env === "object" ? c.env : {},
    autoConnect: c.autoConnect !== false,
  };
  if (transport === "stdio" && !config.command) return { ok: false, error: "A stdio connection needs a launch command." };
  if (transport === "http" && !/^https?:\/\//i.test(config.url)) return { ok: false, error: "An HTTP connection needs a URL like http://127.0.0.1:8000/mcp." };
  const existing = mcpConfigsCache.find((x) => x.id === id);
  mcpConfigsCache = [...mcpConfigsCache.filter((x) => x.id !== id), config];
  if (existing) {
    // restart with the new settings if it was running
    await mcpDisconnect(id);
    if (config.autoConnect) void mcpConnect(id);
  }
  await saveMcpConfigs(mcpConfigsCache).catch(() => {});
  mcpBroadcast();
  return { ok: true, id, status: mcpStatus(config) };
});

ipcMain.handle("qyn:mcp-remove", async (_event, id) => {
  const removed = mcpConfigsCache.some((c) => c.id === id);
  if (!removed) return { ok: false, error: "Unknown connection." };
  await mcpDisconnect(id);
  mcpConfigsCache = mcpConfigsCache.filter((c) => c.id !== id);
  await saveMcpConfigs(mcpConfigsCache).catch(() => {});
  mcpBroadcast();
  return { ok: true };
});

ipcMain.handle("qyn:mcp-connect", (_event, id) => mcpConnect(String(id)));

ipcMain.handle("qyn:mcp-disconnect", (_event, id) => mcpDisconnect(String(id)));

ipcMain.handle("qyn:mcp-call", (_event, id, toolName, args) => mcpCall(String(id), toolName, args));

async function initMcp() {
  mcpConfigsCache = await loadMcpConfigs();
  mcpBroadcast();
}

function shutdownMcp() {
  for (const runtime of mcpRuntimes.values()) {
    runtime.stop().catch(() => {});
  }
  mcpRuntimes.clear();
}

/* ------------------------------------------------------------------ */
/* App lifecycle                                                       */
/* ------------------------------------------------------------------ */

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  shutdownMcp();
});