import { motion } from "framer-motion";
import { Check, FolderOpen, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { getDesktop } from "../lib/desktop";
import type { ShortcutHit } from "../lib/desktop";
import { ICON_CHOICES, resolveIcon } from "../lib/icons";
import { useQyn } from "../lib/store";
import type { IconKey } from "../lib/icons";
import { cn, shade } from "../lib/utils";
import { useUi } from "./ui";

export const COLOR_CHOICES = [
  "#5b8cff",
  "#7fb5e0",
  "#4ac9c2",
  "#5fd48f",
  "#f2b84b",
  "#ff9e6b",
  "#ff8f7a",
  "#f098e0",
  "#b08cff",
  "#c9a0ff",
];

/* ------------------------------------------------------------------ */
/* Shared modal shell                                                  */
/* ------------------------------------------------------------------ */

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div
        className="absolute inset-0 bg-[#02040a]/55 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="glass-strong relative z-10 w-full max-w-md rounded-2xl p-6"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-frost-400 transition hover:bg-white/8 hover:text-frost-100"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <h3 className="text-[17px] font-semibold tracking-tight text-frost-100">{title}</h3>
        {subtitle && <p className="mt-1 text-[13px] leading-relaxed text-frost-400">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Primary input                                                       */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium tracking-wide text-frost-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-frost-500">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-[13.5px] text-frost-100 outline-none transition placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] focus:bg-white/8 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
    />
  );
}

export function PrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--accent-glow)] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* App modal — add a new application or edit an existing one           */
/* ------------------------------------------------------------------ */

