/* ------------------------------------------------------------------ */
/* Nex emotion engine                                                  */
/* ------------------------------------------------------------------ */
/* The single decision layer behind every emotion Nex shows.           */
/*                                                                    */
/* The old system was "keyword detected → emotion → back to idle":     */
/* any caller could overwrite any state, nothing remembered what came  */
/* before, and the same word always produced the same reaction.        */
/*                                                                    */
/* This engine replaces that with:                                     */
/*   event + context + current state + previous state + importance     */
/*   + user sentiment + activity  →  an EmotionDecision                */
/*                                                                    */
/* Every automatic reaction carries a confidence score. Low confidence */
/* means NO emotion — staying neutral is better than being wrong.      */
/* Background events (notifications, calendar, view glances) never run */
/* while Nex is busy, overlays show on top of a base state and restore */
/* it afterwards, cooldowns stop the same reaction from spamming, and  */
/* long inactivity drifts through calm → quiet → sleepy → sleeping.    */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AiEmotion } from "./ai";

/* ------------------------------------------------------------------ */
/* Emotion metadata                                                    */
/* ------------------------------------------------------------------ */

/** States that read as "nothing special is happening". Used by views to
    decide whether the provider's emotion is meaningful enough to surface
    over the view's own ambient (idle drift, phase mood). */
export const CALM_BASE = new Set<AiEmotion>([
  "idle",
  "awake",
  "present",
  "calm",
  "settled",
  "quiet",
  "sleepy",
  "sleeping",
  "yawning",
  "boot",
]);

export function isCalmBase(emotion: AiEmotion | null | undefined): boolean {
  return Boolean(emotion) && CALM_BASE.has(emotion as AiEmotion);
}

/** States Nex can occupy as a *base* — the state he returns to after a
    reaction or overlay ends. Everything else is a reaction on top. */
export const BASE_STATES = new Set<AiEmotion>([
  ...CALM_BASE,
  "thinking",
  "working",
  "focused",
  "focusedLeft",
  "focusedRight",
  "scanning",
  "searching",
  "listening",
  "speaking",
  "attentive",
  "determined",
  "confident",
]);

/** Drift states — the long-idle ladder. Only reached when the user has
    genuinely been away, and woken by real interaction. */
const DRIFT_STATES = new Set<AiEmotion>(["calm", "quiet", "sleepy", "sleeping", "tired"]);
const DRIFT_ORDER: AiEmotion[] = ["calm", "quiet", "sleepy", "sleeping"];

export type EmotionTier = "critical" | "direct" | "task" | "context" | "reaction" | "ambient";

export const PRIORITY: Record<EmotionTier, number> = {
  critical: 100, // offline, real system failure
  direct: 90, // the user talking to Nex, voice, speaking
  task: 80, // working / focused / thinking
  context: 70, // meaningful context: victory, missed event, concerned
  reaction: 60, // normal emotional reactions
  ambient: 50, // idle drift, view glances
};

/** Where a plain setEmotion(e, ms) call lands when no richer event is used. */
const DIRECT_TIER: Partial<Record<AiEmotion, EmotionTier>> = {
  working: "task",
  thinking: "task",
  focused: "task",
  focusedLeft: "task",
  focusedRight: "task",
  scanning: "task",
  searching: "task",
  determined: "task",
  confident: "task",
  attentive: "direct",
  listening: "direct",
  speaking: "direct",
  wake: "direct",
  concerned: "context",
  alert: "context",
  offline: "critical",
  victory: "context",
  celebrate: "context",
  missedEvent: "context",
  eventSoon: "context",
  happy: "reaction",
  joyful: "reaction",
  grateful: "reaction",
  excited: "reaction",
  proud: "reaction",
  delighted: "reaction",
  relieved: "reaction",
  party: "reaction",
  remembering: "reaction",
  idle: "ambient",
  awake: "ambient",
  present: "ambient",
  calm: "ambient",
  settled: "ambient",
  quiet: "ambient",
  sleepy: "ambient",
  sleeping: "ambient",
};

/** Human labels for the debugger. */
export const EMOTION_LABELS: Partial<Record<AiEmotion, string>> = {
  idle: "Idle",
  awake: "Awake",
  present: "Present",
  greeting: "Greeting",
  boot: "Booting",
  listening: "Listening",
  wake: "Woke up",
  attentive: "Attentive",
  speaking: "Speaking",
  thinking: "Thinking",
  working: "Working",
  happy: "Happy",
  joyful: "Joyful",
  laugh: "Laughing",
  love: "Loving",
  party: "Party",
  celebrate: "Celebrating",
  excited: "Excited",
  proud: "Proud",
  grateful: "Grateful",
  calm: "Calm",
  determined: "Determined",
  powerful: "Powerful",
  relieved: "Relieved",
  frustrated: "Frustrated",
  victory: "Victory",
  curious: "Curious",
  focused: "Focused",
  focusedLeft: "Focused left",
  focusedRight: "Focused right",
  anticipating: "Anticipating",
  playful: "Playful",
  wink: "Wink",
  shy: "Shy",
  surprised: "Surprised",
  shocked: "Shocked",
  alert: "Alert",
  notification: "Notification",
  eventSoon: "Event soon",
  missedEvent: "Missed event",
  sad: "Sad",
  crying: "Crying",
  worried: "Worried",
  scared: "Scared",
  confused: "Confused",
  angry: "Angry",
  yawning: "Yawning",
  sleepy: "Sleepy",
  sleeping: "Sleeping",
  tired: "Tired",
  sick: "Sick",
  zoned: "Zoned out",
  searching: "Searching",
  scanning: "Scanning",
  remembering: "Remembering",
  quiet: "Quiet",
  offline: "Offline",
  yes: "Yes",
  no: "No",
  sorry: "Sorry",
  concerned: "Concerned",
  welcoming: "Welcoming",
  confident: "Confident",
  delighted: "Delighted",
  disappointed: "Disappointed",
  amused: "Amused",
  inspired: "Inspired",
  restless: "Restless",
  protective: "Protective",
  settled: "Settled",
};

