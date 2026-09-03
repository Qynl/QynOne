import { useEffect, useRef, useState } from "react";
import { AiFace } from "./AiFace";

/**
 * The single pre-app screen, kept truly minimal: nothing but Nex's eyes
 * waking up, a soft glow, and one hairline that fills — then App unmounts
 * it the instant the bar is full. No fade, no pause.
 */
export function BootScreen() {
  const [pct, setPct] = useState(0);
  const rafRef = useRef<number | null>(null);

  /* Fill the hairline over ~1.9s with a gentle ease — frame by frame,
     so the progress is always actually visible. */
  useEffect(() => {
    const start = performance.now();
    const duration = 1900;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setPct(Math.round(eased * 100));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      style={{ background: "var(--wallpaper-2)" }}
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
      aria-hidden
    >
      {/* one soft pool of light behind the eyes — nothing else */}
      <div
        className="absolute left-1/2 top-1/2 h-[300px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse, var(--accent-glow), transparent 70%)", opacity: 0.4 }}
      />

      <div className="relative flex flex-col items-center">
        <AiFace emotion="boot" size={210} />

        {/* one subtle hairline that fills while Nex wakes up — nothing more.
            The fill is driven by rAF, not a CSS/library animation, so it is
            always visibly progressing. */}
        <div className="mt-9 h-[2px] w-[140px] overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.85))",
              boxShadow: "0 0 12px rgba(255,255,255,0.35)",
            }}
          />
        </div>
      </div>
    </div>
  );
}