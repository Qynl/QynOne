import { describe, expect, test } from "bun:test";
import {
  SUBAGENT_LIMITS,
  SUBAGENT_ROLES,
  SUBAGENT_ROLE_ORDER,
  budgetFor,
  buildSubAgentBrief,
  emptyResult,
  parseSubAgentResult,
  resultToText,
  roleDef,
  subagentDigest,
} from "./subagents";
import type { SubAgentResult, SubAgentRun } from "./subagents";

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

describe("roles", () => {
  test("every documented role exists with a prompt and a budget", () => {
    for (const role of SUBAGENT_ROLE_ORDER) {
      const def = SUBAGENT_ROLES[role];
      expect(def.role).toBe(role);
      expect(def.prompt.length).toBeGreaterThan(120);
      expect(def.defaultSteps).toBeGreaterThanOrEqual(5);
      expect(roleDef(role)?.label).toBe(def.label);
    }
    expect(roleDef("not-a-role")).toBeNull();
  });

  test("roles cover the seven specialists in team order", () => {
    expect(SUBAGENT_ROLE_ORDER).toEqual(["designer", "architect", "builder", "qa", "debugger", "polisher", "researcher"]);
  });

  test("read-only roles never mutate the project", () => {
    for (const role of ["designer", "architect", "qa", "researcher"] as const) {
      expect(SUBAGENT_ROLES[role].readOnly).toBe(true);
    }
    for (const role of ["builder", "debugger", "polisher"] as const) {
      expect(SUBAGENT_ROLES[role].readOnly).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

describe("budgets", () => {
  test("defaults come from the role, overrides clamp into range", () => {
    expect(budgetFor({ role: "builder", task: "x" })).toBe(SUBAGENT_ROLES.builder.defaultSteps);
    expect(budgetFor({ role: "qa", task: "x", maxSteps: 999 })).toBeLessThanOrEqual(SUBAGENT_ROLES.qa.defaultSteps + 10);
    expect(budgetFor({ role: "designer", task: "x", maxSteps: 1 })).toBe(2);
    expect(budgetFor({ role: "builder", task: "x", maxSteps: 12 })).toBe(12);
  });
});

/* ------------------------------------------------------------------ */
/* Parsing structured results                                          */
/* ------------------------------------------------------------------ */

describe("parseSubAgentResult", () => {
  test("parses a bare JSON object", () => {
    const { result, ok } = parseSubAgentResult(
      '{"status":"success","summary":"Built the round manager.","findings":["Playtest clean"],"problems":[],"recommendations":[],"filesAffected":["ServerScriptService.RoundManager"],"testsRequired":[],"confidence":90,"qualityScore":92}',
    );
    expect(ok).toBe(true);
    expect(result.status).toBe("success");
    expect(result.summary).toContain("round manager");
    expect(result.findings).toContain("Playtest clean");
    expect(result.confidence).toBe(90);
  });

  test("parses a fenced block and ignores prose around it", () => {
    const { result, ok } = parseSubAgentResult(
      "I inspected the project.\n```json\n{\"status\":\"failure\",\"summary\":\"Respawn crashes.\",\"problems\":[\"Respawn crashes on death\"],\"confidence\":80,\"qualityScore\":40}\n```\nThat is all.",
    );
    expect(ok).toBe(true);
    expect(result.status).toBe("failure");
    expect(result.problems).toContain("Respawn crashes on death");
  });

  test("clamps scores and caps lists", () => {
    const { result } = parseSubAgentResult(
      `{"status":"success","summary":"s","findings":${JSON.stringify(Array.from({ length: 30 }, (_, i) => `finding ${i}`))},"problems":[],"confidence":500,"qualityScore":-3}`,
    );
    expect(result.findings.length).toBeLessThanOrEqual(8);
    expect(result.confidence).toBe(100);
    expect(result.qualityScore).toBe(0);
  });

  test("failure without problems is surfaced, not hidden", () => {
    const { result } = parseSubAgentResult('{"status":"failure","summary":"things are broken","problems":[],"confidence":50,"qualityScore":30}');
    expect(result.problems.length).toBeGreaterThan(0);
  });

  test("unparseable output returns ok:false so the lead agent does not trust it", () => {
    const { ok, result } = parseSubAgentResult("I did the thing and it is totally fine, trust me.");
    expect(ok).toBe(false);
    expect(result.status).toBe("blocked");
  });

  test("accepts quality as qualityScore alias and clamps unknown status to blocked", () => {
    const { result } = parseSubAgentResult('{"status":"pending","summary":"s","quality":77,"confidence":0}');
    expect(result.qualityScore).toBe(77);
    expect(result.status).toBe("blocked");
  });
});

/* ------------------------------------------------------------------ */
/* Briefs / rendering                                                  */
/* ------------------------------------------------------------------ */

describe("briefs and rendering", () => {
  test("brief carries focused context and the JSON contract", () => {
    const brief = buildSubAgentBrief({
      role: "builder",
      task: "Implement the grappling hook",
      project: "Rooftop Runner",
      engine: "Roblox Studio",
      files: "game.ServerScriptService.Movement",
    });
    expect(brief).toContain("Rooftop Runner");
    expect(brief).toContain("Roblox Studio");
    expect(brief).toContain("Implement the grappling hook");
    expect(brief).toContain('"status":"success|failure|blocked"');
    expect(brief).toContain("engine (MCP) tools");
    expect(brief).not.toContain("undefined");
  });

  test("read-only roles are told not to change project content", () => {
    const brief = buildSubAgentBrief({ role: "qa", task: "Test the round manager" });
    expect(brief).toContain("do NOT change project content");
    const builder = buildSubAgentBrief({ role: "builder", task: "Build it" });
    expect(builder).not.toContain("do NOT change project content");
  });

  test("resultToText is compact and complete", () => {
    const result: SubAgentResult = {
      status: "success",
      summary: "Done and tested.",
      findings: ["console clean"],
      problems: [],
      recommendations: ["ship it"],
      filesAffected: ["a.lua"],
      testsRequired: [],
      confidence: 88,
      qualityScore: 91,
    };
    const text = resultToText("Builder", result, { status: "done", stepsUsed: 9, error: undefined });
    expect(text).toContain("Builder");
    expect(text).toContain("qualityScore=91");
    expect(text).toContain("console clean");
  });

  test("digest lists runs and the session spawn budget", () => {
    const runs: SubAgentRun[] = [
      {
        id: "1",
        role: "designer",
        task: "Design the loop",
        engine: "Roblox Studio",
        status: "done",
        stepsUsed: 6,
        stepsBudget: 10,
        startedAt: 1,
        finishedAt: 2,
        result: { status: "success", summary: "Brief ready.", findings: [], problems: [], recommendations: [], filesAffected: [], testsRequired: [], confidence: 90, qualityScore: 95 },
      },
      {
        id: "2",
        role: "qa",
        task: "Break the build",
        engine: "Roblox Studio",
        status: "running",
        stepsUsed: 2,
        stepsBudget: 14,
        startedAt: 1,
        finishedAt: null,
        result: null,
      },
    ];
    const d = subagentDigest(runs);
    expect(d).toContain("Game Designer");
    expect(d).toContain("RUNNING");
    expect(d).toContain(String(SUBAGENT_LIMITS.maxPerSession));
    expect(subagentDigest([])).toBe("");
  });

  test("emptyResult builds a sane blocked baseline", () => {
    const r = emptyResult("blocked", "engine unreachable");
    expect(r.status).toBe("blocked");
    expect(r.summary).toBe("engine unreachable");
    expect(r.confidence).toBe(0);
  });
});
