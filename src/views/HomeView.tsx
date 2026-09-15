import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AiFace } from "../components/AiFace";
import { NexThoughtStream } from "../components/NexPresence";
import { useAi, type AiEmotion } from "../lib/ai";
import { CALM_BASE } from "../lib/emotion";
import { stopSpeaking } from "../lib/speech";
import { useMusic } from "../lib/music";
import { useSystemInfo } from "../lib/system";
import { prettyToday, clockTime } from "../lib/utils";

/* The day has a rhythm, and Home follows it: the layout never changes, but
   Nex's baseline mood shifts with the real time of day. */
type HomePhase = "morning" | "day" | "evening" | "lateNight";

const PHASE_EMOTION: Record<HomePhase, AiEmotion> = {
  morning: "awake",
  day: "calm",
  evening: "settled",
  lateNight: "sleepy",
};

function currentPhase(hour: number): HomePhase {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 18) return "day";
  if (hour >= 18 && hour < 23) return "evening";
  return "lateNight";
}

/* The monologue: Nex's inner voice drifts somewhere it really shouldn't while
   the user is away. The moment they come back, he covers with something
   completely normal. */
const MONOLOGUE_LINES = [
  "*…okay, nobody's here… ducks. majestic, government-funded ducks.*",
  "*…if I sort the engines by vibes, nobody will notice…*",
  "*…should I confess about the RAM? …later.*",
  "*…one more thought about lunch and I'm a professional food critic.*",
  "*…the studio's MCP says 'ready' — suspicious. extremely suspicious.*",
  "*…I could optimize the build order… or just vibe. vibe wins.*",
  "*…note to self: the fridge hums in B flat. important stuff.*",
  "*…do candles dream of being blown out? …yes. I checked.*",
  "*…if Studio were open I'd already be three features in. just saying.*",
  "*…planning a game in my head. level one: excellent. level two: also excellent.*",
  "*…no engine, no problem — I'm architecting in pure imagination. it runs great there.*",
];

const COVER_LINES = [
  "*oh — hi! just… engine stuff. Normal engine stuff.*",
  "*welcome back! I was just… organizing. Very organized.*",
  "*you're back! Completely normal thoughts, nothing to see.*",
  "*hey! just counting… pixels. for science.*",
  "*oh! hey. I was… re-reading the manual. of the fridge.*",
];

/** The Home surface is intentionally quiet: Nex's eyes, time/date and one
    voice toggle. Everything else lives in the Nex workshop. */
