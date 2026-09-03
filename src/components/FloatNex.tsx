import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AiFace } from "./AiFace";
import { useAi } from "../lib/ai";
import type { AiEmotion } from "../lib/ai";
import { getDesktop } from "../lib/desktop";
import { useMusic } from "../lib/music";
import { stopSpeaking } from "../lib/speech";
import { useQyn } from "../lib/store";
import { ACCENTS } from "../lib/theme";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Floating Nex — the always-on-top companion window.
 *
 * QynOne opens this tiny transparent window (bottom-left of the screen) when
 * the user hits "Float Nex" on the AI page, so Nex stays visible above games
 * and other apps. It is ONLY the eyes: same emotion engine as Home, nothing
 * else on screen. Single click = talk to Nex (voice on/off), double click =
 * close the float. Closing QynOne closes it too.
 */
export function FloatNex() {
  const { state } = useQyn();
  const { emotion, busy, voiceEnabled, setVoiceEnabled } = useAi();
  const [ambient, setAmbient] = useState<AiEmotion>("boot");
  const ambientRef = useRef<AiEmotion>("boot");
  const ambientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const lastNotification = useRef<string | null>(null);
  const lastActivity = useRef<number | null>(null);

  /* Music — when Nex plays something on Amazon Music he wears headphones,
     dances and shows the track under the eyes, even in the float window. */
  const music = useMusic();
  const prevMusic = useRef<string | null>(null);
  useEffect(() => {
    const key = music ? music.title : null;
    if (key && key !== prevMusic.current) showAmbient("excited", 1700);
    else if (!key && prevMusic.current) showAmbient("settled", 1100);
    prevMusic.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music]);

  ambientRef.current = ambient;

  const showAmbient = (next: AiEmotion, ms = 1800) => {
    setAmbient(next);
    if (ambientTimer.current) clearTimeout(ambientTimer.current);
    if (ms > 0) ambientTimer.current = setTimeout(() => setAmbient("idle"), ms);
  };

  /* The float window is transparent — the renderer paints nothing. */
  useEffect(() => {
    document.body.classList.add("qyn-float");
    return () => document.body.classList.remove("qyn-float");
  }, []);

  /* Apply the user's accent to the eyes' glow. */
  useEffect(() => {
    const accent = ACCENTS[state.settings.accent] ?? ACCENTS.azure;
    const root = document.documentElement;
    root.style.setProperty("--accent", accent.color);
    root.style.setProperty("--accent-soft", accent.soft);
    root.style.setProperty("--accent-glow", accent.glow);
  }, [state.settings.accent]);

  const [size, setSize] = useState(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return Math.max(120, Math.min(220, Math.min(w - 44, (h - 12) * 1.05)));
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setSize(Math.max(120, Math.min(220, Math.min(w - 44, (h - 12) * 1.05))));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* The window just appeared: open the eyes, greet, then settle. */
  useEffect(() => {
    const greeting = setTimeout(() => showAmbient("greeting", 2000), 1000);
    const awake = setTimeout(() => showAmbient("awake", 1300), 3100);
    return () => {
      clearTimeout(greeting);
      clearTimeout(awake);
      if (ambientTimer.current) clearTimeout(ambientTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A real QynOne notification makes Nex glance aside. */
  useEffect(() => {
    const signature = state.notifications[0]?.id ?? null;
    if (signature && signature !== lastNotification.current) showAmbient("notification", 1800);
    lastNotification.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.notifications]);

  /* TTS broadcasts speaking state so the eyes animate while Nex talks. */
  useEffect(() => {
    const onSpeaking = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      if (active) showAmbient("speaking", 0);
      else if (!busy) showAmbient("settled", 1100);
    };
    window.addEventListener("qyn:nex-speaking", onSpeaking);
    return () => window.removeEventListener("qyn:nex-speaking", onSpeaking);
  }, [busy]);

  /* Real network state — no fake offline. */
  useEffect(() => {
    const apply = () => {
      if (!navigator.onLine) showAmbient("offline", 0);
      else if (ambientRef.current === "offline") setAmbient("idle");
    };
    window.addEventListener("offline", apply);
    window.addEventListener("online", apply);
    return () => {
      window.removeEventListener("offline", apply);
      window.removeEventListener("online", apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* No one is interacting with the float → Nex drifts to quiet idle. */
  useEffect(() => {
    const mark = () => {
      lastActivity.current = Date.now();
      if (ambientRef.current === "quiet") setAmbient("idle");
    };
    window.addEventListener("pointermove", mark, { passive: true });
    window.addEventListener("pointerdown", mark);
    const timer = setInterval(() => {
      if (lastActivity.current && Date.now() - lastActivity.current > 45_000 && !busy && !voiceEnabled && ambientRef.current !== "quiet") {
        setAmbient("quiet");
      }
    }, 5000);
    return () => {
      window.removeEventListener("pointermove", mark);
      window.removeEventListener("pointerdown", mark);
      clearInterval(timer);
    };
  }, [busy, voiceEnabled]);

  const toggleVoice = () => {
    stopSpeaking();
    setVoiceEnabled(!voiceEnabled);
    showAmbient(voiceEnabled ? "settled" : "listening", voiceEnabled ? 1000 : 0);
  };

  const closeFloat = () => {
    stopSpeaking();
    setVoiceEnabled(false);
    void getDesktop()?.floatClose();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2));
    const y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2));
    setGaze({ x, y });
  };

  const visualEmotion: AiEmotion = !navigator.onLine
    ? "offline"
    : busy
      ? emotion
      : ambient !== "idle"
        ? ambient
        : voiceEnabled
          ? "listening"
          : emotion;
  const musicLook = Boolean(music) && navigator.onLine && visualEmotion !== "offline" && visualEmotion !== "sleeping";

  return (
    <div onPointerMove={onPointerMove} className="qyn-float-drag relative h-full w-full overflow-hidden">
      <div className="qyn-float-nodrag absolute inset-0 grid place-items-center">
        <button
          type="button"
          onClick={toggleVoice}
          onDoubleClick={closeFloat}
          title="Talk to Nex — double-click to close"
          className="cursor-pointer rounded-[40px] outline-none"
          aria-label="Talk to Nex"
        >
          <AiFace emotion={visualEmotion} gazeX={gaze.x} gazeY={gaze.y} size={size} headphones={musicLook} dance={musicLook} />
        </button>
      </div>

      {/* The queued track — a single quiet line under the eyes. */}
      <AnimatePresence>
        {music && (
          <motion.div
            key="float-now-playing"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="qyn-float-nodrag pointer-events-none absolute inset-x-0 bottom-1 flex items-center justify-center gap-1.5 px-2"
          >
            <span className="flex h-2 items-end gap-[1.5px]">
              {[0, 1, 2].map((bar) => (
                <motion.span
                  key={bar}
                  className="w-[2px] rounded-full bg-accent"
                  style={{ height: 7, transformOrigin: "bottom" }}
                  animate={{ scaleY: [0.3, 1, 0.5, 0.8, 0.35] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: bar * 0.16, ease: "easeInOut" }}
                />
              ))}
            </span>
            <span className="truncate text-[9.5px] italic leading-none text-frost-300">{music.title}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
