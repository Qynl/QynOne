import { describe, expect, it } from "bun:test";
import { NEX_MAX_IMAGE, NEX_MAX_MD, chatFileNameFor, fmtBytes, importErrorFor, isAllowedFile, kindOfFile, sanitizeRelPath, slugForChat } from "./nexfolder";

describe("kindOfFile", () => {
  it("classifies .md and .markdown as md", () => {
    expect(kindOfFile("brief.md")).toBe("md");
    expect(kindOfFile("PLAN.MD")).toBe("md");
    expect(kindOfFile("notes.markdown")).toBe("md");
  });

  it("classifies photos as image", () => {
    expect(kindOfFile("shot.png")).toBe("image");
    expect(kindOfFile("ref.JPG")).toBe("image");
    expect(kindOfFile("art.webp")).toBe("image");
    expect(kindOfFile("anim.gif")).toBe("image");
    expect(kindOfFile("frame.bmp")).toBe("image");
  });

  it("classifies plain text files as text", () => {
    expect(kindOfFile("notes.txt")).toBe("text");
    expect(kindOfFile("game.log")).toBe("text");
    expect(kindOfFile("config.json")).toBe("text");
    expect(kindOfFile("data.CSV")).toBe("text");
    expect(kindOfFile("brief.yaml")).toBe("text");
  });

  it("classifies code files as text", () => {
    expect(kindOfFile("client.lua")).toBe("text");
    expect(kindOfFile("main.py")).toBe("text");
    expect(kindOfFile("app.ts")).toBe("text");
    expect(kindOfFile("ui.jsx")).toBe("text");
    expect(kindOfFile("styles.css")).toBe("text");
    expect(kindOfFile("level.vert")).toBe("text");
  });

  it("rejects everything else", () => {
    expect(kindOfFile("game.exe")).toBe("other");
    expect(kindOfFile("photo.svg")).toBe("other");
    expect(kindOfFile("doc.pdf")).toBe("other");
    expect(kindOfFile("archive.zip")).toBe("other");
    expect(kindOfFile("scene.blend")).toBe("other");
    expect(kindOfFile("noext")).toBe("other");
    expect(kindOfFile("")).toBe("other");
    expect(kindOfFile("brief.md.exe")).toBe("other");
  });

  it("isAllowedFile mirrors kindOfFile", () => {
    expect(isAllowedFile("a.md")).toBe(true);
    expect(isAllowedFile("a.png")).toBe(true);
    expect(isAllowedFile("a.txt")).toBe(true);
    expect(isAllowedFile("a.lua")).toBe(true);
    expect(isAllowedFile("a.pdf")).toBe(false);
  });
});

describe("sanitizeRelPath", () => {
  it("normalizes backslashes and nested folders", () => {
    expect(sanitizeRelPath("Briefs\\Tactical Shooter.md")).toBe("Briefs/Tactical Shooter.md");
    expect(sanitizeRelPath("a/b/c.md")).toBe("a/b/c.md");
  });

  it("returns null for traversal or empty input", () => {
    expect(sanitizeRelPath("../escape.md")).toBe(null);
    expect(sanitizeRelPath("a/../../b.md")).toBe(null);
    expect(sanitizeRelPath("")).toBe(null);
    expect(sanitizeRelPath("   ")).toBe(null);
    expect(sanitizeRelPath(null)).toBe(null);
  });

  it("returns null for illegal characters and dotfiles", () => {
    expect(sanitizeRelPath("bad:name.md")).toBe(null);
    expect(sanitizeRelPath("bad*name.md")).toBe(null);
    expect(sanitizeRelPath("bad?name.md")).toBe(null);
    expect(sanitizeRelPath("a/.hidden.md")).toBe(null);
  });

  it("limits nesting depth", () => {
    expect(sanitizeRelPath("a/b/c/d.md")).toBe("a/b/c/d.md");
    expect(sanitizeRelPath("a/b/c/d/e.md")).toBe(null);
  });
});

describe("importErrorFor", () => {
  it("blocks disallowed types with a clear message", () => {
    const err = importErrorFor({ name: "notes.pdf", size: 100 });
    expect(err).toContain(".md");
    expect(err).toContain("text/code");
  });

  it("blocks oversized files", () => {
    expect(importErrorFor({ name: "big.md", size: NEX_MAX_MD + 1 })).not.toBe(null);
    expect(importErrorFor({ name: "big.lua", size: NEX_MAX_MD + 1 })).not.toBe(null);
    expect(importErrorFor({ name: "huge.png", size: NEX_MAX_IMAGE + 1 })).not.toBe(null);
  });

  it("allows in-budget .md, text/code and photos", () => {
    expect(importErrorFor({ name: "brief.md", size: 10_000 })).toBe(null);
    expect(importErrorFor({ name: "notes.txt", size: 10_000 })).toBe(null);
    expect(importErrorFor({ name: "server.lua", size: 10_000 })).toBe(null);
    expect(importErrorFor({ name: "photo.jpg", size: 2_000_000 })).toBe(null);
  });
});

describe("slugForChat", () => {
  it("builds a safe lowercase slug from the first words", () => {
    expect(slugForChat("Make a tactical shooter with cool maps!")).toBe("make-a-tactical-shooter-with-cool");
    expect(slugForChat("  Lots   of   spaces   here ")).toBe("lots-of-spaces-here");
  });

  it("falls back when the text is symbols only", () => {
    expect(slugForChat("!!!???")).toBe("message");
  });

  it("limits length and collapses dashes", () => {
    const long = slugForChat("a ".repeat(200));
    expect(long.length).toBeLessThanOrEqual(48);
    expect(long.includes("--")).toBe(false);
  });
});

describe("chatFileNameFor", () => {
  it("produces a unique Chat/ relative path with a timestamp", () => {
    const now = new Date(2026, 8, 4, 9, 5, 7); // Sep 4 2026 09:05:07
    expect(chatFileNameFor("Top secret project notes", now)).toBe("Chat/top-secret-project-notes-20260904-090507.md");
  });
});

describe("fmtBytes", () => {
  it("formats sizes", () => {
    expect(fmtBytes(0)).toBe("0 B");
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
