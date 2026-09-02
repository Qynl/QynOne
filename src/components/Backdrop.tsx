import { motion } from "framer-motion";
import { useQyn } from "../lib/store";
import { WALLPAPERS } from "../lib/theme";

export function Backdrop() {
  const { state } = useQyn();
  const wallpaper = WALLPAPERS[state.settings.wallpaper];
  const motionOn = state.settings.motion;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 20% 0%, ${wallpaper.baseA} 0%, ${wallpaper.baseB} 55%, #02040a 100%)`,
        }}
      />
      {/* accent glow, bottom left — the "horizon" */}
      <div
        className="absolute -bottom-40 -left-40 h-[46rem] w-[46rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-glow) 0%, transparent 65%)", opacity: 0.8 }}
      />
      {/* secondary drift glow, top right */}
      <motion.div
        className="absolute -top-48 right-[-12rem] h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(120, 150, 255, 0.13) 0%, transparent 62%)" }}
        animate={motionOn ? { x: [0, -60, 0], y: [0, 40, 0] } : undefined}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* faint grid */}
      <div className="wall-grid absolute inset-0" />
      {/* vignette to focus the center */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(2,4,10,0.55) 100%)" }}
      />
    </div>
  );
}