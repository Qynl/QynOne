import type { Profile, QynState } from "./types";
import { DEFAULT_HOME_ORDER } from "./widgets";

/**
 * QynOne starts empty and honest.
 *
 * No demo apps, no fake launch history, no pretend workspaces — the library
 * is built from what is actually on the user's PC (added via the app editor's
 * "Find on this PC…" or by hand). Everything else (AI, stats, vault) is real
 * or plainly unavailable until the desktop app is running.
 */

export const DEFAULT_SETTINGS = {
  accent: "azure" as const,
  wallpaper: "abyss" as const,
  motion: true,
  clock: true,
  battery: true,
  homeOrder: DEFAULT_HOME_ORDER,
  hiddenWidgets: [] as string[],
};

export const DEFAULT_PROFILE: Profile = {
  name: "",
  tagline: "",
  color: "#5b8cff",
};

export function createSeedState(): QynState {
  return {
    version: 1,
    apps: [],
    folders: [],
    recents: [],
    settings: DEFAULT_SETTINGS,
    profile: DEFAULT_PROFILE,
    workspaces: [],
    notifications: [],
    notificationsSeeded: false,
    notes: "",
    fileFavorites: [],
  };
}