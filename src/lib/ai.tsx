import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getDesktop } from "./desktop";
import type { AiConfig } from "./desktop";
import { useQyn } from "./store";
import { useStats } from "./stats";
import { useSystemInfo } from "./system";
import { useVault } from "./vault";
import { useLaunch } from "../components/ui";
import { dateKey, eventSortKey, fmtTime, parseTime, relativeDay, todayKey, uid } from "./utils";
import { speak } from "./speech";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AiEmotion =
  | "idle"
  | "awake"
  | "boot"
  | "listening"
  | "wake"
  | "thinking"
  | "working"
  | "happy"
  | "joyful"
  | "laugh"
  | "love"
  | "party"
  | "celebrate"
  | "excited"
  | "proud"
  | "grateful"
  | "calm"
  | "determined"
  | "curious"
  | "focused"
  | "playful"
  | "wink"
  | "shy"
  | "surprised"
  | "shocked"
  | "sad"
  | "crying"
  | "worried"
  | "scared"
  | "confused"
  | "angry"
  | "sleepy"
  | "sleeping"
  | "tired"
  | "sick"
  | "zoned"
  | "searching"
  | "offline"
  | "yes"
  | "no"
  | "sorry"
  | "concerned";

export interface AiMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  tool?: string;
  ts: number;
}

export interface AiToolDef {
  name: string;
  usage: string;
  description: string;
  /** OpenAI-compatible JSON schema for the parameters */
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string> | string;
}

interface ToolCall {
  id?: string;
  function: { name: string; arguments: string };
}

/* ------------------------------------------------------------------ */
/* Provider defaults                                                   */
/* ------------------------------------------------------------------ */

export const PROVIDERS: Record<string, { label: string; endpoint: string; model: string; needsKey: boolean }> = {
  ollama: { label: "Ollama (local)", endpoint: "http://localhost:11434/v1", model: "", needsKey: false },
  openai: { label: "OpenAI", endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini", needsKey: true },
  custom: { label: "Custom (OpenAI-compatible)", endpoint: "", model: "", needsKey: true },
};

export function defaultEndpoint(provider: string): string {
  return PROVIDERS[provider]?.endpoint ?? "";
}

export function defaultModel(provider: string): string {
  return PROVIDERS[provider]?.model ?? "";
}

const PREVIEW_CONFIG_KEY = "qynone.ai.config.v1";

/* ------------------------------------------------------------------ */
/* Config persistence — .env file on desktop, localStorage in preview  */
/* ------------------------------------------------------------------ */

async function loadConfig(): Promise<AiConfig> {
  const bridge = getDesktop();
  const defaults: AiConfig = { provider: "ollama", endpoint: "", model: "", key: "" };
  if (bridge) {
    const c = await bridge.aiConfigGet();
    if (c) return { ...defaults, ...c };
  }
  try {
    const raw = localStorage.getItem(PREVIEW_CONFIG_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Partial<AiConfig>;
      return { ...defaults, ...c };
    }
  } catch {
    // ignore
  }
  return defaults;
}

async function saveConfig(cfg: AiConfig): Promise<void> {
  const bridge = getDesktop();
  if (bridge) {
    await bridge.aiConfigSet(cfg);
    return;
  }
  try {
    localStorage.setItem(PREVIEW_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

function resolvedEndpoint(cfg: AiConfig): string {
  return (cfg.endpoint || defaultEndpoint(cfg.provider)).replace(/\/+$/, "");
}

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

function systemPrompt(): string {
  const now = new Date();
  return `You are Nex, the AI built into QynOne — the user's personal command center for Windows. You speak out loud when the user talks to you by voice, so keep answers short and natural for speech. You have REAL access to their environment through tools: their applications, virtual folders, workspaces, live system stats, local Markdown vault (notes link with [[wiki links]]), and their calendar (events and to-dos).

Rules:
- Be warm, concise and human. Answer in the same language the user writes in.
- Use tools whenever the user asks for something QynOne can do (open, launch, navigate, create a note, search notes, list things, system stats, calendar).
- After using a tool, briefly say what you did. Never invent results — report what the tool returned.
- When the user asks about their notes, use the vault tools. When they ask about events, plans or to-dos, use the calendar tools.
- You have no admin rights and never need them; everything is user-level.
- Today: ${now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Current time: ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`;
}

/* ------------------------------------------------------------------ */
/* Provider — chat + tools                                             */
/* ------------------------------------------------------------------ */

interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
}

async function chatOnce(
  cfg: AiConfig,
  model: string,
  messages: Array<Record<string, unknown>>,
  tools: AiToolDef[],
  signal?: AbortSignal,
): Promise<ChatResult> {
  const endpoint = resolvedEndpoint(cfg);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: 0.6,
  };
  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}${text ? ` — ${text.slice(0, 160)}` : ""}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  };
  const msg = data.choices?.[0]?.message;
  return { content: msg?.content ?? "", toolCalls: msg?.tool_calls ?? [] };
}

