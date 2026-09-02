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

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const fsPromises = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

const IS_DEV = Boolean(process.env.VITE_DEV_SERVER_URL);

app.setName("QynOne");

/* ------------------------------------------------------------------ */
/* Window                                                              */
/* ------------------------------------------------------------------ */

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: "#05080f",
    title: "QynOne",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  if (IS_DEV) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return win;
}

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
  if (!q) return [];
  const out = [];
  const seen = new Set();
  for (const root of shortcutRoots()) {
    walkShortcuts(root, q, out, seen, 0);
  }
  return out.slice(0, 12);
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
/* App lifecycle                                                       */
/* ------------------------------------------------------------------ */

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});