import type { AccentId, AccentTheme, WallpaperId, WallpaperTheme } from "./types";

export const ACCENTS: Record<AccentId, AccentTheme> = {
  azure: {
    id: "azure",
    name: "Azure",
    color: "#d9e0e8",
    soft: "rgba(217, 224, 232, 0.1)",
    glow: "rgba(217, 224, 232, 0.16)",
  },
  glacier: {
    id: "glacier",
    name: "Glacier",
    color: "#aeb8c3",
    soft: "rgba(174, 184, 195, 0.1)",
    glow: "rgba(174, 184, 195, 0.16)",
  },
  cobalt: {
    id: "cobalt",
    name: "Cobalt",
    color: "#f0f2f4",
    soft: "rgba(240, 242, 244, 0.1)",
    glow: "rgba(240, 242, 244, 0.16)",
  },
  tide: {
    id: "tide",
    name: "Tide",
    color: "#9fb8ad",
    soft: "rgba(159, 184, 173, 0.1)",
    glow: "rgba(159, 184, 173, 0.16)",
  },
  dusk: {
    id: "dusk",
    name: "Dusk",
    color: "#c3c9d0",
    soft: "rgba(195, 201, 208, 0.1)",
    glow: "rgba(195, 201, 208, 0.16)",
  },
};

export const ACCENT_LIST: AccentTheme[] = Object.values(ACCENTS);

export const WALLPAPERS: Record<WallpaperId, WallpaperTheme> = {
  abyss: {
    id: "abyss",
    name: "Deep Abyss",
    description: "Charcoal black with a soft neutral horizon",
    baseA: "#171a1f",
    baseB: "#070809",
  },
  dusk: {
    id: "dusk",
    name: "Low Light",
    description: "Deep graphite with a barely-there light shift",
    baseA: "#202328",
    baseB: "#0a0b0d",
  },
  frost: {
    id: "frost",
    name: "Frost",
    description: "Silvery slate, calmest of the three",
    baseA: "#17191c",
    baseB: "#08090a",
  },
};

export const WALLPAPER_LIST: WallpaperTheme[] = Object.values(WALLPAPERS);