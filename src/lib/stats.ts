import { useEffect, useState } from "react";
import { getDesktop } from "./desktop";
import type { StatsSnapshot } from "./desktop";

/**
 * Real CPU/RAM/uptime readings from the desktop app (polled via IPC).
 *
 * In the web preview there is no access to the OS, so this returns `null` —
 * nothing is simulated or fabricated. Views that want live data show an
 * honest "available in the desktop app" state instead.
 */
export function useStats(): StatsSnapshot | null {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);

  useEffect(() => {
    const bridge = getDesktop();
    if (!bridge) return;
    let alive = true;
    const tick = () => {
      bridge
        .getStats()
        .then((s) => {
          if (alive && s) setStats(s);
        })
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return stats;
}