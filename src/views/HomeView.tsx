import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BatteryCharging,
  Bell,
  CalendarDays,
  Clock4,
  Cpu,
  FileText,
  MemoryStick,
  Mic,
  MicOff,
  Plus,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiFace } from "../components/AiFace";
import { AppIcon } from "../components/AppIcon";
import { useLaunch, useUi } from "../components/ui";
import { useAi } from "../lib/ai";
import { useQyn } from "../lib/store";
import { useStats } from "../lib/stats";
import { useSystemInfo } from "../lib/system";
import { useNexVoice, stopSpeaking } from "../lib/speech";
import type { AppItem, ViewId } from "../lib/types";
import { clockTime, eventSortKey, fmtTime, greeting, isMissed, prettyToday, relativeDay, timeAgo, todayKey } from "../lib/utils";
import { useVault } from "../lib/vault";

export function HomeView({
  onNavigate,
  onOpenFolder,
  onOpenPalette,
  onOpenNote,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenPalette: () => void;
  onOpenNote: (name: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-6 md:px-8">
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <NowPanel onNavigate={onNavigate} onOpenPalette={onOpenPalette} />
        <NexStage />
      </div>
      <Widgets onNavigate={onNavigate} onOpenFolder={onOpenFolder} onOpenNote={onOpenNote} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Now panel — clock, date, what's next, missed, notifications         */
/* ------------------------------------------------------------------ */

function NowPanel({ onNavigate, onOpenPalette }: { onNavigate: (v: ViewId) => void; onOpenPalette: () => void }) {
  const { state } = useQyn();
  const today = todayKey();

  const todays = useMemo(
    () =>
      state.events
        .filter((e) => e.date === today && !e.done)
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))),
    [state.events, today],
  );
  const upcoming = useMemo(
    () =>
      state.events
        .filter((e) => !e.done && e.date > today)
        .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))
        .slice(0, 3),
    [state.events, today],
  );
  const missed = useMemo(() => state.events.filter((e) => isMissed(e)), [state.events]);
  const unread = state.notifications.filter((n) => !n.read);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass flex flex-col rounded-3xl p-5"
    >
      {/* Clock + date */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-accent">{prettyToday()}</p>
          <p className="mt-1 text-[15px] font-semibold text-frost-200">
            {greeting()}
            {state.profile.name ? `, ${state.profile.name}` : ""}.
          </p>
          <p className="mt-2.5 text-[40px] font-bold leading-none tabular-nums tracking-tight text-frost-100">
            <LiveClock />
          </p>
        </div>
        <button
          onClick={onOpenPalette}
          className="glass-soft grid h-9 w-9 shrink-0 place-items-center rounded-full text-frost-400 transition hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-accent"
          title="Search (Ctrl+K)"
        >
          <Search size={15} />
        </button>
      </div>

      {/* What's next */}
      <div className="mt-5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-frost-400">
          <CalendarDays size={12} /> What's next
        </p>
        <button onClick={() => onNavigate("calendar")} className="flex items-center gap-1 text-[11px] font-medium text-frost-500 transition hover:text-accent">
          Calendar <ArrowRight size={10} />
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {todays.length === 0 && upcoming.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-[12px] text-frost-500">
            Nothing planned. Say “Nex, add gym tomorrow at 6pm”.
          </p>
        )}
        {todays.map((ev) => (
          <button key={ev.id} onClick={() => onNavigate("calendar")} className="flex w-full items-center gap-2.5 rounded-xl bg-accent-soft px-3 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
            <span className="glass-soft grid h-8 w-14 shrink-0 place-items-center rounded-lg text-[10.5px] font-bold tabular-nums text-frost-200">
              {ev.start ? fmtTime(ev.start) : "ALL DAY"}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-frost-100">{ev.title}</span>
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-accent">today</span>
          </button>
        ))}
        {upcoming.map((ev) => (
          <button key={ev.id} onClick={() => onNavigate("calendar")} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition hover:bg-white/4">
            <span className="w-14 shrink-0 text-[10.5px] font-semibold tabular-nums text-frost-500">{ev.start ? fmtTime(ev.start) : "·"}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-frost-200">{ev.title}</span>
            <span className="shrink-0 text-[10px] text-frost-500">{relativeDay(ev.date)}</span>
          </button>
        ))}
      </div>

      {missed.length > 0 && (
        <button onClick={() => onNavigate("calendar")} className="mt-2.5 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/8 px-3 py-2 text-left transition hover:bg-red-400/12">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
          <span className="text-[12px] font-medium text-red-200">{missed.length} missed {missed.length === 1 ? "item" : "items"}</span>
          <ArrowRight size={11} className="ml-auto shrink-0 text-red-300/70" />
        </button>
      )}

      {/* Notifications */}
      <div className="mt-4 border-t border-white/6 pt-3.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-frost-400">
          <Bell size={12} /> Notifications
          {unread.length > 0 && (
            <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">{unread.length}</span>
          )}
        </p>
        <div className="mt-2 space-y-1">
          {state.notifications.length === 0 ? (
            <p className="text-[11.5px] text-frost-500">All quiet — activity will land here.</p>
          ) : (
            state.notifications.slice(0, 2).map((n) => (
              <div key={n.id} className="flex items-start gap-2 rounded-lg px-1 py-1">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? "bg-white/15" : "bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]"}`} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-frost-200">{n.title}</p>
                  <p className="truncate text-[10.5px] text-frost-500">{n.body}</p>
                </div>
                <span className="ml-auto shrink-0 text-[9.5px] text-frost-600">{timeAgo(n.time)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.aside>
  );
}

function LiveClock() {
  const [time, setTime] = useState(clockTime);
  useEffect(() => {
    const t = setInterval(() => setTime(clockTime()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums">{time}</span>;
}

/* ------------------------------------------------------------------ */
/* Nex stage — the eyes are the main thing                             */
/* ------------------------------------------------------------------ */

const SUGGESTIONS = ["What's on my PC right now?", "Open VS Code", "What's next today?", "Create a note about my ideas"];

function NexStage() {
  const { messages, busy, emotion, tools, send, clearChat, setEmotion } = useAi();
  const [input, setInput] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  useNexVoice({
    enabled: voiceOn,
    callbacks: {
      onWake: () => setEmotion("wake", 2000),
      onListenStart: () => setEmotion("listening"),
      onIdle: () => setEmotion("idle"),
      onCommand: (text) => {
        void send(text, { voice: true });
      },
      onError: (msg) => {
        setVoiceError(msg);
        setVoiceOn(false);
        setEmotion("concerned", 2600);
      },
    },
  });

  useEffect(() => {
    if (!voiceOn) stopSpeaking();
  }, [voiceOn]);

  const slashFiltered = useMemo(() => {
    if (!showTools) return [];
    const q = input.replace(/^\//, "").trim().toLowerCase();
    return tools.filter((t) => !q || t.name.includes(q) || t.description.toLowerCase().includes(q)).slice(0, 7);
  }, [showTools, input, tools]);

  function submit(text: string, viaVoice = false) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setShowTools(false);
    void send(t, viaVoice ? { voice: true } : undefined);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="glass relative overflow-hidden rounded-3xl"
    >
      {/* soft stage glow */}
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(ellipse, var(--accent-glow), transparent 66%)", opacity: 0.55 }}
      />

      <div className="relative flex flex-col items-center px-6 pb-5 pt-9">
        {/* The eyes — nothing else around them */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <AiFace emotion={emotion} size={188} />
        </motion.div>

        {/* mic + voice hint */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => {
              setVoiceError("");
              setVoiceOn((v) => !v);
            }}
            title={voiceOn ? "Stop listening" : "Listen for “Nex”"}
            className={`relative grid h-11 w-11 place-items-center rounded-full border transition active:scale-95 ${
              voiceOn
                ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-accent shadow-[0_0_24px_-4px_var(--accent-glow)]"
                : "glass-soft border-white/10 text-frost-400 hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-frost-100"
            }`}
          >
            {voiceOn && <span className="absolute inset-0 animate-ping rounded-full border border-accent/30" />}
            {voiceOn ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
          <div className="max-w-[300px]">
            <p className="text-[12.5px] font-semibold text-frost-200">
              {voiceOn ? "Listening for “Nex”…" : "Talk to Nex hands-free"}
            </p>
            <p className="text-[11px] leading-relaxed text-frost-500">
              {voiceOn ? "Say “Nex, open VS Code” — then just speak." : "Tap the mic, say “Nex”, then give a command — like a wake word."}
            </p>
          </div>
        </div>

        {voiceError && (
          <p className="mt-2 rounded-lg border border-red-400/20 bg-red-400/8 px-3 py-1.5 text-[11px] text-red-200">{voiceError}</p>
        )}

        {/* Input */}
        <div className="relative mt-4 w-full max-w-xl">
          <AnimatePresence>
            {showTools && slashFiltered.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="glass-strong accent-scroll absolute bottom-[calc(100%-2px)] left-0 right-0 z-20 max-h-56 overflow-y-auto rounded-xl p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
              >
                <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-frost-500">Nex's tools</p>
                {slashFiltered.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => {
                      setInput(`${t.usage.split(" ")[0]} ${t.usage.replace(/^\S+\s*/, "")}`.replace(/\s+$/, " "));
                      setShowTools(true);
                      inputRef.current?.focus();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-accent-soft"
                  >
                    <span className="font-mono text-[11.5px] font-semibold text-accent">/{t.name}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-frost-200">{t.description}</span>
                      <span className="block truncate font-mono text-[10.5px] text-frost-500">{t.usage}</span>
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-4 py-1.5 transition focus-within:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] focus-within:bg-white/6 focus-within:shadow-[0_0_0_3px_var(--accent-soft)]">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowTools(e.target.value.startsWith("/"));
              }}
              onFocus={() => setShowTools(input.startsWith("/"))}
              onBlur={() => setShowTools(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(input);
                if (e.key === "Escape") setShowTools(false);
              }}
              placeholder="Ask Nex anything… ( / for tools )"
              className="min-w-0 flex-1 bg-transparent py-2 text-[13.5px] text-frost-100 outline-none placeholder:text-frost-500/70"
            />
            <button
              onClick={() => submit(input)}
              disabled={busy || !input.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-white transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="no-scrollbar mt-2.5 flex justify-center gap-1.5 overflow-x-auto">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                disabled={busy}
                className="shrink-0 rounded-full border border-white/8 bg-white/3 px-3 py-1 text-[11.5px] font-medium text-frost-400 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-200 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="mt-4 w-full max-w-xl">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-frost-500">conversation</p>
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-[10.5px] font-medium text-frost-600 transition hover:text-frost-300">
                Clear
              </button>
            )}
          </div>
          <div ref={scrollRef} className="accent-scroll mt-1.5 h-[168px] space-y-2 overflow-y-auto pr-1">
            {messages.length === 0 && !busy ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles size={16} className="text-accent" />
                <p className="mt-1.5 text-[12.5px] font-medium text-frost-500">The eyes are listening. Ask me anything about your PC.</p>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        m.role === "user"
                          ? "max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-[12.5px] leading-relaxed text-white shadow-[0_10px_28px_-12px_var(--accent-glow)]"
                          : "glass-soft max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2 text-[12.5px] leading-relaxed text-frost-200"
                      }
                    >
                      {m.tool && (
                        <span className="mb-0.5 block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-accent">
                          {m.role === "user" ? `/${m.tool}` : `used ${m.tool}`}
                        </span>
                      )}
                      <span className="whitespace-pre-wrap">{m.text}</span>
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 px-1 text-[11.5px] text-frost-500">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                          animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </span>
                    thinking…
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

function Widgets({
  onNavigate,
  onOpenFolder,
  onOpenNote,
}: {
  onNavigate: (v: ViewId) => void;
  onOpenFolder: (folderId: string) => void;
  onOpenNote: (name: string) => void;
}) {
  const { state } = useQyn();
  const { openAddApp } = useUi();
  const launch = useLaunch();

  const favorites = useMemo(() => state.apps.filter((a) => a.favorite), [state.apps]);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <WidgetCard title="PC status" action={<WidgetLink label="System center" onClick={() => onNavigate("system")} />}>
        <StatusStrip />
      </WidgetCard>

      <WidgetCard title="Quick launch" action={<WidgetLink label="Add" onClick={() => openAddApp()} />}>
        {favorites.length === 0 ? (
          <div className="py-5 text-center">
            <Star size={18} className="mx-auto text-frost-500/60" />
            <p className="mt-1.5 text-[12.5px] text-frost-500">Pin your most-used apps — they'll sit here, one click away.</p>
            <button
              onClick={() => onNavigate("apps")}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-[12px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
            >
              <Star size={12} /> Browse apps
            </button>
          </div>
        ) : (
          <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
            {favorites.map((app) => (
              <DockTile key={app.id} app={app} />
            ))}
            <button
              onClick={() => openAddApp()}
              className="glass-soft flex w-[76px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-dashed text-frost-500 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-accent"
            >
              <Plus size={16} />
              <span className="text-[10.5px] font-medium">Add app</span>
            </button>
          </div>
        )}
      </WidgetCard>

      <WidgetCard title="Virtual folders" action={<WidgetLink label="Library" onClick={() => onNavigate("folders")} />}>
        {state.folders.length === 0 ? (
          <p className="py-5 text-center text-[12.5px] text-frost-500">Create virtual folders to organize your apps.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {state.folders.map((f) => (
              <button
                key={f.id}
                onClick={() => onOpenFolder(f.id)}
                className="glass-soft group flex items-center gap-2 rounded-xl px-3 py-2 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
              >
                <AppIcon icon={f.icon} color={f.color} size={28} rounded="rounded-[8px]" />
                <span className="text-[12.5px] font-semibold text-frost-200 group-hover:text-frost-100">{f.name}</span>
                <span className="text-[10.5px] tabular-nums text-frost-500">{state.apps.filter((a) => a.folderId === f.id).length}</span>
              </button>
            ))}
          </div>
        )}
      </WidgetCard>

      <WidgetCard title="Knowledge" action={<WidgetLink label="Vault & graph" onClick={() => onNavigate("vault")} />}>
        <KnowledgeStrip onOpenNote={onOpenNote} />
      </WidgetCard>

      {state.workspaces.length > 0 && (
        <WidgetCard title="Workspaces" action={<WidgetLink label="All" onClick={() => onNavigate("workspaces")} />} wide>
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {state.workspaces.map((ws) => {
              const apps = ws.itemIds.map((id) => state.apps.find((a) => a.id === id)).filter(Boolean);
              return (
                <div key={ws.id} className="glass-soft flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-2.5">
                  <AppIcon icon={ws.icon} color={ws.color} size={32} rounded="rounded-[10px]" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-frost-100">{ws.name}</p>
                    <p className="text-[10.5px] text-frost-500">{apps.length} apps together</p>
                  </div>
                  <button
                    onClick={() => {
                      apps.forEach((app, i) => window.setTimeout(() => launch(app!), i * 450));
                    }}
                    className="ml-1 h-8 shrink-0 rounded-lg bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-white transition hover:brightness-110 active:scale-95"
                  >
                    Launch all
                  </button>
                </div>
              );
            })}
          </div>
        </WidgetCard>
      )}
    </div>
  );
}

function WidgetCard({ title, action, children, wide }: { title: string; action?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={wide ? "lg:col-span-2" : ""}
    >
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-frost-400">
            <span className="h-3.5 w-[3px] rounded-full bg-[var(--accent)]" />
            {title}
          </p>
          {action}
        </div>
        {children}
      </div>
    </motion.div>
  );
}

function WidgetLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 text-[11.5px] font-medium text-frost-500 transition hover:text-accent">
      {label} <ArrowRight size={11} />
    </button>
  );
}

function DockTile({ app }: { app: AppItem }) {
  const launch = useLaunch();
  return (
    <motion.button
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => launch(app)}
      title={app.name}
      className="glass-soft group flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-2xl p-3 transition hover:border-[color-mix(in_srgb,var(--accent)_32%,transparent)] hover:shadow-[0_14px_36px_-16px_var(--accent-glow)]"
    >
      <AppIcon icon={app.icon} color={app.color} size={40} rounded="rounded-[13px]" />
      <span className="w-full truncate text-center text-[10.5px] font-medium text-frost-200">{app.name}</span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Status + Knowledge strips                                           */
/* ------------------------------------------------------------------ */

function StatusStrip() {
  const stats = useStats();
  const sys = useSystemInfo();
  const pct = sys.battery ? Math.round(sys.battery.level * 100) : null;

  /* Web preview: no OS access → show machine facts only, never fake numbers. */
  if (!stats) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3.5 py-3">
        <div className="flex items-center gap-2 text-[12px] text-frost-400">
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400/70" />
          </span>
          {sys.hostname ? `${sys.hostname} · ${sys.os}` : sys.os}
        </div>
        <p className="text-[11px] text-frost-500">
          Live CPU &amp; memory appear in the installed app — nothing here is simulated.
        </p>
      </div>
    );
  }

  const memPct = Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100);
  const items: Array<{ icon: React.ReactNode; label: string; value: string; bar: number; barClass?: string }> = [
    { icon: <Cpu size={12} />, label: "CPU", value: `${stats.cpuPct}%`, bar: stats.cpuPct },
    { icon: <MemoryStick size={12} />, label: "RAM", value: `${memPct}%`, bar: memPct },
    { icon: <Clock4 size={12} />, label: "Up", value: fmtUptime(stats.uptimeSec), bar: 0 },
  ];
  if (pct !== null) {
    items.push({
      icon: <BatteryCharging size={12} />,
      label: "Batt",
      value: `${pct}%`,
      bar: pct,
      barClass: "bg-[linear-gradient(90deg,var(--accent),#7ce0c9)]",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="glass-soft rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-frost-500">
            {it.icon} {it.label}
          </div>
          <p className="mt-1 text-[15px] font-bold tabular-nums tracking-tight text-frost-100">{it.value}</p>
          {it.bar > 0 && (
            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/8">
              <div
                className={`h-full rounded-full bg-[var(--accent)] opacity-70 transition-all duration-700 ${it.barClass ?? ""}`}
                style={{ width: `${Math.min(100, it.bar)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function KnowledgeStrip({ onOpenNote }: { onOpenNote: (name: string) => void }) {
  const vault = useVault();

  if (vault.loading) {
    return <p className="py-4 text-center text-[12px] text-frost-500">Reading vault…</p>;
  }
  if (vault.notes.length === 0) {
    return (
      <div className="py-4 text-center">
        <FileText size={18} className="mx-auto text-frost-500/60" />
        <p className="mt-1.5 text-[12.5px] text-frost-500">Your Markdown vault is empty — start one and Nex will map it.</p>
        <button
          onClick={() =>
            void vault.createNote("Welcome", "", `# Welcome\n\nThis is your vault. Notes link with [[Wiki Links]] and QynOne builds the graph from them.\n`)
          }
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent-soft px-3 text-[12px] font-semibold text-frost-100 transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]"
        >
          <Plus size={12} /> Create first note
        </button>
      </div>
    );
  }

  const recent = [...vault.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const tags = [...new Set(vault.notes.flatMap((n) => n.tags))].slice(0, 5);
  const edges = vault.graphEdges.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <MiniStat value={vault.notes.length} label="notes" />
        <MiniStat value={vault.folders.length} label="folders" />
        <MiniStat value={edges} label="links" />
      </div>
      <div className="space-y-1">
        {recent.map((n) => (
          <button
            key={n.id}
            onClick={() => onOpenNote(n.name)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-frost-200">{n.title}</span>
            <span className="shrink-0 text-[10px] text-frost-500">{n.folder || "root"}</span>
          </button>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-accent">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="glass-soft rounded-xl py-2">
      <p className="text-[16px] font-bold tabular-nums text-frost-100">{value}</p>
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-frost-500">{label}</p>
    </div>
  );
}