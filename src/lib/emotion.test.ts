import { describe, expect, test } from "bun:test";
import { classifyUserMessage, decide, isBackgroundEvent, PRIORITY } from "./emotion";
import type { EmotionCtx } from "./emotion";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function ctx(overrides: Partial<EmotionCtx> = {}): EmotionCtx {
  return {
    current: "idle",
    base: "idle",
    busy: false,
    voiceEnabled: false,
    idleMs: 30_000,
    activeTask: null,
    lastTaskDone: null,
    sinceFailMs: null,
    cooldown: () => 0,
    history: [],
    ...overrides,
  };
}

/** A build that finished 10 s ago — recent enough to count as context. */
const majorBuildDone = {
  ok: true,
  importance: "major" as const,
  task: "build" as const,
  ts: Date.now() - 10_000,
};

const recentDone = {
  ok: true,
  importance: "normal" as const,
  task: "chat" as const,
  ts: Date.now() - 10_000,
};

const cooldownActive = (key: string) => (k: string) => (k === key ? 30_000 : 0);

/* ------------------------------------------------------------------ */
/* User sentiment                                                      */
/* ------------------------------------------------------------------ */

describe("classifyUserMessage", () => {
  test("strong praise is high confidence", () => {
    const s = classifyUserMessage("that is amazing, well done!");
    expect(s.sentiment).toBe("praise");
    expect(s.confidence).toBeGreaterThan(0.8);
  });

  test("mild praise is low-medium confidence", () => {
    const s = classifyUserMessage("nice");
    expect(s.sentiment).toBe("praise");
    expect(s.confidence).toBeLessThan(0.7);
  });

  test("frustration is detected", () => {
    expect(classifyUserMessage("this is broken again, fix it now").sentiment).toBe("frustration");
  });

  test("sadness is detected", () => {
    expect(classifyUserMessage("I'm having a bad day and I feel down").sentiment).toBe("sadness");
  });

  test("sarcastic excitement deflates to neutral", () => {
    const s = classifyUserMessage("oh great. sure. yes!");
    expect(s.sentiment).toBe("neutral");
  });

  test("question detected", () => {
    expect(classifyUserMessage("what's the weather?").sentiment).toBe("question");
  });

  test("neutral message has no signal", () => {
    expect(classifyUserMessage("open Unreal").sentiment).toBe("neutral");
  });
});

/* ------------------------------------------------------------------ */
/* Context > keywords                                                  */
/* ------------------------------------------------------------------ */

