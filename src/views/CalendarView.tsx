import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQyn } from "../lib/store";
import type { CalendarEvent } from "../lib/types";
import { dateKey, eventSortKey, fmtTime, isMissed, parseDateKey, parseTime, relativeDay, todayKey } from "../lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarView() {
  const { state, actions } = useQyn();
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string>(today);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const out: Array<{ key: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(cursor.year, cursor.month, -startOffset + i + 1);
      out.push({ key: dateKey(d), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ key: dateKey(new Date(cursor.year, cursor.month, d)), day: d, inMonth: true });
    }
    while (out.length % 7 !== 0) {
      const last = out[out.length - 1];
      const d = parseDateKey(last.key);
      d.setDate(d.getDate() + 1);
      out.push({ key: dateKey(d), day: d.getDate(), inMonth: false });
    }
    return out;
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of state.events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));
    return map;
  }, [state.events]);

  const selectedEvents = byDate.get(selected) ?? [];
  const upcoming = useMemo(() => {
    return state.events
      .filter((e) => !e.done)
      .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))
      .filter((e) => `${e.date}T${e.start || "99:99"}` >= `${today}T00:00`)
      .slice(0, 5);
  }, [state.events, today]);
  const missed = useMemo(
    () => state.events.filter((e) => isMissed(e)).sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))).slice(0, 5),
    [state.events],
  );

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-6 md:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-accent">{relativeDay(selected)}</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-frost-100 md:text-[26px]">Calendar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(today)}
              className="glass-soft h-8 rounded-lg px-3 text-[12px] font-semibold text-frost-200 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
            >
              Today
            </button>
            <button onClick={() => shiftMonth(-1)} className="glass-soft grid h-8 w-8 place-items-center rounded-lg text-frost-300 transition hover:text-frost-100" aria-label="Previous month">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => shiftMonth(1)} className="glass-soft grid h-8 w-8 place-items-center rounded-lg text-frost-300 transition hover:text-frost-100" aria-label="Next month">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Month grid */}
          <div className="glass rounded-2xl p-4">
            <p className="mb-3 text-[13px] font-bold tracking-tight text-frost-100">
              {MONTHS[cursor.month]} <span className="text-frost-400">{cursor.year}</span>
            </p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="pb-1 text-center text-[9.5px] font-semibold uppercase tracking-[0.14em] text-frost-500">
                  {w}
                </div>
              ))}
              {cells.map((c) => {
                const events = byDate.get(c.key) ?? [];
                const isToday = c.key === today;
                const isSelected = c.key === selected;
                const hasMissed = events.some((e) => isMissed(e));
                return (
                  <button
                    key={c.key}
                    onClick={() => setSelected(c.key)}
                    className={`relative flex min-h-[64px] flex-col items-stretch gap-1 rounded-xl border p-1.5 text-left transition ${
                      c.inMonth ? "" : "opacity-35"
                    } ${
                      isSelected
                        ? "border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft"
                        : "border-white/6 bg-white/[0.025] hover:border-white/14 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-md text-[11px] font-semibold tabular-nums ${
                        isToday ? "bg-[var(--accent)] text-white" : "text-frost-300"
                      }`}
                    >
                      {c.day}
                    </span>
                    <span className="space-y-0.5">
                      {events.slice(0, 2).map((ev) => (
                        <span key={ev.id} className="flex items-center gap-1">
                          {ev.start && <Clock3 size={8} className="shrink-0 text-frost-500" />}
                          <span
                            className={`block truncate rounded px-1 py-px text-[9.5px] font-medium ${
                              ev.done
                                ? "text-frost-600 line-through"
                                : hasMissed
                                  ? "bg-red-400/12 text-red-300"
                                  : "bg-accent-soft text-accent"
                            }`}
                          >
                            {ev.title}
                          </span>
                        </span>
                      ))}
                      {events.length > 2 && <span className="block pl-1 text-[9px] text-frost-500">+{events.length - 2} more</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day panel */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-bold tracking-tight text-frost-100">
                  {parseDateKey(selected).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </p>
                {selected !== today && (
                  <button onClick={() => setSelected(today)} className="text-[11px] font-medium text-accent transition hover:text-frost-200">
                    jump to today
                  </button>
                )}
              </div>
              <EventList events={selectedEvents} />
              <AddEventForm date={selected} onAdded={() => setSelected(selected)} />
            </div>

            <div className="glass rounded-2xl p-4">
              <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-frost-400">
                <CalendarDays size={12} /> Coming up
              </p>
              {upcoming.length === 0 ? (
                <p className="py-2 text-[12px] text-frost-500">Nothing scheduled. Tell Nex “add gym tomorrow at 6pm”.</p>
              ) : (
                <div className="space-y-1.5">
                  {upcoming.map((ev) => (
                    <UpcomingRow key={ev.id} ev={ev} onToggle={() => actions.toggleEventDone(ev.id)} onSelect={() => setSelected(ev.date)} />
                  ))}
                </div>
              )}
            </div>

            {missed.length > 0 && (
              <div className="glass rounded-2xl border-red-400/15 p-4">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Missed
                </p>
                <div className="space-y-1">
                  {missed.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 text-[12px]">
                      <span className="text-red-300/80 line-through">{ev.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-frost-500">{relativeDay(ev.date)}</span>
                      <button onClick={() => actions.toggleEventDone(ev.id)} className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/5 text-frost-400 transition hover:bg-accent-soft hover:text-accent" title="Mark done">
                        <Check size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EventList({ events }: { events: CalendarEvent[] }) {
  const { actions } = useQyn();
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTime, setEditTime] = useState("");

  if (events.length === 0) {
    return <p className="py-3 text-[12.5px] text-frost-500">Nothing on this day yet.</p>;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {events.map((ev) => {
        const miss = isMissed(ev);
        if (editing === ev.id) {
          return (
            <div key={ev.id} className="glass-soft space-y-1.5 rounded-xl p-2.5">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-[12.5px] text-frost-100 outline-none focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
              />
              <div className="flex items-center gap-2">
                <input
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  placeholder="14:30"
                  className="w-24 rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-[12px] text-frost-100 outline-none focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
                />
                <button
                  onClick={() => {
                    actions.updateEvent(ev.id, { title: editTitle.trim() || ev.title, start: editTime.trim() });
                    setEditing(null);
                  }}
                  className="ml-auto rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:brightness-110"
                >
                  Save
                </button>
                <button onClick={() => setEditing(null)} className="grid h-7 w-7 place-items-center rounded-lg text-frost-400 transition hover:bg-white/5">
                  <X size={13} />
                </button>
              </div>
            </div>
          );
        }
        return (
          <div
            key={ev.id}
            className={`group flex items-center gap-2.5 rounded-xl border border-white/6 bg-white/[0.025] px-2.5 py-2 transition hover:border-white/14 ${
              miss ? "border-red-400/20" : ""
            }`}
          >
            <button
              onClick={() => actions.toggleEventDone(ev.id)}
              className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition ${
                ev.done ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300" : "border-white/15 text-transparent hover:border-accent"
              }`}
              title={ev.done ? "Undo" : "Mark done"}
            >
              <Check size={11} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[12.5px] font-medium ${ev.done ? "text-frost-600 line-through" : "text-frost-100"}`}>
                {ev.title}
              </p>
              {ev.start && <p className="text-[10.5px] text-frost-500">{fmtTime(ev.start)}</p>}
            </div>
            <button
              onClick={() => {
                setEditing(ev.id);
                setEditTitle(ev.title);
                setEditTime(ev.start);
              }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-frost-500 opacity-0 transition group-hover:opacity-100 hover:bg-white/5 hover:text-frost-200"
              title="Edit"
            >
              <span className="text-[13px] leading-none">✎</span>
            </button>
            <button
              onClick={() => actions.removeEvent(ev.id)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-frost-500 opacity-0 transition group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-300"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function AddEventForm({ date, onAdded }: { date: string; onAdded: () => void }) {
  const { actions } = useQyn();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (!title.trim()) return;
    if (time && parseTime(time) === null) {
      setError("Time must be HH:MM");
      return;
    }
    actions.addEvent({ title, date, start: time });
    setTitle("");
    setTime("");
    setError("");
    setOpen(false);
    onAdded();
  }

  return (
    <div className="mt-3 border-t border-white/6 pt-3">
      <AnimatePresence>
        {open ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Event title…"
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[13px] text-frost-100 outline-none placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
            />
            <div className="flex items-center gap-2">
              <input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="14:30"
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-24 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-[13px] text-frost-100 outline-none placeholder:text-frost-500/70 focus:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
              />
              <span className="text-[11px] text-frost-500">leave time empty for an all-day to-do</span>
              <button onClick={submit} className="ml-auto rounded-lg bg-[var(--accent)] px-3 py-2 text-[12px] font-semibold text-white transition hover:brightness-110">
                Add
              </button>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-frost-400 transition hover:bg-white/5">
                <X size={13} />
              </button>
            </div>
            {error && <p className="text-[11px] text-red-300">{error}</p>}
          </motion.div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-frost-500 transition hover:text-accent"
          >
            <Plus size={13} /> Add event or to-do
          </button>
        )}
      </AnimatePresence>
    </div>
  );
}

function UpcomingRow({ ev, onToggle, onSelect }: { ev: CalendarEvent; onToggle: () => void; onSelect: () => void }) {
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition hover:bg-white/4">
      <button
        onClick={onToggle}
        className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded border transition ${
          ev.done ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300" : "border-white/15 text-transparent hover:border-accent"
        }`}
      >
        <Check size={10} />
      </button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`min-w-0 flex-1 truncate text-[12px] font-medium ${ev.done ? "text-frost-600 line-through" : "text-frost-200"}`}>
          {ev.title}
        </span>
        <span className="shrink-0 text-[10px] text-frost-500">
          {relativeDay(ev.date)}
          {ev.start ? ` · ${fmtTime(ev.start)}` : ""}
        </span>
      </button>
    </div>
  );
}