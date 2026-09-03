/**
 * QynOne vault budgets.
 *
 * The vault is a real folder of .md files and memory is a real file — so
 * instead of unbounded growth, everything has a budget and Nex (or the app)
 * manages what no longer fits. The .md files stay the source of truth; the
 * budgets only decide what gets kept there versus archived.
 */

/** Nex's personal-memory file (_Nex/Memory.md) — hard character cap. */
export const MEMORY_MAX_CHARS = 2000;

/** Soft management threshold — above this Nex compresses memory proactively. */
export const MEMORY_COMPACT_AT = 0.66;

/** Maximum size of one regular note file, in characters (~25 KB). */
export const NOTE_MAX_CHARS = 25_000;

/** Maximum number of user notes (files not in a `_` system folder). */
export const VAULT_MAX_NOTES = 300;

/** Oversized notes are condensed down to roughly this many characters. */
export const TIDY_KEEP_CHARS = 3000;
