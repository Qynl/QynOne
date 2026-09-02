# QynOne

**The place your PC starts. QynOne is the first thing you want to open on your PC.**

QynOne is a real Windows desktop application and a virtual layer over your PC — one clean, beautiful place for the
applications, games, projects, files, folders, tools and information you use every day. It never replaces, moves, or
modifies the applications installed on your PC. Virtual folders inside QynOne are pure QynOne metadata; the **real
apps stay exactly where Windows installed them** and open right where they are — nothing is transferred, copied, or
broken.

> **The north star:** you open QynOne once, and you stop thinking about the Windows desktop entirely.
> "Why would I even use the desktop anymore?"

## What's in QynOne 2.2

- **Nex — a real AI assistant that is just two eyes.** On Home, the centerpiece is a pair of bare, rectangular
  white eyes — no face, no panel, no text around them. Those eyes *are* the assistant: they express more than
  40 distinct emotions (idle, awake, listening, thinking, working, happy, joyful, laughing, love, party,
  celebrating, excited, proud, grateful, calm, determined, curious, focused, playful, winking, shy, surprised,
  shocked, sad, crying, worried, scared, confused, angry, sleepy, sleeping, tired, sick, zoned, searching,
  offline, yes/no nodding, sorry, concerned…) — each with its own eye shape, gaze, tilt, glow, blink rhythm and
  floating effects: sparkles, stars, hearts, tears, sweat, zzz, pulsing rings and confetti.
- **Hands-free wake word.** Tap the mic and say **"Nex"** — the eyes light up, then you just talk: *"Nex, open
  VS Code"*, *"Nex, what's next today?"*. Nex answers out loud. Typing still works the same; type `/` to see its
  tools and use them directly.
- **A full working Calendar** that Nex knows about. Month grid, day view, add/edit/delete events and to-dos
  (with times, or all-day), done-checking, upcoming and **missed** lists. Home shows **What's next** under a live
  clock with today's events, tomorrow, and anything you missed. Nex can read and manage the calendar by voice or
  text: `/calendar-today`, `/calendar-add "gym" tomorrow 18:00`, `/calendar-next`, `/calendar-done`. Everything
  is stored locally in your QynOne state file.
- **Boot animation** — on launch, Nex opens his eyes on a loading screen before the app fades in.
- **Real models only, zero fake.** Nex is powered by an actual language model you choose — **Ollama (local, free,
  private)**, **OpenAI**, or any OpenAI-compatible endpoint — configured in **Settings → AI** and saved locally to
  `qynone.env` on your PC. There is no canned reply engine anywhere: if no model is configured, Nex says so and
  points you to Settings. There is no simulated anything left in the app — system stats, files, PC info and the
  vault are all real data from the machine (the web preview simply shows nothing where it cannot read the PC).
- **Markdown Vault + Knowledge Graph 2.0** — a real Obsidian-style vault. On the desktop app the vault is a normal
  folder of `.md` files (`Documents\QynOneVault`); QynOne reads and writes them directly — **the files are the
  source of truth**, portable and human-readable.
  - Notes link to each other with `[[Wiki Links]]`; **backlinks** and **orphan notes** are computed automatically.
  - **The graph re-marks itself.** QynOne watches the vault folder, so editing a note in *any* editor, adding or
    removing a `[[link]]`, renaming or deleting a file updates the graph automatically — no manual refresh.
  - The graph is generated from the actual relationships in your files — never hardcoded — and it goes **beyond
    notes**: apps, virtual folders, workspaces and starred files appear as typed nodes with **QynOne-detected**
    relationships (a note that mentions Unreal sits next to your Unreal app) kept visually distinct from
    **explicit** `[[wiki links]]`. Clicking a note opens the note; clicking an app launches the real app.
  - Force-directed layout, zoom, pan, node dragging, hover highlighting of connections, dimming of unrelated
    nodes, search, and filtering by type/folder/orphans.
  - Markdown editing with a live preview, tags (`#project`), full vault search, folders, and unresolved-link
    creation.
