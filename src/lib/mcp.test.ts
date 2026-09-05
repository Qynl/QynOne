import { describe, expect, test } from "bun:test";
import { engineSlugs, minifyJsonSchema, slugify } from "./mcp";

/* ------------------------------------------------------------------ */
/* Slug safety                                                         */
/* ------------------------------------------------------------------ */

describe("engineSlugs", () => {
  test("plain names slugify as before", () => {
    expect(engineSlugs(["Roblox Studio", "Unreal Engine"])).toEqual(["roblox_studio", "unreal_engine"]);
  });

  test("duplicate names get deterministic suffixes — never colliding function names", () => {
    const slugs = engineSlugs(["Custom MCP", "Custom MCP", "Custom MCP"]);
    expect(new Set(slugs).size).toBe(3);
    expect(slugs[0]).toBe("custom_mcp");
    expect(slugs[1]).toBe("custom_mcp_2");
    expect(slugs[2]).toBe("custom_mcp_3");
  });

  test("suffixes skip names that already look suffixed", () => {
    const slugs = engineSlugs(["Foo", "Foo", "Foo_2", "Foo"]);
    expect(new Set(slugs).size).toBe(4);
    expect(slugs[0]).toBe("foo");
    expect(slugs[1]).toBe("foo_2");
    expect(slugs[2]).toBe("foo_2_2");
    expect(slugs[3]).toBe("foo_3");
  });

  test("empty names fall back to engine and dedupe", () => {
    const slugs = engineSlugs(["", ""]);
    expect(slugs).toEqual(["engine", "engine_2"]);
  });

  test("slugify keeps only function-name-safe characters", () => {
    expect(slugify("  Roblox  Studio (Beta!)  ")).toBe("roblox_studio_beta");
    expect(slugify("...")).toBe("engine");
  });
});

/* ------------------------------------------------------------------ */
/* JSON-schema minification                                            */
/* ------------------------------------------------------------------ */

describe("minifyJsonSchema", () => {
  test("drops verbose annotations but keeps structure", () => {
    const min = minifyJsonSchema({
      type: "object",
      $schema: "http://json-schema.org/draft-07/schema#",
      title: "WriteScript",
      additionalProperties: false,
      description: "  Write a Luau script into the   place.   ",
      markdownDescription: "**Markdown** docs that duplicate description.",
      default: {},
      properties: {
        script: {
          type: "string",
          description: "The script source.",
          minLength: 1,
        },
        run: { type: "boolean", default: true },
        tags: { type: "array", items: { type: "string", description: "tag", maxLength: 40 }, maxItems: 8 },
      },
      required: ["script"],
    } as Record<string, unknown>);
    expect(min.type).toBe("object");
    expect(min.$schema).toBeUndefined();
    expect(min.title).toBeUndefined();
    expect(min.additionalProperties).toBeUndefined();
    expect(min.markdownDescription).toBeUndefined();
    expect(min.default).toBeUndefined();
    expect(min.description).toBe("Write a Luau script into the place.");
    expect((min.properties as Record<string, unknown>).run).toEqual({ type: "boolean" });
    expect((min.properties as Record<string, unknown>).script).toEqual({ type: "string", description: "The script source.", minLength: 1 });
    expect((min.properties as Record<string, unknown>).tags).toEqual({
      type: "array",
      items: { type: "string", description: "tag", maxLength: 40 },
      maxItems: 8,
    });
    expect(min.required).toEqual(["script"]);
  });

  test("caps long prose instead of deleting meaning", () => {
    const long = "x".repeat(5000);
    const min = minifyJsonSchema({ type: "object", properties: { p: { type: "string", description: long } } });
    const desc = ((min.properties as Record<string, unknown>).p as Record<string, unknown>).description as string;
    expect(desc.length).toBeLessThanOrEqual(201);
    expect(desc.endsWith("…")).toBe(true);
  });

  test("minifies nested combinators, items and definitions", () => {
    const min = minifyJsonSchema({
      type: "object",
      properties: {
        choice: { oneOf: [{ type: "string", markdownDescription: "drop", description: "a" }, { type: "number" }] },
        list: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" } } } },
      },
    });
    const choice = (min.properties as Record<string, unknown>).choice as { oneOf?: unknown[] };
    expect(Array.isArray(choice.oneOf)).toBe(true);
    expect(choice.oneOf).toHaveLength(2);
    const items = ((min.properties as Record<string, unknown>).list as { items?: Record<string, unknown> }).items;
    expect(items).toBeDefined();
    expect((items as { additionalProperties?: unknown }).additionalProperties).toBeUndefined();
  });

  test("handles garbage and non-objects defensively", () => {
    expect(minifyJsonSchema(null)).toEqual({ type: "object" });
    expect(minifyJsonSchema(undefined)).toEqual({ type: "object" });
    expect(minifyJsonSchema("nope")).toEqual({ type: "object" });
    expect(minifyJsonSchema({ type: "string", enum: ["a", "b"] })).toEqual({ type: "string", enum: ["a", "b"] });
  });
});
