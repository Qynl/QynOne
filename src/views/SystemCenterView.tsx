import { motion } from "framer-motion";
import { Activity, Clock4, Cpu, HardDrive, MemoryStick, Monitor, Server } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStats } from "../lib/stats";
import { useSystemInfo } from "../lib/system";
import { cn } from "../lib/utils";

const HISTORY = 48;

function useHistory() {
  const stats = useStats();
  const [cpu, setCpu] = useState<number[]>(() => Array(HISTORY).fill(stats.cpuPct));
  const [mem, setMem] = useState<number[]>(() =>
    Array(HISTORY).fill(Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100)),
  );

  useEffect(() => {
    setCpu((prev) => [...prev.slice(-(HISTORY - 1)), stats.cpuPct]);
    setMem((prev) => [
      ...prev.slice(-(HISTORY - 1)),
      Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100),
    ]);
  }, [stats.cpuPct, stats.memUsedBytes, stats.memTotalBytes]);

  return { cpu, mem };
}

export function SystemCenterView() {
  const stats = useStats();
  const sys = useSystemInfo();
  const { cpu, mem } = useHistory();

  const memPct = Math.round((stats.memUsedBytes / stats.memTotalBytes) * 100);
  const memUsedGb = (stats.memUsedBytes / 2 ** 30).toFixed(1);
  const memTotalGb = Math.max(1, Math.round(stats.memTotalBytes / 2 ** 30));

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 py-7 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-accent">System Center</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight text-frost-100 md:text-[30px]">
            Your PC, live.
          </h1>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-frost-400">
            Real performance readings from this machine — a beautiful replacement for opening Task Manager.
          </p>
        </div>
        <div className="glass flex items-center gap-2 rounded-full px-3.5 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[12px] font-semibold text-frost-200">
            {stats.platform === "web" ? "Preview simulation" : `${sys.os} · live`}
          </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Cpu size={15} />}
          label="CPU"
          value={`${stats.cpuPct}%`}
          sub={sys.cpuModel ?? `${sys.cores} logical processors`}
          tone={toneFor(stats.cpuPct)}
        />
        <StatCard
          icon={<MemoryStick size={15} />}
          label="Memory"
          value={`${memPct}%`}
          sub={`${memUsedGb} / ${memTotalGb} GB used`}
          tone={toneFor(memPct)}
        />
        <StatCard
          icon={<Clock4 size={15} />}
          label="Uptime"
          value={formatUptime(stats.uptimeSec)}
          sub="since last boot"
          tone="good"
        />
        <StatCard
          icon={<Server size={15} />}
          label="Processor"
          value={`${sys.cores}`}
          sub={sys.arch ? `${sys.arch} · ${sys.hostname ?? "your PC"}` : "logical cores"}
          tone="good"
        />
      </div>

      {/* Live charts */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <ChartCard
          icon={<Cpu size={14} />}
          title="CPU load"
          value={`${stats.cpuPct}%`}
          data={cpu}
          color="var(--accent)"
        />
        <ChartCard
          icon={<MemoryStick size={14} />}
          title="Memory"
          value={`${memPct}% · ${memUsedGb} GB`}
          data={mem}
          color="#7ce0c9"
        />
      </div>

      {/* Hardware */}
      <div className="mt-6">
        <h2 className="mb-4 flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-frost-300">
          <span className="h-4 w-[3px] rounded-full bg-[var(--accent)]" />
          Hardware
        </h2>
        <div className="glass grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2">
          <HardRow icon={<Monitor size={14} />} label="Operating system" value={sys.os} />
          <HardRow icon={<Server size={14} />} label="PC name" value={sys.hostname ?? "—"} />
          <HardRow icon={<Cpu size={14} />} label="Processor" value={sys.cpuModel ?? "—"} />
          <HardRow icon={<Activity size={14} />} label="Cores" value={String(sys.cores)} />
          <HardRow icon={<MemoryStick size={14} />} label="Memory" value={`${sys.memoryGb} GB`} />
          <HardRow icon={<HardDrive size={14} />} label="Architecture" value={sys.arch ?? "—"} />
        </div>
        <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-frost-500">
          {stats.platform === "web"
            ? "This preview shows simulated readings. In the installed app, every number above is read live from your machine at user level."
            : "All readings are read at user level — QynOne never requests elevated access."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function toneFor(pct: number): "good" | "mid" | "hot" {
  if (pct < 60) return "good";
  if (pct < 85) return "mid";
  return "hot";
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: "good" | "mid" | "hot";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-300">
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "mt-3 text-[26px] font-bold tabular-nums tracking-tight",
          tone === "good" && "text-frost-100",
          tone === "mid" && "text-amber-200",
          tone === "hot" && "text-rose-300",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11.5px] text-frost-500">{sub}</p>
    </motion.div>
  );
}

function ChartCard({
  icon,
  title,
  value,
  data,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  data: number[];
  color: string;
}) {
  const path = useMemo(() => sparkPath(data), [data]);
  const id = useRef(`grad-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-frost-500">
          <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-300">
            {icon}
          </span>
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
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
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

function HardRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white/[0.015] px-4 py-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-400">
        {icon}
      </span>
      <span className="w-32 shrink-0 text-[12px] text-frost-500">{label}</span>
      <span className="truncate text-[13px] font-semibold text-frost-100">{value}</span>
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