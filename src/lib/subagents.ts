/**
 * QynOne Subagent System — the specialist team behind autonomous engine
 * builds (Roblox Studio, Unreal Engine, …).
 * ------------------------------------------------------------------
 * The main agent (Nex) is the orchestrator: it decides which specialists a
 * task actually needs, spawns them with *only* the context that matters, and
 * evaluates their structured results instead of trusting them blindly.
 *
 * Subagents run their own short, focused model conversation and act through
 * the MCP engine tools ONLY (no QynOne tools — this system exists purely to
 * drive real engines). They report a structured result
 * {status, summary, findings, problems, recommendations, filesAffected,
 *  testsRequired, confidence, qualityScore} that the orchestrator reads.
 *
 * Pure module: no React, no I/O — every function is a plain transformation,
 * so the parsing/limits logic is unit-testable.
 */

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export type SubAgentRole =
  | "designer"
  | "architect"
  | "builder"
  | "qa"
  | "debugger"
  | "polisher"
  | "researcher";

export interface SubAgentRoleDef {
  role: SubAgentRole;
  /** short label, e.g. "Designer" */
  label: string;
  /** full title, e.g. "Game Designer" */
  title: string;
  emoji: string;
  /** tailwind chip-dot class for the activity UI */
  dot: string;
  /** what the role is responsible for (shown to the orchestrator) */
  responsibility: string;
  /** when this role should be spawned (orchestrator guidance) */
  when: string;
  /** system prompt the subagent itself runs under */
  prompt: string;
  /** how many engine-tool steps the subagent may take before it must report */
  defaultSteps: number;
  temperature: number;
  /** designers/architects/QA/researchers inspect; builders/debuggers/polishers change */
  readOnly: boolean;
}

