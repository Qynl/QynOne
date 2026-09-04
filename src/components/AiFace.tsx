import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { AiEmotion } from "../lib/ai";

/**
 * Nex — two bare, pure-white rectangular eyes. Nothing else: no pupil, no
 * shine, no face, no text. An emotion is expressed through the eye shape
 * (open / arc / frown / squint / droop), openness, a gentle lean toward the
 * "gaze", tilt, glow, blink rhythm and floating effects.
 */

/* ------------------------------------------------------------------ */
/* Specs                                                               */
/* ------------------------------------------------------------------ */

type Shape = "rect" | "lens" | "arc" | "frown" | "squint" | "droop";

type FxKind = "sparkles" | "stars" | "hearts" | "tears" | "sweat" | "zzz" | "ring" | "confetti";

interface EyeSpec {
  /** eyelid openness 0..1 (0 = closed) */
  open: number;
  /** subtle whole-eye lean toward a "gaze" direction (-1..1) */
  leanX: number;
  leanY: number;
  /** per-eye tilt, opposite signs (deg) */
  tilt: number;
  /** ambient glow 0..1 */
  glow: number;
  shape: Shape;
  /** natural blink cadence ms (0 = no blinking) */
  blinkMs?: number;
  /** periodically close one eye at a time */
  wink?: boolean;
  shake?: boolean;
  bob?: boolean;
  dim?: boolean;
  fx?: FxKind[];
}

const SHAPE_RADIUS: Record<Shape, string> = {
  rect: "16%",
  /* the relaxed default — softly rounded, like a pair of glasses */
  lens: "30% / 34%",
  arc: "50% 50% 14% 14% / 90% 90% 10% 10%",
  frown: "14% 14% 50% 50% / 10% 10% 90% 90%",
  squint: "42% 42% 20% 20% / 72% 72% 24% 24%",
  droop: "24% 24% 30% 30% / 32% 32% 68% 68%",
};

