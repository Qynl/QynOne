import { AnimatePresence, motion } from "framer-motion";
import { Brain, Cable, CheckCircle2, Eraser, Layers, MessageSquareText, Play, Square, StopCircle, Terminal, Wrench, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiFace } from "./AiFace";
import { useAi } from "../lib/ai";
import type { AgentEvent } from "../lib/ai";
import { CALM_BASE } from "../lib/emotion";
import { useMcp } from "../lib/mcp";
import { useMusic } from "../lib/music";
import { cn } from "../lib/utils";

const ENGINE_DOT: Record<string, string> = {
  idle: "bg-zinc-500",
  connecting: "bg-amber-300 animate-pulse",
  connected: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  error: "bg-rose-400",
};

function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function elapsed(from: number): string {
  const s = Math.max(0, Math.floor((Date.now() - from) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Agent Activity — a live, openable tab that shows what Nex is doing while it
 * does it: its thinking, every tool call (including which MCP engine tool),
 * the results and the phases of an autonomous build session.
 */
export function AgentActivity({ onBack }: { onBack?: () => void }) {
  const { activity, busy, emotion, sessionStart, toolCount, clearActivity, messages, stopSession, stopRequested, intensity } = useAi();
  const mcp = useMcp();
  const music = useMusic();
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<HTMLDivElement>(null);

  /* A slow tick keeps the elapsed timer live while a session runs. */
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  useEffect(() => {
    if (autoScroll) tickRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activity, autoScroll]);

  /* Keep autoscroll on unless the user scrolls up to read. */
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(nearBottom);
  };

  const engineCount = mcp.servers.filter((s) => s.state === "connected").length;
  const toolEvents = activity.filter((e) => e.kind === "tool-start" || e.kind === "tool-end");
  const failed = activity.filter((e) => e.kind === "tool-end" && e.ok === false).length;

  const stats = useMemo(
    () => [
      { label: "tool calls", value: toolCount || toolEvents.length },
      { label: "thoughts", value: activity.filter((e) => e.kind === "thought").length },
      { label: "issues", value: failed },
      { label: "elapsed", value: sessionStart ? elapsed(sessionStart) : "—" },
    ],
    [toolCount, toolEvents.length, activity, failed, sessionStart],
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1060px] flex-col px-5 py-5 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">Live trace</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-frost-100">Agent Activity</h1>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-frost-500">
            What Nex is thinking and doing right now — every tool call, result and phase, as it happens.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="glass-soft flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-medium text-frost-300 transition hover:text-frost-100">
              <MessageSquareText size={12} /> Chat
            </button>
          )}
          {busy && (
            <button onClick={stopSession} title="Stop the running session — Nex finishes the current step, then wraps up" className={cn("flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-semibold transition ring-1", stopRequested ? "bg-white/[0.04] text-frost-400 ring-white/10" : "bg-rose-500/15 text-rose-300 ring-rose-400/30 hover:bg-rose-500/25")}>
              <StopCircle size={12} /> {stopRequested ? "Stopping…" : "Stop"}
            </button>
          )}
          {activity.length > 0 && (
            <button onClick={clearActivity} className="glass-soft flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-medium text-frost-400 transition hover:text-frost-100">
              <Eraser size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Session header — eyes, status, live engine states */}
      <div className="glass mt-5 shrink-0 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="shrink-0">
            <AiFace emotion={busy || !CALM_BASE.has(emotion) ? emotion : "idle"} size={84} headphones={Boolean(music)} dance={Boolean(music)} intensity={intensity} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", busy ? "bg-accent shadow-[0_0_10px_var(--accent-glow)] animate-pulse" : "bg-frost-600")} />
              <p className="text-[14px] font-semibold text-frost-100">
                {busy ? "Nex is working…" : activity.length > 0 ? "Session finished" : "Waiting for a task"}
              </p>
            </div>
            <p className="mt-0.5 text-[11.5px] text-frost-500">
              {busy && engineCount > 0
                ? `Autonomous build — ${engineCount} engine${engineCount === 1 ? "" : "s"} connected`
                : busy
                  ? "Working across QynOne"
                  : engineCount > 0
                    ? `${engineCount} engine${engineCount === 1 ? "" : "s"} connected — give Nex a build goal in Chat`
                    : "Connect an engine (Roblox Studio, Unreal) in Settings → Connections to unlock autonomous builds"}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                  <p className="text-[15px] font-semibold leading-tight text-frost-100">{s.value}</p>
                  <p className="text-[9.5px] uppercase tracking-[0.12em] text-frost-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          {mcp.servers.length > 0 && (
            <div className="flex shrink-0 flex-col gap-1.5">
              {mcp.servers.map((server) => (
                <div key={server.id} className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-2.5 py-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", ENGINE_DOT[server.state])} />
                  <span className="text-[11px] font-medium text-frost-200">{server.name}</span>
                  <span className="text-[9.5px] text-frost-500">{server.state === "connected" ? `${server.tools.length} tools` : server.state}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The live trace */}
      <div className="glass mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/7 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Terminal size={13} className="text-accent" />
            <p className="text-[12px] font-semibold text-frost-200">Trace</p>
            {busy && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">live</span>}
          </div>
          <p className="text-[10px] text-frost-600">{autoScroll ? "following" : "scroll paused"}</p>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="accent-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
          {activity.length === 0 && (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
              <div className="relative">
                <span className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,var(--accent-glow),transparent_65%)] opacity-40 blur-xl" />
                <Layers size={22} className="relative text-accent" />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-frost-100">Nothing running yet</p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-frost-500">
                When Nex starts a task, its thinking, tool calls and results stream here live — including every MCP engine tool it uses.
              </p>
              {messages.length > 0 && (
                <p className="mt-3 text-[11px] text-frost-600">Send Nex the next goal from the Chat tab and watch this fill up.</p>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {activity.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </AnimatePresence>
          {busy && (
            <div className="flex items-center gap-2 px-1 pt-1 text-[11px] text-frost-500">
              <span className="flex gap-1">
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
              </span>
              working…
            </div>
          )}
          <div ref={tickRef} />
        </div>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  if (event.kind === "tool-start") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-2.5 py-2">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <Wrench size={11} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[11px] text-frost-100">{event.text}</span>
            {event.engine && (
              <span className="flex items-center gap-1 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                <Cable size={8} /> {event.engine}
              </span>
            )}
            <span className="ml-auto shrink-0 text-[9.5px] text-frost-600">{timeOf(event.ts)}</span>
          </div>
          {event.detail && <p className="mt-0.5 truncate font-mono text-[10px] text-frost-500">{event.detail}</p>}
        </div>
      </motion.div>
    );
  }
  if (event.kind === "tool-end") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("flex items-start gap-2.5 rounded-lg px-2.5 py-1.5", event.ok === false ? "bg-rose-500/[0.07]" : "bg-emerald-500/[0.045]")}>
        <span className={cn("mt-0.5 shrink-0", event.ok === false ? "text-rose-400" : "text-emerald-400")}>
          {event.ok === false ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="min-w-0 truncate font-mono text-[10.5px] text-frost-300">{event.text}</span>
            {typeof event.ms === "number" && <span className="shrink-0 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-frost-400">{fmtMs(event.ms)}</span>}
            <span className="ml-auto shrink-0 text-[9.5px] text-frost-600">{timeOf(event.ts)}</span>
          </div>
          {event.detail && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words font-mono text-[9.5px] leading-relaxed text-frost-600">{event.detail}</p>}
        </div>
      </motion.div>
    );
  }
  if (event.kind === "thought") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 px-1 py-1">
        <span className="mt-0.5 shrink-0 text-accent/80">
          <Brain size={12} />
        </span>
        <p className="min-w-0 flex-1 text-[11.5px] italic leading-relaxed text-frost-300">{event.text}</p>
        <span className="shrink-0 pt-0.5 text-[9px] text-frost-600">{timeOf(event.ts)}</span>
      </motion.div>
    );
  }
  if (event.kind === "phase") {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-1 pt-1.5">
        <span className="grid h-5 w-5 place-items-center rounded-md bg-white/[0.06] text-frost-300">
          <Play size={9} />
        </span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-frost-400">{event.text}</span>
        <span className="ml-1 h-px flex-1 bg-white/8" />
      </motion.div>
    );
  }
  /* reply */
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5 rounded-lg bg-accent-soft px-2.5 py-2">
      <span className="mt-0.5 shrink-0 text-accent">
        <MessageSquareText size={12} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Nex replied</p>
        <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-frost-200">{event.text}</p>
        {event.detail && <p className="mt-0.5 text-[9.5px] text-frost-500">{event.detail}</p>}
      </div>
      <span className="shrink-0 text-[9.5px] text-frost-600">{timeOf(event.ts)}</span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Live activity mini-panel — dockable in the chat sidebar             */
/* ------------------------------------------------------------------ */

export function AgentActivityMini({ onOpen }: { onOpen: () => void }) {
  const { activity, busy, toolCount, sessionStart } = useAi();
  const latest = activity[activity.length - 1];

  if (activity.length === 0) {
    return (
      <button onClick={onOpen} className="glass shrink-0 rounded-2xl p-4 text-left transition hover:border-accent-soft hover:bg-white/[0.045]">
        <div className="flex items-center gap-2">
          <Square size={12} className="text-accent" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Agent Activity</p>
        </div>
        <p className="mt-1 text-[12.5px] font-semibold text-frost-200">See what Nex is doing</p>
        <p className="mt-1 text-[11px] leading-relaxed text-frost-500">A live tab with Nex's thoughts, tool calls and engine actions while it works.</p>
      </button>
    );
  }

  return (
    <button onClick={onOpen} className="glass-soft w-full shrink-0 rounded-2xl p-3.5 text-left transition hover:border-accent-soft hover:bg-white/[0.05]">
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", busy ? "bg-accent animate-pulse shadow-[0_0_8px_var(--accent-glow)]" : "bg-frost-600")} />
        <p className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-frost-400">
          {busy ? "Working now" : `Last session${sessionStart ? ` · ${elapsed(sessionStart)}` : ""}`}
        </p>
        <span className="shrink-0 text-[9.5px] text-frost-500">{toolCount || activity.filter((e) => e.kind === "tool-end").length} calls</span>
      </div>
      {latest && (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-frost-300">
          {latest.kind === "thought" ? latest.text : latest.kind === "phase" ? latest.text : latest.text}
        </p>
      )}
    </button>
  );
}