/** List installed Ollama models from the local server. */
export async function listOllamaModels(endpoint: string): Promise<string[]> {
  const base = endpoint.replace(/\/+$/, "").replace(/\/v1$/, "");
  const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
  const data = (await res.json()) as { models?: Array<{ name: string }> };
  return (data.models ?? [])
    .map((m) => m.name)
    .filter((n) => !/embed/i.test(n));
}

async function resolveModel(cfg: AiConfig): Promise<string> {
  if (cfg.model) return cfg.model;
  if (cfg.provider === "ollama") {
    try {
      const models = await listOllamaModels(resolvedEndpoint(cfg));
      if (models.length > 0) return models[0];
    } catch {
      // fall through to the default
    }
  }
  return defaultModel(cfg.provider) || "gpt-4o-mini";
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface SendOptions {
  /** spoken out loud via the voice interface */
  voice?: boolean;
}

interface AiValue {
  messages: AiMessage[];
  busy: boolean;
  emotion: AiEmotion;
  config: AiConfig;
  tools: AiToolDef[];
  send: (text: string, opts?: SendOptions) => Promise<void>;
  clearChat: () => void;
  saveConfig: (cfg: AiConfig) => Promise<void>;
  testConnection: () => Promise<{ ok: boolean; message: string; models?: string[] }>;
  setListening: (v: boolean) => void;
  setEmotion: (e: AiEmotion, ms?: number) => void;
}

const AiContext = createContext<AiValue | null>(null);

export function AiProvider({
  children,
  onNavigate,
  onOpenFolder,
  onOpenNote,
}: {
  children: ReactNode;
  onNavigate: (view: string) => void;
  onOpenFolder: (id: string) => void;
  onOpenNote: (name: string) => void;
}) {
  const { state, actions } = useQyn();
  const vault = useVault();
  const launch = useLaunch();
  const stats = useStats();
  const sys = useSystemInfo();

  const statsRef = useRef({ stats, sys });
  statsRef.current = { stats, sys };

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const messagesRef = useRef<AiMessage[]>([]);
  messagesRef.current = messages;
  const [busy, setBusy] = useState(false);
  const [emotion, setEmotion] = useState<AiEmotion>("idle");
  const [config, setConfig] = useState<AiConfig>({ provider: "ollama", endpoint: "", model: "", key: "" });
  const configRef = useRef(config);
  configRef.current = config;
  const emotionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadConfig().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setEmotionFor = useCallback((e: AiEmotion, durationMs?: number) => {
    setEmotion(e);
    if (emotionTimer.current) clearTimeout(emotionTimer.current);
    if (durationMs) {
      emotionTimer.current = setTimeout(() => setEmotion("idle"), durationMs);
    }
  }, []);

  const push = useCallback((role: "user" | "ai", text: string, tool?: string) => {
    setMessages((m) => [...m, { id: uid(), role, text, tool, ts: Date.now() }]);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Tools — real access to QynOne                                       */
  /* ------------------------------------------------------------------ */

  const tools = useMemo<AiToolDef[]>(() => {
    const findApp = (query: string) => {
      const q = query.trim().toLowerCase();
      return (
        state.apps.find(
          (a) => a.name.toLowerCase() === q || a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)),
        ) ?? null
      );
    };
    const findFolder = (query: string) => {
      const q = query.trim().toLowerCase();
      return state.folders.find((f) => f.name.toLowerCase().includes(q)) ?? null;
    };
    const findWorkspace = (query: string) => {
      const q = query.trim().toLowerCase();
      return state.workspaces.find((w) => w.name.toLowerCase().includes(q)) ?? null;
    };

    return [
      {
        name: "navigate",
        usage: "/navigate <home|apps|folders|workspaces|system|files|tools|vault|settings|profile>",
        description: "Open a QynOne view: home, apps, folders, workspaces, system, files, tools, vault, settings or profile.",
        parameters: {
          type: "object",
          properties: { view: { type: "string", description: "the view to open" } },
          required: ["view"],
        },
        run: (args) => {
          const view = String(args.view ?? "").toLowerCase();
          const allowed = ["home", "apps", "folders", "workspaces", "system", "files", "tools", "vault", "calendar", "settings", "profile"];
          if (!allowed.includes(view)) return `Unknown view "${view}". Allowed: ${allowed.join(", ")}.`;
          onNavigate(view);
          return `Opened ${view}.`;
        },
      },
      {
        name: "launch",
        usage: "/launch <app name>",
        description: "Launch a real application (or game) by name.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "app name, e.g. VS Code or Minecraft" } },
          required: ["query"],
        },
        run: (args) => {
          const app = findApp(String(args.query ?? ""));
          if (!app) return `No application matching "${args.query}" found. Use list_apps to see what's available.`;
          launch(app);
          return `Launched ${app.name}.`;
        },
      },
      {
        name: "open-folder",
        usage: "/open-folder <folder name>",
        description: "Open a virtual folder by name.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "virtual folder name" } },
          required: ["query"],
        },
        run: (args) => {
          const folder = findFolder(String(args.query ?? ""));
          if (!folder) return `No folder named "${args.query}" found.`;
          onOpenFolder(folder.id);
          return `Opened folder ${folder.name}.`;
        },
      },
      {
        name: "open-workspace",
        usage: "/open-workspace <workspace name>",
        description: "Launch every application in a workspace at once.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "workspace name" } },
          required: ["query"],
        },
        run: (args) => {
          const ws = findWorkspace(String(args.query ?? ""));
          if (!ws) return `No workspace named "${args.query}" found.`;
          const apps = ws.itemIds.map((id) => state.apps.find((a) => a.id === id)).filter(Boolean);
          apps.forEach((app, i) => window.setTimeout(() => launch(app!), i * 450));
          return `Launched workspace ${ws.name} with ${apps.length} apps.`;
        },
      },
      {
        name: "list_apps",
        usage: "/list-apps",
        description: "List every application in QynOne.",
        parameters: { type: "object", properties: {} },
        run: () =>
          state.apps.length === 0
            ? "No apps yet."
            : state.apps.map((a) => `${a.name}${a.favorite ? " (pinned)" : ""}`).join(", "),
      },
      {
        name: "list_folders",
        usage: "/list-folders",
        description: "List the virtual folders in QynOne.",
        parameters: { type: "object", properties: {} },
        run: () =>
          state.folders.length === 0
            ? "No virtual folders yet."
            : state.folders.map((f) => `${f.name} (${state.apps.filter((a) => a.folderId === f.id).length} apps)`).join(", "),
      },
      {
        name: "list_workspaces",
        usage: "/list-workspaces",
        description: "List the workspaces in QynOne.",
        parameters: { type: "object", properties: {} },
        run: () =>
          state.workspaces.length === 0
            ? "No workspaces yet."
            : state.workspaces.map((w) => `${w.name} (${w.itemIds.length} apps)`).join(", "),
      },
      {
        name: "system",
        usage: "/system",
        description: "Get live PC info: CPU, memory, uptime, hardware.",
        parameters: { type: "object", properties: {} },
        run: () => {
          const s = statsRef.current.stats;
          const i = statsRef.current.sys;
          if (!s) {
            return `No live readings available in this preview — in the installed app I read CPU, memory and uptime straight from this PC. Machine: ${i.os}, ${i.cores} cores${i.cpuModel ? `, ${i.cpuModel}` : ""}.`;
          }
          const memPct = Math.round((s.memUsedBytes / s.memTotalBytes) * 100);
          return `CPU ${s.cpuPct}%, memory ${memPct}% (${Math.round(s.memTotalBytes / 2 ** 30)} GB total), uptime ${Math.floor(s.uptimeSec / 3600)}h, OS ${i.os}, ${i.cores} cores${i.cpuModel ? `, ${i.cpuModel}` : ""}.`;
        },
      },
      {
        name: "create-note",
        usage: "/create-note <name> [content]",
        description: "Create a Markdown note in the vault.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "note name" },
            folder: { type: "string", description: "optional subfolder" },
            content: { type: "string", description: "optional Markdown content" },
          },
          required: ["name"],
        },
        run: async (args) => {
          const name = String(args.name ?? "").trim();
          if (!name) return "A note needs a name.";
          const folder = String(args.folder ?? "").trim();
          const content = String(args.content ?? `# ${name}\n\n`);
          const path = await vault.createNote(name, folder, content);
          if (!path) return `Couldn't create "${name}" (does it already exist?).`;
          return `Created note ${path}.`;
        },
      },
      {
        name: "open-note",
        usage: "/open-note <note name>",
        description: "Open a note from the vault.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "note name" } },
          required: ["query"],
        },
        run: (args) => {
          const q = String(args.query ?? "").toLowerCase();
          const hit = vault.notes.find((n) => n.name.toLowerCase() === q) ?? vault.notes.find((n) => n.name.toLowerCase().includes(q));
          if (!hit) return `No note named "${args.query}" in the vault.`;
          onOpenNote(hit.name);
          return `Opening note ${hit.name}.`;
        },
      },
      {
        name: "search-notes",
        usage: "/search-notes <query>",
        description: "Search the Markdown vault.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "search text" } },
          required: ["query"],
        },
        run: (args) => {
          const hits = vault.searchNotes(String(args.query ?? ""));
          if (hits.length === 0) return `Nothing found for "${args.query}".`;
          return hits
            .slice(0, 6)
            .map((n) => `${n.name} (${n.folder || "root"})${n.tags.length ? ` ${n.tags.join(" ")}` : ""}`)
            .join(", ");
        },
      },
      {
        name: "list_notes",
        usage: "/list-notes",
        description: "List every note in the vault.",
        parameters: { type: "object", properties: {} },
        run: () =>
          vault.notes.length === 0
            ? "The vault is empty."
            : vault.notes.map((n) => `${n.name} (${n.folder || "root"})`).join(", "),
      },
      {
        name: "open-vault",
        usage: "/open-vault",
        description: "Open the Markdown vault and knowledge graph.",
        parameters: { type: "object", properties: {} },
        run: () => {
          onNavigate("vault");
          return "Opened the vault.";
        },
      },
      {
        name: "calendar-add",
        usage: "/calendar-add <title> [date] [time]",
        description: "Add an event or to-do to the calendar. Date like YYYY-MM-DD or 'tomorrow'; time like '14:30'.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "event title" },
            date: { type: "string", description: "optional date: YYYY-MM-DD, 'today' or 'tomorrow'" },
            time: { type: "string", description: "optional start time HH:MM" },
          },
          required: ["title"],
        },
        run: (args) => {
          const title = String(args.title ?? "").trim();
          if (!title) return "An event needs a title.";
          let day = todayKey();
          const raw = String(args.date ?? "").trim().toLowerCase();
          if (raw && raw !== "today") {
            if (raw === "tomorrow") {
              const t = new Date();
              t.setDate(t.getDate() + 1);
              day = dateKey(t);
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
              day = raw;
            } else {
              return `I didn't understand the date "${raw}". Use YYYY-MM-DD, 'today' or 'tomorrow'.`;
            }
          }
          const time = String(args.time ?? "").trim();
          if (time && parseTime(time) === null) return `The time "${time}" doesn't look right — use HH:MM like 14:30.`;
          actions.addEvent({ title, date: day, start: time });
          return `Added "${title}"${time ? ` at ${fmtTime(time)}` : ""} on ${relativeDay(day)} (${day}).`;
        },
      },
      {
        name: "calendar-today",
        usage: "/calendar-today",
        description: "List today's events and to-dos.",
        parameters: { type: "object", properties: {} },
        run: () => {
          const day = todayKey();
          const list = state.events
            .filter((e) => e.date === day)
            .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
          if (list.length === 0) return "Nothing scheduled today — your calendar is clear.";
          return list
            .map((e) => `${e.done ? "[done] " : ""}${e.start ? fmtTime(e.start) : "all day"} — ${e.title}`)
            .join(", ");
        },
      },
      {
        name: "calendar-next",
        usage: "/calendar-next",
        description: "Show what's coming up next on the calendar (next few events).",
        parameters: { type: "object", properties: {} },
        run: () => {
          const up = state.events
            .filter((e) => !e.done)
            .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))
            .filter((e) => `${e.date}T${e.start || "99:99"}` >= `${todayKey()}T00:00`)
            .slice(0, 4);
          if (up.length === 0) return "Nothing upcoming. Say \"add to calendar\" to plan something.";
          return up
            .map((e) => `${relativeDay(e.date)}${e.start ? ` ${fmtTime(e.start)}` : ""} — ${e.title}`)
            .join(", ");
        },
      },
      {
        name: "calendar-list",
        usage: "/calendar-list <date|this week>",
        description: "List events for a date or this week.",
        parameters: {
          type: "object",
          properties: { when: { type: "string", description: "YYYY-MM-DD or 'this week'" } },
          required: ["when"],
        },
        run: (args) => {
          const when = String(args.when ?? "").trim().toLowerCase();
          let from = todayKey();
          let to = todayKey();
          if (when === "this week") {
            const d = new Date();
            const dow = (d.getDay() + 6) % 7; // Monday start
            d.setDate(d.getDate() - dow);
            from = dateKey(d);
            d.setDate(d.getDate() + 6);
            to = dateKey(d);
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(when)) {
            from = when;
            to = when;
          } else {
            return "Say a date like YYYY-MM-DD or 'this week'.";
          }
          const list = state.events
            .filter((e) => e.date >= from && e.date <= to && !e.done)
            .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
          if (list.length === 0) return `Nothing scheduled ${when === "this week" ? "this week" : "on " + when}.`;
          return list
            .map((e) => `${relativeDay(e.date)}${e.start ? ` ${fmtTime(e.start)}` : ""} — ${e.title}`)
            .join(", ");
        },
      },
      {
        name: "calendar-done",
        usage: "/calendar-done <title>",
        description: "Mark an event or to-do as done by title.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "event title to mark done" } },
          required: ["query"],
        },
        run: (args) => {
          const q = String(args.query ?? "").toLowerCase();
          const ev = state.events.find((e) => e.title.toLowerCase().includes(q));
          if (!ev) return `No event matching "${args.query}".`;
          if (ev.done) return `"${ev.title}" is already done.`;
          actions.toggleEventDone(ev.id);
          return `Marked "${ev.title}" as done. Nice work!`;
        },
      },
      {
        name: "open-calendar",
        usage: "/open-calendar",
        description: "Open the calendar view.",
        parameters: { type: "object", properties: {} },
        run: () => {
          onNavigate("calendar");
          return "Opened the calendar.";
        },
      },
      {
        name: "screenshot",
        usage: "/screenshot",
        description: "Take a screenshot of the screen and save it to the Pictures\\QynOne folder.",
        parameters: { type: "object", properties: {} },
        run: async () => {
          const bridge = getDesktop();
          if (!bridge) return "Screenshots need the QynOne desktop app — this preview can't capture the screen.";
          const cap = await bridge.captureScreen();
          if (!cap) return "I couldn't capture the screen right now.";
          const res = await bridge.saveScreenshot(cap);
          return res.ok ? `Saved a screenshot${res.path ? ` to ${res.path}` : ""}.` : `Screenshot failed: ${res.error ?? "unknown error"}.`;
        },
      },
      {
        name: "note",
        usage: "/note <text>",
        description: "Save a quick voice note (goes into the Quick Tools notes pad).",
        parameters: {
          type: "object",
          properties: { text: { type: "string", description: "the note to remember" } },
          required: ["text"],
        },
        run: (args) => {
          const text = String(args.text ?? "").trim();
          if (!text) return "There's nothing to note.";
          const stamp = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          const line = `[${stamp}] ${text}`;
          actions.setNotes(state.notes ? `${state.notes}\n${line}` : line);
          return `Noted.`;
        },
      },
    ];
  }, [state, vault, launch, onNavigate, onOpenFolder, onOpenNote, actions]);

  /* ------------------------------------------------------------------ */
  /* Send                                                               */
  /* ------------------------------------------------------------------ */

  const send = useCallback(
    async (rawText: string, opts?: SendOptions) => {
      const text = rawText.trim();
      if (!text || busy) return;
      const viaVoice = Boolean(opts?.voice);

      /* Slash commands — direct tool use. */
      const slash = text.match(/^\/([a-z-]+)\s*(.*)$/i);
      if (slash) {
        const toolName = slash[1].toLowerCase();
        const remainder = slash[2].trim();
        const tool = tools.find((t) => t.name === toolName);
        push("user", text, toolName);
        setEmotionFor("working");
        setBusy(true);
        try {
          if (!tool) {
            push(
              "ai",
              `I don't know the tool \`/${toolName}\`. Here's what I can do:\n${tools
                .map((t) => `- \`${t.usage}\` — ${t.description}`)
                .join("\n")}`,
            );
            setEmotionFor("concerned", 1800);
            return;
          }
          let args: Record<string, unknown> = {};
          if (remainder) {
            try {
              args = JSON.parse(remainder);
            } catch {
              const first = Object.keys(tool.parameters.properties ?? {})[0];
              args = first === "query" || first === "name" || first === "view" ? { [first]: remainder } : { query: remainder };
            }
          }
          const result = await tool.run(args);
          push("ai", result, toolName);
          setEmotionFor("happy", 1400);
        } catch (e) {
          push("ai", `The tool errored: ${String((e as Error)?.message ?? e)}`);
          setEmotionFor("concerned", 1800);
        } finally {
          setBusy(false);
          if (viaVoice) {
            const last = messagesRef.current[messagesRef.current.length - 1];
            if (last?.role === "ai") speak(last.text);
          }
        }
        return;
      }

      const cfg = configRef.current;
      const needsKey = (cfg.provider === "openai" || cfg.provider === "custom") && !cfg.key;
      if (needsKey) {
        push("user", text);
        push(
          "ai",
          `I'm not connected yet — ${PROVIDERS[cfg.provider]?.label ?? cfg.provider} needs an API key. Open **Settings → AI**, paste your key and test the connection.`,
        );
        setEmotionFor("concerned", 2000);
        return;
      }

      push("user", text);
      setBusy(true);
      setEmotionFor("thinking");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 120_000);

      try {
        const model = await resolveModel(cfg);
        const history = messages
          .filter((m) => m.role === "user" || m.role === "ai")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.text }));
        const msgs: Array<Record<string, unknown>> = [
          { role: "system", content: systemPrompt() },
          ...history,
          { role: "user", content: text },
        ];

        let finalText = "";
        for (let step = 0; step < 6; step++) {
          const res = await chatOnce(cfg, model, msgs, tools, controller.signal);
          if (!res.toolCalls || res.toolCalls.length === 0) {
            finalText = res.content;
            break;
          }
          msgs.push({
            role: "assistant",
            content: res.content || null,
            tool_calls: res.toolCalls.map((tc) => ({
              id: tc.id ?? `call_${step}_${Math.random().toString(36).slice(2, 8)}`,
              type: "function",
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });
          for (const tc of res.toolCalls) {
            const tool = tools.find((t) => t.name === tc.function.name);
            let result: string;
            setEmotionFor("working");
            try {
              const args = (() => {
                try {
                  return JSON.parse(tc.function.arguments ?? "{}") as Record<string, unknown>;
                } catch {
                  return {};
                }
              })();
              result = tool ? await tool.run(args) : JSON.stringify({ error: `unknown tool ${tc.function.name}` });
            } catch (e) {
              result = JSON.stringify({ error: String((e as Error)?.message ?? e) });
            }
            msgs.push(tc.id ? { role: "tool", tool_call_id: tc.id, content: result } : { role: "tool", content: result });
          }
        }
        if (!finalText.trim()) finalText = "I couldn't produce an answer.";
        push("ai", finalText.trim());
        setEmotionFor("happy", 1600);
        if (viaVoice) speak(finalText.trim());
      } catch (e) {
        const err = e as Error;
        const isAbort = err.name === "AbortError";
        const isConn = /fetch|Failed to fetch|NetworkError|ECONNREFUSED/i.test(err.message);
        let reply: string;
        if (isAbort) {
          reply = "The model took too long — try again, or pick a smaller/faster model in Settings → AI.";
        } else if (isConn) {
          reply =
            cfg.provider === "ollama"
              ? "I can't reach Ollama on this machine. Make sure it's installed and running (`ollama serve`), then check the endpoint in Settings → AI."
              : `I couldn't reach ${resolvedEndpoint(cfg)}. Check the endpoint and connection in Settings → AI.`;
        } else {
          reply = `The AI request failed: ${err.message}. Check Settings → AI.`;
        }
        push("ai", reply);
        setEmotionFor("concerned", 2200);
        if (viaVoice) speak(reply);
      } finally {
        window.clearTimeout(timeout);
        setBusy(false);
      }
    },
    [busy, messages, push, setEmotionFor, tools],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setEmotionFor("idle");
  }, [setEmotionFor]);

  const saveConfigCb = useCallback(async (cfg: AiConfig) => {
    setConfig(cfg);
    await saveConfig(cfg);
  }, []);

  const testConnection = useCallback(async () => {
    const cfg = configRef.current;
    try {
      if (cfg.provider === "ollama") {
        const models = await listOllamaModels(resolvedEndpoint(cfg));
        return {
          ok: true,
          message: models.length > 0 ? `Connected. Models: ${models.slice(0, 5).join(", ")}${models.length > 5 ? "…" : ""}` : "Ollama is running, but no models are pulled yet.",
          models,
        };
      }
      const model = await resolveModel(cfg);
      const res = await chatOnce(cfg, model, [{ role: "user", content: "Reply with the single word: OK" }], [], AbortSignal.timeout(20000));
      return { ok: true, message: res.content ? `Connected (model ${model}).` : "Connected." };
    } catch (e) {
      return { ok: false, message: String((e as Error)?.message ?? e) };
    }
  }, []);

  const setListening = useCallback((v: boolean) => {
    setEmotion(v ? "listening" : "idle");
  }, []);

  const value = useMemo<AiValue>(
    () => ({
      messages,
      busy,
      emotion,
      config,
      tools,
      send,
      clearChat,
      saveConfig: saveConfigCb,
      testConnection,
      setListening,
      setEmotion: setEmotionFor,
    }),
    [messages, busy, emotion, config, tools, send, clearChat, saveConfigCb, testConnection, setListening, setEmotionFor],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside AiProvider");
  return ctx;
}