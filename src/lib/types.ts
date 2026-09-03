export type ViewId = "home" | "ai" | "apps" | "folders" | "workspaces" | "system" | "files" | "tools" | "vault" | "calendar" | "settings" | "profile";

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
  /** whether the one-time "make QynOne start with Windows" ask was already shown */
  frontdoorAsked: boolean;
  /** Home widget order — id list, front to back */
  homeOrder: string[];
  /** Home widgets the user has hidden */
  hiddenWidgets: string[];
}

export interface Profile {
  /** display name shown in the hero, e.g. "Alex" */
  name: string;
  /** one-liner under the name, e.g. "Your PC, your way" */
  tagline: string;
  /** hex color of the avatar */
  color: string;
}

export interface Workspace {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** app ids that belong to this workspace */
  itemIds: string[];
  createdAt: number;
}

export type NotificationKind = "info" | "success" | "warn";

export interface CalendarEvent {
  id: string;
  title: string;
  /** local date key YYYY-MM-DD */
  date: string;
  /** "HH:mm" — empty when it's an all-day to-do */
  start: string;
  end?: string;
  notes?: string;
  done: boolean;
  createdAt: number;
}


export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: number;
  kind: NotificationKind;
  read: boolean;
}

export interface QynState {
  version: number;
  apps: AppItem[];
  folders: Folder[];
  recents: RecentEntry[];
  settings: Settings;
  profile: Profile;
  workspaces: Workspace[];
  notifications: NotificationItem[];
  /** demo notifications are seeded once per environment */
  notificationsSeeded: boolean;
  /** sticky notes for the Quick Tools */
  notes: string;
  /** favorite file/folder paths */
  fileFavorites: string[];
  /** calendar events + to-dos (date-keyed, local) */
  events: CalendarEvent[];
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