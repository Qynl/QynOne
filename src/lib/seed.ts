import type { AppItem, Folder, Profile, QynState, RecentEntry, Workspace } from "./types";
import { DEFAULT_HOME_ORDER } from "./widgets";

const now = Date.now();

export const SEED_FOLDERS: Folder[] = [
  { id: "f-games", name: "Games", icon: "gamepad2", color: "#7f9cff", createdAt: now - 40 * 864e5 },
  { id: "f-dev", name: "Development", icon: "code", color: "#4ac9c2", createdAt: now - 38 * 864e5 },
  { id: "f-school", name: "School", icon: "bookOpen", color: "#9aa7e8", createdAt: now - 30 * 864e5 },
  { id: "f-media", name: "Media", icon: "film", color: "#b08cff", createdAt: now - 22 * 864e5 },
];

export const SEED_APPS: AppItem[] = [
  // ---- Games ----
  { id: "minecraft", name: "Minecraft", subtitle: "Java Edition", icon: "cube", color: "#5fd48f", folderId: "f-games", favorite: false, tags: ["game", "crafting", "java"], createdAt: now - 40 * 864e5 },
  { id: "fc26", name: "EA Sports FC 26", subtitle: "Football", icon: "trophy", color: "#f2b84b", folderId: "f-games", favorite: false, tags: ["game", "sports", "football"], createdAt: now - 39 * 864e5 },
  { id: "roblox", name: "Roblox", subtitle: "Play with friends", icon: "gamepad2", color: "#ff8f7a", folderId: "f-games", favorite: false, tags: ["game", "social", "online"], createdAt: now - 39 * 864e5 },
  { id: "rocket-league", name: "Rocket League", subtitle: "Car soccer", icon: "rocket", color: "#ff9e6b", folderId: "f-games", favorite: false, tags: ["game", "sports", "cars"], createdAt: now - 31 * 864e5 },
  { id: "steam", name: "Steam", subtitle: "Game store", icon: "dices", color: "#6c8cff", folderId: "f-games", favorite: false, tags: ["store", "game", "library"], createdAt: now - 28 * 864e5 },
  { id: "lol", name: "League of Legends", subtitle: "MOBA", icon: "sword", color: "#c9a0ff", folderId: "f-games", favorite: false, tags: ["game", "moba", "online"], createdAt: now - 26 * 864e5 },
  { id: "cyberpunk", name: "Cyberpunk 2077", subtitle: "Open world RPG", icon: "zap", color: "#f098e0", folderId: "f-games", favorite: false, tags: ["game", "rpg", "singleplayer"], createdAt: now - 20 * 864e5 },

  // ---- Development ----
  { id: "vscode", name: "VS Code", subtitle: "Code editor", icon: "code", color: "#47a1ff", folderId: "f-dev", favorite: true, tags: ["code", "editor", "programming", "dev"], createdAt: now - 38 * 864e5 },
  { id: "terminal", name: "Windows Terminal", subtitle: "PowerShell · WSL", icon: "terminal", color: "#3ea6ff", folderId: "f-dev", favorite: true, tags: ["shell", "command", "dev"], createdAt: now - 37 * 864e5 },
  { id: "unreal", name: "Unreal Engine 5", subtitle: "Game engine", icon: "blocks", color: "#b08cff", folderId: "f-dev", favorite: false, tags: ["engine", "game", "3d", "dev"], createdAt: now - 36 * 864e5 },
  { id: "blender", name: "Blender", subtitle: "3D creation", icon: "palette", color: "#ff9f68", folderId: "f-dev", favorite: false, tags: ["3d", "modeling", "render"], createdAt: now - 29 * 864e5 },
  { id: "gitkraken", name: "GitKraken", subtitle: "Git client", icon: "gitBranch", color: "#7ad0a0", folderId: "f-dev", favorite: false, tags: ["git", "version control", "dev"], createdAt: now - 24 * 864e5 },
  { id: "postman", name: "Postman", subtitle: "API platform", icon: "send", color: "#ff8f5a", folderId: "f-dev", favorite: false, tags: ["api", "rest", "testing", "dev"], createdAt: now - 21 * 864e5 },
  { id: "figma", name: "Figma", subtitle: "Design", icon: "penTool", color: "#ff86b8", folderId: "f-dev", favorite: false, tags: ["design", "ui", "prototype"], createdAt: now - 19 * 864e5 },
  { id: "node", name: "Node.js", subtitle: "Runtime", icon: "braces", color: "#7ed08a", folderId: "f-dev", favorite: false, tags: ["javascript", "runtime", "dev"], createdAt: now - 15 * 864e5 },

  // ---- School ----
  { id: "edge", name: "Microsoft Edge", subtitle: "Browse the web", icon: "globe", color: "#5fc4e8", folderId: "f-school", favorite: true, tags: ["browser", "web", "internet"], createdAt: now - 37 * 864e5 },
  { id: "word", name: "Word", subtitle: "Documents", icon: "fileText", color: "#6aa5ff", folderId: "f-school", favorite: false, tags: ["office", "document", "writing"], createdAt: now - 32 * 864e5 },
  { id: "excel", name: "Excel", subtitle: "Spreadsheets", icon: "table2", color: "#5fc98c", folderId: "f-school", favorite: false, tags: ["office", "spreadsheet", "data"], createdAt: now - 31 * 864e5 },
  { id: "ppt", name: "PowerPoint", subtitle: "Presentations", icon: "presentation", color: "#ff8f6f", folderId: "f-school", favorite: false, tags: ["office", "presentation", "slides"], createdAt: now - 27 * 864e5 },
  { id: "onenote", name: "OneNote", subtitle: "Notes", icon: "bookOpen", color: "#b08cff", folderId: "f-school", favorite: false, tags: ["notes", "study", "office"], createdAt: now - 18 * 864e5 },
  { id: "calc", name: "Calculator", subtitle: "Quick math", icon: "calculator", color: "#8fb3ff", folderId: "f-school", favorite: false, tags: ["utility", "math"], createdAt: now - 17 * 864e5 },

  // ---- Media ----
  { id: "spotify", name: "Spotify", subtitle: "Music & podcasts", icon: "music", color: "#6ee08f", folderId: "f-media", favorite: true, tags: ["music", "podcast", "audio"], createdAt: now - 33 * 864e5 },
  { id: "discord", name: "Discord", subtitle: "Chat & voice", icon: "messageSquare", color: "#7a8cff", folderId: "f-media", favorite: true, tags: ["chat", "voice", "social"], createdAt: now - 30 * 864e5 },
  { id: "obs", name: "OBS Studio", subtitle: "Stream & record", icon: "camera", color: "#8f9ec9", folderId: "f-media", favorite: false, tags: ["stream", "record", "video"], createdAt: now - 25 * 864e5 },
  { id: "clipchamp", name: "Clipchamp", subtitle: "Video editor", icon: "film", color: "#c9a0ff", folderId: "f-media", favorite: false, tags: ["video", "edit", "create"], createdAt: now - 14 * 864e5 },
  { id: "photos", name: "Photos", subtitle: "Your pictures", icon: "image", color: "#f5c769", folderId: "f-media", favorite: false, tags: ["photos", "images", "gallery"], createdAt: now - 13 * 864e5 },
  { id: "ps", name: "Photoshop", subtitle: "Image editing", icon: "brush", color: "#7ac8ff", folderId: "f-media", favorite: false, tags: ["edit", "design", "images"], createdAt: now - 11 * 864e5 },

  // ---- Unfiled ----
  { id: "files", name: "File Explorer", subtitle: "Windows files", icon: "appWindow", color: "#8fb3ff", folderId: null, favorite: true, tags: ["files", "explorer", "windows"], createdAt: now - 36 * 864e5 },
  { id: "paint", name: "Paint", subtitle: "Quick sketches", icon: "brush", color: "#f5a56b", folderId: null, favorite: false, tags: ["draw", "utility"], createdAt: now - 12 * 864e5 },
];