const SPECS: Record<AiEmotion, EyeSpec> = {
  idle: { open: 1, leanX: 0, leanY: 0, tilt: 0, glow: 0.4, shape: "lens", blinkMs: 3600 },
  awake: { open: 1, leanX: 0, leanY: 0, tilt: 0, glow: 0.8, shape: "lens", blinkMs: 4300 },
  present: { open: 1, leanX: 0, leanY: 0, tilt: 0, glow: 0.65, shape: "lens", blinkMs: 3800 },
  greeting: { open: 1.08, leanX: 0, leanY: -0.08, tilt: 0, glow: 1.05, shape: "arc", bob: true },
  boot: { open: 1, leanX: 0, leanY: 0, tilt: 0, glow: 0.95, shape: "lens" },
  listening: { open: 0.9, leanX: 0, leanY: 0, tilt: 0, glow: 1, shape: "squint", blinkMs: 4200 },
  wake: { open: 1.05, leanX: 0, leanY: 0, tilt: 0, glow: 1.2, shape: "rect" },
  attentive: { open: 0.78, leanX: 0, leanY: 0, tilt: 0, glow: 1, shape: "squint", blinkMs: 3100 },
  speaking: { open: 0.96, leanX: 0, leanY: -0.04, tilt: 1, glow: 0.95, shape: "rect", blinkMs: 2400, bob: true },
  thinking: { open: 0.88, leanX: -0.3, leanY: -0.35, tilt: 0, glow: 0.65, shape: "droop", blinkMs: 2300 },
  working: { open: 0.9, leanX: 0, leanY: -0.2, tilt: 0, glow: 1, shape: "squint", blinkMs: 850 },
  happy: { open: 1, leanX: 0, leanY: -0.15, tilt: 5, glow: 1, shape: "arc", blinkMs: 3100 },
  joyful: { open: 1.05, leanX: 0, leanY: -0.12, tilt: 7, glow: 1.25, shape: "arc", blinkMs: 2600, fx: ["sparkles"] },
  laugh: { open: 0.82, leanX: 0, leanY: -0.25, tilt: 6, glow: 1.1, shape: "arc", shake: true, fx: ["sparkles"] },
  love: { open: 1, leanX: 0, leanY: -0.08, tilt: 0, glow: 1, shape: "arc", blinkMs: 3500, fx: ["hearts"] },
  party: { open: 1, leanX: 0, leanY: 0, tilt: 0, glow: 1.3, shape: "arc", blinkMs: 1900, fx: ["confetti", "sparkles", "stars"] },
  celebrate: { open: 1, leanX: 0, leanY: 0, tilt: 0, glow: 1.25, shape: "arc", blinkMs: 2100, fx: ["confetti", "stars"] },
  excited: { open: 1.1, leanX: 0, leanY: -0.1, tilt: 0, glow: 1.35, shape: "rect", blinkMs: 750, fx: ["sparkles"] },
  proud: { open: 1, leanX: 0, leanY: -0.3, tilt: 4, glow: 1, shape: "arc", blinkMs: 3000 },
  grateful: { open: 0.95, leanX: 0, leanY: -0.12, tilt: 3, glow: 0.9, shape: "arc", blinkMs: 3000, fx: ["sparkles"] },
  calm: { open: 0.85, leanX: 0, leanY: 0, tilt: 0, glow: 0.4, shape: "lens", blinkMs: 5400 },
  determined: { open: 0.78, leanX: 0, leanY: 0, tilt: -2, glow: 0.9, shape: "squint" },
  powerful: { open: 0.72, leanX: 0, leanY: -0.06, tilt: -4, glow: 1.1, shape: "squint", bob: true },
  relieved: { open: 0.8, leanX: 0, leanY: 0.12, tilt: 0, glow: 0.7, shape: "droop", blinkMs: 2600 },
  frustrated: { open: 0.64, leanX: 0, leanY: -0.1, tilt: -7, glow: 0.6, shape: "squint", shake: true },
  victory: { open: 1.08, leanX: 0, leanY: -0.2, tilt: 5, glow: 1.3, shape: "arc", bob: true, fx: ["stars", "confetti"] },
  curious: { open: 0.95, leanX: 0.4, leanY: 0, tilt: 0, glow: 0.7, shape: "rect", blinkMs: 3000 },
  focused: { open: 0.72, leanX: 0, leanY: 0, tilt: 0, glow: 0.9, shape: "squint", blinkMs: 1700 },
  focusedLeft: { open: 0.74, leanX: -0.7, leanY: 0, tilt: -2, glow: 0.9, shape: "squint", blinkMs: 1900 },
  focusedRight: { open: 0.74, leanX: 0.7, leanY: 0, tilt: 2, glow: 0.9, shape: "squint", blinkMs: 1900 },
  anticipating: { open: 1.02, leanX: 0, leanY: -0.12, tilt: 0, glow: 1.1, shape: "rect", blinkMs: 1800, fx: ["ring"] },
  playful: { open: 1, leanX: 0.2, leanY: 0.1, tilt: 7, glow: 0.9, shape: "arc", wink: true },
  wink: { open: 1, leanX: 0, leanY: 0, tilt: 5, glow: 0.85, shape: "arc", wink: true },
  shy: { open: 0.72, leanX: 0, leanY: 0.4, tilt: 0, glow: 0.55, shape: "droop", fx: ["hearts"] },
  surprised: { open: 1.15, leanX: 0, leanY: 0, tilt: 0, glow: 1, shape: "rect" },
  shocked: { open: 1.2, leanX: 0, leanY: 0, tilt: 0, glow: 1.2, shape: "rect", shake: true },
  alert: { open: 0.9, leanX: 0, leanY: -0.04, tilt: 0, glow: 1.15, shape: "squint", fx: ["ring"] },
  notification: { open: 0.9, leanX: 0.72, leanY: 0, tilt: 4, glow: 0.85, shape: "rect", blinkMs: 1400 },
  eventSoon: { open: 0.98, leanX: 0, leanY: -0.12, tilt: 0, glow: 1.05, shape: "rect", blinkMs: 1900, fx: ["ring"] },
  missedEvent: { open: 0.64, leanX: 0, leanY: 0.2, tilt: -4, glow: 0.3, shape: "frown", fx: ["sweat"] },
  sad: { open: 0.72, leanX: 0, leanY: 0.2, tilt: 0, glow: 0.3, shape: "frown" },
  crying: { open: 0.68, leanX: 0, leanY: 0.2, tilt: 0, glow: 0.3, shape: "frown", fx: ["tears"] },
  worried: { open: 0.8, leanX: 0, leanY: 0.2, tilt: -2, glow: 0.35, shape: "droop", fx: ["sweat"] },
  scared: { open: 0.9, leanX: 0, leanY: 0, tilt: 0, glow: 0.45, shape: "rect", shake: true },
  confused: { open: 0.9, leanX: 0.25, leanY: 0, tilt: 3, glow: 0.55, shape: "rect", fx: ["sweat"] },
  angry: { open: 0.6, leanX: 0, leanY: -0.15, tilt: -9, glow: 0.65, shape: "squint" },
  /* a yawn in eyes only — stretched tall, then a long slow shut at the peak */
  yawning: { open: 1.12, leanX: 0, leanY: 0, tilt: 0, glow: 0.55, shape: "rect" },
  sleepy: { open: 0.2, leanX: 0, leanY: 0.02, tilt: 0, glow: 0.22, shape: "droop", blinkMs: 3800 },
  sleeping: { open: 0.04, leanX: 0, leanY: 0, tilt: 0, glow: 0.16, shape: "rect" },
  tired: { open: 0.3, leanX: 0, leanY: 0.16, tilt: 0, glow: 0.22, shape: "droop", blinkMs: 3000 },
  sick: { open: 0.52, leanX: 0, leanY: 0.15, tilt: 0, glow: 0.22, shape: "droop", fx: ["sweat"] },
  zoned: { open: 0.85, leanX: 0.65, leanY: 0, tilt: 0, glow: 0.35, shape: "droop", blinkMs: 4200 },
  searching: { open: 1, leanX: 0.55, leanY: 0, tilt: 0, glow: 0.8, shape: "rect", blinkMs: 1400 },
  scanning: { open: 0.84, leanX: -0.5, leanY: 0, tilt: 0, glow: 0.8, shape: "squint", blinkMs: 900 },
  remembering: { open: 0.86, leanX: 0.3, leanY: -0.22, tilt: 2, glow: 0.65, shape: "droop", blinkMs: 2500 },
  /* the drifted-off look: half-lidded, droopy, very slow blinks */
  quiet: { open: 0.48, leanX: 0, leanY: 0.05, tilt: 0, glow: 0.28, shape: "droop", blinkMs: 6200 },
  offline: { open: 0.9, leanX: 0, leanY: 0, tilt: 0, glow: 0, shape: "rect", blinkMs: 4000, dim: true },
  yes: { open: 1, leanX: 0, leanY: -0.15, tilt: 0, glow: 0.9, shape: "arc", bob: true },
  no: { open: 0.85, leanX: 0, leanY: 0, tilt: -4, glow: 0.6, shape: "squint", shake: true },
  sorry: { open: 0.68, leanX: 0, leanY: 0.2, tilt: 0, glow: 0.28, shape: "frown" },
  concerned: { open: 0.78, leanX: 0, leanY: 0.15, tilt: -3, glow: 0.35, shape: "droop", blinkMs: 1700, fx: ["sweat"] },
  welcoming: { open: 1.02, leanX: 0, leanY: -0.06, tilt: 2, glow: 0.9, shape: "arc", blinkMs: 2600 },
  confident: { open: 0.84, leanX: 0, leanY: -0.14, tilt: -2, glow: 1, shape: "squint", blinkMs: 2200 },
  delighted: { open: 1.05, leanX: 0, leanY: -0.1, tilt: 6, glow: 1.2, shape: "arc", bob: true, fx: ["sparkles"] },
  disappointed: { open: 0.58, leanX: 0, leanY: 0.24, tilt: -2, glow: 0.24, shape: "frown" },
  amused: { open: 0.9, leanX: 0.25, leanY: -0.1, tilt: 5, glow: 0.85, shape: "arc", wink: true },
  inspired: { open: 1.04, leanX: 0, leanY: -0.18, tilt: 0, glow: 1.25, shape: "arc", fx: ["stars"] },
  restless: { open: 0.9, leanX: 0.6, leanY: 0, tilt: 2, glow: 0.7, shape: "rect", shake: true },
  protective: { open: 0.7, leanX: 0, leanY: -0.05, tilt: -3, glow: 0.95, shape: "squint" },
  settled: { open: 0.82, leanX: 0, leanY: 0.06, tilt: 0, glow: 0.45, shape: "lens", blinkMs: 4700 },
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function AiFace({
  emotion,
  size = 160,
  gazeX = 0,
  gazeY = 0,
  headphones = false,
  dance = false,
  crossed = false,
  intensity = 1,
}: {
  emotion: AiEmotion;
  size?: number;
  gazeX?: number;
  gazeY?: number;
  /** music is on — Nex wears headphones that pulse with the beat */
  headphones?: boolean;
  /** music is on — Nex sways/dances while the eyes still express emotion */
  dance?: boolean;
  /** easter egg — both eyes turn inward like he's staring cross-eyed */
  crossed?: boolean;
  /** 0..1 contextual strength — subtly scales openness and glow without
      changing the emotion's shape or visual language (1 = as designed) */
  intensity?: number;
}) {
  const spec = SPECS[emotion] ?? SPECS.idle;
  const [blinkL, setBlinkL] = useState(false);
  const [blinkR, setBlinkR] = useState(false);
  const [winkFlip, setWinkFlip] = useState(0);
  const [booted, setBooted] = useState(false);

  /* Natural blink cadence. */
  useEffect(() => {
    if (!spec.blinkMs) return;
    const t = setInterval(() => {
      if (spec.wink) {
        setWinkFlip((f) => f + 1);
        const left = winkFlip % 2 === 0;
        setBlinkL(left);
        setBlinkR(!left);
        window.setTimeout(() => {
          setBlinkL(false);
          setBlinkR(false);
        }, 150);
        return;
      }
      setBlinkL(true);
      setBlinkR(true);
      window.setTimeout(() => {
        setBlinkL(false);
        setBlinkR(false);
      }, 130);
    }, spec.blinkMs);
    return () => clearInterval(t);
  }, [spec.blinkMs, spec.wink, winkFlip]);

  /* Boot: a slow opening blink + glow ramp on mount — Nex wakes up, nothing
     else. */
  useEffect(() => {
    if (emotion !== "boot") {
      setBooted(true);
      return;
    }
    setBooted(false);
    const t = setTimeout(() => setBooted(true), 850);
    return () => clearTimeout(t);
  }, [emotion]);

  const eyeW = Math.round(size * 0.34);
  const eyeH = Math.round(size * 0.27);
  const gap = Math.round(size * 0.16);
  const glowMult = spec.dim ? 1 : Math.min(1.35, Math.max(0.7, 0.82 + intensity * 0.35));
  const openY = booted ? Math.min(1.22, Math.max(0.03, spec.open * (spec.dim ? 1 : 0.9 + intensity * 0.12))) : 0.04;
  /* A small gaze follows the user's pointer without adding pupils or a face. */
  const leanX = (spec.leanX + gazeX) * size * 0.025;
  const leanY = (spec.leanY + gazeY) * size * 0.035;

  const body = spec.dim
    ? "linear-gradient(180deg, #5b6a85 0%, #46546e 100%)"
    : "linear-gradient(180deg, #ffffff 0%, #f4f8ff 58%, #dde8f8 100%)";
  const edge = spec.dim ? "rgba(120,140,180,0.35)" : "rgba(160,190,240,0.45)";
  const glowBase = spec.dim ? "rgba(100,120,160,0.28)" : "var(--accent-glow)";

  const shakeAnim = spec.shake ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 };
  const bobAnim = spec.bob ? { y: [0, -7, 0] } : { y: 0 };
  const danceAnim = { rotate: [0, -3, 2.5, -2.5, 3, 0], y: [0, -2, 0, -2, 0, 0], x: [0, 1.5, 0, -1.5, 0, 0] };
  const beatPulse = headphones ? { scale: [1, 1.045, 1] } : {};

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: Math.round(size * 0.6) }}>
      {/* ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse 58% 54% at 50% 58%, ${glowBase}, transparent 70%)`,
          opacity: booted ? Math.min(1.5, spec.glow * glowMult) : 0,
        }}
      />

      <motion.div
        animate={dance && !spec.shake ? danceAnim : shakeAnim}
        transition={
          spec.shake
            ? { duration: 0.42, repeat: Infinity, ease: "easeInOut" }
            : dance && !spec.shake
              ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
        }
        className="relative"
      >
        <motion.div
          animate={bobAnim}
          transition={spec.bob ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
          className="flex items-center"
          style={{ gap }}
        >
          {[0, 1].map((side) => {
            const closed = side === 0 ? blinkL : blinkR;
            return (
              <motion.div
                key={side}
                initial={emotion === "boot" ? { scaleY: 0.04, opacity: 0 } : false}
                animate={(() => {
                  if (emotion === "yawning") {
                    /* a yawn in eyes only: stretch tall, dip, stretch again,
                       then a long shut as the yawn peaks, and a slow reopen */
                    return {
                      x: leanX,
                      y: leanY,
                      rotate: 0,
                      scaleY: [1.1, 0.98, 1.16, 0.08, 0.94],
                      opacity: 1,
                    };
                  }
                  if (!crossed) {
                    return {
                      x: leanX,
                      y: leanY,
                      rotate: (side === 0 ? -1 : 1) * spec.tilt,
                      scaleY: closed ? 0.05 : openY,
                      opacity: 1,
                    };
                  }
                  /* easter egg payoff — his eyes come together first (staring
                     at the middle he can't hold), then they hurt: a double
                     blink and a tiny shake while crossed, then a release. */
                  const ix = (side === 0 ? 1 : -1) * size * 0.055;
                  return {
                    x: [0, ix, ix - 2, ix + 2, ix - 1.5, ix + 1.5, 0],
                    y: leanY,
                    rotate: (side === 0 ? -1 : 1) * 3,
                    scaleY: [0.95, 0.95, 0.06, 0.72, 0.06, 0.8, 0.95],
                    opacity: 1,
                  };
                })()}
                transition={
                  crossed
                    ? { duration: 1.5, times: [0, 0.14, 0.3, 0.44, 0.58, 0.72, 1], ease: "easeInOut" }
                    : emotion === "yawning"
                      ? { duration: 2, times: [0, 0.16, 0.32, 0.58, 1], ease: "easeInOut" }
                      : { duration: closed ? 0.1 : 0.34, ease: [0.22, 1, 0.36, 1] }
                }
                className="relative"
                style={{
                  width: eyeW,
                  height: eyeH,
                  borderRadius: SHAPE_RADIUS[spec.shape],
                  background: body,
                  boxShadow: `0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.05)}px rgba(3,8,20,0.35), 0 0 ${Math.round(size * 0.08)}px -2px ${edge}, 0 0 ${Math.round(size * 0.14)}px -6px var(--accent-glow)`,
                  transition: "border-radius 0.35s ease",
                  transformOrigin: "center",
                }}
              />
            );
          })}
        </motion.div>
      </motion.div>

      {/* headphones — a real accessory when music is on: a thin arc over the
          eyes with two cups that pulse to the beat */}
      {headphones && (
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute"
            style={{
              left: "50%",
              top: Math.round(size * 0.018),
              width: Math.round(eyeW * 2 + gap + size * 0.17),
              height: Math.round(size * 0.052),
              borderRadius: 999,
              transform: "translateX(-50%)",
              background: "linear-gradient(180deg, #f2f7ff 0%, #bccde9 58%, #8fa4cc 100%)",
              boxShadow: "0 1px 2px rgba(2,6,18,0.45), 0 0 16px -2px rgba(150,185,255,0.4)",
            }}
            animate={beatPulse}
            transition={{ duration: 0.62, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
          />
          {[-1, 1].map((side) => {
            const ear = Math.round(size * 0.16);
            return (
              <motion.span
                key={side}
                className="absolute rounded-full"
                style={{
                  left: `calc(50% + ${side * Math.round(eyeW + gap / 2 + size * 0.045)}px)`,
                  top: Math.round(size * 0.3 - ear * 0.5),
                  width: ear,
                  height: ear,
                  background: "radial-gradient(circle at 35% 28%, #ffffff 0%, #d7e2f7 45%, #9db1d8 100%)",
                  boxShadow:
                    "0 2px 4px rgba(2,6,18,0.4), inset 0 0 0 2px rgba(140,165,215,0.35), 0 0 12px -2px rgba(150,185,255,0.45)",
                }}
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.62, repeat: Infinity, ease: "easeInOut", delay: side === 1 ? 0.31 : 0, repeatType: "reverse" }}
              />
            );
          })}
        </div>
      )}

      {/* floating effects */}
      <Fx kind={spec.fx} size={size} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Floating effects                                                    */
