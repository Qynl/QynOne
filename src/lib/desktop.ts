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

export interface StatsSnapshot {
  cpuPct: number;
  memUsedBytes: number;
  memTotalBytes: number;
  uptimeSec: number;
  platform: string;
  release: string;
  arch: string;
  hostname: string;
  cpuModel: string | null;
  cores: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtimeMs: number;
}

export interface SearchHit {
  name: string;
  path: string;
}

export interface DesktopBridge {
  platform: string;
  loadState: () => Promise<QynState | null>;
  saveState: (state: QynState) => Promise<{ ok: boolean }>;
  launch: (target: string) => Promise<{ ok: boolean; error?: string }>;
  findShortcuts: (query: string) => Promise<ShortcutHit[]>;
  getSystemInfo: () => Promise<SystemInfo | null>;
  getStats: () => Promise<StatsSnapshot | null>;
  listDir: (dir: string) => Promise<DirEntry[] | null>;
  getHomeDir: () => Promise<string | null>;
  openPath: (p: string) => Promise<{ ok: boolean; error?: string }>;
  searchFiles: (query: string) => Promise<SearchHit[]>;
  captureScreen: () => Promise<string | null>;
  saveScreenshot: (dataUrl: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
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