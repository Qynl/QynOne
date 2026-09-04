import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getDesktop, isFloatMode } from "./desktop";
import type { AiConfig } from "./desktop";
import { mcpFunctionName, useMcp } from "./mcp";
import { NEX_MAX_MD, chatFileNameFor, describeEntry, fmtBytes, nexFolderDelete, nexFolderList, nexFolderRead, nexFolderReveal, nexFolderWrite } from "./nexfolder";
import { apiContentFor, extractVisionData, hasImages, stripImagesFromMessages, VISION_MARKER, visionEnabled } from "./vision";
import { useNexEmotions } from "./emotion";
import type { EmotionDebug, NexEvent } from "./emotion";
import { clearNowPlaying, playOnAmazonMusic, setNowPlaying } from "./music";
import systemPromptMd from "../system-prompt.md?raw";
import { useQyn } from "./store";
import { useStats } from "./stats";
import { useSystemInfo } from "./system";
import { useVault } from "./vault";
import { useLaunch } from "../components/ui";
import { useMemory, MEMORY_PATH, renderMemory } from "./memory";
import type { MemoryEntry, MemoryKind } from "./memory";
import { MEMORY_COMPACT_AT, MEMORY_MAX_CHARS, NOTE_MAX_CHARS, VAULT_MAX_NOTES } from "./limits";
import { runVaultTidy, vaultUsage } from "./vaultMaintain";
import { dateKey, eventSortKey, fmtTime, parseTime, relativeDay, todayKey, uid } from "./utils";
import { speak, stopSpeaking, useNexVoice } from "./speech";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AiEmotion =
  | "idle"
  | "awake"
  | "present"
  | "greeting"
  | "boot"
  | "listening"
  | "wake"
  | "attentive"
  | "speaking"
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
  | "powerful"
  | "relieved"
  | "frustrated"
  | "victory"
  | "curious"
  | "focused"
  | "focusedLeft"
  | "focusedRight"
  | "anticipating"
  | "playful"
  | "wink"
  | "shy"
  | "surprised"
  | "shocked"
  | "alert"
  | "notification"
  | "eventSoon"
  | "missedEvent"
  | "sad"
  | "crying"
  | "worried"
  | "scared"
  | "confused"
  | "angry"
  | "sleepy"
  | "sleeping"
  | "yawning"
  | "tired"
  | "sick"
  | "zoned"
  | "searching"
  | "scanning"
  | "remembering"
  | "quiet"
  | "offline"
  | "yes"
  | "no"
  | "sorry"
  | "concerned"
  | "welcoming"
  | "confident"
  | "delighted"
  | "disappointed"
  | "amused"
  | "inspired"
  | "restless"
  | "protective"
  | "settled";

export interface AiAttachment {
  /** relative path inside the Nex Folder, e.g. "Chat/MyBrief.md" */
  rel: string;
  name: string;
  kind: "md" | "text" | "image";
  /** photos: in-memory data URL so the model can actually see them */
  dataUrl?: string;
}

export interface AiMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  tool?: string;
  /** files attached to a user message (stored in the Nex Folder) */
  files?: AiAttachment[];
  ts: number;
}

export interface NexThought {
  id: string;
  text: string;
  ts: number;
}

/** A live trace of what Nex is doing: thoughts, tool calls, results, phases. */
export interface AgentEvent {
  id: string;
  ts: number;
  kind: "thought" | "tool-start" | "tool-end" | "phase" | "reply";
  /** thought text, tool name, phase label or reply excerpt */
  text: string;
  /** for tool events: which connection (e.g. "Roblox Studio") the tool belongs to */
  engine?: string;
  /** for tool-end: ok / error, plus a short result excerpt */
  ok?: boolean;
  detail?: string;
  /** wall-clock ms the tool took (tool-end only) */
  ms?: number;
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
/* System prompt — the real prompt lives in src/system-prompt.md.       */
/* Only the ephemeral runtime context is appended here.                 */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(memorySummary: string, engines: string[] = []): string {
  const now = new Date();
  const memoryBlock = memorySummary
    ? `What you remember about this user (long-term memory, stored in ${MEMORY_PATH}):\n${memorySummary}\nUse this to be personal — greet them, reference their projects and preferences. When they correct or update something you remembered, save the correction with the remember tool.`
    : "You have no long-term memory of this user yet. When they tell you something personal (a name, a favorite, a preference, an ongoing project), use the remember tool to save it.";
  const engineBlock =
    engines.length > 0
      ? `\n- Autonomous build mode is active (connected: ${engines.join(", ")}). When the user gives you a development goal, treat it as a project you own: plan, build, test through the engine's own tools, inspect what you made, critically evaluate it, then improve and test again — without waiting for permission between steps. You have a generous step budget this session; use it. Multiple tool calls in one step run in parallel, so batch independent reads and edits together. Narrate your plan and reasoning in your reply text between tool steps — the user watches a live Agent Activity trace of your thoughts, tool calls and results. The user can press Stop at any moment; if interrupted, acknowledge it, state exactly where you stopped and what remains, and never pretend unfinished work is done. Only pause to ask when a decision genuinely cannot be inferred or would substantially change the result. Never stop at "a basic version works" when the request implies more. Before finishing, run /self-review and keep iterating until the quality score is honestly excellent. If a decision would substantially change the result (genre, art style, core mechanic, scope), ask the user one short specific question and wait for the answer — better one good question than a wrong guess. Then finish with what you completed, what you verified, and what you would improve next.`
      : "";
  return `${systemPromptMd.trim()}\n\n---\n\n## Runtime context (refreshed on every request)\n\n- Today: ${now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Current time: ${now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.\n- Vault budget: max ${VAULT_MAX_NOTES} notes, ${(NOTE_MAX_CHARS / 1000).toFixed(0)} KB per note. Memory file: ${MEMORY_PATH} (capped at ${(MEMORY_MAX_CHARS / 1000).toFixed(1)} KB).\n- Connected MCP engines right now: ${engines.length > 0 ? engines.join(", ") : "none — if the user asks for engine work (Roblox, Unreal, …), say you need the QynOne desktop app and the engine running with its MCP server enabled (Settings → Connections)."}${engineBlock}\n- ${memoryBlock}`;
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
  opts?: { temperature?: number; maxTokens?: number },
): Promise<ChatResult> {
  const endpoint = resolvedEndpoint(cfg);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: false,
    temperature: opts?.temperature ?? 0.6,
  };
  if (opts?.maxTokens) body.max_tokens = opts.maxTokens;
  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }
  const sendMessages = (msgs: Array<Record<string, unknown>>) =>
    fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, messages: msgs }),
      signal,
    });
  /* Vision fallback: when the request carried images and the model rejects
     them (text-only model, unsupported custom endpoint), retry once with
     the images stripped so a screenshot never bricks the whole session. */
  const hasImgs = hasImages(messages);
  let res = await sendMessages(messages);
  if (!res.ok && hasImgs && (res.status === 400 || res.status === 404 || res.status === 422 || res.status === 415)) {
    res = await sendMessages(stripImagesFromMessages(messages));
  }
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
/* Automatic memory — Nex saves personal facts it hears                */
/* ------------------------------------------------------------------ */

