import { motion } from "framer-motion";
import { Activity, BookOpen, ChevronRight, FolderOpen, Folder, Home, LayoutGrid, Layers, Plus, SlidersHorizontal, Sparkles, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQyn } from "../lib/store";
import type { ViewId } from "../lib/types";
import { cn } from "../lib/utils";
import { useSystemInfo } from "../lib/system";
import { Avatar, useUi } from "./ui";

const NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "apps", label: "All applications", icon: LayoutGrid },
  { id: "folders", label: "Folder library", icon: FolderOpen },
];

const CENTER_NAV: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: "workspaces", label: "Workspaces", icon: Layers },
  { id: "vault", label: "Vault & graph", icon: BookOpen },
  { id: "system", label: "System center", icon: Activity },
  { id: "files", label: "File center", icon: Folder },
  { id: "tools", label: "Quick tools", icon: Wrench },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];

export function Sidebar({
  view,
  onNavigate,
  onOpenFolder,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  onOpenFolder: (folderId: string) => void;
}) {
  const { state } = useQyn();
  const { openAddApp } = useUi();
  const sys = useSystemInfo();

  const folderCounts = new Map(state.folders.map((f) => [f.id, state.apps.filter((a) => a.folderId === f.id).length]));

  return (
    <aside className="border-r border-white/6 bg-white/[0.025]">
      <div className="flex h-full w-[240px] flex-col max-md:hidden">
        {/* Logo — takes you home */}
        <button onClick={() => onNavigate("home")} className="group flex items-center gap-3 px-4 pb-3 pt-5 text-left">
          <div className="relative grid h-10 w-10 place-items-center rounded-[13px] bg-[linear-gradient(145deg,var(--accent),#3a5fd6)] shadow-[0_10px_28px_-8px_var(--accent-glow)] ring-1 ring-white/20">
            <div
              className="pointer-events-none absolute inset-0 rounded-[13px]"
              style={{ background: "linear-gradient(150deg, rgba(255,255,255,0.35), transparent 55%)" }}
            />
            <Sparkles size={19} className="relative text-white" strokeWidth={1.9} />
          </div>
          <div className="leading-tight">
            <p className="text-[15.5px] font-bold tracking-tight text-frost-100 transition group-hover:text-accent">QynOne</p>
            <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-frost-500">
              Command Center
            </p>
          </div>
        </button>

        {/* Profile chip */}
        <div className="px-3 pb-2">
          <button
            onClick={() => onNavigate("profile")}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition",
              view === "profile"
                ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-accent-soft"
                : "border-white/8 bg-white/4 hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] hover:bg-white/6",
            )}
          >
            <Avatar name={state.profile.name || "QynOne"} color={state.profile.color} size={34} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-frost-100">
                {state.profile.name || "Your profile"}
              </span>
              <span className="block truncate text-[10.5px] font-medium text-frost-500">
                {state.profile.name ? "Personal space" : "Set up your name"}
              </span>
            </span>
            <ChevronRight size={13} className="shrink-0 text-frost-500 transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        </div>

        {/* Add button */}
        <div className="px-4">
          <button
            onClick={() => openAddApp()}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] hover:border-[color-mix(in_srgb,var(--accent)_65%,transparent)]"
          >
            <Plus size={15} strokeWidth={2.2} /> Add application
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((item) => (
            <NavButton key={item.id} item={item} view={view} onNavigate={onNavigate} />
          ))}

          {/* Command center */}
          <div className="px-1 pb-1 pt-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
              Command center
            </p>
          </div>
          {CENTER_NAV.map((item) => (
            <NavButton key={item.id} item={item} view={view} onNavigate={onNavigate} />
          ))}

          {/* Quick folders */}
          <div className="px-1 pb-1 pt-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
              Virtual folders
            </p>
          </div>
          {state.folders.slice(0, 6).map((f) => (
            <button
              key={f.id}
              onClick={() => onOpenFolder(f.id)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium text-frost-400 transition hover:bg-white/5 hover:text-frost-200"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: f.color, boxShadow: `0 0 8px ${f.color}66` }}
              />
              <span className="truncate">{f.name}</span>
              <span className="ml-auto text-[11px] tabular-nums text-frost-600">
                {folderCounts.get(f.id) ?? 0}
              </span>
            </button>
          ))}
        </nav>

        {/* System mini panel — opens the system center */}
        <div className="p-3">
          <button
            onClick={() => onNavigate("system")}
            className="glass-soft block w-full rounded-xl p-3 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-white/6"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[12px] font-semibold text-frost-200">{sys.os}</p>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11.5px] text-frost-500">
              <span>{sys.memoryGb} GB RAM</span>
              <span>{sys.cores} cores</span>
            </div>
            <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-700"
                style={{ width: `${sys.load}%`, opacity: 0.75 }}
              />
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Single nav item                                                     */
/* ------------------------------------------------------------------ */

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
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-150",
        active
          ? "bg-accent-soft text-frost-100 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)_inset]"
          : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)]"
        />
      )}
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-accent" : "text-frost-500 group-hover:text-frost-300"} />
      {item.label}
    </button>
  );
}