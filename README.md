# QynOne

**The place your PC starts. QynOne is the first thing you want to open on your PC.**

QynOne is a real Windows desktop application and a virtual layer over your PC — one clean, beautiful place for the
applications, games, projects, files, folders, tools and information you use every day. It never replaces, moves, or
modifies the applications installed on your PC. Virtual folders inside QynOne are pure QynOne metadata; the **real
apps stay exactly where Windows installed them** and open right where they are — nothing is transferred, copied, or
broken.

> **The north star:** you open QynOne once, and you stop thinking about the Windows desktop entirely.
> "Why would I even use the desktop anymore?"

## What's in QynOne 2.4

- **Home is just Nex.** Open QynOne and there is nothing else: the time, the date, and two soft **white** eyes
  floating in the dark — no face, no pupil, no panel, no cards, no scrolling. At rest the eyes relax into a
  gently rounded, glasses-like shape (never hard rectangles) with no accessories. But let him sit unheard for a
  while and Nex drifts off in a little scene: a slow **yawn**, a glance to the right, then his eyes droop
  half-shut and he settles into a sleepy quiet — until you wake him with a short awake beat. Those eyes *are* the assistant: more than 40 emotions (idle, listening, thinking, working, happy,
  joyful, laughing, love, party, celebrating, excited, proud, curious, focused, playful, winking, shy,
  surprised, shocked, sad, crying, worried, scared, confused, angry, sleepy, sleeping, tired, sick, zoned,
  searching, offline, yes/no nodding, sorry, concerned, attentive, speaking, notification, eventSoon,
  missedEvent, powerful, quiet, settled, delighted, inspired…) expressed purely through eye shape, openness,
  gaze, lean, tilt, glow, blink rhythm and floating effects: stars, hearts, tears, sweat, pulsing rings and
  confetti. The pointer gives Nex a subtle real gaze direction; there are still no pupils, face shape, or text
  on Home. Everything else sits behind the full-width bottom dock and the most minimal chrome possible. (One
  tiny easter eggs, all eyes-only: park the cursor in the middle and he stares until his eyes cross and hurt;
  park it on one eye and he winks at you; wiggle the mouse fast and he gets dizzy; scroll (Home never scrolls)
  and he's confused; type "party" or "woohoo" and he throws confetti; type "sleep" and he actually dozes off,
  then startles awake claiming he was totally up. And while you're away, his little thought lines drift
  somewhere shady — the moment you hover back he suddenly says something completely normal.)
- **Home lives through the day.** The layout never changes, but the information and Nex's behavior do: a bright
  awake look in the morning, calm during the day, a focused one after you've actually been launching things,
  settling in the evening, sleepy and quiet late at night — with one quiet thought line when the day shifts. The
  **Last open** and **Next** cards only appear when there is something real to show, and Nex glances toward
  whichever side just changed: a launch gets a look to the left card, and an event inside the next 10 minutes gets
  a real look at the Next card on the right (which then shows "in X min" in the accent color).
- **Hands-free wake word.** Tap the quiet little mic icon under the eyes and say **"Nex"** — the eyes focus and
  glance toward your pointer, then you just talk: *"Nex, open VS Code"*, *"Nex, what's next today?"*,
  *"Nex, take a screenshot"*. Nex answers out loud; a short quiet line of what he said appears and fades on its
  own. Press Ctrl+K and type a question in plain words — when nothing matches, "Ask Nex" hands it to him.
- **Dedicated Nex workspace.** The bottom dock and Ctrl+K both expose a full AI page with chat history, the live
  eyes, every available `/tool` (the full list scrolls in its own rail), quick suggestion chips, and a direct link
  to the real Markdown Vault. The whole page fits the window — only the conversation scrolls. Nex controls all of
  QynOne through voice, chat, or tools: he can open every view and profile/settings,
  launch real apps and workspaces, open virtual folders, read your PC stats, take screenshots, save notes, search
  and manage your Markdown vault, and read/write your calendar.
