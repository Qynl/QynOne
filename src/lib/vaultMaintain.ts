import { NOTE_MAX_CHARS, TIDY_KEEP_CHARS, VAULT_MAX_NOTES } from "./limits";
import type { VaultNote } from "./vault";
import { isSystemNote } from "./vault";
import type { VaultValue } from "./vault";

/**
 * Vault management — how QynOne keeps the vault inside its budget.
 *
 * The vault is for remembering everything, so files have real limits and
 * Nex (or the app) manages what outgrows them. Everything here is
 * deterministic, reversible and local: nothing is deleted outright —
 * oversized or surplus notes are archived first under `_Nex/Archive/` (a
 * system folder that does not count against the budget), and the note keeps
 * a condensed version with a pointer to the archive.
 */

export interface TidyResult {
  actions: string[];
  trimmed: number;
  archived: number;
  overBudget: boolean;
}

export interface VaultUsage {
  notes: number;
  maxNotes: number;
  /** characters of the largest user note */
  largestChars: number;
  /** total characters across user notes */
  totalChars: number;
  over: boolean;
}

export function userNotesOf(notes: VaultNote[]): VaultNote[] {
  return notes.filter((n) => !isSystemNote(n));
}

export function vaultUsage(notes: VaultNote[]): VaultUsage {
  const userNotes = userNotesOf(notes);
  const largest = userNotes.reduce((m, n) => Math.max(m, n.content.length), 0);
  const total = userNotes.reduce((m, n) => m + n.content.length, 0);
  return {
    notes: userNotes.length,
    maxNotes: VAULT_MAX_NOTES,
    largestChars: largest,
    totalChars: total,
    over: userNotes.length > VAULT_MAX_NOTES || userNotes.some((n) => n.content.length > NOTE_MAX_CHARS),
  };
}

function stamp(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * One tidy pass:
 *  1. any note over NOTE_MAX_CHARS gets its full content archived to
 *     `_Nex/Archive/` and is condensed in place (first ~TIDY_KEEP_CHARS);
 *  2. when the note count exceeds VAULT_MAX_NOTES, the smallest orphan notes
 *     (no links in, no links out) are archived to bring it back under budget.
 * Returns human-readable actions for the UI / Nex to report.
 */
export async function runVaultTidy(vault: VaultValue): Promise<TidyResult> {
  const actions: string[] = [];
  let trimmed = 0;
  let archived = 0;

  const initial = userNotesOf(vault.notes);

  /* 1 — oversized notes, biggest first (bounded per pass). */
  const oversized = initial
    .filter((n) => n.content.length > NOTE_MAX_CHARS)
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 5);

  for (const note of oversized) {
    try {
      const archiveName = `${note.name}-${stamp()}`;
      const path = await vault.createNote(archiveName, "_Nex/Archive", note.content);
      if (!path) {
        actions.push(`Could not archive ${note.name}.md (kept as is).`);
        continue;
      }
      const condensed =
        note.content.slice(0, TIDY_KEEP_CHARS).trimEnd() +
        `\n\n---\n> 📦 This note outgrew the ${(NOTE_MAX_CHARS / 1000).toFixed(0)} KB budget — Nex archived the full version at \`_Nex/Archive/${archiveName}.md\`.\n`;
      await vault.saveNote(note.id, condensed);
      trimmed += 1;
      actions.push(`Trimmed ${note.name}.md — ${note.content.length.toLocaleString()} → ${condensed.length.toLocaleString()} chars (full version archived).`);
    } catch {
      actions.push(`Could not tidy ${note.name}.md — left untouched.`);
    }
  }

  /* 2 — note count over budget: archive the smallest orphan notes. */
  let remaining = vault.notes.filter((n) => !isSystemNote(n));
  if (remaining.length > VAULT_MAX_NOTES) {
    const excess = remaining.length - VAULT_MAX_NOTES;
    const orphans = remaining
      .filter((n) => n.backlinks.length === 0 && n.links.length === 0)
      .sort((a, b) => a.content.length - b.content.length)
      .slice(0, excess + 4);

    for (const note of orphans) {
      const current = vault.notes.filter((n) => !isSystemNote(n));
      if (current.length <= VAULT_MAX_NOTES) break;
      try {
        const archiveName = `${note.name}-${stamp()}`;
        const path = await vault.createNote(archiveName, "_Nex/Archive", note.content);
        if (!path) continue;
        await vault.deleteNote(note.id);
        archived += 1;
        actions.push(`Archived ${note.name}.md — the vault holds at most ${VAULT_MAX_NOTES} notes.`);
      } catch {
        // skip this one, try the next
      }
    }
  }

  const after = userNotesOf(vault.notes);
  const overBudget = after.length > VAULT_MAX_NOTES || after.some((n) => n.content.length > NOTE_MAX_CHARS);
  if (actions.length === 0) {
    actions.push("The vault is already within budget — nothing to tidy.");
  }
  return { actions, trimmed, archived, overBudget };
}
