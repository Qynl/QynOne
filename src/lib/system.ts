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
 * Real battery/network where the platform allows, real machine facts in the
 * desktop app (hostname, CPU, RAM), gentle simulated load everywhere so the
 * panels always feel alive.
 */
export function useSystemInfo() {
  const [battery, setBattery] = useState<BatterySnapshot | null>(null);
  const [load, setLoad] = useState(() => 14 + Math.round(Math.random() * 12));
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

  // Gentle simulated load so the panel feels alive.
  useEffect(() => {
    const timer = setInterval(() => {
      setLoad((prev) => {
        const next = prev + Math.round(Math.random() * 14 - 7);
        return Math.max(6, Math.min(42, next));
      });
      setOnline(navigator.onLine);
      setNetType(effectiveType());
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const memoryGb = machine ? Math.max(1, Math.round(machine.totalMemBytes / 2 ** 30)) : (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 16;
  const cores = machine ? machine.cores : navigator.hardwareConcurrency ?? 8;

  return {
    battery,
    load,
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