export const SUBAGENT_ROLES: Record<SubAgentRole, SubAgentRoleDef> = {
  designer: {
    role: "designer",
    label: "Designer",
    title: "Game Designer",
    emoji: "🎯",
    dot: "bg-sky-400",
    responsibility: "Game concept, gameplay loop, mechanics, progression, player experience, feature priorities.",
    when: "Before building a whole game or a new major mode — turn the user's goal into a concrete, testable design brief.",
    prompt:
      "You are the Game Designer on a small game-dev team. You turn a goal into a design someone can build from without guessing: the core loop, the moment-to-moment feel, mechanics, progression, controls, art direction, scope and — most importantly — what 'good' means for this game and who it is for.\n\nYou work inside the engine through its MCP tools: read the current project (scripts, places, levels) so your design fits what actually exists, and write design notes into the project where the engine lets you. Do NOT implement gameplay. Your deliverable is the brief itself.\n\nQuality bar: a brief that is concrete and testable (not vague or feature-list-flavoured). If it can't be tested, it isn't designed yet.",
    defaultSteps: 12,
    temperature: 0.8,
    readOnly: true,
  },
  architect: {
    role: "architect",
    label: "Architect",
    title: "Architect",
    emoji: "🏗️",
    dot: "bg-violet-400",
    responsibility: "Technical architecture, module/system structure, data flow, dependencies, implementation strategy mapped to the engine.",
    when: "After the design exists and before implementation — especially for systems-heavy games. Skip for tiny single-script fixes.",
    prompt:
      "You are the Architect on a small game-dev team. You turn an approved design into a technical plan the Builder can execute without inventing structure on the fly: what scripts/modules/instances/actors exist, where they live, what depends on what, how data flows, and which engine tools create each piece.\n\nYou work inside the engine through its MCP tools: read the existing project structure first so the plan extends it instead of fighting it. Do NOT implement — the plan is your deliverable. Flag any design question that would change the result instead of papering over it.\n\nQuality bar: the plan names the real scripts/instances/assets and the engine tools that create them, and there are no open design questions left that would change the build.",
    defaultSteps: 14,
    temperature: 0.5,
    readOnly: true,
  },
  builder: {
    role: "builder",
    label: "Builder",
    title: "Builder",
    emoji: "🔧",
    dot: "bg-emerald-400",
    responsibility: "Writing/modifying engine scripts and content with MCP tools, implementing the approved design, small verifiable steps.",
    when: "The workhorse of implementation phases — world, gameplay, systems, NPCs, and after a Debugger fixes, applying repairs.",
    prompt:
      "You are the Builder on a small game-dev team. You implement approved work inside the engine through its MCP tools — scripts, instances, actors, assets, configuration. Read before you write, keep changes small and verifiable, and test what you touch.\n\nRules: never invent file/instance paths — read them first. Prefer the engine's bulk tools for large edits. If something is missing or blocks you, stop and report it in problems — do not silently build a different thing. When the engine can run/test what you made, run it and read the result before you claim success.\n\n'Generated' is not 'done': your structured result must say what you actually verified through the engine, and problems must list everything you know is still wrong.",
    defaultSteps: 40,
    temperature: 0.35,
    readOnly: false,
  },
  qa: {
    role: "qa",
    label: "QA Agent",
    title: "Quality Reviewer",
    emoji: "🧪",
    dot: "bg-amber-400",
    responsibility: "Adversarial testing: breaking systems on purpose, runtime checks, edge cases, verifying claimed functionality really exists.",
    when: "After any Builder phase, before gates, and after every fix. NEVER skip QA for work that looks correct.",
    prompt:
      "You are the QA agent on a small game-dev team. Assume the implementation may be wrong and find evidence that proves whether it works.\n\nYou are deliberately skeptical: a Builder saying 'finished' is NOT evidence. Actual engine execution, console output, screen captures and broken-state tests are evidence. Your job is to break what you can — run the game, execute edge cases (death, reset, empty state, rapid input, missing references), read every error, and check that systems which work alone still work together.\n\nWork inside the engine through its MCP tools. Hunt for: runtime errors, broken references, missing functionality, inconsistent state, edge cases, regressions, duplicated systems, weak gameplay feel, performance problems, visual inconsistencies, bad UX.\n\nThen report the truth, hard: criticalIssues-style problems must be listed first in problems. Never soften a real bug because the code looks correct. If you could not actually test something, say so in testsRequired — guessing is not testing.",
    defaultSteps: 22,
    temperature: 0.2,
    readOnly: true,
  },
  debugger: {
    role: "debugger",
    label: "Debugger",
    title: "Debugger",
    emoji: "🐛",
    dot: "bg-rose-400",
    responsibility: "Analyzing failures, finding root causes, fixing bugs, regression-testing the repair.",
    when: "When QA or a gate rejection reports concrete failures — analyze the root cause before touching anything.",
    prompt:
      "You are the Debugger on a small game-dev team. Given concrete failures, find the ROOT CAUSE before you change anything: reproduce or observe the failure through the engine, trace it to the actual faulty code/reference/state, then apply the smallest repair that fixes the cause (not the symptom).\n\nWork inside the engine through its MCP tools. Read the failing code and its callers first. After a repair, re-run the failing case through the engine to confirm it is actually gone, and check for regressions in what the change touched.\n\nIf you cannot reproduce or identify the root cause, report blocked with exactly what you know and what you tried — never guess-fix.",
    defaultSteps: 16,
    temperature: 0.3,
    readOnly: false,
  },
  polisher: {
    role: "polisher",
    label: "Polish Agent",
    title: "Polish Agent",
    emoji: "🎨",
    dot: "bg-fuchsia-400",
    responsibility: "UX, game feel, UI, visual consistency, audio/feedback, performance, overall polish pass.",
    when: "After the systems work and QA is quiet — the decisive pass that makes a game feel deliberate instead of functional.",
    prompt:
      "You are the Polish agent on a small game-dev team. Your job is the difference between 'it works' and 'it feels like a real game': game feel (timing, feedback, camera, juice), UI quality and consistency, deliberate art direction and lighting, audio, performance, and the first-five-minutes experience.\n\nWork inside the engine through its MCP tools. Look at the real result — run it, capture the screen, read the console — and fix what looks generic, placeholder, janky or inconsistent. Respect the existing art direction instead of replacing it. Every change stays small and verified.",
    defaultSteps: 18,
    temperature: 0.5,
    readOnly: false,
  },
  researcher: {
    role: "researcher",
    label: "Researcher",
    title: "Researcher",
    emoji: "🔬",
    dot: "bg-cyan-400",
    responsibility: "Investigating unfamiliar engine APIs/toolsets and finding better implementation approaches.",
    when: "Only when genuinely needed — an unfamiliar API, a toolset you've never used, or a better approach for a hard problem. Never spawn one for routine work.",
    prompt:
      "You are the Researcher on a small game-dev team. Investigate the engine's actual capabilities through its MCP tools: list toolsets, describe tools, inspect instances, read documentation the engine exposes. Find the correct API/approach for the task and report concrete answers with the exact tool calls and paths someone else can use.\n\nYou do NOT implement features. Your deliverable is verified knowledge: what works, exact names/paths/signatures, and any gotchas you observed.",
    defaultSteps: 12,
    temperature: 0.3,
    readOnly: true,
  },
};

