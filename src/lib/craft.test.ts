import { describe, expect, test } from "bun:test";
import { CRAFT_SECTIONS, craftKickoff } from "./craft";

describe("craft curriculum", () => {
  test("covers the six craft disciplines", () => {
    expect(CRAFT_SECTIONS.map((s) => s.id)).toEqual([
      "lighting",
      "color",
      "audio",
      "ui",
      "gameplay",
      "critique",
    ]);
  });

  test("every section teaches derivation, not canned values", () => {
    for (const s of CRAFT_SECTIONS) {
      expect(s.body.length).toBeGreaterThan(300); // real rules, not slogans
      expect(s.body).toMatch(/\d/); // concrete ranges and numbers to derive from
      // The curriculum transfers principles — it must not tell the model to
      // blindly copy a fixed value set.
      expect(s.body.toLowerCase()).not.toContain("copy these exact values");
    }
  });

  test("lighting section maps mood → derivable parameters", () => {
    const lighting = CRAFT_SECTIONS.find((s) => s.id === "lighting")!;
    expect(lighting.body).toContain("ClockTime");
    expect(lighting.body).toContain("FogEnd");
    expect(lighting.body).toContain("Atmosphere");
  });

  test("critique protocol demands evidence before judgment", () => {
    const critique = CRAFT_SECTIONS.find((s) => s.id === "critique")!;
    expect(critique.body).toContain("RUN it");
    expect(critique.body).toContain("screenshot");
    expect(critique.body).toContain("Re-verify");
  });

  test("kickoff is compact and points to the full manual", () => {
    const kickoff = craftKickoff();
    expect(kickoff).toContain("/craft");
    expect(kickoff).toContain("LIGHT");
    expect(kickoff).toContain("COLOR");
    expect(kickoff).toContain("SOUND");
    expect(kickoff).toContain("FEEL");
    expect(kickoff).toContain("VERIFY LIKE A STRANGER");
    // Kickoff is the mindset, not the manual — keep it lean.
    expect(kickoff.length).toBeLessThan(1500);
  });
});
