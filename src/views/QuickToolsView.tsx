import { motion } from "framer-motion";
import {
  Calculator,
  Camera,
  Check,
  Eraser,
  MonitorCog,
  StickyNote,
  Timer,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUi } from "../components/ui";
import { getDesktop } from "../lib/desktop";
import { useQyn } from "../lib/store";
import { cn } from "../lib/utils";

type ToolId = "calc" | "stopwatch" | "notes" | "screenshot" | "system";

const TOOLS: Array<{ id: ToolId; label: string; sub: string; icon: typeof Calculator }> = [
  { id: "calc", label: "Calculator", sub: "Fast math", icon: Calculator },
  { id: "stopwatch", label: "Stopwatch", sub: "Count up", icon: Timer },
  { id: "notes", label: "Notes", sub: "Auto-saved", icon: StickyNote },
  { id: "screenshot", label: "Screenshot", sub: "One click", icon: Camera },
  { id: "system", label: "System", sub: "Windows settings", icon: MonitorCog },
];

export function QuickToolsView() {
  const [tool, setTool] = useState<ToolId>("calc");

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col px-5 py-6 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-accent">Quick Tools</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-frost-100 md:text-[30px]">
            Don’t leave QynOne for something simple.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-frost-400">
            Utilities that live right here — pick one on the left, it fills the screen, nothing scrolls away.
          </p>
        </div>
      </div>

      <div className="mt-5 flex min-h-0 flex-1 gap-4">
        {/* Left tool nav — the only navigation inside this page */}
        <aside className="glass flex w-[188px] shrink-0 flex-col rounded-2xl p-2">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-frost-500">Tools</p>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTool(t.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition",
                    active ? "bg-accent-soft text-frost-100" : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
                  )}
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border", active ? "border-accent-soft bg-accent-soft text-accent" : "border-white/8 bg-white/4 text-frost-400")}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{t.label}</span>
                    <span className="block truncate text-[10px] text-frost-500">{t.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Active tool — full height, fully visible */}
        <main className="accent-scroll min-h-0 flex-1 overflow-y-auto">
          <AnimatedTool key={tool}>
            {tool === "calc" && <CalculatorTool />}
            {tool === "stopwatch" && <StopwatchTool />}
            {tool === "notes" && <NotesTool />}
            {tool === "screenshot" && <ScreenshotTool />}
            {tool === "system" && <SystemShortcuts />}
          </AnimatedTool>
        </main>
      </div>
    </div>
  );
}

