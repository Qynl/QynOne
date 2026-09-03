import { useEffect, useState } from "react";
import { getDesktop } from "./desktop";

/* ------------------------------------------------------------------ */
/* Music — a real session Nex owns                                    */
/* ------------------------------------------------------------------ */

/**
 * Amazon Music has no public API to read back what is currently playing
 * and no reliable public search API for the Windows desktop app, so Nex
 * controls it through the user's installed app shortcut when available. If
 * Windows cannot expose that shortcut, he falls back to an exact Amazon Music
 * search in the browser. While that session is
 * active the eyes wear headphones, move with the beat, and show the track.
 * The user can correct the track ("I'm actually listening to X") and Nex
 * switches the caption to the real one; /music-stop clears the state.
 */

export interface NowPlaying {
  /** the track/artist/album Nex queued (or the user told him is playing) */
  title: string;
  since: number;
}

type Listener = (nowPlaying: NowPlaying | null) => void;

let current: NowPlaying | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(current);
}

/** Amazon Music web search URL — the honest fallback when the native app is unavailable. */
export function amazonMusicSearchUrl(query: string): string {
  return `https://music.amazon.com/search/${encodeURIComponent(query.replace(/\s+/g, " ").trim())}`;
}

/** Set the now-playing session (called when Nex starts/queues music). */
export function setNowPlaying(title: string): NowPlaying {
  current = { title: title.trim(), since: Date.now() };
  emit();
  return current;
}

/** Clear the now-playing session (/music-stop, or the user says it stopped). */
export function clearNowPlaying(): void {
  if (!current) return;
  current = null;
  emit();
}

export function getNowPlaying(): NowPlaying | null {
  return current;
}

/**
 * Open Amazon Music for a query.
 *
 * Desktop builds prefer the user's real Amazon Music Start Menu shortcut. The
 * installed app has no supported public search API, so QynOne launches that
 * app and only falls back to the exact Amazon Music search URL if the app is
 * not installed or no shortcut is available.
 */
export async function playOnAmazonMusic(query: string): Promise<{ ok: boolean; error?: string }> {
  const q = query.trim();
  if (!q) return { ok: false, error: "no music query" };
  const bridge = getDesktop();
  if (bridge) {
    try {
      const installed = await bridge.findShortcuts("Amazon Music");
      const appShortcut = installed.find((hit) => /^amazon music$/i.test(hit.name)) ?? installed[0];
      if (appShortcut) {
        const opened = await bridge.launch(appShortcut.path);
        if (opened.ok) return opened;
      }
      /* Store installs can expose a protocol but not a Start Menu shortcut. */
      const protocol = await bridge.launch("amazonmusic:");
      if (protocol.ok) return protocol;
      return await bridge.launch(amazonMusicSearchUrl(q));
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  }
  /* Web preview: open Amazon Music search in a new tab. */
  window.open(amazonMusicSearchUrl(q), "_blank", "noopener,noreferrer");
  return { ok: true };
}

/** Subscribe to now-playing changes. Returns an unsubscribe function. */
export function subscribeMusic(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: the current now-playing session (null when no music is on). */
export function useMusic(): NowPlaying | null {
  const [nowPlaying, setState] = useState<NowPlaying | null>(() => current);
  useEffect(() => subscribeMusic(setState), []);
  return nowPlaying;
}
