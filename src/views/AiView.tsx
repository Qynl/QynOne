import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bot, ChevronRight, Command, PictureInPicture2, Send, Sparkles, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AiFace } from "../components/AiFace";
import { useAi } from "../lib/ai";
import { getDesktop, isDesktop } from "../lib/desktop";
import { useMusic } from "../lib/music";
import type { ViewId } from "../lib/types";
import { cn } from "../lib/utils";

export function AiView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const { messages, busy, emotion, tools, send, clearChat } = useAi();
  const music = useMusic();
  const [draft, setDraft] = useState("");
  const [floating, setFloating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const showTools = draft.startsWith("/");

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
    if (!text || busy) return;
    setDraft("");
    void send(text);
  };

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
              <p className="text-[10.5px] text-frost-500">{busy ? "Working across QynOne…" : "Ready when you are"}</p>
            </div>
            <AiFace emotion={busy ? emotion : "idle"} size={72} headphones={Boolean(music)} dance={Boolean(music)} />
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
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/15 px-3 py-1.5 focus-within:border-[color-mix(in_srgb,var(--accent)_40%,transparent)]">
              <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} placeholder="Ask Nex anything…" className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-frost-100 outline-none placeholder:text-frost-600" />
              <button onClick={submit} disabled={!draft.trim() || busy} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Send to Nex"><Send size={14} /></button>
            </div>
          </div>
        </section>

        <aside className="flex w-[230px] min-h-0 shrink-0 flex-col gap-3">
          <div className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4">
            <div className="flex items-center gap-2"><Wrench size={14} className="text-accent" /><p className="text-[12px] font-semibold text-frost-200">What Nex can use</p></div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-frost-500">Nex only acts through these explicit QynOne tools. Type <span className="text-frost-300">/</span> in chat to call one directly.</p>
            <div className="accent-scroll mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {tools.map((tool) => (
                <button key={tool.name} onClick={() => { setDraft(`/${tool.name} `); inputRef.current?.focus(); }} title={tool.description} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.035] px-2.5 py-1.5 text-left transition hover:bg-accent-soft">
                  <span className="truncate font-mono text-[10.5px] text-frost-400">/{tool.name}</span>
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => onNavigate("vault")} className="glass-soft w-full rounded-2xl p-4 text-left transition hover:border-accent-soft hover:bg-white/[0.045]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Knowledge</p>
            <p className="mt-1 text-[13px] font-semibold text-frost-200">Open your Markdown Vault</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-frost-500">Nex can search, create and open real notes — and manages its own memory in the vault.</p>
          </button>
        </aside>
      </div>
    </div>
  );
}