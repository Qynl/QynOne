import { motion } from "framer-motion";
import { CornerDownLeft, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAi } from "../lib/ai";
import type { ViewId } from "../lib/types";
import { cn } from "../lib/utils";

interface Result {
  key: string;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * Ctrl+K is a small, quiet launcher over the three surfaces — and above all
 * a direct line to Nex: type a question, press enter, he takes it.
 */
export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: ViewId) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemoResults(query, onNavigate, onClose);

  useEffect(() => {
    setSelected((s) => Math.max(0, Math.min(s, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const isAsk = selected === results.length - 1 && query.trim().length >= 3;

  function runAt(index: number) {
    results[index]?.run();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[55]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="absolute inset-0 bg-[#02040a]/55 backdrop-blur-[7px]" onClick={onClose} />

      <div className="relative mx-auto mt-[16vh] w-full max-w-[560px] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -6 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="glass-strong overflow-hidden rounded-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        >
          {/* Input row */}
          <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
            <Search size={17} className="shrink-0 text-accent" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelected((s) => Math.min(s + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected((s) => Math.max(s - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  runAt(selected);
                } else if (e.key === "Escape") {
                  onClose();
                } else if (e.key === "Backspace" && query === "" && results.length === 0) {
                  onClose();
                }
              }}
              placeholder="Ask Nex anything…"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-frost-100 outline-none placeholder:text-frost-500/70"
            />
            <span className="kbd shrink-0">esc</span>
          </div>

          {/* Results */}
          <div className="max-h-[46vh] overflow-y-auto p-2">
            {results.map((r, idx) => (
              <button
                key={r.key}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => runAt(idx)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  idx === selected ? "bg-accent-soft" : "hover:bg-white/4",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-white/10 bg-white/6 text-frost-300">
                  <Sparkles size={14} className={idx === results.length - 1 && query.trim().length >= 3 ? "text-accent" : "text-frost-400"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13.5px] font-medium", idx === selected ? "text-frost-100" : "text-frost-200")}>{r.label}</span>
                  {r.hint && <span className="block truncate text-[11.5px] text-frost-500">{r.hint}</span>}
                </span>
                {idx === selected && <CornerDownLeft size={13} className="shrink-0 text-frost-500" />}
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-4 py-8 text-center text-[12.5px] text-frost-500">Type a question and press enter — Nex answers.</p>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/6 px-4 py-2 text-[10.5px] text-frost-600">
            <span>enter to {isAsk ? "ask Nex" : "open"}</span>
            <span>Home · Nex · Settings</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* The results list, memoized against the query. */
function useMemoResults(
  query: string,
  onNavigate: (v: ViewId) => void,
  onClose: () => void,
): Result[] {
  const { send, busy: nexBusy } = useAi();
  return useMemo<Result[]>(() => {
    const q = query.trim();
    const match = (...parts: Array<string | undefined>) =>
      q.length === 0 || parts.filter(Boolean).some((p) => p!.toLowerCase().includes(q.toLowerCase()));

    const nav: Result[] = [
      {
        key: "nav-home",
        label: "Go Home",
        hint: "Nex on Home",
        run: () => {
          onClose();
          onNavigate("home");
        },
      },
      {
        key: "nav-ai",
        label: "Open the Nex workshop",
        hint: "Build with your connected engines",
        run: () => {
          onClose();
          onNavigate("ai");
        },
      },
      {
        key: "nav-settings",
        label: "Open settings",
        hint: "Engine connections, model, startup",
        run: () => {
          onClose();
          onNavigate("settings");
        },
      },
    ].filter((r) => match(r.label, r.hint));

    /* A real question typed → asking Nex is the whole point of the palette. */
    if (q.length >= 3) {
      nav.push({
        key: "ask-nex",
        label: nexBusy ? "Nex is thinking…" : `Ask Nex: “${q.length > 64 ? q.slice(0, 64) + "…" : q}”`,
        hint: nexBusy ? "He'll take this next" : "Press enter — Nex answers and acts",
        run: () => {
          if (nexBusy) return;
          onClose();
          void send(q, { voice: true });
        },
      });
    }
    return nav;
  }, [query, onNavigate, onClose, send, nexBusy]);
}
