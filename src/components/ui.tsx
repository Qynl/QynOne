import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { getDesktop } from "../lib/desktop";
import type { AppItem } from "../lib/types";
import { uid } from "../lib/utils";
import { useQyn } from "../lib/store";
import { cn, initials, shade } from "../lib/utils";
import { AppModal, FolderModal, WorkspaceModal } from "./modals";

/* ------------------------------------------------------------------ */
/* Toasts + launch helper                                              */
/* ------------------------------------------------------------------ */

interface Toast {
  id: string;
  message: string;
  icon?: ReactNode;
}

interface UiApi {
  toast: (message: string, opts?: { icon?: ReactNode; duration?: number }) => void;
  openAddApp: (folderId?: string | null) => void;
  openEditApp: (appId: string) => void;
  openFolderModal: (folderId?: string) => void;
  openWorkspaceModal: (workspaceId?: string) => void;
}

const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modal, setModal] = useState<
    | { kind: "add-app"; folderId: string | null }
    | { kind: "edit-app"; appId: string }
    | { kind: "folder"; folderId?: string }
    | { kind: "workspace"; workspaceId?: string }
    | null
  >(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (message: string, opts?: { icon?: ReactNode; duration?: number }) => {
      const id = uid();
      const duration = opts?.duration ?? 2400;
      setToasts((t) => [...t.slice(-3), { id, message, icon: opts?.icon }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((t) => clearTimeout(t));
      current.clear();
    };
  }, []);

  const api = useMemo<UiApi>(
    () => ({
      toast,
      openAddApp: (folderId: string | null = null) => setModal({ kind: "add-app", folderId }),
      openEditApp: (appId: string) => setModal({ kind: "edit-app", appId }),
      openFolderModal: (folderId?: string) => setModal({ kind: "folder", folderId }),
      openWorkspaceModal: (workspaceId?: string) => setModal({ kind: "workspace", workspaceId }),
    }),
    [toast],
  );

  return (
    <UiContext.Provider value={api}>
      {children}

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[320px] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass-strong pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-xl py-3 pl-3.5 pr-4"
            >
              {t.icon ?? (
                <span className="relative grid h-6 w-6 place-items-center">
                  <span className="absolute inset-0 rounded-full bg-[var(--accent-soft)]" />
                  <CheckCircle2 size={15} className="relative text-accent" strokeWidth={2.2} />
                </span>
              )}
              <span className="text-[13px] font-medium text-frost-100">{t.message}</span>
              <span
                className="absolute inset-x-0 bottom-0 h-[2px]"
                style={{ background: "var(--accent)" }}
              >
                <motion.span
                  className="block h-full w-full bg-white/30"
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 2.4, ease: "linear" }}
                  style={{ transformOrigin: "left" }}
                />
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal layer */}
      <AnimatePresence>
        {modal &&
          (modal.kind === "folder" ? (
            <FolderModal key="folder-modal" folderId={modal.folderId} onClose={() => setModal(null)} />
          ) : modal.kind === "workspace" ? (
            <WorkspaceModal
              key="workspace-modal"
              workspaceId={modal.workspaceId}
              onClose={() => setModal(null)}
            />
          ) : (
            <AppModal
              key="app-modal"
              appId={modal.kind === "edit-app" ? modal.appId : undefined}
              presetFolderId={modal.kind === "add-app" ? modal.folderId : undefined}
              onClose={() => setModal(null)}
            />
          ))}
      </AnimatePresence>
    </UiContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Profile avatar                                                      */
/* ------------------------------------------------------------------ */

export function Avatar({
  name,
  color,
  size = 40,
  ring,
}: {
  name: string;
  color: string;
  size?: number;
  /** subtle accent ring around the avatar */
  ring?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full shadow-[0_10px_28px_-10px_rgba(0,0,0,0.75)]",
        ring ? "ring-2 ring-[color-mix(in_srgb,var(--accent)_55%,transparent)]" : "ring-1 ring-white/15",
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${color} 0%, ${shade(color, -34)} 100%)`,
      }}
    >
      <span
        className="relative font-bold tracking-wide text-white"
        style={{ fontSize: Math.max(11, Math.round(size * 0.36)) }}
      >
        {initials(name)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Launch helper                                                       */
/* ------------------------------------------------------------------ */

export function useLaunch() {
  const { actions } = useQyn();
  const { toast } = useUi();
  return useCallback(
    (app: AppItem) => {
      actions.recordLaunch(app.id);
      const bridge = getDesktop();

      /* Desktop app: launch the real application through the OS shell. */
      if (bridge) {
        if (!app.launchUri) {
          toast(`Set a launch target for ${app.name}`, {
            icon: <Info size={15} className="text-accent" />,
          });
          return;
        }
        toast(`Launching ${app.name}…`);
        bridge
          .launch(app.launchUri)
          .then((res) => {
            if (res.ok) {
              toast(`${app.name} is opening`);
            } else {
              toast(res.error ? `${app.name} couldn’t open — ${res.error}` : `${app.name} couldn’t open`, {
                icon: <AlertTriangle size={15} className="text-amber-300" />,
              });
            }
          })
          .catch(() => {
            toast(`${app.name} couldn’t open`, {
              icon: <AlertTriangle size={15} className="text-amber-300" />,
            });
          });
        return;
      }

      /* Web preview: open the target in a new tab. */
      toast(`Launching ${app.name}…`);
      if (app.launchUri) {
        window.setTimeout(() => window.open(app.launchUri, "_blank", "noopener,noreferrer"), 350);
      }
    },
    [actions, toast],
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200",
        checked
          ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent"
          : "border-white/10 bg-white/8",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-md transition-all duration-200",
          checked ? "left-[19px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

export function SectionHeader({
  title,
  action,
  icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="h-4 w-[3px] rounded-full bg-[var(--accent)]" />
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-frost-300">
          {title}
        </h2>
        {icon}
      </div>
      {action}
    </div>
  );
}