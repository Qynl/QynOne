import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/* Text-to-speech — Nex speaks replies out loud                         */
/* ------------------------------------------------------------------ */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && ("speechSynthesis" in window) && typeof window.speechSynthesis === "object";
}

let lastVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (lastVoice) return lastVoice;
  try {
    const voices = window.speechSynthesis.getVoices();
    lastVoice =
      voices.find((v) => /en-US.*(natural|online|neural)/i.test(v.name)) ??
      voices.find((v) => /en(-|_)(US|GB)/i.test(v.lang)) ??
      voices[0] ??
      null;
  } catch {
    lastVoice = null;
  }
  return lastVoice;
}

if (speechSupported()) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      lastVoice = null;
      pickVoice();
    };
  } catch {
    // ignore
  }
}

/** Speak a line out loud. Safe to call anywhere; no-ops when unsupported. */
function notifySpeaking(active: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("qyn:nex-speaking", { detail: { active } }));
}

export function speak(text: string): void {
  if (!speechSupported() || !text.trim()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    notifySpeaking(true);
    const u = new SpeechSynthesisUtterance(text.replace(/[*_#`[\]()]/g, "").slice(0, 420));
    u.voice = pickVoice();
    u.rate = 1.04;
    u.pitch = 1.02;
    u.volume = 1;
    u.onend = () => notifySpeaking(false);
    u.onerror = () => notifySpeaking(false);
    synth.speak(u);
  } catch {
    // never let voice break the app
  }
}

export function stopSpeaking(): void {
  notifySpeaking(false);
  if (speechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

/* ------------------------------------------------------------------ */
/* Wake word — say "Nex" then give a command (Alexa-style)             */
/* ------------------------------------------------------------------ */

type NexVoiceMode = "off" | "wake" | "armed";

interface NexVoiceCallbacks {
  /** wake word heard — eyes should light up */
  onWake?: () => void;
  /** mic is listening for the wake word */
  onListenStart?: () => void;
  /** listening ended / went back to idle */
  onIdle?: () => void;
  /** a full spoken command was captured */
  onCommand: (text: string) => void;
  onError?: (message: string) => void;
}

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function getRecognitionCtor(): (new () => RecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as new () => RecognitionLike) : null;
}

const WAKE_RE = /\bnex\b/i;

/**
 * Hands-free voice: continuously listens for the wake word "Nex", then
 * captures the next utterance and hands it to `onCommand`.
 */
export function useNexVoice({ enabled, callbacks }: { enabled: boolean; callbacks: NexVoiceCallbacks }) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const modeRef = useRef<NexVoiceMode>("off");
  const bufferRef = useRef("");
  const armedAtRef = useRef(0);
  const restartedRef = useRef(false);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      cbRef.current.onError?.("voice isn't available in this browser");
      return;
    }
    if (!enabled) {
      modeRef.current = "off";
      bufferRef.current = "";
      cbRef.current.onIdle?.();
      return;
    }

    let disposed = false;
    let rec: RecognitionLike | null = null;

    const makeRec = (): RecognitionLike => {
      const r = new Ctor();
      r.continuous = true;
      r.interimResults = true;
      r.lang = navigator.language || "en-US";

      r.onresult = (e) => {
        if (!enabledRef.current) return;
        let finalText = "";
        let interimText = "";
        for (let i = e.results.length - 1; i >= 0; i--) {
          const res = e.results[i];
          const transcript = Array.from(res)
            .map((alt) => alt.transcript)
            .join("")
            .trim();
          if (res.isFinal) finalText = transcript;
          else interimText = transcript;
          if (finalText || interimText) break;
        }
        const spoken = (finalText || interimText).trim();
        if (!spoken) return;

        const mode = modeRef.current;
        if (mode === "wake") {
          if (WAKE_RE.test(spoken)) {
            modeRef.current = "armed";
            armedAtRef.current = Date.now();
            bufferRef.current = spoken.replace(WAKE_RE, "").replace(/^(hey|ok|okay)\s*/i, "").trim();
            cbRef.current.onWake?.();
          }
          return;
        }
        if (mode === "armed") {
          const cmd = spoken.replace(WAKE_RE, "").replace(/^(hey|ok|okay)\s*/i, "").trim();
          if (cmd) bufferRef.current = cmd;
          if (finalText && bufferRef.current) {
            const command = bufferRef.current;
            modeRef.current = "wake";
            bufferRef.current = "";
            cbRef.current.onCommand(command);
          }
        }
      };

      r.onend = () => {
        if (disposed || !enabledRef.current) return;
        // Chrome stops recognition after silence; quietly restart to stay hands-free.
        if (!restartedRef.current) {
          restartedRef.current = true;
          try {
            const r2 = makeRec();
            rec = r2;
            r2.start();
          } catch {
            // fall through
          }
          window.setTimeout(() => {
            restartedRef.current = false;
          }, 1500);
        }
      };

      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          cbRef.current.onError?.("microphone permission is needed for voice. Allow the mic and try again.");
        } else if (e.error === "network") {
          cbRef.current.onError?.("voice recognition needs an internet connection.");
        }
        // other errors: let onend handle the restart
      };

      return r;
    };

    try {
      rec = makeRec();
      modeRef.current = "wake";
      bufferRef.current = "";
      cbRef.current.onListenStart?.();
      rec.start();
    } catch {
      cbRef.current.onError?.("couldn't start the microphone.");
    }

    return () => {
      disposed = true;
      try {
        rec?.abort();
      } catch {
        // ignore
      }
      modeRef.current = "off";
      cbRef.current.onIdle?.();
    };
  }, [enabled]);
}