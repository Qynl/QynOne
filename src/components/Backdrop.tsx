import { motion } from "framer-motion";
import { useQyn } from "../lib/store";
import { WALLPAPERS } from "../lib/theme";

export function Backdrop() {
  const { state } = useQyn();
  const wallpaper = WALLPAPERS[state.settings.wallpaper];
  const motionOn = state.settings.motion;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* restrained charcoal depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 20% 0%, ${wallpaper.baseA} 0%, ${wallpaper.baseB} 55%, #020202 100%)`,
        }}
      />
      {/* Nearly invisible white light keeps the charcoal surfaces dimensional. */}
      <motion.div
        className="absolute -top-48 right-[-12rem] h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(255, 255, 255, 0.055) 0%, transparent 62%)" }}
        animate={motionOn ? { x: [0, -60, 0], y: [0, 40, 0] } : undefined}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* faint grid */}
      <div className="wall-grid absolute inset-0" />
      {/* vignette to focus the center */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.58) 100%)" }}
      />
    </div>
  );
}