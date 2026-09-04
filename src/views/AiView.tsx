import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowRight, Bot, Cable, ChevronRight, Command, ExternalLink, FileText, FolderOpen, Image as ImageIcon, Loader2, Paperclip, PictureInPicture2, Plug, Plus, Send, Sparkles, Square, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AgentActivity, AgentActivityMini } from "../components/AgentActivity";
import { AiFace } from "../components/AiFace";
import { EmotionDebugger } from "../components/EmotionDebugger";
import { NexFolderPanel } from "../components/NexFolderPanel";
import { useAi } from "../lib/ai";
import type { AiAttachment } from "../lib/ai";
import { CALM_BASE } from "../lib/emotion";
import { getDesktop, isDesktop } from "../lib/desktop";
import { nexFolderPickImport, nexFolderReadImage, nexFolderReveal } from "../lib/nexfolder";
import type { McpServerStatus } from "../lib/desktop";
import { useMcp } from "../lib/mcp";
import { useMusic } from "../lib/music";
import type { ViewId } from "../lib/types";
import { cn } from "../lib/utils";

const ENGINE_DOT: Record<McpServerStatus["state"], string> = {
  idle: "bg-zinc-500",
  connecting: "bg-amber-300 animate-pulse",
  connected: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  error: "bg-rose-400",
};

