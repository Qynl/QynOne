import { describe, expect, test } from "bun:test";
import {
  DEFAULT_GATE,
  MAX_PHASE_RETRIES,
  currentPhase,
  evaluateGate,
  gdaDigest,
  gdaFinish,
  gdaRecordBlocker,
  gdaStart,
  gdaStatusText,
  gdaSubmitReview,
  pipelineFor,
} from "./gamedev";
import type { GdaState, QualityReport } from "./gamedev";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function started(overrides: Partial<Parameters<typeof gdaStart>[0]> = {}): GdaState {
  return gdaStart({
    objective: "Build a tactical shooter",
    engine: "Roblox Studio",
    scope: "full",
    ...overrides,
  });
}

function report(overrides: Partial<QualityReport> = {}): QualityReport {
  return {
    overall: 94,
    technical: 93,
    functionality: 97,
    testing: 95,
    performance: 91,
    evidence: "Read game.ServerScriptService.RoundManager, ran 3 playtests, console clean.",
    criticalIssues: [],
    majorIssues: [],
    minorIssues: [],
    improvements: [],
    testsRequired: [],
    reason: "Solid phase.",
    ...overrides,
  };
}

const passing = report();
const belowBar = report({ overall: 82, functionality: 88, majorIssues: ["Respawn feels unresponsive"] });

/* ------------------------------------------------------------------ */
/* Gate evaluation                                                     */
/* ------------------------------------------------------------------ */

