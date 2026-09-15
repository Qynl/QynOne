import { useCallback, useMemo } from "react";
import { useVault } from "./vault";
import { LESSONS_MAX_CHARS } from "./limits";

/**
 * Nex's per-project lessons-learned memory.
 *
 * Like personal memory, lessons are a REAL Markdown file in the vault
 * (`_Nex/Lessons.md`) — the source of truth a user can open, edit or wipe.
 * Lessons are keyed by game project: one section per project holds the
 * durable technical lessons Nex learned while building it (what broke, what
 * the fix was, what to do differently next time). The file is hard-capped;
 * the oldest lessons drop first and the newest always survive.
 *
 * On the desktop this is Documents\QynOneVault\_Nex\Lessons.md; in the web
 * preview it lives in the localStorage-backed vault.
 */

export const LESSONS_PATH = "_Nex/Lessons.md";

export interface Lesson {
  /** e.g. "l_1750000000000" — stable id stored in the file */
  id: string;
  /** project key — normalized goal name, or "general" */
  project: string;
  /** YYYY-MM-DD */
  date: string;
  text: string;
}

const ENTRY_RE = /^- \[(l_\d{10,})\]\s*(\d{4}-\d{2}-\d{2})\s*[—-]\s*(.+)$/;

/** A stable, filesystem-ish project key from a build goal. */
export function projectKey(goal: string): string {
  const g = goal.toLowerCase();
  const m = g.match(/(?:game|call(?:ed)?|titled|named)\s+"([^"]{2,40})"/) || g.match(/"([^"]{2,40})"/);
  const name = m?.[1]?.trim();
  if (name) return name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "general";
  return "general";
}

/** Parse a lessons file into (project → lessons) preserving section order. */
export function parseLessons(content: string): Record<string, Lesson[]> {
  const out: Record<string, Lesson[]> = {};
  let section = "general";
  for (const line of content.split(/\r?\n/)) {
    const head = line.match(/^## (.+?)\s*$/);
    if (head) {
      section = head[1].trim() || "general";
      if (!out[section]) out[section] = [];
      continue;
    }
    const m = line.match(ENTRY_RE);
    if (m) {
      if (!out[section]) out[section] = [];
      out[section].push({ id: m[1], project: section, date: m[2], text: m[3].trim() });
    }
  }
  return out;
}

/** Render the (project → lessons) map back into the lessons file. */
export function renderLessons(byProject: Record<string, Lesson[]>): string {
  const lines: string[] = [
    "# Nex — Build Lessons",
    "",
    "> Lessons I learned while building games. One section per project; the general section applies to every build. I read these before I start building so I never pay the same price twice — and you can edit or delete anything anytime.",
    "",
  ];
  const sections = Object.keys(byProject).sort((a, b) => (a === "general" ? -1 : b === "general" ? 1 : a.localeCompare(b)));
  for (const project of sections) {
    const list = byProject[project];
    if (list.length === 0) continue;
    lines.push(`## ${project}`, "");
    for (const l of list) lines.push(`- [${l.id}] ${l.date} — ${l.text}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Enforce the hard cap: drop oldest-first until the file fits. */
export function enforceLessonsBudget(byProject: Record<string, Lesson[]>): Record<string, Lesson[]> {
  let current = Object.fromEntries(Object.entries(byProject).map(([k, v]) => [k, [...v]]));
  while (renderLessons(current).length > LESSONS_MAX_CHARS) {
    // Victim: the oldest lesson overall (any section).
    let victim: Lesson | null = null;
    for (const list of Object.values(current)) {
      for (const l of list) {
        if (!victim || l.date.localeCompare(victim.date) < 0 || (l.date === victim.date && l.id < victim.id)) victim = l;
      }
    }
    if (!victim) break;
    current[victim.project] = current[victim.project].filter((l) => l.id !== victim!.id);
  }
  return current;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface LessonsValue {
  /** all parsed lessons keyed by project */
  byProject: Record<string, Lesson[]>;
  /** lessons for one project (general included) — for kickoff injection */
  forProject: (goal: string) => Lesson[];
  /** short text block for AI context; empty when nothing to teach */
  summaryFor: (goal: string) => string;
  /** persist one lesson; returns null when it was a duplicate */
  add: (project: string, text: string) => Promise<Lesson | null>;
  /** remove a lesson by id */
  remove: (id: string) => Promise<void>;
  /** count of lessons for a project */
  countFor: (goal: string) => number;
  /** true once the lessons file exists in the vault */
  ready: boolean;
  usage: number;
  max: number;
}

export function useLessons(): LessonsValue {
  const vault = useVault();

  const note = useMemo(() => vault.notes.find((n) => n.id === LESSONS_PATH) ?? null, [vault.notes]);
  const byProject = useMemo(() => parseLessons(note?.content ?? ""), [note]);

  const forProject = useCallback(
    (goal: string): Lesson[] => {
      const key = projectKey(goal);
      return [...(byProject[key] ?? []), ...(byProject.general ?? [])];
    },
    [byProject],
  );

  const summaryFor = useCallback(
    (goal: string): string => {
      const lessons = forProject(goal);
      if (lessons.length === 0) return "";
      const recent = lessons.slice(-12);
      return `Lessons you learned building this (and similar) games before — do not repeat them:\n${recent
        .map((l) => `- ${l.date}: ${l.text}`)
        .join("\n")}`;
    },
    [forProject],
  );

  const write = useCallback(
    async (next: Record<string, Lesson[]>) => {
      const content = renderLessons(enforceLessonsBudget(next));
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          if (note) {
            await vault.saveNote(LESSONS_PATH, content);
          } else {
            const created = await vault.createNote("Lessons", "_Nex", content);
            if (created) return;
          }
          return;
        } catch {
          await sleep(220);
        }
      }
    },
    [note, vault],
  );

  const add = useCallback(
    async (project: string, text: string): Promise<Lesson | null> => {
      const clean = text.trim().replace(/\s+/g, " ").slice(0, 280);
      if (!clean) return null;
      const key = project.trim() || "general";
      const existing = byProject[key] ?? [];
      if (existing.some((l) => l.text.toLowerCase() === clean.toLowerCase())) return null;
      const lesson: Lesson = {
        id: `l_${Date.now()}`,
        project: key,
        date: new Date().toISOString().slice(0, 10),
        text: clean,
      };
      await write({ ...byProject, [key]: [...existing, lesson] });
      return lesson;
    },
    [byProject, write],
  );

  const remove = useCallback(
    async (id: string) => {
      const next: Record<string, Lesson[]> = {};
      for (const [k, list] of Object.entries(byProject)) next[k] = list.filter((l) => l.id !== id);
      await write(next);
    },
    [byProject, write],
  );

  const countFor = useCallback((goal: string) => forProject(goal).length, [forProject]);

  return {
    byProject,
    forProject,
    summaryFor,
    add,
    remove,
    countFor,
    ready: note !== null,
    usage: renderLessons(byProject).length,
    max: LESSONS_MAX_CHARS,
  };
}