export function AiView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { messages, busy, emotion, tools, send, clearChat, activity, stopSession, stopRequested, intensity } = useAi();
  const mcp = useMcp();
  const music = useMusic();
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<AiAttachment[]>([]);
  const [picking, setPicking] = useState(false);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  const [floating, setFloating] = useState(false);
  const [tab, setTab] = useState<"chat" | "activity" | "folder">("chat");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const showTools = draft.startsWith("/");

  /* When a session kicks off, peek once at the live trace so the user
     notices there's something to watch. If they go back to chat, never
     yank them again during the same session — the pulsing dot in the
     header keeps the door visible. */
  const autoSwitchedRef = useRef(false);
  useEffect(() => {
    if (!busy) {
      autoSwitchedRef.current = false;
      return;
    }
    if (autoSwitchedRef.current || activity.length === 0) return;
    autoSwitchedRef.current = true;
    const t = window.setTimeout(() => setTab((current) => (current === "chat" ? "activity" : current)), 900);
    return () => window.clearTimeout(t);
  }, [busy, activity.length]);

  /* Floating Nex: an always-on-top companion window with just the eyes,
     so Nex stays visible while you play or work in other apps. */
  useEffect(() => {
    const bridge = getDesktop();
    if (!bridge) return;
    let off: (() => void) | undefined;
    bridge
      .floatState()
      .then((s) => setFloating(Boolean(s?.open)))
      .catch(() => {});
    off = bridge.onFloatChanged((open) => setFloating(open));
    return () => off?.();
  }, []);

  const toggleFloat = async () => {
    const bridge = getDesktop();
    if (!bridge) return;
    try {
      const s = await bridge.floatToggle();
      setFloating(Boolean(s?.open));
    } catch {
      // ignore — the window state will catch up via onFloatChanged
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);

  const submit = () => {
    const text = draft.trim();
    if ((!text && pendingFiles.length === 0) || busy) return;
    setDraft("");
    const files = pendingFiles;
    setPendingFiles([]);
    void send(text, { files: files.length > 0 ? files : undefined });
  };

  /* OS file picker → copies of the chosen files land in NexFolder/Chat/,
     then ride along with the next message as chips. Only .md, text/code
     and photos are accepted (the main process enforces this too). */
  const attachFiles = async () => {
    if (!isDesktop() || busy || picking) return;
    setPicking(true);
    setAttachNote(null);
    try {
      const res = await nexFolderPickImport();
      if (res.canceled) return;
      if (!res.ok) {
        const msg = res.error ?? "Couldn't attach files.";
        setAttachNote(msg);
        window.setTimeout(() => setAttachNote((cur) => (cur === msg ? null : cur)), 6000);
        return;
      }
      const imported = res.imported ?? [];
      if (imported.length > 0) {
        /* Photos ride along as real images (data URLs) so Nex can actually
           see them when vision is enabled in Settings → AI. */
        const withData = await Promise.all(
          imported.map(async (f) => {
            if (f.kind !== "image") return f;
            const img = await nexFolderReadImage(f.rel);
            return img.ok && img.dataUrl ? { ...f, dataUrl: img.dataUrl } : f;
          }),
        );
        setPendingFiles((cur) => {
          const seen = new Set(cur.map((x) => x.rel));
          return [...cur, ...withData.filter((f) => !seen.has(f.rel))];
        });
      }
      const msgs = (res.errors ?? []).slice(0, 3).map((e) => `${e.name}: ${e.error}`);
      const note = msgs.length > 0 ? msgs.join(" · ") : imported.length === 0 ? "No files were sent." : null;
      if (note) {
        setAttachNote(note);
        window.setTimeout(() => setAttachNote((cur) => (cur === note ? null : cur)), 6000);
      }
    } catch {
      setAttachNote("Couldn't open the file picker.");
    } finally {
      setPicking(false);
    }
  };

  if (tab === "activity") {
    return <AgentActivity onBack={() => setTab("chat")} />;
  }

  if (tab === "folder") {
    return <NexFolderPanel onBack={() => setTab("chat")} />;
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1060px] flex-col px-5 py-5 md:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">QynOne intelligence</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-frost-100">Talk to Nex</h1>
          <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-frost-500">
            A real local-first command layer for your apps, calendar, PC and Markdown vault.
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => setTab("activity")}
            className="glass-soft flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-medium text-frost-300 transition hover:border-accent-soft hover:text-frost-100"
            title="Open the live agent trace — thoughts, tool calls and engine actions"
          >
            <Activity size={13} className="text-accent" /> Agent Activity
            {busy && activity.length > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />}
          </button>
          <button
            onClick={() => setTab("folder")}
            className="glass-soft flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-medium text-frost-300 transition hover:border-accent-soft hover:text-frost-100"
            title="The one folder Nex can read and write — deposit .md briefs and photos, then tell Nex to work with them"
          >
            <FolderOpen size={13} className="text-accent" /> Nex Folder
          </button>
          <button onClick={() => onNavigate("vault")} className="glass-soft flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-medium text-frost-300 transition hover:text-frost-100">
            <Command size={13} className="text-accent" /> Open Vault <ArrowRight size={12} />
          </button>
          {isDesktop() && (
            <button
              onClick={toggleFloat}
              title={floating ? "Hide floating Nex" : "Keep Nex above your games and apps — just the eyes"}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-3 text-[11.5px] font-medium transition",
                floating
                  ? "border border-accent-soft bg-accent-soft text-frost-100 hover:bg-white/6"
                  : "glass-soft text-frost-300 hover:border-accent-soft hover:text-frost-100",
              )}
            >
              <PictureInPicture2 size={13} className={floating ? "text-accent" : "text-accent/80"} />
              {floating ? "Hide Nex" : "Float Nex"}
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={clearChat} className="h-8 rounded-lg px-3 text-[11.5px] font-medium text-frost-500 transition hover:bg-white/5 hover:text-frost-200">Clear</button>
          )}
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 gap-5">
        <section className="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 border-b border-white/7 px-4 py-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft text-accent"><Bot size={16} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-frost-100">Nex</p>
              <p className="text-[10.5px] text-frost-500">
                {busy && mcp.servers.some((s) => s.state === "connected")
                  ? `Building with ${mcp.servers.filter((s) => s.state === "connected").map((s) => s.name).join(" + ")}…`
                  : busy
                    ? "Working across QynOne…"
                    : "Ready when you are"}
              </p>
            </div>
            <AiFace emotion={busy || !CALM_BASE.has(emotion) ? emotion : "idle"} size={72} headphones={Boolean(music)} dance={Boolean(music)} intensity={intensity} />
          </div>

          <div className="accent-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
                <div className="relative">
                  <span className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,var(--accent-glow),transparent_65%)] opacity-50 blur-xl" />
                  <Sparkles size={22} className="relative text-accent" />
                </div>
                <p className="mt-4 text-[15px] font-semibold text-frost-100">What should Nex do?</p>
                <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-frost-500">Ask naturally, or type <span className="text-frost-300">/</span> to browse real QynOne tools.</p>
                <div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-2">
                  {["Open VS Code", "What's next today?", "Play some lofi"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setDraft("");
                        void send(suggestion);
                      }}
                      className="glass-soft rounded-full px-3.5 py-1.5 text-[12px] font-medium text-frost-300 transition hover:border-accent-soft hover:text-frost-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message) => (
              <motion.div key={message.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed", message.role === "user" ? "rounded-br-md bg-accent-soft text-frost-100" : "rounded-bl-md bg-white/[0.045] text-frost-200")}>
                  {message.text.split("\n").map((line, i) => <p key={i}>{line || "\u00a0"}</p>)}
                  {message.tool && <p className="mt-1 text-[10px] text-accent/80">/{message.tool}</p>}
                  {message.role === "user" && message.files && message.files.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {message.files.map((f) => (
                        <button
                          key={f.rel}
                          onClick={() => {
                            if (isDesktop()) void nexFolderReveal(f.rel);
                          }}
                          title="Click to open on your screen — the file stays in the Nex Folder"
                          className="flex max-w-[220px] items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] text-frost-200 ring-1 ring-white/10 transition hover:ring-accent-soft"
                        >
                          {f.kind === "image" ? <ImageIcon size={10} className="shrink-0 text-emerald-300/90" /> : <FileText size={10} className="shrink-0 text-sky-300/90" />}
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {busy && <div className="flex items-center gap-2 text-[12px] text-frost-500"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" /></span> Nex is thinking</div>}
            <div ref={endRef} />
          </div>

          <div className="relative border-t border-white/7 p-3">
            <AnimatePresence>
              {showTools && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="glass-strong absolute bottom-[calc(100%+8px)] left-3 right-3 z-10 max-h-56 overflow-y-auto rounded-xl p-2">
                  <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-frost-500">Nex tools</p>
                  {tools.map((tool) => (
                    <button key={tool.name} onClick={() => { setDraft(`/${tool.name} `); inputRef.current?.focus(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/6">
                      <Wrench size={12} className="text-accent" />
                      <span className="min-w-0 flex-1"><span className="block text-[12px] text-frost-200">{tool.usage}</span><span className="block truncate text-[10.5px] text-frost-500">{tool.description}</span></span>
                      <ChevronRight size={12} className="text-frost-600" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {pendingFiles.map((f) => (
                  <span key={f.rel} className="glass-soft flex max-w-[260px] items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px] text-frost-200">
                    {f.kind === "image" ? <ImageIcon size={11} className="shrink-0 text-emerald-300/90" /> : <FileText size={11} className="shrink-0 text-sky-300/90" />}
                    <span className="truncate">{f.name}</span>
                    {isDesktop() && (
                      <button onClick={() => void nexFolderReveal(f.rel)} title="Open on your screen" className="grid h-4 w-4 shrink-0 place-items-center rounded text-frost-500 transition hover:bg-white/10 hover:text-frost-100">
                        <ExternalLink size={10} />
                      </button>
                    )}
                    <button onClick={() => setPendingFiles((cur) => cur.filter((x) => x.rel !== f.rel))} title="Remove from this message (the file stays in the Nex Folder)" className="grid h-4 w-4 shrink-0 place-items-center rounded text-frost-500 transition hover:bg-rose-500/20 hover:text-rose-300">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {attachNote && <p className="mb-2 text-[10.5px] leading-relaxed text-amber-200/85">{attachNote}</p>}
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-1.5 focus-within:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]">
              {isDesktop() && (
                <button
                  onClick={() => void attachFiles()}
                  disabled={busy || picking}
                  title="Send files to Nex — .md, text/code and photos are copied into the Nex Folder and Nex reads them"
                  aria-label="Attach files"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-frost-400 transition hover:bg-white/6 hover:text-frost-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {picking ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                </button>
              )}
              <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} placeholder="Ask Nex anything…" className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-frost-100 outline-none placeholder:text-frost-600" />
              {busy && (
                <button onClick={stopSession} title="Stop the running session" aria-label="Stop Nex" className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/30 transition hover:bg-rose-500/25">
                  <Square size={9} fill="currentColor" /> {stopRequested ? "Stopping…" : "Stop"}
                </button>
              )}
              <button onClick={submit} disabled={(!draft.trim() && pendingFiles.length === 0) || busy} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Send to Nex"><Send size={14} /></button>
            </div>
          </div>
        </section>

        <aside className="flex w-[232px] min-h-0 shrink-0 flex-col gap-3">
          {/* Engine connections — Roblox Studio, Unreal Engine via MCP */}
          <div className="glass shrink-0 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><Cable size={13} className="text-accent" /><p className="text-[11.5px] font-semibold text-frost-200">Engines</p></div>
              {mcp.supported && mcp.servers.length === 0 && (
                <button onClick={() => onNavigate("settings")} className="grid h-5 w-5 place-items-center rounded-md bg-white/5 text-frost-400 transition hover:bg-accent-soft hover:text-frost-100" title="Add an engine"><Plus size={11} /></button>
              )}
            </div>
            {!mcp.supported ? (
              <p className="mt-2 text-[10.5px] leading-relaxed text-frost-500">MCP connections live in the QynOne desktop app — this preview can't reach your PC's engines.</p>
            ) : mcp.servers.length === 0 ? (
              <button onClick={() => onNavigate("settings")} className="mt-2 w-full rounded-lg border border-dashed border-white/12 px-2.5 py-2 text-left text-[10.5px] leading-relaxed text-frost-500 transition hover:border-accent-soft hover:text-frost-300">
                No engines yet. Connect Roblox Studio or Unreal Engine so Nex can read and write real scripts.
              </button>
            ) : (
              <div className="mt-2 space-y-1">
                {mcp.servers.map((server) => {
                  const busyConnecting = mcp.connectingIds.includes(server.id) || server.state === "connecting";
                  return (
                    <div key={server.id} onClick={() => onNavigate("settings")} className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.045]" title="Manage engine connections in Settings">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ENGINE_DOT[server.state])} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-frost-200">{server.name}</span>
                        <span className="block truncate text-[9.5px] text-frost-500">
                          {server.state === "connected" ? `${server.tools.length} tools ready` : server.state === "error" ? "offline — click to retry" : busyConnecting ? "connecting…" : server.state === "idle" ? "not connected" : ""}
                        </span>
                      </span>
                      {server.state === "connected" ? (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-frost-600 transition group-hover:bg-accent-soft group-hover:text-frost-200"><ChevronRight size={11} /></span>
                      ) : busyConnecting ? (
                        <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-white/15 border-t-white/70" />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); void mcp.connect(server.id); }}
                          title="Try connecting now"
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/5 text-frost-400 transition hover:bg-accent-soft hover:text-frost-100"
                        >
                          <Plug size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4">
            <div className="flex items-center gap-2"><Wrench size={14} className="text-accent" /><p className="text-[12px] font-semibold text-frost-200">What Nex can use</p></div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-frost-500">Nex only acts through these explicit QynOne tools. Type <span className="text-frost-300">/</span> in chat to call one directly.</p>
            <div className="accent-scroll mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {tools.map((tool) => (
                <button key={tool.name} onClick={() => { setDraft(`/${tool.name} `); inputRef.current?.focus(); }} title={tool.description} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.035] px-2.5 py-1.5 text-left transition hover:bg-accent-soft">
                  <span className="truncate font-mono text-[10.5px] text-frost-400">/{tool.name}</span>
                </button>
              ))}
              {mcp.tools.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="px-2 pb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-frost-600">Engine tools · {mcp.tools.length}</p>
                  {mcp.tools.slice(0, 24).map((tool) => (
                    <div key={`${tool.serverId}-${tool.name}`} title={tool.description} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1">
                      <span className="min-w-0 truncate font-mono text-[10px] text-accent/90">{tool.name}</span>
                    </div>
                  ))}
                  {mcp.tools.length > 24 && <p className="px-2 text-[9.5px] text-frost-600">+{mcp.tools.length - 24} more in the engine</p>}
                </div>
              )}
            </div>
          </div>
          {/* Live activity — one click to the full trace */}
          <AgentActivityMini onOpen={() => setTab("activity")} />
        </aside>
      </div>
      {/* Development-only emotion debugger — live decisions, tunable. */}
      {import.meta.env.DEV && <EmotionDebugger />}
    </div>
  );
}