function AnimatedTool({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Calculator                                                          */
/* ------------------------------------------------------------------ */

/** Safe expression evaluator — numbers, + - * / and parentheses only. */
function calcEval(expr: string): number | null {
  let i = 0;
  const s = expr.replace(/\s+/g, "");
  if (!s) return null;

  function parseExpr(): number {
    let value = parseTerm();
    while (i < s.length && (s[i] === "+" || s[i] === "-")) {
      const op = s[i++];
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (i < s.length && (s[i] === "*" || s[i] === "/")) {
      const op = s[i++];
      const rhs = parseFactor();
      if (op === "/" && rhs === 0) throw new Error("div0");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }

  function parseFactor(): number {
    if (s[i] === "(") {
      i++;
      const value = parseExpr();
      if (s[i] !== ")") throw new Error("paren");
      i++;
      return value;
    }
    const start = i;
    while (i < s.length && /[0-9.]/.test(s[i])) i++;
    if (start === i) throw new Error("number");
    const num = Number(s.slice(start, i));
    if (Number.isNaN(num)) throw new Error("number");
    return num;
  }

  try {
    const result = parseExpr();
    if (i !== s.length) return null;
    if (!Number.isFinite(result)) return null;
    return Math.round(result * 1e8) / 1e8;
  } catch {
    return null;
  }
}

function CalculatorTool() {
  const [display, setDisplay] = useState("0");
  const [error, setError] = useState(false);

  function press(key: string) {
    setError(false);
    setDisplay((d) => {
      if (key === "C") return "0";
      if (key === "⌫") return d.length > 1 ? d.slice(0, -1) : "0";
      if (key === "=") {
        const result = calcEval(d);
        if (result === null) {
          setError(true);
          return d;
        }
        return String(result);
      }
      if (d === "0" && /[0-9]/.test(key)) return key;
      if (d === "0" && key === ".") return "0.";
      return d + key;
    });
  }

  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "C", "0", ".", "="];

  return (
    <ToolCard icon={<Calculator size={15} />} title="Calculator" tagline="Fast math, no app switch">
      <div
        className={cn(
          "mb-3 flex h-14 items-center justify-end overflow-x-auto rounded-xl border px-4 text-right text-[24px] font-bold tabular-nums tracking-tight",
          error ? "border-rose-400/30 bg-rose-400/8 text-rose-300" : "border-white/8 bg-white/4 text-frost-100",
        )}
      >
        <span className="no-scrollbar min-w-0 whitespace-nowrap">{display}</span>
      </div>
      <div className="grid max-w-[340px] grid-cols-4 gap-1.5">
        {keys.map((key) => {
          const isOp = ["÷", "×", "−", "="].includes(key);
          const isClear = key === "C";
          return (
            <button
              key={key}
              onClick={() => {
                const normalized = key === "÷" ? "/" : key === "×" ? "*" : key === "−" ? "-" : key;
                press(normalized);
              }}
              className={cn(
                "h-11 rounded-xl border text-[14.5px] font-semibold transition active:scale-[0.97]",
                isOp
                  ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-accent-soft text-accent hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]"
                  : isClear
                    ? "border-white/8 bg-white/5 text-frost-200 hover:bg-white/10"
                    : "border-white/8 bg-white/4 text-frost-100 hover:bg-white/8",
              )}
            >
              {key}
            </button>
          );
        })}
      </div>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ */
/* Stopwatch                                                           */
/* ------------------------------------------------------------------ */

function StopwatchTool() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const base = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(base.current + (Date.now() - startedAt.current)), 100);
    return () => clearInterval(t);
  }, [running]);

  const fmt = (ms: number) => {
    const cs = Math.floor((ms % 1000) / 10);
    const s = Math.floor((ms / 1000) % 60);
    const m = Math.floor((ms / 60000) % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };

  return (
    <ToolCard icon={<Timer size={15} />} title="Stopwatch" tagline="Count up while you work">
      <div className="flex min-h-[220px] flex-col items-center justify-center">
        <p className="text-[52px] font-bold tabular-nums tracking-tight text-frost-100">{fmt(elapsed)}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-frost-500">{running ? "running" : "paused"}</p>
        <div className="mt-7 flex justify-center gap-2">
          <button
            onClick={() => {
              if (running) {
                base.current += Date.now() - startedAt.current;
                setRunning(false);
              } else {
                startedAt.current = Date.now();
                setRunning(true);
              }
            }}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[13px] font-semibold text-white transition active:scale-[0.98]",
              running ? "bg-rose-500/80 hover:bg-rose-500" : "bg-[var(--accent)] hover:brightness-110",
            )}
          >
            {running ? "Stop" : "Start"}
          </button>
          <button
            onClick={() => {
              setRunning(false);
              setElapsed(0);
              base.current = 0;
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[13px] font-semibold text-frost-300 transition hover:bg-white/10 hover:text-frost-100"
          >
            Reset
          </button>
        </div>
      </div>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

function NotesTool() {
  const { state, actions } = useQyn();
  const { toast } = useUi();

  return (
    <ToolCard icon={<StickyNote size={15} />} title="Notes" tagline="Sticky thoughts, saved automatically">
      <div className="flex min-h-[220px] flex-col">
        <textarea
          value={state.notes}
          onChange={(e) => actions.setNotes(e.target.value)}
          placeholder="Write anything… it saves as you type."
          className="accent-scroll h-full min-h-[180px] w-full flex-1 resize-none rounded-xl border border-white/8 bg-white/4 p-3 text-[13.5px] leading-relaxed text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] focus:bg-white/6"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11.5px] tabular-nums text-frost-500">{state.notes.length} characters</span>
          <button
            onClick={() => {
              actions.setNotes("");
              toast("Notes cleared");
            }}
            disabled={!state.notes}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium text-frost-500 transition hover:bg-white/6 hover:text-frost-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eraser size={12} /> Clear
          </button>
        </div>
      </div>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ */
/* Screenshot                                                          */
/* ------------------------------------------------------------------ */

function ScreenshotTool() {
  const { toast } = useUi();
  const bridge = getDesktop();

  async function capture() {
    if (!bridge) {
      toast("Screenshot capture is available in the installed app");
      return;
    }
    try {
      const dataUrl = await bridge.captureScreen();
      if (!dataUrl) {
        toast("Couldn’t capture the screen", { icon: <span className="text-amber-300">⚠</span> });
        return;
      }
      const res = await bridge.saveScreenshot(dataUrl);
      if (res.ok) {
        toast(`Saved to Pictures\\QynOne`, { icon: <Check size={15} className="text-accent" /> });
      } else {
        toast(res.error ? `Couldn’t save — ${res.error}` : "Couldn’t save the screenshot", {
          icon: <span className="text-amber-300">⚠</span>,
        });
      }
    } catch {
      toast("Couldn’t capture the screen", { icon: <span className="text-amber-300">⚠</span> });
    }
  }

  return (
    <ToolCard icon={<Camera size={15} />} title="Screenshot" tagline="Grab the screen in one click">
      <div className="glass-soft relative flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-xl p-6 text-center">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 65%)", opacity: 0.6 }}
        />
        <Camera size={26} className="relative text-accent" />
        <p className="relative mt-2 text-[13px] font-medium text-frost-200">
          {bridge ? "One click — saved to your Pictures folder" : "Available in the installed app"}
        </p>
        <button
          onClick={capture}
          className="relative mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Camera size={14} /> Capture screen
        </button>
      </div>
    </ToolCard>
  );
}

/* ------------------------------------------------------------------ */
/* System shortcuts                                                    */
/* ------------------------------------------------------------------ */

const SYSTEM_LINKS: Array<{ label: string; uri: string; sub: string }> = [
  { label: "Display", uri: "ms-settings:display", sub: "Resolution & scaling" },
  { label: "Sound", uri: "ms-settings:sound", sub: "Volume & devices" },
  { label: "Network", uri: "ms-settings:network-status", sub: "Wi-Fi & internet" },
  { label: "Bluetooth", uri: "ms-settings:bluetooth", sub: "Pair devices" },
  { label: "Storage", uri: "ms-settings:storage", sub: "Disk space" },
  { label: "Windows Update", uri: "ms-settings:windowsupdate", sub: "Latest updates" },
  { label: "Personalization", uri: "ms-settings:personalization", sub: "Themes & colors" },
  { label: "Apps", uri: "ms-settings:appsfeatures", sub: "Installed apps" },
];

function SystemShortcuts() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/8 bg-white/4 text-accent">
          <MonitorCog size={15} />
        </span>
        <div>
          <h3 className="text-[14.5px] font-bold tracking-tight text-frost-100">Windows settings</h3>
          <p className="text-[11.5px] text-frost-500">Jump straight to the right page — no hunting through menus.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SYSTEM_LINKS.map((link) => (
          <SystemLink key={link.uri} {...link} />
        ))}
      </div>
    </div>
  );
}

