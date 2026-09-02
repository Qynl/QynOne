import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AiFace } from "./AiFace";

/**
 * Full-screen boot animation — Nex opens his eyes while QynOne loads.
 * Shown for a beat on every launch, then fades out.
 */
export function BootScreen({ done }: { done: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => Math.min(100, p + Math.random() * 14 + 6));
    }, 120);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: done ? 0 : 1 }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
      style={{ background: "var(--wallpaper-2)", pointerEvents: done ? "none" : "auto" }}
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
      aria-hidden={done}
    >
      {/* subtle grid + glow */}
      <div className="wall-grid absolute inset-0" />
      <div
        className="absolute left-1/2 top-1/2 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse, var(--accent-glow), transparent 68%)", opacity: 0.5 }}
      />

      <div className="relative flex flex-col items-center">
        <AiFace emotion="boot" size={190} />
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-7 text-[15px] font-bold tracking-[0.34em] text-frost-200"
        >
          QYNONE
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-frost-500"
        >
          your PC starts here
        </motion.p>

        <div className="mt-6 h-[3px] w-56 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg, var(--accent), #8ef0e2)" }}
            animate={{ width: `${Math.min(100, progress)}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>
      </div>
    </motion.div>
  );
}