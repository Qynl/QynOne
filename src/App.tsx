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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "./lib/utils";
import { Backdrop } from "./components/Backdrop";
import { BootScreen } from "./components/BootScreen";
import { CommandPalette } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { UiProvider } from "./components/ui";
import { AiProvider } from "./lib/ai";
import { QynProvider, useQyn } from "./lib/store";
import { ACCENTS, WALLPAPERS } from "./lib/theme";
import type { ViewId } from "./lib/types";
import { VaultProvider } from "./lib/vault";
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

export default function App() {
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
  const [booted, setBooted] = useState(false);

  /* Boot animation — Nex opens his eyes, then the app fades in. */
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1900);
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
    if (view === "apps") return <AllAppsView />;
    if (view === "folders") return <FoldersView activeFolderId={folderId} onSelectFolder={setFolderId} onNavigate={navigate} />;
    if (view === "workspaces") return <WorkspacesView onNavigate={navigate} />;
    if (view === "system") return <SystemCenterView />;
    if (view === "files") return <FileCenterView />;
    if (view === "tools") return <QuickToolsView />;
    if (view === "calendar") return <CalendarView />;
    if (view === "vault")
      return (
        <VaultView
          pendingOpen={vaultOpen}
          onConsumed={() => setVaultOpen(null)}
          onOpenFolder={openFolder}
          onOpenWorkspace={() => {
            setView("workspaces");
          }}
        />
      );
    if (view === "settings") return <SettingsView onNavigate={navigate} />;
    if (view === "profile") return <ProfileView onNavigate={navigate} />;
    return (
      <HomeView
        onNavigate={navigate}
        onOpenFolder={openFolder}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenNote={openVaultNote}
      />
    );
  };

  return (
    <AiProvider onNavigate={(v) => navigate(v as ViewId)} onOpenFolder={openFolder} onOpenNote={openVaultNote}>
      <BootScreen done={booted} />
      <div className="relative flex h-full flex-col overflow-hidden">
        <Backdrop />

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          <TopBar onOpenPalette={() => setPaletteOpen(true)} onHome={() => navigate("home")} />

          <div className="flex min-h-0 flex-1">
            <Sidebar view={view} onNavigate={navigate} onOpenFolder={openFolder} />

            {/* Views transition softly between each other */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${view}-${view === "folders" ? (folderId ?? "all") : view === "vault" ? (vaultOpen ?? "none") : "view"}`}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="accent-scroll min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0"
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile bottom navigation — always get back to main */}
        <MobileNav view={view} onNavigate={navigate} />

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
  );
}

/* ------------------------------------------------------------------ */
/* Mobile bottom navigation                                            */
/* ------------------------------------------------------------------ */

const MOBILE_NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
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

function MobileNav({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <nav className="glass-deep no-scrollbar fixed inset-x-3 bottom-3 z-40 flex items-stretch gap-1 overflow-x-auto rounded-2xl px-2 py-1.5 md:hidden">
      {MOBILE_NAV.map((item) => {
        const active = view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex min-w-[54px] shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition",
              active ? "bg-accent-soft text-accent" : "text-frost-500 hover:bg-white/5 hover:text-frost-200",
            )}
          >
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[9.5px] font-semibold">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}