import { motion } from "framer-motion";
import {
  Activity,
  Battery,
  Clock4,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Monitor,
  Network,
  Server,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStats } from "../lib/stats";
import { useSystemInfo } from "../lib/system";
import { cn } from "../lib/utils";

const HISTORY = 48;

function useHistory(enabled: boolean) {
  const stats = useStats();
  const [cpu, setCpu] = useState<number[]>(() => Array(HISTORY).fill(0));
  const [mem, setMem] = useState<number[]>(() => Array(HISTORY).fill(0));

  useEffect(() => {
    if (!stats) return;
    setCpu((prev) => [...prev.slice(-(HISTORY - 1)), stats.cpuPct]);
    setMem((prev) => [...prev.slice(-(HISTORY - 1)), Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100)]);
  }, [enabled, stats?.cpuPct, stats?.memUsedBytes, stats?.memTotalBytes]);

  return { cpu, mem };
}

type Section = "overview" | "hardware";

const SECTIONS: Array<{ id: Section; label: string; sub: string; icon: typeof Cpu }> = [
  { id: "overview", label: "Live overview", sub: "Load & charts", icon: Gauge },
  { id: "hardware", label: "Hardware", sub: "This machine", icon: Monitor },
];

export function SystemCenterView() {
  const [section, setSection] = useState<Section>("overview");

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-col px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-accent">System Center</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-frost-100 md:text-[30px]">
            Your PC, live.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-frost-400">
            Real readings from this machine — a beautiful replacement for opening Task Manager.
          </p>
        </div>
        <LiveBadge />
      </div>

      <div className="mt-5 flex min-h-0 flex-1 gap-4">
        {/* Left section nav */}
        <aside className="glass flex w-[188px] shrink-0 flex-col rounded-2xl p-2">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-frost-500">System</p>
          <div className="flex flex-col gap-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition",
                    active ? "bg-accent-soft text-frost-100" : "text-frost-400 hover:bg-white/5 hover:text-frost-200",
                  )}
                >
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border", active ? "border-accent-soft bg-accent-soft text-accent" : "border-white/8 bg-white/4 text-frost-400")}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{s.label}</span>
                    <span className="block truncate text-[10px] text-frost-500">{s.sub}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="accent-scroll min-h-0 flex-1 overflow-y-auto">
          {section === "overview" ? <OverviewSection /> : <HardwareSection />}
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live overview                                                       */
/* ------------------------------------------------------------------ */

