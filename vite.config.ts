import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

/* ------------------------------------------------------------------ */
/* Content-Security-Policy (injected as a meta tag)                    */
/*                                                                     */
/* Production is strict: scripts only from self (no inline, no eval —  */
/* the bundled app has none), no object/embed, no form posts, no       */
/* framing. connect-src allows https (OpenAI / custom endpoints) and   */
/* loopback http (Ollama model listing); MCP and AI requests run in    */
/* the Electron main process, outside this policy.                     */
/*                                                                     */
/* Development is looser only where Vite itself needs it: react-refresh */
/* injects one inline module script, and HMR uses WebSocket.           */
/* ------------------------------------------------------------------ */

const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "media-src 'self' https:",
  "worker-src 'self'",
].join("; ");

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

function cspMeta(content: string) {
  return {
    tag: "meta",
    attrs: { "http-equiv": "Content-Security-Policy", content },
    injectTo: "head" as const,
  };
}

function cspPlugin(): Plugin {
  let isDev = false;
  return {
    name: "qynone-csp",
    configResolved(config) {
      isDev = config.command === "serve";
    },
    transformIndexHtml: {
      order: "post",
      handler() {
        return [cspMeta(isDev ? DEV_CSP : PROD_CSP)];
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  server: {
    /* 0.0.0.0 + injected PORT + allowedHosts are required by the managed
       Freebuff preview (isolated workspace); the dev server is never
       exposed beyond that sandbox. Production CSP is applied at build. */
    host: "0.0.0.0",
    port: Number(process.env.PORT) || 5173,
    hmr: false,
    allowedHosts: true,
  },
});