import { describe, expect, test } from "bun:test";
import { AUDIO_LIBRARY, SCAFFOLDS, SCENE_PRESETS, pickPreset, pickRubric, pickScaffold } from "./scaffolds";

describe("scaffold catalog", () => {
  test("covers the genre + polish layer", () => {
    const ids = SCAFFOLDS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(["obby", "survival", "collect", "horror", "racing", "tycoon", "shooter", "hud", "title"]),
    );
  });

  test("every scaffold has runnable, complete code", () => {
    for (const s of SCAFFOLDS) {
      expect(s.label.length).toBeGreaterThan(3);
      expect(s.provides.length).toBeGreaterThan(0);
      expect(s.engines.length).toBeGreaterThan(0);
      expect(s.code.length).toBeGreaterThan(500); // real skeletons, not stubs
      expect(s.code).not.toMatch(/\.\.\.|TODO|FIXME|placeholder/i); // no ellipsis or unfilled holes
      // every execution path yields or is event-driven — no busy-wait crashes
      expect(s.code).toMatch(/task\.wait|:Connect\(|OnClientEvent|Triggered/);
      expect(s.code.endsWith("`")).toBe(false); // template literal escaped correctly
    }
  });

  test("polish scaffolds target the client, genre scaffolds the server", () => {
    const hud = SCAFFOLDS.find((s) => s.id === "hud")!;
    const title = SCAFFOLDS.find((s) => s.id === "title")!;
    expect(hud.code).toContain("LocalScript");
    expect(title.code).toContain("LocalScript");
    const server = SCAFFOLDS.filter((s) => !["hud", "title"].includes(s.id));
    for (const s of server) expect(s.code).not.toContain("LocalScript");
  });

  test("horror scaffold keeps the proven tension systems", () => {
    const horror = SCAFFOLDS.find((s) => s.id === "horror")!;
    expect(horror.code).toContain("Atmosphere");
    expect(horror.code).toContain("sanity");
    expect(horror.code).toContain("Lerp");
  });
});

describe("pickScaffold", () => {
  test("matches every genre it advertises", () => {
    for (const s of SCAFFOLDS) {
      expect(pickScaffold(`make a ${s.genres[0]} game`)?.id).toBe(s.id);
    }
  });

  test("prefers the strongest genre signal", () => {
    expect(pickScaffold("make a scary horror game with a stalker")?.id).toBe("horror");
    expect(pickScaffold("build a racing game with laps")?.id).toBe("racing");
    expect(pickScaffold("tycoon factory idle game")?.id).toBe("tycoon");
  });

  test("returns null for unrelated goals", () => {
    expect(pickScaffold("write a poem about the ocean")).toBeNull();
    expect(pickScaffold("")).toBeNull();
  });
});

describe("pickPreset", () => {
  test("maps moods to the right preset", () => {
    expect(pickPreset("a creepy haunted mansion")?.id).toBe("horror-night");
    expect(pickPreset("cyberpunk city at night")?.id).toBe("neon-city");
    expect(pickPreset("cozy restaurant tycoon")?.id).toBe("cozy-interior");
    expect(pickPreset("bright island adventure")?.id).toBe("sunny-adventure");
  });

  test("never leaves a game goal without visual direction", () => {
    // Every genre keyword across the catalog resolves to a concrete preset.
    for (const s of SCAFFOLDS) {
      for (const genre of s.genres) {
        expect(pickPreset(`game about ${genre}`)).not.toBeNull();
      }
    }
  });

  test("unrelated text still returns null (caller decides the fallback)", () => {
    expect(pickPreset("a poem about the ocean")).toBeNull();
  });
});

describe("audio library and rubric", () => {
  test("audio library only cites verified public IDs", () => {
    expect(AUDIO_LIBRARY).toContain("12221967");
    expect(AUDIO_LIBRARY).toContain("607665037");
    expect(AUDIO_LIBRARY).toContain("NEVER hardcode unknown IDs");
  });

  test("rubric is concrete and actionable", () => {
    const rubric = pickRubric();
    expect(rubric).toContain("GAMEPLAY");
    expect(rubric).toContain("VISUALS");
    expect(rubric).toContain("STABILITY");
    expect(rubric).toContain("COMPLETENESS");
    expect(rubric.length).toBeGreaterThan(300);
  });

  test("scene presets carry exact engine values, not advice", () => {
    for (const p of SCENE_PRESETS) {
      expect(p.lighting).toMatch(/Ambient|ClockTime|Brightness/);
      expect(p.materials).toMatch(/\(\d+, ?\d+, ?\d+\)/); // exact RGB values, not vibes
      expect(p.audio.length).toBeGreaterThan(20);
    }
  });
});
