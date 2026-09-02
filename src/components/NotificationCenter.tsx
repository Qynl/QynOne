import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQyn } from "../lib/store";
import type { NotificationKind } from "../lib/types";
import { timeAgo } from "../lib/utils";

export function NotificationCenter() {
  const { state, actions } = useQyn();
  const [open, setOpen] = useState(false);

  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) actions.markNotificationsRead();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-white/8 bg-white/4 text-frost-400 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9.5px] font-bold text-white shadow-[0_4px_12px_-2px_var(--accent-glow)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[45]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="glass-strong absolute right-0 top-[calc(100%+10px)] z-[50] w-[340px] overflow-hidden rounded-2xl shadow-[0_32px_90px_-24px_rgba(0,0,0,0.85)]"
            >
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <p className="text-[13px] font-semibold text-frost-100">Notifications</p>
                {state.notifications.length > 0 && (
                  <button
                    onClick={() => actions.clearNotifications()}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-frost-500 transition hover:bg-white/6 hover:text-frost-300"
                  >
                    <Trash2 size={11} /> Clear all
                  </button>
                )}
              </div>

              <div className="accent-scroll max-h-[52vh] overflow-y-auto p-2">
                {state.notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <Bell size={20} className="mx-auto text-frost-500/60" />
                    <p className="mt-2 text-[13px] text-frost-400">All caught up</p>
                    <p className="mt-0.5 text-[12px] text-frost-500">
                      Updates and activity will land here.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {state.notifications.map((n) => (
                      <li
                        key={n.id}
                        className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/4 ${
                          n.read ? "opacity-60" : ""
                        }`}
                      >
                        <NotificationGlyph kind={n.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-frost-100">{n.title}</p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-frost-400">{n.body}</p>
                          <p className="mt-1 text-[10.5px] font-medium text-frost-600">{timeAgo(n.time)}</p>
                        </div>
                        {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotificationGlyph({ kind }: { kind: NotificationKind }) {
  if (kind === "warn") return <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />;
  if (kind === "success") return <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />;
  return <Info size={16} className="mt-0.5 shrink-0 text-accent" />;
}