/** Only run extraction when the user message plausibly contains personal info. */
const PERSONAL_RE =
  /(my name is|call me|i am |i'm |i (?:like|love|prefer|play|use|work|hate|want|need|study|read|watch|enjoy|started|build|built|make|made)|my favorite|my (?:game|app|pc|computer|project|job|birthday|hobby|school|team|dog|cat|name)|remember (?:that|this)|i live in|i go to|i work at|i study)/i;

/** Ask the model to extract durable personal facts from an exchange. */
async function extractMemoryFacts(cfg: AiConfig, model: string, userText: string, aiText: string): Promise<string[]> {
  const res = await chatOnce(
    cfg,
    model,
    [
      {
        role: "system",
        content:
          "Extract only durable personal facts about the user from this exchange: preferences, favorites, habits, identity, ongoing projects. Return ONLY a JSON array of short strings (each under 16 words). If nothing personal was shared, return []. Never invent or guess facts.",
      },
      { role: "user", content: `User said: ${userText.slice(0, 600)}\n\nNex replied: ${aiText.slice(0, 600)}` },
    ],
    [],
    AbortSignal.timeout(20000),
  );
  try {
    const parsed = JSON.parse(res.content.replace(/```json|```/g, "").trim()) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is string => typeof x === "string" && x.trim().length > 4)
        .map((x) => x.trim())
        .slice(0, 3);
    }
  } catch {
    // not JSON — ignore
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Activity helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Long engine results (a full script dump, a big scene tree, …) would bloat the
 * context and slow every following step, so cap what the model actually sees.
 * The head keeps the useful start, the tail preserves the end where errors
 * usually live. Everything in the middle collapses into a short marker.
 */
const TOOL_RESULT_MAX = 12000;

/** Engine tools whose outcome matters enough to feel — builds, tests, runs,
    reviews. */
const IMPORTANT_TOOL_RE = /(build|compile|playtest|publish|generate|test|execute|run|create|insert|script|review|milestone|plan)/i;

function clampToolResult(out: string): string {
  if (out.length <= TOOL_RESULT_MAX) return out;
  const head = Math.floor(TOOL_RESULT_MAX * 0.7);
  const tail = TOOL_RESULT_MAX - head;
  return `${out.slice(0, head)}\n\n[… ${out.length - TOOL_RESULT_MAX} characters omitted …]\n\n${out.slice(-tail)}`;
}

/**
 * Long engine sessions resend every accumulated tool result to the model on
 * every step, so context grows without bound and each step gets slower. Old
 * tool messages keep their call IDs (OpenAI-compatible APIs require the tool
 * result to follow its tool_calls entry) but their content is compressed in
 * place: recent results stay verbatim, older ones collapse to a small digest.
 */
function compressOldToolResults(msgs: Array<Record<string, unknown>>, keep = 6): void {
  const toolIdx: number[] = [];
  msgs.forEach((m, i) => {
    if (m.role === "tool") toolIdx.push(i);
  });
  const keepFrom = toolIdx.length - keep;
  for (let k = 0; k < keepFrom; k++) {
    const idx = toolIdx[k];
    const content = String(msgs[idx].content ?? "");
    if (content.length <= 1400) continue;
    msgs[idx] = {
      ...msgs[idx],
      content: `${content.slice(0, 800)}\n\n[… older result compressed: ${content.length} characters …]\n\n${content.slice(-180)}`,
    };
  }
}

/**
 * Drop an unfinished tail from a saved agent conversation: an assistant
 * message with tool_calls that was aborted mid-call (no tool results yet),
 * plus any orphaned tool results that followed it. Resuming with those in
 * history makes OpenAI-compatible APIs reject the request, so "continue"
 * after a Stop must never carry them.
 */
function trimDanglingToolMessages(msgs: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  while (msgs.length > 0) {
    const last = msgs[msgs.length - 1];
    const isOrphanTool = last.role === "tool";
    const isOpenAssistant = last.role === "assistant" && Array.isArray(last.tool_calls) && last.tool_calls.length > 0;
    if (isOrphanTool || isOpenAssistant) msgs.pop();
    else break;
  }
  return msgs;
}

/**
 * True only when the tool itself reported failure. Searching the whole result
 * for the word "error" false-positives on scripts and scene data that merely
 * contain the word; MCP errors are JSON objects with an error field, or the
 * exact "MCP error" string the SDK throws.
 */
function toolResultFailed(out: string): boolean {
  /* Only a *real* failure counts: a JSON object whose top-level error/isError
     is set. The old regex matched any object containing the word "error"
     anywhere (e.g. {"ok":true,"note":"no error"}), so successful engine
     calls were often flagged as failed. Parse, don't pattern-match. */
  if (/^\s*\{/.test(out)) {
    for (const candidate of [out, out.slice(0, 400)]) {
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === "object") {
          if (obj.isError === true) return true;
          if (typeof obj.error === "string" && obj.error.length > 0) return true;
        }
        return false; // parsed cleanly and it is not an error
      } catch {
        // truncated/invalid — try the next candidate
      }
    }
  }
  return /^MCP error/i.test(out) || /^Error:/i.test(out);
}

