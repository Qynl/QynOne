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