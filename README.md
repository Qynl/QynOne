# QynOne

**The place your PC starts.**

QynOne is a real Windows desktop application and a virtual layer over your PC — one clean, beautiful place for the
applications, games, projects, files and tools you use every day. It never replaces, moves, or modifies the
applications installed on your PC. Virtual folders inside QynOne are pure QynOne metadata; the **real apps stay
exactly where Windows installed them** and open right where they are — nothing is transferred, copied, or broken.

## What's in v0.1

- **Launcher-style Home** — profile greeting with a live clock, one-click global search, and a quick-launch dock of
  your pinned apps.
- **Your profile** — name, avatar, tagline and personal stats; the Home hero greets *you* by name.
- **Virtual folders** — organize any app into your own environment without touching Windows. Breadcrumb navigation
  (`Home → Folder library → Games`) gets you back anywhere, and the QynOne logo always returns you home.
- **Real launching** — apps and games open through Windows' normal shell; "Find on this PC…" links tiles to your
  actual Start Menu shortcuts.
- **System panel** — real PC name, processor, and memory straight from the machine in the desktop app.
- **Global search** — Ctrl+K is always one keystroke away.
- **Backup & restore** — your whole environment downloads as one JSON file.
- **Works everywhere** — desktop app, phone-width window… a mobile bottom nav keeps every screen one tap from Home.

## The app

QynOne is built on Electron (the same foundation as VS Code and Discord) and ships as a normal Windows application.
Everything the app needs is bundled inside the `.exe` — Electron is a **build-time** tool, not something the user
installs.

Two ready-made builds live in `release/`:

- **`QynOne-Setup-0.1.0-x64.exe`** — the installer. Installs to your user folder (`%LOCALAPPDATA%\Programs\QynOne`),
  creates Start Menu + desktop shortcuts, and lets you choose the install directory. **Per-user install — no admin
  rights required, and QynOne never asks for them.**
- **`QynOne-Portable-0.1.0-x64.exe`** — a single-file portable app. No installation at all; run it from a USB stick
  or anywhere.

Rebuild them anytime with:

```bash
bun install
bun run dist:win
```

(Cross-building from Linux needs Wine installed for the NSIS step; on Windows it works as-is.)

### How it works

| What | Where |
| --- | --- |
| Your environment (virtual folders, apps, favorites, settings) | Saved automatically to `%APPDATA%\QynOne\qynone-state.json` — a plain, human-readable file on your PC. No cloud, no account. |
| Your profile (name, avatar, tagline, stats) | The Home greeting greets *you*, your avatar follows you everywhere, and real PC info (name, CPU, RAM) comes straight from the machine. |
| Launching an app or game | Through Windows' normal shell, the same way a double-click would. QynOne never executes arbitrary commands and never touches the real app files. |
| Finding installed apps | "Find on this PC…" in the app editor reads your Start Menu shortcuts (`.lnk`/`.url`) — **read-only**. |
| Virtual folders | Metadata only. QynOne never moves, copies, renames, or touches the real applications/folders on your PC. |

### Launch targets

Attach any of these to an app and QynOne opens the real thing where it lives:

- A program or shortcut path — `D:\Games\Minecraft\launcher.exe`, `C:\Users\you\Desktop\Game.lnk`
- A launcher link — `steam://run/…`, `spotify:`, `epic://launch/…`
- A website — `https://…`
- A `file://` path — opens the file/folder in its default app

Pick one manually in the app's edit modal, or press **Find on this PC…** and search your installed apps directly:
QynOne links to the actual Start Menu shortcut and Windows starts the program.

### Permissions — this is a guarantee

- **QynOne never runs with (or asks for) administrator rights.** The installer installs per-user; the app reads and
  writes only its own data folder and launches apps at the current user's token.
- It never executes arbitrary commands and never bypasses Windows security. If an app itself needs elevation,
  Windows' own UAC prompt decides — QynOne stays out of it.

> Note: the current builds are unsigned, so Windows SmartScreen will show a "more info" prompt the first time —
> click "Run anyway"; it's normal for unsigned apps. Code signing can be added when you have a certificate.

### Backup

Settings → **Backup & restore** downloads your entire environment as `qynone-backup.json`. Restore it anytime here or
on another PC — it's how you carry your setup to a new machine.

## Developing

```bash
bun install          # install everything (including the desktop toolchain)
bun run dev          # browser preview with hot reload
bun tsc -b --noEmit  # typecheck
bun run build        # build the UI only
bun run desktop      # run the desktop app against the built UI
```

In the browser preview (`bun run dev`) your environment lives in the browser's local storage; in the desktop app it
lives in `%APPDATA%\QynOne`. Everything else behaves identically.

## Roadmap

The architecture (local-first state, virtual folders, launch targets) is built to grow into games launchers, developer
workspaces, PC monitoring, widgets, plugins and notifications. First version ships the core: Home, virtual
organization, real launching, and personal settings.