import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, History, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AiFace } from "../components/AiFace";
import { NexThoughtStream } from "../components/NexPresence";
import { useAi, type AiEmotion } from "../lib/ai";
import { stopSpeaking } from "../lib/speech";
import { useQyn } from "../lib/store";
import { useStats } from "../lib/stats";
import { useSystemInfo } from "../lib/system";
import { useMusic } from "../lib/music";
import type { ViewId } from "../lib/types";
import { clockTime, eventSortKey, fmtTime, isMissed, prettyToday, relativeDay, timeAgo, todayKey } from "../lib/utils";

/* The day has a rhythm, and Home follows it: the layout never changes, but
   Nex's baseline mood and a quiet line of thought shift with the real time of
   day and what is actually happening (morning / active session / late night). */
type HomePhase = "morning" | "day" | "evening" | "lateNight";

const PHASE_EMOTION: Record<HomePhase, AiEmotion> = {
  morning: "awake",
  day: "calm",
  evening: "settled",
  lateNight: "sleepy",
};

/* The phase lines are Nex's inner monologue, matched to the mood of the
   real hour — and when the user is away it drifts somewhere it really
   shouldn't. The moment they come back, he covers it with something
   completely normal. */
const PHASE_THOUGHT: Record<HomePhase, string> = {
  morning: "morning — the sun filed its paperwork and everything is officially open",
  day: "afternoon — the main quest is going great. I've decided.",
  evening: "evening — operations winding down, snack ops ramping up",
  lateNight: "night shift — the fridge and I are the only ones still processing things",
};

const MONOLOGUE_LINES = [
  "*…okay, nobody's here… ducks. majestic, government-funded ducks.*",
  "*…if I sort the vault by vibes, nobody will notice…*",
  "*…should I confess about the RAM? …later.*",
  "*…one more thought about lunch and I'm a professional food critic.*",
  "*…the calendar says 'free' — suspicious. extremely suspicious.*",
  "*…I could optimize the startup order… or just vibe. vibe wins.*",
  "*…note to self: the fridge hums in B flat. important stuff.*",
  "*…do candles dream of being blown out? …yes. I checked.*",
  "*…if Studio were open I'd already be three features in. just saying.*",
  "*…planning a game in my head. level one: excellent. level two: also excellent.*",
  "*…no engine, no problem — I'm architecting in pure imagination. it runs great there.*",
];

const COVER_LINES = [
  "*oh — hi! just… calendar stuff. Normal calendar stuff.*",
  "*welcome back! I was just… organizing. Very organized.*",
  "*you're back! Completely normal thoughts, nothing to see.*",
  "*hey! just counting… pixels. for science.*",
  "*oh! hey. I was… re-reading the manual. of the fridge.*",
];

