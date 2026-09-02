import { BatteryCharging, BatteryMedium, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQyn } from "../lib/store";
import { useSystemInfo } from "../lib/system";
import { clockTime, prettyToday } from "../lib/utils";

export function TopBar({ onOpenPalette, onHome }: { onOpenPalette: () => void; onHome: () => void }) {
  const { state } = useQyn();
  const sys = useSystemInfo();
  const [time, setTime] = useState(clockTime);

  useEffect(() => {
    const t = setInterval(() => setTime(clockTime()), 1000);
    return () => clearInterval(t);
  }, []);

  const showClock = state.settings.clock;
  const showBattery = state.settings.battery && sys.battery !== null;
  const pct = sys.battery ? Math.round(sys.battery.level * 100) : 0;

  return (
    <header className="flex h-[62px] shrink-0 items-center gap-4 border-b border-white/6 bg-white/[0.02] px-5 md:px-7">
      {/* Mobile brand — takes you home */}
      <div className="md:hidden">
        <button
          onClick={onHome}
          className="rounded-lg px-1 py-1 text-[15px] font-bold tracking-tight text-frost-100 transition hover:text-accent"
        >
          QynOne
        </button>
      </div>

      {/* Search pill */}
      <div className="flex min-w-0 flex-1 justify-center">
        <button
          onClick={onOpenPalette}
          className="group flex h-9 w-full max-w-xl items-center gap-2.5 rounded-full border border-white/8 bg-white/4 px-4 text-left transition-all duration-200 hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-white/6"
        >
          <Search size={15} className="shrink-0 text-frost-500 transition group-hover:text-accent" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-frost-500">
            Search apps, folders, actions…
          </span>
          <span className="kbd hidden sm:inline-flex">Ctrl&nbsp;K</span>
        </button>
      </div>

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-3">
        {showBattery && (
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium ${
              pct <= 20
                ? "border-red-400/25 bg-red-400/10 text-red-200"
                : "border-white/8 bg-white/4 text-frost-300"
            }`}
            title={sys.battery?.charging ? "Charging" : "On battery"}
          >
            {sys.battery?.charging ? (
              <BatteryCharging size={13} className="text-accent" />
            ) : (
              <BatteryMedium size={13} />
            )}
            <span className="tabular-nums">{pct}%</span>
          </div>
        )}
        {showClock && (
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-[13.5px] font-semibold tabular-nums tracking-tight text-frost-100">
              {time}
            </p>
            <p className="text-[10.5px] font-medium text-frost-500">{prettyToday()}</p>
          </div>
        )}
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2.5 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          <span className="text-[11.5px] font-medium text-emerald-200/90">ready</span>
        </div>
      </div>
    </header>
  );
}