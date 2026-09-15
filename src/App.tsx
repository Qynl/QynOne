import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Home, Settings2, Sparkles } from "lucide-react";
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
import { VaultProvider } from "./lib/vault";
import type { ViewId } from "./lib/types";
import { AiView } from "./views/AiView";
import { HomeView } from "./views/HomeView";
import { SettingsView } from "./views/SettingsView";

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

/* QynOne is three surfaces now — Nex-first, MCP-first: */
/* Home is Nex. Nex is the workshop. Settings wires the engines. */

const DOCK_NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "ai", label: "Nex", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function Shell() {
  const { state } = useQyn();
  const [view, setView] = useState<ViewId>("home");
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

  const navigate = (next: ViewId) => setView(next);

  return (
    <MotionConfig
      reducedMotion="user"
      /* One shared spring personality for every element that doesn't tune its
         own transition — hover lifts, layout shifts and list changes all move
         with the same damped, slightly-overshoot-free curve. */
      transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
    >
      <McpProvider>
        <AiProvider onNavigate={(v) => navigate(v as ViewId)} onOpenFolder={noop} onOpenNote={noop}>
        {/* Loading screen — the only pre-app screen. It unmounts the moment
            the bar is full, so Home is simply there. */}
        {phase === "boot" && <BootScreen />}
        <div className="relative flex h-full flex-col overflow-hidden">
          <Backdrop />

          <div className="relative z-10 flex h-full min-h-0 flex-col">
            <TopBar onOpenPalette={() => setPaletteOpen(true)} />

            {/* Views crossfade with a soft rise — no hard cuts, no layout
                jank: the outgoing surface lifts away while the incoming one
                settles into place. mode="popLayout" lets both animate at
                once so switching feels continuous instead of gated. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 22, scale: 0.995, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -14, scale: 0.998, filter: "blur(4px)" }}
                transition={{
                  opacity: { duration: 0.26, ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                  scale: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                  filter: { duration: 0.3, ease: "easeOut" },
                }}
                className="accent-scroll min-h-0 min-w-0 flex-1 overflow-y-auto"
              >
                {view === "ai" ? <AiView onNavigate={navigate} /> : view === "settings" ? <SettingsView /> : <HomeView />}
              </motion.div>
            </AnimatePresence>

            {/* Nex remains visible as a layer above every routed view. */}
            <NexPresence view={view} onOpen={() => navigate("ai")} />

            <BottomDock view={view} onNavigate={navigate} />
          </div>

          {/* Search overlay */}
          <AnimatePresence>
            {paletteOpen && (
              <CommandPalette
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onNavigate={navigate}
              />
            )}
          </AnimatePresence>
        </div>
        </AiProvider>
      </McpProvider>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom dock — three destinations, nothing else                      */
/* ------------------------------------------------------------------ */

function BottomDock({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <nav className="no-scrollbar flex h-[64px] shrink-0 items-stretch justify-center gap-1 border-t border-white/5 bg-[rgba(6,9,17,0.55)] px-4 backdrop-blur-2xl">
      {DOCK_NAV.map((item) => {
        const active = view === item.id;
        const Icon = item.icon;
        return (
          <motion.button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.955 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className={cn(
              "relative flex min-w-[86px] flex-1 max-w-[180px] flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-200",
              active ? "text-frost-100" : "text-frost-600 hover:bg-white/[0.04] hover:text-frost-300",
            )}
          >
            {active && (
              <motion.span
                layoutId="dock-active"
                transition={{ type: "spring", stiffness: 480, damping: 38 }}
                className="absolute top-0 h-[2px] w-8 rounded-full bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]"
              />
            )}
            <Icon size={19} strokeWidth={active ? 2.2 : 1.7} className={cn("transition-all duration-300", active ? "text-accent drop-shadow-[0_0_10px_var(--accent-glow)]" : "")} />
            <span className={cn("text-[10px] leading-none transition-all duration-200", active ? "font-semibold text-frost-100" : "font-medium")}>{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