function SystemLink({ label, uri, sub }: { label: string; uri: string; sub: string }) {
  const { toast } = useUi();
  const bridge = getDesktop();

  return (
    <button
      onClick={() => {
        if (bridge) {
          bridge.launch(uri).then((res) => {
            if (res.ok) toast(`Opening ${label} settings`);
            else toast(res.error ? `Couldn’t open — ${res.error}` : `Couldn’t open ${label}`, {
              icon: <span className="text-amber-300">⚠</span>,
            });
          });
        } else {
          toast(`In the desktop app this opens Windows ${label} settings`);
        }
      }}
      className="glass-soft group flex items-center gap-3 rounded-2xl p-3.5 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-white/6"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-white/8 bg-white/4 text-frost-300 transition group-hover:text-accent">
        <MonitorCog size={16} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-frost-100">{label}</span>
        <span className="block truncate text-[11px] text-frost-500">{sub}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Shared tool card                                                    */
/* ------------------------------------------------------------------ */

function ToolCard({
  icon,
  title,
  tagline,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/8 bg-white/4 text-accent">
          {icon}
        </span>
        <div>
          <h3 className="text-[14.5px] font-bold tracking-tight text-frost-100">{title}</h3>
          <p className="text-[11.5px] text-frost-500">{tagline}</p>
        </div>
      </div>
      {children}
    </div>
  );
}