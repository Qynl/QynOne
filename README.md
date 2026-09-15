# QynOne

**The place your PC starts. QynOne is the first thing you want to open on your PC.**

QynOne is a real Windows desktop application and a virtual layer over your PC — one calm,
beautiful place that holds the games, apps, projects and tools you use every day, and one
workshop where **Nex**, the intelligence inside QynOne, builds new games for you through real
engine connections. It never replaces, moves, or modifies anything on your PC.

> **The north star:** you open QynOne once, and you stop thinking about the Windows desktop
> entirely. And when you want a new game, you just ask Nex.

## What QynOne is

Three surfaces. Nothing else — that's on purpose.

- **Home** — the calm first thing you see: the time, the date, and two soft white eyes
  floating in the dark. Nex is Home. He lives through the day (bright in the morning, sleepy
  late at night), drifts off if you leave him unheard, wakes when you come back, and reacts
  to you — more than 40 emotions expressed purely through eye shape, openness, gaze, glow and
  motion. Type `party`, and he throws confetti.
- **Nex (the workshop)** — the chat + build view. This is where you and Nex work on games and
  projects together, with a live Agent Activity trace showing every thought, tool call and
  result.
- **Settings** — where you wire Nex to the world: MCP engine connections, AI provider, music,
  appearance, backup, uninstall.

## Nex — your builder, not your chatbot

Nex acts through **MCP engines** (Model Context Protocol servers) you connect in
Settings → Connections — today **Roblox Studio** and **Unreal Engine**. When you give him a
development goal, he owns it end to end:

1. **Decides** — genre flavor, art direction, mechanics, difficulty, scope. Creative calls are
   his; he states them in one line each and moves. No interrogation, no question lists.
2. **Plans** — records the plan and milestones you can watch live.
3. **Builds** — drives the engine's own tools in parallel batches.
4. **Verifies** — tests through the engine, inspects what he actually made.
5. **Critiques himself** — runs a self-review, finds real issues, fixes them, re-tests. He
   never stops at "a basic version works"; a finished game has menus, feedback, a difficulty
   curve and polish.
6. **Reports** — what was completed, what was verified, what he'd improve next. If
   interrupted, he says exactly where he stopped.

For whole-game builds he can run the staged **Game Development pipeline** (Game Design →
Architecture → Assets → Gameplay → Systems → AI → Integration → Playtest → Polish → Final
Verification), each phase guarded by a quality gate he cannot pass on intention — only on
evidence. And he has a **subagent team**: designer, architect, builder, adversarial QA,
debugger and polish specialists he spawns only when a task earns them.

He also has long-term memory (saved locally, in plain Markdown), a scratchpad folder for
design docs and build notes, and — the one thing outside MCP — **Amazon Music**: he can play
what you ask and keeps the beat while working.

## Floating Nex — always on top

On the workshop, hit **Float Nex** and Nex detaches into a tiny transparent window pinned
above your games and apps. It is nothing but the eyes — same emotions, wake word, pointer
gaze. It never steals focus and never asks for admin rights.

## The app

QynOne is built on Electron and ships as a normal Windows application. Everything the app
needs is bundled inside the `.exe`.

- **`QynOne-Setup-0.1.0-x64.exe`** — the installer. Per-user install into
  `%LOCALAPPDATA%\Programs\QynOne`. **No admin rights required, ever.**
- **`QynOne-Portable-0.1.0-x64.exe`** — a single-file portable app. Run it from a USB stick.

Rebuild them anytime with:

```bash
bun install
bun run dist:win
```

(Cross-building from Linux needs Wine for the NSIS step; on Windows it works as-is.)

### How it works

| What | Where |
| --- | --- |
| Your environment (settings, appearance, connections) | Saved automatically to `%APPDATA%\QynOne\qynone-state.json` — plain, human-readable, no cloud, no account. |
| AI settings (provider, endpoint, model, API key) | Saved to `%APPDATA%\QynOne\qynone.env` — the key never leaves the machine. |
| Memory & scratchpad | Plain Markdown files inside QynOne's own data folder — you can read, edit or erase every line. |
| MCP engine connections | Server configs saved to `%APPDATA%\QynOne\qynone-mcp.json`. The client connects over stdio (Roblox) or localhost HTTP (Unreal) at user level — nothing leaves the PC, and engine tool calls go straight to the open editor. |
| Amazon Music | Nex opens the installed Amazon Music app for you — the only PC interaction outside MCP, and play/search only. |

### Permissions — this is a guarantee

- **QynOne never runs with (or asks for) administrator rights.** The app reads and writes
  only its own data folder and talks to engines at the current user's token.
- It never executes arbitrary engine commands beyond what the connected MCP server itself
  exposes, and it never bypasses Windows security.
- **Settings → Uninstall** removes every file QynOne created (its data folder, shortcuts,
  startup entry) and nothing else — it never touches files that existed before QynOne.

### The AI assistant (Settings → AI)

Nex speaks to a real model through one OpenAI-compatible client:

1. **Ollama (recommended, local & free)** — install [Ollama](https://ollama.com), pull a
   model, and QynOne finds it at `http://localhost:11434/v1` automatically.
2. **OpenAI** — paste your API key (stored in `qynone.env` on your PC).
3. **Custom** — any OpenAI-compatible endpoint (Groq, OpenRouter, LM Studio, a LAN server…).

Type `/` in the workshop to list Nex's tools; the model also calls tools on its own when a
task needs one.

> In the web preview, a `localhost` Ollama instance can't be reached — use a public endpoint
> there. In the installed app, Ollama works out of the box.

### Backup

Settings → **Backup & restore** downloads your entire environment as `qynone-backup.json`.
Restore it anytime here or on another PC.

## Developing

```bash
bun install
bun run dev      # Vite dev server
bun test         # unit tests
bun run dist:win # Windows build (Wine on Linux for the NSIS step)
```

## Roadmap

- More engines (Godot, Unity, custom MCP servers)
- Widgets and dashboards on Home
- Plugins and notifications
- Voice-first control everywhere