/* ------------------------------------------------------------------ */

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FX_COLORS = ["#ffd77a", "#7ab8ff", "#ffffff", "#8ef0e2", "#ff9ec7", "#c4b5fd"];

function Fx({ kind, size }: { kind: FxKind[] | undefined; size: number }) {
  const rng = useMemo(() => mulberry32(hashSeed((kind ?? []).join(",") || "none")), [kind]);

  if (!kind || kind.length === 0) return null;

  const ring = kind.includes("ring");
  const particles = kind.filter((k) => k !== "ring");

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {ring &&
        [0, 1].map((i) => (
          <motion.span
            key={`ring-${i}`}
            className="absolute rounded-full border"
            style={{
              left: "50%",
              top: "50%",
              width: size * 0.92,
              height: size * 0.5,
              marginLeft: -(size * 0.92) / 2,
              marginTop: -(size * 0.5) / 2,
              borderColor: "var(--accent)",
              opacity: 0.45,
            }}
            animate={{ scale: [0.55, 1.4], opacity: [0.45, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.75, ease: "easeOut" }}
          />
        ))}

      {particles.map((kindName, pi) => {
        const n = kindName === "tears" || kindName === "sweat" ? 5 : kindName === "confetti" ? 10 : 7;
        return Array.from({ length: n }).map((_, i) => {
          const x = (rng() - 0.5) * size * 1.05;
          const delay = rng() * 0.9;
          const dur = 1.7 + rng() * 1.4;
          const key = `${kindName}-${pi}-${i}`;
          const fromTop = rng() < 0.5;

          switch (kindName) {
            case "sparkles":
            case "stars": {
              const big = kindName === "stars";
              const color = kindName === "stars" ? FX_COLORS[Math.floor(rng() * FX_COLORS.length)] : "#ffffff";
              return (
                <motion.span
                  key={key}
                  className="absolute"
                  style={{ left: "50%", top: "50%" }}
                  animate={{
                    x: [x * 0.3, x],
                    y: [0, -(size * (big ? 0.5 : 0.42))],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.5],
                    rotate: [0, 180],
                  }}
                  transition={{ duration: dur, repeat: Infinity, delay, ease: "easeOut" }}
                >
                  <span
                    className="block rotate-45"
                    style={{
                      width: big ? size * 0.07 : size * 0.045,
                      height: big ? size * 0.07 : size * 0.045,
                      background: color,
                      boxShadow: `0 0 ${size * 0.06}px ${color}`,
                      borderRadius: big ? "1px" : "50%",
                    }}
                  />
                </motion.span>
              );
            }
            case "hearts":
              return (
                <motion.span
                  key={key}
                  className="absolute"
                  style={{ left: "50%", top: "50%" }}
                  animate={{ x: [x * 0.4, x * 1.1], y: [0, -(size * 0.5)], opacity: [0, 1, 0], scale: [0.4, 1.1, 0.7] }}
                  transition={{ duration: dur, repeat: Infinity, delay, ease: "easeOut" }}
                >
                  <Heart size={Math.max(9, size * 0.085)} className="text-[#ff8fb8]" fill="#ff8fb8" />
                </motion.span>
              );
            case "tears":
              return (
                <motion.span
                  key={key}
                  className="absolute"
                  style={{ left: "50%", top: "50%" }}
                  animate={{ x: [x * 0.4, x * 0.4], y: [size * 0.1, size * 0.55], opacity: [0, 0.95, 0] }}
                  transition={{ duration: dur, repeat: Infinity, delay, ease: "easeIn" }}
                >
                  <span
                    className="block"
                    style={{
                      width: size * 0.045,
                      height: size * 0.085,
                      background: "linear-gradient(180deg, #8ec6ff, #4f8fe8)",
                      borderRadius: "45% 45% 55% 55%",
                    }}
                  />
                </motion.span>
              );
            case "sweat":
              return (
                <motion.span
                  key={key}
                  className="absolute"
                  style={{ left: "50%", top: "50%" }}
                  animate={{ x: [x, x + size * 0.06], y: [-size * 0.08, size * 0.42], opacity: [0, 0.9, 0] }}
                  transition={{ duration: dur, repeat: Infinity, delay, ease: "easeIn" }}
                >
                  <span
                    className="block rounded-full"
                    style={{
                      width: size * 0.05,
                      height: size * 0.05,
                      background: "radial-gradient(circle at 35% 30%, #d8ecff, #7fb4f2)",
                    }}
                  />
                </motion.span>
              );
            case "zzz":
              return (
                <motion.span
                  key={key}
                  className="absolute font-bold text-frost-400"
                  style={{ left: "50%", top: "50%", fontSize: size * 0.075 + i * 2 }}
                  animate={{ x: [x * 0.2, x * 0.8], y: [0, -(size * 0.48)], opacity: [0, 1, 0], rotate: [0, -14] }}
                  transition={{ duration: dur, repeat: Infinity, delay, ease: "easeOut" }}
                >
                  z
                </motion.span>
              );
            case "confetti":
              return (
                <motion.span
                  key={key}
                  className="absolute"
                  style={{ left: "50%", top: "50%" }}
                  animate={{
                    x: [x * 0.2, x],
                    y: [-(size * 0.15), size * 0.6],
                    opacity: [0, 1, 0],
                    rotate: [0, rng() > 0.5 ? 360 : -360],
                  }}
                  transition={{ duration: dur + 0.4, repeat: Infinity, delay, ease: "easeIn" }}
                >
                  <span
                    className="block"
                    style={{
                      width: size * 0.05,
                      height: size * (fromTop ? 0.05 : 0.11),
                      background: FX_COLORS[i % FX_COLORS.length],
                      borderRadius: 2,
                    }}
                  />
                </motion.span>
              );
            default:
              return null;
          }
        });
      })}
    </div>
  );
}