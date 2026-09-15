import { describe, expect, test } from "bun:test";
import { enforceLessonsBudget, LESSONS_PATH, parseLessons, projectKey, renderLessons } from "./lessons";
import type { Lesson } from "./lessons";

describe("projectKey", () => {
  test("extracts quoted game titles, normalized", () => {
    expect(projectKey('build a game called "Night Runner" with sprinting')).toBe("night-runner");
    expect(projectKey('make "Doom" but cute')).toBe("doom");
  });

  test("falls back to general for unquoted goals", () => {
    expect(projectKey("build a horror obby with checkpoints")).toBe("general");
    expect(projectKey("")).toBe("general");
  });

  test("keys are filesystem-safe and stable", () => {
    expect(projectKey('a game "Weird/Name: The Sequel?"')).not.toMatch(/[/?:]/);
    expect(projectKey('game "Same"')).toBe(projectKey('game "Same" again'));
  });
});

describe("parse/render round-trip", () => {
  test("parses sections and entries", () => {
    const content = renderLessons({
      general: [{ id: "l_1750000000000", project: "general", date: "2026-01-01", text: "Always tag SafeLight zones before the sanity loop." }],
      "night-runner": [{ id: "l_1750000000001", project: "night-runner", date: "2026-01-02", text: "Doorway colliders need CanCollide off client-side." }],
    });
    expect(content).toContain("## general");
    expect(content).toContain("## night-runner");
    const parsed = parseLessons(content);
    expect(parsed["general"]?.[0]?.text).toContain("SafeLight");
    expect(parsed["night-runner"]?.[0]?.date).toBe("2026-01-02");
  });

  test("general sorts first, sections keep entries", () => {
    const content = renderLessons({
      zeta: [{ id: "l_1750000000000", project: "zeta", date: "2026-01-01", text: "z" }],
      general: [{ id: "l_1750000000001", project: "general", date: "2026-01-01", text: "g" }],
    });
    expect(content.indexOf("## general")).toBeLessThan(content.indexOf("## zeta"));
  });

  test("skips empty sections", () => {
    const content = renderLessons({ empty: [], general: [{ id: "l_1750000000000", project: "general", date: "2026-01-01", text: "x" }] });
    expect(content).not.toContain("## empty");
  });
});

describe("budget enforcement", () => {
  test("oldest lessons drop first, newest survive", () => {
    const old: Record<string, Lesson[]> = {};
    const base = Date.parse("2026-01-01");
    for (let i = 0; i < 400; i++) {
      const project = i % 2 === 0 ? "general" : "proj";
      (old[project] ??= []).push({
        id: `l_${1750000000000 + i}`,
        project,
        date: new Date(base + i * 86_400_000).toISOString().slice(0, 10),
        text: `lesson number ${i} about something technical that broke and how it was fixed`,
      });
    }
    const kept = enforceLessonsBudget(old);
    expect(renderLessons(kept).length).toBeLessThanOrEqual(8000);
    const all = Object.values(kept).flat();
    expect(all.some((l) => l.text.includes("lesson number 399"))).toBe(true); // newest survives
    expect(all.some((l) => l.text.includes("lesson number 0"))).toBe(false); // oldest dropped
  });
});

describe("module shape", () => {
  test("path and cap are wired", () => {
    expect(LESSONS_PATH).toBe("_Nex/Lessons.md");
  });
});
