/**
 * QynOne Game Development Orchestrator (GDA)
 * ------------------------------------------------------------------
 * The staged, deterministic development pipeline behind autonomous engine
 * builds (Roblox Studio, Unreal Engine, …). The AI drives the pipeline
 * through tools (gda-start / gda-review / gda-issue / gda-status /
 * gda-finish), but the orchestrator owns the phase transitions: a phase is
 * only complete when the Quality Reviewer's structured report passes the
 * phase's gate — never because the builder claims it is done.
 *
 * Pure module: no React, no I/O, no timers — every function is a plain
 * transformation of the serializable GdaState, so the gate logic is
 * unit-testable and the whole pipeline survives a session resume.
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type GdaScope = "full" | "quick";

export type GdaPhaseId =
  | "design"
  | "architecture"
  | "world"
  | "gameplay"
  | "systems"
  | "npc"
  | "integration"
  | "playtest"
  | "polish"
  | "build"
  | "final"
  | "done";

export type GdaRole = "designer" | "architect" | "builder" | "qa";

/** Configurable gate thresholds — one set per phase, defaults below. */
export interface QualityGate {
  /** overall quality 0-100 */
  overall: number;
  /** technical / architecture quality 0-100 */
  technical: number;
  /** functionality completeness 0-100 */
  functionality: number;
  /** test confidence — how much of the work was actually verified 0-100 */
  testing: number;
  /** performance 0-100 */
  performance: number;
}

export const DEFAULT_GATE: QualityGate = {
  overall: 90,
  technical: 90,
  functionality: 95,
  testing: 90,
  performance: 85,
};

/** How many REJECTs a phase may take before the orchestrator marks it
    blocked and carries its open issues forward. The final gate still
    cannot pass while blockers are unresolved — this is the honesty
    backstop, never a free pass. */
export const MAX_PHASE_RETRIES = 3;

/** A phase definition. `gate: null` marks a terminal phase (done). */
export interface PhaseDef {
  id: GdaPhaseId;
  label: string;
  role: GdaRole;
  /** what this phase must produce */
  goal: string;
  /** how the phase must be verified against the real project */
  verify: string;
  /** thresholds the QA report must clear to leave this phase */
  gate: QualityGate | null;
}

export interface GdaPipeline {
  id: GdaScope;
  label: string;
  phases: PhaseDef[];
}

/** The Quality Reviewer's structured report (submitted via gda-review). */
export interface QualityReport {
  overall: number;
  technical: number;
  functionality: number;
  testing: number;
  performance: number;
  /** exactly what was inspected and verified through the engine */
  evidence: string;
  criticalIssues: string[];
  majorIssues: string[];
  minorIssues: string[];
  improvements: string[];
  testsRequired: string[];
  reason: string;
}

export interface GateVerdict {
  pass: boolean;
  /** critical issues present → gate fails no matter the scores */
  autoFailed: boolean;
  scores: Record<keyof QualityGate, number>;
  threshold: QualityGate;
  /** human lines like "functionality 82 < 95" */
  failures: string[];
  reason: string;
}

export interface ReportRecord {
  phase: GdaPhaseId;
  phaseLabel: string;
  ts: number;
  report: QualityReport;
  verdict: GateVerdict;
}

export type GdaHistoryKind = "start" | "gate-pass" | "gate-reject" | "blocked" | "issue" | "test" | "finish";

export interface GdaHistoryEntry {
  ts: number;
  kind: GdaHistoryKind;
  phase: GdaPhaseId | null;
  text: string;
}

/** The whole orchestrator state — plain data, safe to keep in a ref. */
export interface GdaState {
  active: boolean;
  finished: boolean;
  project: string;
  engine: string;
  scope: GdaScope;
  pipeline: GdaPipeline;
  /** index into pipeline.phases — the phase currently being worked */
  phaseIndex: number;
  objective: string;
  startedAt: number;
  updatedAt: number;
  completed: GdaPhaseId[];
  failed: GdaPhaseId[];
  /** phases whose retry budget was exhausted (issues carried forward) */
  blocked: GdaPhaseId[];
  retries: Partial<Record<GdaPhaseId, number>>;
  reports: ReportRecord[];
  /** open critical/major issues — replaced on each review, cleared on pass */
  blockers: string[];
  /** verification notes and evidence recorded during the run */
  tests: string[];
  history: GdaHistoryEntry[];
  summary: string;
  /** effective thresholds (defaults merged with any gda-start override) */
  gates: QualityGate;
}

