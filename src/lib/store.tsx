import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getDesktop } from "./desktop";
import { createSeedState } from "./seed";
import type { AppItem, Folder, NotificationKind, Profile, QynState, Settings, Workspace } from "./types";
import { uid } from "./utils";

const STORAGE_KEY = "qynone.state.v1";
const MAX_RECENTS = 10;

function loadState(): QynState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedState();
    const parsed = JSON.parse(raw) as QynState;
    if (parsed.version !== 1 || !Array.isArray(parsed.apps)) return createSeedState();
    const base = createSeedState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      profile: { ...base.profile, ...parsed.profile },
    };
  } catch {
    return createSeedState();
  }
}

export interface NewAppInput {
  name: string;
  subtitle?: string;
  icon: string;
  color: string;
  folderId?: string | null;
  launchUri?: string;
  favorite?: boolean;
  tags?: string[];
}

export interface AppActions {
  addApp: (input: NewAppInput) => string;
  updateApp: (id: string, patch: Partial<Omit<AppItem, "id">>) => void;
  removeApp: (id: string) => void;
  toggleFavorite: (id: string) => void;
  moveApp: (id: string, folderId: string | null) => void;
  addFolder: (name: string, icon: string, color: string) => string;
  updateFolder: (id: string, patch: Partial<Omit<Folder, "id">>) => void;
  removeFolder: (id: string) => void;
  recordLaunch: (appId: string) => void;
  clearRecents: () => void;
  patchSettings: (patch: Partial<Settings>) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  addWorkspace: (name: string, icon: string, color: string, itemIds: string[]) => string;
  updateWorkspace: (id: string, patch: Partial<Omit<Workspace, "id">>) => void;
  removeWorkspace: (id: string) => void;
  pushNotification: (title: string, body: string, kind?: NotificationKind) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  setNotes: (text: string) => void;
  toggleFileFavorite: (path: string) => void;
  resetAll: () => void;
  importState: (next: QynState) => void;
}

interface StoreValue {
  state: QynState;
  actions: AppActions;
}

const QynContext = createContext<StoreValue | null>(null);

const MAX_NOTIFICATIONS = 30;

export function QynProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QynState>(loadState);

  /* Desktop app: adopt the state saved on the user's PC (appears on mount). */
  useEffect(() => {
    const bridge = getDesktop();
    if (!bridge) return;
    let alive = true;
    bridge
      .loadState()
      .then((saved) => {
        if (!alive || !saved) return;
        if (saved.version !== 1 || !Array.isArray(saved.apps)) return;
        setState(() => {
          const base = createSeedState();
          return {
            ...base,
            ...saved,
            settings: { ...base.settings, ...saved.settings },
            profile: { ...base.profile, ...saved.profile },
          };
        });
      })
      .catch(() => {
        // keep the in-memory state; persistence failures are non-fatal
      });
    return () => {
      alive = false;
    };
  }, []);

  /* Persist: desktop writes to the per-user file, web keeps browser storage. */
  useEffect(() => {
    const bridge = getDesktop();
    if (bridge) {
      bridge.saveState(state).catch(() => {});
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — keep working in memory
    }
  }, [state]);

  const actions = useMemo<AppActions>(() => {
    return {
      addApp(input) {
        const id = uid();
        const app: AppItem = {
          id,
          name: input.name,
          subtitle: input.subtitle,
          icon: input.icon,
          color: input.color,
          folderId: input.folderId ?? null,
          favorite: input.favorite ?? false,
          launchUri: input.launchUri,
          tags: input.tags ?? [],
          createdAt: Date.now(),
        };
        setState((s) => ({ ...s, apps: [app, ...s.apps] }));
        return id;
      },
      updateApp(id, patch) {
        setState((s) => ({
          ...s,
          apps: s.apps.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
      },
      removeApp(id) {
        setState((s) => ({
          ...s,
          apps: s.apps.filter((a) => a.id !== id),
          recents: s.recents.filter((r) => r.appId !== id),
        }));
      },
      toggleFavorite(id) {
        setState((s) => ({
          ...s,
          apps: s.apps.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)),
        }));
      },
      moveApp(id, folderId) {
        setState((s) => ({
          ...s,
          apps: s.apps.map((a) => (a.id === id ? { ...a, folderId } : a)),
        }));
      },
      addFolder(name, icon, color) {
        const id = uid();
        setState((s) => ({
          ...s,
          folders: [...s.folders, { id, name, icon, color, createdAt: Date.now() }],
        }));
        return id;
      },
      updateFolder(id, patch) {
        setState((s) => ({
          ...s,
          folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        }));
      },
      removeFolder(id) {
        setState((s) => ({
          ...s,
          folders: s.folders.filter((f) => f.id !== id),
          apps: s.apps.map((a) => (a.id === id ? a : a.folderId === id ? { ...a, folderId: null } : a)),
        }));
      },
      recordLaunch(appId) {
        setState((s) => {
          const existing = s.recents.find((r) => r.appId === appId);
          const entry = existing
            ? { ...existing, lastOpened: Date.now(), count: existing.count + 1 }
            : { appId, lastOpened: Date.now(), count: 1 };
          const rest = s.recents.filter((r) => r.appId !== appId);
          return { ...s, recents: [entry, ...rest].slice(0, MAX_RECENTS) };
        });
      },
      clearRecents() {
        setState((s) => ({ ...s, recents: [] }));
      },
      patchSettings(patch) {
        setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      },
      updateProfile(patch) {
        setState((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
      },
      addWorkspace(name, icon, color, itemIds) {
        const id = uid();
        setState((s) => ({
          ...s,
          workspaces: [...s.workspaces, { id, name, icon, color, itemIds, createdAt: Date.now() }],
        }));
        return id;
      },
      updateWorkspace(id, patch) {
        setState((s) => ({
          ...s,
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        }));
      },
      removeWorkspace(id) {
        setState((s) => ({ ...s, workspaces: s.workspaces.filter((w) => w.id !== id) }));
      },
      pushNotification(title, body, kind = "info") {
        setState((s) => ({
          ...s,
          notifications: [{ id: uid(), title, body, time: Date.now(), kind, read: false }, ...s.notifications].slice(0, MAX_NOTIFICATIONS),
        }));
      },
      markNotificationsRead() {
        setState((s) => ({
          ...s,
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        }));
      },
      clearNotifications() {
        setState((s) => ({ ...s, notifications: [] }));
      },
      setNotes(text) {
        setState((s) => ({ ...s, notes: text }));
      },
      toggleFileFavorite(path) {
        setState((s) => ({
          ...s,
          fileFavorites: s.fileFavorites.includes(path)
            ? s.fileFavorites.filter((p) => p !== path)
            : [path, ...s.fileFavorites].slice(0, 20),
        }));
      },
      resetAll() {
        setState(createSeedState());
      },
      importState(next) {
        setState(() => {
          const base = createSeedState();
          return {
            ...base,
            ...next,
            settings: { ...base.settings, ...next.settings },
            profile: { ...base.profile, ...next.profile },
          };
        });
      },
    };
  }, []);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <QynContext.Provider value={value}>{children}</QynContext.Provider>;
}

export function useQyn(): StoreValue {
  const ctx = useContext(QynContext);
  if (!ctx) throw new Error("useQyn must be used inside QynProvider");
  return ctx;
}