export function AppModal({
  appId,
  presetFolderId,
  onClose,
}: {
  appId?: string;
  presetFolderId?: string | null;
  onClose: () => void;
}) {
  const { state, actions } = useQyn();
  const { toast } = useUi();
  const editing = appId ? state.apps.find((a) => a.id === appId) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [subtitle, setSubtitle] = useState(editing?.subtitle ?? "");
  const [icon, setIcon] = useState<IconKey>((editing?.icon as IconKey) ?? "appWindow");
  const [color, setColor] = useState(editing?.color ?? COLOR_CHOICES[0]);
  const [folderId, setFolderId] = useState<string | null>(editing?.folderId ?? presetFolderId ?? null);
  const [launchUri, setLaunchUri] = useState(editing?.launchUri ?? "");
  const [favorite, setFavorite] = useState(editing?.favorite ?? false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findHits, setFindHits] = useState<ShortcutHit[] | null>(null);
  const [finding, setFinding] = useState(false);

  const desktop = getDesktop();

  async function runFind() {
    if (!desktop || !findQuery.trim()) return;
    setFinding(true);
    try {
      setFindHits(await desktop.findShortcuts(findQuery.trim()));
    } catch {
      setFindHits([]);
    } finally {
      setFinding(false);
    }
  }

  const canSave = name.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const uri = launchUri.trim();
    if (editing) {
      actions.updateApp(editing.id, {
        name: name.trim(),
        subtitle: subtitle.trim() || undefined,
        icon,
        color,
        folderId,
        launchUri: uri || undefined,
        favorite,
      });
      toast(`Saved ${name.trim()}`);
    } else {
      actions.addApp({
        name: name.trim(),
        subtitle: subtitle.trim() || undefined,
        icon,
        color,
        folderId,
        launchUri: uri || undefined,
        favorite,
        tags: [],
      });
      toast(`Added ${name.trim()} to QynOne`);
    }
    onClose();
  }

  return (
    <ModalShell
      title={editing ? "Edit application" : "Add an application"}
      subtitle={
        editing
          ? "Tune how this application appears in your environment."
          : "Bring any application into your QynOne environment. Virtual folders keep it separate from Windows itself."
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          <motion.div whileHover={{ scale: 1.04 }} className="shrink-0">
            <AppIconPreview icon={icon} color={color} />
          </motion.div>
          <div className="flex-1 space-y-2.5">
            <Field label="Name">
              <TextInput value={name} onChange={setName} placeholder="e.g. Minecraft, Slack…" autoFocus />
            </Field>
            <Field label="Subtitle">
              <TextInput value={subtitle} onChange={setSubtitle} placeholder="e.g. Play with friends" />
            </Field>
          </div>
        </div>

        <Field
          label="Launch target"
          hint="What QynOne actually opens when you launch this app — the real program, opened where it lives. Nothing is moved."
        >
          <TextInput
            value={launchUri}
            onChange={setLaunchUri}
            placeholder="https://… · steam://run/… · D:\Games\app.exe · C:\…\app.lnk"
          />
        </Field>

        {desktop && (
          <div className="rounded-xl border border-white/8 bg-white/3 p-3">
            <button
              type="button"
              onClick={() => {
                setFindOpen((v) => !v);
                if (!findOpen) {
                  setFindHits(null);
                  setFindQuery("");
                }
              }}
              className="flex w-full items-center gap-2 text-[12.5px] font-medium text-frost-300 transition hover:text-frost-100"
            >
              <Search size={13} className="text-accent" />
              {findOpen ? "Close search" : "Find on this PC…"}
              <span className="ml-auto text-[11px] font-normal text-frost-500">user-level · reads Start Menu, moves nothing</span>
            </button>
            {findOpen && (
              <div className="mt-2.5 space-y-2">
                <div className="flex gap-2">
                  <TextInput
                    value={findQuery}
                    onChange={(v) => {
                      setFindQuery(v);
                      setFindHits(null);
                    }}
                    placeholder="Search installed apps, e.g. Minecraft…"
                  />
                  <button
                    type="button"
                    onClick={runFind}
                    disabled={finding || !findQuery.trim()}
                    className="h-10 shrink-0 rounded-xl bg-[var(--accent)] px-4 text-[12.5px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Find
                  </button>
                </div>
                {finding && <p className="px-1 text-[11.5px] text-frost-500">Searching shortcuts…</p>}
                {!finding && findHits !== null && findHits.length === 0 && (
                  <p className="px-1 text-[11.5px] text-frost-500">
                    Nothing found for “{findQuery.trim()}”. You can still paste a path or a steam:// link above.
                  </p>
                )}
                {!finding && findHits !== null && findHits.length > 0 && (
                  <div className="accent-scroll max-h-44 space-y-1 overflow-y-auto pr-1">
                    {findHits.map((hit) => (
                      <button
                        key={hit.path}
                        type="button"
                        onClick={() => {
                          setLaunchUri(hit.path);
                          setFindOpen(false);
                          setFindHits(null);
                          setFindQuery("");
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent-soft"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-frost-100">{hit.name}</span>
                          <span className="block truncate text-[10.5px] text-frost-500">{hit.path}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[11px] leading-relaxed text-frost-500">
                  Windows starts the chosen app with your normal user rights — QynOne never asks for admin.
                </p>
              </div>
            )}
          </div>
        )}

        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5">
            {ICON_CHOICES.map((key) => {
              const active = key === icon;
              const Glyph = resolveIcon(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={cn(
                    "grid h-9 w-full place-items-center rounded-lg border transition",
                    active
                      ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-accent-soft text-frost-100"
                      : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8 hover:text-frost-200",
                  )}
                >
                  <Glyph size={16} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "relative h-7 w-7 rounded-full transition hover:scale-110",
                  color === c && "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0f1628]",
                )}
                style={{ background: `linear-gradient(145deg, ${c}, ${shade(c, -30)})` }}
              >
                {color === c && <Check size={13} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Virtual folder">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFolderId(null)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] transition",
                folderId === null
                  ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-accent-soft text-frost-100"
                  : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8",
              )}
            >
              <FolderOpen size={13} /> Unfiled
            </button>
            {state.folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderId(f.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] transition",
                  folderId === f.id
                    ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-accent-soft text-frost-100"
                    : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8",
                )}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: f.color }}
                />
                {f.name}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/4 px-3.5 py-2.5">
          <span className="text-[13px] text-frost-300">Pin to favorites</span>
          <button
            type="button"
            onClick={() => setFavorite((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] transition",
              favorite
                ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-accent-soft text-frost-100"
                : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8",
            )}
          >
            <Check size={13} /> {favorite ? "Pinned" : "Pin"}
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-[13.5px] font-medium text-frost-300 transition hover:bg-white/10 hover:text-frost-100"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={!canSave}>
            {editing ? "Save changes" : "Add to QynOne"}
          </PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}

function AppIconPreview({ icon, color }: { icon: string; color: string }) {
  const Glyph = resolveIcon(icon);
  return (
    <div
      className="grid h-[52px] w-[52px] relative place-items-center rounded-[16px] shadow-lg ring-1 ring-white/12"
      style={{ background: `linear-gradient(145deg, ${color}, ${shade(color, -34)})` }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[16px]"
        style={{ background: "linear-gradient(150deg, rgba(255,255,255,0.3), transparent 50%)" }}
      />
      <Glyph size={26} strokeWidth={1.8} className="relative text-white" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Folder modal — create or rename a virtual folder                    */
/* ------------------------------------------------------------------ */

export function FolderModal({ folderId, onClose }: { folderId?: string; onClose: () => void }) {
  const { state, actions } = useQyn();
  const { toast } = useUi();
  const editing = folderId ? state.folders.find((f) => f.id === folderId) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<IconKey>((editing?.icon as IconKey) ?? "folderOpen");
  const [color, setColor] = useState(editing?.color ?? COLOR_CHOICES[0]);
  const canSave = useMemo(() => name.trim().length > 0, [name]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    if (editing) {
      actions.updateFolder(editing.id, { name: name.trim(), icon, color });
      toast(`Renamed folder to ${name.trim()}`);
    } else {
      actions.addFolder(name.trim(), icon, color);
      toast(`Created folder ${name.trim()}`);
    }
    onClose();
  }

  return (
    <ModalShell
      title={editing ? "Rename folder" : "New virtual folder"}
      subtitle="Virtual folders live only inside QynOne — nothing moves on your PC."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <TextInput value={name} onChange={setName} placeholder="e.g. Design, Projects…" autoFocus />
        </Field>

        <Field label="Icon">
          <div className="grid grid-cols-8 gap-1.5">
            {["folderOpen", "gamepad2", "code", "bookOpen", "film", "palette", "rocket", "globe"].map((key) => {
              const active = key === icon;
              const Glyph = resolveIcon(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key as IconKey)}
                  className={cn(
                    "grid h-9 w-full place-items-center rounded-lg border transition",
                    active
                      ? "border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-accent-soft text-frost-100"
                      : "border-white/8 bg-white/4 text-frost-400 hover:bg-white/8 hover:text-frost-200",
                  )}
                >
                  <Glyph size={16} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "relative h-7 w-7 rounded-full transition hover:scale-110",
                  color === c && "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0f1628]",
                )}
                style={{ background: `linear-gradient(145deg, ${c}, ${shade(c, -30)})` }}
              >
                {color === c && <Check size={13} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-[13.5px] font-medium text-frost-300 transition hover:bg-white/10 hover:text-frost-100"
          >
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={!canSave}>
            {editing ? "Save changes" : "Create folder"}
          </PrimaryButton>
        </div>
      </form>
    </ModalShell>
  );
}