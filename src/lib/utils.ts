export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Darken or lighten a hex color by a percentage (-100..100). */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const factor = amount < 0 ? 1 + amount / 100 : 1 + amount / 100;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((num >> 16) & 0xff) * factor);
  const g = clamp(((num >> 8) & 0xff) * factor);
  const b = clamp((num & 0xff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Avatar initials for a name, e.g. "Alex Rivera" -> "AR". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Q";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "just now";
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function prettyToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function clockTime(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/* ------------------------------------------------------------------ */
/* Calendar helpers                                                    */
/* ------------------------------------------------------------------ */

/** Local YYYY-MM-DD key for a date. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** Parse a YYYY-MM-DD key back into a local Date at noon (tz-safe). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
}

/** "09:30" -> minutes since midnight (invalid -> null). */
export function parseTime(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function fmtTime(t: string): string {
  const mins = parseTime(t);
  if (mins === null) return t;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "Today" / "Tomorrow" / "Yesterday" / weekday / "MMM d". */
export function relativeDay(key: string): string {
  const d = parseDateKey(key);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  if (diff > -7 && diff < 0) return "Last " + d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Events that are past-due: earlier day, or earlier today and never done. */
export function isMissed(ev: { date: string; start: string; done: boolean }): boolean {
  if (ev.done) return false;
  const today = todayKey();
  if (ev.date < today) return true;
  if (ev.date === today) {
    const mins = parseTime(ev.start);
    if (mins !== null) {
      const now = new Date();
      return now.getHours() * 60 + now.getMinutes() > mins + 5;
    }
    return false;
  }
  return false;
}

/** Sort key: date, then start time (all-day last within a day). */
export function eventSortKey(ev: { date: string; start: string }): string {
  return `${ev.date}T${ev.start ? ev.start.padStart(5, "0") : "99:99"}`;
}