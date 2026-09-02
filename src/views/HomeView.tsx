import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AiFace } from "../components/AiFace";
import { useAi } from "../lib/ai";
import { useNexVoice, stopSpeaking } from "../lib/speech";
import { clockTime, prettyToday } from "../lib/utils";

/**
 * Home — nothing but Nex.
 *
 * The time, the date, and two eyes. No cards, no lists, no scrolling.
 * Talk to Nex hands-free (say "Nex" then a command), or tap the mic /
 * click the eyes. Nex's short replies appear as a quiet line that fades.
 */
export function HomeView() {
  const { emotion, busy, messages, send, setEmotion } = useAi();
  const [voiceOn, setVoiceOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Eyes dominate the stage — as big as the window allows, no scroll. */
  const [eyeSize, setEyeSize] = useState(340);
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const size = Math.min(480, Math.max(240, Math.min(w * 0.62, h * 0.5)));
      setEyeSize(Math.round(size));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useNexVoice({
    enabled: voiceOn,
    callbacks: {
      onWake: () => {
        setEmotion("wake", 1900);
        flash("");
      },
      onListenStart: () => setEmotion("listening"),
      onIdle: () => {
        if (!busy) setEmotion("idle");
      },
      onCommand: (text) => {
        void send(text, { voice: true });
      },
      onError: (msg) => {
        flash(msg);
        setVoiceOn(false);
        setEmotion("concerned", 2400);
      },
    },
  });

  useEffect(() => {
    if (!voiceOn) stopSpeaking();
  }, [voiceOn]);

  /* A short-lived line with Nex's last spoken reply. */
  const lastAi = messages.filter((m) => m.role === "ai").at(-1);
  useEffect(() => {
    if (!lastAi) return;
    setNote(lastAi.text.length > 200 ? lastAi.text.slice(0, 200) + "…" : lastAi.text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 9000);
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, [lastAi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function flash(text: string) {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote(text || null);
    if (text) noteTimer.current = setTimeout(() => setNote(null), 5000);
  }

  const toggleVoice = () => {
    stopSpeaking();
    setVoiceOn((v) => !v);
  };

  return (
    <div className="group relative flex h-full min-h-0 flex-col overflow-hidden">
      {/* ---- Time + date ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-7 flex flex-col items-center leading-none">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="text-[11px] font-medium uppercase tracking-[0.34em] text-frost-500"
        >
          {prettyToday()}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-2.5 text-[clamp(40px,8vh,76px)] font-extralight tabular-nums tracking-tight text-frost-100"
          style={{ textShadow: "0 0 60px var(--accent-glow)" }}
        >
          <LiveClock />
        </motion.p>
      </div>

      {/* ---- Nex, centered ---- */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative flex flex-col items-center">
          <motion.button
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            onClick={toggleVoice}
            title={voiceOn ? "Stop listening" : "Talk to Nex"}
            className="cursor-pointer rounded-[40px] outline-none"
          >
            <AiFace emotion={busy ? emotion : voiceOn ? "listening" : emotion} size={eyeSize} />
          </motion.button>

          {/* mic control — appears on hover / while listening */}
          <div className="mt-5 flex h-9 items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 data-[on='true']:opacity-100" data-on={voiceOn}>
            <button
              onClick={toggleVoice}
              className={`flex h-9 items-center gap-2 rounded-full border px-4 text-[12px] font-medium transition active:scale-95 ${
                voiceOn
                  ? "border-[color-mix(in_srgb,var(--accent)_50%,transparent)] bg-accent-soft text-frost-100"
                  : "glass-soft border-white/10 text-frost-400 hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-200"
              }`}
            >
              {voiceOn ? (
                <>
                  <Mic size={13} className="text-accent" />
                  <span className="flex items-center gap-1.5">
                    Listening — say <span className="font-semibold text-accent">Nex</span>
                    <span className="flex gap-0.5 pl-0.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1 w-1 rounded-full bg-[var(--accent)]"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <MicOff size={13} />
                  Say “Nex”
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ---- Quiet one-line reply (fades) ---- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-6">
        <AnimatePresence>
          {note && (
            <motion.div
              key={note}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="glass-strong flex max-w-2xl items-start gap-2 rounded-2xl px-4 py-2.5"
            >
              <Volume2 size={13} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[12.5px] leading-relaxed text-frost-200">{note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(clockTime);
  useEffect(() => {
    const t = setInterval(() => setTime(clockTime()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{time}</span>;
}