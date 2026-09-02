import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { AiEmotion } from "../lib/ai";
import { cn } from "../lib/utils";

/**
 * Qyn's face — just two rectangular eyes. The emotion comes through their
 * shape, tilt, gaze, glow and blink rhythm.
 */
export function AiFace({ emotion, size = 148 }: { emotion: AiEmotion; size?: number }) {
  const [blink, setBlink] = useState(false);

  /* Blink rhythm depends on the emotion. */
  useEffect(() => {
    if (emotion === "idle" || emotion === "listening" || emotion === "thinking") {
      const t = setInterval(
        () => {
          setBlink(true);
          window.setTimeout(() => setBlink(false), 130);
        },
        emotion === "thinking" ? 2600 : 3800,
      );
      return () => clearInterval(t);
    }
    if (emotion === "working") {
      const t = setInterval(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 90);
      }, 950);
      return () => clearInterval(t);
    }
    return;
  }, [emotion]);

  const eyes: Record<AiEmotion, { y: number; rotate: number; squint: number; glow: number }> = {
    idle: { y: 0, rotate: 0, squint: 1, glow: 0.5 },
    listening: { y: 0, rotate: 0, squint: 1.06, glow: 0.8 },
    thinking: { y: -3, rotate: 0, squint: 0.86, glow: 0.7 },
    working: { y: 0, rotate: 0, squint: 0.94, glow: 1 },
    happy: { y: 0, rotate: 5, squint: 1.02, glow: 1 },
    concerned: { y: 1, rotate: -4, squint: 0.9, glow: 0.4 },
  };

  const pose = eyes[emotion];
  const eyeW = Math.round(size * 0.36);
  const eyeH = Math.round(size * 0.2);
  const gap = Math.round(size * 0.14);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: Math.round(size * 0.72) }}
      aria-label={`Qyn is ${emotion}`}
    >
      {/* under-glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[34px] blur-2xl transition-opacity duration-500"
        style={{
          background: "radial-gradient(ellipse 60% 55% at 50% 62%, var(--accent-glow), transparent 70%)",
          opacity: pose.glow,
        }}
      />
      {/* head panel */}
      <div className="glass-soft relative z-10 flex items-center justify-center rounded-[34%] border-white/10"
        style={{ width: size, height: Math.round(size * 0.72) }}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[34%]"
          style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.07), transparent 55%)" }}
        />
        <div className="relative flex items-center" style={{ gap }}>
          {[-1, 1].map((side) => (
            <motion.div
              key={side}
              animate={{
                y: blink ? Math.round(eyeH * 0.42) : pose.y,
                rotate: side * pose.rotate,
                scaleY: blink ? 0.08 : pose.squint,
                scaleX: blink ? 1 : 1,
              }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative overflow-hidden rounded-[26%] ring-1 ring-white/15"
              style={{
                width: eyeW,
                height: eyeH,
                background: "linear-gradient(180deg, #dceaff 0%, #7fa8e8 55%, #3f6fd0 100%)",
                boxShadow: `0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.05)}px rgba(0,0,0,0.5), 0 0 ${Math.round(
                  size * 0.09,
                )}px var(--accent-glow)`,
                transformOrigin: "center",
              }}
            >
              {/* rectangular pupil — slides with gaze */}
              <motion.span
                className="absolute left-1/2 top-1/2 block rounded-[20%] bg-[#0a1022]/90"
                animate={{ x: "-50%", y: `calc(-50% + ${pose.y * 1.4}px)` }}
                style={{ width: "46%", height: "46%" }}
              />
              {/* top shine */}
              <span className="absolute left-[12%] top-[14%] h-[22%] w-[38%] rounded-full bg-white/50 blur-[2px]" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small status pill used next to the face. */
export function AiStatusChip({ emotion, busy }: { emotion: AiEmotion; busy: boolean }) {
  const label: Record<AiEmotion, string> = {
    idle: "Awake",
    listening: "Listening",
    thinking: "Thinking",
    working: "Working",
    happy: "Happy to help",
    concerned: "Something's off",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        busy
          ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft text-accent"
          : "border-white/8 bg-white/4 text-frost-400",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          busy ? "animate-pulse bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)]" : "bg-emerald-400/80",
        )}
      />
      {busy ? "Working" : label[emotion]}
    </span>
  );
}