export interface GdaStartInput {
  objective: string;
  engine: string;
  project?: string;
  scope?: GdaScope;
  gates?: Partial<QualityGate>;
}

export interface ReviewOutcome {
  ok: boolean;
  message: string;
  state: GdaState;
  verdict: GateVerdict | null;
  /** the phase the pipeline moved to (null when rejected/stuck) */
  advancedTo: PhaseDef | null;
}

/* ------------------------------------------------------------------ */
/* Pipelines — the exact stages are configurable data, because         */
/* different games need different pipelines.                           */
/* ------------------------------------------------------------------ */

function phase(
  id: GdaPhaseId,
  label: string,
  role: GdaRole,
  goal: string,
  verify: string,
  gate: QualityGate | null = DEFAULT_GATE,
): PhaseDef {
  return { id, label, role, goal, verify, gate };
}

/** Full pipeline for project-scale games — mirrors the canonical flow. */
const FULL_PHASES: PhaseDef[] = [
  phase(
    "design",
    "Game Design",
    "designer",
    "Game concept, core loop, mechanics, progression, player experience and feature priorities. Write the design brief the whole build follows.",
    "The brief is concrete and testable: genre, core loop, win/lose conditions, controls, art direction, scope and what 'good' means for this game.",
  ),
  phase(
    "architecture",
    "Architecture",
    "architect",
    "System architecture: folder/module structure, data flow, dependencies, services and a technical implementation plan mapped to the engine's actual tools.",
    "The plan names the real scripts, instances and assets it will create and the engine tools that create them. No open design questions that would change the result.",
  ),
  phase(
    "world",
    "Assets & World",
    "builder",
    "Build the world: level layout, lighting, atmosphere, environment, art direction, spawns. Make it look intentional — not default or empty.",
    "The scene exists in the engine; lighting/atmosphere are set deliberately; a screen capture was reviewed and matches the art direction.",
  ),
  phase(
    "gameplay",
    "Gameplay & Core Loop",
    "builder",
    "Implement the core loop: movement, camera, controls, primary mechanics and the first-fifteen-minutes feel.",
    "Playtested through the engine: input, camera and feedback feel right; console is clean; the loop is actually playable end to end.",
  ),
  phase(
    "systems",
    "Combat & Systems",
    "builder",
    "Combat, health, inventory, progression, economy — every system the design requires — with clean module structure and no duplicated logic.",
    "Systems tested via engine execution/playtest; edge cases covered (death, reset, empty state, rapid input).",
  ),
  phase(
    "npc",
    "AI & NPCs",
    "builder",
    "NPCs and AI: behavior, spawning, difficulty tuning, reactions to the player.",
    "AI behaves correctly under test; no runaway loops, broken references or dead code.",
  ),
  phase(
    "integration",
    "Integration",
    "builder",
    "Wire everything together: references resolve, menus and UI exist, audio and feedback are in, transitions between systems work, dead code removed.",
    "Full project references resolve; UI and audio present; no duplicate systems; a full run through the game works.",
  ),
  phase(
    "playtest",
    "Playtest & Deep QA",
    "qa",
    "Play the whole game critically as a fresh player: bugs, feel, balance, performance, visual consistency, missing features, weak UX.",
    "Real playtests run through the engine, screens captured, console read; findings recorded as a structured review with evidence.",
  ),
  phase(
    "polish",
    "Polish",
    "builder",
    "Fix everything QA found; polish feel, visuals, sound and UI; run a performance pass.",
    "Each open blocker from QA is addressed and re-tested; the game looks and feels deliberate.",
  ),
  phase(
    "final",
    "Final Verification",
    "qa",
    "Final gate: everything verified working, no critical issues, every dimension at the bar. Never pass this on intention — only on evidence.",
    "Final playtest plus screen and console evidence recorded; blockers are resolved.",
  ),
  phase("done", "Completed", "qa", "", "", null),
];