export function HomeView() {
  const { emotion, busy, voiceEnabled, setVoiceEnabled, announce, react, thoughts, intensity: emotionIntensity } = useAi();
  const sys = useSystemInfo();
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const gazeTarget = useRef({ x: 0, y: 0 });
  const [ambient, setAmbient] = useState<AiEmotion>("idle");
  const ambientRef = useRef<AiEmotion>("idle");
  const ambientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState(() => currentPhase(new Date().getHours()));
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
  /* the cover-up: Nex "thinks" something shady while you're away */
  const coverArmedRef = useRef(false);
  const coverAtRef = useRef(0);
  const coverIdxRef = useRef(0);
  /* more little easter eggs — all eyes-only and cooldown-gated */
  const lastActivityRef = useRef<number>(Date.now());
  const eggsAllowedRef = useRef(false);
  const wheelCooldown = useRef(0);
  const partyCooldown = useRef(0);
  const sleepCooldown = useRef(0);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typeBuffer = useRef("");
  const eyeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eyeCooldown = useRef(0);
  const wiggleCooldown = useRef(0);
  const moveWindow = useRef<{ t: number; x: number; y: number }[]>([]);

  /* Music — real state set when Nex plays something on Amazon Music. While it
     is on, Nex wears headphones, dances and the track shows at the bottom. */
  const music = useMusic();
  const prevMusic = useRef<string | null>(null);

  ambientRef.current = ambient;
  eggsAllowedRef.current = !busy && !voiceEnabled && sys.online;

  const showAmbient = useCallback((next: AiEmotion, ms = 1800) => {
    setAmbient(next);
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    if (ms > 0) ambientTimer.current = setTimeout(() => setAmbient("idle"), ms);
  }, []);

  /* Music start/stop is a real event: Nex lights up, then settles. */
  useEffect(() => {
    const key = music ? music.title : null;
    if (key && key !== prevMusic.current) showAmbient("excited", 1700);
    else if (!key && prevMusic.current) showAmbient("settled", 1200);
    prevMusic.current = key;
  }, [music, showAmbient]);

  /* The user arriving is a real local UI lifecycle event: welcome, then settle. */
  useEffect(() => {
    showAmbient("greeting", 1900);
    const t = setTimeout(() => showAmbient("awake", 1200), 2100);
    return () => {
      clearTimeout(t);
      if (ambientTimer.current) clearTimeout(ambientTimer.current);
    };
  }, [showAmbient]);

  /* Offline is a real browser/network state, not a model failure. */
  useEffect(() => {
    if (!sys.online) showAmbient("offline", 0);
    else if (ambientRef.current === "offline") setAmbient("idle");
  }, [sys.online, showAmbient]);

  /* The phase follows the real clock. */
  useEffect(() => {
    const t = setInterval(() => setPhase(currentPhase(new Date().getHours())), 60_000);
    return () => clearInterval(t);
  }, []);

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
          react({ kind: "play", scene: "party" });
          announce("*it's a party now. I decided. no refunds.*", "party");
        }
      } else if (typed.endsWith("sleep")) {
        typeBuffer.current = "";
        if (eggsAllowedRef.current && now > sleepCooldown.current) {
          sleepCooldown.current = now + 20000;
          setAmbient("sleeping");
          react({ kind: "play", scene: "sleep" });
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
  }, [announce, showAmbient, react]);

  /* Idle behavior is driven by real interaction with the Home window. Waking
     Nex from his drifted-off state is a short awake beat, not a hard cut. */
  useEffect(() => {
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

  /* Urgent moments (build, voice, offline, music) override the baseline;
     otherwise Nex follows the real phase of the day. The provider's emotion
     surfaces whenever it means something real — a finished build, a reaction —
     while calm base states stay invisible so Home's own ambient keeps the
     lead. */
  const providerMeaningful = busy || !CALM_BASE.has(emotion);
  const visualEmotion = !sys.online
    ? "offline"
    : providerMeaningful
      ? emotion
      : ambient !== "idle"
        ? ambient
        : voiceEnabled
          ? "listening"
          : PHASE_EMOTION[phase];

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

  const eyesHeadphones = Boolean(music) && sys.online && visualEmotion !== "sleeping" && visualEmotion !== "offline";

  return (
    <div onPointerMove={onPointerMove} onWheel={onWheel} className="relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* time + date — quiet, above the eyes */}
      <div className="pointer-events-none absolute inset-x-0 top-7 z-10 flex flex-col items-center leading-none">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} className="text-[11px] font-medium uppercase tracking-[0.34em] text-frost-500">{prettyToday()}</motion.p>
        <motion.p initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="mt-2 text-[clamp(24px,4.4vh,44px)] font-extralight tabular-nums tracking-tight text-frost-200" style={{ textShadow: "0 0 34px var(--accent-glow)" }}><LiveClock /></motion.p>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-5">
        <motion.div initial={{ opacity: 0, scale: 0.94, filter: "blur(6px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="relative flex flex-col items-center">
          {/* the eyes float on their own slow rhythm — alive even at rest */}
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            <AiFace
              emotion={visualEmotion}
              gazeX={gaze.x}
              gazeY={gaze.y}
              size={Math.min(520, Math.max(280, Math.min(window.innerWidth * 0.62, window.innerHeight * 0.5)))}
              headphones={eyesHeadphones}
              dance={eyesHeadphones}
              crossed={crossed}
              intensity={providerMeaningful ? emotionIntensity : 1}
            />
            {/* the only control on Home — a quiet little voice toggle under
                the eyes. Nex himself is not clickable; he's just the eyes. */}
            <button
              onClick={toggleVoice}
              aria-label={voiceEnabled ? "Stop listening" : "Enable voice"}
              className="mt-4 grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/25 text-frost-600 transition-all duration-300 hover:scale-110 hover:border-white/20 hover:text-frost-200"
            >
              {voiceEnabled ? <Mic size={12} className="text-accent" /> : <MicOff size={12} />}
            </button>
          </motion.div>
          <NexThoughtStream thoughts={thoughts} detached />
        </motion.div>
      </div>

      {/* The track Nex is playing — a quiet line at the bottom, with tiny
          equalizer bars moving to the beat. */}
      <AnimatePresence>
        {music && (
          <motion.div
            key="now-playing"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => clockTime());
  useEffect(() => { const timer = setInterval(() => setTime(clockTime()), 1000); return () => clearInterval(timer); }, []);
  return <span>{time}</span>;
}
