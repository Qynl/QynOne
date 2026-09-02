export type ViewId = "home" | "apps" | "folders" | "settings" | "profile";

export interface AppItem {
  id: string;
  name: string;
  subtitle?: string;
  /** key into the icon registry */
  icon: string;
  /** hex color used for the icon tile gradient */
  color: string;
  /** virtual folder id or null when unfiled */
  folderId: string | null;
  favorite: boolean;
  /** optional URL to open when launching */
  launchUri?: string;
  tags: string[];
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: number;
}

export interface RecentEntry {
  appId: string;
  lastOpened: number;
  count: number;
}

export type AccentId = "azure" | "glacier" | "cobalt" | "tide" | "dusk";
export type WallpaperId = "abyss" | "dusk" | "frost";

export interface Settings {
  accent: AccentId;
  wallpaper: WallpaperId;
  /** UI motion & hover lift */
  motion: boolean;
  /** show the live clock in the top bar */
  clock: boolean;
  /** live battery readout in the top bar */
  battery: boolean;
}

export interface Profile {
  /** display name shown in the hero, e.g. "Alex" */
  name: string;
  /** one-liner under the name, e.g. "Your PC, your way" */
  tagline: string;
  /** hex color of the avatar */
  color: string;
}

export interface QynState {
  version: number;
  apps: AppItem[];
  folders: Folder[];
  recents: RecentEntry[];
  settings: Settings;
  profile: Profile;
}

export interface AccentTheme {
  id: AccentId;
  name: string;
  color: string;
  soft: string;
  glow: string;
}

export interface WallpaperTheme {
  id: WallpaperId;
  name: string;
  description: string;
  baseA: string;
  baseB: string;
}