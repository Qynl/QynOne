import { motion } from "framer-motion";
import {
  AlertTriangle,
  Cable,
  Check,
  Database,
  Download,
  History,
  Palette,
  Plug,
  Plus,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Trash2,
  Unplug,
  Upload,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar, SectionHeader, Toggle, useUi } from "../components/ui";
import { listOllamaModels, PROVIDERS, useAi } from "../lib/ai";
import { getDesktop, isDesktop } from "../lib/desktop";
import type { McpServerConfig, McpServerStatus } from "../lib/desktop";
import { MCP_PRESETS, useMcp } from "../lib/mcp";
import type { McpPreset } from "../lib/mcp";
import { useQyn } from "../lib/store";
import { visionEnabled } from "../lib/vision";
import { ACCENT_LIST, WALLPAPER_LIST } from "../lib/theme";
import type { AccentId, QynState, ViewId, WallpaperId } from "../lib/types";
import { cn, shade } from "../lib/utils";

export function SettingsView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const { state, actions } = useQyn();
  const { toast } = useUi();
  const s = state.settings;
  const fileRef = useRef<HTMLInputElement>(null);

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qynone-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<QynState>;
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.apps) ||
        !Array.isArray(parsed.folders) ||
        !Array.isArray(parsed.recents)
      ) {
        toast("That file isn’t a QynOne backup", { icon: <AlertTriangle size={15} className="text-amber-300" /> });
        return;
      }
      actions.importState(parsed as QynState);
      toast("Environment restored");
    } catch {
      toast("Couldn’t read that backup", { icon: <AlertTriangle size={15} className="text-amber-300" /> });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-7 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-frost-100">Settings</h1>
          <p className="mt-1 text-[13.5px] text-frost-400">
            Tune QynOne until it feels exactly like your environment.
          </p>
        </div>

        <div className="mt-7 space-y-5">
          {/* ---- Profile ---- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Profile" icon={<User size={13} className="text-accent" />} />
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={state.profile.name} color={state.profile.color} size={44} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-frost-100">
                    {state.profile.name || "Your profile"}
                  </p>
                  <p className="truncate text-[12px] text-frost-500">
                    {state.profile.tagline || "Name, avatar & personal stats"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate("profile")}
                className="glass-soft inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
              >
                Edit profile
              </button>
            </div>
          </section>

          {/* ---- Appearance ---- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Appearance" icon={<Palette size={13} className="text-accent" />} />

            <p className="text-[12.5px] font-medium text-frost-400">Accent color</p>
            <div className="mt-2.5 flex flex-wrap gap-4">
              {ACCENT_LIST.map((accent) => {
                const active = s.accent === accent.id;
                return (
                  <button
                    key={accent.id}
                    onClick={() => actions.patchSettings({ accent: accent.id as AccentId })}
                    className="group flex w-[84px] flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "relative h-9 w-9 rounded-full transition group-hover:scale-105",
                        active && "ring-2 ring-white/85 ring-offset-2 ring-offset-[#0f1628]",
                      )}
                      style={{ background: `linear-gradient(145deg, ${accent.color}, ${shade(accent.color, -30)})` }}
                    >
                      {active && <Check size={15} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium transition",
                        active ? "text-frost-100" : "text-frost-500 group-hover:text-frost-300",
                      )}
                    >
                      {accent.name}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-6 text-[12.5px] font-medium text-frost-400">Wallpaper</p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
              {WALLPAPER_LIST.map((w) => {
                const active = s.wallpaper === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => actions.patchSettings({ wallpaper: w.id as WallpaperId })}
                    className={cn(
                      "glass-soft overflow-hidden rounded-2xl p-2 text-left transition",
                      active
                        ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] shadow-[0_12px_36px_-16px_var(--accent-glow)]"
                        : "hover:border-white/16",
                    )}
                  >
                    <div
                      className="relative h-20 overflow-hidden rounded-[12px]"
                      style={{
                        background: `radial-gradient(120% 100% at 20% 0%, ${w.baseA} 0%, ${w.baseB} 60%, #02040a 100%)`,
                      }}
                    >
                      <div
                        className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full blur-2xl"
                        style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 65%)", opacity: 0.5 }}
                      />
                      {active && (
                        <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90">
                          <Check size={13} className="text-[#0f1628]" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className={cn("mt-2 px-1 text-[13px] font-semibold", active ? "text-frost-100" : "text-frost-200")}>
                      {w.name}
                    </p>
                    <p className="truncate px-1 pb-1 text-[11.5px] text-frost-500">{w.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---- Startup ---- */}
          <StartupSection />

          {/* ---- Interface ---- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Interface" icon={<SlidersHorizontal size={13} className="text-accent" />} />
            <div className="space-y-1">
              <SettingRow
                title="Motion & hover"
                description="Gentle lifts, fades and glows across the interface."
              >
                <Toggle checked={s.motion} onChange={(v) => actions.patchSettings({ motion: v })} />
              </SettingRow>
              <SettingRow
                title="Clock in the top bar"
                description="Live time and date at the top of every view."
              >
                <Toggle checked={s.clock} onChange={(v) => actions.patchSettings({ clock: v })} />
              </SettingRow>
              <SettingRow
                title="Battery in the top bar"
                description="Battery level pill, right beside the clock."
              >
                <Toggle checked={s.battery} onChange={(v) => actions.patchSettings({ battery: v })} />
              </SettingRow>
            </div>
          </section>

          {/* ---- AI assistant ---- */}
          <AiSettingsSection />

          {/* ---- Engine connections (MCP) ---- */}
          <ConnectionsSection />

          {/* ---- Data ---- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Data & privacy" icon={<Database size={13} className="text-accent" />} />
            <p className="text-[12.5px] leading-relaxed text-frost-500">
              {isDesktop()
                ? "Your environment lives in a file on this PC (%APPDATA%\\QynOne) — saved automatically as you work. No cloud, no account, nothing leaves the machine."
                : "In the web preview your environment is kept in this browser. In the real QynOne desktop app it’s saved to a file on your PC."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  actions.clearRecents();
                  toast("Recent activity cleared");
                }}
                className="glass-soft inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
              >
                <History size={13} /> Clear recent activity
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Reset QynOne to its starter environment? You'll lose your own apps and folders.")) {
                    actions.resetAll();
                    toast("QynOne reset to defaults");
                  }
                }}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/8 px-3.5 text-[12.5px] font-medium text-red-200 transition hover:border-red-400/40 hover:bg-red-400/14"
              >
                <RotateCcw size={13} /> Reset to defaults
              </button>
            </div>
          </section>

          {/* ---- Backup & restore ---- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Backup & restore" icon={<Database size={13} className="text-accent" />} />
            <p className="text-[12.5px] leading-relaxed text-frost-500">
              Download your whole environment — every virtual folder, application, favorite and setting — as one JSON
              file. Restore it here or on another PC.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                onClick={exportBackup}
                className="glass-soft inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
              >
                <Download size={13} /> Download backup
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="glass-soft inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
              >
                <Upload size={13} /> Restore from file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importBackup(file);
                  e.target.value = "";
                }}
              />
            </div>
          </section>

          {/* ---- About ---- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="About QynOne" icon={<Sparkles size={13} className="text-accent" />} />
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(145deg,var(--accent),#3a5fd6)] shadow-[0_10px_28px_-8px_var(--accent-glow)] ring-1 ring-white/20">
                <Sparkles size={18} className="text-white" strokeWidth={1.9} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-frost-100">
                  QynOne <span className="ml-1 font-normal text-frost-500">v0.1.0 · Early build</span>
                </p>
                <p className="mt-1.5 max-w-lg text-[13px] leading-relaxed text-frost-400">
                  One clean, beautiful place for the applications, games, projects, files and tools you use every
                  day. QynOne is the first thing you open on your PC — your virtual layer over Windows.
                </p>
              </div>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Startup — launch QynOne with Windows via a real OS login item.      */
/* ------------------------------------------------------------------ */

function StartupSection() {
  const { toast } = useUi();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const bridge = getDesktop();
    if (!bridge) return;
    bridge
      .autostartGet()
      .then((r) => {
        if (!alive) return;
        setEnabled(r.enabled);
        setReady(r.available);
      })
      .catch(() => {
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /* A browser can't register OS startup — this section exists only in
     the installed desktop app. */
  if (!isDesktop()) return null;

  const toggle = (next: boolean) => {
    setEnabled(next);
    const bridge = getDesktop();
    if (!bridge) return;
    bridge
      .autostartSet(next)
      .then((r) => {
        setEnabled(r.enabled);
        if (!r.ok) {
          toast(r.error ?? "Couldn't update the startup setting", {
            icon: <AlertTriangle size={15} className="text-amber-300" />,
          });
        }
      })
      .catch(() => {
        setEnabled(false);
        toast("Couldn't update the startup setting", {
          icon: <AlertTriangle size={15} className="text-amber-300" />,
        });
      });
  };

  return (
    <section className="glass rounded-2xl p-5">
      <SectionHeader title="Startup" icon={<Power size={13} className="text-accent" />} />
      <div className="space-y-1">
        <SettingRow
          title="Start QynOne with Windows"
          description="Opens automatically after you sign in — straight into the Hello screen, then Home."
        >
          <Toggle checked={enabled} disabled={!ready} onChange={toggle} />
        </SettingRow>
      </div>
      <p className="mt-2 border-t border-white/6 px-3 pt-3 text-[11px] leading-relaxed text-frost-500">
        Uses a normal Windows startup entry for your user account (HKCU Run) — no admin rights needed. Turn it off
        here any time.
      </p>
    </section>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition hover:bg-white/3">
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-frost-100">{title}</p>
        <p className="mt-0.5 text-[12px] text-frost-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI assistant settings — real model, configured by the user          */
/* ------------------------------------------------------------------ */

function AiSettingsSection() {
  const { config, saveConfig, testConnection } = useAi();
  const [test, setTest] = useState<{ ok: boolean; message: string; models?: string[] } | null>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (config.provider === "ollama") {
      listOllamaModels(config.endpoint || PROVIDERS.ollama.endpoint)
        .then(setModels)
        .catch(() => setModels([]));
    } else {
      setModels([]);
    }
  }, [config.provider, config.endpoint]);

  async function runTest() {
    setTesting(true);
    setTest(null);
    const res = await testConnection();
    setTest(res);
    setTesting(false);
    if (res.models) setModels(res.models);
  }

  return (
    <section className="glass rounded-2xl p-5">
      <SectionHeader title="AI assistant" icon={<Sparkles size={13} className="text-accent" />} />
      <p className="text-[12.5px] leading-relaxed text-frost-500">
        Qyn, the face on your Home screen, is powered by a <span className="text-frost-300">real language model</span>.
        Connect it to a model you already run — Ollama on this PC, OpenAI, or any OpenAI-compatible endpoint — and it
        can open apps, manage the vault and read your system. No fake assistant, ever.
      </p>

      {/* Provider */}
      <p className="mt-4 text-[12.5px] font-medium text-frost-400">Provider</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(Object.keys(PROVIDERS) as Array<keyof typeof PROVIDERS>).map((id) => {
          const active = config.provider === id;
          return (
            <button
              key={id}
              onClick={() => {
                void saveConfig({
                  ...config,
                  provider: id,
                  endpoint: config.endpoint || PROVIDERS[id].endpoint,
                  model: config.model || PROVIDERS[id].model,
                });
              }}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition",
                active
                  ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft"
                  : "border-white/8 bg-white/4 hover:bg-white/8",
              )}
            >
              <p className={cn("text-[12.5px] font-semibold", active ? "text-frost-100" : "text-frost-300")}>
                {PROVIDERS[id].label}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-frost-500">
                {id === "ollama" ? "Local · free · private" : id === "openai" ? "Cloud · needs API key" : "Your own endpoint"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Endpoint */}
      <div className="mt-4 space-y-3">
        <div>
          <p className="mb-1.5 text-[12px] font-medium tracking-wide text-frost-300">Endpoint</p>
          <input
            value={config.endpoint}
            onChange={(e) => void saveConfig({ ...config, endpoint: e.target.value })}
            placeholder={PROVIDERS[config.provider]?.endpoint || "https://…/v1"}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 font-mono text-[12.5px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[12px] font-medium tracking-wide text-frost-300">Model</p>
            {config.provider === "ollama" && (
              <button
                onClick={() =>
                  listOllamaModels(config.endpoint || PROVIDERS.ollama.endpoint)
                    .then(setModels)
                    .catch(() => setModels([]))
                }
                className="text-[11px] font-medium text-frost-500 transition hover:text-accent"
              >
                Refresh list
              </button>
            )}
          </div>
          <input
            value={config.model}
            onChange={(e) => void saveConfig({ ...config, model: e.target.value })}
            placeholder={config.provider === "ollama" ? "e.g. llama3.2 (auto-pick first if empty)" : PROVIDERS[config.provider]?.model || "model id"}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 font-mono text-[12.5px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
          />
          {config.provider === "ollama" && models.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {models.slice(0, 8).map((m) => (
                <button
                  key={m}
                  onClick={() => void saveConfig({ ...config, model: m })}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-medium transition",
                    config.model === m
                      ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-accent"
                      : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {(config.provider === "openai" || config.provider === "custom") && (
          <div>
            <p className="mb-1.5 text-[12px] font-medium tracking-wide text-frost-300">API key</p>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={config.key}
                onChange={(e) => void saveConfig({ ...config, key: e.target.value })}
                placeholder="sk-…"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 font-mono text-[12.5px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="h-10 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 text-[11.5px] font-medium text-frost-400 transition hover:bg-white/10 hover:text-frost-200"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        )}

        {/* Vision — let Nex actually see screen captures and attached photos */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-frost-100">Send screenshots &amp; photos to the model</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-frost-500">
              {config.provider === "ollama"
                ? "Most local models are text-only, so this is off by default — turn it on for image-capable models (e.g. llava)."
                : "On by default — Nex can see screen captures and attached photos. If a model rejects images, Nex retries without them automatically."}
            </p>
          </div>
          <Toggle checked={visionEnabled(config)} onChange={(v) => void saveConfig({ ...config, vision: v })} />
        </div>
      </div>

      {/* Test */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={runTest}
          disabled={testing}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          <Sparkles size={13} /> {testing ? "Testing…" : "Test connection"}
        </button>
        {test && (
          <p className={cn("min-w-0 flex-1 text-[12px] leading-relaxed", test.ok ? "text-emerald-300" : "text-rose-300")}>
            {test.message}
          </p>
        )}
      </div>

      <p className="mt-4 border-t border-white/6 pt-3 text-[11px] leading-relaxed text-frost-500">
        {isDesktop()
          ? "Saved locally in your user data folder (qynone.env, next to qynone-state.json). The API key never leaves this PC and is never logged."
          : "Saved in this browser for the preview. In the desktop app the same settings live in qynone.env on your PC. Note: in the web preview, a localhost Ollama instance can't be reached — use OpenAI or a public endpoint here."}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Engine connections (MCP) — Roblox Studio, Unreal Engine and any     */
/* MCP server. Nex gets the engine's tools in chat the moment one      */
/* connects.                                                           */
/* ------------------------------------------------------------------ */

const TRANSPORT_LABEL: Record<McpServerStatus["transport"], string> = {
  stdio: "stdio · launch command",
  http: "http · endpoint",
};

const STATE_DOT: Record<McpServerStatus["state"], string> = {
  idle: "bg-zinc-500",
  connecting: "animate-pulse bg-amber-300",
  connected: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  error: "bg-rose-400",
};

const STATE_LABEL: Record<McpServerStatus["state"], string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  error: "Offline",
};

function envToLines(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function linesToEnv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function ConnectionsSection() {
  const mcp = useMcp();
  const { toast } = useUi();
  const [editing, setEditing] = useState<null | { id: string; draft: McpServerConfig }>(null);
  const [saving, setSaving] = useState(false);

  const beginNew = (preset: McpPreset) => {
    const built = preset.build();
    setEditing({ id: "new", draft: { ...built, id: "" } });
  };

  const beginEdit = (server: McpServerStatus) => {
    setEditing({ id: server.id, draft: { ...server } });
  };

  const patchDraft = (p: Partial<McpServerConfig>) => {
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));
  };

  async function persist() {
    if (!editing) return;
    const { id, draft } = editing;
    const name = draft.name.trim();
    if (!name) {
      toast("Give the connection a name", { icon: <AlertTriangle size={15} className="text-amber-300" /> });
      return;
    }
    if (draft.transport === "stdio" && !draft.command.trim()) {
      toast("A stdio connection needs a launch command", { icon: <AlertTriangle size={15} className="text-amber-300" /> });
      return;
    }
    if (draft.transport === "http" && !/^https?:\/\//i.test(draft.url.trim())) {
      toast("An HTTP connection needs a URL like http://127.0.0.1:8000/mcp", { icon: <AlertTriangle size={15} className="text-amber-300" /> });
      return;
    }
    setSaving(true);
    try {
      const res = await mcp.save({ ...draft, name });
      if (!res.ok) {
        toast(res.error ?? "Couldn't save the connection", { icon: <AlertTriangle size={15} className="text-amber-300" /> });
        return;
      }
      toast(id === "new" ? `${name} added` : `${name} updated`);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass rounded-2xl p-5">
      <SectionHeader title="Connections · MCP" icon={<Cable size={13} className="text-accent" />} />
      <p className="text-[12.5px] leading-relaxed text-frost-500">
        Give Nex <span className="text-frost-300">real hands inside your tools</span>. Roblox Studio and Unreal Engine
        ship official MCP servers; once connected, every tool the engine exposes becomes callable in chat — Nex can
        read and write scripts, run code and drive the editor live.
      </p>

      {!isDesktop() && (
        <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-200/90">
          MCP connections live in the QynOne desktop app — engines run on your PC, so this web preview can't reach
          them. Install the desktop build to connect Roblox Studio or Unreal Engine.
        </p>
      )}

      {!editing && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {MCP_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => beginNew(preset)}
              disabled={!mcp.supported}
              className="glass-soft inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={13} className="text-accent" />
              {preset.key === "custom" ? "Custom MCP server" : preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-semibold text-frost-100">
              {editing.id === "new" ? "New connection" : "Edit connection"}
            </p>
            <button onClick={() => setEditing(null)} className="grid h-6 w-6 place-items-center rounded-md text-frost-500 transition hover:bg-white/6 hover:text-frost-200">
              <X size={13} />
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-frost-400">Name</p>
              <input
                value={editing.draft.name}
                onChange={(e) => patchDraft({ name: e.target.value })}
                placeholder="Roblox Studio"
                className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-[12.5px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-frost-400">Transport</p>
              <div className="flex gap-1.5">
                {(
                  [
                    { id: "stdio" as const, label: "stdio (command)" },
                    { id: "http" as const, label: "http (URL)" },
                  ]
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() =>
                      patchDraft({
                        transport: t.id,
                        ...(t.id === "http" ? { command: "", args: [] } : { url: "" }),
                      })
                    }
                    className={cn(
                      "h-9 rounded-xl border px-3 text-[11.5px] font-medium transition",
                      editing.draft.transport === t.id
                        ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft text-frost-100"
                        : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {editing.draft.transport === "stdio" ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-frost-400">Command</p>
                <input
                  value={editing.draft.command}
                  onChange={(e) => patchDraft({ command: e.target.value })}
                  placeholder={'cmd.exe'}
                  className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-[12px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-frost-400">
                  Arguments <span className="normal-case text-frost-600">(one per line · %ENV% expands)</span>
                </p>
                <textarea
                  value={editing.draft.args.join("\n")}
                  onChange={(e) => patchDraft({ args: e.target.value.split(/\r?\n/).filter((a) => a.trim()) })}
                  placeholder={'/c\n%LOCALAPPDATA%\\Roblox\\mcp.bat'}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-medium tracking-wide text-frost-400">
                  Environment <span className="normal-case text-frost-600">(optional · KEY=VALUE per line)</span>
                </p>
                <textarea
                  value={envToLines(editing.draft.env)}
                  onChange={(e) => patchDraft({ env: linesToEnv(e.target.value) })}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                />
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium tracking-wide text-frost-400">MCP endpoint URL</p>
              <input
                value={editing.draft.url}
                onChange={(e) => patchDraft({ url: e.target.value })}
                placeholder="http://127.0.0.1:8000/mcp"
                className="h-9 w-full rounded-xl border border-white/10 bg-white/5 px-3 font-mono text-[12px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Toggle checked={editing.draft.autoConnect} onChange={(v) => patchDraft({ autoConnect: v })} />
              <span className="text-[11.5px] text-frost-400">Connect automatically when QynOne starts</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(null)}
                className="h-9 rounded-xl border border-white/10 bg-white/5 px-3.5 text-[12px] font-medium text-frost-400 transition hover:bg-white/10 hover:text-frost-200"
              >
                Cancel
              </button>
              <button
                onClick={persist}
                disabled={saving}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[12px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <Check size={13} /> {saving ? "Saving…" : "Save connection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server list */}
      {mcp.servers.length > 0 && !editing && (
        <div className="mt-4 space-y-2">
          {mcp.servers.map((server) => {
            const busy = mcp.connectingIds.includes(server.id) || server.state === "connecting";
            return (
              <div key={server.id} className="rounded-xl border border-white/7 bg-white/[0.025] px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", STATE_DOT[server.state])} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13px] font-semibold text-frost-100">{server.name}</p>
                      <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[9.5px] font-medium text-frost-500">
                        {TRANSPORT_LABEL[server.transport]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-frost-500">
                      {server.state === "connected"
                        ? `${STATE_LABEL[server.state]} · ${server.tools.length} tool${server.tools.length === 1 ? "" : "s"} (${server.tools.slice(0, 5).map((t) => t.name).join(", ")}${server.tools.length > 5 ? "…" : ""})`
                        : server.state === "error"
                          ? `${server.error || "Connection failed"}`
                          : STATE_LABEL[server.state]}
                    </p>
                  </div>
                  {server.state === "error" && server.log.length > 0 && (
                    <p className="hidden max-w-[180px] truncate text-[10px] text-frost-600 md:block" title={server.log.join("\n")}>
                      {server.log[server.log.length - 1]}
                    </p>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    {server.state === "connected" ? (
                      <button
                        onClick={() => void mcp.disconnect(server.id)}
                        title="Disconnect"
                        className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-white/6 hover:text-frost-200"
                      >
                        <Unplug size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={() => void mcp.connect(server.id)}
                        disabled={busy}
                        title="Connect"
                        className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-accent-soft hover:text-frost-100 disabled:opacity-40"
                      >
                        {busy ? <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/15 border-t-white/70" /> : <Plug size={13} />}
                      </button>
                    )}
                    <button
                      onClick={() => beginEdit(server)}
                      title="Edit"
                      className="grid h-7 w-7 place-items-center rounded-lg text-frost-500 transition hover:bg-white/6 hover:text-frost-200"
                    >
                      <SquarePen size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove the ${server.name} connection?`)) void mcp.remove(server.id);
                      }}
                      title="Remove"
                      className="grid h-7 w-7 place-items-center rounded-lg text-frost-600 transition hover:bg-red-400/10 hover:text-red-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 border-t border-white/6 pt-3 text-[11px] leading-relaxed text-frost-500">
        <span className="font-medium text-frost-400">Roblox Studio:</span> open Studio → Assistant → ⋯ → Manage MCP
        Servers → enable “Studio as MCP server”. It must stay open while Nex works.
        <br />
        <span className="font-medium text-frost-400">Unreal Engine (5.6+):</span> enable the <em>Unreal MCP</em> and{" "}
        <em>All Toolsets</em> plugins in the editor, then run <code className="text-frost-300">ModelContextProtocol.StartServer</code>{" "}
        (or turn on Auto Start Server in Editor Preferences → Model Context Protocol). Nex connects over local HTTP.
      </p>
    </section>
  );
}