/** Short human summary of a tool-call argument blob for the activity feed. */
function summarizeArgs(rawArgs: string): string {
  try {
    const parsed = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
    const parts = Object.entries(parsed)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`);
    const joined = parts.join(" · ");
    return joined.length > 120 ? `${joined.slice(0, 120)}…` : joined;
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface SendOptions {
  /** spoken out loud via the voice interface */
  voice?: boolean;
  /** files attached to this message — already imported into the Nex Folder */
  files?: AiAttachment[];
}

/* ------------------------------------------------------------------ */
/* Chat files — long pastes and attachments become files in the Nex    */
/* Folder (Chat/) so the model never swallows giant user messages and  */
/* the work stays available for the whole job.                         */
/* ------------------------------------------------------------------ */

const LONG_TEXT_CHARS = 5000;
const RESUME_RE = /^(?:continue|keep (?:going|building|working)|resume|pick (?:it|this|things?) up|go on|carry on|weiter|mach weiter|weiter (?:machen|bauen))\b/i;

const FILE_KIND_LABEL: Record<AiAttachment["kind"], string> = {
  md: "markdown",
  text: "text/code",
  image: "photo",
};

/** The user message the model sees when files ride along. */
function buildFileAwarePrompt(text: string, files: AiAttachment[]): string {
  const lines = [
    "The user attached file(s) from your Nex Folder — READ THEM BEFORE YOU ACT by calling your nex-folder tools (list/read). Their contents are part of the request, and they stay in the folder for the whole job so you can re-read or update them.",
    ...files.map((f) => `- ${f.rel} (${FILE_KIND_LABEL[f.kind] ?? f.kind})`),
    "",
    text.trim() || "(No message — the attached files are the whole request.)",
  ];
  return lines.join("\n");
}

/** Save an oversized pasted message as .md in the folder; null when it can't. */
async function saveChatTextAsMd(raw: string): Promise<AiAttachment | null> {
  try {
    const rel = chatFileNameFor(raw);
    const res = await nexFolderWrite(rel, raw);
    if (!res.ok) return null;
    return { rel, name: rel.split("/").pop() ?? rel, kind: "md" };
  } catch {
    return null;
  }
}

interface AiValue {
  messages: AiMessage[];
  thoughts: NexThought[];
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
  announce: (text: string, emotion?: AiEmotion, speakIt?: boolean) => void;
  /** Compress Nex's personal memory with the model so it fits its cap. */
  compactMemory: () => Promise<{ ok: boolean; message: string }>;
  voiceEnabled: boolean;
  setVoiceEnabled: (enabled: boolean) => void;
  /** Live agent trace: thoughts, tool calls, results, phases — newest last. */
  activity: AgentEvent[];
  /** When the current (or last) agent session started; null before any run. */
  sessionStart: number | null;
  /** How many tool calls completed in the current (or last) session. */
  toolCount: number;
  clearActivity: () => void;
  /** Interrupt the running session as soon as the current step finishes. */
  stopSession: () => void;
  /** Whether the user asked to interrupt the session that is running now. */
  stopRequested: boolean;
  /** Rich contextual emotion event — the engine decides what Nex feels. */
  react: (event: NexEvent) => void;
  /** Last emotion decision (dev debugger). */
  emotionDebug: EmotionDebug | null;
  /** 0..1 strength of the current emotion (visual modulation). */
  intensity: number;
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
  const memory = useMemory();
  const mcp = useMcp();
  const launch = useLaunch();
  const stats = useStats();
  const sys = useSystemInfo();

  const statsRef = useRef({ stats, sys });
  statsRef.current = { stats, sys };

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const messagesRef = useRef<AiMessage[]>([]);
  messagesRef.current = messages;
  const [thoughts, setThoughts] = useState<NexThought[]>([
    { id: uid(), text: "*watching QynOne*", ts: Date.now() },
  ]);
  /* Live agent activity — every thought, tool call and result lands here so
     the Agent Activity tab can replay the session as it happens. */
  const [activity, setActivity] = useState<AgentEvent[]>([]);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [toolCount, setToolCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const stopRef = useRef(false);
  /* how many times Nex has self-reviewed a build in the current session —
     bounds the quality loop so it can't spin forever */
  const reviewCountRef = useRef(0);
  /* live build-state digest: goal, plan, milestones and open issues feed a
     compact always-current block every step so long builds stay coherent */
  const goalRef = useRef("");
  const planRef = useRef("");
  const milestonesRef = useRef<string[]>([]);
  const issuesRef = useRef<string[]>([]);
  const sessionAbortRef = useRef<AbortController | null>(null);
  /* When a long build stops early, its agent conversation is kept so a
     "continue" picks up exactly where it stopped — with the plan,
     milestones and open review issues intact instead of a cold restart. */
  const resumeRef = useRef<Array<Record<string, unknown>> | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [config, setConfig] = useState<AiConfig>({ provider: "ollama", endpoint: "", model: "", key: "" });
  const configRef = useRef(config);
  configRef.current = config;

  /* The emotion engine — one decision layer for every feeling Nex shows.
     It owns the emotion state, base-state tracking, overlays, cooldowns,
     confidence gating and the idle drift ladder. */
  const nexEmotions = useNexEmotions({ busy, voiceEnabled });
  const { emotion, intensity: emotionIntensity, debug: emotionDebug, react, set: engineSetEmotion } = nexEmotions;

  useEffect(() => {
    let alive = true;
    loadConfig().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* Voice exclusivity — one Nex owns the microphone. While the floating Nex
     window is open, this (main) Nex never listens; when the float closes,
     voice returns exactly as it was before. The float itself runs its own
     copy of this provider and does not gate itself. */
  const isFloatRenderer = useMemo(() => isFloatMode(), []);
  const [floatOpen, setFloatOpen] = useState(false);
  const suspendedVoice = useRef(false);

  useEffect(() => {
    const bridge = getDesktop();
    if (!bridge || isFloatRenderer) return;
    let off: (() => void) | undefined;
    bridge
      .floatState()
      .then((s) => setFloatOpen(Boolean(s?.open)))
      .catch(() => {});
    off = bridge.onFloatChanged((open) => {
      if (!open && suspendedVoice.current) {
        suspendedVoice.current = false;
        setVoiceEnabled(true);
      }
      setFloatOpen(open);
    });
    return () => off?.();
  }, [isFloatRenderer]);

  useEffect(() => {
    if (!floatOpen || isFloatRenderer) return;
    if (voiceEnabled) {
      suspendedVoice.current = true;
      stopSpeaking();
      setVoiceEnabled(false);
    }
  }, [floatOpen, isFloatRenderer, voiceEnabled]);

  /* Direct emotion sets go through the engine so they respect priorities,
     cooldowns and base-state restore. */
  const setEmotionFor = useCallback((e: AiEmotion, durationMs?: number) => {
    engineSetEmotion(e, durationMs);
  }, [engineSetEmotion]);

  const announce = useCallback((rawText: string, nextEmotion?: AiEmotion, speakIt = false) => {
    const text = rawText.trim();
    if (!text) return;
    setThoughts((current) => [...current, { id: uid(), text, ts: Date.now() }].slice(-24));
    setActivity((a) => [...a, { id: uid(), ts: Date.now(), kind: "thought" as const, text: text.replace(/^\*|\*$/g, "") }].slice(-400));
    if (nextEmotion) setEmotionFor(nextEmotion, 1800);
    if (speakIt) speak(text.replace(/^\*|\*$/g, ""));
  }, [setEmotionFor]);

  const logActivity = useCallback((event: Omit<AgentEvent, "id" | "ts">) => {
    setActivity((a) => [...a, { ...event, id: uid(), ts: Date.now() }].slice(-400));
  }, []);

  const stopSession = useCallback(() => {
    stopRef.current = true;
    setStopRequested(true);
    logActivity({ kind: "phase", text: "Stop requested — finishing the current step, then wrapping up" });
    /* An in-flight model call aborts right away so "Stop" feels instant even
       when the model is streaming a long step. Tool calls already running in
       the engines are allowed to settle (they can't be un-sent), but no new
       step starts and Nex reports where it stopped. */
    sessionAbortRef.current?.abort();
  }, [logActivity]);

  const push = useCallback((role: "user" | "ai", text: string, tool?: string, files?: AiAttachment[]) => {
    setMessages((m) => [...m, { id: uid(), role, text, tool, files: files && files.length > 0 ? files : undefined, ts: Date.now() }]);
  }, []);

  /* ------------------------------------------------------------------ */
  /* AI-managed memory — compress _Nex/Memory.md so it fits its cap      */
  /* ------------------------------------------------------------------ */

  const compactMemory = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const cfg = configRef.current;
    const needsKey = (cfg.provider === "openai" || cfg.provider === "custom") && !cfg.key;
    if (needsKey) {
      return {
        ok: false,
        message: `Compressing memory needs a model connection — ${PROVIDERS[cfg.provider]?.label ?? "this provider"} needs an API key in Settings → AI. Until then Nex keeps the file under its ${(MEMORY_MAX_CHARS / 1000).toFixed(1)} KB cap by dropping the oldest entries automatically.`,
      };
    }
    if (memory.entries.length === 0) return { ok: true, message: "There's nothing in memory yet to compress." };
    try {
      const model = await resolveModel(cfg);
      const res = await chatOnce(
        cfg,
        model,
        [
          {
            role: "system",
            content: "You compress a personal memory file for Nex, an AI assistant. Merge duplicates, drop ephemeral conversation trivia, keep only durable facts and preferences about the user. Never invent anything. Be factual and very concise.",
          },
          {
            role: "user",
            content: `Current memory (${memory.entries.length} entries, ${memory.usage}/${memory.max} chars of file budget):\n${renderMemory(memory.entries)}\n\nRewrite it as ONLY JSON like: {"facts":["..."],"preferences":["..."]}. No markdown, no comments, each string under 160 characters.`,
          },
        ],
        [],
        AbortSignal.timeout(30000),
      );
      const parsed = JSON.parse(res.content.replace(/```json|```/g, "").trim()) as { facts?: unknown; preferences?: unknown };
      const toEntries = (arr: unknown, kind: MemoryKind): MemoryEntry[] =>
        Array.isArray(arr)
          ? arr
              .filter((x): x is string => typeof x === "string" && x.trim().length > 2)
              .map((text) => ({ id: `${kind[0]}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, kind, date: new Date().toISOString().slice(0, 10), text: text.trim().slice(0, 200) }))
          : [];
      const merged = [...toEntries(parsed.facts, "fact"), ...toEntries(parsed.preferences, "preference")];
      if (merged.length === 0) return { ok: false, message: "The model returned nothing usable — memory left unchanged." };
      const fitted = await memory.replaceAll(merged);
      const chars = fitted.reduce((s, e) => s + e.text.length, 0);
      return { ok: true, message: `Compressed memory to ${fitted.length} essentials (${chars.toLocaleString()} chars) — old details are gone, only what matters stays.` };
    } catch (e) {
      return { ok: false, message: `Compression failed: ${String((e as Error)?.message ?? e)}. Memory is still safely under its cap.` };
    }
  }, [memory]);

  /* ------------------------------------------------------------------ */
  /* Tools — real access to QynOne                                       */
  /* ------------------------------------------------------------------ */

  const tools = useMemo<AiToolDef[]>(() => {
    const userNotes = vault.notes.filter((n) => !n.folder.startsWith("_"));
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
          const allowed = ["home", "ai", "apps", "folders", "workspaces", "system", "files", "tools", "vault", "calendar", "settings", "profile"];
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
          if (content.length > NOTE_MAX_CHARS) {
            return `That note would be ${(content.length / 1024).toFixed(1)} KB — over the ${(NOTE_MAX_CHARS / 1000).toFixed(0)} KB per-note limit. Make it shorter, or let me keep a summary instead.`;
          }
          if (!folder.split("/")[0].startsWith("_") && userNotes.length >= VAULT_MAX_NOTES) {
            return `The vault is full (${VAULT_MAX_NOTES} notes). Say /vault-cleanup and I'll archive what no longer fits.`;
          }
          const path = await vault.createNote(name, folder, content);
          if (!path) return `Couldn't create "${name}" (does it already exist, or is the vault at its limit?).`;
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
          const hit = userNotes.find((n) => n.name.toLowerCase() === q) ?? userNotes.find((n) => n.name.toLowerCase().includes(q));
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
          const hits = vault.searchNotes(String(args.query ?? "")).filter((n) => !n.folder.startsWith("_"));
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
          userNotes.length === 0
            ? "The vault is empty."
            : userNotes.map((n) => `${n.name} (${n.folder || "root"})`).join(", "),
      },
      {
        name: "remember",
        usage: "/remember <fact> [kind: fact|preference]",
        description: "Save a fact or preference about the user so Nex remembers it long-term. Stored as a real line in the Markdown vault (_Nex/Memory.md).",
        parameters: {
          type: "object",
          properties: {
            fact: { type: "string", description: "what to remember, e.g. 'the user's favorite game is Minecraft'" },
            kind: { type: "string", enum: ["fact", "preference"], description: "fact or preference" },
          },
          required: ["fact"],
        },
        run: async (args) => {
          const fact = String(args.fact ?? "").trim();
          if (!fact) return "There's nothing to remember yet.";
          const kind: MemoryKind = args.kind === "preference" ? "preference" : "fact";
          const saved = await memory.add(kind, fact);
          if (!saved) return `I already remember: "${fact}".`;
          return `Remembered (${kind}): "${fact}". It's stored in ${MEMORY_PATH}.`;
        },
      },
      {
        name: "memory",
        usage: "/memory",
        description: "Show everything Nex remembers about the user: facts, preferences and recent conversations.",
        parameters: { type: "object", properties: {} },
        run: () => {
          if (memory.entries.length === 0) {
            return "I don't remember anything about you yet. Tell me something personal (a favorite, a project, a preference) and I'll save it — or use /remember.";
          }
          const parts: string[] = [];
          if (memory.facts.length) parts.push(`Facts: ${memory.facts.map((e) => e.text).join("; ")}`);
          if (memory.preferences.length) parts.push(`Preferences: ${memory.preferences.map((e) => e.text).join("; ")}`);
          if (memory.conversations.length) parts.push(`Recent conversations: ${memory.conversations.slice(-4).map((e) => e.text).join("; ")}`);
          return parts.join("\n");
        },
      },
      {
        name: "forget",
        usage: "/forget <text or id>",
        description: "Delete one or more memory entries that match the given text or entry id.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "text or id of the memory to forget" } },
          required: ["query"],
        },
        run: async (args) => {
          const q = String(args.query ?? "").toLowerCase().trim();
          if (!q) return "What should I forget?";
          const hits = memory.entries.filter((e) => e.id === q || e.text.toLowerCase().includes(q));
          if (hits.length === 0) return `I don't remember anything matching "${args.query}".`;
          for (const h of hits) await memory.remove(h.id);
          return `Forgot ${hits.length} thing${hits.length === 1 ? "" : "s"}: ${hits.map((h) => `"${h.text}"`).join(", ")}.`;
        },
      },
      {
        name: "memory-compact",
        usage: "/memory-compact",
        description: "Compress Nex's personal memory (_Nex/Memory.md, capped at 2 KB) with the AI — merges duplicates and drops trivia so only the essentials fit.",
        parameters: { type: "object", properties: {} },
        run: async () => {
          const r = await compactMemory();
          return r.message;
        },
      },
      {
        name: "vault-stats",
        usage: "/vault-stats",
        description: "Show how full the vault is versus its budgets: max notes, max size per note, and Nex's memory usage.",
        parameters: { type: "object", properties: {} },
        run: () => {
          const u = vaultUsage(vault.notes);
          const mem = `${memory.usage.toLocaleString()} / ${memory.max.toLocaleString()} chars (${memory.facts.length} facts, ${memory.preferences.length} preferences${memory.conversations.length ? `, ${memory.conversations.length} conversations` : ""})`;
          return `Vault: ${u.notes}/${u.maxNotes} notes · largest note ${(u.largestChars / 1024).toFixed(1)} KB (limit ${(NOTE_MAX_CHARS / 1000).toFixed(0)} KB each) · total ${(u.totalChars / 1024).toFixed(1)} KB. Nex memory: ${mem}. ${u.over ? "The vault is over budget — say /vault-cleanup." : "Everything is within budget."}`;
        },
      },
      {
        name: "vault-cleanup",
        usage: "/vault-cleanup",
        description: "Manage the vault when it exceeds its budgets: archive oversized notes (full version saved under _Nex/Archive) and condense them, and archive surplus orphan notes to bring the count back under the limit.",
        parameters: { type: "object", properties: {} },
        run: async () => {
          const r = await runVaultTidy(vault);
          return r.actions.join("\n");
        },
      },
      {
        name: "open-vault",
        usage: "/open-vault",
        description: "Open the Markdown vault and Nex's memory.",
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
          const saved = res.ok
            ? `Saved a screenshot${res.path ? ` to ${res.path}` : ""}. `
            : `Screen capture worked but saving to Pictures failed (${res.error ?? "unknown error"}). `;
          return `${saved}${visionEnabled(configRef.current) ? "Here's what I see:\n" : ""}${VISION_MARKER}${cap}`;
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
      {
        name: "music",
        usage: "/music <song, artist or album>",
        description: "Play music through Amazon Music — opens Amazon Music searching exactly what the user asked for and puts your headphones on (headphones + dance + track shown below the eyes).",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "song, artist, album or playlist the user wants to hear" } },
          required: ["query"],
        },
        run: async (args) => {
          const query = String(args.query ?? "").trim();
          if (!query) return "What should I play? Name a song, an artist or an album.";
          const res = await playOnAmazonMusic(query);
          if (!res.ok) return `I couldn't open Amazon Music: ${res.error ?? "unknown error"}.`;
          setNowPlaying(query);
          return `Amazon Music is open, searching “${query}”. Amazon Music has no public now-playing API, so I'll show “${query}” as playing until you stop me or tell me the real track.`;
        },
      },
      {
        name: "music-stop",
        usage: "/music-stop",
        description: "Stop the music session — headphones off, dancing stops, track caption disappears.",
        parameters: { type: "object", properties: {} },
        run: () => {
          clearNowPlaying();
          return "Music stopped — headphones off.";
        },
      },
      {
        name: "plan",
        usage: "/plan",
        description:
          "Record or update your plan for the current build. Call this early for any big goal (games, levels, systems) — the goal and steps go into a live build-state digest that refreshes every step, so you never drift from the plan on long sessions.",
        parameters: {
          type: "object",
          properties: {
            goal: { type: "string", description: "What you are building, in one line." },
            steps: { type: "array", items: { type: "string" }, description: "The ordered plan — systems, maps, assets, polish phases — under 12 steps." },
          },
          required: ["goal", "steps"],
        },
        run: (args) => {
          const goal = String(args.goal ?? "").trim().slice(0, 220);
          const steps = Array.isArray(args.steps) ? args.steps.map(String).filter(Boolean).slice(0, 12) : [];
          planRef.current = goal ? `${goal} — ${steps.join(" → ")}`.slice(0, 700) : steps.join(" → ");
          logActivity({ kind: "phase", text: `Plan: ${planRef.current.slice(0, 220)}` });
          return `Plan recorded and live in the build-state digest: ${planRef.current}`;
        },
      },
      {
        name: "milestone",
        usage: "/milestone",
        description:
          "Record a completed milestone: what you built, where (paths or instances), and how you verified it. The live build-state digest carries it forward, so you never lose track of your own work on long builds. Call this after every significant chunk.",
        parameters: {
          type: "object",
          properties: {
            note: { type: "string", description: "Short milestone: what you built, where, and how you verified it. Under 160 characters." },
          },
          required: ["note"],
        },
        run: (args) => {
          const note = String(args.note ?? "").trim().slice(0, 180);
          if (!note) return "No milestone recorded — send a note.";
          milestonesRef.current = [...milestonesRef.current, note].slice(-16);
          logActivity({ kind: "phase", text: `Milestone: ${note}` });
          return "Milestone recorded — the live build-state digest now includes it.";
        },
      },
      {
        name: "self-review",
        usage: "/self-review",
        description:
          "Critically evaluate the work you just built in the connected engine before you finish. Call this whenever you complete a significant chunk of work or before writing your final summary: The bar is EXTREMELY high: quality means a game people actually want — fun, polished, good-looking and stable — not merely one that works. Score 9-10 only when you would proudly ship it; 7-8 means functional but not good enough (keep improving); below 7 means clearly unfinished. Be brutally honest — a low score never means you give up, it means you keep working until it's genuinely great.",
        parameters: {
          type: "object",
          properties: {
            work: { type: "string", description: "What you built and tested so far, 1-3 sentences." },
            quality: { type: "number", description: "Honest 1-10 score: how close is the result to a game people would actually enjoy? 9-10 = fun, polished, good-looking, stable. 7-8 = works but not shippable." },
            issues: { type: "array", items: { type: "string" }, description: "Concrete problems or gaps you found, especially gameplay feel, visuals, polish and stability — 1-5 items." },
            next: { type: "array", items: { type: "string" }, description: "What you will improve next, in order of impact." },
          },
          required: ["work", "quality", "issues"],
        },
        run: (args) => {
          const quality = Math.max(1, Math.min(10, Math.round(Number(args.quality) || 1)));
          const issues = Array.isArray(args.issues) ? args.issues.map(String).filter(Boolean).slice(0, 5) : [];
          const next = Array.isArray(args.next) ? args.next.map(String).filter(Boolean).slice(0, 4) : [];
          reviewCountRef.current += 1;
          const count = reviewCountRef.current;
          issuesRef.current = issues;
          logActivity({
            kind: "phase",
            text: `Self-review #${count}: quality ${quality}/10${issues.length ? ` — ${issues.join("; ")}` : ""}`,
          });
          if (quality >= 9) {
            return `Self-review recorded: quality ${quality}/10 — genuinely good.${issues.length ? ` Small notes: ${issues.join("; ")}.` : ""} Do one last quick check (run the game, look at the screen, read the console), then write your final summary: what you built, what you verified through the engine, and what you'd improve with more time.`;
          }
          if (quality === 8) {
            return `Self-review recorded: quality 8/10 — very close, but not at the bar yet.${issues.length ? ` Polish these: ${issues.join("; ")}.` : " Find the biggest remaining rough edge and fix it."} One decisive polish pass (feel, visuals, stability), test once more, then re-review. The user wants top quality, not almost.`;
          }
          if (count >= 5) {
            return `Self-review #${count} recorded: quality ${quality}/10. The session's review budget is spent, so fix the single most important issue${issues.length ? ` (${issues[0]})` : ""}, test once more, then write your final honest summary — including exactly what remains below the quality bar.`;
          }
          return `Self-review #${count} recorded: quality ${quality}/10 — this is NOT good enough to finish yet. Your own issues: ${issues.length ? issues.join("; ") : "(none listed)"}. Next up, in order: ${next.length ? next.join(" → ") : "fix the issues above"}. Continue working: address them, test again in the engine, then call self-review again. The user wants a real, polished, fun game — not a demo.`;
        },
      },
      {
        name: "nex-folder-list",
        usage: "/nex-folder-list",
        description:
          "List everything in the user's Nex Folder — the ONE folder that belongs to you, holding .md briefs, text/code files and photos the user dropped there. Call this first whenever the user says to work with the folder, a brief, or a dropped file: see what is there before reading anything.",
        parameters: { type: "object", properties: {} },
        run: async () => {
          const list = await nexFolderList();
          if (!list) return "The Nex Folder lives in the QynOne desktop app — it isn't available in this preview.";
          if (!list.exists) return "The Nex Folder hasn't been created yet. Ask the user to open the Nex Folder tab in the AI view and click the create button — it takes one click, then they can drop files in.";
          if (list.entries.length === 0) return `The Nex Folder (${list.root}) is empty — ask the user to drop in .md briefs, text/code files or photos first.`;
          const dirs = list.entries.filter((e) => e.isDir);
          const files = list.entries.filter((e) => !e.isDir && e.allowed);
          const ignored = list.entries.filter((e) => !e.isDir && !e.allowed).length;
          const lines = [...dirs.map((d) => `📁 ${d.rel}/ (folder)`), ...files.map((f) => `📄 ${describeEntry(f)}`)];
          if (lines.length === 0) lines.push("(nothing Nex can use — every file in the folder is an unsupported type)");
          return [`Nex Folder (${list.root}):`, ...lines, ignored > 0 ? `Note: ${ignored} other file${ignored === 1 ? "" : "s"} in the folder are unsupported types — those are off-limits.` : ""].filter(Boolean).join("\n");
        },
      },
      {
        name: "nex-folder-read",
        usage: "/nex-folder-read <relative path>",
        description:
          "Read a file from the Nex Folder by its relative path (e.g. Briefs/TacticalShooter.md, Chat/code.lua or idea.md — nex-folder-list shows exact names). .md and text/code files come back as full text — follow them as requirements; photos open for the user instead. When the user says to work from the folder, read the relevant files BEFORE you act; re-read after edits when they changed.",
        parameters: {
          type: "object",
          properties: { path: { type: "string", description: "relative path of the .md file inside the Nex Folder" } },
          required: ["path"],
        },
        run: async (args) => {
          const path = String(args.path ?? "").trim();
          if (!path) return "Which file? Pass its relative path — nex-folder-list shows the exact names.";
          const res = await nexFolderRead(path);
          if (!res.ok) return res.error ?? "Couldn't read that file.";
          if (res.kind === "image") {
            return `“${res.name}” is a photo (${fmtBytes(res.size ?? 0)}). You can't analyze image content yet, so open it for the user with nex-folder-open and ask them what matters about it — or work from a .md brief instead.`;
          }
          const content = (res.content ?? "").trim();
          if (!content) return `“${res.name}” is empty.`;
          return `── ${res.name} · ${fmtBytes(res.size ?? 0)} ──\n${content}`;
        },
      },
      {
        name: "nex-folder-write",
        usage: "/nex-folder-write <relative path> <content>",
        description:
          "Create or update a .md file inside the Nex Folder. Use it to write your plan and spec before a build from a brief, to log progress, to save decisions, or to leave the user a summary of what you built and verified. The path is relative (missing subfolders are created automatically). Only .md and text/code files can be written (photos are added by you) — put the full content in the content argument.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "relative path ending in .md, e.g. Plans/MyGame.md" },
            content: { type: "string", description: "the full Markdown content to write" },
          },
          required: ["path", "content"],
        },
        run: async (args) => {
          const path = String(args.path ?? "").trim();
          const content = String(args.content ?? "");
          if (!path) return "Which file? Pass a relative path ending in .md.";
          const res = await nexFolderWrite(path, content.length > NEX_MAX_MD ? content.slice(0, NEX_MAX_MD) : content);
          return res.ok ? `Wrote ${path} in the Nex Folder.` : res.error ?? "Couldn't write that file.";
        },
      },
      {
        name: "nex-folder-delete",
        usage: "/nex-folder-delete <relative path>",
        description:
          "Delete a .md file, text/code file or photo from the Nex Folder by relative path (only files you created or that the user gave you — subfolders themselves can't be deleted this way). Deleting is permanent, so confirm with the user before removing something they deposited.",
        parameters: {
          type: "object",
          properties: { path: { type: "string", description: "relative path of the file to delete" } },
          required: ["path"],
        },
        run: async (args) => {
          const path = String(args.path ?? "").trim();
          if (!path) return "Which file? Pass its relative path.";
          const res = await nexFolderDelete(path);
          return res.ok ? `Deleted ${path} from the Nex Folder.` : res.error ?? "Couldn't delete that file.";
        },
      },
      {
        name: "nex-folder-open",
        usage: "/nex-folder-open <relative path>",
        description:
          "Open a file or folder from the Nex Folder on the user's screen — photos open in their photo viewer, .md files open in the editor, a folder path opens in Explorer. Use this when the user needs to look at a photo or file themselves (you can't see image content).",
        parameters: {
          type: "object",
          properties: { path: { type: "string", description: "relative path of the file or folder to open (omit to open the folder itself)" } },
          required: [],
        },
        run: async (args) => {
          const path = String(args.path ?? "").trim();
          const res = await nexFolderReveal(path || undefined);
          return res.ok ? (path ? `Opened ${path} for the user.` : "Opened the Nex Folder in Explorer.") : res.error ?? "Couldn't open that.";
        },
      },
    ];
  }, [state, vault, memory, launch, onNavigate, onOpenFolder, onOpenNote, actions, logActivity]);

  /* MCP engines (Roblox Studio, Unreal Engine, …) — every tool a connected
     engine advertises becomes a real function the model can call. The run
     handler forwards to the engine through the Electron main process. */
  const engineTools = useMemo<AiToolDef[]>(() => {
    return mcp.tools.map((t) => ({
      name: mcpFunctionName(t.serverSlug, t.name),
      usage: `${t.serverName} · ${t.name}`,
      description: `[${t.serverName}] ${t.description || t.name}`,
      parameters: t.parameters,
      run: async (args) => {
        const res = await mcp.call(t.serverId, t.name, args);
        if (!res.ok) throw new Error(res.error || `${t.name} failed`);
        return res.result ?? "done";
      },
    }));
  }, [mcp]);

  /* What the model may call this turn: engine tools + QynOne tools. */
  const modelTools = useMemo<AiToolDef[]>(() => [...engineTools, ...tools], [engineTools, tools]);

  /* ------------------------------------------------------------------ */
  /* Send                                                               */
  /* ------------------------------------------------------------------ */

  const send = useCallback(
    async (rawText: string, opts?: SendOptions) => {
      let text = rawText.trim();
      if (!text || busy) return;
      const viaVoice = Boolean(opts?.voice);
      const attachedFiles: AiAttachment[] = [...(opts?.files ?? [])];
      announce(viaVoice ? "*listening to you*" : "*receiving a new request*", "attentive");

      /* Slash commands — direct tool use. */
      const slash = text.match(/^\/([a-z-]+)\s*(.*)$/i);
      if (slash) {
        const toolName = slash[1].toLowerCase();
        const remainder = slash[2].trim();
        const tool = tools.find((t) => t.name === toolName);
        push("user", text, toolName);
        react({ kind: "task-start", task: "tool" });
        announce(`*using /${toolName}*`);
        setBusy(true);
        try {
          if (!tool) {
            push(
              "ai",
              `I don't know the tool \`/${toolName}\`. Here's what I can do:\n${tools
                .map((t) => `- \`${t.usage}\` — ${t.description}`)
                .join("\n")}`,
            );
            react({ kind: "task-fail" });
            return;
          }
          let args: Record<string, unknown> = {};
          if (remainder) {
            try {
              args = JSON.parse(remainder);
            } catch {
              const first = Object.keys(tool.parameters.properties ?? {})[0];
              args = first === "query" || first === "name" || first === "view" || first === "path" ? { [first]: remainder } : { query: remainder };
            }
          }
          const result = await tool.run(args);
          const visResult = extractVisionData(result);
          push("ai", visResult ? visResult.text : result, toolName);
          announce(`*finished /${toolName}*`);
          react({ kind: "task-success", importance: "minor" });
        } catch (e) {
          push("ai", `The tool errored: ${String((e as Error)?.message ?? e)}`);
          announce(`*${toolName} needs attention*`);
          react({ kind: "task-fail" });
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
        react({ kind: "task-fail" });
        return;
      }

      /* Long pastes become .md files in the Nex Folder (Chat/) instead of
         giant chat messages — the file becomes the message, and Nex reads
         it through its folder tools. Falls back to inline text when the
         folder is unreachable (web preview). */
      if (attachedFiles.length === 0 && !viaVoice && text.length > LONG_TEXT_CHARS && text.length <= NEX_MAX_MD - 2048) {
        const saved = await saveChatTextAsMd(text);
        if (saved) {
          const originalLen = text.length;
          attachedFiles.push(saved);
          text = `I pasted a long text (${originalLen.toLocaleString()} characters) — I saved it as ${saved.rel} in the Nex Folder. Read it with your nex-folder tools and work from it.`;
        }
      }
      const isResume = !viaVoice && resumeRef.current !== null && resumeRef.current.length > 0 && RESUME_RE.test(text);
      push("user", text, undefined, attachedFiles.length > 0 ? attachedFiles : undefined);
      const engineSession = engineTools.length > 0;
      announce(engineSession ? (isResume ? "*resuming the build session*" : "*starting an autonomous build session*") : "*thinking about what you asked*");
      setBusy(true);
      setStopRequested(false);
      stopRef.current = false;
      if (!isResume) {
        reviewCountRef.current = 0;
        goalRef.current = text.trim() || (attachedFiles.length > 0 ? `Work from the attached file(s): ${attachedFiles.map((f) => f.rel).join(", ")}` : "");
        planRef.current = "";
        milestonesRef.current = [];
        issuesRef.current = [];
        resumeRef.current = null;
      }
      react({ kind: "task-start", task: engineSession ? "build" : "chat" });
      setActivity([]);
      setToolCount(0);
      setSessionStart(Date.now());
      const connectedEngines = mcp.servers.filter((s) => s.state === "connected").map((s) => s.name);
      if (engineSession) {
        logActivity({
          kind: "phase",
          text: isResume
            ? "Session resumed — picking up the previous build with its goal, plan, milestones and open issues intact"
            : `Session started — ${connectedEngines.length} engine${connectedEngines.length === 1 ? "" : "s"} connected (${connectedEngines.join(", ") || "none"}), autonomous mode on`,
        });
      }
      /* Engine builds run long: a generous per-model-call timeout and a big
         step budget (each tool result feeds the next decision), guarded by
         an overall session cap so Nex always comes back with a report. */
      const sessionStart = Date.now();
      const MAX_STEPS = engineSession ? 90 : 8;
      const SESSION_MS = 25 * 60_000;
      const STEP_MS = 180_000;
      let stoppedEarly: "" | "time" | "steps" | "stop" = "";
      let toolsRun = 0;
      /* The working conversation, kept so an aborted/stopped session can be
         resumed ("continue"). Set inside try, read in catch on Stop. */
      let msgsForResume: Array<Record<string, unknown>> | null = null;

      try {
        const model = await resolveModel(cfg);
        const history = messages
          .filter((m) => m.role === "user" || m.role === "ai")
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.text }));
        const engines = mcp.servers.filter((s) => s.state === "connected").map((s) => s.name);
        const baseContent = attachedFiles.length > 0 ? buildFileAwarePrompt(text, attachedFiles) : text;
        const userContent = apiContentFor(baseContent, attachedFiles, visionEnabled(cfg));
        const resumeTail = isResume && resumeRef.current ? resumeRef.current : null;
        const msgs: Array<Record<string, unknown>> = resumeTail
          ? [
              { role: "system", content: buildSystemPrompt(memory.summary, engines) },
              ...resumeTail,
              { role: "user", content: userContent },
            ]
          : [
              { role: "system", content: buildSystemPrompt(memory.summary, engines) },
              ...history,
              { role: "user", content: userContent },
            ];
        /* Live build-state digest — a compact always-current block (goal, plan,
           milestones, open review issues) re-inserted after every step so the
           model always knows what it built, even 80 steps in. */
        const upsertStateDigest = (msgsArr: Array<Record<string, unknown>>) => {
          for (let i = msgsArr.length - 1; i >= 1; i--) {
            if (String(msgsArr[i].content ?? "").startsWith("__QYN_STATE__")) msgsArr.splice(i, 1);
          }
          const digest = [
            "__QYN_STATE__ — live build state, always current. Read it every step.",
            `Goal: ${goalRef.current || "—"}`,
            `Plan: ${planRef.current || "not recorded yet — call the plan tool early"}`,
            `Completed milestones: ${milestonesRef.current.length > 0 ? milestonesRef.current.slice(-12).join(" | ") : "none yet"}`,
            `Open issues from your last self-review: ${issuesRef.current.length > 0 ? issuesRef.current.join("; ") : "none"}`,
          ].join("\n");
          msgsArr.splice(1, 0, { role: "user", content: digest });
        };
        upsertStateDigest(msgs);
        msgsForResume = msgs;

        let finalText = "";
        let pendingVision: string | null = null;
        for (let step = 0; step < MAX_STEPS; step++) {
          if (Date.now() - sessionStart > SESSION_MS) {
            stoppedEarly = "time";
            break;
          }
          if (stopRef.current) {
            stoppedEarly = "stop";
            break;
          }
          const controller = new AbortController();
          sessionAbortRef.current = controller;
          const timeout = window.setTimeout(() => controller.abort(), STEP_MS);
          let res: ChatResult;
          try {
            res = await chatOnce(cfg, model, msgs, modelTools, controller.signal, engineSession ? { temperature: 0.45, maxTokens: 4096 } : undefined);
          } finally {
            window.clearTimeout(timeout);
          }
          if (res.content.trim()) {
            logActivity({ kind: "thought", text: res.content.trim().slice(0, 220) });
          }
          if (!res.toolCalls || res.toolCalls.length === 0) {
            finalText = res.content;
            break;
          }
          if (step === MAX_STEPS - 1) stoppedEarly = "steps";
          msgs.push({
            role: "assistant",
            content: res.content || null,
            tool_calls: res.toolCalls.map((tc) => ({
              id: tc.id ?? `call_${step}_${Math.random().toString(36).slice(2, 8)}`,
              type: "function",
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });

          /* Parallel execution: the model gets one tool result back per call,
             but independent calls now run at the same time. Multiple engines
             (Roblox + Unreal) and multiple read/plan tools stop queueing
             behind each other — this is the single biggest speed win. */
          const runs = res.toolCalls.map((tc) => {
            const tool = modelTools.find((t) => t.name === tc.function.name);
            const isEngine = tc.function.name.startsWith("mcp_") && Boolean(tool);
            const label = isEngine && tool ? tool.usage : `/${tc.function.name}`;
            const started = Date.now();
            logActivity({ kind: "tool-start", text: label, engine: isEngine && tool ? tool.usage.split(" · ")[0] : undefined, detail: summarizeArgs(tc.function.arguments) });
            const run = async (): Promise<string> => {
              try {
                const args = (() => {
                  try {
                    return JSON.parse(tc.function.arguments ?? "{}") as Record<string, unknown>;
                  } catch {
                    return {};
                  }
                })();
                const out = tool ? await tool.run(args) : JSON.stringify({ error: `unknown tool ${tc.function.name}` });
                return out;
              } catch (e) {
                return JSON.stringify({ error: String((e as Error)?.message ?? e) });
              }
            };
            return { tc, label, isEngine, started, run };
          });
          react({ kind: "task-step", engine: engineSession });
          const settled = await Promise.all(runs.map((r) => r.run().then((out) => ({ r, out }))));
          for (const { r, out } of settled) {
            const ms = Date.now() - r.started;
            const failed = toolResultFailed(out);
            toolsRun += 1;
            setToolCount((n) => n + 1);
            logActivity({ kind: "tool-end", text: r.label, engine: r.isEngine && r.label.includes(" · ") ? r.label.split(" · ")[0] : undefined, ok: !failed, detail: out.length > 240 ? `${out.slice(0, 240)}…` : out, ms });
            react({ kind: "tool-result", ok: !failed, engine: r.isEngine, important: IMPORTANT_TOOL_RE.test(r.tc.function.name) });
            const vis = extractVisionData(out);
            const clamped = clampToolResult(vis ? vis.text : out);
            msgs.push(r.tc.id ? { role: "tool", tool_call_id: r.tc.id, content: clamped } : { role: "tool", content: clamped });
            if (vis) pendingVision = vis.dataUrl;
          }
          /* Vision: the freshly captured screenshot rides into the next model
             call as a real image part. Text-only models get it stripped by
             chatOnce's fallback and never brick the session. */
          if (pendingVision && visionEnabled(cfg)) {
            msgs.push({
              role: "user",
              content: [
                { type: "text", text: "[The latest screen capture — inspect it carefully before you continue.]" },
                { type: "image_url", image_url: { url: pendingVision } },
              ],
            });
            pendingVision = null;
          }
          /* Long sessions resend every accumulated tool result to the model on
             every step, so context grows without bound and each step gets
             slower. Old results keep their call IDs (the API requires them)
             but are compressed in place to a small digest — the model keeps
             reading recent results in full and only sees the gist of old ones. */
          compressOldToolResults(msgs, 6);
          upsertStateDigest(msgs);
        }
        if (stoppedEarly === "time") {
          finalText = `${finalText ? `${finalText.trim()}\n\n` : ""}I hit this session's work-time limit, so I stopped here — ask me to continue and I'll pick up where I left off.`;
          announce("*session time limit — paused honestly*");
          react({ kind: "task-fail" });
        } else if (stoppedEarly === "steps") {
          finalText = `${finalText ? `${finalText.trim()}\n\n` : ""}I reached this session's step budget and paused. Say "continue" and I'll keep building from here.`;
          announce("*step budget reached — paused honestly*");
          react({ kind: "task-fail" });
        } else if (stoppedEarly === "stop") {
          finalText = `${finalText ? `${finalText.trim()}\n\n` : ""}Stopped, as you asked. Where I left off: ${toolsRun} tool call${toolsRun === 1 ? "" : "s"} done${finalText.trim() ? ` — ${finalText.trim()}` : ", before I wrote my summary."}`;
          announce("*stopped — wrapping up*");
          react({ kind: "stopped" });
        }
        /* A session that stopped early keeps its conversation so the next
           "continue" resumes it; a session that ran to completion is done. */
        if (stoppedEarly) {
          resumeRef.current = trimDanglingToolMessages(msgsForResume ?? [])
            .filter((m) => !String(m.content ?? "").startsWith("__QYN_STATE__"))
            .slice(-44);
        } else {
          resumeRef.current = null;
        }
        if (!finalText.trim()) finalText = "I couldn't produce an answer.";
        push("ai", finalText.trim());
        logActivity({ kind: "reply", text: finalText.trim().slice(0, 220), detail: engineSession ? `${toolsRun} tool call${toolsRun === 1 ? "" : "s"} this session` : undefined });
        announce(engineSession ? "*build session wrapped up*" : "*answer ready*");
        react({ kind: "task-success", importance: engineSession ? (toolsRun >= 8 ? "major" : "normal") : "normal" });
        if (viaVoice) speak(finalText.trim());

        /* React to the user's tone after answering — typed messages show it
           on the eyes; spoken replies are already animated by the voice. The
           engine weighs the words against what just happened, so "YES!"
           after a finished build is victory, not just excitement. */
        if (!viaVoice) react({ kind: "user-said", text });

        /* Personal memory — when the user shares something personal, Nex
           quietly extracts durable facts and saves them. This runs in the
           background so it never delays the reply the user is waiting for. */
        if (PERSONAL_RE.test(text)) {
          void extractMemoryFacts(cfg, model, text, finalText)
            .then(async (facts) => {
              let saved = 0;
              for (const fact of facts) {
                const entry = await memory.add("fact", fact);
                if (entry) saved += 1;
              }
              if (saved > 0) {
                announce(`*remembered ${saved} thing${saved === 1 ? "" : "s"} about you*`);
                react({ kind: "memory-saved" });
                /* Memory is capped: when it gets close to full, Nex manages it
                   by compressing to the essentials with the model. */
                if (memory.usage > memory.max * MEMORY_COMPACT_AT) {
                  const comp = await compactMemory();
                  announce(comp.ok ? "*memory nearly full — compressed to the essentials*" : "*memory is near its cap*");
                }
              }
            })
            .catch(() => {
              // memory is best-effort — never surface or break anything
            });
        }
      } catch (e) {
        const err = e as Error;
        const isAbort = err.name === "AbortError";
        const isStop = isAbort && stopRef.current;
        const isConn = /fetch|Failed to fetch|NetworkError|ECONNREFUSED/i.test(err.message);
        let reply: string;
        if (isStop) {
          reply = `Stopped, as you asked — ${toolsRun} tool call${toolsRun === 1 ? "" : "s"} had run${toolsRun > 0 ? "; the results so far are safe in the engine" : ""}. Say "continue" whenever you want me to pick the work back up.`;
          announce("*stopped — wrapping up*");
          react({ kind: "stopped" });
          /* The model call aborted mid-turn, so the loop never reached the
             resume block at the bottom — save the conversation here so
             "continue" actually picks up the build. Dangling tool_calls
             from the aborted step are trimmed. */
          if (msgsForResume) {
            resumeRef.current = trimDanglingToolMessages(msgsForResume)
              .filter((m) => !String(m.content ?? "").startsWith("__QYN_STATE__"))
              .slice(-44);
          }
        } else if (isAbort) {
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
        announce("*the connection needs attention*");
        react({ kind: "task-fail" });
        if (viaVoice) speak(reply);
      } finally {
        setBusy(false);
      }
    },
    [announce, busy, compactMemory, memory, messages, push, react, tools, modelTools, engineTools, mcp, logActivity, stopSession],
  );

  useNexVoice({
    enabled: voiceEnabled,
    callbacks: {
      onWake: () => {
        announce("*Nex is awake*");
        react({ kind: "voice-wake" });
      },
      onListenStart: () => react({ kind: "voice-listen", on: true }),
      onIdle: () => {
        if (!busy) react({ kind: "voice-listen", on: false });
      },
      onCommand: (text) => {
        announce("*listening closely*");
        react({ kind: "voice-command" });
        void send(text, { voice: true });
      },
      onError: (message) => {
        setVoiceEnabled(false);
        announce(`*voice needs attention: ${message}*`);
        react({ kind: "voice-error" });
      },
    },
  });

  useEffect(() => {
    if (!voiceEnabled) stopSpeaking();
  }, [voiceEnabled]);

  /* TTS broadcasts speaking state so the eyes animate while Nex talks — the
     engine keeps it as a direct state and returns to the base afterwards. */
  useEffect(() => {
    const onSpeaking = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      react({ kind: "speaking", on: active });
    };
    window.addEventListener("qyn:nex-speaking", onSpeaking);
    return () => window.removeEventListener("qyn:nex-speaking", onSpeaking);
  }, [react]);

  /* MCP engine connection changes — a real event Nex can feel: connecting is
     attentive, a successful connection is a small happy beat, a failure is
     concern. Background events are suppressed while a session is running. */
  const prevMcpStatesRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const prev = prevMcpStatesRef.current;
    for (const server of mcp.servers) {
      const before = prev[server.id];
      if (before === undefined || before === server.state) continue;
      prev[server.id] = server.state;
      if (server.state === "connecting") react({ kind: "mcp-connecting" });
      else if (server.state === "connected") react({ kind: "mcp-connected" });
      else if (server.state === "error") react({ kind: "mcp-failed" });
    }
  }, [mcp.servers, react]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setEmotionFor("idle");
    /* Clearing the chat also forgets any paused build — otherwise typing
       "continue" after a clear would resume an invisible old session. */
    resumeRef.current = null;
    goalRef.current = "";
    planRef.current = "";
    milestonesRef.current = [];
    issuesRef.current = [];
  }, [setEmotionFor]);

  const clearActivity = useCallback(() => {
    setActivity([]);
    setToolCount(0);
    setSessionStart(null);
  }, []);

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
    react({ kind: "voice-listen", on: v });
  }, [react]);

  const value = useMemo<AiValue>(
    () => ({
      messages,
      thoughts,
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
      announce,
      compactMemory,
      voiceEnabled,
      setVoiceEnabled,
      activity,
      sessionStart,
      toolCount,
      clearActivity,
      stopSession,
      stopRequested,
      react,
      emotionDebug,
      intensity: emotionIntensity,
    }),
    [messages, thoughts, busy, emotion, config, tools, send, clearChat, saveConfigCb, testConnection, compactMemory, setListening, setEmotionFor, announce, voiceEnabled, activity, sessionStart, toolCount, clearActivity, stopSession, stopRequested, react, emotionDebug, emotionIntensity],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi(): AiValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside AiProvider");
  return ctx;
}