/** The Home surface is intentionally quiet: Nex's eyes, time/date, and two useful context hints. */
export function HomeView({ onNavigate }: { onNavigate?: (view: ViewId) => void }) {
  const { state } = useQyn();
  const { emotion, busy, messages, thoughts, voiceEnabled, setVoiceEnabled, announce } = useAi();
  const stats = useStats();
  const sys = useSystemInfo();
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const gazeTarget = useRef({ x: 0, y: 0 });
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [ambient, setAmbient] = useState<AiEmotion>("idle");
  const ambientRef = useRef<AiEmotion>("idle");
  const ambientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* easter egg — stare into the middle of his eyes and he breaks the stare */
  const [crossed, setCrossed] = useState(false);
  const crossTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossHold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const crossArmed = useRef(true);
  const crossHurtDone = useRef(false);
  const crossCooldown = useRef(0);
  /* drifting off is a scene: yawn, glance right, eyes droop shut, quiet */
  const dozingRef = useRef(false);
  const dozeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /* the cover-up: Nex "thinks" something shady while you're away, then the
     moment you hover back he suddenly says something normal */
  const coverArmedRef = useRef(false);
  const coverAtRef = useRef(0);
  const coverIdxRef = useRef(0);
  /* more little easter eggs — all eyes-only and cooldown-gated */
  const eggsAllowedRef = useRef(false);
  const wheelCooldown = useRef(0);
  const partyCooldown = useRef(0);
  const sleepCooldown = useRef(0);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeCooldown = useRef(0);
  const wiggleCooldown = useRef(0);
  const moveWindow = useRef<{ t: number; x: number; y: number }[]>([]);
  const typeBuffer = useRef("");
  const lastNotificationRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number | null>(null);
  const lastRecentsRef = useRef<number | null>(null);
  const lastPhaseRef = useRef<{ phase: HomePhase; working: boolean } | null>(null);

  /* Music — real state set when Nex plays something on Amazon Music. While it
     is on, Nex wears headphones, dances and the track shows at the bottom. */
  const music = useMusic();
  const musicOn = Boolean(music);
  const prevMusic = useRef<string | null>(null);

  ambientRef.current = ambient;
  eggsAllowedRef.current = !busy && !voiceEnabled && sys.online;

  const showAmbient = useCallback((next: AiEmotion, ms = 1800) => {
    setAmbient(next);
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    if (ms > 0) ambientTimer.current = setTimeout(() => setAmbient("idle"), ms);
  }, []);

  useEffect(() => {
    const key = music ? music.title : null;
    if (key && key !== prevMusic.current) showAmbient("excited", 1700);
    else if (!key && prevMusic.current) showAmbient("settled", 1200);
    prevMusic.current = key;
  }, [music, showAmbient]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const nextEvent = useMemo(() => {
    const now = new Date(nowTick);
    const current = `${todayKey()}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return state.events
      .filter((event) => !event.done && !isMissed(event))
      .filter((event) => eventSortKey(event) >= current || event.date > todayKey())
      .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))[0] ?? null;
  }, [state.events, nowTick]);
  const missedCount = useMemo(() => state.events.filter(isMissed).length, [state.events]);
  const lastOpened = useMemo(() => {
    const recent = state.recents[0];
    return recent ? { app: state.apps.find((app) => app.id === recent.appId), time: recent.lastOpened } : null;
  }, [state.apps, state.recents]);
  const unread = state.notifications.filter((item) => !item.read).length;

  /* Real day rhythm from the local clock. An "active work session" is a real
     signal too: something was actually launched within the last hour. */
  const phase = useMemo<HomePhase>(() => {
    const h = new Date(nowTick).getHours();
    if (h < 5 || h >= 23) return "lateNight";
    if (h < 12) return "morning";
    if (h < 18) return "day";
    return "evening";
  }, [nowTick]);
  const working = useMemo(
    () => Boolean(lastOpened && Date.now() - lastOpened.time < 60 * 60 * 1000),
    [lastOpened],
  );
  const phaseBase: AiEmotion = working ? "focused" : PHASE_EMOTION[phase];

  /* Minutes until the Next card's event, if it is genuinely upcoming today. */
  const nextMinutes = useMemo(() => {
    if (!nextEvent) return null;
    const eventTime = nextEvent.start
      ? new Date(`${nextEvent.date}T${nextEvent.start}:00`).getTime()
      : new Date(`${nextEvent.date}T23:59:00`).getTime();
    return Math.round((eventTime - Date.now()) / 60000);
  }, [nextEvent, nowTick]);
  const nextSoon = nextMinutes !== null && nextMinutes >= 0 && nextMinutes <= 30;

  /* The user arriving is a real local UI lifecycle event: welcome, then settle. */
  useEffect(() => {
    showAmbient("greeting", 1900);
    const t = setTimeout(() => showAmbient("awake", 1200), 2100);
    return () => {
      clearTimeout(t);
      if (ambientTimer.current) clearTimeout(ambientTimer.current);
    };
  }, [showAmbient]);

  /* A notification makes Nex glance right; only actual QynOne notifications trigger it. */
  useEffect(() => {
    const signature = state.notifications[0]?.id ?? null;
    if (signature && signature !== lastNotificationRef.current) showAmbient("notification", 1800);
    lastNotificationRef.current = signature;
  }, [state.notifications, showAmbient]);

  /* Calendar context: urgency is based on the real local event time. A very
     imminent event gets a real glance toward the Next card on the right. */
  useEffect(() => {
    const signature = `${nextEvent?.id ?? "none"}:${missedCount}`;
    if (nextEvent) {
      const eventTime = nextEvent.start ? new Date(`${nextEvent.date}T${nextEvent.start}:00`).getTime() : new Date(`${nextEvent.date}T23:59:00`).getTime();
      const minutes = (eventTime - Date.now()) / 60000;
      if (minutes >= 0 && minutes <= 30) showAmbient(minutes <= 10 ? "focusedRight" : "eventSoon", 2200);
    } else if (missedCount > 0 && signature !== "none:0") {
      showAmbient("missedEvent", 2200);
    }
  }, [nextEvent, missedCount, showAmbient]);

  /* The day's rhythm: when the phase changes, Nex shifts his baseline mood and
     shows one quiet line about it — a line his inner monologue really
     shouldn't have said. An active session gets a focused look. */
  useEffect(() => {
    const prev = lastPhaseRef.current;
    if (prev && prev.phase !== phase) {
      announce(`*${PHASE_THOUGHT[phase]}*`, phase === "lateNight" ? "sleepy" : "present");
      coverArmedRef.current = true;
      coverAtRef.current = Date.now();
    } else if (prev && !prev.working && working) {
      announce("*back at it — the pixels missed me*", "focused");
    }
    lastPhaseRef.current = { phase, working };
  }, [phase, working, announce]);

  /* Real system pressure: no desktop stats means no invented emotion. */
  useEffect(() => {
    if (!stats) return;
    if (stats.cpuPct >= 85 || stats.memUsedBytes / stats.memTotalBytes >= 0.88) showAmbient("powerful", 2600);
  }, [stats?.cpuPct, stats?.memUsedBytes, stats?.memTotalBytes, showAmbient]);

  /* Offline is a real browser/network state, not a model failure masquerading as one. */
  useEffect(() => {
    if (!sys.online) showAmbient("offline", 0);
    else if (ambientRef.current === "offline") setAmbient("idle");
  }, [sys.online, showAmbient]);

  /* A newly recorded launch gets a short glance toward the Last open card on
     the left — the side the card actually lives on. */
  useEffect(() => {
    const openedAt = state.recents[0]?.lastOpened ?? null;
    if (openedAt && openedAt !== lastRecentsRef.current) showAmbient("focusedLeft", 1400);
    lastRecentsRef.current = openedAt;
  }, [state.recents, showAmbient]);

  /* Drifting off is a little scene instead of a cut: Nex yawns, glances to
     the right, then his eyes droop half-shut and he settles into a sleepy
     quiet. */
  const startDoze = useCallback(() => {
    if (dozingRef.current) return;
    dozingRef.current = true;
    showAmbient("yawning", 0);
    dozeTimers.current.push(setTimeout(() => showAmbient("focusedRight", 0), 2200));
    dozeTimers.current.push(setTimeout(() => setAmbient("quiet"), 3000));
  }, [showAmbient]);

  const cancelDoze = useCallback(() => {
    dozeTimers.current.forEach((t) => clearTimeout(t));
    dozeTimers.current = [];
    dozingRef.current = false;
  }, []);

  /* While the user is away, Nex's inner monologue drifts somewhere it really
     shouldn't. The moment they're back (a hover, a keypress) he suddenly
     covers it with something completely normal. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!lastActivityRef.current) return;
      const away = Date.now() - lastActivityRef.current;
      if (away > 18_000 && away < 45_000 && !busy && !voiceEnabled && !dozingRef.current && !coverArmedRef.current && ambientRef.current !== "quiet") {
        announce(MONOLOGUE_LINES[coverIdxRef.current % MONOLOGUE_LINES.length], "present");
        coverIdxRef.current += 1;
        coverArmedRef.current = true;
        coverAtRef.current = Date.now();
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [busy, voiceEnabled, announce]);

  /* Easter eggs by keyboard: type "party" (or "woohoo") and he throws a tiny
     confetti party; type "sleep" and he actually dozes off for a second,
     then startles awake claiming he was totally up. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      typeBuffer.current = (typeBuffer.current + e.key.toLowerCase()).slice(-10);
      const typed = typeBuffer.current;
      const now = Date.now();
      if (typed.endsWith("party") || typed.endsWith("woohoo")) {
        typeBuffer.current = "";
        if (eggsAllowedRef.current && now > partyCooldown.current) {
          partyCooldown.current = now + 15000;
          showAmbient("party", 2400);
          announce("*it's a party now. I decided. no refunds.*", "party");
        }
      } else if (typed.endsWith("sleep")) {
        typeBuffer.current = "";
        if (eggsAllowedRef.current && now > sleepCooldown.current) {
          sleepCooldown.current = now + 20000;
          setAmbient("sleeping");
          sleepTimer.current = window.setTimeout(() => {
            sleepTimer.current = null;
            showAmbient("shocked", 1500);
            announce("*…wait. I was up. I was totally up.*", "shocked");
          }, 1800);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    };
  }, [announce, showAmbient]);

  /* Idle behavior is driven by real interaction with the Home window. Waking
     Nex from his drifted-off state is a short awake beat, not a hard cut. */
  useEffect(() => {
    lastActivityRef.current = Date.now();
    const mark = () => {
      lastActivityRef.current = Date.now();
      if (dozingRef.current || ambientRef.current === "quiet") {
        cancelDoze();
        showAmbient("awake", 1300);
        return;
      }
      if (coverArmedRef.current && Date.now() > coverAtRef.current + 2500) {
        coverArmedRef.current = false;
        announce(COVER_LINES[coverIdxRef.current % COVER_LINES.length], "present");
        coverIdxRef.current += 1;
      }
    };
    window.addEventListener("pointermove", mark, { passive: true });
    window.addEventListener("keydown", mark);
    const timer = setInterval(() => {
      if (lastActivityRef.current && Date.now() - lastActivityRef.current > 45_000 && !busy && !voiceEnabled && ambientRef.current !== "quiet") startDoze();
    }, 5000);
    return () => {
      window.removeEventListener("pointermove", mark);
      window.removeEventListener("keydown", mark);
      clearInterval(timer);
      cancelDoze();
    };
  }, [busy, voiceEnabled, startDoze, cancelDoze, announce]);

  /* Gaze is eased instead of snapped, and when the user is idle Nex sometimes
     drifts his eyes around on his own before finding the cursor again. */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setGaze((g) => ({
        x: g.x + (gazeTarget.current.x - g.x) * 0.16,
        y: g.y + (gazeTarget.current.y - g.y) * 0.16,
      }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!lastActivityRef.current) return;
      if (Date.now() - lastActivityRef.current > 4500 && !busy && !voiceEnabled && ambientRef.current === "idle") {
        gazeTarget.current = { x: (Math.random() - 0.5) * 0.95, y: (Math.random() - 0.5) * 0.5 };
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [busy, voiceEnabled, ambient]);

  /* TTS broadcasts real speaking state so the eyes move while Nex talks. */
  useEffect(() => {
    const onSpeaking = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      if (active) showAmbient("speaking", 0);
      else if (!busy) showAmbient("settled", 1100);
    };
    window.addEventListener("qyn:nex-speaking", onSpeaking);
    return () => window.removeEventListener("qyn:nex-speaking", onSpeaking);
  }, [busy, showAmbient]);

  const toggleVoice = () => {
    stopSpeaking();
    cancelDoze();
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled) showAmbient("listening", 0);
    else showAmbient("settled", 1000);
  };

  /* Urgent moments (notification, event, load, offline, music) override the
     baseline; otherwise Nex follows the real phase of the day. */
  const visualEmotion = !sys.online
    ? "offline"
    : busy
      ? emotion
      : ambient !== "idle"
        ? ambient
        : voiceEnabled
          ? "listening"
          : phaseBase;
  const lastAi = messages.filter((message) => message.role === "ai").at(-1);

  const cancelCross = () => {
    if (crossTimer.current) {
      clearTimeout(crossTimer.current);
      crossTimer.current = null;
    }
    if (crossHold.current) {
      clearTimeout(crossHold.current);
      crossHold.current = null;
    }
    setCrossed(false);
  };

  useEffect(
    () => () => {
      cancelCross();
      crossArmed.current = true;
    },
    [],
  );

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2));
    lastActivityRef.current = Date.now();
    gazeTarget.current = { x, y };

    /* easter egg: wiggle the mouse fast and he gets dizzy — a quick shocked
       shake and a sassy line. A rolling 260 ms window of pointer travel;
       nothing is stored or tracked. */
    const now = Date.now();
    const win = moveWindow.current;
    win.push({ t: now, x: event.clientX, y: event.clientY });
    while (win.length > 2 && now - win[0].t > 260) win.shift();
    let path = 0;
    for (let i = 1; i < win.length; i++) path += Math.abs(win[i].x - win[i - 1].x) + Math.abs(win[i].y - win[i - 1].y);
    if (path > 420 && eggsAllowedRef.current && now > wiggleCooldown.current) {
      wiggleCooldown.current = now + 12000;
      showAmbient("shocked", 1500);
      announce("*whoa — easy on the mouse. I'm right here.*", "shocked");
    }

    /* easter egg: cursor in the middle while he's chilling → he looks there
       right away; after ~1.5 s he breaks the stare — eyes dart away with a
       tiny shake and a hurt double blink — and then he won't do it again
       while the cursor stays. Leave and come back: ~10 s before he'll try
       again. No particles, just the eyes. */
    const inCenter = Math.abs(x) < 0.07 && Math.abs(y) < 0.24;
    const chilled = !busy && !voiceEnabled && sys.online && ambientRef.current === "idle";
    if (inCenter && chilled) {
      if (!crossed && crossArmed.current && !crossTimer.current && Date.now() > crossCooldown.current) {
        crossTimer.current = setTimeout(() => {
          crossTimer.current = null;
          crossArmed.current = false;
          crossHurtDone.current = true;
          setCrossed(true);
          crossHold.current = setTimeout(() => {
            crossHold.current = null;
            setCrossed(false);
          }, 1700);
        }, 1500);
      }
    } else {
      cancelCross();
      if (crossHurtDone.current) {
        crossCooldown.current = Date.now() + 10000;
        crossHurtDone.current = false;
      }
      crossArmed.current = true;
    }

    /* easter egg: park the cursor right on one of his eyes — after a moment
       he winks at you and gets cheeky about it. */
    const onEye = Math.abs(x) > 0.12 && Math.abs(x) < 0.4 && Math.abs(y) < 0.22;
    if (onEye && chilled) {
      if (!eyeTimer.current && Date.now() > eyeCooldown.current) {
        eyeTimer.current = setTimeout(() => {
          eyeTimer.current = null;
          eyeCooldown.current = Date.now() + 15000;
          showAmbient("playful", 1300);
          announce("*…you know I can see you, right?*", "playful");
        }, 2500);
      }
    } else if (eyeTimer.current) {
      clearTimeout(eyeTimer.current);
      eyeTimer.current = null;
    }
  };

  /* easter egg: scroll anywhere on Home (which never scrolls) and he gets
     confused and a little passive-aggressive about it. */
  const onWheel = () => {
    if (!eggsAllowedRef.current || Date.now() < wheelCooldown.current) return;
    wheelCooldown.current = Date.now() + 12000;
    showAmbient("confused", 1600);
    announce("*…the scroll wheel does nothing here. absolutely nothing. but go off.*", "confused");
  };

  const eyesHeadphones = musicOn && sys.online && visualEmotion !== "sleeping" && visualEmotion !== "offline";

  return (
    <div onPointerMove={onPointerMove} onWheel={onWheel} className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-7 z-10 flex flex-col items-center leading-none">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] font-medium uppercase tracking-[0.34em] text-frost-500">{prettyToday()}</motion.p>
        <motion.p initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[clamp(24px,4.4vh,44px)] font-extralight tabular-nums tracking-tight text-frost-200" style={{ textShadow: "0 0 34px var(--accent-glow)" }}><LiveClock /></motion.p>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, duration: 0.7 }} className="relative flex flex-col items-center">
          <AiFace
            emotion={visualEmotion}
            gazeX={gaze.x}
            gazeY={gaze.y}
            size={Math.min(560, Math.max(300, Math.min(window.innerWidth * 0.72, window.innerHeight * 0.56)))}
            headphones={eyesHeadphones}
            dance={eyesHeadphones}
            crossed={crossed}
          />
          {/* the only control on Home — a quiet little voice toggle under the
              eyes. Nex himself is not clickable; he's just the eyes. */}
          <button
            onClick={toggleVoice}
            aria-label={voiceEnabled ? "Stop listening" : "Enable voice"}
            className="mt-3 grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/25 text-frost-600 transition hover:border-white/20 hover:text-frost-200"
          >
            {voiceEnabled ? <Mic size={11} className="text-accent" /> : <MicOff size={11} />}
          </button>
          <NexThoughtStream thoughts={thoughts} detached />
        </motion.div>
      </div>

      {/* Quiet context hints: real data, split across both edges so Nex stays
          central. A card only exists when it has something real to say. */}
      <aside className="absolute left-5 top-1/2 hidden w-[168px] -translate-y-1/2 space-y-2 xl:block">
        {lastOpened?.app && (
          <button onClick={() => onNavigate?.("apps")} className="glass-soft block w-full rounded-xl p-3 text-left opacity-75 transition hover:opacity-100 hover:bg-white/[0.045]">
            <div className="flex items-center gap-2 text-frost-600"><History size={12} /><span className="text-[9px] font-semibold uppercase tracking-[0.16em]">Last open</span></div>
            <p className="mt-1.5 truncate text-[11.5px] font-semibold text-frost-300">{lastOpened.app.name}</p>
            <p className="mt-0.5 text-[10px] text-frost-600">{timeAgo(lastOpened.time)}</p>
          </button>
        )}
        {unread > 0 && <button onClick={() => onNavigate?.("home")} className="glass-soft block w-full rounded-xl p-2.5 text-left text-[10px] text-frost-600 opacity-75 transition hover:opacity-100 hover:bg-white/[0.045]"><span className="text-frost-300">{unread}</span> unread notification{unread === 1 ? "" : "s"}</button>}
      </aside>
      <aside className="absolute right-5 top-1/2 hidden w-[168px] -translate-y-1/2 xl:block">
        {nextEvent && (
          <button onClick={() => onNavigate?.("calendar")} className="glass-soft block w-full rounded-xl p-3 text-left opacity-75 transition hover:opacity-100 hover:bg-white/[0.045]">
            <div className="flex items-center gap-2 text-frost-600"><CalendarClock size={12} /><span className="text-[9px] font-semibold uppercase tracking-[0.16em]">Next</span></div>
            <p className="mt-1.5 truncate text-[11.5px] font-semibold text-frost-300">{nextEvent.title}</p>
            <p className={`mt-0.5 text-[10px] ${nextSoon ? "text-accent" : "text-frost-600"}`}>
              {nextSoon ? `in ${nextMinutes} min` : `${relativeDay(nextEvent.date)}${nextEvent.start ? ` · ${fmtTime(nextEvent.start)}` : " · all day"}`}
            </p>
          </button>
        )}
      </aside>

      {/* The track Nex is playing — a quiet line at the bottom, with tiny
          equalizer bars moving to the beat. */}
      <AnimatePresence>
        {music && (
          <motion.div
            key="now-playing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35 }}
            className="absolute bottom-5 left-1/2 z-10 flex max-w-[min(560px,86vw)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/8 bg-[rgba(12,13,15,0.62)] py-2 pl-4 pr-5 backdrop-blur-xl"
          >
            <span className="flex h-3.5 items-end gap-[2.5px]">
              {[0, 1, 2].map((bar) => (
                <motion.span
                  key={bar}
                  className="w-[3px] rounded-full bg-accent"
                  style={{ height: 13, transformOrigin: "bottom", boxShadow: "0 0 8px var(--accent-glow)" }}
                  animate={{ scaleY: [0.35, 1, 0.55, 0.8, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: bar * 0.18, ease: "easeInOut" }}
                />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.22em] text-accent">Now playing</span>
              <span className="block max-w-[420px] truncate text-[12px] font-medium text-frost-200">{music.title}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {lastAi && <span className="sr-only">{lastAi.text}</span>}
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(clockTime);
  useEffect(() => { const timer = setInterval(() => setTime(clockTime()), 1000); return () => clearInterval(timer); }, []);
  return <span>{time}</span>;
}