- **Floating Nex — always on top.** On the AI page, hit **Float Nex** and Nex detaches into a tiny transparent
  window pinned to the bottom-left of your screen, above your games and apps. It is nothing but the eyes — same
  emotions, wake word, listening rings, speaking motion and pointer gaze as Home. Click the eyes to talk to him
  (say "Nex"…), drag the empty edge to park him anywhere, double-click the eyes to dismiss him, or close QynOne
  and he goes with it. It never steals focus from the game and never asks for admin rights. **One Nex owns the
  microphone:** while Float Nex is open the main window stays quiet and he answers from the float; close him and
  voice returns to the app exactly as it was.
- **Nex feels your tone and your music.** His eyes react to how you say things — praise, frustration, a question,
  a celebration — with the matching expression (typed and spoken alike). When you ask for music, Nex opens
  **Amazon Music** on exactly what you asked (*"Nex, play lofi hip hop"*), puts on headphones, sways to the beat
  and shows the track under the eyes with live equalizer bars. `/music <song/artist/album>` and `/music-stop`
  control the session, and telling him *"I'm actually listening to X"* updates the caption.
- **Real hands in your engines (MCP).** **Settings → Connections** gives Nex live connections to the official
  **Roblox Studio** and **Unreal Engine** MCP servers — plus any custom MCP server (stdio launch command or HTTP
  endpoint). The moment an engine is online, its own tools become functions Nex can call in chat: Roblox Studio's
  script reading/editing (`script_read`, `multi_edit`), Luau execution, asset search/insert and playtesting; Unreal's
  actor, material, scene and toolset functions through its embedded MCP server. He reads your real scripts first,
  makes small verified edits, and never hides a failure. Connections stay local (localhost/stdin on your PC, config
  in `qynone-mcp.json`) and are  visible in the Nex page's Engines panel — ask *"fix my Roblox script"* or
  *"move that actor 100 units"* once Studio or the Unreal editor is running.
  With an engine connected Nex runs **autonomous build sessions**: give him a goal like *"make a really good
  tactical shooter in Roblox"* and he plans, builds, tests through the engine (play mode, console, screen
  capture), critically evaluates his own work, improves it and tests again — within a large per-session step
  budget, pausing honestly if he hits it. The MCP connection is strictly his only pair of hands: no filesystem,
  shell or system access is ever granted — everything happens through the engine's own tools, inside the project
  that connection exposes.
- **A real system prompt you can read.** Nex's entire identity and rulebook live in plain Markdown in the repo
  (`src/system-prompt.md`) — who he is, his personality, what he can really do with your PC, the vault/memory
  budgets, voice behavior and honesty rules. It *is* the system prompt sent with every request; only a short
  runtime context (today, budgets, what he remembers about you) is appended automatically. Edit the file and
  his behavior changes.
- **A full working Calendar** that Nex knows about. Month grid, day view, add/edit/delete events and to-dos
  (with times, or all-day), done-checking, upcoming and **missed** lists. Nex can read and manage it by voice or
  text: `/calendar-today`, `/calendar-add "gym" tomorrow 18:00`, `/calendar-next`, `/calendar-done`. Everything
  is stored locally in your QynOne state file.
- **A first-thing feel.** Launch goes straight from the loading screen to Home: one minimal frame of Nex asleep
  — his eyes open slowly from a deep sleep, a soft glow, nothing else — and the app fades in.
  No extra screens. Want QynOne there first after sign-in? Flip **Settings → Startup** and it genuinely opens
  before anything else on Windows.
- **Real models only, zero fake.** Nex is powered by an actual language model you choose — **Ollama (local, free,
  private)**, **OpenAI**, or any OpenAI-compatible endpoint — configured in **Settings → AI** and saved locally to
  `qynone.env` on your PC. There is no canned reply engine anywhere: if no model is configured, Nex says so and
  points you to Settings. There is no simulated anything left in the app — system stats, files, PC info and the
  vault are all real data from the machine (the web preview simply shows nothing where it cannot read the PC).