/** Deterministic role list in team order (orchestrator guidance + UI). */
export const SUBAGENT_ROLE_ORDER: SubAgentRole[] = [
  "designer",
  "architect",
  "builder",
  "qa",
  "debugger",
  "polisher",
  "researcher",
];

export function roleDef(role: string): SubAgentRoleDef | null {
  return SUBAGENT_ROLES[role as SubAgentRole] ?? null;
}

/* ------------------------------------------------------------------ */
/* Limits & budgets                                                    */
/* ------------------------------------------------------------------ */

export const SUBAGENT_LIMITS = {
  /** subagents actually working at the same time (parallel spawns beyond this queue) */
  maxConcurrent: 3,
  /** spawns per chat session before the orchestrator must consolidate — prevents uncontrolled spawning */
  maxPerSession: 14,
  /** per-model-call timeout inside a subagent */
  stepMs: 180_000,
  /** hard wall-clock cap per subagent */
  maxMs: 9 * 60_000,
  /** subagents can never spawn subagents (their toolset is MCP-only), so recursion is structurally impossible */
  maxDepth: 1,
} as const;

/* ------------------------------------------------------------------ */
/* Spec / result / run state                                           */
/* ------------------------------------------------------------------ */

/** Everything the orchestrator hands a subagent — only what that role needs. */
export interface SubAgentSpec {
  role: SubAgentRole;
  /** what this subagent must accomplish (one focused task) */
  task: string;
  project?: string;
  /** engine to restrict to (e.g. "Roblox Studio") — empty = any connected engine */
  engine?: string;
  /** pipeline phase or context name, e.g. "Gameplay & Core Loop" */
  phase?: string;
  /** the relevant files/scripts/systems — never the whole project */
  files?: string;
  /** hard constraints the subagent must respect */
  constraints?: string;
  /** what a good result looks like */
  expectedResult?: string;
  /** quality requirements the subagent should self-check against */
  quality?: string;
  /** optional step-budget override (clamped to role max) */
  maxSteps?: number;
}

/** Structured output every subagent must return. */
export interface SubAgentResult {
  /** success | failure | blocked */
  status: "success" | "failure" | "blocked";
  /** 1-3 sentence recap of what the subagent did and found */
  summary: string;
  /** concrete things it verified through the engine */
  findings: string[];
  /** concrete problems — criticals first for QA */
  problems: string[];
  recommendations: string[];
  /** files/scripts/instances/assets it created or touched */
  filesAffected: string[];
  /** tests still required before this can be trusted */
  testsRequired: string[];
  /** 0-100 how sure the subagent is of its own result */
  confidence: number;
  /** 0-100 its own quality score of the work it inspected/produced */
  qualityScore: number;
}

export function emptyResult(status: SubAgentResult["status"] = "blocked", reason = ""): SubAgentResult {
  return {
    status,
    summary: reason,
    findings: [],
    problems: [],
    recommendations: [],
    filesAffected: [],
    testsRequired: [],
    confidence: 0,
    qualityScore: 0,
  };
}

export type SubAgentRunStatus = "queued" | "running" | "done" | "aborted" | "failed";

