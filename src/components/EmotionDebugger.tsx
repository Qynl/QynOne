import { motion } from "framer-motion";
import { useAi } from "../lib/ai";
import { CALM_BASE, EMOTION_LABELS } from "../lib/emotion";

/**
 * EmotionDebugger — development-only. A live readout of the emotion engine:
 * the current decision, its confidence / priority / intensity / duration,
 * the base state it will return to, active cooldowns and the last few
 * decisions. Only rendered when import.meta.env.DEV.
 */
export function EmotionDebugger() {
  const { emotion, emotionDebug, intensity, busy } = useAi();
  if (!emotionDebug) return null;

  const d = emotionDebug;
  const calm = CALM_BASE.has(emotion);
  const label = (e: string) => EMOTION_LABELS[e as keyof typeof EMOTION_LABELS] ?? e;

  const rows: Array<[string, string]> = [
    ["Emotion", `${label(d.emotion)} (${d.emotion})`],
    ["Reason", d.reason],
    ["Confidence", `${Math.round(d.confidence * 100)}%`],
    ["Priority", String(d.priority)],
    ["Intensity", `${Math.round(d.intensity * 100)}%`],
    ["Duration", d.durationMs === 0 ? "hold" : `${d.durationMs}ms`],
    ["Previous", label(d.base)],
    ["Overlay", d.overlay ? "yes → restores base" : "no"],
    ["Restores to", label(d.base)],
    ["Applied", new Date(d.ts).toLocaleTimeString(undefined, { hour12: false })],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none fixed bottom-[76px] left-3 z-50 w-[300px] rounded-xl border border-amber-400/25 bg-[rgba(10,12,18,0.92)] p-3 font-mono text-[10px] leading-relaxed text-frost-300 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">Nex emotion engine · dev</p>
        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${calm ? "bg-white/5 text-frost-500" : "bg-amber-400/15 text-amber-300"}`}>
          {busy ? "busy" : calm ? "calm base" : "reacting"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[76px_1fr] gap-x-2 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <span className="text-frost-600">{k}</span>
            <span className={k === "Emotion" ? "font-bold text-white" : "text-frost-200"}>{v}</span>
          </div>
        ))}
      </div>
      {d.cooldowns.length > 0 && (
        <div className="mt-2 border-t border-white/8 pt-1.5">
          <p className="text-[9px] uppercase tracking-[0.18em] text-frost-600">Cooldowns</p>
          {d.cooldowns.map((c) => (
            <div key={c.key} className="flex items-center justify-between">
              <span>{c.key}</span>
              <span className="text-frost-500">{(c.leftMs / 1000).toFixed(0)}s</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 border-t border-white/8 pt-1.5 text-[9.5px]">
        <p className="text-[9px] uppercase tracking-[0.18em] text-frost-600">Current</p>
        <p className="mt-0.5">
          <span className="text-white">{label(emotion)}</span>
          <span className="text-frost-600"> · intensity {Math.round(intensity * 100)}%</span>
        </p>
      </div>
    </motion.div>
  );
}