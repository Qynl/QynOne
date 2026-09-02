import { resolveIcon } from "../lib/icons";
import { cn, shade } from "../lib/utils";

interface AppIconProps {
  icon: string;
  color: string;
  size?: number;
  className?: string;
  rounded?: string;
}

export function AppIcon({ icon, color, size = 44, className, rounded = "rounded-[14px]" }: AppIconProps) {
  const Glyph = resolveIcon(icon);
  return (
    <div
      className={cn("relative shrink-0 grid place-items-center shadow-[0_8px_24px_-10px_rgba(0,0,0,0.7)] ring-1 ring-white/12", rounded, className)}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${color} 0%, ${shade(color, -34)} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: "linear-gradient(150deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.14) 100%)" }}
      />
      <Glyph size={Math.round(size * 0.48)} strokeWidth={1.9} className="relative text-white drop-shadow-sm" />
    </div>
  );
}