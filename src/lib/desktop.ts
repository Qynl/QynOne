import type { QynState } from "./types";

export interface ShortcutHit {
  name: string;
  path: string;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  cpuModel: string | null;
  cores: number;
  totalMemBytes: number;
}

export interface DesktopBridge {
  platform: string;
  loadState: () => Promise<QynState | null>;
  saveState: (state: QynState) => Promise<{ ok: boolean }>;
  launch: (target: string) => Promise<{ ok: boolean; error?: string }>;
  findShortcuts: (query: string) => Promise<ShortcutHit[]>;
  getSystemInfo: () => Promise<SystemInfo | null>;
}

/** True when running inside the QynOne desktop app. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && typeof window.qynDesktop !== "undefined";
}

/** The desktop bridge, or undefined in the plain web preview. */
export function getDesktop(): DesktopBridge | undefined {
  return window.qynDesktop;
}

declare global {
  interface Window {
    qynDesktop?: DesktopBridge;
  }
}