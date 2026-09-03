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

export interface VaultFile {
  /** relative path, e.g. "Projects/OUTBOUND.md" */
  path: string;
  /** file name without the .md extension */
  name: string;
  /** folder relative path ("" for the vault root) */
  folder: string;
  content: string;
}

export interface AiConfig {
  provider: string;
  endpoint: string;
  model: string;
  key: string;
}

export interface DesktopBridge {
  platform: string;
  loadState: () => Promise<QynState | null>;
  saveState: (state: QynState) => Promise<{ ok: boolean }>;
  launch: (target: string) => Promise<{ ok: boolean; error?: string }>;
  /** Search Windows Start Menu/Desktop shortcuts; an empty query returns the full scan. */
  findShortcuts: (query: string) => Promise<ShortcutHit[]>;
  getSystemInfo: () => Promise<SystemInfo | null>;
  getStats: () => Promise<StatsSnapshot | null>;
  listDir: (dir: string) => Promise<DirEntry[] | null>;
  getHomeDir: () => Promise<string | null>;
  openPath: (p: string) => Promise<{ ok: boolean; error?: string }>;
  searchFiles: (query: string) => Promise<SearchHit[]>;
  captureScreen: () => Promise<string | null>;
  saveScreenshot: (dataUrl: string) => Promise<{ ok: boolean; path?: string; error?: string }>;

  /* Markdown vault — real .md files under Documents\QynOneVault */
  vaultRoot: () => Promise<string | null>;
  vaultTree: () => Promise<{ folders: string[]; notes: VaultFile[] } | null>;
  vaultRead: (rel: string) => Promise<string | null>;
  vaultWrite: (rel: string, content: string) => Promise<{ ok: boolean; error?: string }>;
  vaultRename: (oldRel: string, newRel: string) => Promise<{ ok: boolean; error?: string }>;
  vaultDelete: (rel: string) => Promise<{ ok: boolean; error?: string }>;
  vaultMkdir: (rel: string) => Promise<{ ok: boolean; error?: string }>;
  /** Subscribe to vault folder changes (auto-rescan). Returns an unsubscribe fn. */
  onVaultChanged: (cb: () => void) => () => void;

  /* AI configuration — qynone.env in the user data folder */
  aiConfigGet: () => Promise<AiConfig | null>;
  aiConfigSet: (cfg: AiConfig) => Promise<{ ok: boolean; error?: string }>;

  /* Start with Windows — real per-user Run entry through the OS. */
  autostartGet: () => Promise<{ enabled: boolean; available: boolean }>;
  autostartSet: (enabled: boolean) => Promise<{ ok: boolean; enabled: boolean; error?: string }>;

  /* Floating Nex — always-on-top companion window with just the eyes */
  floatToggle: () => Promise<{ open: boolean }>;
  floatState: () => Promise<{ open: boolean }>;
  floatClose: () => Promise<{ open: boolean }>;
  /** Notified whenever the floating Nex window opens or closes. */
  onFloatChanged: (cb: (open: boolean) => void) => () => void;
}

/** True when running inside the QynOne desktop app. */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && typeof window.qynDesktop !== "undefined";
}

/**
 * True when this renderer is the always-on-top floating Nex window
 * (the main window loads the same bundle with a #float hash).
 */
export function isFloatMode(): boolean {
  return typeof window !== "undefined" && window.location.hash === "#float";
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