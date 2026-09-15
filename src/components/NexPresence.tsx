import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AiFace } from "./AiFace";
import { useAi } from "../lib/ai";
import type { NexThought } from "../lib/ai";
import { useMusic } from "../lib/music";
import type { ViewId } from "../lib/types";
import { cn } from "../lib/utils";

const VIEW_LABELS: Record<ViewId, string> = {
  home: "home",
  ai: "Nex workshop",
  settings: "settings",
};

/**
 * Nex stays present above the routed interface. The text is a public activity
 * trace, not private chain-of-thought: it only reports an action or observation
 * the user can verify in QynOne.
 */
export function NexPresence({ view, onOpen }: { view: ViewId; onOpen: () => void }) {
  const { thoughts, emotion, announce, voiceEnabled, setVoiceEnabled, react, intensity } = useAi();
  const music = useMusic();
  const lastView = useRef<ViewId | null>(null);

  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (view === "home") {
      announce("*settling in at home*");
      return;
    }
    announce(`*looking through ${VIEW_LABELS[view]}*`);
    react({ kind: "view-change", view });
  }, [view, announce, react]);

  /* The Nex bubble can be dragged anywhere — it is a little companion, not
     glued to the corner. Plain clicks still work; only real drags move it. */
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{
    px: number;
    py: number;
    sx: number;
    sy: number;
    w: number;
    h: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragUp);
    };
  }, []);

  const visibleThoughts = useMemo(() => thoughts.slice(-4), [thoughts]);

  if (view === "home") return null;

  function onDragMove(e: PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (!d.moved) return;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - d.w - 8, d.sx + dx)),
      y: Math.max(8, Math.min(window.innerHeight - d.h - 8, d.sy + dy)),
    });
  }

  function onDragUp() {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    const d = drag.current;
    drag.current = null;
    /* A drag must not trigger the button clicks underneath the pointer. */
    if (d?.moved) {
      const suppress = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener("click", suppress, true);
      };
      window.addEventListener("click", suppress, true);
    }
  }

  function onCardPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      sx: pos?.x ?? window.innerWidth - rect.width - 16,
      sy: pos?.y ?? window.innerHeight - rect.height - 84,
      w: rect.width,
      h: rect.height,
      moved: false,
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }

  return (
    <motion.div
      ref={cardRef}
      onPointerDown={onCardPointerDown}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{ touchAction: "none", ...(pos ? { left: pos.x, top: pos.y } : {}) }}
      className={cn(
        "fixed z-30 w-[184px] max-w-[calc(100vw-2rem)] cursor-grab select-none active:cursor-grabbing",
        pos ? "" : "bottom-[76px] right-4",
      )}
    >
      <div className="glass-soft flex w-full flex-col items-center rounded-2xl px-3 pb-2.5 pt-2 transition hover:border-accent-soft hover:bg-white/[0.045]">
        <button type="button" onClick={onOpen} className="flex w-full flex-col items-center" aria-label="Open Nex workspace">
          <AiFace emotion={emotion} size={104} intensity={intensity} headphones={Boolean(music)} dance={Boolean(music)} />
          {music ? <p className="mt-0.5 w-full truncate px-1 text-center text-[8.5px] italic leading-3 text-accent">♫ {music.title}</p> : <NexThoughtStream thoughts={visibleThoughts} compact />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (voiceEnabled) window.speechSynthesis?.cancel();
            setVoiceEnabled(!voiceEnabled);
            announce(voiceEnabled ? "*voice listening stopped*" : "*voice listening enabled — say Nex*", voiceEnabled ? "settled" : "listening");
          }}
          className="mt-1 grid h-7 w-7 place-items-center rounded-full text-frost-500 transition hover:bg-white/6 hover:text-frost-100"
          aria-label={voiceEnabled ? "Stop listening" : "Enable Nex voice"}
          title={voiceEnabled ? "Stop listening" : "Enable Nex voice"}
        >
          {voiceEnabled ? <Mic size={12} className="text-accent" /> : <MicOff size={12} />}
        </button>
      </div>
    </motion.div>
  );
}

export function NexThoughtStream({ thoughts, compact = false, detached = false }: { thoughts: NexThought[]; compact?: boolean; detached?: boolean }) {
  const visible = thoughts.slice(-3);
  if (visible.length === 0) return null;
  return (
    <div
      className={
        detached
          ? "pointer-events-none absolute left-1/2 top-[calc(100%+14px)] w-[min(80vw,420px)] -translate-x-1/2 overflow-hidden text-center"
          : compact
            ? "mt-0.5 w-full overflow-hidden text-center"
            : "pointer-events-none w-full max-w-[340px] overflow-hidden text-center"
      }
      aria-live="polite"
    >
      {visible.map((thought, index) => {
        const newest = index === visible.length - 1;
        /* Thinking is shown italic, never with visible * markers. */
        const text = thought.text.replace(/\*/g, "").trim();
        return (
          <motion.p
            key={thought.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: newest ? 0.94 : index === visible.length - 2 ? 0.3 : 0.12, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={
              detached
                ? newest
                  ? "truncate text-[12px] italic leading-5 text-frost-300"
                  : "truncate text-[10px] italic leading-4 text-frost-600"
                : compact
                  ? newest
                    ? "truncate text-[9.5px] italic leading-4 text-frost-300"
                    : "truncate text-[9px] italic leading-4 text-frost-600"
                  : newest
                    ? "truncate text-[11px] italic leading-5 text-frost-300"
                    : "truncate text-[10px] italic leading-5 text-frost-600"
            }
          >
            {text}
          </motion.p>
        );
      })}
    </div>
  );
}
