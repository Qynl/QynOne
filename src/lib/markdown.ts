/**
 * Tiny Markdown helpers for the QynOne vault — pure functions, no deps.
 * They intentionally parse only what the vault actually uses: the note
 * title, [[wiki links]] and #tags.
 */

/** Strip Markdown syntax for a plain-text preview. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, "$3$1")
    .replace(/#[^\s#]+/g, (m) => m.slice(1))
    .replace(/\s+/g, " ")
    .trim();
}

/** The note title: the first heading if present, else the first line of text. */
export function noteTitle(md: string, fallback = "Untitled"): string {
  const heading = md.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/m);
  if (heading) return heading[1].trim().slice(0, 80);
  const first = plainText(md);
  return (first || fallback).slice(0, 80) || fallback;
}

/** All [[wiki links]] in the note (target without alias). */
export function extractWikiLinks(md: string): string[] {
  const out: string[] = [];
  for (const m of md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = m[1].trim();
    if (target) out.push(target);
  }
  return [...new Set(out)];
}

/** All #tags in the note (headings and URLs excluded). */
export function extractTags(md: string): string[] {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    if (/^\s{0,3}#/.test(line)) continue; // headings
    if (/https?:\/\//.test(line)) continue; // links
    for (const m of line.matchAll(/(?<![\w#])#([\w-]{2,30})/g)) out.push(m[1].toLowerCase());
  }
  return [...new Set(out)];
}
