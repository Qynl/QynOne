import { useEffect, useState } from "react";
import { getDesktop } from "./desktop";
import type { StatsSnapshot } from "./desktop";

const SIM_RAM_GB = 16;
const SIM_MEM_BYTES = SIM_RAM_GB * 2 ** 30;

function simulate(): StatsSnapshot {
  return {
    cpuPct: 10 + Math.round(Math.random() * 26),
    memUsedBytes: Math.round((0.42 + Math.random() * 0.16) * SIM_MEM_BYTES),
    memTotalBytes: SIM_MEM_BYTES,
    uptimeSec: 38 * 60 * 60 + Math.round(Math.random() * 600),
    platform: "web",
    release: "",
    arch: "preview",
    hostname: "web-preview",
    cpuModel: null,
    cores: 8,
  };
}

/**
 * Real CPU/RAM/uptime from the desktop app (polled via IPC), with a gentle
 * simulation in the web preview so the interface always feels alive.
 */
export function useStats(): StatsSnapshot {
  const [stats, setStats] = useState<StatsSnapshot>(simulate);

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