- **Redesigned Home** — a darker, cleaner command center in deep blue-gray-black. A **Now panel** (big live clock,
  date, What's next, missed items, notifications) sits beside the **Nex eyes stage** — the bare rectangular eyes
  alone, with a slim voice/text input beneath — and compact PC-status, quick-launch, folders, knowledge and
  workspace cards below. The library
  starts empty and honest — every tile is something you actually added.
- **Customizable Home** — your widgets (PC status, quick-launch dock, virtual folders, environment snapshot) can be
  dragged to reorder or hidden — everything on Home is *yours*.
- **Workspaces** — bundle the apps for one part of your life (Development, Gaming, School…) and **launch them all at
  once**. QynOne remembers the setup; a workspace is pure metadata, the real apps open in place.
- **System Center** — a beautiful replacement for Task Manager: live CPU & memory charts, stat cards, uptime, and
  real hardware info (PC name, processor, cores, RAM) read straight from the machine at user level.
- **File Center** — browse your real Documents, Downloads, Desktop, Pictures, Videos and Music from inside QynOne,
  open files and folders, and star favorites for one-click access. Read-only at user level — QynOne never moves a
  file.
- **Quick Tools** — a working calculator, stopwatch, auto-saving notes, one-click screenshot (saved to
  `Pictures\QynOne`), plus shortcuts that open the right Windows settings page (display, sound, network, storage…).
- **Notification Center** — a unified bell in the top bar; workspace launches and real activity land there.
- **Universal search (Ctrl+K)** — apps, folders, **workspaces**, **vault notes**, **your files** (real file search
  on the PC) and system actions. Type `volume`, `wifi`, `display`, `update`… and go straight to the right Windows
  settings page.
- **Your profile** — name, avatar, tagline and personal stats; the Home hero greets *you* by name.
- **Virtual folders** — organize any app into your own environment without touching Windows. Breadcrumb navigation
  gets you back anywhere, and the QynOne logo always returns you home.
- **Real launching** — apps and games open through Windows' normal shell; "Find on this PC…" links tiles to your
  actual Start Menu shortcuts.
- **Backup & restore** — your whole environment downloads as one JSON file.
- **Works everywhere** — desktop app or narrow window: a scrollable mobile bottom nav keeps every screen one tap away.

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
| Your environment (virtual folders, apps, workspaces, favorites, settings) | Saved automatically to `%APPDATA%\QynOne\qynone-state.json` — a plain, human-readable file on your PC. No cloud, no account. |
| AI settings (provider, endpoint, model, API key) | Saved to `%APPDATA%\QynOne\qynone.env` — a plain `.env` file on your PC. The key never leaves the machine and is never logged. |
| Markdown Vault | A real folder — `Documents\QynOneVault` — of `.md` files. QynOne reads and writes the files directly; they are the source of truth and work in any Markdown editor. A file watcher auto-rescans the vault, so external edits re-mark the graph instantly. |
| Launching an app or game | Through Windows' normal shell, the same way a double-click would. QynOne never executes arbitrary commands and never touches the real app files. |
| Workspaces | Metadata only — a workspace is a list of app ids. Launching it opens each real app through Windows' shell, staggered, one by one. |
| Live system stats | CPU %, memory, uptime, hostname, hardware — read via ordinary OS APIs at user level. Never simulated: when the bridge can't read the PC (e.g. the web preview), the UI shows an honest empty state. QynOne never requests elevated access. |
| File Center | Browsing is read-only (`readdir` + metadata). Opening a file/folder goes through Windows' shell like a double-click. |
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

### The AI assistant (Settings → AI)

Qyn speaks to a real model through one OpenAI-compatible client:

1. **Ollama (recommended, local & free)** — install [Ollama](https://ollama.com), run `ollama pull llama3.2` (or any
   model), and Qyn finds it at `http://localhost:11434/v1` automatically. Everything runs on your PC; nothing
   leaves it.
2. **OpenAI** — paste your API key (stored in `qynone.env` on your PC).
3. **Custom** — any OpenAI-compatible endpoint (Groq, OpenRouter, LM Studio, a LAN server…) with its own base URL,
   model and optional key.

Type `/` in the chat to list Qyn's tools (`/launch minecraft`, `/create-note Ideas - "Procedural World"`,
`/search-notes unreal`, `/system`, `/open-vault`…). The model also calls tools on its own when it decides it needs
one — full access to QynOne, user-level only.

> In the web preview, a `localhost` Ollama instance can't be reached (the preview runs in the cloud) — use OpenAI or
> a public endpoint there. In the installed app, Ollama works out of the box.

### Backup

Settings → **Backup & restore** downloads your entire environment as `qynone-backup.json`. Restore it anytime here or
on another PC — it's how you carry your setup to a new machine. The vault is real files, so backing it up is just
copying `Documents\QynOneVault`.

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

The architecture is modular and built to grow: app manager, virtual library, workspace manager, universal search,
file system integration, system monitor, notification center, widget system, settings and (later) plugins. Next up:
Game Center (auto-detect installed games, playtime, covers), deeper PC monitoring (GPU, network, disk charts),
clipboard & download history, and widgets that can be resized.