- **Markdown Vault — a real workspace with real budgets.** The vault is for remembering everything: a plain
  library of `.md` files (`Documents\QynOneVault` on the desktop app) that QynOne reads and writes directly —
  **the files are the source of truth**, portable and human-readable. One header with a live budget bar, then
  **Notes | Nex memory** tabs.
  - **Notes** — searchable library with folders, tags and orphans on the left; the editor in the middle with
    **Edit / Split / Preview** modes (Split renders the Markdown live beside your text), a real **Saved /
    Saving…** indicator and a live size meter; and a knowledge rail on the right with `[[links]]`, backlinks,
    unresolved-link creation and tags. Notes link to each other with `[[Wiki Links]]`; backlinks and orphan
    notes are computed automatically, and editing a note in *any* editor is picked up instantly.
  - **Managed, not unbounded.** Regular notes are capped at 25 KB each and the vault holds at most 300 notes;
    Nex's own files live in `_` folders that never count against you. When something outgrows a limit, the
    **Tidy** button (or Nex's `/vault-cleanup`) archives the full version under `_Nex/Archive/` — nothing is
    ever deleted outright — and condenses oversized notes back under their limit. `/vault-stats` reports the
    budget at any time.
  - **Nex memory** — see exactly what Nex remembers about you (facts, preferences, conversation highlights),
    add or delete entries, or wipe everything. Nex also saves new facts on its own when you tell it something
    personal. Memory is one real Markdown file — `_Nex/Memory.md` — **hard-capped at 2 KB**: only the personal
    essentials fit, so Nex keeps entries short, drops the oldest conversations automatically when it fills up,
    and **Compress with Nex** (or `/memory-compact`) merges everything into a tight set of essentials with the
    model. Read or edit it in any editor and take it with you when you move the vault.
- **Minimal interface everywhere** — charcoal-black surfaces, white text, one quiet top strip and a full-width bottom
  dock; every view keeps the same calm, breathing visual language. Nothing on Home is decorative — the eyes are
  the product. The library starts empty and honest — every tile anywhere is something you actually added.
- **Workspaces** — bundle the apps for one part of your life (Development, Gaming, School…) and **launch them all at
  once**. QynOne remembers the setup; a workspace is pure metadata, the real apps open in place.
- **System Center** — a beautiful replacement for Task Manager: live CPU & memory charts, stat cards, uptime, and
  real hardware info (PC name, processor, cores, RAM) read straight from the machine at user level. A left nav
  switches between **Live overview** (stats, charts, memory pressure, network/battery state) and **Hardware** —
  every section fits the screen, nothing scrolls away.
- **File Center** — browse your real Documents, Downloads, Desktop, Pictures, Videos and Music from inside QynOne,
  open files and folders, and star favorites for one-click access. Read-only at user level — QynOne never moves a
  file. The page itself never scrolls: only the file list does.
- **Quick Tools** — a working calculator, stopwatch, auto-saving notes, one-click screenshot (saved to
  `Pictures\QynOne`), plus shortcuts that open the right Windows settings page (display, sound, network, storage…).
  Tools are switched from a **left nav bar** and each one fills the page fully — the active tool is always visible
  without scrolling.
- **Notification Center** — a unified bell in the top bar; workspace launches and real activity land there.
- **Universal search (Ctrl+K)** — apps, folders, **workspaces**, **vault notes**, **your files** (real file search
  on the PC) and system actions. Type `volume`, `wifi`, `display`, `update`… and go straight to the right Windows
  settings page.
- **Your profile** — name, avatar, tagline and **real personal numbers** (total launches, pinned apps, library
  sizes, workspaces, vault notes, calendar events, Nex memories — all read live from the actual local data);
  the Home hero greets *you* by name.
- **Virtual folders** — organize any app into your own environment without touching Windows. Breadcrumb navigation
  gets you back anywhere, and the QynOne logo always returns you home.
- **Real launching and discovery** — Applications automatically scans the user's Start Menu and Desktop shortcuts
  when the desktop app opens the Applications view. Filter detected entries into **Games** or **Apps**, select one,
  several, or all new items, and add them to QynOne in one action. Every imported tile keeps the real `.lnk` or `.url`
  target, so Windows opens the original application or game where it lives. The scan is read-only and user-level;
  nothing is moved or modified. "Add manually" remains available for custom `.exe`, launcher URI, file and website
  targets.
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
| Markdown Vault | A real folder — `Documents\QynOneVault` — of `.md` files. QynOne reads and writes the files directly; they are the source of truth and work in any Markdown editor. A file watcher auto-rescans the vault, so external edits appear in the notes library instantly. |
| Launching an app or game | Through Windows' normal shell, the same way a double-click would. QynOne never executes arbitrary commands and never touches the real app files. |
| Workspaces | Metadata only — a workspace is a list of app ids. Launching it opens each real app through Windows' shell, staggered, one by one. |
| Live system stats | CPU %, memory, uptime, hostname, hardware — read via ordinary OS APIs at user level. Never simulated: when the bridge can't read the PC (e.g. the web preview), the UI shows an honest empty state. QynOne never requests elevated access. |
| Start with Windows | A real per-user Windows startup entry (HKCU Run) managed through the OS — toggled in **Settings → Startup**. No admin, no Startup-folder hacks; it points at the installed QynOne executable itself. |
| MCP engine connections (Roblox Studio, Unreal Engine…) | Server configs (command/args/URL/env) saved to `%APPDATA%\QynOne\qynone-mcp.json`. The client connects over stdio (Roblox) or localhost HTTP (Unreal) at user level — nothing leaves the PC, and engine tool calls go straight to the open editor. |
| File Center | Browsing is read-only (`readdir` + metadata). Opening a file/folder goes through Windows' shell like a double-click. |
| Finding installed apps | "Find on this PC…" in the app editor reads your Start Menu shortcuts (`.lnk`/`.url`) — **read-only**. |
| Virtual folders | Metadata only. QynOne never moves, copies, renames, or touches the real applications/folders on your PC. |

### Launch targets

Attach any of these to an app and QynOne opens the real thing where it lives:

- A program or shortcut path — `D:\Games\Minecraft\launcher.exe`, `C:\Users\you\Desktop\Game.lnk`
- A launcher link — `steam://run/…`, `spotify:`, `epic://launch/…`
- Amazon Music — Nex starts the installed Amazon Music shortcut when Windows exposes it, then falls back to the exact web search only when the native app cannot be opened.
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

Nex speaks to a real model through one OpenAI-compatible client:

1. **Ollama (recommended, local & free)** — install [Ollama](https://ollama.com), run `ollama pull llama3.2` (or any
   model), and Qyn finds it at `http://localhost:11434/v1` automatically. Everything runs on your PC; nothing
   leaves it.
2. **OpenAI** — paste your API key (stored in `qynone.env` on your PC).
3. **Custom** — any OpenAI-compatible endpoint (Groq, OpenRouter, LM Studio, a LAN server…) with its own base URL,
   model and optional key.

Type `/` in the chat to list Nex's tools (`/launch minecraft`, `/create-note Ideas - "Procedural World"`,
`/search-notes unreal`, `/system`, `/open-vault`, `/remember "the user's favorite game is Minecraft"`,
`/memory`, `/forget minecraft`…). The model also calls tools on its own when it decides it needs one — full
access to QynOne, user-level only.

Nex has **long-term memory**: everything he learns about you is written as plain lines into a real Markdown file
(`_Nex/Memory.md` inside the vault). When you tell him something personal — a name, a favorite game, a project,
how you like things — he saves it, greets you by it later, and you can see, edit or erase every entry in
Vault → **Nex memory**. Nothing about your conversations leaves your PC.

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