/** How long each cooldown family suppresses its own repeats. */
export const COOLDOWN_MS: Record<string, number> = {
  notification: 15_000,
  warn: 20_000,
  praise: 10_000,
  celebration: 30_000,
  error: 8_000,
  calendar: 60_000,
  offline: 30_000,
  systemload: 90_000,
  play: 30_000,
  memory: 8_000,
  viewchange: 6_000,
  mcp: 10_000,
  mcperror: 20_000,
  toolok: 8_000,
  recovery: 10_000,
  curious: 8_000,
  confused: 10_000,
  excited: 10_000,
};

/** Background events never run while Nex is busy working. */
export function isBackgroundEvent(event: NexEvent): boolean {
  return BACKGROUND_EVENTS.has(event.kind);
}

const BACKGROUND_EVENTS = new Set<NexEvent["kind"]>([
  "notification",
  "calendar",
  "memory-saved",
  "system-load",
  "view-change",
  "mcp-connecting",
  "mcp-connected",
  "mcp-failed",
  "play",
  "idle-stage",
]);

export interface EmotionRecord {
  emotion: AiEmotion;
  ts: number;
  reason: string;
  confidence: number;
  priority: number;
  intensity: number;
  durationMs: number;
}

export interface EmotionDebug extends EmotionRecord {
  base: AiEmotion;
  overlay: boolean;
  cooldowns: Array<{ key: string; leftMs: number }>;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

export type NexEvent =
  | { kind: "user-said"; text: string; viaVoice?: boolean }
  | { kind: "voice-wake" }
  | { kind: "voice-listen"; on: boolean }
  | { kind: "voice-command" }
  | { kind: "voice-error" }
  | { kind: "speaking"; on: boolean }
  | { kind: "task-start"; task: "chat" | "build" | "tool" | "slash" }
  | { kind: "task-step"; engine?: boolean }
  | { kind: "tool-result"; ok: boolean; engine: boolean; important?: boolean }
  | { kind: "task-success"; importance: "minor" | "normal" | "major" }
  | { kind: "task-fail" }
  | { kind: "stopped" }
  | { kind: "notification"; severity: "info" | "warn" }
  | { kind: "calendar"; sub: "soon" | "missed"; id: string }
  | { kind: "memory-saved" }
  | { kind: "network"; on: boolean }
  | { kind: "system-load" }
  | { kind: "view-change"; view: string }
  | { kind: "mcp-connecting" }
  | { kind: "mcp-connected" }
  | { kind: "mcp-failed" }
  | { kind: "play"; scene: "party" | "sleep" }
  | { kind: "idle-stage"; stage: "calm" | "quiet" | "sleepy" | "sleeping" }
  | { kind: "direct"; emotion: AiEmotion; ms?: number; reason?: string };

/* ------------------------------------------------------------------ */
/* User sentiment — context-first, keyword fallback                    */
/* ------------------------------------------------------------------ */

export interface UserSentiment {
  sentiment: "praise" | "gratitude" | "frustration" | "sadness" | "excitement" | "confusion" | "question" | "neutral";
  confidence: number;
  intensity: number;
  reason: string;
}

const PRAISE_STRONG =
  /\b(amazing|brilliant|incredible|awesome|perfect|love (it|this|you)|thank you so much|great job|good job|well done|best|genius|beautiful)\b/i;
const PRAISE_MILD = /\b(nice|good|great|cool|sweet|nice one|solid|clean)\b/i;
const GRATITUDE = /\b(thanks|thank you|appreciate|grateful)\b/i;
const FRUSTRATION_STRONG =
  /\b(shut up|hate (this|it|you)|screw (this|it|that)|wtf|stupid|useless|terrible|worst|awful|broken|annoying|fix it now|not working|damn|bullshit|fuck)\b/i;
const FRUSTRATION_MILD = /\b(ugh|meh|why is|why won'?t|c'?mon|seriously|again\?|error|fails? again|this again)\b/i;
const SADNESS =
  /\b(sad|depressed|miss (you|it|him|her)|bad day|lonely|cry(ing)?|heartbroken|down|sick of|tired of (this|everything)|lost it)\b/i;
const EXCITEMENT_STRONG = /(^|\s)(yes!+|wo+h?o+!|ya+y|let'?s go!|finally!+|wow!+|omg|hype(d)?|party time)|!{2,}/i;
const EXCITEMENT_MILD = /(^|\s)(yay|woo|nice!|cool!|great!|good!|finally|awesome|let'?s go)\b/i;
const CONFUSION = /\b(huh\?|what\?|why\?|confus(ed|ing)|doesn'?t make sense|i don'?t get it|wait what)\b/i;
const QUESTION = /[?？]\s*$/;
const SARCASM_HINT = /\b(sure|right|yeah right|great\.|thanks a lot|how nice|of course|obviously|just great)\b/i;

/**
 * Reads the user's actual tone from a message. Keyword-based, but the
 * *decision* layer below weighs this against what is happening — the same
 * "YES!" after a finished build is victory, alone it is just excited, and
 * sarcasm deflates the reaction entirely.
 */
export function classifyUserMessage(text: string): UserSentiment {
  const t = String(text ?? "").trim();
  if (!t) return { sentiment: "neutral", confidence: 0, intensity: 0, reason: "empty message" };

  if (FRUSTRATION_STRONG.test(t)) return { sentiment: "frustration", confidence: 0.92, intensity: 0.85, reason: "strong frustration words" };
  if (FRUSTRATION_MILD.test(t)) return { sentiment: "frustration", confidence: 0.6, intensity: 0.5, reason: "mild frustration" };
  if (SADNESS.test(t)) return { sentiment: "sadness", confidence: 0.8, intensity: 0.75, reason: "sad words" };
  if (PRAISE_STRONG.test(t)) {
    if (GRATITUDE.test(t)) return { sentiment: "gratitude", confidence: 0.8, intensity: 0.65, reason: "explicit thanks" };
    return { sentiment: "praise", confidence: 0.88, intensity: 0.8, reason: "strong praise" };
  }
  if (EXCITEMENT_STRONG.test(t)) {
    if (SARCASM_HINT.test(t)) return { sentiment: "neutral", confidence: 0.5, intensity: 0.3, reason: "excitement reads sarcastic" };
    return { sentiment: "excitement", confidence: 0.8, intensity: 0.85, reason: "strong excitement" };
  }
  if (CONFUSION.test(t)) return { sentiment: "confusion", confidence: 0.72, intensity: 0.6, reason: "confusion words" };
  if (QUESTION.test(t)) return { sentiment: "question", confidence: 0.55, intensity: 0.4, reason: "ends with a question" };
  if (PRAISE_MILD.test(t)) {
    if (GRATITUDE.test(t)) return { sentiment: "gratitude", confidence: 0.65, intensity: 0.45, reason: "mild thanks" };
    const conf = SARCASM_HINT.test(t) ? 0.35 : 0.55;
    return { sentiment: "praise", confidence: conf, intensity: 0.4, reason: "mild praise" };
  }
  if (EXCITEMENT_MILD.test(t)) return { sentiment: "excitement", confidence: 0.55, intensity: 0.5, reason: "mild excitement" };
  return { sentiment: "neutral", confidence: 0.15, intensity: 0, reason: "no strong signal" };
}

/* ------------------------------------------------------------------ */
/* Decision                                                            */
/* ------------------------------------------------------------------ */

export interface EmotionDecision {
  emotion: AiEmotion | null;
  tier: EmotionTier;
  confidence: number;
  intensity: number;
  durationMs: number;
  reason: string;
  /** show on top of the current base and restore it afterwards */
  overlay: boolean;
  restoreTo?: AiEmotion;
  /** chained follow-ups, e.g. victory → celebrate */
  sequence?: Array<{ emotion: AiEmotion; durationMs: number; tier: EmotionTier }>;
  /** cooldown family to stamp ("notification", "celebration", …) */
  cooldownKey?: string;
}

export interface TaskOutcome {
  ok: boolean;
  importance: "minor" | "normal" | "major";
  task: "chat" | "build" | "tool" | "slash" | null;
  ts: number;
}

export interface EmotionCtx {
  current: AiEmotion;
  base: AiEmotion;
  busy: boolean;
  voiceEnabled: boolean;
  /** ms since the user last touched the app */
  idleMs: number;
  activeTask: "chat" | "build" | "tool" | "slash" | null;
  lastTaskDone: TaskOutcome | null;
  /** ms since the last tool failure, or null */
  sinceFailMs: number | null;
  /** returns ms remaining for a cooldown family (0 = free) */
  cooldown: (key: string) => number;
  history: EmotionRecord[];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function d(
  emotion: AiEmotion | null,
  tier: EmotionTier,
  reason: string,
  opts: Partial<Omit<EmotionDecision, "emotion" | "tier" | "reason">> = {},
): EmotionDecision {
  return { emotion, tier, reason, confidence: 1, intensity: 1, durationMs: 0, overlay: false, ...opts };
}

const recentTask = (t: TaskOutcome | null, withinMs: number): TaskOutcome | null =>
  t && Date.now() - t.ts < withinMs && t.ok ? t : null;

/**
 * The pure decision layer. Everything about *what to feel, whether it is
 * worth feeling, and how strong* is decided here; the hook applies it.
 */
export function decide(event: NexEvent, ctx: EmotionCtx): EmotionDecision | null {
  const { current, base, activeTask, lastTaskDone, sinceFailMs } = ctx;

  /* Direct sets (legacy setEmotion calls) go through with their own tier. */
  if (event.kind === "direct") {
    const tier = DIRECT_TIER[event.emotion] ?? "reaction";
    return d(event.emotion, tier, event.reason ?? `set ${event.emotion}`, {
      confidence: 0.8,
      intensity: 1,
      durationMs: event.ms ?? (tier === "task" || tier === "direct" || tier === "critical" ? 0 : 1600),
      overlay: false,
    });
  }

  switch (event.kind) {
    /* ---------------- user talking to Nex ---------------- */
    case "user-said": {
      const s = classifyUserMessage(event.text);
      if (s.sentiment === "neutral" || s.confidence < 0.4) return null;

      const buildJustWrapped = recentTask(lastTaskDone, 150_000)?.task === "build";
      const taskJustWrapped = recentTask(lastTaskDone, 150_000) !== null;
      const majorBuild = buildJustWrapped && lastTaskDone!.importance === "major";

      switch (s.sentiment) {
        case "praise":
        case "gratitude": {
          if (majorBuild) {
            if (ctx.cooldown("celebration") > 0) return null;
            return d("proud", "context", "praise right after a major build", {
              confidence: clamp(s.confidence + 0.1, 0, 1),
              intensity: 0.9,
              durationMs: 1800,
              overlay: false,
              restoreTo: base,
              cooldownKey: "celebration",
            });
          }
          if (taskJustWrapped) {
            return d(s.sentiment === "gratitude" ? "grateful" : "happy", "reaction", "praise after finishing a task", {
              confidence: clamp(s.confidence * 0.85, 0, 1),
              intensity: clamp(s.intensity * 0.8, 0.3, 0.7),
              durationMs: 1600,
              overlay: false,
              restoreTo: base,
              cooldownKey: "praise",
            });
          }
          /* ordinary praise with no special context: small, earned reaction */
          return d(s.sentiment === "gratitude" ? "grateful" : "happy", "reaction", "mild praise", {
            confidence: clamp(s.confidence * 0.75, 0, 1),
            intensity: clamp(s.intensity * 0.6, 0.25, 0.5),
            durationMs: 1300,
            overlay: false,
            restoreTo: base,
            cooldownKey: "praise",
          });
        }
        case "frustration":
          return d("concerned", "context", "user is frustrated", {
            confidence: clamp(s.confidence + 0.05, 0, 1),
            intensity: clamp(s.intensity * 0.9, 0.4, 0.9),
            durationMs: 2000,
            overlay: true,
            restoreTo: base,
            cooldownKey: "error",
          });
        case "sadness":
          return d("concerned", "context", "user is feeling down", {
            confidence: clamp(s.confidence, 0, 1),
            intensity: 0.6,
            durationMs: 2200,
            overlay: true,
            restoreTo: base,
            cooldownKey: "error",
          });
        case "excitement": {
          if (majorBuild) {
            if (ctx.cooldown("celebration") > 0) return null;
            return d("victory", "context", "user celebrates a finished build", {
              confidence: 0.95,
              intensity: 0.95,
              durationMs: 1800,
              sequence: [{ emotion: "celebrate", durationMs: 1500, tier: "context" }],
              overlay: false,
              restoreTo: base,
              cooldownKey: "celebration",
            });
          }
          return d("excited", "reaction", "user is excited", {
            confidence: clamp(s.confidence, 0, 1),
            intensity: clamp(s.intensity, 0.4, 0.85),
            durationMs: 1700,
            overlay: false,
            restoreTo: base,
            cooldownKey: "excited",
          });
        }
        case "confusion":
          return d("confused", "reaction", "user is confused", {
            confidence: clamp(s.confidence, 0, 1),
            intensity: 0.6,
            durationMs: 1600,
            overlay: false,
            restoreTo: base,
            cooldownKey: "confused",
          });
        case "question":
          return d("curious", "reaction", "user asked a question", {
            confidence: clamp(s.confidence, 0, 1),
            intensity: 0.45,
            durationMs: 1400,
            overlay: false,
            restoreTo: base,
            cooldownKey: "curious",
          });
        default:
          return null;
      }
    }

    /* ---------------- voice ---------------- */
    case "voice-wake":
      return d("wake", "direct", "wake word heard", { confidence: 0.95, intensity: 1, durationMs: 1700 });
    case "voice-listen": {
      if (event.on) return d("listening", "direct", "listening for the wake word", { confidence: 0.9, intensity: 0.7, durationMs: 0 });
      if (ctx.busy) return null;
      return d("settled", "ambient", "listening stopped", { confidence: 0.8, intensity: 0.4, durationMs: 1300 });
    }
    case "voice-command":
      return d("attentive", "direct", "captured a spoken command", { confidence: 0.9, intensity: 0.8, durationMs: 1400 });
    case "voice-error":
      return d("concerned", "context", "voice needs attention", { confidence: 0.85, intensity: 0.7, durationMs: 2000, overlay: true, restoreTo: base });
    case "speaking": {
      if (event.on) return d("speaking", "direct", "speaking out loud", { confidence: 0.95, intensity: 1, durationMs: 0 });
      return d("settled", "ambient", "finished speaking", { confidence: 0.8, intensity: 0.4, durationMs: 1200 });
    }

    /* ---------------- tasks ---------------- */
    case "task-start": {
      if (event.task === "build") {
        return d("determined", "task", "starting an autonomous build", {
          confidence: 0.9,
          intensity: 0.85,
          durationMs: 2600,
          sequence: [{ emotion: "working", durationMs: 0, tier: "task" }],
        });
      }
      if (event.task === "chat") return d("thinking", "task", "thinking about what you asked", { confidence: 0.85, intensity: 0.7, durationMs: 0 });
      return d("working", "task", `working on /${event.task}`, { confidence: 0.85, intensity: 0.75, durationMs: 0 });
    }
    case "task-step": {
      if (event.engine) return d("focused", "task", "running engine tools", { confidence: 0.8, intensity: 0.8, durationMs: 0 });
      return d("working", "task", "working through a step", { confidence: 0.8, intensity: 0.7, durationMs: 0 });
    }
    case "tool-result": {
      if (!event.ok) {
        if (ctx.cooldown("error") > 0) return null;
        return d("concerned", "context", `${event.engine ? "engine" : "tool"} call failed`, {
          confidence: 0.85,
          intensity: 0.7,
          durationMs: 1700,
          overlay: true,
          restoreTo: base,
          cooldownKey: "error",
        });
      }
      /* a recovered failure deserves a determined look, not a celebration */
      if (sinceFailMs !== null && sinceFailMs < 90_000) {
        if (ctx.cooldown("recovery") > 0) return null;
        return d("determined", "task", "recovered after a failure", {
          confidence: 0.75,
          intensity: 0.7,
          durationMs: 1800,
          overlay: true,
          restoreTo: base,
          cooldownKey: "recovery",
        });
      }
      if (event.engine && event.important && ctx.cooldown("toolok") === 0) {
        return d("relieved", "reaction", "important engine step succeeded", {
          confidence: 0.6,
          intensity: 0.5,
          durationMs: 1300,
          overlay: true,
          restoreTo: base,
          cooldownKey: "toolok",
        });
      }
      return null;
    }
    case "task-success": {
      if (event.importance === "minor") {
        if (ctx.cooldown("praise") > 0) return null;
        return d("happy", "reaction", "small task done", {
          confidence: 0.7,
          intensity: 0.45,
          durationMs: 1400,
          overlay: false,
          restoreTo: "calm",
          cooldownKey: "praise",
        });
      }
      if (event.importance === "major") {
        if (ctx.cooldown("celebration") > 0) {
          return d("proud", "context", "big task done (celebration cooling down)", {
            confidence: 0.85,
            intensity: 0.7,
            durationMs: 1700,
            overlay: false,
            restoreTo: "calm",
          });
        }
        return d("victory", "context", "major build completed", {
          confidence: 0.96,
          intensity: 0.95,
          durationMs: 1800,
          sequence: [
            { emotion: "celebrate", durationMs: 1500, tier: "context" },
            { emotion: "proud", durationMs: 1700, tier: "reaction" },
          ],
          overlay: false,
          restoreTo: "calm",
          cooldownKey: "celebration",
        });
      }
      /* normal */
      return d(activeTask === "build" ? "proud" : "delighted", "context", activeTask === "build" ? "build session wrapped up" : "task finished well", {
        confidence: 0.85,
        intensity: activeTask === "build" ? 0.75 : 0.6,
        durationMs: 1800,
        overlay: false,
        restoreTo: "calm",
        cooldownKey: "praise",
      });
    }
    case "task-fail": {
      if (ctx.cooldown("error") > 0) return null;
      return d("concerned", "context", "task needs attention", {
        confidence: 0.85,
        intensity: 0.75,
        durationMs: 2200,
        overlay: true,
        restoreTo: "calm",
        cooldownKey: "error",
      });
    }
    case "stopped":
      return d("calm", "context", "stopped, wrapping up", { confidence: 0.8, intensity: 0.5, durationMs: 2000, overlay: false, restoreTo: "idle" });

    /* ---------------- background context ---------------- */
    case "notification": {
      if (ctx.cooldown(event.severity === "warn" ? "warn" : "notification") > 0) return null;
      return d(event.severity === "warn" ? "alert" : "notification", "context", `${event.severity} notification`, {
        confidence: event.severity === "warn" ? 0.8 : 0.6,
        intensity: event.severity === "warn" ? 0.8 : 0.5,
        durationMs: event.severity === "warn" ? 2000 : 1800,
        overlay: true,
        restoreTo: base,
        cooldownKey: event.severity === "warn" ? "warn" : "notification",
      });
    }
    case "calendar": {
      if (ctx.cooldown("calendar") > 0) return null;
      if (event.sub === "missed") {
        return d("missedEvent", "context", "you missed an event", {
          confidence: 0.9,
          intensity: 0.85,
          durationMs: 2600,
          overlay: true,
          restoreTo: base,
          cooldownKey: "calendar",
        });
      }
      return d("eventSoon", "context", "event coming up soon", {
        confidence: 0.75,
        intensity: 0.6,
        durationMs: 2200,
        overlay: true,
        restoreTo: base,
        cooldownKey: "calendar",
      });
    }
    case "memory-saved":
      if (ctx.cooldown("memory") > 0) return null;
      return d("remembering", "reaction", "remembered something meaningful", {
        confidence: 0.6,
        intensity: 0.5,
        durationMs: 1600,
        overlay: true,
        restoreTo: base,
        cooldownKey: "memory",
      });
    case "network": {
      if (!event.on) {
        if (ctx.cooldown("offline") > 0) return null;
        return d("offline", "critical", "network connection lost", {
          confidence: 1,
          intensity: 1,
          durationMs: 0,
          overlay: false,
          restoreTo: base,
          cooldownKey: "offline",
        });
      }
      if (current === "offline") return d("settled", "ambient", "network is back", { confidence: 0.9, intensity: 0.4, durationMs: 1500 });
      return null;
    }
    case "system-load":
      if (ctx.cooldown("systemload") > 0) return null;
      return d("powerful", "context", "PC under heavy load", {
        confidence: 0.7,
        intensity: 0.7,
        durationMs: 2400,
        overlay: true,
        restoreTo: base,
        cooldownKey: "systemload",
      });
    case "view-change":
      if (ctx.busy || ctx.voiceEnabled) return null;
      if (ctx.cooldown("viewchange") > 0) return null;
      return d("scanning", "ambient", `looking through ${event.view}`, {
        confidence: 0.5,
        intensity: 0.4,
        durationMs: 1400,
        overlay: false,
        restoreTo: base,
        cooldownKey: "viewchange",
      });

    /* ---------------- MCP ---------------- */
    case "mcp-connecting":
      if (ctx.cooldown("mcp") > 0) return null;
      return d("attentive", "context", "engine connecting", {
        confidence: 0.7,
        intensity: 0.6,
        durationMs: 1600,
        overlay: true,
        restoreTo: base,
        cooldownKey: "mcp",
      });
    case "mcp-connected":
      if (ctx.cooldown("mcp") > 0) return null;
      return d("happy", "reaction", "engine connected", {
        confidence: 0.55,
        intensity: 0.4,
        durationMs: 1400,
        overlay: true,
        restoreTo: base,
        cooldownKey: "mcp",
      });
    case "mcp-failed":
      if (ctx.cooldown("mcperror") > 0) return null;
      return d("concerned", "context", "engine connection failed", {
        confidence: 0.85,
        intensity: 0.7,
        durationMs: 1800,
        overlay: true,
        restoreTo: base,
        cooldownKey: "mcperror",
      });

    /* ---------------- easter eggs (explicit user input = high confidence) ---------------- */
    case "play": {
      if (ctx.cooldown("play") > 0) return null;
      if (event.scene === "party") {
        return d("party", "reaction", "you typed party — it's a party now", { confidence: 0.95, intensity: 1, durationMs: 2400, cooldownKey: "play" });
      }
      return d("sleeping", "ambient", "you typed sleep — drifting off", {
        confidence: 0.95,
        intensity: 0.8,
        durationMs: 2000,
        sequence: [{ emotion: "shocked", durationMs: 1500, tier: "reaction" }],
        restoreTo: base,
        cooldownKey: "play",
      });
    }

    /* ---------------- long inactivity ---------------- */
    case "idle-stage": {
      if (ctx.busy || ctx.voiceEnabled) return null;
      if (!BASE_STATES.has(current)) return null; // mid-reaction — don't stomp
      const orderIdx = DRIFT_ORDER.indexOf(event.stage);
      const curIdx = Math.max(DRIFT_ORDER.indexOf(current), 0);
      if (orderIdx <= curIdx) return null; // already at or past this stage
      return d(event.stage, "ambient", `${event.stage} after ${Math.round(ctx.idleMs / 60000)}m away`, {
        confidence: 0.9,
        intensity: event.stage === "sleeping" ? 0.9 : 0.4,
        durationMs: 0,
      });
    }

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export interface NexEmotionApi {
  emotion: AiEmotion;
  intensity: number;
  debug: EmotionDebug | null;
  /** rich contextual event → emotion decision */
  react: (event: NexEvent) => void;
  /** plain set with engine semantics (priority, cooldown, restore) */
  set: (emotion: AiEmotion, ms?: number, reason?: string) => void;
  markActivity: () => void;
}

const IDLE_STAGE_MS: Array<{ atMs: number; stage: "calm" | "quiet" | "sleepy" | "sleeping" }> = [
  { atMs: 3 * 60_000, stage: "calm" },
  { atMs: 8 * 60_000, stage: "quiet" },
  { atMs: 14 * 60_000, stage: "sleepy" },
  { atMs: 20 * 60_000, stage: "sleeping" },
];

export function useNexEmotions({ busy, voiceEnabled }: { busy: boolean; voiceEnabled: boolean }): NexEmotionApi {
  const [emotion, setEmotion] = useState<AiEmotion>("idle");
  const [intensity, setIntensity] = useState(1);
  const [debug, setDebug] = useState<EmotionDebug | null>(null);

  const currentRef = useRef<AiEmotion>("idle");
  const baseRef = useRef<AiEmotion>("idle");
  const activeTaskRef = useRef<"chat" | "build" | "tool" | "slash" | null>(null);
  const lastTaskRef = useRef<TaskOutcome | null>(null);
  const sinceFailRef = useRef<number | null>(null);
  const cooldownsRef = useRef<Map<string, number>>(new Map());
  const historyRef = useRef<EmotionRecord[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const busyRef = useRef(busy);
  const voiceRef = useRef(voiceEnabled);
  const prevBusyRef = useRef(false);
  busyRef.current = busy;
  voiceRef.current = voiceEnabled;

  const clearTimers = () => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  };

  const cooldownLeft = (key: string): number => {
    const until = cooldownsRef.current.get(key) ?? 0;
    return Math.max(0, until - Date.now());
  };

  const stampCooldown = (key: string) => {
    cooldownsRef.current.set(key, Date.now() + (COOLDOWN_MS[key] ?? 12_000));
  };

  const setState = (next: AiEmotion, nextIntensity = 1) => {
    currentRef.current = next;
    setEmotion(next);
    setIntensity(nextIntensity);
    if (BASE_STATES.has(next) && next !== "sleeping") baseRef.current = next;
  };

  const restoreToBase = (restore?: AiEmotion) => {
    const target = restore ?? baseRef.current ?? "idle";
    setState(target);
    if (CALM_BASE.has(target) || target === "idle") baseRef.current = "idle";
  };

  /** Apply a primary emotion for its duration, then walk the sequence, then
      restore the base state. Sequential, never parallel. */
  const runTimeline = (timeline: Array<{ emotion: AiEmotion; durationMs: number; tier: EmotionTier }>, restore?: AiEmotion) => {
    if (timeline.length === 0) {
      if (restore) restoreToBase(restore);
      return;
    }
    const [first, ...rest] = timeline;
    setState(first.emotion, first.tier === "task" || first.tier === "direct" ? 1 : 0.85);
    if (first.durationMs <= 0) {
      runTimeline(rest, restore);
      return;
    }
    const t = setTimeout(() => runTimeline(rest, restore), first.durationMs);
    timersRef.current.push(t);
  };

  const setDebugSnapshot = (record: EmotionRecord, decision: EmotionDecision, restoreTo: AiEmotion) => {
    setDebug({
      ...record,
      base: restoreTo,
      overlay: decision.overlay,
      cooldowns: [...cooldownsRef.current.entries()]
        .map(([key, until]) => ({ key, leftMs: Math.max(0, until - Date.now()) }))
        .filter((c) => c.leftMs > 0)
        .slice(0, 6),
    });
  };

  const apply = (decision: EmotionDecision) => {
    if (!decision.emotion) return;
    clearTimers();

    if (decision.cooldownKey) stampCooldown(decision.cooldownKey);

    /* what to return to after the reaction/overlay ends */
    const restoreTo = decision.restoreTo ?? (BASE_STATES.has(currentRef.current) ? currentRef.current : baseRef.current);

    /* Identical emotion — the face doesn't need to change, but the pending
       restore was just cleared, so re-arm it and refresh the debug readout.
       (Task "working" repeats are cheap and safe.) */
    if (decision.emotion === currentRef.current && decision.tier !== "critical") {
      if (decision.durationMs > 0) {
        const t = setTimeout(() => restoreToBase(restoreTo), decision.durationMs);
        timersRef.current.push(t);
      } else if (decision.overlay) {
        const t = setTimeout(() => restoreToBase(restoreTo), 2200);
        timersRef.current.push(t);
      }
      setDebugSnapshot(
        {
          emotion: decision.emotion,
          ts: Date.now(),
          reason: decision.reason,
          confidence: decision.confidence,
          priority: PRIORITY[decision.tier],
          intensity: decision.intensity,
          durationMs: decision.durationMs,
        },
        decision,
        restoreTo,
      );
      return;
    }

    const record: EmotionRecord = {
      emotion: decision.emotion,
      ts: Date.now(),
      reason: decision.reason,
      confidence: decision.confidence,
      priority: PRIORITY[decision.tier],
      intensity: decision.intensity,
      durationMs: decision.durationMs,
    };
    historyRef.current = [...historyRef.current, record].slice(-12);

    if (decision.sequence) {
      runTimeline(
        [{ emotion: decision.emotion, durationMs: decision.durationMs, tier: decision.tier }, ...decision.sequence],
        restoreTo,
      );
      setDebugSnapshot(record, decision, restoreTo);
      return;
    }

    setState(decision.emotion, decision.intensity);

    if (decision.durationMs > 0) {
      const t = setTimeout(() => restoreToBase(restoreTo), decision.durationMs);
      timersRef.current.push(t);
    } else if (decision.overlay) {
      /* held overlay without an explicit duration — treat as one beat */
      const t = setTimeout(() => restoreToBase(restoreTo), 2200);
      timersRef.current.push(t);
    }

    setDebugSnapshot(record, decision, restoreTo);
  };

  /* Build the context for a decision from refs, then apply. */
  const react = useCallback((event: NexEvent) => {
    const ctx: EmotionCtx = {
      current: currentRef.current,
      base: baseRef.current,
      busy: busyRef.current,
      voiceEnabled: voiceRef.current,
      idleMs: Date.now() - lastActivityRef.current,
      activeTask: activeTaskRef.current,
      lastTaskDone: lastTaskRef.current,
      sinceFailMs: sinceFailRef.current,
      cooldown: cooldownLeft,
      history: historyRef.current,
    };

    const decision = decide(event, ctx);
    if (!decision || !decision.emotion) return;

    /* background events never run while Nex is busy working */
    if (busyRef.current && BACKGROUND_EVENTS.has(event.kind)) return;
    /* ambient drift never runs while busy either */
    if (busyRef.current && decision.tier === "ambient") return;

    apply(decision);
  }, []);

  /* Keep continuity refs in sync with the events that change them. */
  const reactTracked = useCallback(
    (event: NexEvent) => {
      if (event.kind === "task-start") {
        activeTaskRef.current = event.task;
        sinceFailRef.current = null;
      } else if (event.kind === "tool-result") {
        sinceFailRef.current = event.ok ? null : Date.now();
      } else if (event.kind === "task-success" || event.kind === "task-fail") {
        lastTaskRef.current = {
          ok: event.kind === "task-success",
          importance: event.kind === "task-success" ? event.importance : "normal",
          task: activeTaskRef.current,
          ts: Date.now(),
        };
        if (event.kind === "task-fail") sinceFailRef.current = Date.now();
      } else if (event.kind === "user-said" || event.kind === "voice-command") {
        lastActivityRef.current = Date.now();
      }
      react(event);
    },
    [react],
  );

  /* Busy just ended: if Nex is stuck on a work state, settle calmly. */
  useEffect(() => {
    if (busy || !prevBusyRef.current) return;
    const cur = currentRef.current;
    /* Don't yank the eyes out of a live audio state right as a voice reply
       starts — speaking/listening are driven by their own TTS/recognition
       events and should end on their own. Only calm lingering *work* states. */
    if (cur === "speaking" || cur === "listening") return;
    if (BASE_STATES.has(cur) && !CALM_BASE.has(cur)) {
      const t1 = setTimeout(() => {
        setState("calm");
        const t2 = setTimeout(() => restoreToBase("idle"), 1900);
        timersRef.current.push(t2);
      }, 350);
      timersRef.current.push(t1);
    }
  }, [busy]);

  useEffect(() => {
    prevBusyRef.current = busy;
  }, [busy]);

  /* Idle ladder — only when the user is genuinely away. */
  useEffect(() => {
    const timer = setInterval(() => {
      if (busyRef.current || voiceRef.current) return;
      const idleMs = Date.now() - lastActivityRef.current;
      let stage: "calm" | "quiet" | "sleepy" | "sleeping" | null = null;
      for (const s of IDLE_STAGE_MS) {
        if (idleMs >= s.atMs) stage = s.stage;
      }
      if (!stage) return;
      const cur = currentRef.current;
      if (!BASE_STATES.has(cur)) return; // mid-reaction — let it finish
      react({ kind: "idle-stage", stage });
    }, 15_000);
    return () => clearInterval(timer);
  }, [react]);

  /* Any real interaction cancels the drift. */
  useEffect(() => {
    const mark = () => {
      const wasDrifting = DRIFT_STATES.has(currentRef.current);
      lastActivityRef.current = Date.now();
      if (wasDrifting && !busyRef.current && !voiceRef.current) {
        clearTimers();
        setState("awake");
        const t = setTimeout(() => restoreToBase("idle"), 1500);
        timersRef.current.push(t);
      }
    };
    window.addEventListener("pointermove", mark, { passive: true });
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    window.addEventListener("touchstart", mark, { passive: true });
    return () => {
      window.removeEventListener("pointermove", mark);
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
      window.removeEventListener("touchstart", mark);
    };
  }, []);

  const set = useCallback((next: AiEmotion, ms?: number, reason?: string) => {
    react({ kind: "direct", emotion: next, ms, reason });
  }, [react]);

  return {
    emotion,
    intensity,
    debug,
    react: reactTracked,
    set,
    markActivity: useCallback(() => {
      lastActivityRef.current = Date.now();
    }, []),
  };
}