function OverviewSection() {
  const stats = useStats();
  const sys = useSystemInfo();
  const { cpu, mem } = useHistory(stats !== null);

  /* Web preview: no OS access → honest "installed app only" state, no fake numbers. */
  if (!stats) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
        <Monitor size={26} className="text-frost-500/60" />
        <p className="mt-4 text-[15px] font-semibold text-frost-200">Live readings appear in the installed app</p>
        <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-frost-500">
          QynOne reads real CPU, memory and uptime straight from this machine at user level. The web preview has no
          access to the OS, so it shows nothing rather than pretending.
        </p>
        <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <HardwareCard icon={<Monitor size={14} />} label="Operating system" value={sys.os} />
          <HardwareCard icon={<Server size={14} />} label="PC name" value={sys.hostname ?? "—"} />
          <HardwareCard icon={<Cpu size={14} />} label="Processor" value={sys.cpuModel ?? "—"} />
          <HardwareCard icon={<MemoryStick size={14} />} label="Memory" value={sys.memoryGb !== null ? `${sys.memoryGb} GB` : "—"} />
        </div>
      </div>
    );
  }

  const memPct = Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100);
  const memUsedGb = (stats.memUsedBytes / 2 ** 30).toFixed(1);
  const memTotalGb = Math.max(1, Math.round(stats.memTotalBytes / 2 ** 30));

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Cpu size={15} />} label="CPU" value={`${stats.cpuPct}%`} sub={stats.cpuModel ?? `${stats.cores} logical processors`} tone={toneFor(stats.cpuPct)} bar={stats.cpuPct} />
        <StatCard icon={<MemoryStick size={15} />} label="Memory" value={`${memPct}%`} sub={`${memUsedGb} / ${memTotalGb} GB used`} tone={toneFor(memPct)} bar={memPct} />
        <StatCard icon={<Clock4 size={15} />} label="Uptime" value={formatUptime(stats.uptimeSec)} sub="since last boot" tone="good" bar={0} />
        <StatCard icon={<Activity size={15} />} label="Cores" value={`${stats.cores}`} sub={stats.arch ? `${stats.arch} · ${stats.hostname}` : "logical processors"} tone="good" bar={0} />
      </div>

      {/* Live charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard icon={<Cpu size={14} />} title="CPU load" value={`${stats.cpuPct}%`} data={cpu} color="var(--accent)" />
        <ChartCard icon={<MemoryStick size={14} />} title="Memory" value={`${memPct}% · ${memUsedGb} GB`} data={mem} color="#7ce0c9" />
      </div>

      {/* Pressure strip */}
      <div className="glass flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl px-5 py-4">
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-frost-500">
            <span>Memory pressure</span>
            <span className={cn("tabular-nums", memPct >= 85 ? "text-rose-300" : memPct >= 60 ? "text-amber-200" : "text-frost-300")}>{memPct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/8">
            <motion.div
              className={cn("h-full rounded-full", memPct >= 85 ? "bg-gradient-to-r from-rose-400 to-rose-300" : memPct >= 60 ? "bg-gradient-to-r from-amber-400 to-amber-300" : "bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_60%,#fff)] to-[var(--accent)]")}
              animate={{ width: `${Math.max(2, memPct)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-frost-500">
          <Network size={13} className="text-frost-600" />
          <span className={sys.online ? "font-semibold text-emerald-300/90" : "font-semibold text-rose-300/90"}>{sys.online ? "online" : "offline"}</span>
          {sys.netType && <span className="text-frost-600">· {sys.netType}</span>}
        </div>
        {sys.battery && (
          <div className="flex items-center gap-2 text-[11.5px] text-frost-500">
            <Battery size={13} className="text-frost-600" />
            <span className="font-semibold text-frost-300">{Math.round(sys.battery.level * 100)}%</span>
            <span className="text-frost-600">{sys.battery.charging ? "charging" : "on battery"}</span>
          </div>
        )}
        <p className="w-full text-[10.5px] leading-relaxed text-frost-600">
          All readings are read at user level — QynOne never requests elevated access.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hardware                                                            */
/* ------------------------------------------------------------------ */

function HardwareSection() {
  const sys = useSystemInfo();

  const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    { icon: <Monitor size={14} />, label: "Operating system", value: sys.os },
    { icon: <Server size={14} />, label: "PC name", value: sys.hostname ?? "—" },
    { icon: <Cpu size={14} />, label: "Processor", value: sys.cpuModel ?? "—" },
    { icon: <Activity size={14} />, label: "Cores", value: sys.cores !== null ? String(sys.cores) : "—" },
    { icon: <MemoryStick size={14} />, label: "Memory", value: sys.memoryGb !== null ? `${sys.memoryGb} GB` : "—" },
    { icon: <HardDrive size={14} />, label: "Architecture", value: sys.arch ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="glass grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
        {rows.map((r) => (
          <HardRow key={r.label} icon={r.icon} label={r.label} value={r.value} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-frost-500">
            <Wifi size={13} className="text-frost-400" /> Network
          </div>
          <p className={cn("mt-2 text-[17px] font-bold tracking-tight", sys.online ? "text-emerald-300" : "text-rose-300")}>
            {sys.online ? "Connected" : "Offline"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-frost-500">
            {sys.netType ? `Connection type: ${sys.netType.toUpperCase()}` : "Live browser network state"}
          </p>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-frost-500">
            <Battery size={13} className="text-frost-400" /> Battery
          </div>
          {sys.battery ? (
            <>
              <p className="mt-2 text-[17px] font-bold tracking-tight text-frost-100">{Math.round(sys.battery.level * 100)}%</p>
              <p className="mt-0.5 text-[11.5px] text-frost-500">{sys.battery.charging ? "Charging" : "On battery"}</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-frost-500">Not available on this machine</p>
          )}
        </div>
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-frost-500">
        Everything here is read straight from the machine at user level — nothing is simulated, nothing needs admin.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LiveBadge() {
  const sys = useSystemInfo();
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3.5 py-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span className="text-[12px] font-semibold text-frost-200">{sys.os} · live</span>
    </div>
  );
}

function toneFor(pct: number): "good" | "mid" | "hot" {
  if (pct < 60) return "good";
  if (pct < 85) return "mid";
  return "hot";
}

function StatCard({ icon, label, value, sub, tone, bar }: { icon: React.ReactNode; label: string; value: string; sub: string; tone: "good" | "mid" | "hot"; bar: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-300">{icon}</span>
        {label}
      </div>
      <p className={cn("mt-3 text-[26px] font-bold tabular-nums tracking-tight", tone === "good" && "text-frost-100", tone === "mid" && "text-amber-200", tone === "hot" && "text-rose-300")}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11.5px] text-frost-500">{sub}</p>
      {bar > 0 && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/8">
          <motion.div
            className={cn("h-full rounded-full", tone === "hot" ? "bg-rose-400" : tone === "mid" ? "bg-amber-300" : "bg-[var(--accent)]")}
            animate={{ width: `${Math.max(2, bar)}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      )}
    </motion.div>
  );
}

function ChartCard({ icon, title, value, data, color }: { icon: React.ReactNode; title: string; value: string; data: number[]; color: string }) {
  const path = useMemo(() => sparkPath(data), [data]);
  const id = useRef(`grad-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-frost-500">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-300">{icon}</span>
          {title}
        </div>
        <span className="text-[15px] font-bold tabular-nums tracking-tight text-frost-100">{value}</span>
      </div>
      <svg viewBox="0 0 480 120" className="mt-3 h-[120px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L 480 120 L 0 120 Z`} fill={`url(#${id})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function sparkPath(data: number[]): string {
  const w = 480;
  const h = 120;
  const n = data.length;
  if (n < 2) return `M 0 ${h} L ${w} ${h}`;
  return data
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - (Math.min(100, Math.max(0, v)) / 100) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function HardRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.015] px-4 py-3.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-400">{icon}</span>
      <span className="w-32 shrink-0 text-[12px] text-frost-500">{label}</span>
      <span className="truncate text-[13px] font-semibold text-frost-100">{value}</span>
    </div>
  );
}

function HardwareCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass-soft flex items-center gap-3 rounded-xl px-3.5 py-3 text-left">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-400">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[10.5px] uppercase tracking-[0.12em] text-frost-500">{label}</p>
        <p className="truncate text-[13px] font-semibold text-frost-100">{value}</p>
      </div>
    </div>
  );
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}