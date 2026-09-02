import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BatteryCharging,
  Clock4,
  Cpu,
  EyeOff,
  GripVertical,
  LayoutGrid,
  MemoryStick,
  Monitor,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppIcon } from "../components/AppIcon";
import { Avatar } from "../components/ui";
import { FolderCard } from "../components/FolderCard";
import { RecentsPanel, SystemPanel } from "../components/panels";
import { useLaunch, useUi } from "../components/ui";
import { useQyn } from "../lib/store";
import { useStats } from "../lib/stats";
import { useSystemInfo } from "../lib/system";
import type { AppItem, Folder, ViewId } from "../lib/types";
import { clockTime, greeting, prettyToday } from "../lib/utils";
import { HOME_WIDGETS } from "../lib/widgets";

export function HomeView({
  onNavigate,
  onOpenFolder,
  onOpenPalette,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenPalette: () => void;
}) {
  const { state, actions } = useQyn();
  const { openAddApp } = useUi();
  const dragIndex = useRef<number | null>(null);

  const hidden = state.settings.hiddenWidgets.filter((id) => HOME_WIDGETS.some((w) => w.id === id));
  const order = state.settings.homeOrder.filter((id) => !hidden.includes(id));

  const favorites = useMemo(() => state.apps.filter((a) => a.favorite), [state.apps]);
  const hotFolders = useMemo(
    () =>
      [...state.folders].sort((a, b) => {
        const ca = state.apps.filter((x) => x.folderId === a.id).length;
        const cb = state.apps.filter((x) => x.folderId === b.id).length;
        return cb - ca;
      }),
    [state.folders, state.apps],
  );
  function reorder(from: number, to: number) {
    const list = [...order];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    actions.patchSettings({ homeOrder: [...list, ...hidden] });
  }

  const widgets: Record<string, () => ReactNode> = {
    status: () => <StatusWidget />,
    quick: () => (
      <QuickWidget
        favorites={favorites}
        onAdd={() => openAddApp()}
        onViewAll={() => onNavigate("apps")}
      />
    ),
    folders: () => (
      <FoldersWidget folders={hotFolders} onOpen={onOpenFolder} onAll={() => onNavigate("folders")} />
    ),
    hint: () => (
      <HintWidget
        appCount={state.apps.length}
        folderCount={state.folders.length}
        workspaceCount={state.workspaces.length}
        onOrganize={() => onNavigate("folders")}
      />
    ),
  };

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-7 md:px-8">
      {/* ---------- Hero ---------- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-center justify-between gap-5"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate("profile")}
              className="shrink-0"
              title={state.profile.name ? "Open your profile" : "Set up your profile"}
            >
              <Avatar name={state.profile.name} color={state.profile.color} size={56} ring />
            </motion.button>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-accent">
                {prettyToday()}
                {favorites.length > 0 && (
                  <span className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-frost-400 sm:inline-flex">
                    {favorites.length} pinned
                  </span>
                )}
              </p>
              <h1 className="mt-1 truncate text-[28px] font-bold leading-tight tracking-tight text-frost-100 md:text-[34px]">
                {greeting()}
                {state.profile.name ? `, ${state.profile.name}` : ""}.
              </h1>
              <p className="mt-1 text-[13.5px] text-frost-400">
                Everything you need is here —{" "}
                <span className="text-frost-200">{state.apps.length} applications</span>,{" "}
                <span className="text-frost-200">{state.folders.length} folders</span>,{" "}
                <span className="text-frost-200">{state.workspaces.length} workspaces</span>.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenPalette}
            className="glass-soft group mt-5 flex h-11 w-full max-w-md items-center gap-3 rounded-full border px-4 text-left transition-all duration-200 hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:bg-white/6 hover:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <Search size={16} className="shrink-0 text-frost-500 transition group-hover:text-accent" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-frost-400">
              Search apps, files, folders, actions…
            </span>
            <span className="kbd hidden shrink-0 sm:inline-flex">Ctrl K</span>
          </button>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="glass rounded-2xl px-5 py-4 text-right">
            <BigClock />
            <p className="mt-0.5 text-[12px] font-medium text-frost-500">{prettyToday()}</p>
          </div>
          <button
            onClick={() => onNavigate("apps")}
            className="glass-soft group flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-semibold text-frost-200 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
          >
            <LayoutGrid size={14} className="text-frost-400 transition group-hover:text-accent" />
            Browse library
            <ArrowRight size={14} className="text-frost-500 transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        </div>
      </motion.div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_326px]">
        {/* Left column — your widgets */}
        <div className="min-w-0 space-y-8">
          {order.map((id, i) => {
            const def = HOME_WIDGETS.find((w) => w.id === id);
            const render = widgets[id];
            if (!def || !render) return null;
            return (
              <WidgetShell
                key={id}
                label={def.label}
                onDragStart={() => {
                  dragIndex.current = i;
                }}
                onDrop={() => {
                  const from = dragIndex.current;
                  dragIndex.current = null;
                  if (from === null || from === i) return;
                  reorder(from, i);
                }}
                onHide={() =>
                  actions.patchSettings({ hiddenWidgets: [...state.settings.hiddenWidgets, id] })
                }
              >
                {render()}
              </WidgetShell>
            );
          })}

          {/* Restore hidden widgets */}
          {hidden.length > 0 && (
            <section className="flex flex-wrap items-center gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-frost-500">
                Hidden widgets
              </p>
              {hidden.map((id) => {
                const def = HOME_WIDGETS.find((w) => w.id === id);
                if (!def) return null;
                return (
                  <button
                    key={id}
                    onClick={() =>
                      actions.patchSettings({
                        hiddenWidgets: state.settings.hiddenWidgets.filter((h) => h !== id),
                      })
                    }
                    className="glass-soft inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-frost-400 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-200"
                  >
                    <Plus size={12} /> {def.label}
                  </button>
                );
              })}
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <SystemPanel />
          <RecentsPanel />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Widget shell — drag to reorder, hide to tuck away                   */
/* ------------------------------------------------------------------ */

function WidgetShell({
  label,
  children,
  onDragStart,
  onDrop,
  onHide,
}: {
  label: string;
  children: ReactNode;
  onDragStart: () => void;
  onDrop: () => void;
  onHide: () => void;
}) {
  return (
    <section
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="group/widget"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GripVertical
            size={13}
            className="cursor-grab text-frost-600 opacity-0 transition group-hover/widget:opacity-100 hover:text-frost-400"
          />
          <span className="h-4 w-[3px] rounded-full bg-[var(--accent)]" />
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-frost-300">{label}</h2>
        </div>
        <button
          onClick={onHide}
          title="Hide widget"
          className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 opacity-0 transition hover:bg-white/8 hover:text-frost-200 group-hover/widget:opacity-100"
        >
          <EyeOff size={13} />
        </button>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* PC status widget                                                    */
/* ------------------------------------------------------------------ */

function StatusWidget() {
  const stats = useStats();
  const sys = useSystemInfo();
  const pct = sys.battery ? Math.round(sys.battery.level * 100) : null;
  const memPct = Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100);
  const memGb = Math.max(1, Math.round(stats.memTotalBytes / 2 ** 30));

  return (
    <div className="glass rounded-2xl p-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatChip icon={<Cpu size={13} />} label="CPU" value={`${stats.cpuPct}%`} bar={stats.cpuPct} />
        <StatChip icon={<MemoryStick size={13} />} label="Memory" value={`${memPct}% · ${memGb} GB`} bar={memPct} />
        {pct !== null ? (
          <StatChip
            icon={<BatteryCharging size={13} />}
            label="Battery"
            value={sys.battery?.charging ? `${pct}% · charging` : `${pct}%`}
            bar={pct}
            barClass="bg-[linear-gradient(90deg,var(--accent),#7ce0c9)]"
          />
        ) : (
          <StatChip icon={<Monitor size={13} />} label="System" value={sys.os} bar={0} barClass="bg-transparent" />
        )}
        <StatChip icon={<Clock4 size={13} />} label="Uptime" value={formatUptime(stats.uptimeSec)} bar={0} barClass="bg-transparent" />
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  bar,
  barClass,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  bar: number;
  barClass?: string;
}) {
  return (
    <div className="glass-soft rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-frost-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-[14px] font-bold tabular-nums tracking-tight text-frost-100">{value}</p>
      {bar > 0 && (
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/8">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barClass ?? "bg-[var(--accent)] opacity-70"}`}
            style={{ width: `${Math.min(100, bar)}%` }}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quick launch widget                                                 */
/* ------------------------------------------------------------------ */

function QuickWidget({
  favorites,
  onAdd,
  onViewAll,
}: {
  favorites: AppItem[];
  onAdd: () => void;
  onViewAll: () => void;
}) {
  if (favorites.length === 0) {
    return (
      <div className="glass-soft rounded-2xl border-dashed p-8 text-center">
        <Star size={22} className="mx-auto text-frost-500/60" />
        <p className="mt-2 text-[14px] font-medium text-frost-300">Nothing pinned yet</p>
        <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-frost-500">
          Pin your most-used applications and they’ll sit right here, one click away — like a dock for your real apps.
        </p>
        <button
          onClick={onViewAll}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-accent-soft px-4 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
        >
          <Star size={13} /> Pin some applications
        </button>
      </div>
    );
  }
  return (
    <>
      <div className="mb-2 flex items-center justify-end">
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-[12px] font-medium text-frost-500 transition hover:text-accent"
        >
          View all <ArrowRight size={12} />
        </button>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {favorites.map((app, i) => (
          <DockTile key={app.id} app={app} delay={Math.min(i * 0.04, 0.24)} />
        ))}
        <button
          onClick={onAdd}
          className="glass-soft group flex w-[92px] shrink-0 flex-col items-center justify-center gap-2.5 rounded-2xl border-dashed text-frost-500 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-accent"
        >
          <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-white/8 bg-white/4 transition group-hover:rotate-90">
            <Plus size={20} />
          </span>
          <span className="text-[11.5px] font-medium">Add app</span>
        </button>
      </div>
    </>
  );
}

function DockTile({ app, delay }: { app: AppItem; delay: number }) {
  const { state, actions } = useQyn();
  const launch = useLaunch();
  const motionOn = state.settings.motion;

  return (
    <motion.button
      initial={motionOn ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={motionOn ? { y: -5 } : undefined}
      whileTap={{ scale: 0.96 }}
      onClick={() => launch(app)}
      className="glass-soft group relative flex w-[92px] shrink-0 flex-col items-center gap-2.5 rounded-2xl p-3.5 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--accent)_32%,transparent)] hover:shadow-[0_16px_44px_-18px_var(--accent-glow)]"
      title={app.subtitle ? `${app.name} — ${app.subtitle}` : app.name}
    >
      <span
        role="button"
        aria-label={`Unpin ${app.name}`}
        onClick={(e) => {
          e.stopPropagation();
          actions.toggleFavorite(app.id);
        }}
        className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/8 text-frost-400 opacity-0 shadow-sm transition hover:bg-white/15 hover:text-white group-hover:opacity-100"
      >
        <Star size={10} fill="currentColor" />
      </span>
      <span className="transition-transform duration-200 group-hover:scale-105">
        <AppIcon icon={app.icon} color={app.color} size={46} rounded="rounded-[15px]" />
      </span>
      <span className="w-full truncate text-center text-[11.5px] font-medium text-frost-200">{app.name}</span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Folders widget                                                      */
/* ------------------------------------------------------------------ */

function FoldersWidget({
  folders,
  onOpen,
  onAll,
}: {
  folders: Folder[];
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  if (folders.length === 0) {
    return (
      <div className="glass-soft rounded-2xl border-dashed p-8 text-center">
        <p className="text-[13.5px] text-frost-400">No virtual folders yet</p>
        <p className="mt-1 text-[12.5px] text-frost-500">Folders organize your apps without touching Windows.</p>
      </div>
    );
  }
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {folders.slice(0, 6).map((folder, i) => (
        <div key={folder.id} className="w-[150px] shrink-0 snap-start">
          <FolderCard folder={folder} onOpen={() => onOpen(folder.id)} delay={Math.min(i * 0.05, 0.25)} />
        </div>
      ))}
      <button
        onClick={onAll}
        className="glass-soft flex h-full min-h-[128px] w-[150px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border-dashed text-frost-500 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-accent"
      >
        <Plus size={18} />
        <span className="text-[12.5px] font-medium">All folders</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Environment hint widget                                             */
/* ------------------------------------------------------------------ */

function HintWidget({
  appCount,
  folderCount,
  workspaceCount,
  onOrganize,
}: {
  appCount: number;
  folderCount: number;
  workspaceCount: number;
  onOrganize: () => void;
}) {
  return (
    <div className="glass-soft relative overflow-hidden rounded-2xl p-5">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 65%)", opacity: 0.55 }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14.5px] font-semibold text-frost-100">Your environment is growing</p>
          <p className="mt-0.5 text-[12.5px] text-frost-500">
            {appCount} apps organized across {folderCount} virtual folders and {workspaceCount} workspaces.
          </p>
        </div>
        <button
          onClick={onOrganize}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
        >
          Organize <ArrowUpRight size={13} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Big live clock for the hero                                         */
/* ------------------------------------------------------------------ */

function BigClock() {
  const [time, setTime] = useState(clockTime);
  useEffect(() => {
    const t = setInterval(() => setTime(clockTime()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-[34px] font-bold leading-none tabular-nums tracking-tight text-frost-100">{time}</p>
  );
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}