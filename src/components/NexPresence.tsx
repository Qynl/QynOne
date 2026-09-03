import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AiFace } from "./AiFace";
import { useAi, type NexThought } from "../lib/ai";
import { useQyn } from "../lib/store";
import { useStats } from "../lib/stats";
import { useSystemInfo } from "../lib/system";
import { useVault } from "../lib/vault";
import { useMusic } from "../lib/music";
import type { ViewId } from "../lib/types";
import { cn, eventSortKey, isMissed, relativeDay, todayKey } from "../lib/utils";

const VIEW_LABELS: Record<ViewId, string> = {
  home: "home",
  ai: "Nex workspace",
  apps: "applications",
  folders: "folders",
  workspaces: "workspaces",
  system: "system center",
  files: "files",
  tools: "quick tools",
  vault: "vault",
  calendar: "calendar",
  settings: "settings",
  profile: "profile",
};

/**
 * Nex stays present above the routed interface. The text is a public activity
 * trace, not private chain-of-thought: it only reports an action or observation
 * the user can verify in QynOne.
 */
export function NexPresence({ view, onOpen }: { view: ViewId; onOpen: () => void }) {
  const { thoughts, emotion, announce, voiceEnabled, setVoiceEnabled, setEmotion } = useAi();
  const { state } = useQyn();
  const stats = useStats();
  const sys = useSystemInfo();
  const vault = useVault();
  const music = useMusic();
  const [nowTick, setNowTick] = useState(() => Date.now());
  const lastView = useRef<ViewId | null>(null);
  const lastNotification = useRef<string | null>(null);
  const lastEventAlert = useRef<string | null>(null);
  const lastSystemAlert = useRef<string | null>(null);
  const lastOffline = useRef(false);
  const lastVaultCount = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const nextEvent = useMemo(() => {
    const now = new Date(nowTick);
    const current = `${todayKey()}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return state.events
      .filter((event) => !event.done && !isMissed(event))
      .filter((event) => eventSortKey(event) >= current || event.date > todayKey())
      .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))[0] ?? null;
  }, [state.events, nowTick]);

  const missed = useMemo(() => state.events.filter(isMissed).sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))[0] ?? null, [state.events]);

  useEffect(() => {
    if (lastView.current === view) return;
    lastView.current = view;
    if (view === "home") {
      announce("*settling in at home*", "present");
      return;
    }
    announce(`*looking through ${VIEW_LABELS[view]}*`, "scanning");
  }, [view, announce]);

  useEffect(() => {
    const item = state.notifications.find((notification) => !notification.read);
    if (!item || item.id === lastNotification.current) return;
    lastNotification.current = item.id;
    const text = `*new notification: ${item.title}*`;
    announce(text, item.kind === "warn" ? "alert" : "notification", item.kind === "warn");
  }, [state.notifications, announce]);

  useEffect(() => {
    if (missed) {
      const key = `missed:${missed.id}`;
      if (key === lastEventAlert.current) return;
      lastEventAlert.current = key;
      announce(`*you missed ${missed.title} on ${relativeDay(missed.date)}*`, "missedEvent", true);
      return;
    }
    if (!nextEvent) return;
    const eventTime = nextEvent?.start
      ? new Date(`${nextEvent.date}T${nextEvent.start}:00`).getTime()
      : nextEvent
        ? new Date(`${nextEvent.date}T23:59:00`).getTime()
        : 0;
    const minutes = (eventTime - Date.now()) / 60000;
    if (minutes >= 0 && minutes <= 30) {
      const key = `next:${nextEvent.id}`;
      if (key === lastEventAlert.current) return;
      lastEventAlert.current = key;
      announce(`*${nextEvent.title} is coming up soon*`, "eventSoon", true);
    }
  }, [missed, nextEvent, announce]);

  useEffect(() => {
    if (!stats) return;
    const hot = stats.cpuPct >= 85 || stats.memUsedBytes / stats.memTotalBytes >= 0.88;
    if (!hot) {
      lastSystemAlert.current = null;
      return;
    }
    const signature = `${Math.round(stats.cpuPct / 5)}:${Math.round((stats.memUsedBytes / stats.memTotalBytes) * 20)}`;
    if (signature === lastSystemAlert.current) return;
    lastSystemAlert.current = signature;
    announce(`*your PC is under heavy load: ${stats.cpuPct}% CPU*`, "powerful", true);
  }, [stats, announce]);

  useEffect(() => {
    const count = vault.notes.length;
    if (lastVaultCount.current === null) {
      lastVaultCount.current = count;
      return;
    }
    if (count !== lastVaultCount.current && view === "vault") {
      announce(`*the vault now has ${count} note${count === 1 ? "" : "s"}*`, "remembering");
    }
    lastVaultCount.current = count;
  }, [vault.notes.length, view, announce]);

  useEffect(() => {
    const onSpeaking = (event: Event) => {
      const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setEmotion(active ? "speaking" : "settled", active ? undefined : 1100);
    };
    window.addEventListener("qyn:nex-speaking", onSpeaking);
    return () => window.removeEventListener("qyn:nex-speaking", onSpeaking);
  }, [setEmotion]);

  useEffect(() => {
    if (sys.online) {
      lastOffline.current = false;
      return;
    }
    if (lastOffline.current) return;
    lastOffline.current = true;
    announce("*the network connection is offline*", "offline", true);
  }, [sys.online, announce]);

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

  const visibleThoughts = thoughts.slice(-4);

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
      transition={{ duration: 0.25 }}
      style={{ touchAction: "none", ...(pos ? { left: pos.x, top: pos.y } : {}) }}
      className={cn(
        "fixed z-30 w-[184px] max-w-[calc(100vw-2rem)] cursor-grab select-none active:cursor-grabbing",
        pos ? "" : "bottom-[76px] right-4",
      )}
    >
      <div className="glass-soft flex w-full flex-col items-center rounded-2xl px-3 pb-2.5 pt-2 transition hover:border-accent-soft hover:bg-white/[0.045]">
        <button type="button" onClick={onOpen} className="flex w-full flex-col items-center" aria-label="Open Nex workspace">
          <AiFace emotion={emotion} size={104} headphones={Boolean(music)} dance={Boolean(music)} />
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
            transition={{ duration: 0.3 }}
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