export const SEED_RECENTS: RecentEntry[] = [
  { appId: "edge", lastOpened: now - 47 * 60e3, count: 54 },
  { appId: "vscode", lastOpened: now - 2 * 36e5, count: 61 },
  { appId: "discord", lastOpened: now - 3 * 36e5, count: 38 },
  { appId: "spotify", lastOpened: now - 5 * 36e5, count: 29 },
  { appId: "minecraft", lastOpened: now - 26 * 36e5, count: 17 },
  { appId: "terminal", lastOpened: now - 30 * 36e5, count: 44 },
  { appId: "word", lastOpened: now - 2 * 864e5, count: 9 },
  { appId: "figma", lastOpened: now - 3 * 864e5, count: 12 },
];

export const SEED_WORKSPACES: Workspace[] = [
  {
    id: "ws-dev",
    name: "Development",
    icon: "code",
    color: "#4ac9c2",
    itemIds: ["vscode", "terminal", "unreal", "node"],
    createdAt: now - 21 * 864e5,
  },
];

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
    apps: SEED_APPS,
    folders: SEED_FOLDERS,
    recents: SEED_RECENTS,
    settings: DEFAULT_SETTINGS,
    profile: DEFAULT_PROFILE,
    workspaces: SEED_WORKSPACES,
    notifications: [],
    notificationsSeeded: false,
    notes: "",
    fileFavorites: [],
  };
}