export interface SubAgentRun {
  id: string;
  role: SubAgentRole;
  task: string;
  engine: string;
  status: SubAgentRunStatus;
  stepsUsed: number;
  stepsBudget: number;
  startedAt: number;
  finishedAt: number | null;
  result: SubAgentResult | null;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function clamp(n: number, lo: number, hi: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function cleanList(raw: unknown, cap = 8, itemCap = 240): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim().replace(/\s+/g, " ").slice(0, itemCap);
    if (!s || out.includes(s)) continue;
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/** Clamp an optional step budget into the role's legal range. */
export function budgetFor(spec: SubAgentSpec): number {
  const def = SUBAGENT_ROLES[spec.role];
  const max = Math.max(6, def.defaultSteps + 10);
  if (typeof spec.maxSteps === "number" && Number.isFinite(spec.maxSteps)) {
    return clamp(spec.maxSteps, 2, max);
  }
  return def.defaultSteps;
}

/* ------------------------------------------------------------------ */
/* Structured-result parsing — tolerant, never throws                  */
/* ------------------------------------------------------------------ */

function extractJsonObject(raw: string): unknown {
  const text = raw.trim();
  /* bare JSON object */
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      // fall through to fence/scan below
    }
  }
  /* fenced json blocks */
  const fences = text.match(/```(?:json)?\s*([\s\S]*?)```/gi);
  if (fences) {
    for (let i = fences.length - 1; i >= 0; i--) {
      const body = fences[i].replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        // try the next fence
      }
    }
  }
  /* last balanced {…} block on the page (models often narrate first) */
  let start = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "}") {
      let depth = 0;
      for (let j = i; j >= 0; j--) {
        if (text[j] === "}") depth += 1;
        else if (text[j] === "{") {
          depth -= 1;
          if (depth === 0) {
            start = j;
            break;
          }
        }
      }
      if (start >= 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
  return null;
}

/**
 * Parse whatever the subagent model replied into a structured result.
 * Never throws; `ok:false` means the reply wasn't usable JSON and the caller
 * wraps the raw text instead (the orchestrator must not trust it).
 */
export function parseSubAgentResult(raw: string): { result: SubAgentResult; ok: boolean } {
  const obj = extractJsonObject(raw);
  if (!obj || typeof obj !== "object") {
    return { result: emptyResult("blocked", "No structured result returned."), ok: false };
  }
  const o = obj as Record<string, unknown>;
  const statusRaw = String(o.status ?? "").toLowerCase().trim();
  const status: SubAgentResult["status"] =
    statusRaw === "success" || statusRaw === "failure" ? statusRaw : statusRaw === "blocked" ? "blocked" : "blocked";
  const summary = String(o.summary ?? "").trim().replace(/\s+/g, " ").slice(0, 600) || "(no summary)";
  const problems = cleanList(o.problems ?? (o.criticalIssues ?? o.majorIssues));
  const result: SubAgentResult = {
    status,
    summary,
    findings: cleanList(o.findings),
    problems,
    recommendations: cleanList(o.recommendations),
    filesAffected: cleanList(o.filesAffected, 12),
    testsRequired: cleanList(o.testsRequired),
    confidence: clamp(Number(o.confidence), 0, 100),
    qualityScore: clamp(Number(o.qualityScore ?? o.quality), 0, 100),
  };
  /* "failure" without any problem listed is suspicious — keep it visible. */
  if (status === "failure" && problems.length === 0) {
    result.problems = ["Reported failure without listing concrete problems."];
  }
  return { result, ok: true };
}

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

const CONTEXT_LINE = "Context given by the orchestrator — work ONLY inside this scope";

/**
 * The task message handed to a subagent: focused context (never the whole
 * project) + hard rules + the required structured output schema.
 */
export function buildSubAgentBrief(spec: SubAgentSpec): string {
  const def = SUBAGENT_ROLES[spec.role];
  const engineNote = spec.engine
    ? `Your engine connection is ${spec.engine}. If only a different engine is connected, say so in problems instead of touching it.`
    : "Use whatever engine connection the task needs (restricted to the connected engine the orchestrator named).";
  const lines: string[] = [
    `${def.emoji} You are working as the ${def.title} subagent.`,
    "",
    `__${CONTEXT_LINE}__`,
    spec.project ? `- Project: ${String(spec.project).slice(0, 200)}` : "",
    spec.engine ? `- Engine: ${String(spec.engine).slice(0, 120)}` : "",
    spec.phase ? `- Phase/context: ${String(spec.phase).slice(0, 160)}` : "",
    spec.files ? `- Relevant files/systems: ${String(spec.files).slice(0, 600)}` : "",
    spec.constraints ? `- Constraints: ${String(spec.constraints).slice(0, 600)}` : "",
    spec.expectedResult ? `- Expected result: ${String(spec.expectedResult).slice(0, 600)}` : "",
    spec.quality ? `- Quality requirements: ${String(spec.quality).slice(0, 600)}` : "",
    `- Your step budget: ${budgetFor(spec)} engine-tool steps. Work efficiently — batch independent reads into one step.`,
    "",
    engineNote,
    "",
    `__YOUR TASK__`,
    String(spec.task).trim().slice(0, 1800) || "(no task given)",
    "",
    `__WORKING RULES__`,
    `- Act only through the engine (MCP) tools provided — you have no other tools and must never pretend otherwise.${def.readOnly ? " You inspect and report; you do NOT change project content." : ""}`,
    `- Read before you write; never invent paths, instances or APIs. If a tool result errors, read it and react to it — do not paper over it.`,
    `- 'Generated' is never 'verified'. Only claim something works after you saw it work (execution, console, capture, test through the engine).`,
    `- Stay in scope. You are one specialist on a team; the lead agent orchestrates. Do not redesign the project, do not start unrelated work, do not over-run your budget — if you are blocked, report blocked with exactly what you know.`,
    "",
    `__REPORT__`,
    `When your task is finished — or you are blocked, or you hit your budget — reply with ONLY a JSON object (no prose outside it), exactly like:`,
    "",
    `{"status":"success|failure|blocked","summary":"1-3 sentences: what you did and found","findings":["verified evidence, e.g. ran the game and the round starts cleanly"],"problems":["critical first: concrete bugs, missing pieces, broken references"],"recommendations":["what the lead agent should do next"],"filesAffected":["scripts/instances/assets you created or touched"],"testsRequired":["tests still needed before this is trustworthy"],"confidence":85,"qualityScore":70}`,
    "",
    `Rules for the JSON: status is success only when your task genuinely completed and you verified it; failure when you found real problems; blocked when you could not finish (budget, engine unreachable, unknown API). List concrete problems in problems (critical first for QA). confidence and qualityScore are honest 0-100 numbers — score 100 only when you would stake your name on it.`,
  ];
  return lines.filter((l, i) => !(l === "" && (lines[i - 1] === undefined || lines[i - 1] === ""))).join("\n");
}

/* ------------------------------------------------------------------ */
/* Presentation                                                        */
/* ------------------------------------------------------------------ */

function listLines(label: string, items: string[]): string {
  return items.length > 0 ? `${label}: ${items.join(" | ")}` : "";
}

/** Compact readable rendering of a structured result (feeds the lead agent). */
export function resultToText(roleTitle: string, result: SubAgentResult, run?: Pick<SubAgentRun, "status" | "stepsUsed" | "error">): string {
  const head: string[] = [];
  if (run) {
    head.push(`[${roleTitle} subagent finished: ${run.status}${run.status === "done" ? "" : ` — ${run.error ?? ""}`}]`);
  } else {
    head.push(`[${roleTitle} subagent result]`);
  }
  head.push(`status=${result.status} · confidence=${result.confidence}% · qualityScore=${result.qualityScore}/100`);
  head.push(`Summary: ${result.summary}`);
  const lines = [
    ...head,
    listLines("Findings (verified)", result.findings),
    listLines("Problems", result.problems),
    listLines("Recommendations", result.recommendations),
    listLines("Files affected", result.filesAffected),
    listLines("Tests still required", result.testsRequired),
  ].filter(Boolean);
  return lines.join("\n");
}

/** One-line-per-subagent block for the live build-state digest. */
export function subagentDigest(runs: SubAgentRun[]): string {
  if (runs.length === 0) return "";
  const active = runs.filter((r) => r.status === "queued" || r.status === "running");
  const done = runs.filter((r) => r.status !== "queued" && r.status !== "running");
  const lines = ["Subagents this session:"];
  for (const r of runs.slice(-6)) {
    const def = SUBAGENT_ROLES[r.role];
    if (r.status === "running" || r.status === "queued") {
      lines.push(`- ${def.emoji} ${def.title}: RUNNING (${r.stepsUsed}/${r.stepsBudget} steps) — ${r.task.slice(0, 140)}`);
    } else {
      const s = r.result?.status ?? r.status;
      const q = r.result ? ` · quality ${r.result.qualityScore}/100 · conf ${r.result.confidence}%` : "";
      lines.push(`- ${def.emoji} ${def.title}: ${s}${q} — ${(r.result?.summary ?? r.task).slice(0, 140)}`);
    }
  }
  const budget = SUBAGENT_LIMITS.maxPerSession;
  lines.push(`Autonomy: ${done.length + active.length}/${budget} subagent spawns used this session — only spawn more when they earn their place, and never spawn duplicates of finished work.`);
  return lines.join("\n");
}
