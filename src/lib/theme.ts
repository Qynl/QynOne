import type { AccentId, AccentTheme, WallpaperId, WallpaperTheme } from "./types";

export const ACCENTS: Record<AccentId, AccentTheme> = {
  azure: {
    id: "azure",
    name: "Azure",
    color: "#5b8cff",
    soft: "rgba(91, 140, 255, 0.13)",
    glow: "rgba(91, 140, 255, 0.28)",
  },
  glacier: {
    id: "glacier",
    name: "Glacier",
    color: "#8fb4ff",
    soft: "rgba(143, 180, 255, 0.13)",
    glow: "rgba(143, 180, 255, 0.3)",
  },
  cobalt: {
    id: "cobalt",
    name: "Cobalt",
    color: "#3f6dff",
    soft: "rgba(63, 109, 255, 0.15)",
    glow: "rgba(63, 109, 255, 0.3)",
  },
  tide: {
    id: "tide",
    name: "Tide",
    color: "#41c9e8",
    soft: "rgba(65, 201, 232, 0.13)",
    glow: "rgba(65, 201, 232, 0.28)",
  },
  dusk: {
    id: "dusk",
    name: "Dusk",
    color: "#8b86ff",
    soft: "rgba(139, 134, 255, 0.13)",
    glow: "rgba(139, 134, 255, 0.28)",
  },
};

export const ACCENT_LIST: AccentTheme[] = Object.values(ACCENTS);

export const WALLPAPERS: Record<WallpaperId, WallpaperTheme> = {
  abyss: {
    id: "abyss",
    name: "Deep Abyss",
    description: "Quiet navy space with a soft blue horizon",
    baseA: "#0b1428",
    baseB: "#05080f",
  },
  dusk: {
    id: "dusk",
    name: "Blue Hour",
    description: "Cool indigo drift, like late evening light",
    baseA: "#101a3a",
    baseB: "#070a16",
  },
  frost: {
    id: "frost",
    name: "Frost",
    description: "Silvery slate, calmest of the three",
    baseA: "#0d1420",
    baseB: "#070b12",
  },
};

export const WALLPAPER_LIST: WallpaperTheme[] = Object.values(WALLPAPERS);