describe("evaluateGate", () => {
  test("passes when every dimension clears its threshold", () => {
    const v = evaluateGate(passing, DEFAULT_GATE);
    expect(v.pass).toBe(true);
    expect(v.autoFailed).toBe(false);
    expect(v.failures).toEqual([]);
    expect(v.scores.overall).toBe(94);
  });

  test("rejects when a dimension is below its threshold and names it", () => {
    const v = evaluateGate(belowBar, DEFAULT_GATE);
    expect(v.pass).toBe(false);
    expect(v.failures.join("; ")).toContain("overall quality 82 < 90");
    expect(v.failures.join("; ")).toContain("functionality 88 < 95");
    expect(v.reason).toContain("82 < 90");
  });

  test("critical issues auto-fail no matter how high the scores", () => {
    const v = evaluateGate(report({ criticalIssues: ["Game crashes on respawn"] }), DEFAULT_GATE);
    expect(v.pass).toBe(false);
    expect(v.autoFailed).toBe(true);
    expect(v.reason).toContain("auto-fail");
  });

  test("scores are clamped to 0-100", () => {
    const v = evaluateGate(report({ overall: 300, performance: -5 }), DEFAULT_GATE);
    expect(v.scores.overall).toBe(100);
    expect(v.scores.performance).toBe(0);
    expect(v.pass).toBe(false);
  });

  test("thresholds are configurable", () => {
    const lenient = { ...DEFAULT_GATE, overall: 80 };
    expect(evaluateGate(report({ overall: 82 }), lenient).pass).toBe(true);
    expect(evaluateGate(report({ overall: 82 }), DEFAULT_GATE).pass).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Pipelines                                                           */
/* ------------------------------------------------------------------ */

describe("pipelines", () => {
  test("full pipeline has the canonical staged flow ending in done", () => {
    const p = pipelineFor("full");
    expect(p.phases.map((ph) => ph.id)).toEqual([
      "design",
      "architecture",
      "world",
      "gameplay",
      "systems",
      "npc",
      "integration",
      "playtest",
      "polish",
      "final",
      "done",
    ]);
    expect(p.phases[0].role).toBe("designer");
    expect(p.phases[7].role).toBe("qa");
    expect(p.phases[10].gate).toBeNull();
  });

  test("quick pipeline is compact", () => {
    const q = pipelineFor("quick");
    expect(q.phases.length).toBe(7);
    expect(q.phases[2].label).toBe("Build & Implement");
    expect(q.phases[q.phases.length - 1].id).toBe("done");
  });
});

/* ------------------------------------------------------------------ */
/* Orchestrator state machine                                          */
/* ------------------------------------------------------------------ */

describe("gdaStart", () => {
  test("starts at the first phase with defaults applied", () => {
    const s = started();
    expect(s.active).toBe(true);
    expect(s.phaseIndex).toBe(0);
    expect(currentPhase(s)?.id).toBe("design");
    expect(s.gates).toEqual(DEFAULT_GATE);
    expect(s.history[0].kind).toBe("start");
  });

  test("applies threshold overrides to every phase gate", () => {
    const s = started({ gates: { overall: 80, testing: 85 } });
    expect(s.gates.overall).toBe(80);
    expect(s.gates.testing).toBe(85);
    const designGate = currentPhase(s)?.gate;
    expect(designGate?.overall).toBe(80);
  });

  test("quick scope selects the compact pipeline", () => {
    expect(started({ scope: "quick" }).pipeline.id).toBe("quick");
  });
});

describe("gdaSubmitReview", () => {
  test("a passing report advances the phase and records the gate", () => {
    const s = started();
    const out = gdaSubmitReview(s, passing);
    expect(out.ok).toBe(true);
    expect(out.verdict?.pass).toBe(true);
    expect(out.advancedTo?.id).toBe("architecture");
    expect(out.state.completed).toContain("design");
    expect(out.state.phaseIndex).toBe(1);
    expect(out.state.reports).toHaveLength(1);
    expect(out.state.blockers).toEqual([]);
    expect(out.state.history.at(-1)?.kind).toBe("gate-pass");
  });

  test("a rejected report keeps the phase and counts a retry", () => {
    const s = started();
    const out = gdaSubmitReview(s, belowBar);
    expect(out.ok).toBe(true);
    expect(out.verdict?.pass).toBe(false);
    expect(out.advancedTo).toBeNull();
    expect(out.state.phaseIndex).toBe(0); // still on design
    expect(out.state.retries.design).toBe(1);
    expect(out.state.failed).toContain("design");
    expect(out.state.history.at(-1)?.kind).toBe("gate-reject");
    expect(out.message).toContain("Return to this phase");
  });

  test("critical issues become blockers that a later pass clears", () => {
    const s = started();
    const rejected = gdaSubmitReview(s, report({ criticalIssues: ["Respawn crashes"] }));
    expect(rejected.state.blockers).toContain("Respawn crashes");
    const recovered = gdaSubmitReview(rejected.state, passing);
    expect(recovered.state.blockers).toEqual([]);
    expect(recovered.state.completed).toContain("design");
  });

  test("repeating rejects does not lower the threshold — only block after max retries", () => {
    let s = started();
    for (let i = 0; i < MAX_PHASE_RETRIES; i++) {
      const out = gdaSubmitReview(s, belowBar);
      expect(out.state.gates).toEqual(DEFAULT_GATE); // threshold never lowered
      s = out.state;
    }
    expect(s.retries.design).toBe(MAX_PHASE_RETRIES);
    expect(s.blocked).toContain("design");
    expect(s.phaseIndex).toBe(1); // advanced with blockers carried
    expect(s.blockers.length).toBeGreaterThan(0);
    expect(s.history.some((h) => h.kind === "blocked")).toBe(true);
  });

  test("a pass after a reject advances the phase — improved work is legitimate", () => {
    let s = started();
    s = gdaSubmitReview(s, belowBar).state;
    const cheated = gdaSubmitReview(s, { ...passing, overall: 100, evidence: "" }).state;
    // A fresh pass after a reject IS legitimate — the phase was improved.
    expect(cheated.completed).toContain("design");
    expect(cheated.blockers).toEqual([]);
  });

  test("walking every phase leads to done and gdaFinish completes", () => {
    let s = started();
    const ids: string[] = [];
    for (let guard = 0; guard < 30; guard++) {
      const phaseId = currentPhase(s)?.id;
      if (phaseId === "done") break;
      ids.push(phaseId ?? "?");
      const out = gdaSubmitReview(s, passing);
      expect(out.ok).toBe(true);
      s = out.state;
    }
    expect(ids).toContain("final");
    expect(currentPhase(s)?.id).toBe("done");
    const fin = gdaFinish(s, "Verified: 4 playtests, zero crashes.");
    expect(fin.ok).toBe(true);
    expect(fin.state.finished).toBe(true);
    expect(fin.state.summary).toContain("Verified");
  });

  test("gdaFinish refuses before the pipeline is complete", () => {
    const fin = gdaFinish(started(), "done!");
    expect(fin.ok).toBe(false);
    expect(fin.message).toContain("not complete");
  });

  test("reviews are rejected when no pipeline is active", () => {
    const inactive: GdaState = { ...started(), active: false };
    const out = gdaSubmitReview(inactive, passing);
    expect(out.ok).toBe(false);
    expect(out.message).toContain("gda-start");
  });
});

/* ------------------------------------------------------------------ */
/* Blockers, tests, digest                                             */
/* ------------------------------------------------------------------ */

describe("state helpers", () => {
  test("gdaRecordBlocker dedupes and caps", () => {
    let s = started();
    s = gdaRecordBlocker(s, "Door doesn't open");
    s = gdaRecordBlocker(s, "Door doesn't open");
    expect(s.blockers).toHaveLength(1);
    expect(s.history.at(-1)?.kind).toBe("issue");
  });

  test("gdaDigest carries phase, scores and blockers for the live state", () => {
    let s = started();
    s = gdaSubmitReview(s, passing).state;
    s = gdaSubmitReview(s, belowBar).state;
    const d = gdaDigest(s);
    expect(d).toContain("__QYN_GDA__");
    expect(d).toContain("Architecture");
    expect(d).toContain("Game Design 94/100");
    expect(d).toContain("Open blockers");
  });

  test("gdaStatusText is human-readable and mentions the current phase", () => {
    const s = started();
    const text = gdaStatusText(s);
    expect(text).toContain("Roblox Studio");
    expect(text).toContain("Game Design");
    expect(text).toContain("Gate to pass");
  });
});