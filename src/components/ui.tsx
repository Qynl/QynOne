import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { uid } from "../lib/utils";
import { cn } from "../lib/utils";

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

interface Toast {
  id: string;
  message: string;
  icon?: ReactNode;
  duration: number;
}

interface UiApi {
  toast: (message: string, opts?: { icon?: ReactNode; duration?: number }) => void;
}

const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside UiProvider");
  return ctx;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
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
      setToasts((t) => [...t.slice(-3), { id, message, icon: opts?.icon, duration }]);
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

  const api = useMemo<UiApi>(() => ({ toast }), [toast]);

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
                  transition={{ duration: t.duration / 1000, ease: "linear" }}
                  style={{ transformOrigin: "left" }}
                />
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </UiContext.Provider>
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