describe("context beats keywords", () => {
  test("'YES!' right after a major build is victory, not just excitement", () => {
    const d = decide({ kind: "user-said", text: "YES!" }, ctx({ activeTask: "build", lastTaskDone: majorBuildDone }));
    expect(d?.emotion).toBe("victory");
    expect(d?.sequence).toHaveLength(1);
    expect(d?.sequence?.[0].emotion).toBe("celebrate");
  });

  test("the same 'YES!' with no build context is plain excitement", () => {
    const d = decide({ kind: "user-said", text: "YES!" }, ctx());
    expect(d?.emotion).toBe("excited");
    expect(d?.tier).toBe("reaction");
  });

  test("'great' right after solving a task is a warm happy, not a celebration", () => {
    const d = decide({ kind: "user-said", text: "that's great" }, ctx({ lastTaskDone: recentDone }));
    expect(d?.emotion).toBe("happy");
    expect(d?.tier).toBe("reaction");
    expect(d?.intensity).toBeLessThan(0.8);
  });

  test("praise right after a major build escalates to proud", () => {
    const d = decide({ kind: "user-said", text: "amazing work!" }, ctx({ activeTask: "build", lastTaskDone: majorBuildDone }));
    expect(d?.emotion).toBe("proud");
    expect(d?.tier).toBe("context");
  });

  test("plain 'open Unreal' produces no emotional reaction", () => {
    expect(decide({ kind: "user-said", text: "open Unreal" }, ctx())).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* User emotions                                                       */
/* ------------------------------------------------------------------ */

describe("user emotions", () => {
  test("frustration → concerned, never happy", () => {
    const d = decide({ kind: "user-said", text: "this is useless, wtf" }, ctx());
    expect(d?.emotion).toBe("concerned");
    expect(d?.overlay).toBe(true);
  });

  test("sadness → concerned, gentle", () => {
    const d = decide({ kind: "user-said", text: "I'm really down today" }, ctx());
    expect(d?.emotion).toBe("concerned");
  });

  test("confusion → confused", () => {
    const d = decide({ kind: "user-said", text: "wait, I don't get it" }, ctx());
    expect(d?.emotion).toBe("confused");
  });

  test("a plain question → curious, subtle", () => {
    const d = decide({ kind: "user-said", text: "what time is it?" }, ctx());
    expect(d?.emotion).toBe("curious");
    expect(d?.intensity).toBeLessThan(0.6);
  });
});

/* ------------------------------------------------------------------ */
/* Tasks, tools, autonomous builds                                     */
/* ------------------------------------------------------------------ */

describe("tasks and autonomous builds", () => {
  test("task start chat → thinking", () => {
    expect(decide({ kind: "task-start", task: "chat" }, ctx())?.emotion).toBe("thinking");
  });

  test("autonomous build start → determined", () => {
    const d = decide({ kind: "task-start", task: "build" }, ctx());
    expect(d?.emotion).toBe("determined");
    expect(d?.sequence?.[0].emotion).toBe("working");
  });

  test("engine step → focused", () => {
    expect(decide({ kind: "task-step", engine: true }, ctx({ current: "working", base: "working" }))?.emotion).toBe("focused");
  });

  test("small success → happy, subtle", () => {
    const d = decide({ kind: "task-success", importance: "minor" }, ctx());
    expect(d?.emotion).toBe("happy");
    expect(d?.intensity).toBeLessThan(0.6);
  });

  test("major build success → victory → celebrate → proud", () => {
    const d = decide({ kind: "task-success", importance: "major" }, ctx({ activeTask: "build" }));
    expect(d?.emotion).toBe("victory");
    expect(d?.confidence).toBeGreaterThan(0.9);
    expect(d?.sequence?.map((s) => s.emotion)).toEqual(["celebrate", "proud"]);
  });

  test("major success is muted when celebration is cooling down", () => {
    const d = decide({ kind: "task-success", importance: "major" }, ctx({ cooldown: cooldownActive("celebration") }));
    expect(d?.emotion).toBe("proud");
    expect(d?.sequence).toBeUndefined();
  });

  test("task failure → concerned", () => {
    const d = decide({ kind: "task-fail" }, ctx({ current: "working", base: "working" }));
    expect(d?.emotion).toBe("concerned");
    expect(d?.restoreTo).toBe("calm");
  });

  test("tool failure → concerned, repeated failures suppressed by cooldown", () => {
    expect(decide({ kind: "tool-result", ok: false, engine: true }, ctx())?.emotion).toBe("concerned");
    expect(decide({ kind: "tool-result", ok: false, engine: true }, ctx({ cooldown: cooldownActive("error") }))).toBeNull();
  });

  test("recovery after failure → determined, not celebration", () => {
    const d = decide(
      { kind: "tool-result", ok: true, engine: true, important: true },
      ctx({ sinceFailMs: 5_000, current: "working", base: "working" }),
    );
    expect(d?.emotion).toBe("determined");
  });

  test("important engine success → relieved", () => {
    const d = decide({ kind: "tool-result", ok: true, engine: true, important: true }, ctx({ current: "working", base: "working" }));
    expect(d?.emotion).toBe("relieved");
    expect(d?.overlay).toBe(true);
  });

  test("routine tool success → no reaction", () => {
    expect(decide({ kind: "tool-result", ok: true, engine: false }, ctx())).toBeNull();
  });

  test("stopped → calm", () => {
    expect(decide({ kind: "stopped" }, ctx())?.emotion).toBe("calm");
  });
});

/* ------------------------------------------------------------------ */
/* MCP                                                                 */
/* ------------------------------------------------------------------ */

describe("MCP events", () => {
  test("connecting → attentive", () => {
    expect(decide({ kind: "mcp-connecting" }, ctx())?.emotion).toBe("attentive");
  });

  test("connected → small happy", () => {
    const d = decide({ kind: "mcp-connected" }, ctx());
    expect(d?.emotion).toBe("happy");
    expect(d?.intensity).toBeLessThan(0.6);
  });

  test("connection failure → concerned", () => {
    expect(decide({ kind: "mcp-failed" }, ctx())?.emotion).toBe("concerned");
  });

  test("MCP events are background — suppressed while busy", () => {
    expect(isBackgroundEvent({ kind: "mcp-connected" })).toBe(true);
    expect(isBackgroundEvent({ kind: "mcp-connecting" })).toBe(true);
    expect(isBackgroundEvent({ kind: "mcp-failed" })).toBe(true);
    expect(isBackgroundEvent({ kind: "user-said", text: "hi" })).toBe(false);
    expect(isBackgroundEvent({ kind: "task-step", engine: true })).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Notifications, calendar, memory                                     */
/* ------------------------------------------------------------------ */

describe("background context", () => {
  test("info notification → notification overlay restoring the base", () => {
    const d = decide({ kind: "notification", severity: "info" }, ctx({ current: "working", base: "working" }));
    expect(d?.emotion).toBe("notification");
    expect(d?.overlay).toBe(true);
    expect(d?.restoreTo).toBe("working");
  });

  test("warn notification → alert, stronger", () => {
    const d = decide({ kind: "notification", severity: "warn" }, ctx({ current: "working", base: "working" }));
    expect(d?.emotion).toBe("alert");
    expect(d?.intensity).toBeGreaterThan(0.6);
  });

  test("repeated notifications within cooldown are suppressed", () => {
    expect(decide({ kind: "notification", severity: "info" }, ctx({ cooldown: cooldownActive("notification") }))).toBeNull();
  });

  test("notifications are background events", () => {
    expect(isBackgroundEvent({ kind: "notification", severity: "info" })).toBe(true);
  });

  test("calendar soon → eventSoon overlay", () => {
    const d = decide({ kind: "calendar", sub: "soon", id: "e1" }, ctx({ current: "present", base: "present" }));
    expect(d?.emotion).toBe("eventSoon");
    expect(d?.overlay).toBe(true);
  });

  test("missed event → missedEvent", () => {
    expect(decide({ kind: "calendar", sub: "missed", id: "e1" }, ctx())?.emotion).toBe("missedEvent");
  });

  test("memory save → remembering, only when meaningful", () => {
    expect(decide({ kind: "memory-saved" }, ctx())?.emotion).toBe("remembering");
  });
});

/* ------------------------------------------------------------------ */
/* Voice and interruptions                                             */
/* ------------------------------------------------------------------ */

describe("voice and interruptions", () => {
  test("wake word → wake", () => {
    expect(decide({ kind: "voice-wake" }, ctx())?.emotion).toBe("wake");
  });

  test("listening on → listening (direct tier)", () => {
    const d = decide({ kind: "voice-listen", on: true }, ctx());
    expect(d?.emotion).toBe("listening");
    expect(d?.tier).toBe("direct");
  });

  test("speaking is direct — it may interrupt a working state", () => {
    const d = decide({ kind: "speaking", on: true }, ctx({ current: "working", base: "working" }));
    expect(d?.emotion).toBe("speaking");
    expect(PRIORITY[(d?.tier ?? "reaction") as keyof typeof PRIORITY]).toBeGreaterThan(PRIORITY.task);
  });

  test("voice command → attentive", () => {
    expect(decide({ kind: "voice-command" }, ctx())?.emotion).toBe("attentive");
  });
});

/* ------------------------------------------------------------------ */
/* Idle                                                                */
/* ------------------------------------------------------------------ */

describe("idle drift", () => {
  test("inactivity escalates calm → quiet → sleepy → sleeping", () => {
    const base = ctx({ idleMs: 9 * 60_000, current: "calm", base: "calm" });
    expect(decide({ kind: "idle-stage", stage: "quiet" }, base)?.emotion).toBe("quiet");
    const sleepy = ctx({ idleMs: 15 * 60_000, current: "quiet", base: "quiet" });
    expect(decide({ kind: "idle-stage", stage: "sleepy" }, sleepy)?.emotion).toBe("sleepy");
    const sleeping = ctx({ idleMs: 21 * 60_000, current: "sleepy", base: "sleepy" });
    expect(decide({ kind: "idle-stage", stage: "sleeping" }, sleeping)?.emotion).toBe("sleeping");
  });

  test("idle drift never stomps a mid-reaction state", () => {
    const d = decide({ kind: "idle-stage", stage: "sleepy" }, ctx({ idleMs: 15 * 60_000, current: "happy", base: "idle" }));
    expect(d).toBeNull();
  });

  test("idle drift does not run while busy", () => {
    const d = decide({ kind: "idle-stage", stage: "sleepy" }, ctx({ idleMs: 15 * 60_000, busy: true, current: "working", base: "working" }));
    expect(d).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Confidence gating                                                   */
/* ------------------------------------------------------------------ */

describe("confidence gating", () => {
  test("low-confidence ambiguous praise produces a subtle reaction or none", () => {
    const s = classifyUserMessage("oh sure, great.");
    expect(s.confidence).toBeLessThan(0.5);
    const d = decide({ kind: "user-said", text: "oh sure, great." }, ctx());
    /* sarcasm hint drops excitement/praise below the 0.4 threshold → null */
    expect(d).toBeNull();
  });

  test("background reactions rank below an active task", () => {
    const notification = decide({ kind: "notification", severity: "info" }, ctx());
    const step = decide({ kind: "task-step", engine: true }, ctx());
    expect(PRIORITY[(step?.tier ?? "reaction") as keyof typeof PRIORITY]).toBeGreaterThanOrEqual(PRIORITY[(notification?.tier ?? "reaction") as keyof typeof PRIORITY]);
  });
});