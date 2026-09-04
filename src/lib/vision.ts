/* ------------------------------------------------------------------ */
/* Vision — sending real images (screenshots, photos) to the model     */
/*                                                                     */
/* Pure helpers, no React: used by the chat engine (ai.tsx), the       */
/* composer (AiView) and Settings. When vision is enabled, user        */
/* messages with photo attachments and freshly taken screenshots are   */
/* sent as OpenAI-style content arrays with image_url parts.           */
/* ------------------------------------------------------------------ */

/** Inline marker that carries a captured screenshot from a tool result
 *  into the next API call as a real image part (stripped before the
 *  tool result is clamped/sent). */
export const VISION_MARKER = "__QYN_IMAGE__:";

/** Minimal structural shape of a file attachment (avoids importing the
 *  React-bound AiAttachment type here). */
export interface VisionFile {
  kind: string;
  dataUrl?: string;
}

export type ApiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Providers/models that are expected to accept image inputs. Ollama is
 *  off by default because most local models are text-only (an image-capable
 *  model like llava can be enabled explicitly). */
export function visionDefaultFor(provider: string): boolean {
  return provider === "openai" || provider === "custom";
}

/** Whether vision is on for a config. Undefined means "use the provider
 *  default", so existing saved configs behave sensibly. */
export function visionEnabled(cfg: { provider: string; vision?: boolean }): boolean {
  return cfg.vision ?? visionDefaultFor(cfg.provider);
}

function imageParts(files: VisionFile[]): ApiContentPart[] {
  const parts: ApiContentPart[] = [];
  for (const f of files) {
    if (f.kind === "image" && f.dataUrl?.startsWith("data:image/")) {
      parts.push({ type: "image_url", image_url: { url: f.dataUrl } });
    }
  }
  return parts;
}

/** Build the `content` of a user message: a plain string when vision is
 *  off or there are no readable images, otherwise a text + image_url
 *  array. `text` should already include the file-awar prompt when files
 *  are attached, so the model knows the on-disk paths too. */
export function apiContentFor(text: string, files: VisionFile[], vision: boolean): string | ApiContentPart[] {
  if (!vision) return text;
  const imgs = imageParts(files);
  if (imgs.length === 0) return text;
  return [{ type: "text", text }, ...imgs];
}

/** Extract the screenshot marker from a tool result. Returns the clean
 *  text (marker + data URL removed) and the image URL, or null when the
 *  result carries no screenshot. */
export function extractVisionData(content: string): { text: string; dataUrl: string } | null {
  const idx = content.indexOf(VISION_MARKER);
  if (idx === -1) return null;
  const dataUrl = content.slice(idx + VISION_MARKER.length).trim();
  if (!dataUrl.startsWith("data:image/") || !dataUrl.includes(";base64,")) return null;
  const text = content.slice(0, idx).trim();
  return { text, dataUrl };
}

/** True when any message in the array carries an image_url content part. */
export function hasImages(messages: Array<{ content?: unknown }>): boolean {
  return messages.some((m) => Array.isArray(m.content) && m.content.some((p) => p && typeof p === "object" && (p as { type?: string }).type === "image_url"));
}

/** Return a copy of the messages with every image_url part removed
 *  (text parts are kept, joined when a message was an image array).
 *  Used to retry a request when the model rejects images. */
export function stripImagesFromMessages<T extends { content?: unknown }>(messages: T[]): T[] {
  return messages.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const text = m.content
      .filter((p): p is { type: "text"; text: string } => !!p && typeof p === "object" && (p as { type?: string }).type === "text")
      .map((p) => p.text)
      .join("\n");
    return { ...m, content: text };
  });
}