/** Compact pipeline for small features, fixes and one-off tasks. */
const QUICK_PHASES: PhaseDef[] = [
  phase(
    "design",
    "Game Design",
    "designer",
    "Design brief for the task: what it does, how it feels, what success looks like.",
    "The brief is concrete enough to build from without guessing.",
  ),
  phase(
    "architecture",
    "Architecture",
    "architect",
    "Minimal architecture: where the new code/assets live, what they depend on, what engine tools create them.",
    "The plan maps to real engine tools and existing project structure.",
  ),
  phase(
    "build",
    "Build & Implement",
    "builder",
    "Implement the task end to end with the engine's tools: scripts, instances, assets, configuration.",
    "Built, run and tested through the engine; console is clean; the result matches the brief.",
  ),
  phase(
    "playtest",
    "Playtest & QA",
    "qa",
    "Critically test what was built: does it work, does it feel right, does it break anything else?",
    "Real test run through the engine with evidence; findings recorded.",
  ),
  phase(
    "polish",
    "Polish",
    "builder",
    "Fix QA findings; polish feel, visuals and edge cases.",
    "Each finding addressed and re-tested.",
  ),
  phase(
    "final",
    "Final Verification",
    "qa",
    "Final gate: verified working, no critical issues, quality at the bar.",
    "Final test evidence recorded; blockers resolved.",
  ),
  phase("done", "Completed", "qa", "", "", null),
];

export function pipelineFor(scope: GdaScope): GdaPipeline {
  return scope === "quick"
    ? { id: "quick", label: "Quick pipeline", phases: QUICK_PHASES.map((p) => ({ ...p })) }
    : { id: "full", label: "Full pipeline", phases: FULL_PHASES.map((p) => ({ ...p })) };
}

/* ------------------------------------------------------------------ */
/* Gate evaluation — deterministic, testable.                          */
/* ------------------------------------------------------------------ */

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function evaluateGate(report: QualityReport, gate: QualityGate): GateVerdict {
  const scores: Record<keyof QualityGate, number> = {
    overall: clampScore(report.overall),
    technical: clampScore(report.technical),
    functionality: clampScore(report.functionality),
    testing: clampScore(report.testing),
    performance: clampScore(report.performance),
  };
  const criticals = (report.criticalIssues ?? []).map((s) => String(s).trim()).filter(Boolean);
  const autoFailed = criticals.length > 0;
  const failures: string[] = [];
  const dims: Array<[keyof QualityGate, string]> = [
    ["overall", "overall quality"],
    ["technical", "technical quality"],
    ["functionality", "functionality"],
    ["testing", "test confidence"],
    ["performance", "performance"],
  ];
  for (const [key, label] of dims) {
    if (scores[key] < gate[key]) failures.push(`${label} ${scores[key]} < ${gate[key]}`);
  }
  const pass = !autoFailed && failures.length === 0;
  const reason = autoFailed
    ? `Critical issues auto-fail the gate: ${criticals.slice(0, 3).join("; ")}`
    : failures.length > 0
      ? failures.join("; ")
      : "All dimensions at or above the required thresholds.";
  return { pass, autoFailed, scores, threshold: { ...gate }, failures, reason };
}

