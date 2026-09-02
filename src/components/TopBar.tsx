import { BatteryCharging, BatteryMedium, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQyn } from "../lib/store";
import { useSystemInfo } from "../lib/system";
import { clockTime } from "../lib/utils";
import { NotificationCenter } from "./NotificationCenter";

export function TopBar({ onOpenPalette, onHome }: { onOpenPalette: () => void; onHome: () => void }) {
  const { state } = useQyn();
  const sys = useSystemInfo();
  const [time, setTime] = useState(clockTime);

  useEffect(() => {
    const t = setInterval(() => setTime(clockTime()), 1000);
    return () => clearInterval(t);
  }, []);

  const showBattery = state.settings.battery && sys.battery !== null;
  const pct = sys.battery ? Math.round(sys.battery.level * 100) : 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/5 px-4 md:px-6">
      {/* Mobile brand */}
      <button
        onClick={onHome}
        className="rounded-lg px-1 text-[14px] font-bold tracking-tight text-frost-100 transition hover:text-accent md:hidden"
      >
        QynOne
      </button>

      {/* Time — quiet, small */}
      {state.settings.clock && (
        <div className="hidden min-w-0 items-baseline gap-2 md:flex">
          <p className="text-[12.5px] font-semibold tabular-nums tracking-tight text-frost-300">{time}</p>
        </div>
      )}

      <div className="min-w-0 flex-1" />

      {/* Right cluster */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onOpenPalette}
          title="Search (Ctrl+K)"
          className="grid h-8 w-8 place-items-center rounded-full text-frost-500 transition hover:bg-white/6 hover:text-frost-100"
        >
          <Search size={15} />
        </button>
        {showBattery && (
          <div
            className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium tabular-nums ${
              pct <= 20 ? "text-red-300" : "text-frost-400"
            }`}
            title={sys.battery?.charging ? "Charging" : "On battery"}
          >
            {sys.battery?.charging ? <BatteryCharging size={13} className="text-accent" /> : <BatteryMedium size={13} />}
            {pct}
          </div>
        )}
        <span className="mx-1 h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        <NotificationCenter />
      </div>
    </header>
  );
}