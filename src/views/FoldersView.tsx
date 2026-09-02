import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { AppCard } from "../components/AppCard";
import { AppIcon } from "../components/AppIcon";
import { FolderCard } from "../components/FolderCard";
import { useUi } from "../components/ui";
import { useQyn } from "../lib/store";
import type { ViewId } from "../lib/types";

export function FoldersView({
  activeFolderId,
  onSelectFolder,
  onNavigate,
}: {
  activeFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onNavigate: (v: ViewId) => void;
}) {
  const { state, actions } = useQyn();
  const { openFolderModal, openAddApp, toast } = useUi();
  const active = activeFolderId ? state.folders.find((f) => f.id === activeFolderId) : undefined;

  /* ---------- Folder detail ---------- */
  if (active) {
    const apps = state.apps.filter((a) => a.folderId === active.id);
    return (
      <div className="mx-auto w-full max-w-[1100px] px-5 py-7 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <nav className="flex flex-wrap items-center gap-1 text-[12.5px] font-medium text-frost-500">
            <button
              onClick={() => onNavigate("home")}
              className="flex items-center gap-1 rounded-md px-1 py-0.5 transition hover:text-accent"
            >
              <ChevronLeft size={13} /> Home
            </button>
            <ChevronRight size={12} className="text-frost-600" />
            <button
              onClick={() => onSelectFolder(null)}
              className="rounded-md px-1 py-0.5 transition hover:text-frost-200"
            >
              Folder library
            </button>
            <ChevronRight size={12} className="text-frost-600" />
            <span className="truncate text-frost-300">{active.name}</span>
          </nav>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <AppIcon icon={active.icon} color={active.color} size={56} rounded="rounded-[18px]" />
              </motion.div>
              <div>
                <h1 className="text-[26px] font-bold tracking-tight text-frost-100">{active.name}</h1>
                <p className="mt-0.5 text-[13px] text-frost-400">
                  {apps.length} {apps.length === 1 ? "item" : "items"} in this virtual folder
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openFolderModal(active.id)}
                className="glass-soft flex h-9 items-center gap-2 rounded-xl px-3 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
              >
                <Pencil size={13} /> Rename
              </button>
              <button
                onClick={() => openAddApp(active.id)}
                className="flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
              >
                <Plus size={14} /> Add application
              </button>
            </div>
          </div>

          {apps.length === 0 ? (
            <div className="glass-soft mt-10 rounded-2xl border-dashed p-14 text-center">
              <AppIcon icon={active.icon} color={active.color} size={52} />
              <p className="mt-4 text-[15px] font-semibold text-frost-200">This folder is empty</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-frost-500">
                Add applications to “{active.name}” to keep everything in your environment organized.
              </p>
              <button
                onClick={() => openAddApp(active.id)}
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-accent-soft px-4 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
              >
                <Plus size={14} /> Add application here
              </button>
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {apps.map((app, i) => (
                <AppCard key={app.id} app={app} delay={Math.min(i * 0.03, 0.24)} />
              ))}
            </div>
          )}

          <div className="mt-10">
            <button
              onClick={() => {
                actions.removeFolder(active.id);
                toast(`Deleted folder ${active.name}`);
                onSelectFolder(null);
              }}
              className="flex items-center gap-1.5 text-[12px] font-medium text-frost-600 transition hover:text-red-300"
            >
              <Trash2 size={12} /> Delete “{active.name}” — applications stay in your library
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------- Folder library ---------- */
  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 py-7 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-frost-100">Folder library</h1>
          <p className="mt-1 text-[13.5px] text-frost-400">
            Virtual folders are pure QynOne — they never touch your real Windows folders.
          </p>
        </div>
        <button
          onClick={() => openFolderModal()}
          className="flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <FolderPlus size={15} /> New folder
        </button>
      </motion.div>

      {state.folders.length === 0 ? (
        <div className="glass-soft mt-8 rounded-2xl border-dashed p-14 text-center">
          <AppIcon icon="folderOpen" color="#5b8cff" size={52} />
          <p className="mt-4 text-[15px] font-semibold text-frost-200">No folders yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-frost-500">
            Create your first virtual folder (e.g. “Games”) and start organizing your environment.
          </p>
          <button
            onClick={() => openFolderModal()}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-accent-soft px-4 text-[13px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
          >
            <FolderPlus size={14} /> Create folder
          </button>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {state.folders.map((f, i) => (
            <FolderCard key={f.id} folder={f} onOpen={() => onSelectFolder(f.id)} delay={Math.min(i * 0.04, 0.24)} />
          ))}
          <button
            onClick={() => openFolderModal()}
            className="glass-soft grid min-h-[132px] place-items-center rounded-2xl border-dashed text-frost-500 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-accent"
          >
            <span className="flex flex-col items-center gap-2">
              <FolderPlus size={20} />
              <span className="text-[12.5px] font-medium">New folder</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}