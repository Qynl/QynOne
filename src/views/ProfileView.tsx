import { motion } from "framer-motion";
import { Check, Cpu, Download, HardDrive, Monitor, Server, User } from "lucide-react";
import { COLOR_CHOICES, TextInput } from "../components/modals";
import { Avatar, SectionHeader } from "../components/ui";
import { isDesktop } from "../lib/desktop";
import { useQyn } from "../lib/store";
import { useSystemInfo } from "../lib/system";
import type { ViewId } from "../lib/types";
import { cn, shade } from "../lib/utils";

export function ProfileView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const { state, actions } = useQyn();
  const sys = useSystemInfo();
  const p = state.profile;

  const totalLaunches = state.recents.reduce((sum, r) => sum + r.count, 0);
  const favorites = state.apps.filter((a) => a.favorite).length;

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 py-7 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-frost-100">Profile</h1>
          <p className="mt-1 text-[13.5px] text-frost-400">
            Make it yours — this is your spot on your PC.
          </p>
        </div>

        <div className="mt-7 space-y-5">
          {/* ---------- Identity ---------- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Your identity" icon={<User size={13} className="text-accent" />} />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-3">
                <Avatar name={p.name} color={p.color} size={76} ring />
                <span className="text-[11px] font-medium text-frost-500">
                  {p.name ? "That’s you" : "Set your name"}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-3.5">
                <TextInput
                  value={p.name}
                  onChange={(v) => actions.updateProfile({ name: v })}
                  placeholder="Your name, e.g. Alex"
                  autoFocus
                />
                <TextInput
                  value={p.tagline}
                  onChange={(v) => actions.updateProfile({ tagline: v })}
                  placeholder="One line about your setup, e.g. Gaming · Code · School"
                />
                <div>
                  <p className="mb-2 text-[12px] font-medium tracking-wide text-frost-300">Avatar color</p>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_CHOICES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => actions.updateProfile({ color: c })}
                        className={cn(
                          "relative h-7 w-7 rounded-full transition hover:scale-110",
                          p.color === c && "ring-2 ring-white/80 ring-offset-2 ring-offset-[#0f1628]",
                        )}
                        style={{ background: `linear-gradient(145deg, ${c}, ${shade(c, -30)})` }}
                      >
                        {p.color === c && <Check size={13} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-frost-500">
                  Saved automatically — your greeting on Home uses your name, and your avatar follows you
                  everywhere in QynOne.
                </p>
              </div>
            </div>
          </section>

          {/* ---------- Stats ---------- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="Your numbers" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Total launches" value={totalLaunches} />
              <StatTile label="Pinned apps" value={favorites} />
              <StatTile label="Applications" value={state.apps.length} />
              <StatTile label="Virtual folders" value={state.folders.length} />
            </div>
          </section>

          {/* ---------- This machine ---------- */}
          <section className="glass rounded-2xl p-5">
            <SectionHeader title="This machine" />
            <div className="space-y-1">
              <InfoRow icon={<Server size={14} />} label="PC name" value={sys.hostname ?? "—"} />
              <InfoRow
                icon={<Monitor size={14} />}
                label="Operating system"
                value={sys.arch ? `${sys.os} · ${sys.arch}` : sys.os}
              />
              <InfoRow icon={<Cpu size={14} />} label="Processor" value={sys.cpuModel ?? `${sys.cores} cores`} />
              <InfoRow icon={<HardDrive size={14} />} label="Memory" value={`${sys.memoryGb} GB`} />
              <InfoRow
                icon={<HardDrive size={14} />}
                label="Your environment"
                value={isDesktop() ? "On this PC — %APPDATA%\\QynOne" : "This browser (web preview)"}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4">
              <p className="text-[12px] text-frost-500">QynOne v0.1.0 · Early build</p>
              <button
                onClick={() => onNavigate("settings")}
                className="glass-soft inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-[12.5px] font-medium text-frost-300 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:text-frost-100"
              >
                <Download size={13} /> Backup & restore
              </button>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-soft rounded-xl px-3 py-3.5 text-center">
      <p className="text-[22px] font-bold tabular-nums tracking-tight text-frost-100">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium text-frost-500">{label}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-400">
        {icon}
      </span>
      <span className="w-36 shrink-0 truncate text-[12.5px] text-frost-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-frost-100">{value}</span>
    </div>
  );
}