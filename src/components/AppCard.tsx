import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, MoreHorizontal, Pencil, Play, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQyn } from "../lib/store";
import type { AppItem } from "../lib/types";
import { cn, timeAgo } from "../lib/utils";
import { AppIcon } from "./AppIcon";
import { useLaunch, useUi } from "./ui";

interface AppCardProps {
  app: AppItem;
  delay?: number;
  showLastOpened?: boolean;
}

export function AppCard({ app, delay = 0, showLastOpened }: AppCardProps) {
  const { state, actions } = useQyn();
  const { toast, openEditApp } = useUi();
  const launch = useLaunch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const motionEnabled = state.settings.motion;
  const lastOpened = state.recents.find((r) => r.appId === app.id)?.lastOpened;
  const folderName = app.folderId ? state.folders.find((f) => f.id === app.folderId)?.name : undefined;

  return (
    <motion.div
      initial={motionEnabled ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={motionEnabled ? { y: -5 } : undefined}
      className="group relative"
    >
      <button
        onClick={() => launch(app)}
        className={cn(
          "glass-soft relative w-full rounded-2xl p-4 text-left transition-colors duration-200",
          "hover:border-[color-mix(in_srgb,var(--accent)_32%,transparent)] hover:shadow-[0_16px_44px_-18px_var(--accent-glow)]",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <AppIcon icon={app.icon} color={app.color} size={44} />
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                actions.toggleFavorite(app.id);
              }}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg transition",
                app.favorite ? "text-accent" : "text-frost-500 opacity-0 hover:bg-white/8 hover:text-frost-200 group-hover:opacity-100",
              )}
              aria-label={app.favorite ? "Unfavorite" : "Favorite"}
            >
              <Star size={14} fill={app.favorite ? "currentColor" : "none"} strokeWidth={2} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMoveOpen(false);
                setMenuOpen((v) => !v);
              }}
              className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 opacity-0 transition hover:bg-white/8 hover:text-frost-200 group-hover:opacity-100"
              aria-label="More options"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        <p className="mt-3 truncate text-[14px] font-semibold tracking-tight text-frost-100">
          {app.name}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-frost-500">
          {showLastOpened && lastOpened ? (
            <span className="inline-flex items-center gap-1">
              <Play size={9} className="text-frost-500" /> opened {timeAgo(lastOpened)}
            </span>
          ) : (
            (app.subtitle ?? (folderName ? `In ${folderName}` : "Unfiled"))
          )}
        </p>
      </button>

      {/* Context menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.14 }}
              className="glass-strong absolute right-0 top-6 z-50 w-52 origin-top-right overflow-hidden rounded-xl p-1.5"
            >
              <MenuButton
                icon={<Play size={14} />}
                label="Launch"
                onClick={() => {
                  setMenuOpen(false);
                  launch(app);
                }}
              />
              <MenuButton
                icon={<Star size={14} />}
                label={app.favorite ? "Unfavorite" : "Add to favorites"}
                onClick={() => {
                  actions.toggleFavorite(app.id);
                  setMenuOpen(false);
                }}
              />
              <MenuButton
                icon={<FolderOpen size={14} />}
                label="Move to folder"
                active={moveOpen}
                onClick={() => setMoveOpen((v) => !v)}
              />
              <AnimatePresence initial={false}>
                {moveOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-1 mb-1 mt-0.5 space-y-0.5 rounded-lg border border-white/6 bg-white/3 p-1">
                      <MoveRow
                        label="Unfiled"
                        indent
                        selected={app.folderId === null}
                        onClick={() => {
                          actions.moveApp(app.id, null);
                          setMenuOpen(false);
                          toast(`${app.name} moved to Unfiled`);
                        }}
                      />
                      {state.folders.map((f) => (
                        <MoveRow
                          key={f.id}
                          label={f.name}
                          indent
                          dot={f.color}
                          selected={app.folderId === f.id}
                          onClick={() => {
                            actions.moveApp(app.id, f.id);
                            setMenuOpen(false);
                            toast(`${app.name} moved to ${f.name}`);
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <MenuButton
                icon={<Pencil size={14} />}
                label="Edit…"
                onClick={() => {
                  setMenuOpen(false);
                  openEditApp(app.id);
                }}
              />
              <div className="mx-2 my-1 h-px bg-white/6" />
              <MenuButton
                icon={<Trash2 size={14} />}
                label="Remove"
                danger
                onClick={() => {
                  actions.removeApp(app.id);
                  setMenuOpen(false);
                  toast(`${app.name} removed from QynOne`);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  danger,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition",
        danger
          ? "text-red-300 hover:bg-red-500/12 hover:text-red-200"
          : active
            ? "bg-accent-soft text-frost-100"
            : "text-frost-300 hover:bg-white/8 hover:text-frost-100",
      )}
    >
      <span className={cn("grid place-items-center", danger ? "text-red-300/80" : "text-frost-500")}>
        {icon}
      </span>
      {label}
    </button>
  );
}

function MoveRow({
  label,
  onClick,
  dot,
  indent,
  selected,
}: {
  label: string;
  onClick: () => void;
  dot?: string;
  indent?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition",
        selected ? "bg-accent-soft text-frost-100" : "text-frost-400 hover:bg-white/8 hover:text-frost-200",
        indent && "pl-5",
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} /> : <FolderOpen size={11} className="text-frost-500" />}
      <span className="truncate">{label}</span>
      {selected && <span className="ml-auto h-1 w-1 rounded-full bg-[var(--accent)]" />}
    </button>
  );
}