import { motion } from "framer-motion";
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
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ViewId } from "../lib/types";
import { cn } from "../lib/utils";

const NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "apps", label: "Applications", icon: LayoutGrid },
  { id: "folders", label: "Folders", icon: FolderOpen },
];

const CENTER_NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "workspaces", label: "Workspaces", icon: Layers },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "vault", label: "Vault", icon: BookOpen },
  { id: "system", label: "System", icon: Activity },
  { id: "files", label: "Files", icon: Folder },
  { id: "tools", label: "Tools", icon: Wrench },
];

export function Sidebar({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <aside className="border-r border-white/5 bg-white/[0.015]">
      <div className="flex h-full w-[224px] flex-col max-md:hidden">
        {/* Logo — home */}
        <button onClick={() => onNavigate("home")} className="group flex items-center gap-2.5 px-5 pb-5 pt-5 text-left">
          <div className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-[linear-gradient(145deg,var(--accent),#3a5fd6)] shadow-[0_8px_22px_-8px_var(--accent-glow)] ring-1 ring-white/20">
            <Sparkles size={15} className="text-white" strokeWidth={2} />
          </div>
          <div className="leading-none">
            <p className="text-[14.5px] font-bold tracking-tight text-frost-100">QynOne</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-frost-600">Nex inside</p>
          </div>
        </button>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {NAV.map((item) => (
            <NavButton key={item.id} item={item} view={view} onNavigate={onNavigate} />
          ))}

          <div className="px-3 pb-1 pt-5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-frost-600">Center</div>
          {CENTER_NAV.map((item) => (
            <NavButton key={item.id} item={item} view={view} onNavigate={onNavigate} />
          ))}
        </nav>

        {/* Bottom: You + Settings */}
        <div className="grid grid-cols-2 gap-1 border-t border-white/5 p-2">
          <BottomButton active={view === "profile"} label="You" icon={User} onClick={() => onNavigate("profile")} />
          <BottomButton active={view === "settings"} label="Settings" icon={SlidersHorizontal} onClick={() => onNavigate("settings")} />
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  item,
  view,
  onNavigate,
}: {
  item: { id: ViewId; label: string; icon: LucideIcon };
  view: ViewId;
  onNavigate: (v: ViewId) => void;
}) {
  const active = view === item.id;
  const Icon = item.icon;
  return (
    <button
      onClick={() => onNavigate(item.id)}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] font-medium transition-colors",
        active ? "bg-white/[0.06] text-frost-100" : "text-frost-500 hover:bg-white/[0.035] hover:text-frost-200",
      )}
    >
      {active && <motion.span layoutId="nav-dot" className="absolute -left-0.5 h-3.5 w-[2px] rounded-full bg-[var(--accent)]" />}
      <Icon size={15} strokeWidth={active ? 2.1 : 1.7} className={cn(active ? "text-accent" : "text-frost-600 group-hover:text-frost-300")} />
      {item.label}
    </button>
  );
}

function BottomButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] font-medium transition-colors",
        active ? "bg-white/[0.06] text-frost-100" : "text-frost-500 hover:bg-white/[0.035] hover:text-frost-200",
      )}
    >
      <Icon size={14} className={active ? "text-accent" : ""} />
      {label}
    </button>
  );
}