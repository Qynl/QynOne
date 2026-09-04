import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  CalendarDays,
  FolderOpen,
  Folder,
  Home,
  LayoutGrid,
  Layers,
  SlidersHorizontal,
  User,
  Wrench,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./lib/utils";
import { Backdrop } from "./components/Backdrop";
import { FloatNex } from "./components/FloatNex";
import { BootScreen } from "./components/BootScreen";
import { CommandPalette } from "./components/CommandPalette";
import { TopBar } from "./components/TopBar";
import { NexPresence } from "./components/NexPresence";
import { UiProvider } from "./components/ui";
import { AiProvider } from "./lib/ai";
import { isFloatMode } from "./lib/desktop";
import { McpProvider } from "./lib/mcp";
import { QynProvider, useQyn } from "./lib/store";
import { ACCENTS, WALLPAPERS } from "./lib/theme";
import type { ViewId } from "./lib/types";
import { VaultProvider } from "./lib/vault";
import { AiView } from "./views/AiView";
import { AllAppsView } from "./views/AllAppsView";
import { CalendarView } from "./views/CalendarView";
import { FileCenterView } from "./views/FileCenterView";
import { FoldersView } from "./views/FoldersView";
import { HomeView } from "./views/HomeView";
import { ProfileView } from "./views/ProfileView";
import { QuickToolsView } from "./views/QuickToolsView";
import { SettingsView } from "./views/SettingsView";
import { SystemCenterView } from "./views/SystemCenterView";
import { VaultView } from "./views/VaultView";
import { WorkspacesView } from "./views/WorkspacesView";

const noop = () => {};

export default function App() {
  /* The floating Nex companion window reuses this same bundle with a #float
     hash — it renders only the eyes on a transparent, always-on-top window. */
  if (isFloatMode()) {
    return (
      <QynProvider>
        <UiProvider>
          <VaultProvider>
            <AiProvider onNavigate={noop} onOpenFolder={noop} onOpenNote={noop}>
              <FloatNex />
            </AiProvider>
          </VaultProvider>
        </UiProvider>
      </QynProvider>
    );
  }
  return (
    <QynProvider>
      <UiProvider>
        <VaultProvider>
          <Shell />
        </VaultProvider>
      </UiProvider>
    </QynProvider>
  );
}

function Shell() {
  const { state } = useQyn();
  const [view, setView] = useState<ViewId>("home");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [phase, setPhase] = useState<"boot" | "ready">("boot");

  /* Boot animation — Nex opens his eyes while the bar fills, then the
     screen vanishes instantly and QynOne is there. No fade, no pause. */
  useEffect(() => {
    const t = setTimeout(() => setPhase("ready"), 2050);
    return () => clearTimeout(t);
  }, []);

  /* Apply accent + wallpaper tokens to the document root. */
  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENTS[state.settings.accent];
    const wallpaper = WALLPAPERS[state.settings.wallpaper];
    root.style.setProperty("--accent", accent.color);
    root.style.setProperty("--accent-soft", accent.soft);
    root.style.setProperty("--accent-glow", accent.glow);
    root.style.setProperty("--wallpaper-1", wallpaper.baseA);
    root.style.setProperty("--wallpaper-2", wallpaper.baseB);
  }, [state.settings.accent, state.settings.wallpaper]);

  /* Global search — Ctrl/Cmd + K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navigate = (next: ViewId) => {
    if (next === "folders") setFolderId(null);
    setView(next);
  };

  const openFolder = (id: string) => {
    setFolderId(id);
    setView("folders");
  };

  const openVaultNote = (name: string) => {
    setVaultOpen(name);
    setView("vault");
  };

  const renderView = () => {
    if (view === "ai") return <AiView onNavigate={navigate} />;
    if (view === "apps") return <AllAppsView />;
    if (view === "folders") return <FoldersView activeFolderId={folderId} onSelectFolder={setFolderId} onNavigate={navigate} />;
    if (view === "workspaces") return <WorkspacesView onNavigate={navigate} />;
    if (view === "system") return <SystemCenterView />;
    if (view === "files") return <FileCenterView />;
    if (view === "tools") return <QuickToolsView />;
    if (view === "calendar") return <CalendarView />;
    if (view === "vault") return <VaultView pendingOpen={vaultOpen} onConsumed={() => setVaultOpen(null)} />;
    if (view === "settings") return <SettingsView onNavigate={navigate} />;
    if (view === "profile") return <ProfileView onNavigate={navigate} />;
    return <HomeView onNavigate={navigate} />;
  };

  return (
    <McpProvider>
      <AiProvider onNavigate={(v) => navigate(v as ViewId)} onOpenFolder={openFolder} onOpenNote={openVaultNote}>
        {/* Loading screen — the only pre-app screen. It unmounts the moment
            the bar is full, so Home is simply there. */}
        {phase === "boot" && <BootScreen />}
        <div className="relative flex h-full flex-col overflow-hidden">
          <Backdrop />

          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <TopBar onOpenPalette={() => setPaletteOpen(true)} onHome={() => navigate("home")} />

            {/* Views transition softly between each other */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${view}-${view === "folders" ? (folderId ?? "all") : view === "vault" ? (vaultOpen ?? "none") : "view"}`}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="accent-scroll min-h-0 min-w-0 flex-1 overflow-y-auto"
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>

            {/* Nex remains visible as a layer above every routed view. */}
            <NexPresence view={view} onOpen={() => navigate("ai")} />

            {/* Bottom navigation — the whole nav lives here */}
            <BottomDock view={view} onNavigate={navigate} />
          </div>

          {/* Search overlay */}
          <AnimatePresence>
            {paletteOpen && (
              <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onNavigate={navigate}
                onOpenFolder={openFolder}
                onOpenNote={openVaultNote}
              />
            )}
          </AnimatePresence>
        </div>
      </AiProvider>
    </McpProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile bottom navigation                                            */
/* ------------------------------------------------------------------ */

const DOCK_NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "ai", label: "Nex", icon: Sparkles },
  { id: "apps", label: "Apps", icon: LayoutGrid },
  { id: "folders", label: "Folders", icon: FolderOpen },
  { id: "workspaces", label: "Workspaces", icon: Layers },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "vault", label: "Vault", icon: BookOpen },
  { id: "system", label: "System", icon: Activity },
  { id: "files", label: "Files", icon: Folder },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "profile", label: "You", icon: User },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];

function BottomDock({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <nav className="no-scrollbar flex h-[64px] shrink-0 items-center gap-0.5 overflow-x-auto border-t border-white/5 bg-[rgba(6,9,17,0.55)] px-2 backdrop-blur-2xl">
      {DOCK_NAV.map((item) => {
        const active = view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            className={cn(
              "relative flex min-w-[62px] shrink-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors",
              active ? "text-frost-100" : "text-frost-600 hover:bg-white/[0.04] hover:text-frost-300",
            )}
          >
            {active && (
              <motion.span layoutId="dock-active" className="absolute top-0 h-[2px] w-6 rounded-full bg-[var(--accent)]" />
            )}
            <Icon size={19} strokeWidth={active ? 2.2 : 1.7} className={active ? "text-accent drop-shadow-[0_0_10px_var(--accent-glow)]" : ""} />
            <span className={cn("text-[9px] font-medium leading-none", active ? "font-semibold text-frost-100" : "")}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}