function dedupe(list: string[], cap = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const t = String(item).trim().slice(0, 220);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Orchestrator state machine                                          */
/* ------------------------------------------------------------------ */

export function gdaStart(input: GdaStartInput): GdaState {
  const scope: GdaScope = input.scope === "quick" ? "quick" : "full";
  const pipeline = pipelineFor(scope);
  const mergedGates: QualityGate = { ...DEFAULT_GATE, ...(input.gates ?? {}) };
  const phases = pipeline.phases.map((p) => (p.gate ? { ...p, gate: { ...p.gate, ...mergedGates } } : p));
  const now = Date.now();
  return {
    active: true,
    finished: false,
    project: (input.project ?? "").trim().slice(0, 80) || "Untitled project",
    engine: input.engine.trim().slice(0, 60) || "engine",
    scope,
    pipeline: { ...pipeline, phases },
    phaseIndex: 0,
    objective: input.objective.trim().slice(0, 600),
    startedAt: now,
    updatedAt: now,
    completed: [],
    failed: [],
    blocked: [],
    retries: {},
    reports: [],
    blockers: [],
    tests: [],
    history: [{ ts: now, kind: "start", phase: null, text: `Pipeline started (${scope}) — ${input.objective.trim().slice(0, 200)}` }],
    summary: "",
    gates: mergedGates,
  };
}

export function currentPhase(state: GdaState): PhaseDef | null {
  return state.pipeline.phases[state.phaseIndex] ?? null;
}

/** The effective gate for the current phase (override-aware). */
export function currentGate(state: GdaState): QualityGate {
  return currentPhase(state)?.gate ?? state.gates;
}

function gateLine(gate: QualityGate): string {
  return `Gate to pass: overall ≥${gate.overall}, technical ≥${gate.technical}, functionality ≥${gate.functionality}, testing ≥${gate.testing}, performance ≥${gate.performance} — enforced by the orchestrator; critical issues auto-fail.`;
}

/** What the model must do right now — the digest's core block. */
export function phaseDirective(state: GdaState): string {
  const phaseDef = currentPhase(state);
  if (!phaseDef) return "The pipeline is empty.";
  const total = state.pipeline.phases.length;
  if (phaseDef.id === "done") {
    return `All ${state.completed.length} phase${state.completed.length === 1 ? "" : "s"} passed. Call gda-finish with your final summary: what you built, how you verified it through the engine, and what you'd improve next.`;
  }
  const gate = phaseDef.gate ?? state.gates;
  return [
    `Current phase (${state.phaseIndex + 1}/${total}): ${phaseDef.label} — ${phaseDef.role}`,
    `Goal: ${phaseDef.goal}`,
    `Verify: ${phaseDef.verify}`,
    gateLine(gate),
    "Do the phase work with the engine tools, verify it against real results, then call gda-review.",
  ].join("\n");
}

/** Compact always-current block for the live build-state digest. */
export function gdaDigest(state: GdaState): string {
  const phaseDef = currentPhase(state);
  const total = state.pipeline.phases.length;
  const passed = state.reports.filter((r) => r.verdict.pass);
  const scores = passed.length > 0 ? passed.map((r) => `${r.phaseLabel} ${r.verdict.scores.overall}/100`).join(", ") : "none yet";
  const retryLines = Object.entries(state.retries)
    .map(([id, n]) => `${state.pipeline.phases.find((p) => p.id === id)?.label ?? id} ×${n}`)
    .join(", ");
  const blockedLines = state.blocked
    .map((b) => state.pipeline.phases.find((p) => p.id === b)?.label ?? b)
    .join(", ");
  return [
    "__QYN_GDA__ — staged game-dev pipeline (orchestrator state, always current)",
    `Project: ${state.project} · Engine: ${state.engine} · Scope: ${state.scope}`,
    phaseDef && phaseDef.id !== "done"
      ? `Current phase ${state.phaseIndex + 1}/${total}: ${phaseDef.label} (${phaseDef.role}) — finish this phase and pass its gate before moving on`
      : `Pipeline complete (${state.completed.length} phase${state.completed.length === 1 ? "" : "s"} passed) — call gda-finish`,
    `Gates passed: ${scores}`,
    retryLines ? `Rejected/retries: ${retryLines}` : "Rejected/retries: none",
    blockedLines ? `Blocked phases: ${blockedLines}` : "Blocked phases: none",
    state.blockers.length > 0
      ? `Open blockers (must be resolved before the final gate): ${state.blockers.join("; ")}`
      : "Open blockers: none",
  ].filter(Boolean).join("\n");
}

/** Human status dump for gda-status. */
export function gdaStatusText(state: GdaState): string {
  const phaseDef = currentPhase(state);
  const total = state.pipeline.phases.length;
  const passed = state.reports.filter((r) => r.verdict.pass);
  const lines = [
    `Staged pipeline (${state.scope}) — project "${state.project}" in ${state.engine}`,
    state.finished
      ? "Status: COMPLETED."
      : phaseDef && phaseDef.id !== "done"
        ? `Status: working — phase ${state.phaseIndex + 1}/${total} (${phaseDef.label}, ${phaseDef.role}).`
        : "Status: all phases passed — call gda-finish.",
    `Objective: ${state.objective}`,
    `Gates passed: ${passed.length > 0 ? passed.map((r) => `${r.phaseLabel} ${r.verdict.scores.overall}/100`).join(", ") : "none"}`,
    `Retries: ${Object.entries(state.retries).map(([id, n]) => `${id} ×${n}`).join(", ") || "none"}`,
    state.blocked.length > 0 ? `Blocked phases: ${state.blocked.join(", ")}` : "Blocked phases: none",
    state.blockers.length > 0 ? `Open blockers: ${state.blockers.join("; ")}` : "Open blockers: none",
    state.tests.length > 0 ? `Verification notes: ${state.tests.slice(-5).join(" | ")}` : "Verification notes: none yet",
  ];
  if (phaseDef && phaseDef.id !== "done") lines.push(phaseDirective(state));
  return lines.join("\n");
}

/**
 * Submit the QA report for the current phase. The orchestrator decides:
 * PASS advances the pipeline; REJECT returns the agent to the same phase
 * (with a retry counted); MAX_PHASE_RETRIES exhausted marks the phase
 * blocked and advances with the issues carried forward — the final gate
 * will not pass while blockers remain.
 */
export function gdaSubmitReview(state: GdaState, report: QualityReport): ReviewOutcome {
  if (!state.active || state.finished) {
    return { ok: false, message: "No active pipeline — call gda-start first.", state, verdict: null, advancedTo: null };
  }
  const phaseDef = currentPhase(state);
  if (!phaseDef) return { ok: false, message: "The pipeline has no current phase.", state, verdict: null, advancedTo: null };
  if (phaseDef.id === "done") {
    return { ok: false, message: "All phases are already passed — call gda-finish to close the pipeline.", state, verdict: null, advancedTo: null };
  }
  const gate = phaseDef.gate ?? state.gates;
  const criticals = dedupe((report.criticalIssues ?? []).map(String));
  const verdict = evaluateGate(report, gate);
  const now = Date.now();

  if (verdict.pass) {
    const completed = [...state.completed, phaseDef.id];
    const reports = [...state.reports, { phase: phaseDef.id, phaseLabel: phaseDef.label, ts: now, report, verdict }];
    const tests = report.evidence.trim()
      ? [...state.tests, `[${phaseDef.label}] ${report.evidence.trim().slice(0, 300)}`].slice(-12)
      : state.tests;
    const history: GdaHistoryEntry[] = [
      ...state.history,
      {
        ts: now,
        kind: "gate-pass",
        phase: phaseDef.id,
        text: `Gate PASS — ${phaseDef.label}: overall ${verdict.scores.overall}, technical ${verdict.scores.technical}, functionality ${verdict.scores.functionality}, testing ${verdict.scores.testing}, performance ${verdict.scores.performance}.`,
      },
    ];
    const nextIndex = state.phaseIndex + 1;
    const next = state.pipeline.phases[nextIndex];
    const base: GdaState = {
      ...state,
      phaseIndex: nextIndex,
      completed,
      reports,
      tests,
      blockers: [],
      history,
      updatedAt: now,
    };
    if (!next || next.id === "done") {
      return {
        ok: true,
        message: `Gate PASS — ${phaseDef.label} (${verdict.scores.overall}/100). All phases passed — call gda-finish with your final verified summary.`,
        state: base,
        verdict,
        advancedTo: next ?? null,
      };
    }
    return {
      ok: true,
      message: `Gate PASS — ${phaseDef.label} (${verdict.scores.overall}/100). Next phase (${nextIndex + 1}/${state.pipeline.phases.length}): ${next.label} (${next.role}). ${next.goal}`,
      state: base,
      verdict,
      advancedTo: next,
    };
  }

  /* REJECT — return to the responsible phase and improve it. */
  const retries = { ...state.retries, [phaseDef.id]: (state.retries[phaseDef.id] ?? 0) + 1 };
  const attempt = retries[phaseDef.id] ?? 0;
  const failed = state.failed.includes(phaseDef.id) ? state.failed : [...state.failed, phaseDef.id];
  const blockers = dedupe(criticals.length > 0 ? criticals : (report.majorIssues ?? []).map(String));
  const reports = [...state.reports, { phase: phaseDef.id, phaseLabel: phaseDef.label, ts: now, report, verdict }];
  const history: GdaHistoryEntry[] = [
    ...state.history,
    { ts: now, kind: "gate-reject", phase: phaseDef.id, text: `Gate REJECT — ${phaseDef.label} (attempt ${attempt}): ${verdict.reason}.` },
  ];

  if (attempt >= MAX_PHASE_RETRIES) {
    const blocked = state.blocked.includes(phaseDef.id) ? state.blocked : [...state.blocked, phaseDef.id];
    const nextIndex = state.phaseIndex + 1;
    const next = state.pipeline.phases[nextIndex];
    const history2: GdaHistoryEntry[] = [
      ...history,
      { ts: now, kind: "blocked", phase: phaseDef.id, text: `${phaseDef.label} rejected ${attempt}× (max ${MAX_PHASE_RETRIES}) — marked blocked; open issues carried forward.` },
    ];
    if (!next) {
      return {
        ok: false,
        message: `${phaseDef.label} rejected ${attempt}× (max ${MAX_PHASE_RETRIES}) and there is no next phase — the pipeline is stuck. Tell the user honestly what remains unresolved.`,
        state: { ...state, retries, failed, blocked, blockers, reports, history: history2, updatedAt: now },
        verdict,
        advancedTo: null,
      };
    }
    return {
      ok: true,
      message: `${phaseDef.label} rejected ${attempt}× (max ${MAX_PHASE_RETRIES}) — marked blocked. Move on to ${next.label}, but keep the open blockers in mind: the final gate cannot pass while they are unresolved.`,
      state: { ...state, phaseIndex: nextIndex, retries, failed, blocked, blockers, reports, history: history2, updatedAt: now },
      verdict,
      advancedTo: next,
    };
  }
  return {
    ok: true,
    message: `Gate REJECT — ${phaseDef.label}: ${verdict.reason}. Return to this phase and improve: ${blockers.length > 0 ? `resolve ${blockers.join("; ")}` : "fix the failed dimensions"}, test again through the engine, then re-submit gda-review.`,
    state: { ...state, retries, failed, blockers, reports, history, updatedAt: now },
    verdict,
    advancedTo: null,
  };
}

/** Record a blocker/issue outside a review (gda-issue). */
export function gdaRecordBlocker(state: GdaState, issue: string): GdaState {
  const t = issue.trim().slice(0, 220);
  if (!t || !state.active) return state;
  return {
    ...state,
    blockers: dedupe([...state.blockers, t]),
    history: [...state.history, { ts: Date.now(), kind: "issue", phase: currentPhase(state)?.id ?? null, text: `Blocker recorded: ${t.slice(0, 160)}` }],
    updatedAt: Date.now(),
  };
}

/** Record a verification/test note (evidence of real testing). */
export function gdaRecordTest(state: GdaState, note: string): GdaState {
  const t = note.trim().slice(0, 300);
  if (!t || !state.active) return state;
  return {
    ...state,
    tests: [...state.tests, t].slice(-12),
    history: [...state.history, { ts: Date.now(), kind: "test", phase: currentPhase(state)?.id ?? null, text: `Verification: ${t.slice(0, 180)}` }],
    updatedAt: Date.now(),
  };
}

/** Close a fully-passed pipeline with the final summary. */
export function gdaFinish(state: GdaState, summary: string): { ok: boolean; message: string; state: GdaState } {
  const phaseDef = currentPhase(state);
  if (!state.active || state.finished) {
    return { ok: false, message: "No active pipeline to finish — call gda-start first.", state };
  }
  if (!phaseDef || phaseDef.id !== "done") {
    return {
      ok: false,
      message: `The pipeline is at "${phaseDef?.label ?? "?"}" — it is not complete yet. Pass the final gate before calling gda-finish; you never claim 'done' on intention, only on verified results.`,
      state,
    };
  }
  const s = summary.trim().slice(0, 2000);
  return {
    ok: true,
    message: `Pipeline COMPLETED — ${state.completed.length} phase${state.completed.length === 1 ? "" : "s"} passed with verified gates${s ? `.\n\nFinal summary:\n${s}` : "."}`,
    state: {
      ...state,
      finished: true,
      summary: s,
      history: [...state.history, { ts: Date.now(), kind: "finish", phase: "done", text: "Pipeline finished — final summary recorded." }],
      updatedAt: Date.now(),
    },
  };
}