import { useEffect, useState } from "react";
import { getDesktop } from "./desktop";
import type { SystemInfo } from "./desktop";

interface BatterySnapshot {
  level: number;
  charging: boolean;
}

interface NativeBattery {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function detectOs(ua: string): string {
  if (/Windows NT 10\.0/i.test(ua)) return "Windows 11";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Your PC";
}

function osName(p: SystemInfo): string {
  if (p.platform === "win32") return /10\.0/.test(p.release) ? "Windows 11" : /6\.3/.test(p.release) ? "Windows 8.1" : "Windows";
  if (p.platform === "darwin") return "macOS";
  if (p.platform === "linux") return "Linux";
  return "Your PC";
}

function effectiveType(): string | null {
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return conn?.effectiveType ?? null;
}

/**
 * Only real facts, nothing simulated:
 *  - battery & network state via real browser APIs,
 *  - real machine facts (hostname, CPU, RAM) from the desktop app.
 * Fields the platform can't provide are null.
 */
export function useSystemInfo() {
  const [battery, setBattery] = useState<BatterySnapshot | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [netType, setNetType] = useState<string | null>(effectiveType);
  const [machine, setMachine] = useState<SystemInfo | null>(null);

  /* Desktop app: pull real machine facts from the OS (user-level reads only). */
  useEffect(() => {
    const bridge = getDesktop();
    if (!bridge) return;
    let alive = true;
    bridge
      .getSystemInfo()
      .then((info) => {
        if (alive && info) setMachine(info);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<NativeBattery> };
    let cancelled = false;
    let bm: NativeBattery | null = null;

    const sync = () => {
      if (!bm) return;
      setBattery({ level: bm.level, charging: bm.charging });
    };

    nav.getBattery?.().then((b) => {
      if (cancelled) return;
      bm = b;
      sync();
      b.addEventListener("levelchange", sync);
      b.addEventListener("chargingchange", sync);
    });

    return () => {
      cancelled = true;
      bm?.removeEventListener("levelchange", sync);
      bm?.removeEventListener("chargingchange", sync);
    };
  }, []);

  /* Network state — real, watched live. */
  useEffect(() => {
    const on = () => {
      setOnline(navigator.onLine);
      setNetType(effectiveType());
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    const t = setInterval(on, 5000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      clearInterval(t);
    };
  }, []);

  const memoryGb = machine ? Math.max(1, Math.round(machine.totalMemBytes / 2 ** 30)) : null;
  const cores = machine ? machine.cores : null;

  return {
    battery,
    online,
    netType,
    memoryGb,
    cores,
    os: machine ? osName(machine) : detectOs(navigator.userAgent),
    hostname: machine ? machine.hostname : null,
    cpuModel: machine ? machine.cpuModel : null,
    arch: machine ? machine.arch : null,
  };
}