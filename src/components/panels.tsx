import { motion } from "framer-motion";
import {
  BatteryCharging,
  Cpu,
  History,
  MemoryStick,
  Monitor,
  Play,
  Radio,
  Server,
  Trash2,
} from "lucide-react";
import { useQyn } from "../lib/store";
import { useSystemInfo } from "../lib/system";
import { cn, timeAgo } from "../lib/utils";
import { AppIcon } from "./AppIcon";
import { useLaunch, useUi, SectionHeader } from "./ui";

export function SystemPanel() {
  const sys = useSystemInfo();
  const pct = sys.battery ? Math.round(sys.battery.level * 100) : null;

  return (
    <section className="glass rounded-2xl p-4">
      <SectionHeader title="System" />
      <div className="space-y-2.5">
        <Row icon={<Monitor size={14} />} label="OS" value={sys.os} />
        {sys.hostname && <Row icon={<Server size={14} />} label="PC" value={sys.hostname} />}
        <Row icon={<MemoryStick size={14} />} label="Memory" value={`${sys.memoryGb} GB`} />
        <Row
          icon={<Cpu size={14} />}
          label="Processor"
          value={`${sys.cpuModel ?? `${sys.cores} cores`}`}
          bar={sys.load}
        />
        {pct !== null && (
          <Row
            icon={<BatteryCharging size={14} />}
            label="Battery"
            value={sys.battery?.charging ? `${pct}% · charging` : `${pct}%`}
            bar={pct}
            barClass={
              pct <= 20
                ? "bg-rose-400"
                : "bg-[linear-gradient(90deg,var(--accent),#7ce0c9)]"
            }
          />
        )}
        <Row
          icon={<Radio size={14} />}
          label="Network"
          value={sys.online ? `Online${sys.netType ? ` · ${sys.netType.toUpperCase()}` : ""}` : "Offline"}
        />
      </div>
    </section>
  );
}

function Row({
  icon,
  label,
  value,
  bar,
  barClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bar?: number;
  barClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/8 bg-white/4 text-frost-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] text-frost-500">{label}</span>
          <span className="truncate text-[12.5px] font-semibold tabular-nums text-frost-100">
            {value}
          </span>
        </div>
        {bar !== undefined && (
          <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/8">
            <div
              className={cn("h-full rounded-full transition-all duration-700", barClass ?? "bg-[var(--accent)] opacity-70")}
              style={{ width: `${Math.min(100, bar)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function RecentsPanel() {
  const { state, actions } = useQyn();
  const { toast } = useUi();
  const launch = useLaunch();

  const recents = state.recents
    .map((r) => ({ entry: r, app: state.apps.find((a) => a.id === r.appId) }))
    .filter((x) => x.app !== undefined);

  return (
    <section className="glass rounded-2xl p-4">
      <SectionHeader
        title="Recently opened"
        action={
          recents.length > 0 ? (
            <button
              onClick={() => {
                actions.clearRecents();
                toast("Recent activity cleared");
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-frost-500 transition hover:bg-white/6 hover:text-frost-300"
            >
              <Trash2 size={12} /> Clear
            </button>
          ) : undefined
        }
      />
      {recents.length === 0 ? (
        <div className="py-6 text-center">
          <History size={20} className="mx-auto text-frost-500/60" />
          <p className="mt-2 text-[13px] text-frost-400">Nothing opened yet</p>
          <p className="mt-0.5 text-[12px] text-frost-500">
            Launch something and it will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {recents.slice(0, 7).map(({ entry, app }) => (
            <motion.li
              key={entry.appId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <button
                onClick={() => launch(app!)}
                className="group flex w-full items-center gap-3 rounded-xl px-1.5 py-2 text-left transition hover:bg-white/4"
              >
                <AppIcon icon={app!.icon} color={app!.color} size={34} rounded="rounded-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-frost-100">{app!.name}</span>
                  <span className="block truncate text-[11.5px] text-frost-500">
                    {entry.count} {entry.count === 1 ? "launch" : "launches"} · {timeAgo(entry.lastOpened)}
                  </span>
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-frost-500 opacity-0 transition hover:bg-accent-soft hover:text-accent group-hover:opacity-100">
                  <Play size={13} />
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}